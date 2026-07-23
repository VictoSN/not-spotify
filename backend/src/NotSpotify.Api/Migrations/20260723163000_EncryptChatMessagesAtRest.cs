using Microsoft.EntityFrameworkCore.Infrastructure;
using Microsoft.EntityFrameworkCore.Migrations;
using NotSpotify.Api.Data;

#nullable disable

namespace NotSpotify.Api.Migrations;

[DbContext(typeof(AppDbContext))]
[Migration("20260723163000_EncryptChatMessagesAtRest")]
public partial class EncryptChatMessagesAtRest : Migration
{
    protected override void Up(MigrationBuilder migrationBuilder)
    {
        migrationBuilder.AlterColumn<string>(
            name: "Body",
            table: "ChatMessages",
            type: "text",
            nullable: false,
            oldClrType: typeof(string),
            oldType: "character varying(4000)",
            oldMaxLength: 4000);

        // Older chat notifications duplicated up to 80 plaintext characters.
        // Remove those copies while preserving the notification itself.
        migrationBuilder.Sql(
            """
            UPDATE "Notifications"
            SET "Body" = 'Open Messages to read it.'
            WHERE "Type" = 'chat_message'
            """);
    }

    protected override void Down(MigrationBuilder migrationBuilder)
    {
        migrationBuilder.AlterColumn<string>(
            name: "Body",
            table: "ChatMessages",
            type: "character varying(4000)",
            maxLength: 4000,
            nullable: false,
            oldClrType: typeof(string),
            oldType: "text");
    }
}
