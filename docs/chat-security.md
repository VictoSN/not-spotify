# Chat message security

Chat messages use two complementary protections:

- **In transit:** production traffic uses HTTPS and secure SignalR WebSockets
  (`wss://`), which provide TLS confidentiality and integrity between the client
  and API.
- **At rest:** `ChatMessage.Body` is converted to a versioned AES-256-GCM
  envelope before EF Core writes it to PostgreSQL. A fresh 96-bit nonce is
  generated for every write and the GCM authentication tag detects tampering.

This is server-side encryption at rest, **not end-to-end encryption**. The API
must decrypt a message before returning it to an authenticated participant.
Database readers and stolen database backups cannot read message bodies without
the separately managed application key.

Chat notifications deliberately contain only `Open Messages to read it.` so the
plaintext body is not copied into the `Notifications` table or a push payload.
The encryption migration also replaces previews in older chat notification rows.

## Configuration

Generate a 32-byte random key once and store its Base64 representation in the
deployment secret named:

```text
ChatEncryption__KeyBase64
```

For local .NET user-secrets, set the equivalent configuration path:

```powershell
dotnet user-secrets set "ChatEncryption:KeyBase64" "<BASE64_KEY>"
```

Do not commit the key. Back it up in the project's secret manager: losing or
replacing it makes existing encrypted chat history unreadable.

For controlled rotation, set `ChatEncryption__PreviousKeyBase64` for one
deployment. The service can read the previous key while rewriting every message
with the active key during startup. Remove the previous key after that rollout.

Stored values begin with `enc:v1:` to support future format migrations. At
startup, `ChatMessageEncryptionBackfill` finds historical plaintext rows and
rewrites them through the encrypted EF converter.
