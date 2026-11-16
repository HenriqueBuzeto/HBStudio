using BuildingBlocks.Security;
using IdentityAccess.Domain;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;

namespace IdentityAccess.Application.Services;

public class DbSessionRevocationManager : ISessionRevocationManager
{
    private readonly IServiceProvider _serviceProvider;

    public DbSessionRevocationManager(IServiceProvider serviceProvider)
    {
        _serviceProvider = serviceProvider;
    }

    public void RevokeSession(string sessionId)
    {
        if (string.IsNullOrWhiteSpace(sessionId)) return;

        using var scope = _serviceProvider.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<IIdentityDbContext>();

        var exists = db.RevokedSessions.Any(rs => rs.SessionId == sessionId.Trim());
        if (!exists)
        {
            var revoked = new RevokedSession(sessionId.Trim(), null, DateTime.UtcNow.AddDays(7), "User logout");
            db.RevokedSessions.Add(revoked);
            db.SaveChangesAsync().GetAwaiter().GetResult();
        }
    }

    public void RevokeAllSessionsForUser(Guid userId)
    {
        using var scope = _serviceProvider.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<IIdentityDbContext>();

        var user = db.Users.FirstOrDefault(u => u.Id == userId);
        if (user != null)
        {
            user.InvalidateSecurityStamp();
            db.SaveChangesAsync().GetAwaiter().GetResult();
        }
    }

    public bool IsSessionRevoked(string sessionId)
    {
        if (string.IsNullOrWhiteSpace(sessionId)) return true;

        using var scope = _serviceProvider.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<IIdentityDbContext>();

        return db.RevokedSessions.AsNoTracking().Any(rs => rs.SessionId == sessionId.Trim());
    }

    public bool IsUserRevoked(Guid userId, uint currentSecurityStamp, uint tokenSecurityStamp)
    {
        if (tokenSecurityStamp < currentSecurityStamp) return true;

        using var scope = _serviceProvider.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<IIdentityDbContext>();

        var user = db.Users.AsNoTracking().FirstOrDefault(u => u.Id == userId);
        if (user == null || !user.IsActive) return true;

        return tokenSecurityStamp < user.SecurityStamp;
    }
}
