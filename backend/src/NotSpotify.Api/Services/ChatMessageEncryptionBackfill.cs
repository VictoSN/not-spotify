using Microsoft.EntityFrameworkCore;
using NotSpotify.Api.Data;

namespace NotSpotify.Api.Services;

/// <summary>Rewrites chat rows created before at-rest encryption was introduced.</summary>
public static class ChatMessageEncryptionBackfill
{
    public static async Task<int> RunAsync(
        AppDbContext db,
        CancellationToken cancellationToken = default)
    {
        if (!db.Database.IsRelational())
            return 0;

        // Query the provider value directly. Materializing ChatMessage entities
        // would already decrypt Body, making legacy and encrypted rows look alike.
        var legacyIds = await db.Database.SqlQueryRaw<Guid>(
                """
                SELECT "Id" AS "Value"
                FROM "ChatMessages"
                WHERE "Body" NOT LIKE 'enc:v1:%'
                """)
            .ToListAsync(cancellationToken);

        if (legacyIds.Count == 0)
            return 0;

        const int batchSize = 250;
        foreach (var batch in legacyIds.Chunk(batchSize))
        {
            var messages = await db.ChatMessages
                .Where(message => batch.Contains(message.Id))
                .ToListAsync(cancellationToken);

            foreach (var message in messages)
            {
                // Force the value converter to write the legacy plaintext back
                // as an authenticated encrypted envelope.
                db.Entry(message).Property(item => item.Body).IsModified = true;
            }

            await db.SaveChangesAsync(cancellationToken);
            db.ChangeTracker.Clear();
        }

        return legacyIds.Count;
    }
}
