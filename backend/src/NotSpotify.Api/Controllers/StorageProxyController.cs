using Microsoft.AspNetCore.Mvc;
using NotSpotify.Api.Services;

namespace NotSpotify.Api.Controllers;

/// <summary>
/// Proxies storage images through the backend so they work regardless of
/// whether the storage bucket has a public-read policy. The proxy uses the
/// service credentials to fetch, so the browser never talks to storage directly.
/// </summary>
[ApiController]
[Route("storage")]
public class StorageProxyController : ControllerBase
{
    private readonly IStorageService _storage;

    public StorageProxyController(IStorageService storage)
    {
        _storage = storage;
    }

    /// <summary>
    /// GET /storage/images/artists/{guid}.png → streams the file from storage.
    /// The full storage key is passed as a catch-all after /storage/.
    /// </summary>
    [HttpGet("{**key}")]
    public async Task<IActionResult> GetImage(string key, CancellationToken ct = default)
    {
        if (string.IsNullOrWhiteSpace(key))
            return BadRequest(new { message = "Key is required." });

        var bytes = await _storage.ReadAsync(key, ct);
        if (bytes is null)
            return NotFound();

        var ext = Path.GetExtension(key).ToLowerInvariant();
        var contentType = ext switch
        {
            ".jpg" or ".jpeg" => "image/jpeg",
            ".png" => "image/png",
            ".webp" => "image/webp",
            ".gif" => "image/gif",
            ".svg" => "image/svg+xml",
            ".ico" => "image/x-icon",
            ".woff2" => "font/woff2",
            ".woff" => "font/woff",
            ".ttf" => "font/ttf",
            ".otf" => "font/otf",
            _ => "application/octet-stream",
        };

        return File(bytes, contentType);
    }
}
