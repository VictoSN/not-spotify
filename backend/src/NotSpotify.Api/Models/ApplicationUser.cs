using Microsoft.AspNetCore.Identity;

namespace NotSpotify.Api.Models;

public class ApplicationUser : IdentityUser<Guid>
{
    public string Name { get; set; } = string.Empty;
    public string? AvatarUrl { get; set; }
    public string? AvatarKey { get; set; }
    public string Plan { get; set; } = "free";
    // The premium tier this user pays for: individual | duo | family | student.
    // Only meaningful when they own a subscription (Plan == "premium" and
    // PlanOwnerId is null). Drives how many member seats they can share.
    public string PlanTier { get; set; } = "individual";
    // When set, this user's premium is a shared seat on another user's
    // duo/family plan (a PlanMembership). Their own subscription is null.
    public Guid? PlanOwnerId { get; set; }
    public string Country { get; set; } = "US";
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    public string? StripeCustomerId { get; set; }
    public string? StripeSubscriptionId { get; set; }
    public string? StripeSubscriptionStatus { get; set; }
    public string? StripeBillingInterval { get; set; }
    public DateTime? StripeCurrentPeriodEnd { get; set; }
    public bool StripeCancelAtPeriodEnd { get; set; }

    // Set when the user is approved as an artist; null for regular users.
    public Guid? ArtistId { get; set; }

    // Updated on heartbeat / track play — used to derive online status.
    public DateTime? LastSeenAt { get; set; }

    // Local-password registrations stay inactive until this short-lived code is
    // verified. OAuth accounts are confirmed by their identity provider.
    public string? EmailConfirmationOtpHash { get; set; }
    public DateTime? EmailConfirmationOtpExpiresAt { get; set; }
    public DateTime? EmailConfirmationOtpSentAt { get; set; }
    public int EmailConfirmationOtpAttempts { get; set; }

    public ICollection<Playlist> Playlists { get; set; } = new List<Playlist>();
    public ICollection<Friendship> SentFriendRequests { get; set; } = new List<Friendship>();
    public ICollection<Friendship> ReceivedFriendRequests { get; set; } = new List<Friendship>();
    public ICollection<UserSavedPlaylist> SavedPlaylists { get; set; } = new List<UserSavedPlaylist>();
    public ICollection<RefreshToken> RefreshTokens { get; set; } = new List<RefreshToken>();
    public ICollection<RecentSearch> RecentSearches { get; set; } = new List<RecentSearch>();
}
