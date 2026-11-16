using System.IdentityModel.Tokens.Jwt;
using System.Security.Claims;
using System.Text;
using Microsoft.IdentityModel.Tokens;

namespace BuildingBlocks.Security;

public record TokenResponse(string AccessToken, DateTime ExpiresAtUtc, Guid UserId, string Email, IReadOnlyList<string> Permissions, string SessionId);

public interface ITokenService
{
    TokenResponse GenerateToken(Guid tenantId, Guid? branchId, Guid userId, string email, IEnumerable<string> permissions, string? sessionId = null, uint securityStamp = 1);
}

public class JwtTokenService : ITokenService
{
    private readonly string _signingKey;
    private readonly string _issuer;
    private readonly string _audience;

    public JwtTokenService(string signingKey, string issuer = "HBStudioErp", string audience = "HBStudioErpClient")
    {
        if (string.IsNullOrWhiteSpace(signingKey) || signingKey.Length < 32)
            throw new ArgumentException("A chave JWT deve possuir pelo menos 32 caracteres.", nameof(signingKey));

        _signingKey = signingKey;
        _issuer = issuer;
        _audience = audience;
    }

    public TokenResponse GenerateToken(Guid tenantId, Guid? branchId, Guid userId, string email, IEnumerable<string> permissions, string? sessionId = null, uint securityStamp = 1)
    {
        var tokenHandler = new JwtSecurityTokenHandler();
        var key = Encoding.UTF8.GetBytes(_signingKey);
        var expiresAt = DateTime.UtcNow.AddHours(8);
        var actualSessionId = sessionId ?? Guid.NewGuid().ToString("N");

        var claims = new List<Claim>
        {
            new(ClaimTypes.NameIdentifier, userId.ToString()),
            new(ClaimTypes.Email, email),
            new("tenant_id", tenantId.ToString()),
            new("session_id", actualSessionId),
            new("security_stamp", securityStamp.ToString()),
        };

        if (branchId.HasValue)
        {
            claims.Add(new("branch_id", branchId.Value.ToString()));
        }

        foreach (var perm in permissions)
        {
            claims.Add(new("permission", perm));
        }

        var tokenDescriptor = new SecurityTokenDescriptor
        {
            Subject = new ClaimsIdentity(claims),
            Expires = expiresAt,
            Issuer = _issuer,
            Audience = _audience,
            SigningCredentials = new SigningCredentials(new SymmetricSecurityKey(key), SecurityAlgorithms.HmacSha256Signature)
        };

        var token = tokenHandler.CreateToken(tokenDescriptor);
        return new TokenResponse(tokenHandler.WriteToken(token), expiresAt, userId, email, permissions.ToList(), actualSessionId);
    }
}
