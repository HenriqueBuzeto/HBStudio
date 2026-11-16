namespace IdentityAccess.Application.DTOs;

public record LoginRequest(string Email, string Password);

public record UserProfileDto(
    Guid Id,
    string FullName,
    string Email,
    Guid TenantId,
    Guid? BranchId,
    bool IsPartner,
    string? PartnerRole,
    IReadOnlyList<string> Permissions,
    string? JobTitle = null);

public record LoginResponse(
    string AccessToken,
    DateTime ExpiresAtUtc,
    UserProfileDto User);
