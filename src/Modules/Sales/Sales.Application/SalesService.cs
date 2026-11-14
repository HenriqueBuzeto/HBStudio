using Microsoft.EntityFrameworkCore;
using BuildingBlocks.Application;
using BuildingBlocks.Infrastructure;
using Sales.Domain;
using Catalog.Domain;
using Inventory.Domain;
using Inventory.Application;
using Parties.Domain;

namespace Sales.Application;

public class SalesService
{
    private readonly AppDbContext _dbContext;
    private readonly IExecutionContext _executionContext;

    public SalesService(AppDbContext dbContext, IExecutionContext executionContext)
    {
        _dbContext = dbContext;
        _executionContext = executionContext;
    }

    #region Sales Quotes (Orçamentos)

    public async Task<IReadOnlyList<SalesQuoteResponse>> ListQuotesAsync(
        Guid? branchId,
        SalesQuoteStatus? status,
        CancellationToken ct = default)
    {
        var query = _dbContext.SalesQuotes
            .Include(q => q.Items)
            .AsNoTracking();

        if (branchId.HasValue) query = query.Where(q => q.BranchId == branchId.Value);
        if (status.HasValue) query = query.Where(q => q.Status == status.Value);

        var list = await query.OrderByDescending(q => q.CreatedAtUtc).ToListAsync(ct);

        var customerIds = list.Where(q => q.CustomerPartyId.HasValue).Select(q => q.CustomerPartyId!.Value).Distinct().ToList();
        var customers = await _dbContext.Parties.Where(p => customerIds.Contains(p.Id)).ToDictionaryAsync(p => p.Id, ct);

        return list.Select(q => MapQuote(q, customers)).ToList();
    }

    public async Task<SalesQuoteResponse> GetQuoteByIdAsync(Guid id, CancellationToken ct = default)
    {
        var quote = await _dbContext.SalesQuotes
            .Include(q => q.Items)
            .FirstOrDefaultAsync(q => q.Id == id, ct);

        if (quote == null)
            throw new KeyNotFoundException($"Orçamento {id} não encontrado.");

        var customers = quote.CustomerPartyId.HasValue
            ? await _dbContext.Parties.Where(p => p.Id == quote.CustomerPartyId.Value).ToDictionaryAsync(p => p.Id, ct)
            : new Dictionary<Guid, Party>();

        return MapQuote(quote, customers);
    }

    public async Task<SalesQuoteResponse> CreateQuoteAsync(CreateSalesQuoteDto dto, CancellationToken ct = default)
    {
        var tenantId = _executionContext.TenantId;
        var userId = _executionContext.UserId;

        var exists = await _dbContext.SalesQuotes.AnyAsync(q => q.QuoteNumber == dto.QuoteNumber.Trim().ToUpperInvariant(), ct);
        if (exists)
            throw new InvalidOperationException($"Já existe um orçamento com o número '{dto.QuoteNumber}'.");

        if (dto.CustomerPartyId.HasValue)
        {
            var customerExists = await _dbContext.Parties.AnyAsync(p => p.Id == dto.CustomerPartyId.Value, ct);
            if (!customerExists)
                throw new KeyNotFoundException($"Cliente {dto.CustomerPartyId.Value} não encontrado.");
        }

        var quote = new SalesQuote(
            tenantId,
            dto.BranchId,
            dto.QuoteNumber,
            dto.CustomerPartyId,
            userId,
            dto.ValidUntilUtc,
            dto.PaymentTermsExpected,
            dto.ShippingTotal,
            dto.DiscountTotal,
            dto.Notes
        );

        foreach (var itemDto in dto.Items)
        {
            var sku = await _dbContext.ProductSkus
                .Include(s => s.ProductModel)
                .FirstOrDefaultAsync(s => s.Id == itemDto.ProductSkuId, ct);

            if (sku == null)
                throw new KeyNotFoundException($"SKU {itemDto.ProductSkuId} não encontrado.");

            var desc = $"{sku.ProductModel?.Name ?? "Produto"} - {sku.VariantName}";

            quote.AddItem(
                sku.Id,
                sku.SkuCode,
                desc,
                itemDto.Quantity,
                itemDto.UnitPrice,
                itemDto.Discount,
                itemDto.InventoryUnitId,
                itemDto.SerialOrImei
            );
        }

        _dbContext.SalesQuotes.Add(quote);
        await _dbContext.SaveChangesAsync(ct);

        return await GetQuoteByIdAsync(quote.Id, ct);
    }

    public async Task<SalesQuoteResponse> SendQuoteAsync(Guid id, CancellationToken ct = default)
    {
        var quote = await _dbContext.SalesQuotes.FirstOrDefaultAsync(q => q.Id == id, ct);
        if (quote == null) throw new KeyNotFoundException($"Orçamento {id} não encontrado.");

        quote.MarkSent();
        await _dbContext.SaveChangesAsync(ct);
        return await GetQuoteByIdAsync(id, ct);
    }

    public async Task<SalesQuoteResponse> AcceptQuoteAsync(Guid id, CancellationToken ct = default)
    {
        var quote = await _dbContext.SalesQuotes.FirstOrDefaultAsync(q => q.Id == id, ct);
        if (quote == null) throw new KeyNotFoundException($"Orçamento {id} não encontrado.");

        quote.MarkAccepted();
        await _dbContext.SaveChangesAsync(ct);
        return await GetQuoteByIdAsync(id, ct);
    }

    public async Task<SaleResponse> ConvertQuoteToSaleAsync(Guid quoteId, bool canViewCost, CancellationToken ct = default)
    {
        var quote = await _dbContext.SalesQuotes
            .Include(q => q.Items)
            .FirstOrDefaultAsync(q => q.Id == quoteId, ct);

        if (quote == null) throw new KeyNotFoundException($"Orçamento {quoteId} não encontrado.");

        var saleNumber = "VD-COT-" + Guid.NewGuid().ToString("N")[..6].ToUpperInvariant();
        var saleDto = new CreateSaleDto(
            quote.BranchId,
            quote.CustomerPartyId,
            saleNumber,
            ChargesTotal: quote.ShippingTotal,
            DiscountTotal: quote.DiscountTotal,
            Items: quote.Items.Select(i => new CreateSaleItemDto(
                i.ProductSkuId,
                i.Quantity,
                i.UnitPrice,
                i.Discount,
                i.InventoryUnitId,
                i.SerialOrImei,
                WarrantyDays: 90
            )).ToList(),
            Observations: $"Convertido do Orçamento #{quote.QuoteNumber}",
            IdempotencyKey: $"CONV_QUOTE_{quote.Id}"
        );

        var saleResponse = await CreateSaleAsync(saleDto, canViewCost, ct);

        quote.MarkConverted(saleResponse.Id);
        await _dbContext.SaveChangesAsync(ct);

        return saleResponse;
    }

    private static SalesQuoteResponse MapQuote(SalesQuote q, Dictionary<Guid, Party> customers)
    {
        Party? customer = null;
        if (q.CustomerPartyId.HasValue)
        {
            customers.TryGetValue(q.CustomerPartyId.Value, out customer);
        }

        var items = q.Items.Select(i => new SalesQuoteItemResponse(
            i.Id,
            i.ProductSkuId,
            i.HistoricalSkuCode,
            i.HistoricalDescription,
            i.Quantity,
            i.UnitPrice,
            i.Discount,
            i.TotalAmount,
            i.InventoryUnitId,
            i.SerialOrImei
        )).ToList();

        return new SalesQuoteResponse(
            q.Id,
            q.BranchId,
            q.QuoteNumber,
            q.CustomerPartyId,
            customer?.TradeName ?? customer?.Name,
            q.SellerUserId,
            q.Status,
            q.ValidUntilUtc,
            q.PaymentTermsExpected,
            q.Subtotal,
            q.ShippingTotal,
            q.DiscountTotal,
            q.GrandTotal,
            q.Notes,
            q.ConvertedSaleId,
            items,
            q.CreatedAtUtc,
            q.Version
        );
    }

    #endregion

    #region Sales & PDV Checkout

    public async Task<IReadOnlyList<SaleResponse>> ListSalesAsync(
        Guid? branchId,
        SaleStatus? status,
        SalePaymentStatus? paymentStatus,
        bool canViewCost,
        CancellationToken ct = default)
    {
        var query = _dbContext.Sales
            .Include(s => s.Items)
            .Include(s => s.Payments)
            .AsNoTracking();

        if (branchId.HasValue) query = query.Where(s => s.BranchId == branchId.Value);
        if (status.HasValue) query = query.Where(s => s.Status == status.Value);
        if (paymentStatus.HasValue) query = query.Where(s => s.PaymentStatus == paymentStatus.Value);

        var list = await query.OrderByDescending(s => s.CreatedAtUtc).ToListAsync(ct);

        var customerIds = list.Where(s => s.CustomerPartyId.HasValue).Select(s => s.CustomerPartyId!.Value).Distinct().ToList();
        var customers = await _dbContext.Parties.Where(p => customerIds.Contains(p.Id)).ToDictionaryAsync(p => p.Id, ct);

        return list.Select(s => MapSale(s, customers, canViewCost)).ToList();
    }

    public async Task<SaleResponse> GetSaleByIdAsync(Guid id, bool canViewCost, CancellationToken ct = default)
    {
        var sale = await _dbContext.Sales
            .Include(s => s.Items)
            .Include(s => s.Payments)
            .FirstOrDefaultAsync(s => s.Id == id, ct);

        if (sale == null) throw new KeyNotFoundException($"Venda {id} não encontrada.");

        var customers = sale.CustomerPartyId.HasValue
            ? await _dbContext.Parties.Where(p => p.Id == sale.CustomerPartyId.Value).ToDictionaryAsync(p => p.Id, ct)
            : new Dictionary<Guid, Party>();

        return MapSale(sale, customers, canViewCost);
    }

    public async Task<SaleResponse> CreateSaleAsync(CreateSaleDto dto, bool canViewCost, CancellationToken ct = default)
    {
        var tenantId = _executionContext.TenantId;
        var userId = _executionContext.UserId;

        // 1. Idempotência estrita
        if (!string.IsNullOrWhiteSpace(dto.IdempotencyKey))
        {
            var existing = await _dbContext.Sales
                .Include(s => s.Items)
                .Include(s => s.Payments)
                .FirstOrDefaultAsync(s => s.IdempotencyKey == dto.IdempotencyKey.Trim(), ct);

            if (existing != null)
            {
                return await GetSaleByIdAsync(existing.Id, canViewCost, ct);
            }
        }

        // 2. Unicidade de número de venda
        var existsNumber = await _dbContext.Sales.AnyAsync(s => s.SaleNumber == dto.SaleNumber.Trim().ToUpperInvariant(), ct);
        if (existsNumber)
            throw new InvalidOperationException($"Já existe uma venda com o número '{dto.SaleNumber}'.");

        if (dto.CustomerPartyId.HasValue)
        {
            var customerExists = await _dbContext.Parties.AnyAsync(p => p.Id == dto.CustomerPartyId.Value, ct);
            if (!customerExists)
                throw new KeyNotFoundException($"Cliente {dto.CustomerPartyId.Value} não encontrado.");
        }

        var sale = new Sale(
            tenantId,
            dto.BranchId,
            dto.SaleNumber,
            dto.CustomerPartyId,
            sellerUserId: userId,
            createdByUserId: userId,
            quoteId: null,
            chargesTotal: dto.ChargesTotal,
            discountTotal: dto.DiscountTotal,
            observations: dto.Observations,
            idempotencyKey: dto.IdempotencyKey
        );

        // 3. Processar itens, capturar custo histórico de saída e validar integridade
        foreach (var itemDto in dto.Items)
        {
            var sku = await _dbContext.ProductSkus
                .Include(s => s.ProductModel)
                .FirstOrDefaultAsync(s => s.Id == itemDto.ProductSkuId, ct);

            if (sku == null)
                throw new KeyNotFoundException($"SKU {itemDto.ProductSkuId} não encontrado.");

            decimal historicalCost = 0;
            var condition = ItemCondition.BrandNew;

            // Se for serializado
            if (sku.ProductModel?.SerializationPolicy == SerializationPolicy.StrictSerialized)
            {
                if (!itemDto.InventoryUnitId.HasValue)
                    throw new ArgumentException($"A unidade física (InventoryUnitId) é obrigatória para o produto serializado {sku.SkuCode}.");

                var unit = await _dbContext.InventoryUnits.FirstOrDefaultAsync(u => u.Id == itemDto.InventoryUnitId.Value, ct);
                if (unit == null)
                    throw new KeyNotFoundException($"Unidade física {itemDto.InventoryUnitId.Value} não encontrada.");

                if (unit.OperationalStatus != UnitOperationalStatus.ApprovedForSale)
                    throw new InvalidOperationException($"A unidade física '{unit.SerialNumber ?? unit.Imei1}' não está liberada para venda (Status: {unit.OperationalStatus}).");

                historicalCost = unit.AcquisitionCost;
                condition = unit.Condition;
            }
            else
            {
                // Obter custo médio do saldo materializado oficial do MOD-03
                var balance = await _dbContext.StockBalances
                    .FirstOrDefaultAsync(b => b.BranchId == dto.BranchId && b.ProductSkuId == sku.Id, ct);
                historicalCost = balance?.AverageCost ?? 0;
            }

            var desc = $"{sku.ProductModel?.Name ?? "Produto"} - {sku.VariantName}";

            sale.AddItem(
                sku.Id,
                sku.SkuCode,
                desc,
                condition,
                itemDto.Quantity,
                itemDto.UnitPrice,
                itemDto.Discount,
                historicalCost,
                itemDto.InventoryUnitId,
                itemDto.SerialOrImei,
                itemDto.WarrantyDays
            );
        }

        _dbContext.Sales.Add(sale);
        await _dbContext.SaveChangesAsync(ct);

        return await GetSaleByIdAsync(sale.Id, canViewCost, ct);
    }

    public async Task<SaleResponse> ReserveStockForSaleAsync(Guid saleId, Guid warehouseId, bool canViewCost, CancellationToken ct = default)
    {
        var tenantId = _executionContext.TenantId;
        var userId = _executionContext.UserId;

        var sale = await _dbContext.Sales
            .Include(s => s.Items)
            .FirstOrDefaultAsync(s => s.Id == saleId, ct);

        if (sale == null) throw new KeyNotFoundException($"Venda {saleId} não encontrada.");
        if (sale.Status != SaleStatus.Draft)
            throw new InvalidOperationException($"Apenas vendas em rascunho podem reservar estoque (Status atual: {sale.Status}).");

        // 1. Criar Reserva Atômica no MOD-03
        var reservationNumber = "RES-VD-" + Guid.NewGuid().ToString("N")[..6].ToUpperInvariant();
        var reservation = new StockReservation(
            tenantId,
            sale.BranchId,
            reservationNumber,
            $"Reserva para Venda #{sale.SaleNumber}",
            expiresAtUtc: DateTime.UtcNow.AddMinutes(30),
            documentReference: $"SALE:{sale.SaleNumber}"
        );

        foreach (var item in sale.Items)
        {
            // Validação de saldo disponível
            var balance = await _dbContext.StockBalances
                .FirstOrDefaultAsync(b => b.BranchId == sale.BranchId && b.WarehouseId == warehouseId && b.ProductSkuId == item.ProductSkuId, ct);

            if (balance == null || balance.AvailableQuantity < item.Quantity)
            {
                throw new InvalidOperationException($"Estoque insuficiente para o item {item.HistoricalSkuCode}. Disponível: {balance?.AvailableQuantity ?? 0}, Solicitado: {item.Quantity}.");
            }

            // Se for serializado, conferir se já não está reservada por outra transação
            if (item.InventoryUnitId.HasValue)
            {
                var isUnitReserved = await _dbContext.StockReservationItems
                    .AnyAsync(ri => ri.InventoryUnitId == item.InventoryUnitId.Value &&
                                    _dbContext.StockReservations.Any(r => r.Id == ri.StockReservationId &&
                                                                         r.Status == ReservationStatus.Active &&
                                                                         r.ExpiresAtUtc > DateTime.UtcNow), ct);

                if (isUnitReserved)
                {
                    throw new InvalidOperationException($"A unidade serializada {item.SerialOrImei ?? item.InventoryUnitId.Value.ToString()} já está reservada por outro atendimento comercial.");
                }
            }

            // Bloqueia no saldo
            balance.Reserve(item.Quantity);
            reservation.AddItem(warehouseId, null, item.ProductSkuId, item.Quantity, item.InventoryUnitId);
        }

        _dbContext.StockReservations.Add(reservation);
        sale.AssociateReservation(reservation.Id);

        await _dbContext.SaveChangesAsync(ct);
        return await GetSaleByIdAsync(sale.Id, canViewCost, ct);
    }

    public async Task<SalePaymentIntentResponse> RegisterPaymentIntentAsync(
        Guid saleId,
        AddPaymentIntentRequest req,
        CancellationToken ct = default)
    {
        var sale = await _dbContext.Sales
            .Include(s => s.Items)
            .Include(s => s.Payments)
            .FirstOrDefaultAsync(s => s.Id == saleId, ct);

        if (sale == null) throw new KeyNotFoundException($"Venda {saleId} não encontrada.");

        // Se o meio for Cash (Dinheiro) no balcão e já possuir autorização, já nasce confirmado operacionalmente
        var payment = sale.AddPaymentIntent(
            req.Method,
            req.Amount,
            req.AuthorizationCode,
            req.TransactionReference,
            req.Installments,
            req.Notes
        );

        if (req.Method == PaymentMethod.Cash && !string.IsNullOrWhiteSpace(req.AuthorizationCode))
        {
            payment.Confirm(req.AuthorizationCode, "BALCAO_DINHEIRO");
            sale.UpdatePaymentProgress();
        }

        _dbContext.Entry(payment).State = EntityState.Added;

        await _dbContext.SaveChangesAsync(ct);

        return new SalePaymentIntentResponse(
            payment.Id,
            payment.Method,
            payment.Amount,
            payment.Installments,
            payment.Status,
            payment.AuthorizationCode,
            payment.TransactionReference,
            payment.Notes,
            payment.ConfirmedAtUtc
        );
    }

    public async Task<SalePaymentIntentResponse> ConfirmPaymentIntentAsync(
        Guid saleId,
        Guid paymentId,
        ConfirmPaymentIntentRequest req,
        CancellationToken ct = default)
    {
        var sale = await _dbContext.Sales
            .Include(s => s.Items)
            .Include(s => s.Payments)
            .FirstOrDefaultAsync(s => s.Id == saleId, ct);

        if (sale == null) throw new KeyNotFoundException($"Venda {saleId} não encontrada.");

        var payment = sale.Payments.FirstOrDefault(p => p.Id == paymentId);
        if (payment == null) throw new KeyNotFoundException($"Intenção de pagamento {paymentId} não encontrada.");

        payment.Confirm(req.AuthorizationCode, req.TransactionReference);
        sale.UpdatePaymentProgress();

        await _dbContext.SaveChangesAsync(ct);

        return new SalePaymentIntentResponse(
            payment.Id,
            payment.Method,
            payment.Amount,
            payment.Installments,
            payment.Status,
            payment.AuthorizationCode,
            payment.TransactionReference,
            payment.Notes,
            payment.ConfirmedAtUtc
        );
    }

    public async Task<SaleResponse> CompleteSaleAndFulfillAsync(
        Guid saleId,
        Guid warehouseId,
        bool canViewCost,
        CancellationToken ct = default)
    {
        var tenantId = _executionContext.TenantId;
        var userId = _executionContext.UserId;

        var sale = await _dbContext.Sales
            .Include(s => s.Items)
            .Include(s => s.Payments)
            .FirstOrDefaultAsync(s => s.Id == saleId, ct);

        if (sale == null) throw new KeyNotFoundException($"Venda {saleId} não encontrada.");

        // 1. Validar quitação de pagamento e confirmar venda
        sale.ConfirmSale();

        // 2. Consumir reserva se houver, ou realizar baixa direta
        if (sale.StockReservationId.HasValue)
        {
            var reservation = await _dbContext.StockReservations
                .Include(r => r.Items)
                .FirstOrDefaultAsync(r => r.Id == sale.StockReservationId.Value, ct);

            if (reservation != null && reservation.Status == ReservationStatus.Active)
            {
                reservation.MarkConsumed();
                foreach (var rItem in reservation.Items)
                {
                    var balance = await _dbContext.StockBalances
                        .FirstOrDefaultAsync(b => b.BranchId == sale.BranchId && b.WarehouseId == warehouseId && b.ProductSkuId == rItem.ProductSkuId, ct);
                    if (balance != null)
                    {
                        balance.ReleaseReservation(rItem.Quantity);
                    }
                }
            }
        }

        // 3. Executar baixa no estoque e lançamento oficial no Kardex (StockMovementType.SaleIssue)
        foreach (var item in sale.Items)
        {
            var balance = await _dbContext.StockBalances
                .FirstOrDefaultAsync(b => b.BranchId == sale.BranchId && b.WarehouseId == warehouseId && b.ProductSkuId == item.ProductSkuId, ct);

            if (balance == null || balance.OnHandQuantity < item.Quantity)
            {
                throw new InvalidOperationException($"Estoque físico insuficiente no depósito para o item {item.HistoricalSkuCode}. Saldo: {balance?.OnHandQuantity ?? 0}.");
            }

            // Deduz do saldo OnHand
            balance.ApplyMovement(-item.Quantity, item.HistoricalUnitCost);

            // Se for serializado, marcar unidade física como vendida e remover posição serial
            if (item.InventoryUnitId.HasValue)
            {
                var unit = await _dbContext.InventoryUnits.FirstOrDefaultAsync(u => u.Id == item.InventoryUnitId.Value, ct);
                if (unit != null)
                {
                    unit.MarkSold();
                }

                var position = await _dbContext.SerialStockPositions.FirstOrDefaultAsync(p => p.InventoryUnitId == item.InventoryUnitId.Value, ct);
                if (position != null)
                {
                    _dbContext.SerialStockPositions.Remove(position);
                }
            }

            // Lançamento append-only no Kardex oficial
            var movement = new StockMovement(
                tenantId,
                sale.BranchId,
                warehouseId,
                warehouseLocationId: null,
                item.ProductSkuId,
                item.InventoryUnitId,
                StockMovementType.SaleIssue,
                quantity: -item.Quantity,
                unitCost: item.HistoricalUnitCost,
                balanceAfterQuantity: balance.OnHandQuantity,
                documentReference: $"SALE:{sale.SaleNumber}",
                reason: $"Venda ao consumidor #{sale.SaleNumber}",
                correlationId: sale.Id,
                idempotencyKey: $"SALE_OUT_{sale.Id}_{item.Id}",
                userId
            );

            _dbContext.StockMovements.Add(movement);
        }

        // 4. Marca como entregue/cumprida
        sale.MarkFulfilled();
        await _dbContext.SaveChangesAsync(ct);

        return await GetSaleByIdAsync(sale.Id, canViewCost, ct);
    }

    public async Task<SaleResponse> CancelSaleAsync(Guid saleId, string reason, bool canViewCost, CancellationToken ct = default)
    {
        var sale = await _dbContext.Sales
            .Include(s => s.Items)
            .Include(s => s.Payments)
            .FirstOrDefaultAsync(s => s.Id == saleId, ct);

        if (sale == null) throw new KeyNotFoundException($"Venda {saleId} não encontrada.");

        // Se houver reserva ativa, liberar estoque
        if (sale.StockReservationId.HasValue)
        {
            var reservation = await _dbContext.StockReservations
                .Include(r => r.Items)
                .FirstOrDefaultAsync(r => r.Id == sale.StockReservationId.Value, ct);

            if (reservation != null && reservation.Status == ReservationStatus.Active)
            {
                reservation.MarkReleased();
                foreach (var rItem in reservation.Items)
                {
                    var balance = await _dbContext.StockBalances
                        .FirstOrDefaultAsync(b => b.BranchId == sale.BranchId && b.ProductSkuId == rItem.ProductSkuId, ct);
                    if (balance != null)
                    {
                        balance.ReleaseReservation(rItem.Quantity);
                    }
                }
            }
        }

        sale.Cancel(reason);
        await _dbContext.SaveChangesAsync(ct);

        return await GetSaleByIdAsync(sale.Id, canViewCost, ct);
    }

    private static SaleResponse MapSale(Sale s, Dictionary<Guid, Party> customers, bool canViewCost)
    {
        Party? customer = null;
        if (s.CustomerPartyId.HasValue)
        {
            customers.TryGetValue(s.CustomerPartyId.Value, out customer);
        }

        var items = s.Items.Select(i => new SaleItemResponse(
            i.Id,
            i.ProductSkuId,
            i.HistoricalSkuCode,
            i.HistoricalDescription,
            i.ItemCondition,
            i.Quantity,
            i.UnitPrice,
            i.Discount,
            i.TotalAmount,
            canViewCost ? i.HistoricalUnitCost : null,
            canViewCost ? i.TotalCost : null,
            i.InventoryUnitId,
            i.SerialOrImei,
            i.WarrantyDays
        )).ToList();

        var payments = s.Payments.Select(p => new SalePaymentIntentResponse(
            p.Id,
            p.Method,
            p.Amount,
            p.Installments,
            p.Status,
            p.AuthorizationCode,
            p.TransactionReference,
            p.Notes,
            p.ConfirmedAtUtc
        )).ToList();

        decimal? totalCost = canViewCost ? s.Items.Sum(i => i.TotalCost) : null;
        decimal? profitMargin = canViewCost && s.GrandTotal > 0
            ? Math.Round(((s.GrandTotal - (totalCost ?? 0)) / s.GrandTotal) * 100, 2)
            : null;

        return new SaleResponse(
            s.Id,
            s.BranchId,
            s.SaleNumber,
            s.CustomerPartyId,
            customer?.TradeName ?? customer?.Name,
            s.SellerUserId,
            s.CreatedByUserId,
            s.QuoteId,
            s.StockReservationId,
            s.Status,
            s.PaymentStatus,
            s.FulfillmentStatus,
            s.Subtotal,
            s.ChargesTotal,
            s.DiscountTotal,
            s.GrandTotal,
            s.PaidTotal,
            s.BalanceRemaining,
            totalCost,
            profitMargin,
            s.Observations,
            s.IdempotencyKey,
            s.ConfirmedAtUtc,
            s.FulfilledAtUtc,
            s.CancelledAtUtc,
            items,
            payments,
            s.CreatedAtUtc,
            s.Version
        );
    }

    #endregion

    #region Sale Returns (Devoluções de Venda)

    public async Task<IReadOnlyList<SaleReturnResponse>> ListSaleReturnsAsync(Guid? branchId, CancellationToken ct = default)
    {
        var query = _dbContext.SaleReturns
            .Include(r => r.Items)
            .AsNoTracking();

        if (branchId.HasValue) query = query.Where(r => r.BranchId == branchId.Value);

        var list = await query.OrderByDescending(r => r.CreatedAtUtc).ToListAsync(ct);
        return list.Select(MapSaleReturn).ToList();
    }

    public async Task<SaleReturnResponse> CreateSaleReturnAsync(CreateSaleReturnDto dto, CancellationToken ct = default)
    {
        var tenantId = _executionContext.TenantId;
        var userId = _executionContext.UserId;

        var sale = await _dbContext.Sales
            .Include(s => s.Items)
            .FirstOrDefaultAsync(s => s.Id == dto.SaleId, ct);

        if (sale == null) throw new KeyNotFoundException($"Venda {dto.SaleId} não encontrada.");
        if (sale.Status != SaleStatus.Fulfilled)
            throw new InvalidOperationException("Apenas vendas finalizadas e entregues podem ser devolvidas.");

        var saleReturn = new SaleReturn(tenantId, dto.BranchId, dto.SaleId, dto.ReturnNumber, dto.Reason, userId);

        foreach (var itemDto in dto.Items)
        {
            var saleItem = sale.Items.FirstOrDefault(i => i.Id == itemDto.SaleItemId);
            if (saleItem == null)
                throw new KeyNotFoundException($"Item de venda {itemDto.SaleItemId} não pertence a esta venda.");

            saleReturn.AddItem(saleItem.Id, saleItem.ProductSkuId, itemDto.Quantity, itemDto.RefundAmount, itemDto.InventoryUnitId);
        }

        _dbContext.SaleReturns.Add(saleReturn);
        await _dbContext.SaveChangesAsync(ct);

        return MapSaleReturn(saleReturn);
    }

    public async Task<SaleReturnResponse> InspectAndRestockReturnAsync(
        Guid returnId,
        Guid warehouseId,
        string inspectionNotes,
        CancellationToken ct = default)
    {
        var tenantId = _executionContext.TenantId;
        var userId = _executionContext.UserId;

        var saleReturn = await _dbContext.SaleReturns
            .Include(r => r.Items)
            .FirstOrDefaultAsync(r => r.Id == returnId, ct);

        if (saleReturn == null) throw new KeyNotFoundException($"Devolução {returnId} não encontrada.");

        saleReturn.MarkInspectedAndRestocked(inspectionNotes);

        // Devolver peças ao saldo físico do estoque oficial do MOD-03
        foreach (var item in saleReturn.Items)
        {
            var balance = await _dbContext.StockBalances
                .FirstOrDefaultAsync(b => b.BranchId == saleReturn.BranchId && b.WarehouseId == warehouseId && b.ProductSkuId == item.ProductSkuId, ct);

            if (balance == null)
            {
                balance = new StockBalance(tenantId, saleReturn.BranchId, warehouseId, warehouseLocationId: null, item.ProductSkuId);
                _dbContext.StockBalances.Add(balance);
            }

            balance.ApplyMovement(item.Quantity, 0m);

            // Se for serializada, reativar unidade
            if (item.InventoryUnitId.HasValue)
            {
                var unit = await _dbContext.InventoryUnits.FirstOrDefaultAsync(u => u.Id == item.InventoryUnitId.Value, ct);
                if (unit != null)
                {
                    unit.ApproveForSale($"Reintegrado ao estoque após devolução #{saleReturn.ReturnNumber}");
                }

                var position = new SerialStockPosition(tenantId, item.InventoryUnitId.Value, item.ProductSkuId, saleReturn.BranchId, warehouseId, null);
                _dbContext.SerialStockPositions.Add(position);
            }

            // Entrada no Kardex oficial
            var movement = new StockMovement(
                tenantId,
                saleReturn.BranchId,
                warehouseId,
                warehouseLocationId: null,
                item.ProductSkuId,
                item.InventoryUnitId,
                StockMovementType.PositiveAdjustment,
                quantity: item.Quantity,
                unitCost: 0m,
                balanceAfterQuantity: balance.OnHandQuantity,
                documentReference: $"RETURN:{saleReturn.ReturnNumber}",
                reason: $"Retorno ao estoque por devolução de venda: {saleReturn.Reason}",
                correlationId: saleReturn.Id,
                idempotencyKey: $"RETURN_RESTOCK_{saleReturn.Id}_{item.Id}",
                userId
            );

            _dbContext.StockMovements.Add(movement);
        }

        await _dbContext.SaveChangesAsync(ct);
        return MapSaleReturn(saleReturn);
    }

    private static SaleReturnResponse MapSaleReturn(SaleReturn r)
    {
        var items = r.Items.Select(i => new SaleReturnItemResponse(
            i.Id,
            i.SaleItemId,
            i.ProductSkuId,
            null,
            i.Quantity,
            i.RefundAmount,
            i.InventoryUnitId
        )).ToList();

        return new SaleReturnResponse(
            r.Id,
            r.BranchId,
            r.SaleId,
            r.ReturnNumber,
            r.Reason,
            r.Status,
            r.InspectionNotes,
            r.TotalRefundAmount,
            r.CreatedByUserId,
            items,
            r.CreatedAtUtc,
            r.Version
        );
    }

    #endregion
}
