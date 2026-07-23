using Microsoft.Extensions.Options;

namespace NotSpotify.Api.Services;

public class LocalStorageService : IStorageService
{
    private readonly LocalStorageOptions _opt;
    private readonly IWebHostEnvironment _env;

    public LocalStorageService(IOptions<LocalStorageOptions> opt, IWebHostEnvironment env)
    {
        _opt = opt.Value;
        _env = env;
    }

    public Task<string> GetAudioUrlAsync(string key, CancellationToken ct = default)
        => Task.FromResult(BuildUrl(key));

    public string GetPublicUrl(string key) => BuildUrl(key);

    public async Task UploadAsync(string key, Stream content, string contentType, CancellationToken ct = default)
    {
        var path = ResolvePath(key);
        var dir = Path.GetDirectoryName(path);
        if (!string.IsNullOrEmpty(dir)) Directory.CreateDirectory(dir);

        await using var file = File.Create(path);
        await content.CopyToAsync(file, ct);
    }

    public Task DeleteAsync(string key, CancellationToken ct = default)
    {
        var path = ResolvePath(key);
        if (File.Exists(path)) File.Delete(path);
        return Task.CompletedTask;
    }

    public async Task<byte[]?> ReadAsync(string key, CancellationToken ct = default)
    {
        var path = ResolvePath(key);
        if (!File.Exists(path)) return null;
        return await File.ReadAllBytesAsync(path, ct);
    }

    public Task<long?> GetSizeAsync(string key, CancellationToken ct = default)
    {
        var info = new FileInfo(ResolvePath(key));
        return Task.FromResult(info.Exists ? info.Length : (long?)null);
    }

    private string BuildUrl(string key)
    {
        var normalized = key.Replace('\\', '/').TrimStart('/');
        var prefix = _opt.PublicUrlPrefix.TrimEnd('/');
        return $"{_opt.PublicBaseUrl.TrimEnd('/')}{prefix}/{normalized}";
    }

    private string ResolvePath(string key)
    {
        var normalized = key.Replace('/', Path.DirectorySeparatorChar).TrimStart(Path.DirectorySeparatorChar);
        var root = Path.IsPathRooted(_opt.RootPath)
            ? _opt.RootPath
            : Path.Combine(_env.ContentRootPath, _opt.RootPath);
        return Path.Combine(root, normalized);
    }
}
