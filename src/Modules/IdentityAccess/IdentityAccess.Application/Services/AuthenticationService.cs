using System.Collections.Concurrent;
using BuildingBlocks.Security;
using IdentityAccess.Application.DTOs;
using IdentityAccess.Domain;
using Microsoft.EntityFrameworkCore;
using PartnersCapital.Domain.Entities;

namespace IdentityAccess.Application.Services;

public interface IAuthenticationService
{
    Task<LoginResponse?> LoginAsync(LoginRequest request, CancellationToken ct = default);
    Task<UserProfileDto?> GetCurrentUserProfileAsync(Guid userId, CancellationToken ct = default);
}

public interface IIdentityDbContext
{
    DbSet<User> Users { get; }
    DbSet<Role> Roles { get; }
    DbSet<UserRole> UserRoles { get; }
    DbSet<RolePermission> RolePermissions { get; }
    DbSet<Partner> Partners { get; }
    DbSet<AuditEvent> AuditEvents { get; }
    Task<int> SaveChangesAsync(CancellationToken cancellationToken = default);
}

public class AuthenticationService : IAuthenticationService
{
    private readonly IIdentityDbContext _db;
    private readonly IPasswordHasher _passwordHasher;
    private readonly ITokenService _tokenService;

    // Rate Limiting em memória (mitigação contra força bruta)
    private static readonly ConcurrentDictionary<string, (int Attempts, DateTime LockedUntilUtc)> FailedAttempts = new();
    private const int MaxFailedAttempts = 5;
    private static readonly TimeSpan LockoutDuration = TimeSpan.FromMinutes(15);

    public AuthenticationService(
        IIdentityDbContext db,
        IPasswordHasher passwordHasher,
        ITokenService tokenService)
    {
        _db = db;
        _passwordHasher = passwordHasher;
        _tokenService = tokenService;
    }

    public async Task<LoginResponse?> LoginAsync(LoginRequest request, CancellationToken ct = default)
    {
        if (string.IsNullOrWhiteSpace(request.Email) || string.IsNullOrWhiteSpace(request.Password))
            return null;

        var normalizedEmail = request.Email.Trim().ToLowerInvariant();

        // 1. Verificação de lockout por tentativas falhas
        if (FailedAttempts.TryGetValue(normalizedEmail, out var tracker))
        {
            if (DateTime.UtcNow < tracker.LockedUntilUtc)
            {
                // Conta temporariamente bloqueada por excesso de tentativas
                return null;
            }
        }

        // 2. Busca da identidade do usuário no IdentityAccess
        var user = await _db.Users
            .AsNoTracking()
            .FirstOrDefaultAsync(u => u.Email == normalizedEmail, ct);

        // Se usuário não existe ou está inativo, registrar tentativa e retornar genérico (prevenção contra enumeração)
        if (user == null || !user.IsActive)
        {
            RecordFailedAttempt(normalizedEmail);
            await LogAuditEventAsync(null, null, "UserLoginFailed", null, normalizedEmail, "Credenciais inválidas ou usuário inativo.", ct);
            return null;
        }

        // 3. Validação segura da senha usando PBKDF2
        bool isPasswordValid = _passwordHasher.VerifyPassword(request.Password, user.PasswordHash);
        if (!isPasswordValid)
        {
            RecordFailedAttempt(normalizedEmail);
            await LogAuditEventAsync(user.TenantId, user.DefaultBranchId, "UserLoginFailed", user.Id, normalizedEmail, "Senha incorreta.", ct);
            return null;
        }

        // 4. REGRA CENTRAL ENTERPRISE: ACESSO INTERATIVO RESTRITO EXCLUSIVAMENTE AOS SÓCIOS AUTORIZADOS
        // O usuário autenticável deve possuir um vínculo societário ativo e vigente em PartnersCapital (MOD-13)
        var partner = await _db.Partners
            .AsNoTracking()
            .FirstOrDefaultAsync(p => p.TenantId == user.TenantId 
                                   && (p.Email.ToLower() == normalizedEmail || p.Name.ToLower() == user.FullName.ToLower())
                                   && p.Status == PartnerStatus.Active, ct);

        if (partner == null)
        {
            // Usuário tem senha válida, mas NÃO é sócio ativo/autorizado da HB Studio
            RecordFailedAttempt(normalizedEmail);
            await LogAuditEventAsync(user.TenantId, user.DefaultBranchId, "UserLoginRejectedNotPartner", user.Id, normalizedEmail, "Usuário sem vínculo societário ativo em PartnersCapital.", ct);
            return null;
        }

        // Sucesso: limpar tentativas falhas
        FailedAttempts.TryRemove(normalizedEmail, out _);

        // 5. Coleta de Permissões Efetivas do Usuário
        var roleIds = await _db.UserRoles
            .AsNoTracking()
            .Where(ur => ur.TenantId == user.TenantId && ur.UserId == user.Id)
            .Select(ur => ur.RoleId)
            .ToListAsync(ct);

        var permissions = await _db.RolePermissions
            .AsNoTracking()
            .Where(rp => rp.TenantId == user.TenantId && roleIds.Contains(rp.RoleId))
            .Select(rp => rp.PermissionKey)
            .Distinct()
            .ToListAsync(ct);

        // 6. Geração de Token JWT
        var tokenResult = _tokenService.GenerateToken(
            user.TenantId,
            user.DefaultBranchId,
            user.Id,
            user.Email,
            permissions);

        // 7. Auditoria de Acesso Autorizado
        await LogAuditEventAsync(
            user.TenantId,
            user.DefaultBranchId,
            "PartnerLoginSuccess",
            user.Id,
            user.Email,
            $"Login efetuado com sucesso pelo sócio {partner.Name} ({partner.Type}).",
            ct);

        var profile = new UserProfileDto(
            user.Id,
            user.FullName,
            user.Email,
            user.TenantId,
            user.DefaultBranchId,
            IsPartner: true,
            PartnerRole: partner.Type.ToString(),
            permissions);

        return new LoginResponse(tokenResult.AccessToken, tokenResult.ExpiresAtUtc, profile);
    }

    public async Task<UserProfileDto?> GetCurrentUserProfileAsync(Guid userId, CancellationToken ct = default)
    {
        var user = await _db.Users
            .AsNoTracking()
            .FirstOrDefaultAsync(u => u.Id == userId && u.IsActive, ct);

        if (user == null) return null;

        var partner = await _db.Partners
            .AsNoTracking()
            .FirstOrDefaultAsync(p => p.TenantId == user.TenantId 
                                   && (p.Email.ToLower() == user.Email.ToLower() || p.Name.ToLower() == user.FullName.ToLower())
                                   && p.Status == PartnerStatus.Active, ct);

        if (partner == null) return null;

        var roleIds = await _db.UserRoles
            .AsNoTracking()
            .Where(ur => ur.TenantId == user.TenantId && ur.UserId == user.Id)
            .Select(ur => ur.RoleId)
            .ToListAsync(ct);

        var permissions = await _db.RolePermissions
            .AsNoTracking()
            .Where(rp => rp.TenantId == user.TenantId && roleIds.Contains(rp.RoleId))
            .Select(rp => rp.PermissionKey)
            .Distinct()
            .ToListAsync(ct);

        return new UserProfileDto(
            user.Id,
            user.FullName,
            user.Email,
            user.TenantId,
            user.DefaultBranchId,
            IsPartner: true,
            PartnerRole: partner.Type.ToString(),
            permissions);
    }

    private static void RecordFailedAttempt(string email)
    {
        FailedAttempts.AddOrUpdate(
            email,
            _ => (1, DateTime.MinValue),
            (_, current) =>
            {
                var newCount = current.Attempts + 1;
                var lockedUntil = newCount >= MaxFailedAttempts 
                    ? DateTime.UtcNow.Add(LockoutDuration) 
                    : DateTime.MinValue;
                return (newCount, lockedUntil);
            });
    }

    private async Task LogAuditEventAsync(
        Guid? tenantId,
        Guid? branchId,
        string action,
        Guid? actorId,
        string actorEmail,
        string details,
        CancellationToken ct)
    {
        try
        {
            var audit = new AuditEvent(
                tenantId,
                branchId,
                "Authentication",
                actorId?.ToString() ?? "Anonymous",
                action,
                actorId,
                actorEmail,
                null,
                null,
                details);

            _db.AuditEvents.Add(audit);
            await _db.SaveChangesAsync(ct);
        }
        catch
        {
            // Falha em registrar log de auditoria não deve derrubar o fluxo de segurança
        }
    }
}
