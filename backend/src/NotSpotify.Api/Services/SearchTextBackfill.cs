using Microsoft.EntityFrameworkCore;
using NotSpotify.Api.Data;
using NotSpotify.Api.Models;

namespace NotSpotify.Api.Services;

/// <summary>
/// (Re)computes <c>SearchText</c> for Artists, Albums and Tracks via
/// <see cref="SearchTextBuilder"/>.
///
/// Runs at startup with <c>force: false</c> to fill rows that don't have a blob yet
/// and to recompute all rows once when <see cref="SearchAliases.Version"/> changes.
/// The <c>backfill-search-text</c> CLI command runs it with <c>force: true</c>.
/// </summary>
public static class SearchTextBackfill
{
    private const string AliasVersionKey = "search.aliases.version";

    public static async Task<int> RunAsync(AppDbContext db, bool force = false, CancellationToken ct = default)
    {
        var updated = 0;
        var setting = await db.AppSettings.FirstOrDefaultAsync(s => s.Key == AliasVersionKey, ct);
        var aliasVersionChanged = setting?.Value != SearchAliases.Version;
        var shouldForce = force || aliasVersionChanged;

        var artists = await (shouldForce ? db.Artists : db.Artists.Where(a => a.SearchText == null))
            .ToListAsync(ct);
        foreach (var a in artists)
        {
            var text = SearchTextBuilder.ForArtist(a.Name);
            if (a.SearchText != text) { a.SearchText = text; updated++; }
        }

        var albums = await (shouldForce ? db.Albums : db.Albums.Where(a => a.SearchText == null))
            .Include(a => a.Artist)
            .ToListAsync(ct);
        foreach (var al in albums)
        {
            var text = SearchTextBuilder.ForAlbum(al.Title, al.Artist?.Name);
            if (al.SearchText != text) { al.SearchText = text; updated++; }
        }

        var tracks = await (shouldForce ? db.Tracks : db.Tracks.Where(t => t.SearchText == null))
            .Include(t => t.Artist)
            .Include(t => t.Album)
            .ToListAsync(ct);
        foreach (var t in tracks)
        {
            var text = SearchTextBuilder.ForTrack(t.Title, t.Artist?.Name, t.Album?.Title);
            if (t.SearchText != text) { t.SearchText = text; updated++; }
        }

        if (setting is null)
        {
            db.AppSettings.Add(new AppSetting
            {
                Key = AliasVersionKey,
                Value = SearchAliases.Version,
                UpdatedAt = DateTime.UtcNow,
            });
            updated++;
        }
        else if (aliasVersionChanged)
        {
            setting.Value = SearchAliases.Version;
            setting.UpdatedAt = DateTime.UtcNow;
            updated++;
        }

        if (updated > 0) await db.SaveChangesAsync(ct);
        return updated;
    }
}
