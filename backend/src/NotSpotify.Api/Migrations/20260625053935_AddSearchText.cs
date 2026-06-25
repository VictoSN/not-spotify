using Microsoft.EntityFrameworkCore.Infrastructure;
using Microsoft.EntityFrameworkCore.Migrations;
using NotSpotify.Api.Data;

#nullable disable

namespace NotSpotify.Api.Migrations
{
    /// <summary>
    /// Adds the match-only <c>SearchText</c> column (+ index) to Tracks, Artists and
    /// Albums for romanization-aware CJK search. Hand-authored and deliberately
    /// scoped to just these columns — this project applies several other schema
    /// objects via raw-SQL guards in Program.cs, so the auto-scaffolded migration
    /// would have bundled unrelated drift.
    /// </summary>
    [DbContext(typeof(AppDbContext))]
    [Migration("20260625053935_AddSearchText")]
    public partial class AddSearchText : Migration
    {
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<string>(
                name: "SearchText",
                table: "Tracks",
                type: "text",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "SearchText",
                table: "Artists",
                type: "text",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "SearchText",
                table: "Albums",
                type: "text",
                nullable: true);

            migrationBuilder.CreateIndex(
                name: "IX_Tracks_SearchText",
                table: "Tracks",
                column: "SearchText");

            migrationBuilder.CreateIndex(
                name: "IX_Artists_SearchText",
                table: "Artists",
                column: "SearchText");

            migrationBuilder.CreateIndex(
                name: "IX_Albums_SearchText",
                table: "Albums",
                column: "SearchText");
        }

        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropIndex(name: "IX_Tracks_SearchText", table: "Tracks");
            migrationBuilder.DropIndex(name: "IX_Artists_SearchText", table: "Artists");
            migrationBuilder.DropIndex(name: "IX_Albums_SearchText", table: "Albums");

            migrationBuilder.DropColumn(name: "SearchText", table: "Tracks");
            migrationBuilder.DropColumn(name: "SearchText", table: "Artists");
            migrationBuilder.DropColumn(name: "SearchText", table: "Albums");
        }
    }
}
