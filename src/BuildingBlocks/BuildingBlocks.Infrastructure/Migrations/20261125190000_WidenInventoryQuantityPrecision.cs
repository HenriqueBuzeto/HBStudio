using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace BuildingBlocks.Infrastructure.Migrations
{
    public partial class WidenInventoryQuantityPrecision : Migration
    {
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AlterColumn<decimal>(name: "OnHandQuantity", table: "stock_balances", type: "numeric(20,6)", precision: 20, scale: 6, nullable: false, oldClrType: typeof(decimal), oldType: "numeric(18,4)", oldPrecision: 18, oldScale: 4);
            migrationBuilder.AlterColumn<decimal>(name: "ReservedQuantity", table: "stock_balances", type: "numeric(20,6)", precision: 20, scale: 6, nullable: false, oldClrType: typeof(decimal), oldType: "numeric(18,4)", oldPrecision: 18, oldScale: 4);
            migrationBuilder.AlterColumn<decimal>(name: "BlockedQuantity", table: "stock_balances", type: "numeric(20,6)", precision: 20, scale: 6, nullable: false, oldClrType: typeof(decimal), oldType: "numeric(18,4)", oldPrecision: 18, oldScale: 4);
            migrationBuilder.AlterColumn<decimal>(name: "Quantity", table: "stock_movements", type: "numeric(20,6)", precision: 20, scale: 6, nullable: false, oldClrType: typeof(decimal), oldType: "numeric(18,4)", oldPrecision: 18, oldScale: 4);
            migrationBuilder.AlterColumn<decimal>(name: "BalanceAfterQuantity", table: "stock_movements", type: "numeric(20,6)", precision: 20, scale: 6, nullable: false, oldClrType: typeof(decimal), oldType: "numeric(18,4)", oldPrecision: 18, oldScale: 4);
            migrationBuilder.AlterColumn<decimal>(name: "Quantity", table: "stock_reservation_items", type: "numeric(20,6)", precision: 20, scale: 6, nullable: false, oldClrType: typeof(decimal), oldType: "numeric(18,4)", oldPrecision: 18, oldScale: 4);
            migrationBuilder.AlterColumn<decimal>(name: "Quantity", table: "stock_transfer_items", type: "numeric(20,6)", precision: 20, scale: 6, nullable: false, oldClrType: typeof(decimal), oldType: "numeric(18,4)", oldPrecision: 18, oldScale: 4);
            migrationBuilder.AlterColumn<decimal>(name: "SystemSnapshotQuantity", table: "inventory_count_items", type: "numeric(20,6)", precision: 20, scale: 6, nullable: false, oldClrType: typeof(decimal), oldType: "numeric(18,4)", oldPrecision: 18, oldScale: 4);
            migrationBuilder.AlterColumn<decimal>(name: "CountedQuantity", table: "inventory_count_items", type: "numeric(20,6)", precision: 20, scale: 6, nullable: false, oldClrType: typeof(decimal), oldType: "numeric(18,4)", oldPrecision: 18, oldScale: 4);
        }
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            // Refuse narrowing while the factory schema exists or fractional values would be lost.
            migrationBuilder.Sql(@"DO $$ BEGIN IF to_regclass('public.manufacturing_material_allocations') IS NOT NULL THEN RAISE EXCEPTION 'Remove/reconcile factory precision dependency before downgrade'; END IF; IF EXISTS (SELECT 1 FROM public.stock_balances WHERE ""OnHandQuantity"" <> round(""OnHandQuantity"",4) OR ""ReservedQuantity"" <> round(""ReservedQuantity"",4) OR ""BlockedQuantity"" <> round(""BlockedQuantity"",4)) THEN RAISE EXCEPTION 'Inventory quantity precision loss'; END IF; IF EXISTS (SELECT 1 FROM public.stock_movements WHERE ""Quantity"" <> round(""Quantity"",4) OR ""BalanceAfterQuantity"" <> round(""BalanceAfterQuantity"",4)) THEN RAISE EXCEPTION 'Inventory quantity precision loss'; END IF; IF EXISTS (SELECT 1 FROM public.stock_reservation_items WHERE ""Quantity"" <> round(""Quantity"",4)) THEN RAISE EXCEPTION 'Inventory quantity precision loss'; END IF; IF EXISTS (SELECT 1 FROM public.stock_transfer_items WHERE ""Quantity"" <> round(""Quantity"",4)) THEN RAISE EXCEPTION 'Inventory quantity precision loss'; END IF; IF EXISTS (SELECT 1 FROM public.inventory_count_items WHERE ""SystemSnapshotQuantity"" <> round(""SystemSnapshotQuantity"",4) OR ""CountedQuantity"" <> round(""CountedQuantity"",4)) THEN RAISE EXCEPTION 'Inventory quantity precision loss'; END IF; END $$;");
            migrationBuilder.AlterColumn<decimal>(name: "OnHandQuantity", table: "stock_balances", type: "numeric(18,4)", precision: 18, scale: 4, nullable: false, oldClrType: typeof(decimal), oldType: "numeric(20,6)", oldPrecision: 20, oldScale: 6);
            migrationBuilder.AlterColumn<decimal>(name: "ReservedQuantity", table: "stock_balances", type: "numeric(18,4)", precision: 18, scale: 4, nullable: false, oldClrType: typeof(decimal), oldType: "numeric(20,6)", oldPrecision: 20, oldScale: 6);
            migrationBuilder.AlterColumn<decimal>(name: "BlockedQuantity", table: "stock_balances", type: "numeric(18,4)", precision: 18, scale: 4, nullable: false, oldClrType: typeof(decimal), oldType: "numeric(20,6)", oldPrecision: 20, oldScale: 6);
            migrationBuilder.AlterColumn<decimal>(name: "Quantity", table: "stock_movements", type: "numeric(18,4)", precision: 18, scale: 4, nullable: false, oldClrType: typeof(decimal), oldType: "numeric(20,6)", oldPrecision: 20, oldScale: 6);
            migrationBuilder.AlterColumn<decimal>(name: "BalanceAfterQuantity", table: "stock_movements", type: "numeric(18,4)", precision: 18, scale: 4, nullable: false, oldClrType: typeof(decimal), oldType: "numeric(20,6)", oldPrecision: 20, oldScale: 6);
            migrationBuilder.AlterColumn<decimal>(name: "Quantity", table: "stock_reservation_items", type: "numeric(18,4)", precision: 18, scale: 4, nullable: false, oldClrType: typeof(decimal), oldType: "numeric(20,6)", oldPrecision: 20, oldScale: 6);
            migrationBuilder.AlterColumn<decimal>(name: "Quantity", table: "stock_transfer_items", type: "numeric(18,4)", precision: 18, scale: 4, nullable: false, oldClrType: typeof(decimal), oldType: "numeric(20,6)", oldPrecision: 20, oldScale: 6);
            migrationBuilder.AlterColumn<decimal>(name: "SystemSnapshotQuantity", table: "inventory_count_items", type: "numeric(18,4)", precision: 18, scale: 4, nullable: false, oldClrType: typeof(decimal), oldType: "numeric(20,6)", oldPrecision: 20, oldScale: 6);
            migrationBuilder.AlterColumn<decimal>(name: "CountedQuantity", table: "inventory_count_items", type: "numeric(18,4)", precision: 18, scale: 4, nullable: false, oldClrType: typeof(decimal), oldType: "numeric(20,6)", oldPrecision: 20, oldScale: 6);
        }
    }
}
