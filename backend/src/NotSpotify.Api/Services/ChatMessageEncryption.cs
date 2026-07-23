using System.Security.Cryptography;
using System.Text;

namespace NotSpotify.Api.Services;

/// <summary>
/// Authenticated encryption for chat bodies stored by the server.
///
/// This protects database rows and backups; it is not end-to-end encryption
/// because the API process holds the key and decrypts messages for clients.
/// </summary>
public interface IChatMessageEncryption
{
    string Encrypt(string plaintext);
    string Decrypt(string storedValue);
    bool IsEncrypted(string storedValue);
}

public sealed class ChatMessageEncryption : IChatMessageEncryption
{
    public const string Prefix = "enc:v1:";
    private const int NonceSize = 12;
    private const int TagSize = 16;
    private readonly byte[] _key;

    public ChatMessageEncryption(string keyBase64)
    {
        if (string.IsNullOrWhiteSpace(keyBase64))
        {
            throw new InvalidOperationException(
                "ChatEncryption:KeyBase64 is required. Generate 32 random bytes, " +
                "encode them as Base64, and provide the value through secrets or an environment variable.");
        }

        try
        {
            _key = Convert.FromBase64String(keyBase64);
        }
        catch (FormatException exception)
        {
            throw new InvalidOperationException(
                "ChatEncryption:KeyBase64 must be a valid Base64 value.", exception);
        }

        if (_key.Length != 32)
        {
            throw new InvalidOperationException(
                "ChatEncryption:KeyBase64 must decode to exactly 32 bytes for AES-256-GCM.");
        }
    }

    public bool IsEncrypted(string storedValue) =>
        storedValue.StartsWith(Prefix, StringComparison.Ordinal);

    public string Encrypt(string plaintext)
    {
        ArgumentNullException.ThrowIfNull(plaintext);

        var nonce = RandomNumberGenerator.GetBytes(NonceSize);
        var plaintextBytes = Encoding.UTF8.GetBytes(plaintext);
        var ciphertext = new byte[plaintextBytes.Length];
        var tag = new byte[TagSize];

        using (var aes = new AesGcm(_key, TagSize))
        {
            aes.Encrypt(nonce, plaintextBytes, ciphertext, tag);
        }

        // A versioned envelope lets a future key/message format coexist with v1.
        var envelope = new byte[NonceSize + TagSize + ciphertext.Length];
        Buffer.BlockCopy(nonce, 0, envelope, 0, NonceSize);
        Buffer.BlockCopy(tag, 0, envelope, NonceSize, TagSize);
        Buffer.BlockCopy(ciphertext, 0, envelope, NonceSize + TagSize, ciphertext.Length);
        return Prefix + Convert.ToBase64String(envelope);
    }

    public string Decrypt(string storedValue)
    {
        ArgumentNullException.ThrowIfNull(storedValue);

        // Existing rows written before encryption remain readable and are
        // rewritten by the startup backfill.
        if (!IsEncrypted(storedValue))
            return storedValue;

        byte[] envelope;
        try
        {
            envelope = Convert.FromBase64String(storedValue[Prefix.Length..]);
        }
        catch (FormatException exception)
        {
            throw new CryptographicException("The encrypted chat message is malformed.", exception);
        }

        if (envelope.Length < NonceSize + TagSize)
            throw new CryptographicException("The encrypted chat message is incomplete.");

        var nonce = envelope.AsSpan(0, NonceSize);
        var tag = envelope.AsSpan(NonceSize, TagSize);
        var ciphertext = envelope.AsSpan(NonceSize + TagSize);
        var plaintext = new byte[ciphertext.Length];

        using (var aes = new AesGcm(_key, TagSize))
        {
            aes.Decrypt(nonce, ciphertext, tag, plaintext);
        }

        return Encoding.UTF8.GetString(plaintext);
    }
}
