using System.Collections.Concurrent;

namespace BuildingBlocks.Security;

public interface ISessionRevocationManager
{
    void RevokeSession(string sessionId);
    void RevokeAllSessionsForUser(Guid userId);
    bool IsSessionRevoked(string sessionId);
    bool IsUserRevoked(Guid userId, uint currentSecurityStamp, uint tokenSecurityStamp);
}

public class MemorySessionRevocationManager : ISessionRevocationManager
{
    private static readonly ConcurrentDictionary<string, DateTime> RevokedSessions = new();
    private static readonly ConcurrentDictionary<Guid, uint> UserRevocationStamps = new();

    public void RevokeSession(string sessionId)
    {
        if (!string.IsNullOrWhiteSpace(sessionId))
        {
            RevokedSessions.TryAdd(sessionId, DateTime.UtcNow);
        }
    }

    public void RevokeAllSessionsForUser(Guid userId)
    {
        UserRevocationStamps.AddOrUpdate(userId, 1, (_, stamp) => stamp + 1);
    }

    public bool IsSessionRevoked(string sessionId)
    {
        if (string.IsNullOrWhiteSpace(sessionId)) return true;
        return RevokedSessions.ContainsKey(sessionId);
    }

    public bool IsUserRevoked(Guid userId, uint currentSecurityStamp, uint tokenSecurityStamp)
    {
        if (tokenSecurityStamp < currentSecurityStamp) return true;
        if (UserRevocationStamps.TryGetValue(userId, out var minValidStamp) && tokenSecurityStamp < minValidStamp)
        {
            return true;
        }
        return false;
    }
}
