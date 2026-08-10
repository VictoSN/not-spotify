using System;
using Microsoft.EntityFrameworkCore.Infrastructure;
using Microsoft.EntityFrameworkCore.Migrations;
using NotSpotify.Api.Data;

#nullable disable

namespace NotSpotify.Api.Migrations
{
    /// <inheritdoc />
    [DbContext(typeof(AppDbContext))]
    [Migration("20260607200000_AddAlbumStatus")]
    public partial class AddAlbumStatus : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<string>(
                name: "Status",
                table: "Albums",
                type: "text",
                nullable: false,
                defaultValue: "approved");

            migrationBuilder.AddColumn<Guid>(
                name: "SubmittedByUserId",
                table: "Albums",
                type: "uuid",
                nullable: true);

            migrationBuilder.CreateIndex(
                name: "IX_Albums_Status",
                table: "Albums",
                column: "Status");

            migrationBuilder.CreateIndex(
                name: "IX_Albums_SubmittedByUserId",
                table: "Albums",
                column: "SubmittedByUserId");

            migrationBuilder.AddForeignKey(
                name: "FK_Albums_AspNetUsers_SubmittedByUserId",
                table: "Albums",
                column: "SubmittedByUserId",
                principalTable: "AspNetUsers",
                principalColumn: "Id",
                onDelete: ReferentialAction.SetNull);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropForeignKey(
                name: "FK_Albums_AspNetUsers_SubmittedByUserId",
                table: "Albums");

            migrationBuilder.DropIndex(
                name: "IX_Albums_Status",
                table: "Albums");

            migrationBuilder.DropIndex(
                name: "IX_Albums_SubmittedByUserId",
                table: "Albums");

            migrationBuilder.DropColumn(
                name: "Status",
                table: "Albums");

            migrationBuilder.DropColumn(
                name: "SubmittedByUserId",
                table: "Albums");
        }
    }
}
