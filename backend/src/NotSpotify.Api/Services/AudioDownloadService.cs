using Microsoft.AspNetCore.StaticFiles;

namespace NotSpotify.Api.Services;

public sealed record AudioDownload(byte[] Bytes, string Extension, string ContentType);

/// <summary>
/// Reads audio through the configured storage backend, with an HTTP fallback for
/// legacy/seeded absolute URLs. All server-side download endpoints use this path.
/// </summary>
public sealed class AudioDownloadService
{
    private static readonly FileExtensionContentTypeProvider ContentTypes = new();

    private readonly IStorageService _storage;
    private readonly IHttpClientFactory _httpFactory;

    public AudioDownloadService(IStorageService storage, IHttpClientFactory httpFactory)
    {
        _storage = storage;
        _httpFactory = httpFactory;
    }

    public async Task<AudioDownload?> FetchAsync(
        string? audioKey,
        string? audioUrl,
        CancellationToken ct = default)
    {
        if (!string.IsNullOrWhiteSpace(audioKey))
        {
            var bytes = await _storage.ReadAsync(audioKey, ct);
            if (bytes is not null)
            {
                var extension = GetExtension(audioKey);
                return new AudioDownload(bytes, extension, GetContentType(extension));
            }
        }

        if (string.IsNullOrWhiteSpace(audioUrl)
            || !Uri.TryCreate(audioUrl, UriKind.Absolute, out var uri)
            || (uri.Scheme != Uri.UriSchemeHttp && uri.Scheme != Uri.UriSchemeHttps))
        {
            return null;
        }

        try
        {
            using var response = await _httpFactory.CreateClient()
                .GetAsync(uri, HttpCompletionOption.ResponseHeadersRead, ct);
            if (!response.IsSuccessStatusCode) return null;

            var bytes = await response.Content.ReadAsByteArrayAsync(ct);
            var extension = GetExtension(uri.AbsolutePath);
            var contentType = response.Content.Headers.ContentType?.MediaType
                ?? GetContentType(extension);
            return new AudioDownload(bytes, extension, contentType);
        }
        catch (Exception) when (!ct.IsCancellationRequested)
        {
            return null;
        }
    }

    private static string GetExtension(string source)
    {
        var extension = Path.GetExtension(source.Split('?')[0]);
        return string.IsNullOrWhiteSpace(extension) ? ".mp3" : extension;
    }

    private static string GetContentType(string extension) =>
        ContentTypes.TryGetContentType($"audio{extension}", out var contentType)
            ? contentType
            : "application/octet-stream";
}
