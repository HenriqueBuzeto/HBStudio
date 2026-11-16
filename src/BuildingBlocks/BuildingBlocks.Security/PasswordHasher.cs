using System.Security.Cryptography;

namespace BuildingBlocks.Security;

public interface IPasswordHasher
{
    string HashPassword(string password);
    bool VerifyPassword(string password, string passwordHash);
}

public class Pbkdf2PasswordHasher : IPasswordHasher
{
    private const int SaltSize = 16; // 128 bits
    private const int KeySize = 32;  // 256 bits
    public const int DefaultIterations = 600_000; // Padrão atualizado OWASP para PBKDF2-HMAC-SHA256
    private static readonly HashAlgorithmName Algorithm = HashAlgorithmName.SHA256;

    public string HashPassword(string password)
    {
        if (string.IsNullOrWhiteSpace(password))
            throw new ArgumentException("Password cannot be empty.", nameof(password));

        byte[] salt = RandomNumberGenerator.GetBytes(SaltSize);
        byte[] hash = Rfc2898DeriveBytes.Pbkdf2(
            password,
            salt,
            DefaultIterations,
            Algorithm,
            KeySize);

        // Formato seguro com versão: v1.{iterations}.{saltBase64}.{hashBase64}
        return $"v1.{DefaultIterations}.{Convert.ToBase64String(salt)}.{Convert.ToBase64String(hash)}";
    }

    public bool VerifyPassword(string password, string passwordHash)
    {
        if (string.IsNullOrWhiteSpace(password) || string.IsNullOrWhiteSpace(passwordHash))
            return false;

        var parts = passwordHash.Split('.');
        int iterations;
        string saltStr;
        string hashStr;

        if (parts.Length == 4 && parts[0] == "v1")
        {
            if (!int.TryParse(parts[1], out iterations) || iterations <= 0) return false;
            saltStr = parts[2];
            hashStr = parts[3];
        }
        else if (parts.Length == 3) // Formato anterior sem prefixo v1
        {
            if (!int.TryParse(parts[0], out iterations) || iterations <= 0) return false;
            saltStr = parts[1];
            hashStr = parts[2];
        }
        else
        {
            return false;
        }

        try
        {
            byte[] salt = Convert.FromBase64String(saltStr);
            byte[] expectedHash = Convert.FromBase64String(hashStr);

            byte[] actualHash = Rfc2898DeriveBytes.Pbkdf2(
                password,
                salt,
                iterations,
                Algorithm,
                expectedHash.Length);

            return CryptographicOperations.FixedTimeEquals(actualHash, expectedHash);
        }
        catch
        {
            return false;
        }
    }
}
