using Microsoft.AspNetCore.Mvc;
using NotSpotify.Api.Services;

namespace NotSpotify.Api.Controllers;

[ApiController]
[Route("downloads")]
public class DownloadsController : ControllerBase
{
    private static readonly IReadOnlyDictionary<string, string> AllowedInstallers =
        new Dictionary<string, string>(StringComparer.OrdinalIgnoreCase)
        {
            ["not-spotify-windows-x64-setup.exe"] = "application/vnd.microsoft.portable-executable",
            ["not-spotify-windows-x64.msi"] = "application/x-msi",
        };

    private readonly IStorageService _storage;

    public DownloadsController(IStorageService storage)
    {
        _storage = storage;
    }

    [HttpGet("{fileName}")]
    public async Task<IActionResult> GetInstaller(string fileName, CancellationToken ct = default)
    {
        if (!AllowedInstallers.TryGetValue(fileName, out var contentType))
            return NotFound();

        Response.Headers.CacheControl = "public,max-age=86400";
        Response.Headers.ContentDisposition = $"attachment; filename=\"{fileName}\"";
        Response.Headers.XContentTypeOptions = "nosniff";

        var bytes = await _storage.ReadAsync($"downloads/{fileName}", ct);
        if (bytes is not null)
            return File(bytes, contentType, fileName, enableRangeProcessing: true);

        return NotFound();
    }
}
