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
    public DbSet<ChatMessage> ChatMessages => Set<ChatMessage>();
    public DbSet<SiteVisit> SiteVisits => Set<SiteVisit>();
    public DbSet<ActivePlaybackSession> ActivePlaybackSessions => Set<ActivePlaybackSession>();
    public DbSet<Notification> Notifications => Set<Notification>();

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

        b.Entity<Playlist>(e =>
        {
            e.HasOne(x => x.Owner)
                .WithMany(u => u.Playlists)
                .HasForeignKey(x => x.OwnerId)
                .OnDelete(DeleteBehavior.Cascade);
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
    }
}
