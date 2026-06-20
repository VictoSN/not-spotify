using NotSpotify.Api.Services;
using Xunit;

namespace NotSpotify.Api.Tests;

public class AudioWaveformServiceTests
{
    [Fact]
    public void BuildPeaks_NormalizesPcmIntoRequestedBuckets()
    {
        short[] samples = [0, 1000, -2000, 4000, -8000, 16000, -32000, 8000];
        var bytes = new byte[samples.Length * 2];
        Buffer.BlockCopy(samples, 0, bytes, 0, bytes.Length);

        var peaks = AudioWaveformService.BuildPeaks(bytes, 4);

        Assert.Equal(4, peaks.Length);
        // 0.03125 rounds to 0.0312 under .NET's banker's rounding (round-half-to-even).
        Assert.Equal(0.0312, peaks[0], 4);
        Assert.Equal(0.125, peaks[1], 4);
        Assert.Equal(0.5, peaks[2], 4);
        Assert.Equal(1, peaks[3], 4);
    }

    [Fact]
    public void BuildPeaks_HandlesSilenceAndEmptyInput()
    {
        Assert.Empty(AudioWaveformService.BuildPeaks([], 10));
        Assert.Equal(new[] { 0d, 0d }, AudioWaveformService.BuildPeaks(new byte[4], 2));
    }
}
