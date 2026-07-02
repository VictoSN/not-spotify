using Microsoft.EntityFrameworkCore.Infrastructure;
using Microsoft.EntityFrameworkCore.Migrations;
using NotSpotify.Api.Data;

#nullable disable

namespace NotSpotify.Api.Migrations
{
    /// <summary>
    /// Adds the play-context columns to PlayHistories so recents can group plays
    /// by the playlist/album/artist/mix they started from. Hand-authored and
    /// deliberately scoped to just these columns — the auto-scaffolded migration
    /// would have bundled unrelated snapshot drift (see AddSearchText).
    /// </summary>
    [DbContext(typeof(AppDbContext))]
    [Migration("20260702050000_AddPlayContext")]
    public partial class AddPlayContext : Migration
    {
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<string>(
                name: "ContextType",
                table: "PlayHistories",
                type: "text",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "ContextId",
                table: "PlayHistories",
                type: "text",
                nullable: true);
        }

        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(name: "ContextType", table: "PlayHistories");
            migrationBuilder.DropColumn(name: "ContextId", table: "PlayHistories");
        }
    }
}
