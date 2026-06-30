using Microsoft.EntityFrameworkCore.Infrastructure;
using Microsoft.EntityFrameworkCore.Migrations;
using NotSpotify.Api.Data;

#nullable disable

namespace NotSpotify.Api.Migrations;

[DbContext(typeof(AppDbContext))]
[Migration("20260630070000_AddRegistrationEmailVerification")]
public partial class AddRegistrationEmailVerification : Migration
{
    protected override void Up(MigrationBuilder migrationBuilder)
    {
        migrationBuilder.AddColumn<int>(
            name: "EmailConfirmationOtpAttempts",
            table: "AspNetUsers",
            type: "integer",
            nullable: false,
            defaultValue: 0);

        migrationBuilder.AddColumn<DateTime>(
            name: "EmailConfirmationOtpExpiresAt",
            table: "AspNetUsers",
            type: "timestamp with time zone",
            nullable: true);

        migrationBuilder.AddColumn<string>(
            name: "EmailConfirmationOtpHash",
            table: "AspNetUsers",
            type: "text",
            nullable: true);

        migrationBuilder.AddColumn<DateTime>(
            name: "EmailConfirmationOtpSentAt",
            table: "AspNetUsers",
            type: "timestamp with time zone",
            nullable: true);

        // Accounts created before this feature were allowed to sign in without
        // verification. Preserve their access; new local signups explicitly set
        // EmailConfirmed=false until their OTP succeeds.
        migrationBuilder.Sql("""
            UPDATE "AspNetUsers"
            SET "EmailConfirmed" = TRUE;
            """);
    }

    protected override void Down(MigrationBuilder migrationBuilder)
    {
        migrationBuilder.DropColumn(name: "EmailConfirmationOtpAttempts", table: "AspNetUsers");
        migrationBuilder.DropColumn(name: "EmailConfirmationOtpExpiresAt", table: "AspNetUsers");
        migrationBuilder.DropColumn(name: "EmailConfirmationOtpHash", table: "AspNetUsers");
        migrationBuilder.DropColumn(name: "EmailConfirmationOtpSentAt", table: "AspNetUsers");
    }
}
