using Microsoft.EntityFrameworkCore.Migrations;
using Microsoft.EntityFrameworkCore.Infrastructure;
using NotSpotify.Api.Data;

#nullable disable

namespace NotSpotify.Api.Migrations
{
    /// <inheritdoc />
    [DbContext(typeof(AppDbContext))]
    [Migration("20260608000000_AddReviewNotes")]
    public partial class AddReviewNotes : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            // Tracks.ReviewNote was already added in AddArtistSystem migration.
            // Only Albums needs the new column.
            migrationBuilder.AddColumn<string>(
                name: "ReviewNote",
                table: "Albums",
                type: "text",
                nullable: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "ReviewNote",
                table: "Albums");
        }
    }
}
