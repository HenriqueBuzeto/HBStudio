using System;
using System.Collections.Concurrent;
using System.Collections.Generic;
using System.IO;
using System.Security.Cryptography;
using System.Text;

namespace BuildingBlocks.Security;

/// <summary>
/// Provedor criptográfico corporativo AES-256-GCM (Authenticated Encryption) com Derivação HKDF,
/// Keyring Versionado para Rotação Transparente de Chaves e AAD para isolamento Multi-tenant.
/// 
/// Formato de saída do envelope cifrado:
/// [1 byte: KeyVersion] + [12 bytes: Nonce CSPRNG] + [16 bytes: Tag de Autenticação] + [Ciphertext]
/// </summary>
public static class AesGcmEncryptionHelper
{
    private const int NonceSizeBytes = 12; // 96 bits recomendado pelo NIST SP 800-38D
    private const int TagSizeBytes = 16;   // 128 bits padrão de autenticação
    private const byte CurrentKeyVersion = 1; // Versão ativa para novas criptografias

    // Keyring de Chaves-Mestras por Versão (permite rotação sem quebrar registros antigos)
    private static readonly ConcurrentDictionary<byte, string> MasterKeyRing = new()
    {
        [1] = Environment.GetEnvironmentVariable("HB_STUDIO_FISCAL_MASTER_KEY_V1") 
              ?? Environment.GetEnvironmentVariable("HB_STUDIO_FISCAL_MASTER_KEY") 
              ?? "HB_STUDIO_ENTERPRISE_ERP_FISCAL_MASTER_KEY_SECRET_2026_HIGH_ENTROPY_V1!",
        [2] = Environment.GetEnvironmentVariable("HB_STUDIO_FISCAL_MASTER_KEY_V2")
              ?? "HB_STUDIO_ENTERPRISE_ERP_FISCAL_MASTER_KEY_SECRET_2026_HIGH_ENTROPY_V2_ROTATION!"
    };

    /// <summary>
    /// Registra ou substitui uma chave no Keyring Versionado para rotação dinâmica.
    /// </summary>
    public static void RegisterMasterKeyVersion(byte version, string secret)
    {
        if (string.IsNullOrWhiteSpace(secret)) throw new ArgumentException("Segredo não pode ser vazio.", nameof(secret));
        MasterKeyRing[version] = secret;
    }

    /// <summary>
    /// Deriva a subchave de 256 bits exclusiva para o Tenant via HKDF (RFC 5869)
    /// com base na versão da chave-mestra, Salt do Tenant e Domínio de Contexto.
    /// </summary>
    public static byte[] DeriveTenantKey(Guid tenantId, string purpose = "FiscalA1AndCscProtection", byte keyVersion = CurrentKeyVersion)
    {
        if (!MasterKeyRing.TryGetValue(keyVersion, out var masterSecret))
        {
            throw new CryptographicException($"Versão de chave-mestra '{keyVersion}' não encontrada no Keyring do sistema.");
        }

        byte[] ikm = Encoding.UTF8.GetBytes(masterSecret);
        byte[] salt = tenantId.ToByteArray(); // 16 bytes exclusivos do Tenant
        byte[] info = Encoding.UTF8.GetBytes($"HB_STUDIO_ERP_{purpose}_{tenantId:N}_V{keyVersion}");

        return HKDF.DeriveKey(HashAlgorithmName.SHA256, ikm, 32, salt, info);
    }

    public static byte[] BuildAad(Guid tenantId, string resourceType, string resourceId)
    {
        return Encoding.UTF8.GetBytes($"TENANT={tenantId:N};RES_TYPE={resourceType};RES_ID={resourceId};ALGO=AES-256-GCM");
    }

    /// <summary>
    /// Criptografa o payload prefixando a versão da chave utilizada: [Version 1b][Nonce 12b][Tag 16b][Ciphertext]
    /// </summary>
    public static byte[] EncryptWithEnvelope(byte[] plaintext, Guid tenantId, string purpose = "FiscalA1AndCscProtection", byte[]? associatedData = null, byte keyVersion = CurrentKeyVersion)
    {
        byte[] key = DeriveTenantKey(tenantId, purpose, keyVersion);
        byte[] rawEncrypted = Encrypt(plaintext, key, associatedData);

        byte[] envelope = new byte[1 + rawEncrypted.Length];
        envelope[0] = keyVersion;
        Buffer.BlockCopy(rawEncrypted, 0, envelope, 1, rawEncrypted.Length);
        return envelope;
    }

    /// <summary>
    /// Descriptografa inspecionando o cabeçalho de versão para resolver a chave correta mesmo após rotações.
    /// </summary>
    public static byte[] DecryptWithEnvelope(byte[] envelope, Guid tenantId, string purpose = "FiscalA1AndCscProtection", byte[]? associatedData = null)
    {
        if (envelope == null || envelope.Length < 1 + NonceSizeBytes + TagSizeBytes)
            throw new CryptographicException("Envelope criptografado corrompido ou incompleto.");

        byte keyVersion = envelope[0];
        byte[] rawEncrypted = new byte[envelope.Length - 1];
        Buffer.BlockCopy(envelope, 1, rawEncrypted, 0, rawEncrypted.Length);

        byte[] key = DeriveTenantKey(tenantId, purpose, keyVersion);
        return Decrypt(rawEncrypted, key, associatedData);
    }

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
