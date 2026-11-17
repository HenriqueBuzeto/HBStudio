using Catalog.Domain;

namespace Catalog.Application;

public record CategoryResponse(
    Guid Id,
    string Name,
    string Slug,
    Guid? ParentCategoryId,
    bool IsActive,
    DateTime CreatedAtUtc,
    uint Version
);

public record BrandResponse(
    Guid Id,
    string Name,
    string? Description,
    bool IsActive,
    DateTime CreatedAtUtc,
    uint Version
);

public record ProductSkuResponse(
    Guid Id,
    Guid ProductModelId,
    string SkuCode,
    string VariantName,
    string? BarcodeEan,
    decimal DefaultPrice,
    string? TechnicalSpecsJson,
    bool IsActive,
    DateTime CreatedAtUtc,
    uint Version,
    int AvailableUnitsCount
);

public record ProductModelResponse(
    Guid Id,
    string Name,
    string? Description,
    ProductKind Kind,
    SerializationPolicy SerializationPolicy,
    Guid BrandId,
    string? BrandName,
    Guid CategoryId,
    string? CategoryName,
    bool IsActive,
    IReadOnlyList<ProductSkuResponse> Skus,
    DateTime CreatedAtUtc,
    uint Version
);

public record InventoryUnitResponse(
    Guid Id,
    Guid ProductSkuId,
    string? SkuCode,
    string? ModelName,
    string? SerialNumber,
    string? Imei1,
    string? Imei2,
    ItemCondition Condition,
    CosmeticGrade Grade,
    int? BatteryHealthPercentage,
    decimal? AcquisitionCost, // Omitido quando o usuário não tiver permissão catalog.cost.view
    Guid? SupplierPartyId,
    UnitOperationalStatus OperationalStatus,
    string? InspectionNotes,
    DateTime AcquisitionDateUtc,
    uint Version
);

public record CreateCategoryRequest(string Name, string Slug, Guid? ParentCategoryId);
public record CreateBrandRequest(string Name, string? Description);

public record CreateProductModelRequest(
    string Name,
    ProductKind Kind,
    SerializationPolicy SerializationPolicy,
    Guid BrandId,
    Guid CategoryId,
    string? Description,
    CreateProductSkuRequest? InitialSku = null
);

public record CreateProductSkuRequest(
    string SkuCode,
    string VariantName,
    decimal DefaultPrice,
    string? BarcodeEan,
    string? TechnicalSpecsJson
);

public record UpdateSkuPriceRequest(decimal NewPrice, uint ExpectedVersion);

public record RegisterInventoryUnitRequest(
    Guid ProductSkuId,
    ItemCondition Condition,
    decimal AcquisitionCost,
    string? SerialNumber,
    string? Imei1,
    string? Imei2,
    CosmeticGrade Grade,
    int? BatteryHealthPercentage,
    Guid? SupplierPartyId,
    string? InspectionNotes
);

public record ApproveUnitForSaleRequest(string? ApprovalNotes, uint ExpectedVersion);
