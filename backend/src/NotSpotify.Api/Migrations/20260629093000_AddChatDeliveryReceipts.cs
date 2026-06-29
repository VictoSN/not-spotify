using Microsoft.EntityFrameworkCore.Infrastructure;
using Microsoft.EntityFrameworkCore.Migrations;
using NotSpotify.Api.Data;

#nullable disable

namespace NotSpotify.Api.Migrations;

[DbContext(typeof(AppDbContext))]
[Migration("20260629093000_AddChatDeliveryReceipts")]
public partial class AddChatDeliveryReceipts : Migration
{
    protected override void Up(MigrationBuilder migrationBuilder)
    {
        migrationBuilder.AddColumn<DateTime>(
            name: "DeliveredAt",
            table: "ChatMessages",
            type: "timestamp with time zone",
            nullable: true);

        // A message that was already read was necessarily delivered too.
        migrationBuilder.Sql(
            """
            UPDATE "ChatMessages"
            SET "DeliveredAt" = "ReadAt"
            WHERE "ReadAt" IS NOT NULL AND "DeliveredAt" IS NULL;
            """);
    }

    protected override void Down(MigrationBuilder migrationBuilder)
    {
        migrationBuilder.DropColumn(
            name: "DeliveredAt",
            table: "ChatMessages");
    }
}
