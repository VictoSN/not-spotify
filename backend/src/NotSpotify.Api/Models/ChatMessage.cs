namespace NotSpotify.Api.Models;

/// <summary>
/// A direct message between two friends. Messages are only allowed between
/// users whose Friendship row is Accepted (enforced in ChatController).
/// </summary>
public class ChatMessage
{
    public Guid Id { get; set; } = Guid.NewGuid();

    public Guid SenderId { get; set; }
    public ApplicationUser Sender { get; set; } = null!;

    public Guid RecipientId { get; set; }
    public ApplicationUser Recipient { get; set; } = null!;

    /// <summary>
    /// Plaintext message body. NOTE: not encrypted yet — see the commented
    /// end-to-end encryption reference below for the planned design.
    /// </summary>
    public string Body { get; set; } = string.Empty;

    public DateTime SentAt { get; set; } = DateTime.UtcNow;

    /// <summary>Set when the recipient opens the conversation (read receipt).</summary>
    public DateTime? ReadAt { get; set; }

    // ── End-to-end encryption (NOT IMPLEMENTED YET — reference for later) ──────
    //
    // When E2E encryption is enabled, `Body` is no longer stored. Instead the
    // client encrypts the plaintext with a per-conversation key and we persist
    // only opaque ciphertext. The server can route but never read messages.
    //
    // Planned columns (uncomment + migrate when implementing):
    //
    // /// <summary>AES-256-GCM ciphertext of the message body (Base64).</summary>
    // public string? CipherText { get; set; }
    //
    // /// <summary>Random 12-byte nonce/IV used for this message (Base64). Never reuse per key.</summary>
    // public string? Nonce { get; set; }
    //
    // /// <summary>16-byte GCM authentication tag (Base64) — integrity check.</summary>
    // public string? AuthTag { get; set; }
    //
    // /// <summary>
    // /// Key-agreement metadata: which of the sender's published X25519 prekeys
    // /// was used so the recipient can derive the same shared secret (ECDH),
    // /// run it through HKDF, and decrypt. See frontend utils/chatEncryption.ts.
    // /// </summary>
    // public string? SenderPublicKeyId { get; set; }
}
