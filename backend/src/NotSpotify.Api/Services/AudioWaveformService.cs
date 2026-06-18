using System.ComponentModel;
using System.Diagnostics;
using System.Text.Json;

namespace NotSpotify.Api.Services;

public class AudioWaveformService
{
    private const int PeakCount = 180;
    private readonly IStorageService _storage;
    private readonly ILogger<AudioWaveformService> _logger;

    public AudioWaveformService(IStorageService storage, ILogger<AudioWaveformService> logger)
    {
        _storage = storage;
        _logger = logger;
    }

    public async Task<string?> UploadAndExtractAsync(
        IFormFile file,
        string key,
        string contentType,
        CancellationToken ct = default)
    {
        var tempPath = Path.Combine(Path.GetTempPath(), $"notspotify-{Guid.NewGuid()}{Path.GetExtension(file.FileName)}");
        try
        {
            await using (var temp = new FileStream(tempPath, FileMode.CreateNew, FileAccess.Write, FileShare.None, 81920, true))
            await using (var input = file.OpenReadStream())
                await input.CopyToAsync(temp, ct);

            var waveform = await ExtractAsync(tempPath, ct);
            await using var upload = new FileStream(tempPath, FileMode.Open, FileAccess.Read, FileShare.Read, 81920, true);
            await _storage.UploadAsync(key, upload, contentType, ct);
            return waveform is null ? null : JsonSerializer.Serialize(waveform);
        }
        finally
        {
            try { if (File.Exists(tempPath)) File.Delete(tempPath); }
            catch (IOException ex) { _logger.LogWarning(ex, "Could not remove waveform temp file {Path}", tempPath); }
        }
    }

    public async Task<double[]?> ExtractAsync(string audioPath, CancellationToken ct = default)
    {
        try
        {
            using var process = new Process
            {
                StartInfo = new ProcessStartInfo
                {
                    FileName = "ffmpeg",
                    Arguments = $"-v error -i \"{audioPath}\" -ac 1 -ar 8000 -f s16le pipe:1",
                    RedirectStandardOutput = true,
                    RedirectStandardError = true,
                    UseShellExecute = false,
                    CreateNoWindow = true,
                },
            };
            process.Start();
            await using var pcm = new MemoryStream();
            var copyTask = process.StandardOutput.BaseStream.CopyToAsync(pcm, ct);
            var errorTask = process.StandardError.ReadToEndAsync(ct);
            await Task.WhenAll(copyTask, process.WaitForExitAsync(ct));
            var error = await errorTask;
            if (process.ExitCode != 0)
            {
                _logger.LogWarning("ffmpeg waveform extraction failed: {Error}", error);
                return null;
            }
            return BuildPeaks(pcm.ToArray(), PeakCount);
        }
        catch (Win32Exception)
        {
            _logger.LogWarning("ffmpeg was not found; audio uploaded without waveform peaks.");
            return null;
        }
        catch (Exception ex) when (ex is not OperationCanceledException)
        {
            _logger.LogWarning(ex, "Waveform extraction failed for {AudioPath}", audioPath);
            return null;
        }
    }

    public static double[] BuildPeaks(ReadOnlySpan<byte> pcm16Le, int peakCount)
    {
        if (peakCount <= 0 || pcm16Le.Length < 2) return [];
        var sampleCount = pcm16Le.Length / 2;
        var bucketSize = Math.Max(1, (int)Math.Ceiling(sampleCount / (double)peakCount));
        var peaks = new double[Math.Min(peakCount, sampleCount)];
        var max = 0d;
        for (var bucket = 0; bucket < peaks.Length; bucket++)
        {
            var start = bucket * bucketSize;
            var end = Math.Min(sampleCount, start + bucketSize);
            var peak = 0d;
            for (var sample = start; sample < end; sample++)
            {
                var offset = sample * 2;
                var value = (short)(pcm16Le[offset] | pcm16Le[offset + 1] << 8);
                peak = Math.Max(peak, Math.Abs(value / 32768d));
            }
            peaks[bucket] = peak;
            max = Math.Max(max, peak);
        }
        if (max <= 0) return peaks;
        for (var i = 0; i < peaks.Length; i++)
            peaks[i] = Math.Round(peaks[i] / max, 4);
        return peaks;
    }
}
