using System.Net;
using System.Net.Http.Json;
using System.Text.Json;
using BuildingBlocks.Domain;
using FleetLogistics.Application.DTOs;
using FleetLogistics.Domain.Entities;
using FluentAssertions;
using Microsoft.AspNetCore.Mvc.Testing;
using Xunit;

namespace BuildingBlocks.UnitTests;

public class FleetLogisticsAndPricingIntegrationTests : IClassFixture<WebApplicationFactory<Program>>
{
    private readonly WebApplicationFactory<Program> _factory;
    private readonly BuildingBlocks.Security.JwtTokenService _jwtTokenService;

    public FleetLogisticsAndPricingIntegrationTests(WebApplicationFactory<Program> factory)
    {
        _factory = factory;
        _jwtTokenService = new BuildingBlocks.Security.JwtTokenService(
            "HBStudioEnterpriseErpSuperSecretKey20261113!",
            "HBStudioErp",
            "HBStudioErpClient");
    }

    private HttpClient CreateAuthenticatedClient(Guid tenantId, Guid userId, params string[] permissions)
    {
        var tokenResponse = _jwtTokenService.GenerateToken(
            tenantId,
            Guid.NewGuid(),
            userId,
            "fleet.tester@hbstudio.com",
            permissions);

        var client = _factory.CreateClient();
        client.DefaultRequestHeaders.Authorization = new System.Net.Http.Headers.AuthenticationHeaderValue("Bearer", tokenResponse.AccessToken);
        return client;
    }

    [Fact]
    public async Task Vehicle_Registration_And_Trip_DistanceCalculation_Succeeds()
    {
        var tenantId = Guid.NewGuid();
        var branchId = Guid.NewGuid();
        var userId = Guid.NewGuid();

        var client = CreateAuthenticatedClient(tenantId, userId,
            PermissionCatalog.FleetView,
            PermissionCatalog.FleetVehiclesManage,
            PermissionCatalog.FleetTripsCreate,
            PermissionCatalog.FleetTripsClose);

        // 1. Cadastrar veículo
        var vehicleReq = new CreateVehicleRequest(
            InternalCode: $"CAR-{Guid.NewGuid().ToString()[..4].ToUpperInvariant()}",
            Plate: $"BRA{new Random().Next(1000, 9999)}",
            Brand: "Fiat",
            Model: "Mobi Like 1.0",
            Year: 2024,
            Type: VehicleType.Car,
            Ownership: VehicleOwnership.CompanyOwned,
            Fuel: FuelType.Flex,
            InitialOdometerKm: 45200m,
            AverageConsumptionKmPerLiter: 14.5m
        );

        var vehicleRes = await client.PostAsJsonAsync("/api/fleet/vehicles", vehicleReq);
        vehicleRes.StatusCode.Should().Be(HttpStatusCode.Created);
        var vContent = await vehicleRes.Content.ReadAsStringAsync();
        var vehicleDoc = JsonDocument.Parse(vContent);
        var vehicleId = vehicleDoc.RootElement.GetProperty("id").GetGuid();
        var vehicleOdometer = vehicleDoc.RootElement.GetProperty("currentOdometerKm").GetDecimal();
        vehicleOdometer.Should().Be(45200m);

        // 2. Criar Viagem para buscar aparelho em outra cidade
        var tripReq = new CreateTripRequest(
            TripNumber: $"TRIP-{Guid.NewGuid().ToString()[..6].ToUpperInvariant()}",
            VehicleId: vehicleId,
            DriverUserId: userId,
            DriverName: "Lucas Condutor",
            Purpose: TripPurpose.ProcurementPickup,
            OriginCity: "São Paulo",
            DestinationCity: "Campinas",
            InitialOdometerKm: 45200m,
            StartTimeUtc: DateTime.UtcNow,
            Description: "Viagem para retirada de lote de iPhones usados"
        );

        var tripRes = await client.PostAsJsonAsync("/api/fleet/trips", tripReq);
        if (!tripRes.IsSuccessStatusCode)
        {
            var err = await tripRes.Content.ReadAsStringAsync();
            throw new Exception($"Trip creation failed: {tripRes.StatusCode} - {err}");
        }
        tripRes.StatusCode.Should().Be(HttpStatusCode.Created);
        var tripDoc = JsonDocument.Parse(await tripRes.Content.ReadAsStringAsync());
        var tripId = tripDoc.RootElement.GetProperty("id").GetGuid();
        tripDoc.RootElement.GetProperty("status").GetInt32().Should().Be((int)TripStatus.InProgress);

        // 3. Concluir Viagem com 100 km rodados (Hodômetro 45.300 km)
        var completeReq = new CompleteTripRequest(
            FinalOdometerKm: 45300m,
            EndTimeUtc: DateTime.UtcNow.AddHours(2),
            CompletionNotes: "Viagem finalizada com sucesso. Aparelhos coletados."
        );

        var completeRes = await client.PostAsJsonAsync($"/api/fleet/trips/{tripId}/complete", completeReq);
        completeRes.StatusCode.Should().Be(HttpStatusCode.OK);
        var completedTripDoc = JsonDocument.Parse(await completeRes.Content.ReadAsStringAsync());
        completedTripDoc.RootElement.GetProperty("status").GetInt32().Should().Be((int)TripStatus.Completed);
        completedTripDoc.RootElement.GetProperty("distanceKm").GetDecimal().Should().Be(100m); // Distância = 45300 - 45200 = 100 km

        // Verificar que o veículo foi atualizado para 45.300 km e status Available
        var vehicleCheckRes = await client.GetAsync($"/api/fleet/vehicles/{vehicleId}");
        var updatedVehicleDoc = JsonDocument.Parse(await vehicleCheckRes.Content.ReadAsStringAsync());
        updatedVehicleDoc.RootElement.GetProperty("currentOdometerKm").GetDecimal().Should().Be(45300m);
        updatedVehicleDoc.RootElement.GetProperty("status").GetInt32().Should().Be((int)VehicleStatus.Available);
    }

    [Fact]
    public async Task Fueling_R50_WithoutLiters_And_WithLiters_CalculatesPricePerLiter_Correctly()
    {
        var tenantId = Guid.NewGuid();
        var branchId = Guid.NewGuid();
        var userId = Guid.NewGuid();

        var client = CreateAuthenticatedClient(tenantId, userId,
            PermissionCatalog.FleetView,
            PermissionCatalog.FleetVehiclesManage,
            PermissionCatalog.FleetFuelingCreate);

        // 1. Criar veículo
        var vehicleReq = new CreateVehicleRequest(
            InternalCode: $"CAR-{Guid.NewGuid().ToString()[..4].ToUpperInvariant()}",
            Plate: $"BRA{new Random().Next(1000, 9999)}",
            Brand: "Chevrolet",
            Model: "Onix Plus 1.0",
            Year: 2023,
            Type: VehicleType.Car,
            Ownership: VehicleOwnership.CompanyOwned,
            Fuel: FuelType.Gasoline,
            InitialOdometerKm: 20000m
        );
        var vRes = await client.PostAsJsonAsync("/api/fleet/vehicles", vehicleReq);
        var vDoc = JsonDocument.Parse(await vRes.Content.ReadAsStringAsync());
        var vehicleId = vDoc.RootElement.GetProperty("id").GetGuid();

        // 2. Abastecimento R$ 50 SEM litros informados (apenas valor)
        var f1Req = new CreateFuelingRequest(
            VehicleId: vehicleId,
            FuelingDateUtc: DateTime.UtcNow,
            GasStationName: "Posto Ipiranga Centro",
            Fuel: FuelType.Gasoline,
            TotalAmount: 50.00m,
            OdometerKm: 20050m,
            PaymentMethod: PaymentMethodCategory.CompanyPix,
            Liters: null // Condutor só colocou R$ 50
        );

        var f1Res = await client.PostAsJsonAsync("/api/fleet/fuelings", f1Req);
        f1Res.StatusCode.Should().Be(HttpStatusCode.Created);
        var f1Doc = JsonDocument.Parse(await f1Res.Content.ReadAsStringAsync());
        f1Doc.RootElement.GetProperty("totalAmount").GetDecimal().Should().Be(50.00m);
        f1Doc.RootElement.GetProperty("liters").ValueKind.Should().Be(JsonValueKind.Null);
        f1Doc.RootElement.GetProperty("pricePerLiter").ValueKind.Should().Be(JsonValueKind.Null); // Sem inventar litros fictícios
        f1Doc.RootElement.GetProperty("financialStatus").GetInt32().Should().Be((int)FinancialStatus.Settled);

        // 3. Abastecimento COM litros informados (R$ 100 / 20 Litros = R$ 5,00/L)
        var f2Req = new CreateFuelingRequest(
            VehicleId: vehicleId,
            FuelingDateUtc: DateTime.UtcNow,
            GasStationName: "Posto Shell Rodovia",
            Fuel: FuelType.Gasoline,
            TotalAmount: 100.00m,
            OdometerKm: 20250m,
            PaymentMethod: PaymentMethodCategory.InvoicedPayLater, // Faturado para pagar depois
            Liters: 20.0m
        );

        var f2Res = await client.PostAsJsonAsync("/api/fleet/fuelings", f2Req);
        f2Res.StatusCode.Should().Be(HttpStatusCode.Created);
        var f2Doc = JsonDocument.Parse(await f2Res.Content.ReadAsStringAsync());
        f2Doc.RootElement.GetProperty("totalAmount").GetDecimal().Should().Be(100.00m);
        f2Doc.RootElement.GetProperty("liters").GetDecimal().Should().Be(20.0m);
        f2Doc.RootElement.GetProperty("pricePerLiter").GetDecimal().Should().Be(5.0000m);
        f2Doc.RootElement.GetProperty("financialStatus").GetInt32().Should().Be((int)FinancialStatus.PayablePending); // Título gerado no Contas a Pagar
        f2Doc.RootElement.GetProperty("accountPayableId").ValueKind.Should().NotBe(JsonValueKind.Null);
    }

    [Fact]
    public async Task Maintenance_OilChange_Evaluation_And_Execution_Updates_Plan_Properly()
    {
        var tenantId = Guid.NewGuid();
        var branchId = Guid.NewGuid();
        var userId = Guid.NewGuid();

        var client = CreateAuthenticatedClient(tenantId, userId,
            PermissionCatalog.FleetView,
            PermissionCatalog.FleetVehiclesManage,
            PermissionCatalog.FleetMaintenanceView,
            PermissionCatalog.FleetMaintenanceManage,
            PermissionCatalog.FleetMaintenanceComplete);

        // 1. Criar Veículo com 50.000 km
        var vehicleReq = new CreateVehicleRequest(
            InternalCode: $"CAR-{Guid.NewGuid().ToString()[..4].ToUpperInvariant()}",
            Plate: $"BRA{new Random().Next(1000, 9999)}",
            Brand: "Fiat",
            Model: "Strada 1.3",
            Year: 2024,
            Type: VehicleType.Utility,
            Ownership: VehicleOwnership.CompanyOwned,
            Fuel: FuelType.Flex,
            InitialOdometerKm: 50000m
        );
        var vRes = await client.PostAsJsonAsync("/api/fleet/vehicles", vehicleReq);
        var vDoc = JsonDocument.Parse(await vRes.Content.ReadAsStringAsync());
        var vehicleId = vDoc.RootElement.GetProperty("id").GetGuid();

        // 2. Criar Plano de Troca de Óleo (Intervalo 10.000 km ou 180 dias)
        var planReq = new CreateMaintenancePlanRequest(
            VehicleId: vehicleId,
            PlanName: "Troca de Óleo e Filtro 10k",
            RecommendedIntervalKm: 10000,
            RecommendedIntervalDays: 180,
            LastServiceOdometerKm: 50000m,
            LastServiceDateUtc: DateTime.UtcNow,
            OilSpecification: "5W30 Sintético"
        );

        var planRes = await client.PostAsJsonAsync("/api/fleet/maintenance-plans", planReq);
        planRes.StatusCode.Should().Be(HttpStatusCode.Created);
        var planDoc = JsonDocument.Parse(await planRes.Content.ReadAsStringAsync());
        var planId = planDoc.RootElement.GetProperty("id").GetGuid();
        planDoc.RootElement.GetProperty("nextServiceOdometerKm").GetDecimal().Should().Be(60000m);

        // 3. Registrar serviço mecânico real aos 60.000 km
        var serviceReq = new CreateMaintenanceServiceRequest(
            VehicleId: vehicleId,
            Type: MaintenanceType.OilAndFilterChange,
            ServiceDateUtc: DateTime.UtcNow,
            OdometerKm: 60000m,
            WorkshopName: "Auto Mecânica Central",
            Description: "Troca de óleo motor 5W30 + Filtro de óleo e anel",
            PartsCost: 220.00m,
            LaborCost: 80.00m,
            PaymentMethod: PaymentMethodCategory.CompanyPix,
            MaintenancePlanId: planId,
            FilterReplaced: true
        );

        var serviceRes = await client.PostAsJsonAsync("/api/fleet/maintenance-services", serviceReq);
        serviceRes.StatusCode.Should().Be(HttpStatusCode.Created);
        var sDoc = JsonDocument.Parse(await serviceRes.Content.ReadAsStringAsync());
        sDoc.RootElement.GetProperty("totalCost").GetDecimal().Should().Be(300.00m); // 220 + 80 = 300

        // 4. Verificar se o plano foi recalculado para a próxima aos 70.000 km
        var checkPlansRes = await client.GetAsync($"/api/fleet/maintenance-plans?vehicleId={vehicleId}");
        var plansDoc = JsonDocument.Parse(await checkPlansRes.Content.ReadAsStringAsync());
        var firstPlan = plansDoc.RootElement.EnumerateArray().First(p => p.GetProperty("id").GetGuid() == planId);
        firstPlan.GetProperty("lastServiceOdometerKm").GetDecimal().Should().Be(60000m);
        firstPlan.GetProperty("nextServiceOdometerKm").GetDecimal().Should().Be(70000m);
    }

    [Fact]
    public async Task EndToEnd_Trip_Allocation_To_Acquired_Device_And_Price_Suggestion_Workflow()
    {
        var tenantId = Guid.NewGuid();
        var branchId = Guid.NewGuid();
        var userId = Guid.NewGuid();

        var client = CreateAuthenticatedClient(tenantId, userId,
            PermissionCatalog.FleetView,
            PermissionCatalog.FleetVehiclesManage,
            PermissionCatalog.FleetTripsCreate,
            PermissionCatalog.FleetTripsClose,
            PermissionCatalog.FleetFuelingCreate,
            PermissionCatalog.FleetCostView,
            PermissionCatalog.FleetAllocationsManage,
            PermissionCatalog.PricingView,
            PermissionCatalog.PricingPoliciesManage,
            PermissionCatalog.PricingSuggestionsGenerate,
            PermissionCatalog.PricingSuggestionsView,
            PermissionCatalog.PricingApprove,
            PermissionCatalog.CatalogProductsView,
            PermissionCatalog.CatalogProductsManage);

        // 1. Cadastrar Política Comercial de Precificação (15% desconto-alvo, 30% markup, 5% frete retirada, 10% frete entrega)
        var policyReq = new CreatePricingPolicyRequest(
            Name: "Política Comercial iPhones Usados",
            Scope: PricingPolicyScope.GlobalTenant,
            TargetAcquisitionDiscountRate: 0.15m, // 15%
            TargetMarkupRate: 0.30m,              // 30%
            TargetMinMarginRate: 0.15m,           // 15%
            EstimatedPickupLogisticsRate: 0.05m,  // 5%
            EstimatedDeliveryLogisticsRate: 0.10m,// 10%
            OtherCommercialCostRate: 0.03m,       // 3%
            RoundingRule: PricingRoundingRule.EndWithNineZero,
            PreferRealCostOverEstimate: true
        );

        var policyRes = await client.PostAsJsonAsync("/api/pricing/policies", policyReq);
        policyRes.StatusCode.Should().Be(HttpStatusCode.Created);
        var policy = await policyRes.Content.ReadFromJsonAsync<ProductPricingPolicy>();
        policy.Should().NotBeNull();

        // 2. Cadastrar Veículo e Viagem
        var vehicleReq = new CreateVehicleRequest(
            InternalCode: $"CAR-{Guid.NewGuid().ToString()[..4].ToUpperInvariant()}",
            Plate: $"BRA{new Random().Next(1000, 9999)}",
            Brand: "Fiat",
            Model: "Mobi",
            Year: 2024,
            Type: VehicleType.Car,
            Ownership: VehicleOwnership.CompanyOwned,
            Fuel: FuelType.Gasoline,
            InitialOdometerKm: 10000m
        );
        var vRes = await client.PostAsJsonAsync("/api/fleet/vehicles", vehicleReq);
        var vDoc = JsonDocument.Parse(await vRes.Content.ReadAsStringAsync());
        var vehicleId = vDoc.RootElement.GetProperty("id").GetGuid();

        var tripReq = new CreateTripRequest(
            TripNumber: $"TRIP-{Guid.NewGuid().ToString()[..6].ToUpperInvariant()}",
            VehicleId: vehicleId,
            DriverUserId: userId,
            DriverName: "Henrique",
            Purpose: TripPurpose.ProcurementPickup,
            OriginCity: "Florianópolis",
            DestinationCity: "Joinville",
            InitialOdometerKm: 10000m,
            StartTimeUtc: DateTime.UtcNow,
            Description: "Viagem para buscar iPhone anunciado por R$ 1.000,00"
        );
        var tripRes = await client.PostAsJsonAsync("/api/fleet/trips", tripReq);
        var tripDoc = JsonDocument.Parse(await tripRes.Content.ReadAsStringAsync());
        var tripId = tripDoc.RootElement.GetProperty("id").GetGuid();

        // 3. Registrar Abastecimento de R$ 50,00 vinculado à viagem
        var fuelingReq = new CreateFuelingRequest(
            VehicleId: vehicleId,
            TripId: tripId,
            FuelingDateUtc: DateTime.UtcNow,
            GasStationName: "Posto BR Rodovia",
            Fuel: FuelType.Gasoline,
            TotalAmount: 50.00m,
            OdometerKm: 10050m,
            PaymentMethod: PaymentMethodCategory.CompanyPix
        );
        var fRes = await client.PostAsJsonAsync("/api/fleet/fuelings", fuelingReq);
        fRes.StatusCode.Should().Be(HttpStatusCode.Created);

        // Concluir viagem com 100 km rodados
        await client.PostAsJsonAsync($"/api/fleet/trips/{tripId}/complete", new CompleteTripRequest(
            FinalOdometerKm: 10100m,
            EndTimeUtc: DateTime.UtcNow.AddHours(2)
        ));

        // 4. Ratear Custo do Frete Real para a Unidade do Celular (R$ 42,00 do frete alocado)
        var skuId = Guid.NewGuid();
        var unitId = Guid.NewGuid();
        var allocReq = new AllocateTripCostRequest(
            TripId: tripId,
            TargetType: AllocationTargetType.UsedDeviceAcquisition,
            TargetId: unitId,
            TargetReference: "IMEI-354891828374651",
            AllocatedAmount: 42.00m,
            Method: AllocationMethod.ManualSpecified,
            AllocationPercentage: 0.84m, // 42 de 50 = 84%
            InventoryUnitId: unitId,
            ProductSkuId: skuId,
            Justification: "Custo de deslocamento apurado para captação do aparelho"
        );

        var allocRes = await client.PostAsJsonAsync("/api/fleet/allocations", allocReq);
        allocRes.StatusCode.Should().Be(HttpStatusCode.Created);

        // 5. Motor de Precificação Inteligente: Gerar Sugestão de Preço para o iPhone (Preço Anunciado R$ 1.000, Compra R$ 1.000)
        var suggestionReq = new GeneratePriceSuggestionRequest(
            ProductSkuId: skuId,
            ReferencePrice: 1000.00m,
            RealAcquisitionCost: 1000.00m,
            InventoryUnitId: unitId
        );

        var sugRes = await client.PostAsJsonAsync("/api/pricing/suggestions/generate", suggestionReq);
        sugRes.StatusCode.Should().Be(HttpStatusCode.OK);
        var sugDoc = JsonDocument.Parse(await sugRes.Content.ReadAsStringAsync());
        var suggestionId = sugDoc.RootElement.GetProperty("id").GetGuid();

        // Verificações Matemáticas Autoritativas:
        // - Desconto-alvo de 15%: Proposta de compra sugerida = R$ 850,00
        sugDoc.RootElement.GetProperty("targetNegotiationPrice").GetDecimal().Should().Be(850.00m);
        // - Custo real pago preservado: R$ 1.000,00
        sugDoc.RootElement.GetProperty("realAcquisitionCost").GetDecimal().Should().Be(1000.00m);
        // - Frete real alocado utilizado (substitui estimativa conforme PreferRealCostOverEstimate): R$ 42,00
        sugDoc.RootElement.GetProperty("allocatedLogisticsCost").GetDecimal().Should().Be(42.00m);
        // - Provisões comerciais adicionais (10% entrega + 3% taxas sobre R$ 1.000): R$ 130,00
        sugDoc.RootElement.GetProperty("commercialProvisions").GetDecimal().Should().Be(130.00m);
        // - Base de Custo Total = 1000 + 42 + 130 = R$ 1.172,00
        sugDoc.RootElement.GetProperty("totalCostBase").GetDecimal().Should().Be(1172.00m);
        // - Preço Sugerido com 30% Markup = 1172 * 1.30 = 1523.60 -> Arredondado para ,90 = R$ 1.523,90
        sugDoc.RootElement.GetProperty("calculatedSuggestedPrice").GetDecimal().Should().Be(1523.90m);
        // - Desconto máximo de balcão de 5% sobre 1523.90 = R$ 1.447,70 (respeita margem e não confunde com os 15% de compra)
        sugDoc.RootElement.GetProperty("maxCounterDiscountPrice").GetDecimal().Should().Be(1447.70m);
        sugDoc.RootElement.GetProperty("status").GetInt32().Should().Be((int)PriceApprovalStatus.PendingApproval);

        // 6. Aprovação Comercial do Preço pelo Sócio
        var approveRes = await client.PostAsJsonAsync($"/api/pricing/suggestions/{suggestionId}/approve", new ApprovePriceSuggestionRequest(
            CustomApprovedPrice: 1523.90m,
            ApprovalNotes: "Preço de venda aprovado conforme margem de 30% e frete real de Joinville"
        ));
        approveRes.StatusCode.Should().Be(HttpStatusCode.OK);
        var approvedDoc = JsonDocument.Parse(await approveRes.Content.ReadAsStringAsync());
        approvedDoc.RootElement.GetProperty("status").GetInt32().Should().Be((int)PriceApprovalStatus.Approved);
        approvedDoc.RootElement.GetProperty("approvedFinalPrice").GetDecimal().Should().Be(1523.90m);
    }
}
