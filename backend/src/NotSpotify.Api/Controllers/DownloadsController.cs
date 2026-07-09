using Microsoft.AspNetCore.Mvc;
using NotSpotify.Api.Services;
using System.Text.RegularExpressions;

namespace NotSpotify.Api.Controllers;

[ApiController]
[Route("downloads")]
public class DownloadsController : ControllerBase
{
    private const string StableSetupFileName = "not-spotify-windows-x64-setup.exe";
    private const string StableMsiFileName = "not-spotify-windows-x64.msi";
    private const string SetupContentType = "application/vnd.microsoft.portable-executable";
    private const string MsiContentType = "application/x-msi";

    private static readonly Regex VersionedSetupFileName = new(
        @"^not-spotify_\d+\.\d+\.\d+_x64-setup\.exe$",
        RegexOptions.IgnoreCase | RegexOptions.Compiled);

    private static readonly Regex VersionedMsiFileName = new(
        @"^not-spotify_\d+\.\d+\.\d+_x64_en-US\.msi$",
        RegexOptions.IgnoreCase | RegexOptions.Compiled);

    private readonly IStorageService _storage;

    public DownloadsController(IStorageService storage)
    {
        _storage = storage;
    }

    [HttpGet("{fileName}")]
    public async Task<IActionResult> GetInstaller(string fileName, CancellationToken ct = default)
    {
        var installer = ResolveInstaller(fileName);
        if (installer is null)
            return NotFound();

        Response.Headers.CacheControl = "public,max-age=86400";
        Response.Headers.ContentDisposition = $"attachment; filename=\"{fileName}\"";
        Response.Headers.XContentTypeOptions = "nosniff";

        var bytes = await _storage.ReadAsync($"downloads/{installer.StorageFileName}", ct);
        if (bytes is not null)
            return File(bytes, installer.ContentType, fileName, enableRangeProcessing: true);

        return NotFound();
    }

    private static InstallerFile? ResolveInstaller(string fileName)
    {
        if (string.Equals(fileName, StableSetupFileName, StringComparison.OrdinalIgnoreCase) ||
            VersionedSetupFileName.IsMatch(fileName))
            return new InstallerFile(StableSetupFileName, SetupContentType);

        if (string.Equals(fileName, StableMsiFileName, StringComparison.OrdinalIgnoreCase) ||
            VersionedMsiFileName.IsMatch(fileName))
            return new InstallerFile(StableMsiFileName, MsiContentType);

        return null;
    }

    private sealed record InstallerFile(string StorageFileName, string ContentType);
}
