using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace NotSpotify.Api.Migrations
{
    /// <inheritdoc />
    public partial class AddPlaylistVisibility : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<string>(
                name: "Visibility",
                table: "Playlists",
                type: "text",
                nullable: false,
                defaultValue: "public");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "Visibility",
                table: "Playlists");
        }
    }
}
