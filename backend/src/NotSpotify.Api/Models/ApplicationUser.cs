using Microsoft.AspNetCore.Identity;

namespace NotSpotify.Api.Models;

public class ApplicationUser : IdentityUser<Guid>
{
    public string Name { get; set; } = string.Empty;
    public string? AvatarUrl { get; set; }
    public string? AvatarKey { get; set; }
    public string Plan { get; set; } = "free";
    public string Country { get; set; } = "US";
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    public string? StripeCustomerId { get; set; }
    public string? StripeSubscriptionId { get; set; }
    public string? StripeSubscriptionStatus { get; set; }
    public string? StripeBillingInterval { get; set; }
    public DateTime? StripeCurrentPeriodEnd { get; set; }
    public bool StripeCancelAtPeriodEnd { get; set; }

    public ICollection<Playlist> Playlists { get; set; } = new List<Playlist>();
    public ICollection<UserSavedPlaylist> SavedPlaylists { get; set; } = new List<UserSavedPlaylist>();
    public ICollection<RefreshToken> RefreshTokens { get; set; } = new List<RefreshToken>();
    public ICollection<RecentSearch> RecentSearches { get; set; } = new List<RecentSearch>();
}
