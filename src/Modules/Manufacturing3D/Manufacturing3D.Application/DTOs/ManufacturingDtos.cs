namespace Manufacturing3D.Application.DTOs;

public record CreatePrinterRequest(
    string Code,
    string Name,
    string Manufacturer,
    string Model,
    string? SerialNumber,
    int Technology,
    string BuildVolume,
    decimal NominalPowerWatts,
    decimal AveragePowerWatts,
    decimal AcquisitionCost,
    decimal ConfiguredHourlyMachineCost
);

public record PrinterDto(
    Guid Id,
    string Code,
    string Name,
    string Manufacturer,
    string Model,
    string Technology,
    string BuildVolume,
    decimal ConfiguredHourlyMachineCost,
    string Status,
    string? StatusNote
);

public record CreateDesignAssetRequest(
    string Code,
    string Title,
    string Category,
    string LicenseType,
    bool IsCommercialAllowed,
    string? Author,
    Guid? AssociatedProductSkuId
);

public record AddDesignVersionRequest(
    string RevisionCode,
    string FileFormat,
    string StoragePath,
    string Sha256Hash,
    long FileSizeBytes,
    decimal EstimatedDurationMinutes,
    decimal EstimatedMassGrams,
    string? TechnicalNotes
);

public record CalculateManufacturingQuoteRequest(
    string QuoteNumber,
    Guid? CustomerPartyId,
    string Description,
    int PlannedQuantity,
    decimal FilamentGrams,
    decimal FilamentKgCost,
    decimal PrintTimeHours,
    decimal AveragePowerWatts,
    decimal EnergyKwhRate,
    decimal HourlyMachineCost,
    decimal LaborHours,
    decimal HourlyLaborCost,
    decimal ExpectedWastePercent,
    decimal MarkupPercent
);

public record QuoteCalculationResultDto(
    string QuoteNumber,
    int PlannedQuantity,
    decimal EstimatedMaterialCost,
    decimal EstimatedEnergyCost,
    decimal EstimatedMachineCost,
    decimal EstimatedLaborCost,
    decimal EstimatedPlannedWasteCost,
    decimal TotalEstimatedCost,
    decimal MarkupPercent,
    decimal SuggestedFinalPrice,
    decimal EstimatedUnitCost,
    decimal GrossMarginPercent
);

public record CreateManufacturingOrderRequest(
    string OrderNumber,
    int Type,
    Guid? SalesOrderId,
    Guid? TargetProductSkuId,
    Guid? DesignVersionId,
    Guid? AssignedPrinterId,
    Guid MaterialProductSkuId,
    int PlannedQuantity,
    decimal EstimatedFilamentGrams,
    decimal EstimatedPrintTimeMinutes,
    decimal TotalEstimatedCost
);

public record RegisterPrintAttemptRequest(
    int AttemptNumber,
    Guid PrinterId,
    decimal EstimatedDurationMinutes,
    decimal EstimatedGrams
);

public record StartPrintAttemptRequest(string OperatorName);

public record CompletePrintAttemptRequest(
    decimal ActualDurationMinutes,
    decimal ActualMassGrams,
    decimal MaterialUnitCostKg,
    decimal EnergyKwhTariff,
    decimal MachineHourlyCost,
    decimal LaborHourlyRate,
    decimal OperatorHours
);

public record FailPrintAttemptRequest(
    int FailureCategory,
    string FailureReason,
    decimal WastedDurationMinutes,
    decimal WastedMassGrams,
    decimal MaterialUnitCostKg,
    decimal EnergyKwhTariff,
    decimal MachineHourlyCost
);

public record CompleteOrderQualityInspectionRequest(
    int ApprovedQuantity,
    int RejectedQuantity,
    string? FailureReason,
    Guid DestinationWarehouseId // Depósito oficial para entrada no Inventory
);

public record ManufacturingOrderDto(
    Guid Id,
    string OrderNumber,
    string Type,
    string Status,
    int PlannedQuantity,
    int ProducedQuantity,
    int ApprovedQuantity,
    int RejectedQuantity,
    decimal TotalEstimatedCost,
    decimal TotalActualCost,
    decimal ActualUnitCost,
    Guid? MaterialStockReservationId,
    string? FailureReason,
    DateTime CreatedAtUtc
);
