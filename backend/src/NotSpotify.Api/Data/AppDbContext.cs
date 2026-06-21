using Microsoft.AspNetCore.Identity;
using Microsoft.AspNetCore.Identity.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore;
using NotSpotify.Api.Models;

namespace NotSpotify.Api.Data;

public class AppDbContext : IdentityDbContext<ApplicationUser, IdentityRole<Guid>, Guid>
{
    public AppDbContext(DbContextOptions<AppDbContext> options) : base(options) { }

    public DbSet<Artist> Artists => Set<Artist>();
    public DbSet<Album> Albums => Set<Album>();
    public DbSet<Track> Tracks => Set<Track>();
    public DbSet<Genre> Genres => Set<Genre>();
    public DbSet<TrackGenre> TrackGenres => Set<TrackGenre>();
    public DbSet<MoodTag> MoodTags => Set<MoodTag>();
    public DbSet<TrackMoodTag> TrackMoodTags => Set<TrackMoodTag>();
    public DbSet<PlaylistMoodTag> PlaylistMoodTags => Set<PlaylistMoodTag>();
    public DbSet<Playlist> Playlists => Set<Playlist>();
    public DbSet<PlaylistTrack> PlaylistTracks => Set<PlaylistTrack>();
    public DbSet<UserSavedPlaylist> UserSavedPlaylists => Set<UserSavedPlaylist>();
    public DbSet<PlayHistory> PlayHistories => Set<PlayHistory>();
    public DbSet<RecentSearch> RecentSearches => Set<RecentSearch>();
    public DbSet<TrackRating> TrackRatings => Set<TrackRating>();
    public DbSet<UserSavedTrack> UserSavedTracks => Set<UserSavedTrack>();
    public DbSet<UserSavedAlbum> UserSavedAlbums => Set<UserSavedAlbum>();
    public DbSet<ArtistApplication> ArtistApplications => Set<ArtistApplication>();
    public DbSet<RefreshToken> RefreshTokens => Set<RefreshToken>();
    public DbSet<StripeWebhookEvent> StripeWebhookEvents => Set<StripeWebhookEvent>();
    public DbSet<ReviewHistory> ReviewHistories => Set<ReviewHistory>();
    public DbSet<Friendship> Friendships => Set<Friendship>();
    public DbSet<UserFollow> UserFollows => Set<UserFollow>();
    public DbSet<ChatMessage> ChatMessages => Set<ChatMessage>();
    public DbSet<SiteVisit> SiteVisits => Set<SiteVisit>();
    public DbSet<ActivePlaybackSession> ActivePlaybackSessions => Set<ActivePlaybackSession>();
    public DbSet<Notification> Notifications => Set<Notification>();
    public DbSet<TrackComment> TrackComments => Set<TrackComment>();
    public DbSet<Repost> Reposts => Set<Repost>();
    public DbSet<Podcast> Podcasts => Set<Podcast>();
    public DbSet<Episode> Episodes => Set<Episode>();
    public DbSet<Advertisement> Advertisements => Set<Advertisement>();
    public DbSet<AdSettings> AdSettings => Set<AdSettings>();
    public DbSet<PendingAction> PendingActions => Set<PendingAction>();
    public DbSet<UserUpload> UserUploads => Set<UserUpload>();
    public DbSet<MusicVideo> MusicVideos => Set<MusicVideo>();
    public DbSet<TourDate> TourDates => Set<TourDate>();
    public DbSet<TourDateTrack> TourDateTracks => Set<TourDateTrack>();
    public DbSet<PlanMembership> PlanMemberships => Set<PlanMembership>();

    protected override void OnModelCreating(ModelBuilder b)
    {
        base.OnModelCreating(b);

        b.Entity<Artist>(e =>
        {
            e.HasIndex(x => x.Name);
        });

        b.Entity<Album>(e =>
        {
            e.HasOne(x => x.Artist)
                .WithMany(a => a.Albums)
                .HasForeignKey(x => x.ArtistId)
                .OnDelete(DeleteBehavior.Restrict);

            e.HasOne(x => x.SubmittedBy)
                .WithMany()
                .HasForeignKey(x => x.SubmittedByUserId)
                .OnDelete(DeleteBehavior.SetNull);

            e.HasIndex(x => x.Status);
            e.HasIndex(x => x.SubmittedByUserId);
        });

        b.Entity<Track>(e =>
        {
            e.HasOne(x => x.Artist)
                .WithMany(a => a.Tracks)
                .HasForeignKey(x => x.ArtistId)
                .OnDelete(DeleteBehavior.Restrict);

            e.HasOne(x => x.Album)
                .WithMany(a => a.Tracks)
                .HasForeignKey(x => x.AlbumId)
                .OnDelete(DeleteBehavior.Cascade);

            e.HasOne(x => x.SubmittedBy)
                .WithMany()
                .HasForeignKey(x => x.SubmittedByUserId)
                .OnDelete(DeleteBehavior.SetNull);

            e.HasIndex(x => x.Title);
            e.HasIndex(x => x.Status);
            e.Property(x => x.Waveform).HasColumnType("jsonb");
        });

        b.Entity<ArtistApplication>(e =>
        {
            e.HasOne(x => x.User)
                .WithMany()
                .HasForeignKey(x => x.UserId)
                .OnDelete(DeleteBehavior.Cascade);

            e.HasOne(x => x.ReviewedBy)
                .WithMany()
                .HasForeignKey(x => x.ReviewedByUserId)
                .OnDelete(DeleteBehavior.SetNull);

            e.HasIndex(x => x.Status);
            e.HasIndex(x => x.UserId);
        });

        b.Entity<Genre>(e =>
        {
            e.HasIndex(x => x.Slug).IsUnique();
        });

        b.Entity<TrackGenre>(e =>
        {
            e.HasKey(x => new { x.TrackId, x.GenreId });

            e.HasOne(x => x.Track)
                .WithMany(t => t.TrackGenres)
                .HasForeignKey(x => x.TrackId)
                .OnDelete(DeleteBehavior.Cascade);

            e.HasOne(x => x.Genre)
                .WithMany(g => g.TrackGenres)
                .HasForeignKey(x => x.GenreId)
                .OnDelete(DeleteBehavior.Cascade);
        });

        b.Entity<MoodTag>(e =>
        {
            e.HasIndex(x => x.Slug).IsUnique();
            e.HasIndex(x => new { x.Kind, x.SortOrder });
        });

        b.Entity<TrackMoodTag>(e =>
        {
            e.HasKey(x => new { x.TrackId, x.MoodTagId });

            e.HasOne(x => x.Track)
                .WithMany(t => t.TrackMoodTags)
                .HasForeignKey(x => x.TrackId)
                .OnDelete(DeleteBehavior.Cascade);

            e.HasOne(x => x.MoodTag)
                .WithMany(m => m.TrackMoodTags)
                .HasForeignKey(x => x.MoodTagId)
                .OnDelete(DeleteBehavior.Cascade);
        });

        b.Entity<PlaylistMoodTag>(e =>
        {
            e.HasKey(x => new { x.PlaylistId, x.MoodTagId });

            e.HasOne(x => x.Playlist)
                .WithMany(p => p.PlaylistMoodTags)
                .HasForeignKey(x => x.PlaylistId)
                .OnDelete(DeleteBehavior.Cascade);

            e.HasOne(x => x.MoodTag)
                .WithMany(m => m.PlaylistMoodTags)
                .HasForeignKey(x => x.MoodTagId)
                .OnDelete(DeleteBehavior.Cascade);
        });

        b.Entity<TourDateTrack>(e =>
        {
            e.HasKey(x => new { x.TourDateId, x.TrackId });

            e.HasOne(x => x.TourDate)
                .WithMany(t => t.Setlist)
                .HasForeignKey(x => x.TourDateId)
                .OnDelete(DeleteBehavior.Cascade);

            e.HasOne(x => x.Track)
                .WithMany()
                .HasForeignKey(x => x.TrackId)
                .OnDelete(DeleteBehavior.Cascade);
        });

        b.Entity<Playlist>(e =>
        {
            e.HasOne(x => x.Owner)
                .WithMany(u => u.Playlists)
                .HasForeignKey(x => x.OwnerId)
                .OnDelete(DeleteBehavior.Cascade);

            e.Property(x => x.IsFeatured).HasDefaultValue(false);
            e.Property(x => x.SortOrder).HasDefaultValue(0);
            e.Property(x => x.Rules).HasColumnType("jsonb");
            e.HasIndex(x => new { x.IsFeatured, x.SortOrder });
        });

        b.Entity<UserSavedPlaylist>(e =>
        {
            e.HasKey(x => new { x.UserId, x.PlaylistId });

            e.HasOne(x => x.User)
                .WithMany(u => u.SavedPlaylists)
                .HasForeignKey(x => x.UserId)
                .OnDelete(DeleteBehavior.Cascade);

            e.HasOne(x => x.Playlist)
                .WithMany()
                .HasForeignKey(x => x.PlaylistId)
                .OnDelete(DeleteBehavior.Cascade);

            e.HasIndex(x => new { x.UserId, x.SavedAt });
        });

        b.Entity<PlaylistTrack>(e =>
        {
            e.HasKey(x => new { x.PlaylistId, x.TrackId });

            e.HasOne(x => x.Playlist)
                .WithMany(p => p.PlaylistTracks)
                .HasForeignKey(x => x.PlaylistId)
                .OnDelete(DeleteBehavior.Cascade);

            e.HasOne(x => x.Track)
                .WithMany(t => t.PlaylistTracks)
                .HasForeignKey(x => x.TrackId)
                .OnDelete(DeleteBehavior.Restrict);

            e.HasOne(x => x.AddedByUser)
                .WithMany()
                .HasForeignKey(x => x.AddedByUserId)
                .OnDelete(DeleteBehavior.Restrict);
        });

        b.Entity<RefreshToken>(e =>
        {
            e.HasIndex(x => x.TokenHash).IsUnique();

            e.HasOne(x => x.User)
                .WithMany(u => u.RefreshTokens)
                .HasForeignKey(x => x.UserId)
                .OnDelete(DeleteBehavior.Cascade);
        });

        b.Entity<RecentSearch>(e =>
        {
            e.HasOne(x => x.User)
                .WithMany(u => u.RecentSearches)
                .HasForeignKey(x => x.UserId)
                .OnDelete(DeleteBehavior.Cascade);

            e.HasIndex(x => new { x.UserId, x.SearchedAt });
        });

        b.Entity<ApplicationUser>(e =>
        {
            e.HasIndex(x => x.StripeCustomerId);
            e.HasIndex(x => x.StripeSubscriptionId);
        });

        b.Entity<StripeWebhookEvent>(e =>
        {
            e.HasKey(x => x.Id);
        });

        b.Entity<TrackRating>(e =>
        {
            e.HasKey(x => new { x.UserId, x.TrackId });

            e.HasOne(x => x.User)
                .WithMany()
                .HasForeignKey(x => x.UserId)
                .OnDelete(DeleteBehavior.Cascade);

            e.HasOne(x => x.Track)
                .WithMany(t => t.Ratings)
                .HasForeignKey(x => x.TrackId)
                .OnDelete(DeleteBehavior.Cascade);

            e.Property(x => x.Rating).IsRequired();
        });

        b.Entity<UserSavedTrack>(e =>
        {
            e.HasKey(x => new { x.UserId, x.TrackId });

            e.HasOne(x => x.User)
                .WithMany()
                .HasForeignKey(x => x.UserId)
                .OnDelete(DeleteBehavior.Cascade);

            e.HasOne(x => x.Track)
                .WithMany()
                .HasForeignKey(x => x.TrackId)
                .OnDelete(DeleteBehavior.Cascade);

            e.HasIndex(x => new { x.UserId, x.SavedAt });
        });

        b.Entity<UserSavedAlbum>(e =>
        {
            e.HasKey(x => new { x.UserId, x.AlbumId });

            e.HasOne(x => x.User)
                .WithMany()
                .HasForeignKey(x => x.UserId)
                .OnDelete(DeleteBehavior.Cascade);

            e.HasOne(x => x.Album)
                .WithMany()
                .HasForeignKey(x => x.AlbumId)
                .OnDelete(DeleteBehavior.Cascade);

            e.HasIndex(x => new { x.UserId, x.SavedAt });
        });

        b.Entity<PlayHistory>(e =>
        {
            e.HasOne(x => x.User)
                .WithMany()
                .HasForeignKey(x => x.UserId)
                .OnDelete(DeleteBehavior.Cascade);

            e.HasOne(x => x.Track)
                .WithMany()
                .HasForeignKey(x => x.TrackId)
                .OnDelete(DeleteBehavior.Cascade);

            // Most queries are "give me this user's recents, newest first" — index supports that.
            e.HasIndex(x => new { x.UserId, x.PlayedAt });
        });

        b.Entity<Friendship>(e =>
        {
            // Prevent duplicate friend requests in either direction at the DB level.
            e.HasIndex(x => new { x.RequesterId, x.AddresseeId }).IsUnique();

            e.HasOne(x => x.Requester)
                .WithMany(u => u.SentFriendRequests)
                .HasForeignKey(x => x.RequesterId)
                .OnDelete(DeleteBehavior.Cascade);

            e.HasOne(x => x.Addressee)
                .WithMany(u => u.ReceivedFriendRequests)
                .HasForeignKey(x => x.AddresseeId)
                .OnDelete(DeleteBehavior.Cascade);

            // Fast lookup: "all friendships involving user X" (both as requester and addressee).
            e.HasIndex(x => new { x.AddresseeId, x.Status });
            e.HasIndex(x => new { x.RequesterId, x.Status });
        });

        b.Entity<UserFollow>(e =>
        {
            // One follow edge per ordered pair — no duplicate follows.
            e.HasIndex(x => new { x.FollowerId, x.FolloweeId }).IsUnique();

            e.HasOne(x => x.Follower)
                .WithMany()
                .HasForeignKey(x => x.FollowerId)
                .OnDelete(DeleteBehavior.Cascade);

            e.HasOne(x => x.Followee)
                .WithMany()
                .HasForeignKey(x => x.FolloweeId)
                .OnDelete(DeleteBehavior.Cascade);

            // "Who follows X" (follower count/list) and "who X follows" (following list).
            e.HasIndex(x => x.FolloweeId);
            e.HasIndex(x => x.FollowerId);
        });

        b.Entity<ChatMessage>(e =>
        {
            e.HasOne(x => x.Sender)
                .WithMany()
                .HasForeignKey(x => x.SenderId)
                .OnDelete(DeleteBehavior.Cascade);

            e.HasOne(x => x.Recipient)
                .WithMany()
                .HasForeignKey(x => x.RecipientId)
                .OnDelete(DeleteBehavior.Cascade);

            e.Property(x => x.Body).HasMaxLength(4000);

            // Thread query: "messages between A and B, newest first".
            e.HasIndex(x => new { x.SenderId, x.RecipientId, x.SentAt });
            // Unread badge query: "messages to me that are unread".
            e.HasIndex(x => new { x.RecipientId, x.ReadAt });
        });

        b.Entity<SiteVisit>(e =>
        {
            e.Property(x => x.Path).HasMaxLength(512);
            e.Property(x => x.Method).HasMaxLength(16);
            e.Property(x => x.UserAgent).HasMaxLength(512);

            e.HasOne(x => x.User)
                .WithMany()
                .HasForeignKey(x => x.UserId)
                .OnDelete(DeleteBehavior.SetNull);

            e.HasIndex(x => x.VisitedAt);
            e.HasIndex(x => new { x.UserId, x.VisitedAt });
        });

        b.Entity<ActivePlaybackSession>(e =>
        {
            e.HasOne(x => x.User)
                .WithMany()
                .HasForeignKey(x => x.UserId)
                .OnDelete(DeleteBehavior.Cascade);

            e.HasOne(x => x.Track)
                .WithMany()
                .HasForeignKey(x => x.TrackId)
                .OnDelete(DeleteBehavior.Cascade);

            e.HasIndex(x => x.UserId).IsUnique();
            e.HasIndex(x => new { x.LastSeenAt, x.TrackId });
        });

        b.Entity<Notification>(e =>
        {
            e.HasOne(x => x.User)
                .WithMany()
                .HasForeignKey(x => x.UserId)
                .OnDelete(DeleteBehavior.Cascade);

            e.Property(x => x.Type).HasMaxLength(40);
            e.Property(x => x.Title).HasMaxLength(200);
            e.Property(x => x.Body).HasMaxLength(500);

            // Bell query: "my notifications, newest first" + unread filter.
            e.HasIndex(x => new { x.UserId, x.CreatedAt });
            e.HasIndex(x => new { x.UserId, x.IsRead });
        });

        b.Entity<TrackComment>(e =>
        {
            e.HasOne(x => x.Track)
                .WithMany()
                .HasForeignKey(x => x.TrackId)
                .OnDelete(DeleteBehavior.Cascade);

            e.HasOne(x => x.User)
                .WithMany()
                .HasForeignKey(x => x.UserId)
                .OnDelete(DeleteBehavior.Cascade);

            e.HasOne(x => x.Parent)
                .WithMany()
                .HasForeignKey(x => x.ParentId)
                .OnDelete(DeleteBehavior.SetNull);

            e.Property(x => x.Body).HasMaxLength(1000).IsRequired();

            // "Comments for track X, newest first" — the primary read query.
            e.HasIndex(x => new { x.TrackId, x.CreatedAt });
        });

        b.Entity<Repost>(e =>
        {
            // One repost per user per track/album/playlist — no duplicates.
            e.HasIndex(x => new { x.UserId, x.TrackId }).IsUnique().HasFilter("\"TrackId\" IS NOT NULL");
            e.HasIndex(x => new { x.UserId, x.AlbumId }).IsUnique().HasFilter("\"AlbumId\" IS NOT NULL");
            e.HasIndex(x => new { x.UserId, x.PlaylistId }).IsUnique().HasFilter("\"PlaylistId\" IS NOT NULL");

            e.HasOne(x => x.User)
                .WithMany()
                .HasForeignKey(x => x.UserId)
                .OnDelete(DeleteBehavior.Cascade);

            e.HasOne(x => x.Track)
                .WithMany()
                .HasForeignKey(x => x.TrackId)
                .OnDelete(DeleteBehavior.Cascade);

            e.HasOne(x => x.Album)
                .WithMany()
                .HasForeignKey(x => x.AlbumId)
                .OnDelete(DeleteBehavior.Cascade);

            e.HasOne(x => x.Playlist)
                .WithMany()
                .HasForeignKey(x => x.PlaylistId)
                .OnDelete(DeleteBehavior.Cascade);

            // Feed query: "reposts by users I follow, newest first".
            e.HasIndex(x => new { x.UserId, x.CreatedAt });
        });

        b.Entity<Podcast>(e =>
        {
            e.Property(x => x.Title).IsRequired();
            e.HasIndex(x => x.Title);
            e.HasIndex(x => x.CreatedAt);
        });

        b.Entity<Episode>(e =>
        {
            e.HasOne(x => x.Podcast)
                .WithMany(p => p.Episodes)
                .HasForeignKey(x => x.PodcastId)
                .OnDelete(DeleteBehavior.Cascade);

            // "Episodes for podcast X, newest first" — the primary read query.
            e.HasIndex(x => new { x.PodcastId, x.PublishedAt });
        });

        b.Entity<Advertisement>(e =>
        {
            e.Property(x => x.Title).IsRequired();
            // "Active ads in flight" — the next-ad pick filters on these.
            e.HasIndex(x => new { x.IsActive, x.Country });
        });

        b.Entity<AdSettings>(e =>
        {
            e.Property(x => x.AdsPerNTracks).HasDefaultValue(3);
        });

        b.Entity<PendingAction>(e =>
        {
            // "Open approvals, newest first" + "this user's requests".
            e.HasIndex(x => new { x.Status, x.RequestedAt });
            e.HasIndex(x => x.RequestedByUserId);
        });

        b.Entity<UserUpload>(e =>
        {
            e.HasOne(x => x.User)
                .WithMany()
                .HasForeignKey(x => x.UserId)
                .OnDelete(DeleteBehavior.Cascade);

            // "My uploads, newest first."
            e.HasIndex(x => new { x.UserId, x.CreatedAt });
        });

        b.Entity<MusicVideo>(e =>
        {
            e.HasOne(x => x.Artist)
                .WithMany()
                .HasForeignKey(x => x.ArtistId)
                .OnDelete(DeleteBehavior.Cascade);

            e.HasOne(x => x.Track)
                .WithMany()
                .HasForeignKey(x => x.TrackId)
                .OnDelete(DeleteBehavior.SetNull);

            e.HasIndex(x => x.CreatedAt);
        });

        b.Entity<PlanMembership>(e =>
        {
            // Two FKs to the user (owner + member) — mirror Friendship's setup.
            // Owner cascade-deletes seats; member set-null (the seat row outlives
            // a deleted member account and is cleaned up by the owner).
            e.HasOne(x => x.Owner)
                .WithMany()
                .HasForeignKey(x => x.OwnerId)
                .OnDelete(DeleteBehavior.Cascade);

            e.HasOne(x => x.Member)
                .WithMany()
                .HasForeignKey(x => x.MemberId)
                .OnDelete(DeleteBehavior.SetNull);

            e.Property(x => x.InvitedEmail).HasMaxLength(256);
            e.Property(x => x.Status).HasMaxLength(16);

            // "Seats on my plan" and "invites/seat for this user/email".
            e.HasIndex(x => x.OwnerId);
            e.HasIndex(x => x.MemberId);
            e.HasIndex(x => x.InvitedEmail);
        });
    }
}
