using System;
using System.IO;
using System.Security.Cryptography;
using System.Text;

namespace BuildingBlocks.Security;

/// <summary>
/// Provedor criptográfico corporativo AES-256-GCM (Authenticated Encryption).
/// Protege chaves privadas, senhas de certificados A1 e tokens CSC contra violação e adulteração de bits.
/// Formato de saída: [12 bytes Nonce] + [16 bytes Tag de Autenticação] + [Ciphertext]
/// </summary>
public static class AesGcmEncryptionHelper
{
    private const int NonceSizeBytes = 12; // 96 bits recomendado pelo NIST SP 800-38D
    private const int TagSizeBytes = 16;   // 128 bits padrão de autenticação

    public static byte[] Encrypt(byte[] plaintext, byte[] key, byte[]? associatedData = null)
    {
        if (plaintext == null) throw new ArgumentNullException(nameof(plaintext));
        if (key == null || key.Length != 32)
            throw new ArgumentException("A chave para AES-256-GCM deve possuir exatamente 32 bytes (256 bits).", nameof(key));

        byte[] nonce = new byte[NonceSizeBytes];
        RandomNumberGenerator.Fill(nonce);

        byte[] tag = new byte[TagSizeBytes];
        byte[] ciphertext = new byte[plaintext.Length];

        using (var aesGcm = new AesGcm(key, TagSizeBytes))
        {
            aesGcm.Encrypt(nonce, plaintext, ciphertext, tag, associatedData);
        }

        byte[] result = new byte[NonceSizeBytes + TagSizeBytes + ciphertext.Length];
        Buffer.BlockCopy(nonce, 0, result, 0, NonceSizeBytes);
        Buffer.BlockCopy(tag, 0, result, NonceSizeBytes, TagSizeBytes);
        Buffer.BlockCopy(ciphertext, 0, result, NonceSizeBytes + TagSizeBytes, ciphertext.Length);

        return result;
    }

    public static byte[] Decrypt(byte[] encryptedPayload, byte[] key, byte[]? associatedData = null)
    {
        if (encryptedPayload == null) throw new ArgumentNullException(nameof(encryptedPayload));
        if (encryptedPayload.Length < NonceSizeBytes + TagSizeBytes)
            throw new CryptographicException("Payload criptografado corrompido ou incompleto.");
        if (key == null || key.Length != 32)
            throw new ArgumentException("A chave para AES-256-GCM deve possuir exatamente 32 bytes (256 bits).", nameof(key));

        byte[] nonce = new byte[NonceSizeBytes];
        byte[] tag = new byte[TagSizeBytes];
        int ciphertextLength = encryptedPayload.Length - NonceSizeBytes - TagSizeBytes;
        byte[] ciphertext = new byte[ciphertextLength];

        Buffer.BlockCopy(encryptedPayload, 0, nonce, 0, NonceSizeBytes);
        Buffer.BlockCopy(encryptedPayload, NonceSizeBytes, tag, 0, TagSizeBytes);
        Buffer.BlockCopy(encryptedPayload, NonceSizeBytes + TagSizeBytes, ciphertext, 0, ciphertextLength);

        byte[] plaintext = new byte[ciphertextLength];

        using (var aesGcm = new AesGcm(key, TagSizeBytes))
        {
            // Decrypt verifica a integridade do Tag antes de liberar os dados. Lança CryptographicException se adulterado.
            aesGcm.Decrypt(nonce, ciphertext, tag, plaintext, associatedData);
        }

        return plaintext;
    }

    public static byte[] DeriveKeyFromSecret(string secret, string salt = "HB_STUDIO_FISCAL_A1_SALT_2026")
    {
        return Rfc2898DeriveBytes.Pbkdf2(
            Encoding.UTF8.GetBytes(secret),
            Encoding.UTF8.GetBytes(salt),
            100_000,
            HashAlgorithmName.SHA256,
            32
        );
    }
}
