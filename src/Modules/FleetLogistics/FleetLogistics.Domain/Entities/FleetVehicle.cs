using BuildingBlocks.Domain;

namespace FleetLogistics.Domain.Entities;

public enum VehicleType
{
    Car = 1,          // Carro de passeio / Sedan / Hatch
    Motorcycle = 2,   // Motocicleta / Scooter (entregas expressas)
    Utility = 3,      // Utilitário / Fiorino / Kangoo
    Van = 4,          // Van / Carga leve
    Truck = 5         // Caminhão / Carga pesada
}

public enum VehicleOwnership
{
    CompanyOwned = 1,   // Veículo oficial da HB Studio (Ativo imobilizado da empresa)
    PartnerOwned = 2,   // Veículo particular de Sócio (Gera reembolso de combustível/deslocamento, sem depreciação contábil da empresa)
    EmployeeOwned = 3,  // Veículo de colaborador (Reembolso de km rodado ou combustível)
    Rented = 4,         // Veículo locado (Custo de locação operacional)
    ThirdParty = 5      // Terceirizado / Freteiro avulso
}

public enum VehicleStatus
{
    Available = 1,      // Disponível para novas viagens
    InUse = 2,          // Em viagem / trânsito
    Maintenance = 3,    // Em oficina mecânica / revisão
    Inactive = 4,       // Temporariamente inativo
    OutOfService = 5    // Baixado / Desativado permanentemente
}

public enum FuelType
{
    Gasoline = 1,
    Ethanol = 2,
    Flex = 3,
    Diesel = 4,
    Electric = 5,
    Hybrid = 6
}

/// <summary>
/// Veículo de frota / transporte utilizado nas operações da HB Studio.
/// </summary>
public class FleetVehicle : TenantEntity
{
    public Guid BranchId { get; private set; }
    public string InternalCode { get; private set; } // Ex: "CAR-01", "MOTO-01"
    public string Plate { get; private set; }        // Ex: "BRA2E19"
    public string Brand { get; private set; }        // Ex: "Fiat", "Chevrolet", "Honda"
    public string Model { get; private set; }        // Ex: "Strada 1.3", "Mobi Like", "CG 160"
    public int Year { get; private set; }
    public VehicleType Type { get; private set; }
    public VehicleOwnership Ownership { get; private set; }
    public FuelType Fuel { get; private set; }
    public decimal? TankCapacityLiters { get; private set; }
    public decimal InitialOdometerKm { get; private set; }
    public decimal CurrentOdometerKm { get; private set; }
    public decimal? AverageConsumptionKmPerLiter { get; private set; }
    public Guid? OwnerPartnerId { get; private set; } // Vinculado a PartnersCapital se PartnerOwned
    public string? ResponsibleName { get; private set; }
    public VehicleStatus Status { get; private set; }
    public DateTime UtilizationStartDateUtc { get; private set; }
    public string? Notes { get; private set; }

    private FleetVehicle()
    {
        InternalCode = string.Empty;
        Plate = string.Empty;
        Brand = string.Empty;
        Model = string.Empty;
    }

    public FleetVehicle(
        Guid tenantId,
        Guid branchId,
        string internalCode,
        string plate,
        string brand,
        string model,
        int year,
        VehicleType type,
        VehicleOwnership ownership,
        FuelType fuel,
        decimal initialOdometerKm,
        decimal? tankCapacityLiters = null,
        decimal? averageConsumptionKmPerLiter = null,
        Guid? ownerPartnerId = null,
        string? responsibleName = null,
        string? notes = null) : base(tenantId)
    {
        if (string.IsNullOrWhiteSpace(internalCode))
            throw new ArgumentException("Código interno do veículo é obrigatório.", nameof(internalCode));
        if (string.IsNullOrWhiteSpace(plate))
            throw new ArgumentException("Placa do veículo é obrigatória.", nameof(plate));
        if (string.IsNullOrWhiteSpace(brand))
            throw new ArgumentException("Marca é obrigatória.", nameof(brand));
        if (string.IsNullOrWhiteSpace(model))
            throw new ArgumentException("Modelo é obrigatório.", nameof(model));
        if (initialOdometerKm < 0)
            throw new ArgumentException("Hodômetro inicial não pode ser negativo.", nameof(initialOdometerKm));

        BranchId = branchId;
        InternalCode = internalCode.Trim().ToUpperInvariant();
        Plate = plate.Trim().ToUpperInvariant();
        Brand = brand.Trim();
        Model = model.Trim();
        Year = year;
        Type = type;
        Ownership = ownership;
        Fuel = fuel;
        InitialOdometerKm = initialOdometerKm;
        CurrentOdometerKm = initialOdometerKm;
        TankCapacityLiters = tankCapacityLiters;
        AverageConsumptionKmPerLiter = averageConsumptionKmPerLiter;
        OwnerPartnerId = ownerPartnerId;
        ResponsibleName = responsibleName?.Trim();
        Status = VehicleStatus.Available;
        UtilizationStartDateUtc = DateTime.UtcNow;
        Notes = notes?.Trim();
    }

    public void UpdateCurrentOdometer(decimal newOdometerKm)
    {
        if (newOdometerKm < CurrentOdometerKm)
            throw new InvalidOperationException($"Hodômetro novo ({newOdometerKm} km) não pode ser menor que o atual ({CurrentOdometerKm} km). Para correções use o procedimento formal de ajuste.");

        CurrentOdometerKm = newOdometerKm;
    }

    public void CorrectOdometerFormal(decimal correctedOdometerKm, string reason, Guid userId)
    {
        if (correctedOdometerKm < 0)
            throw new ArgumentException("Hodômetro corrigido não pode ser negativo.", nameof(correctedOdometerKm));
        if (string.IsNullOrWhiteSpace(reason))
            throw new ArgumentException("Justificativa é obrigatória para correção formal de hodômetro.", nameof(reason));

        CurrentOdometerKm = correctedOdometerKm;
        Notes = string.IsNullOrWhiteSpace(Notes)
            ? $"Correção formal hodômetro em {DateTime.UtcNow:yyyy-MM-dd HH:mm}: {reason.Trim()} por User {userId}"
            : $"{Notes} | Correção hodômetro ({DateTime.UtcNow:yyyy-MM-dd}): {reason.Trim()}";
    }

    public void SetStatus(VehicleStatus newStatus)
    {
        Status = newStatus;
    }

    public void UpdateDetails(
        string brand,
        string model,
        decimal? tankCapacityLiters,
        decimal? averageConsumptionKmPerLiter,
        string? responsibleName,
        string? notes)
    {
        Brand = brand.Trim();
        Model = model.Trim();
        TankCapacityLiters = tankCapacityLiters;
        AverageConsumptionKmPerLiter = averageConsumptionKmPerLiter;
        ResponsibleName = responsibleName?.Trim();
        Notes = notes?.Trim();
    }
}
