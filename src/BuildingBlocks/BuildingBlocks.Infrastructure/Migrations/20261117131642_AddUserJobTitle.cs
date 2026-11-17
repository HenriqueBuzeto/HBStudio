using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace BuildingBlocks.Infrastructure.Migrations
{
    /// <inheritdoc />
    public partial class AddUserJobTitle : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<string>(
                name: "JobTitle",
                table: "users",
                type: "character varying(100)",
                maxLength: 100,
                nullable: false,
                defaultValue: "Colaborador");

            migrationBuilder.CreateTable(
                name: "fiscal_certificates",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    EstablishmentId = table.Column<Guid>(type: "uuid", nullable: false),
                    SubjectName = table.Column<string>(type: "text", nullable: false),
                    Thumbprint = table.Column<string>(type: "text", nullable: false),
                    Cnpj = table.Column<string>(type: "text", nullable: false),
                    ValidFromUtc = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    ValidUntilUtc = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    EncryptedRawData = table.Column<byte[]>(type: "bytea", nullable: false),
                    EncryptedPassword = table.Column<byte[]>(type: "bytea", nullable: false),
                    KeyIvBase64 = table.Column<string>(type: "text", nullable: false),
                    IsActive = table.Column<bool>(type: "boolean", nullable: false),
                    CreatedAtUtc = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    UpdatedAtUtc = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    xmin = table.Column<uint>(type: "xid", rowVersion: true, nullable: false),
                    TenantId = table.Column<Guid>(type: "uuid", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_fiscal_certificates", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "fiscal_cscs",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    EstablishmentId = table.Column<Guid>(type: "uuid", nullable: false),
                    CscId = table.Column<string>(type: "text", nullable: false),
                    EncryptedCscToken = table.Column<byte[]>(type: "bytea", nullable: false),
                    CscTokenMasked = table.Column<string>(type: "text", nullable: false),
                    Environment = table.Column<int>(type: "integer", nullable: false),
                    IsActive = table.Column<bool>(type: "boolean", nullable: false),
                    CreatedAtUtc = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    UpdatedAtUtc = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    xmin = table.Column<uint>(type: "xid", rowVersion: true, nullable: false),
                    TenantId = table.Column<Guid>(type: "uuid", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_fiscal_cscs", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "fiscal_documents",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    EstablishmentId = table.Column<Guid>(type: "uuid", nullable: false),
                    SaleId = table.Column<Guid>(type: "uuid", nullable: true),
                    DocumentType = table.Column<int>(type: "integer", nullable: false),
                    Environment = table.Column<int>(type: "integer", nullable: false),
                    Status = table.Column<int>(type: "integer", nullable: false),
                    Series = table.Column<int>(type: "integer", nullable: false),
                    Number = table.Column<int>(type: "integer", nullable: false),
                    AccessKey = table.Column<string>(type: "text", nullable: false),
                    IssuedAtUtc = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    TotalAmount = table.Column<decimal>(type: "numeric(18,2)", precision: 18, scale: 2, nullable: false),
                    TotalDiscounts = table.Column<decimal>(type: "numeric(18,2)", precision: 18, scale: 2, nullable: false),
                    TotalNetProductAmount = table.Column<decimal>(type: "numeric", nullable: false),
                    TotalTaxesEstimated = table.Column<decimal>(type: "numeric", nullable: false),
                    RecipientCpf = table.Column<string>(type: "text", nullable: true),
                    RecipientName = table.Column<string>(type: "text", nullable: true),
                    ProtocolNumber = table.Column<string>(type: "text", nullable: true),
                    ProtocolReceivedAtUtc = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    SefazStatusCode = table.Column<int>(type: "integer", nullable: true),
                    SefazStatusReason = table.Column<string>(type: "text", nullable: true),
                    QrCodeUrl = table.Column<string>(type: "text", nullable: true),
                    DanfeXmlContent = table.Column<string>(type: "text", nullable: true),
                    CancellationXmlContent = table.Column<string>(type: "text", nullable: true),
                    CancellationReason = table.Column<string>(type: "text", nullable: true),
                    CancelledAtUtc = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    ReconcileClaimWorkerId = table.Column<Guid>(type: "uuid", nullable: true),
                    ReconcileLeaseExpiresAtUtc = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    ReconcileRetryCount = table.Column<int>(type: "integer", nullable: false),
                    NextReconcileAttemptAtUtc = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    CreatedAtUtc = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    UpdatedAtUtc = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    xmin = table.Column<uint>(type: "xid", rowVersion: true, nullable: false),
                    TenantId = table.Column<Guid>(type: "uuid", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_fiscal_documents", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "fiscal_establishments",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    BranchId = table.Column<Guid>(type: "uuid", nullable: false),
                    CorporateName = table.Column<string>(type: "text", nullable: false),
                    TradeName = table.Column<string>(type: "text", nullable: false),
                    Cnpj = table.Column<string>(type: "text", nullable: false),
                    StateRegistration = table.Column<string>(type: "text", nullable: false),
                    MunicipalRegistration = table.Column<string>(type: "text", nullable: false),
                    Cnae = table.Column<string>(type: "text", nullable: false),
                    Regime = table.Column<int>(type: "integer", nullable: false),
                    Street = table.Column<string>(type: "text", nullable: false),
                    Number = table.Column<string>(type: "text", nullable: false),
                    Complement = table.Column<string>(type: "text", nullable: true),
                    Neighborhood = table.Column<string>(type: "text", nullable: false),
                    CityCodeIbge = table.Column<string>(type: "text", nullable: false),
                    CityName = table.Column<string>(type: "text", nullable: false),
                    State = table.Column<string>(type: "text", nullable: false),
                    PostalCode = table.Column<string>(type: "text", nullable: false),
                    Environment = table.Column<int>(type: "integer", nullable: false),
                    QrVersion = table.Column<int>(type: "integer", nullable: false),
                    NfceDefaultSeries = table.Column<int>(type: "integer", nullable: false),
                    NfceNextNumber = table.Column<int>(type: "integer", nullable: false),
                    IsNfceEnabled = table.Column<bool>(type: "boolean", nullable: false),
                    IsActive = table.Column<bool>(type: "boolean", nullable: false),
                    CreatedAtUtc = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    UpdatedAtUtc = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    xmin = table.Column<uint>(type: "xid", rowVersion: true, nullable: false),
                    TenantId = table.Column<Guid>(type: "uuid", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_fiscal_establishments", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "inbound_fiscal_documents",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    AccessKey = table.Column<string>(type: "text", nullable: false),
                    Number = table.Column<int>(type: "integer", nullable: false),
                    Series = table.Column<int>(type: "integer", nullable: false),
                    IssuedAtUtc = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    ReceivedAtUtc = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    SupplierCnpj = table.Column<string>(type: "text", nullable: false),
                    SupplierName = table.Column<string>(type: "text", nullable: false),
                    SupplierStateRegistration = table.Column<string>(type: "text", nullable: true),
                    RecipientCnpj = table.Column<string>(type: "text", nullable: false),
                    TotalProductsAmount = table.Column<decimal>(type: "numeric(18,2)", precision: 18, scale: 2, nullable: false),
                    TotalInvoiceAmount = table.Column<decimal>(type: "numeric(18,2)", precision: 18, scale: 2, nullable: false),
                    TotalIcmsAmount = table.Column<decimal>(type: "numeric(18,2)", precision: 18, scale: 2, nullable: false),
                    RawXmlContent = table.Column<string>(type: "text", nullable: false),
                    AssociatedPurchaseOrderId = table.Column<Guid>(type: "uuid", nullable: true),
                    IsConciliated = table.Column<bool>(type: "boolean", nullable: false),
                    CreatedAtUtc = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    UpdatedAtUtc = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    xmin = table.Column<uint>(type: "xid", rowVersion: true, nullable: false),
                    TenantId = table.Column<Guid>(type: "uuid", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_inbound_fiscal_documents", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "fiscal_document_items",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    FiscalDocumentId = table.Column<Guid>(type: "uuid", nullable: false),
                    ItemIndex = table.Column<int>(type: "integer", nullable: false),
                    SkuId = table.Column<Guid>(type: "uuid", nullable: true),
                    ProductCode = table.Column<string>(type: "text", nullable: false),
                    Description = table.Column<string>(type: "text", nullable: false),
                    Ncm = table.Column<string>(type: "text", nullable: false),
                    Cest = table.Column<string>(type: "text", nullable: true),
                    Cfop = table.Column<string>(type: "text", nullable: false),
                    UnitOfMeasure = table.Column<string>(type: "text", nullable: false),
                    Quantity = table.Column<decimal>(type: "numeric(18,4)", precision: 18, scale: 4, nullable: false),
                    UnitPrice = table.Column<decimal>(type: "numeric(18,4)", precision: 18, scale: 4, nullable: false),
                    TotalGrossAmount = table.Column<decimal>(type: "numeric(18,2)", precision: 18, scale: 2, nullable: false),
                    DiscountAmount = table.Column<decimal>(type: "numeric(18,2)", precision: 18, scale: 2, nullable: false),
                    NetAmount = table.Column<decimal>(type: "numeric(18,2)", precision: 18, scale: 2, nullable: false),
                    SerialOrImei = table.Column<string>(type: "text", nullable: true),
                    Origem = table.Column<string>(type: "text", nullable: false),
                    Csosn = table.Column<string>(type: "text", nullable: false),
                    EstimatedTaxRate = table.Column<decimal>(type: "numeric", nullable: false),
                    CreatedAtUtc = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    UpdatedAtUtc = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    xmin = table.Column<uint>(type: "xid", rowVersion: true, nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_fiscal_document_items", x => x.Id);
                    table.ForeignKey(
                        name: "FK_fiscal_document_items_fiscal_documents_FiscalDocumentId",
                        column: x => x.FiscalDocumentId,
                        principalTable: "fiscal_documents",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "inbound_fiscal_items",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    InboundFiscalDocumentId = table.Column<Guid>(type: "uuid", nullable: false),
                    ItemIndex = table.Column<int>(type: "integer", nullable: false),
                    SupplierProductCode = table.Column<string>(type: "text", nullable: false),
                    ProductDescription = table.Column<string>(type: "text", nullable: false),
                    Ncm = table.Column<string>(type: "text", nullable: false),
                    Cfop = table.Column<string>(type: "text", nullable: true),
                    Quantity = table.Column<decimal>(type: "numeric(18,4)", precision: 18, scale: 4, nullable: false),
                    UnitCost = table.Column<decimal>(type: "numeric(18,4)", precision: 18, scale: 4, nullable: false),
                    TotalCost = table.Column<decimal>(type: "numeric(18,2)", precision: 18, scale: 2, nullable: false),
                    LinkedCatalogSkuId = table.Column<Guid>(type: "uuid", nullable: true),
                    CreatedAtUtc = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    UpdatedAtUtc = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    xmin = table.Column<uint>(type: "xid", rowVersion: true, nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_inbound_fiscal_items", x => x.Id);
                    table.ForeignKey(
                        name: "FK_inbound_fiscal_items_inbound_fiscal_documents_InboundFiscal~",
                        column: x => x.InboundFiscalDocumentId,
                        principalTable: "inbound_fiscal_documents",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateIndex(
                name: "IX_fiscal_certificates_TenantId_Thumbprint",
                table: "fiscal_certificates",
                columns: new[] { "TenantId", "Thumbprint" });

            migrationBuilder.CreateIndex(
                name: "IX_fiscal_cscs_TenantId_CscId_Environment",
                table: "fiscal_cscs",
                columns: new[] { "TenantId", "CscId", "Environment" });

            migrationBuilder.CreateIndex(
                name: "IX_fiscal_document_items_FiscalDocumentId",
                table: "fiscal_document_items",
                column: "FiscalDocumentId");

            migrationBuilder.CreateIndex(
                name: "IX_fiscal_documents_TenantId_AccessKey",
                table: "fiscal_documents",
                columns: new[] { "TenantId", "AccessKey" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_fiscal_documents_TenantId_Series_Number",
                table: "fiscal_documents",
                columns: new[] { "TenantId", "Series", "Number" });

            migrationBuilder.CreateIndex(
                name: "IX_fiscal_establishments_TenantId_Cnpj",
                table: "fiscal_establishments",
                columns: new[] { "TenantId", "Cnpj" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_inbound_fiscal_documents_TenantId_AccessKey",
                table: "inbound_fiscal_documents",
                columns: new[] { "TenantId", "AccessKey" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_inbound_fiscal_items_InboundFiscalDocumentId",
                table: "inbound_fiscal_items",
                column: "InboundFiscalDocumentId");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "fiscal_certificates");

            migrationBuilder.DropTable(
                name: "fiscal_cscs");

            migrationBuilder.DropTable(
                name: "fiscal_document_items");

            migrationBuilder.DropTable(
                name: "fiscal_establishments");

            migrationBuilder.DropTable(
                name: "inbound_fiscal_items");

            migrationBuilder.DropTable(
                name: "fiscal_documents");

            migrationBuilder.DropTable(
                name: "inbound_fiscal_documents");

            migrationBuilder.DropColumn(
                name: "JobTitle",
                table: "users");
        }
    }
}
