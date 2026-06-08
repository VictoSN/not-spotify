using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace NotSpotify.Api.Migrations
{
    /// <inheritdoc />
    public partial class AddStorageKeys : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<string>(
                name: "AudioKey",
                table: "Tracks",
                type: "text",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "CoverKey",
                table: "Playlists",
                type: "text",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "AvatarKey",
                table: "AspNetUsers",
                type: "text",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "HeaderImageKey",
                table: "Artists",
                type: "text",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "ImageKey",
                table: "Artists",
                type: "text",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "CoverKey",
                table: "Albums",
                type: "text",
                nullable: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "AudioKey",
                table: "Tracks");

            migrationBuilder.DropColumn(
                name: "CoverKey",
                table: "Playlists");

            migrationBuilder.DropColumn(
                name: "AvatarKey",
                table: "AspNetUsers");

            migrationBuilder.DropColumn(
                name: "HeaderImageKey",
                table: "Artists");

            migrationBuilder.DropColumn(
                name: "ImageKey",
                table: "Artists");

            migrationBuilder.DropColumn(
                name: "CoverKey",
                table: "Albums");
        }
    }
}
