using System.Security.Cryptography;
using Microsoft.EntityFrameworkCore.Metadata;
using NotSpotify.Api.Models;
using NotSpotify.Api.Services;
using Xunit;

namespace NotSpotify.Api.Tests;

public class ChatMessageEncryptionTests
{
    private static ChatMessageEncryption NewEncryption(byte keySeed = 1)
    {
        var key = Enumerable.Range(0, 32).Select(i => (byte)(i + keySeed)).ToArray();
        return new ChatMessageEncryption(Convert.ToBase64String(key));
    }

    [Fact]
    public void Encrypt_ProducesVersionedCiphertextAndRoundTrips()
    {
        var encryption = NewEncryption();
        const string plaintext = "A private message 🔒";

        var stored = encryption.Encrypt(plaintext);

        Assert.StartsWith(ChatMessageEncryption.Prefix, stored);
        Assert.DoesNotContain(plaintext, stored);
        Assert.Equal(plaintext, encryption.Decrypt(stored));
    }

    [Fact]
    public void Encrypt_UsesANewNonceForEveryWrite()
    {
        var encryption = NewEncryption();

        var first = encryption.Encrypt("same message");
        var second = encryption.Encrypt("same message");

        Assert.NotEqual(first, second);
        Assert.Equal("same message", encryption.Decrypt(first));
        Assert.Equal("same message", encryption.Decrypt(second));
    }

    [Fact]
    public void Decrypt_RejectsTamperedCiphertext()
    {
        var encryption = NewEncryption();
        var stored = encryption.Encrypt("do not modify");
        var envelope = Convert.FromBase64String(stored[ChatMessageEncryption.Prefix.Length..]);
        envelope[^1] ^= 0x01;
        var tampered = ChatMessageEncryption.Prefix + Convert.ToBase64String(envelope);

        Assert.ThrowsAny<CryptographicException>(() => encryption.Decrypt(tampered));
    }

    [Fact]
    public void Decrypt_AllowsLegacyPlaintextForMigration()
    {
        var encryption = NewEncryption();

        Assert.Equal("old plaintext row", encryption.Decrypt("old plaintext row"));
    }

    [Fact]
    public void Constructor_RejectsMissingOrWrongLengthKeys()
    {
        Assert.Throws<InvalidOperationException>(() => new ChatMessageEncryption(""));
        Assert.Throws<InvalidOperationException>(() =>
            new ChatMessageEncryption(Convert.ToBase64String(new byte[16])));
    }

    [Fact]
    public async Task AppDbContext_MapsChatBodyToEncryptedProviderValue()
    {
        await using var db = TestHelpers.NewDb();
        var property = db.Model.FindEntityType(typeof(ChatMessage))!
            .FindProperty(nameof(ChatMessage.Body))!;
        var converter = property.GetValueConverter();

        Assert.NotNull(converter);
        var stored = Assert.IsType<string>(
            converter!.ConvertToProvider("database must not see this"));

        Assert.StartsWith(ChatMessageEncryption.Prefix, stored);
        Assert.DoesNotContain("database must not see this", stored);
        Assert.Equal("database must not see this", converter.ConvertFromProvider(stored));
    }
}
