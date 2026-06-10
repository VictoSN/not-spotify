using System.Net.Http.Json;
using NotSpotify.Api.Dtos;

namespace NotSpotify.Api.Services;

/// <summary>
/// Fetches plain-text lyrics from external providers. Chain: LRCLIB (exact match
/// with duration → fuzzy without duration) → Lyrics.ovh. Best-effort: any error
/// is swallowed and treated as a miss so callers never have to wrap in try/catch.
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

    public record FetchResult(string Lyrics, string Source);

    public async Task<FetchResult?> TryFetchAsync(string artistName, string title, long durationMs, CancellationToken ct = default)
    {
        if (string.IsNullOrWhiteSpace(artistName) || string.IsNullOrWhiteSpace(title))
            return null;

        var artistEnc = Uri.EscapeDataString(artistName);
        var titleEnc  = Uri.EscapeDataString(title);
        var durationSec = durationMs / 1000;

        // LRCLIB exact match (LRCLIB itself tolerates ±2s on duration)
        var hit = await TryLrclibAsync(artistEnc, titleEnc, durationSec, ct);
        if (hit is not null) return hit;

        // LRCLIB fuzzy: drop duration so a slightly-different upload still matches
        hit = await TryLrclibAsync(artistEnc, titleEnc, null, ct);
        if (hit is not null) return hit;

        // Lyrics.ovh — backup for Western catalogue
        try
        {
            var url = $"https://api.lyrics.ovh/v1/{artistEnc}/{titleEnc}";
            using var http = _httpFactory.CreateClient();
            http.Timeout = TimeSpan.FromSeconds(8);
            var resp = await http.GetFromJsonAsync<LyricsOvhResponse>(url, ct);
            if (!string.IsNullOrWhiteSpace(resp?.Lyrics))
                return new FetchResult(resp.Lyrics.Trim(), "lyrics_ovh");
        }
        catch (Exception ex) when (ex is HttpRequestException or TaskCanceledException or OperationCanceledException)
        {
            _logger.LogDebug(ex, "Lyrics.ovh fetch failed for {Artist} - {Title}", artistName, title);
        }

        return null;
    }

    private async Task<FetchResult?> TryLrclibAsync(string artistEnc, string titleEnc, long? durationSec, CancellationToken ct)
    {
        try
        {
            var url = durationSec.HasValue
                ? $"https://lrclib.net/api/get?artist_name={artistEnc}&track_name={titleEnc}&duration={durationSec.Value}"
                : $"https://lrclib.net/api/get?artist_name={artistEnc}&track_name={titleEnc}";

            using var http = _httpFactory.CreateClient();
            http.Timeout = TimeSpan.FromSeconds(8);

            var response = await http.GetAsync(url, ct);
            if (!response.IsSuccessStatusCode) return null;

            var lrclib = await response.Content.ReadFromJsonAsync<LrclibResponse>(cancellationToken: ct);
            if (lrclib is { Instrumental: false } && !string.IsNullOrWhiteSpace(lrclib.PlainLyrics))
                return new FetchResult(lrclib.PlainLyrics.Trim(), "lrclib");
        }
        catch (Exception ex) when (ex is HttpRequestException or TaskCanceledException or OperationCanceledException)
        {
            _logger.LogDebug(ex, "LRCLIB fetch failed");
        }
        return null;
    }
}
