namespace NotSpotify.Api.Services;

/// <summary>
/// Periodically wakes up and asks <see cref="TourSyncService"/> to refresh any
/// artist whose cached Ticketmaster dates are past the TTL. The sweep itself is
/// cheap (a DB query) and the per-artist TTL does the real throttling, so a short
/// sweep interval just makes newly-due artists picked up promptly without extra API
/// calls. No-op when Ticketmaster isn't configured.
///
/// Note: in a multi-instance deployment every instance would run this timer; for a
/// single-instance deploy that's fine. A DB advisory lock (or moving the trigger to
/// an external cron hitting the admin endpoint) would make it safe to scale out.
/// </summary>
public class TourSyncBackgroundService : BackgroundService
{
    private static readonly TimeSpan SweepInterval = TimeSpan.FromHours(1);
    private static readonly TimeSpan StartupDelay = TimeSpan.FromSeconds(20);

    private readonly IServiceScopeFactory _scopeFactory;
    private readonly ILogger<TourSyncBackgroundService> _logger;

    public TourSyncBackgroundService(IServiceScopeFactory scopeFactory, ILogger<TourSyncBackgroundService> logger)
    {
        _scopeFactory = scopeFactory;
        _logger = logger;
    }

    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        // Let the app finish starting (migrations, warmup) before the first sweep.
        try { await Task.Delay(StartupDelay, stoppingToken); }
        catch (OperationCanceledException) { return; }

        using var timer = new PeriodicTimer(SweepInterval);
        do
        {
            await SweepAsync(stoppingToken);
        }
        while (await timer.WaitForNextTickAsync(stoppingToken));
    }

    private async Task SweepAsync(CancellationToken ct)
    {
        try
        {
            // BackgroundService is a singleton; TourSyncService/AppDbContext are scoped.
            using var scope = _scopeFactory.CreateScope();
            var sync = scope.ServiceProvider.GetRequiredService<TourSyncService>();
            await sync.SyncAllAsync(force: false, ct);
        }
        catch (OperationCanceledException) when (ct.IsCancellationRequested)
        {
            // Shutting down — expected.
        }
        catch (Exception ex)
        {
            // Never let a bad sweep kill the loop; try again next tick.
            _logger.LogError(ex, "Tour sync sweep failed.");
        }
    }
}
