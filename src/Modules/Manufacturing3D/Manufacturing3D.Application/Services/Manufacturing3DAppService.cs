using BuildingBlocks.Application;
using BuildingBlocks.Domain;
using Inventory.Application;
using Inventory.Domain;
using Manufacturing3D.Application.DTOs;
using Manufacturing3D.Domain.Entities;
using Microsoft.EntityFrameworkCore;

namespace Manufacturing3D.Application.Services;

public class Manufacturing3DAppService
{
    private readonly DbContext _dbContext;
    private readonly IExecutionContext _executionContext;
    private readonly InventoryService _inventoryService;

    public Manufacturing3DAppService(
        DbContext dbContext,
        IExecutionContext executionContext,
        InventoryService inventoryService)
    {
        _dbContext = dbContext;
        _executionContext = executionContext;
        _inventoryService = inventoryService;
    }

    #region Impressoras

    public async Task<PrinterDto> CreatePrinterAsync(CreatePrinterRequest req, CancellationToken ct = default)
    {
        var tenantId = _executionContext.TenantId;
        var branchId = _executionContext.BranchId ?? Guid.Empty;

        var existing = await _dbContext.Set<ManufacturingPrinter>()
            .AnyAsync(p => p.TenantId == tenantId && p.BranchId == branchId && p.Code == req.Code.Trim().ToUpperInvariant(), ct);

        if (existing)
            throw new InvalidOperationException($"Já existe uma impressora com o código '{req.Code}' nesta filial.");

        var printer = new ManufacturingPrinter(
            tenantId,
            branchId,
            req.Code,
            req.Name,
            req.Manufacturer,
            req.Model,
            req.SerialNumber,
            (PrinterTechnology)req.Technology,
            req.BuildVolume,
            req.NominalPowerWatts,
            req.AveragePowerWatts,
            req.AcquisitionCost,
            req.ConfiguredHourlyMachineCost
        );

        _dbContext.Set<ManufacturingPrinter>().Add(printer);
        await _dbContext.SaveChangesAsync(ct);

        return new PrinterDto(
            printer.Id,
            printer.Code,
            printer.Name,
            printer.Manufacturer,
            printer.Model,
            printer.Technology.ToString(),
            printer.BuildVolume,
            printer.ConfiguredHourlyMachineCost,
            printer.Status.ToString(),
            printer.StatusNote
        );
    }

    public async Task<IReadOnlyList<PrinterDto>> ListPrintersAsync(CancellationToken ct = default)
    {
        var tenantId = _executionContext.TenantId;
        var list = await _dbContext.Set<ManufacturingPrinter>()
            .Where(p => p.TenantId == tenantId)
            .OrderBy(p => p.Code)
            .ToListAsync(ct);

        return list.Select(p => new PrinterDto(
            p.Id,
            p.Code,
            p.Name,
            p.Manufacturer,
            p.Model,
            p.Technology.ToString(),
            p.BuildVolume,
            p.ConfiguredHourlyMachineCost,
            p.Status.ToString(),
            p.StatusNote
        )).ToList();
    }

    #endregion

    #region Orçamentos e Motores de Cálculo de Custos

    public async Task<QuoteCalculationResultDto> CalculateAndSaveQuoteAsync(CalculateManufacturingQuoteRequest req, CancellationToken ct = default)
    {
        var tenantId = _executionContext.TenantId;
        var branchId = _executionContext.BranchId ?? Guid.Empty;

        // 1. Custo de Material (g para kg)
        // Fórmula: (g / 1000) * Preço/kg
        var matCost = (req.FilamentGrams / 1000m) * req.FilamentKgCost;

        // 2. Custo de Energia Elétrica
        // Fórmula: (Potência média em kW) * Horas * Tarifa/kWh
        var powerKw = req.AveragePowerWatts / 1000m;
        var energyKwh = powerKw * req.PrintTimeHours;
        var energyCost = energyKwh * req.EnergyKwhRate;

        // 3. Custo de Hora-Máquina (Depreciação + Manutenção)
        var machineCost = req.PrintTimeHours * req.HourlyMachineCost;

        // 4. Custo de Mão de Obra
        var laborCost = req.LaborHours * req.HourlyLaborCost;

        // 5. Perda / Desperdício Planejado (suportes, purga)
        var baseCost = matCost + energyCost + machineCost + laborCost;
        var wasteCost = baseCost * (req.ExpectedWastePercent / 100m);

        var totalEstimated = matCost + energyCost + machineCost + laborCost + wasteCost;

        var quote = new ManufacturingQuote(
            tenantId,
            branchId,
            req.QuoteNumber,
            req.CustomerPartyId,
            req.Description,
            req.PlannedQuantity,
            Math.Round(matCost, 2),
            Math.Round(energyCost, 2),
            Math.Round(machineCost, 2),
            Math.Round(laborCost, 2),
            Math.Round(wasteCost, 2),
            req.MarkupPercent
        );

        _dbContext.Set<ManufacturingQuote>().Add(quote);
        await _dbContext.SaveChangesAsync(ct);

        var unitCost = req.PlannedQuantity > 0 ? quote.TotalEstimatedCost / req.PlannedQuantity : quote.TotalEstimatedCost;

        return new QuoteCalculationResultDto(
            quote.QuoteNumber,
            quote.PlannedQuantity,
            quote.EstimatedMaterialCost,
            quote.EstimatedEnergyCost,
            quote.EstimatedMachineCost,
            quote.EstimatedLaborCost,
            quote.EstimatedPlannedWasteCost,
            quote.TotalEstimatedCost,
            quote.MarkupPercent,
            quote.SuggestedFinalPrice,
            Math.Round(unitCost, 2),
            Math.Round(quote.GrossMarginPercent, 2)
        );
    }

    #endregion

    #region Ordens de Produção & Rastreabilidade de Consumo

    public async Task<ManufacturingOrderDto> CreateOrderAsync(CreateManufacturingOrderRequest req, CancellationToken ct = default)
    {
        var tenantId = _executionContext.TenantId;
        var branchId = _executionContext.BranchId ?? Guid.Empty;

        var order = new ManufacturingOrder(
            tenantId,
            branchId,
            req.OrderNumber,
            (ManufacturingOrderType)req.Type,
            req.SalesOrderId,
            req.TargetProductSkuId,
            req.DesignVersionId,
            req.AssignedPrinterId,
            req.MaterialProductSkuId,
            req.PlannedQuantity,
            req.EstimatedFilamentGrams,
            req.EstimatedPrintTimeMinutes,
            req.TotalEstimatedCost
        );

        _dbContext.Set<ManufacturingOrder>().Add(order);
        await _dbContext.SaveChangesAsync(ct);

        return MapOrder(order);
    }

    /// <summary>
    /// Reserva matéria-prima no Inventory oficial sem duplicar saldos paralelos.
    /// </summary>
    public async Task<ManufacturingOrderDto> ReserveMaterialAsync(Guid orderId, Guid warehouseId, decimal quantityGrams, CancellationToken ct = default)
    {
        var order = await _dbContext.Set<ManufacturingOrder>().FindAsync([orderId], ct);
        if (order == null) throw new KeyNotFoundException($"Ordem de produção {orderId} não encontrada.");

        // Cria reserva oficial pelo InventoryService (1 unidade/kg fracionado ou bobina inteira)
        var res = await _inventoryService.CreateReservationAsync(new CreateReservationRequest(
            order.BranchId,
            $"RES-OP-{order.OrderNumber}",
            $"Reserva de filamento para Ordem de Produção {order.OrderNumber}",
            DateTime.UtcNow.AddHours(72),
            $"DOC-OP-{order.Id}",
            $"IDEMP-RES-3D-{order.Id}",
            new List<CreateReservationItemRequest>
            {
                new(warehouseId, null, order.MaterialProductSkuId, 1, null)
            }
        ), ct);

        order.LinkReservation(res.Id);
        await _dbContext.SaveChangesAsync(ct);

        return MapOrder(order);
    }

    /// <summary>
    /// Inicia uma tentativa de impressão real na máquina.
    /// Valida transacionalmente que a impressora não está em manutenção ou com conflito.
    /// </summary>
    public async Task<Guid> StartPrintAttemptAsync(Guid orderId, int attemptNumber, Guid printerId, string operatorName, decimal estimatedMinutes, decimal estimatedGrams, CancellationToken ct = default)
    {
        var order = await _dbContext.Set<ManufacturingOrder>().FindAsync([orderId], ct);
        if (order == null) throw new KeyNotFoundException($"Ordem de produção {orderId} não encontrada.");

        var printer = await _dbContext.Set<ManufacturingPrinter>().FindAsync([printerId], ct);
        if (printer == null) throw new KeyNotFoundException($"Impressora {printerId} não encontrada.");

        if (printer.Status == PrinterOperationalStatus.Maintenance || printer.Status == PrinterOperationalStatus.OutOfService)
            throw new InvalidOperationException($"A impressora {printer.Code} está em manutenção ou fora de serviço.");

        order.StartProduction();
        printer.UpdateStatus(PrinterOperationalStatus.Printing, $"Executando OP {order.OrderNumber}");

        var attempt = order.CreateAttempt(attemptNumber, printerId, estimatedMinutes, estimatedGrams);
        attempt.Start(operatorName);

        await _dbContext.SaveChangesAsync(ct);
        return attempt.Id;
    }

    /// <summary>
    /// Registra sucesso na tentativa de impressão e apura o custo real dos insumos.
    /// </summary>
    public async Task CompletePrintAttemptAsync(Guid orderId, Guid attemptId, CompletePrintAttemptRequest req, CancellationToken ct = default)
    {
        var order = await _dbContext.Set<ManufacturingOrder>().Include(o => o.Attempts).FirstOrDefaultAsync(o => o.Id == orderId, ct);
        if (order == null) throw new KeyNotFoundException($"Ordem {orderId} não encontrada.");

        var attempt = order.Attempts.FirstOrDefault(a => a.Id == attemptId);
        if (attempt == null) throw new KeyNotFoundException($"Tentativa {attemptId} não encontrada.");

        attempt.CompleteSuccessfully(req.ActualDurationMinutes, req.ActualMassGrams);

        // Apuração matemática dos custos reais
        var matCost = (req.ActualMassGrams / 1000m) * req.MaterialUnitCostKg;
        var durationHours = req.ActualDurationMinutes / 60m;
        var energyCost = (0.15m * durationHours) * req.EnergyKwhTariff; // 150W médios
        var machineCost = durationHours * req.MachineHourlyCost;
        var laborCost = req.OperatorHours * req.LaborHourlyRate;

        order.RegisterConsumptionAndCosts(
            Math.Round(matCost, 2),
            Math.Round(energyCost, 2),
            Math.Round(machineCost, 2),
            Math.Round(laborCost, 2),
            0m
        );

        // Libera a impressora
        var printer = await _dbContext.Set<ManufacturingPrinter>().FindAsync([attempt.PrinterId], ct);
        printer?.UpdateStatus(PrinterOperationalStatus.Available, "Pronta para novo trabalho.");

        await _dbContext.SaveChangesAsync(ct);
    }

    /// <summary>
    /// REGISTRO FORMAL DE FALHA / REFUGOS:
    /// O custo consumido NÃO desaparece; ele é preservado integralmente como custo incorrido da ordem!
    /// </summary>
    public async Task RegisterPrintFailureAsync(Guid orderId, Guid attemptId, FailPrintAttemptRequest req, CancellationToken ct = default)
    {
        var order = await _dbContext.Set<ManufacturingOrder>().Include(o => o.Attempts).FirstOrDefaultAsync(o => o.Id == orderId, ct);
        if (order == null) throw new KeyNotFoundException($"Ordem {orderId} não encontrada.");

        var attempt = order.Attempts.FirstOrDefault(a => a.Id == attemptId);
        if (attempt == null) throw new KeyNotFoundException($"Tentativa {attemptId} não encontrada.");

        attempt.RegisterFailure((FailureCategory)req.FailureCategory, req.FailureReason, req.WastedDurationMinutes, req.WastedMassGrams);

        // Custos do refugo/desperdício
        var wasteMatCost = (req.WastedMassGrams / 1000m) * req.MaterialUnitCostKg;
        var wasteDurationHours = req.WastedDurationMinutes / 60m;
        var wasteEnergyCost = (0.15m * wasteDurationHours) * req.EnergyKwhTariff;
        var wasteMachineCost = wasteDurationHours * req.MachineHourlyCost;

        order.RegisterConsumptionAndCosts(
            0m,
            Math.Round(wasteEnergyCost, 2),
            Math.Round(wasteMachineCost, 2),
            0m,
            Math.Round(wasteMatCost, 2) // Entra como WasteCost
        );

        var printer = await _dbContext.Set<ManufacturingPrinter>().FindAsync([attempt.PrinterId], ct);
        printer?.UpdateStatus(PrinterOperationalStatus.Available, $"Falha reportada em OP {order.OrderNumber}: {req.FailureReason}");

        await _dbContext.SaveChangesAsync(ct);
    }

    /// <summary>
    /// Inspeção de Qualidade e Entrada Oficial do Produto Acabado no Inventory.
    /// Não permite gerar estoque vendável antes de inspeção aprovada.
    /// </summary>
    public async Task<ManufacturingOrderDto> CompleteQualityAndReceiveFinishedGoodAsync(
        Guid orderId,
        CompleteOrderQualityInspectionRequest req,
        CancellationToken ct = default)
    {
        var order = await _dbContext.Set<ManufacturingOrder>().FindAsync([orderId], ct);
        if (order == null) throw new KeyNotFoundException($"Ordem {orderId} não encontrada.");

        if (req.ApprovedQuantity < 0 || req.RejectedQuantity < 0)
            throw new ArgumentException("Quantidades de inspeção não podem ser negativas.");

        // Atualiza a OP com o resultado de qualidade
        order.CompleteQualityInspection(req.ApprovedQuantity, req.RejectedQuantity, req.FailureReason);

        // Consumir a reserva de filamento utilizada no Inventory oficial
        if (order.MaterialStockReservationId.HasValue)
        {
            await _inventoryService.ConsumeReservationAsync(order.MaterialStockReservationId.Value, ct);
        }

        // Se houver peças aprovadas e SKU alvo definido, dá ENTRADA OFICIAL no Inventory
        if (req.ApprovedQuantity > 0 && order.TargetProductSkuId.HasValue)
        {
            await _inventoryService.RegisterInitialReceiptAsync(new InitialStockReceiptRequest(
                order.BranchId,
                req.DestinationWarehouseId,
                null,
                order.TargetProductSkuId.Value,
                req.ApprovedQuantity,
                order.ActualUnitCost,
                $"ENT-PROD-3D-{order.OrderNumber}",
                $"Entrada de produção 3D - OP {order.OrderNumber} ({req.ApprovedQuantity} un aprovadas)",
                null,
                $"IDEMP-REC-3D-{order.Id}"
            ), canViewCost: true, ct);
        }

        await _dbContext.SaveChangesAsync(ct);
        return MapOrder(order);
    }

    public async Task<IReadOnlyList<ManufacturingOrderDto>> ListOrdersAsync(CancellationToken ct = default)
    {
        var tenantId = _executionContext.TenantId;
        var orders = await _dbContext.Set<ManufacturingOrder>()
            .Where(o => o.TenantId == tenantId)
            .OrderByDescending(o => o.CreatedAtUtc)
            .ToListAsync(ct);

        return orders.Select(MapOrder).ToList();
    }

    private static ManufacturingOrderDto MapOrder(ManufacturingOrder o) =>
        new(
            o.Id,
            o.OrderNumber,
            o.Type.ToString(),
            o.Status.ToString(),
            o.PlannedQuantity,
            o.ProducedQuantity,
            o.ApprovedQuantity,
            o.RejectedQuantity,
            o.TotalEstimatedCost,
            o.TotalActualCost,
            o.ActualUnitCost,
            o.MaterialStockReservationId,
            o.FailureReason,
            o.CreatedAtUtc
        );

    #endregion
}
