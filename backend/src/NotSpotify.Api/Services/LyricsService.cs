using System.Net.Http.Json;
using NotSpotify.Api.Dtos;

namespace NotSpotify.Api.Services;

/// <summary>
/// Fetches lyrics from external providers. Chain: LRCLIB search (all candidate
/// entries scored — synced preferred, script matched to the title, closest
/// duration) → Lyrics.ovh. Best-effort: any error is swallowed and treated as
/// a miss so callers never have to wrap in try/catch.
/// </summary>
public class LyricsService
{
    private readonly IHttpClientFactory _httpFactory;
    private readonly ILogger<LyricsService> _logger;

    public LyricsService(IHttpClientFactory httpFactory, ILogger<LyricsService> logger)
    {
        _httpFactory = httpFactory;
        _logger = logger;
    }

    /// <summary>SyncedLyrics is raw LRC text when LRCLIB has a timed version, otherwise null.</summary>
    public record FetchResult(string Lyrics, string? SyncedLyrics, string Source);

    public async Task<FetchResult?> TryFetchAsync(string artistName, string title, long durationMs, CancellationToken ct = default)
    {
        if (string.IsNullOrWhiteSpace(artistName) || string.IsNullOrWhiteSpace(title))
            return null;

        var hit = await TryLrclibSearchAsync(artistName, title, durationMs / 1000.0, ct);
        if (hit is not null) return hit;

        // Lyrics.ovh — backup for Western catalogue
        try
        {
            var url = $"https://api.lyrics.ovh/v1/{Uri.EscapeDataString(artistName)}/{Uri.EscapeDataString(title)}";
            using var http = _httpFactory.CreateClient();
            http.Timeout = TimeSpan.FromSeconds(8);
            var resp = await http.GetFromJsonAsync<LyricsOvhResponse>(url, ct);
            if (!string.IsNullOrWhiteSpace(resp?.Lyrics))
                return new FetchResult(resp.Lyrics.Trim(), null, "lyrics_ovh");
        }
        catch (Exception ex) when (ex is HttpRequestException or TaskCanceledException or OperationCanceledException)
        {
            _logger.LogDebug(ex, "Lyrics.ovh fetch failed for {Artist} - {Title}", artistName, title);
        }

        return null;
    }

    /// <summary>
    /// LRCLIB keeps duplicate entries per song in different scripts (e.g. kanji vs
    /// romanized) and durations, and /api/get just returns whichever duplicate the
    /// duration happens to land on. So we fetch ALL candidates via /api/search and
    /// pick the best one ourselves.
    /// </summary>
    private async Task<FetchResult?> TryLrclibSearchAsync(string artistName, string title, double durationSec, CancellationToken ct)
    {
        try
        {
            var url = $"https://lrclib.net/api/search?artist_name={Uri.EscapeDataString(artistName)}&track_name={Uri.EscapeDataString(title)}";
            using var http = _httpFactory.CreateClient();
            http.Timeout = TimeSpan.FromSeconds(8);

            var candidates = await http.GetFromJsonAsync<List<LrclibResponse>>(url, ct);
            if (candidates is not { Count: > 0 }) return null;

            var titleHasCjk = ContainsCjk(title);
            var best = candidates
                .Select(c => (entry: c, score: ScoreCandidate(c, titleHasCjk, durationSec)))
                .Where(x => x.score >= 0)
                .OrderByDescending(x => x.score)
                .Select(x => x.entry)
                .FirstOrDefault();
            if (best is null) return null;

            var synced = string.IsNullOrWhiteSpace(best.SyncedLyrics) ? null : best.SyncedLyrics.Trim();
            // When a timed version exists it is canonical: derive plain text from it so
            // the two never diverge.
            var plain = synced is not null ? StripLrcTimestamps(synced) : best.PlainLyrics!.Trim();
            return new FetchResult(plain, synced, "lrclib");
        }
        catch (Exception ex) when (ex is HttpRequestException or TaskCanceledException or OperationCanceledException)
        {
            _logger.LogDebug(ex, "LRCLIB search failed for {Artist} - {Title}", artistName, title);
        }
        return null;
    }

    /// <summary>Higher is better; negative means unusable.</summary>
    private static int ScoreCandidate(LrclibResponse c, bool titleHasCjk, double durationSec)
    {
        if (c.Instrumental) return -1;
        var text = !string.IsNullOrWhiteSpace(c.SyncedLyrics) ? c.SyncedLyrics : c.PlainLyrics;
        if (string.IsNullOrWhiteSpace(text)) return -1;

        var score = 0;
        if (!string.IsNullOrWhiteSpace(c.SyncedLyrics)) score += 4;
        // Script match outranks duration: a Japanese/Korean/Chinese title should get
        // lyrics in that script, not a romanized duplicate that happens to be closer
        // in length.
        if (titleHasCjk && ContainsCjk(text)) score += 3;
        var diff = Math.Abs((c.Duration ?? 0) - durationSec);
        if (diff <= 2) score += 2;
        else if (diff <= 10) score += 1;
        return score;
    }

    /// <summary>True if the string contains CJK ideographs, kana, or hangul.</summary>
    public static bool ContainsCjk(string text)
    {
        foreach (var ch in text)
        {
            if ((ch >= 0x3040 && ch <= 0x30FF)   // hiragana + katakana
                || (ch >= 0x4E00 && ch <= 0x9FFF) // CJK unified ideographs
                || (ch >= 0x3400 && ch <= 0x4DBF) // CJK extension A
                || (ch >= 0xAC00 && ch <= 0xD7AF) // hangul syllables
                || (ch >= 0x1100 && ch <= 0x11FF)) // hangul jamo
                return true;
        }
        return false;
    }

    public static string StripLrcTimestamps(string lrc)
    {
        var lines = lrc
            .Split('\n')
            .Select(l => System.Text.RegularExpressions.Regex.Replace(l, @"\[\d{1,2}:\d{2}(?:[.:]\d{1,3})?\]", "").Trim());
        return string.Join("\n", lines).Trim();
    }
}
