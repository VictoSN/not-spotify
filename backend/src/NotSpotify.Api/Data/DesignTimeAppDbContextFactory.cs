using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Design;
using NotSpotify.Api.Services;

namespace NotSpotify.Api.Data;

public class DesignTimeAppDbContextFactory : IDesignTimeDbContextFactory<AppDbContext>
{
    public AppDbContext CreateDbContext(string[] args)
    {
        var options = new DbContextOptionsBuilder<AppDbContext>()
            .UseNpgsql("Host=localhost;Database=notspotify_design_time;Username=postgres;Password=postgres")
            .Options;

        // Design-time tooling only builds model metadata; this deterministic key
        // is never used by the running application or persisted data.
        var designTimeKey = Convert.ToBase64String(new byte[32]);
        return new AppDbContext(options, new ChatMessageEncryption(designTimeKey));
    }
}
