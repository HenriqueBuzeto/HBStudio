using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace BuildingBlocks.Infrastructure.Migrations
{
    /// <inheritdoc />
    public partial class UpdatePricingPolicyCounterDiscountAndAllocatedFreight : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<decimal>(
                name: "MaxCounterDiscountRate",
                table: "product_pricing_policies",
                type: "numeric",
                nullable: false,
                defaultValue: 0m);

            migrationBuilder.AddColumn<decimal>(
                name: "MaxCounterDiscountPrice",
                table: "product_price_suggestions",
                type: "numeric",
                nullable: false,
                defaultValue: 0m);

            migrationBuilder.AddColumn<decimal>(
                name: "AllocatedFreightCost",
                table: "inventory_units",
                type: "numeric",
                nullable: false,
                defaultValue: 0m);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "MaxCounterDiscountRate",
                table: "product_pricing_policies");

            migrationBuilder.DropColumn(
                name: "MaxCounterDiscountPrice",
                table: "product_price_suggestions");

            migrationBuilder.DropColumn(
                name: "AllocatedFreightCost",
                table: "inventory_units");
        }
    }
}
