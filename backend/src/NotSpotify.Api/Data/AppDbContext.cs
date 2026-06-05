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
    public DbSet<RefreshToken> RefreshTokens => Set<RefreshToken>();
    public DbSet<StripeWebhookEvent> StripeWebhookEvents => Set<StripeWebhookEvent>();

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

            e.HasIndex(x => x.Title);
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
    }
}
