namespace NotSpotify.Api.Services;

public interface IStorageService
{
    Task<string> GetAudioUrlAsync(string key, CancellationToken ct = default);
    string GetPublicUrl(string key);
    Task UploadAsync(string key, Stream content, string contentType, CancellationToken ct = default);
    Task DeleteAsync(string key, CancellationToken ct = default);

    /// <summary>
    /// Reads a stored object's bytes directly (disk for local storage, authed
    /// fetch for Supabase). Returns null if the object doesn't exist. Server-side
    /// consumers (e.g. track/album/playlist downloads) must use this instead of HTTP-fetching
    /// GetPublicUrl — public URLs are built for browsers and may not be
    /// reachable from the server itself.
    /// </summary>
    Task<byte[]?> ReadAsync(string key, CancellationToken ct = default);
}
