using BuildingBlocks.Domain;

namespace FleetLogistics.Domain.Entities;

public enum TripStatus
{
    Draft = 1,
    Planned = 2,
    InProgress = 3,
    Completed = 4,
    Cancelled = 5,
    UnderReview = 6
}

public enum TripPurpose
{
    ProcurementPickup = 1,      // Buscar mercadoria / celulares usados de fornecedor ou pessoa física
    SalesDelivery = 2,          // Entregar venda / entrega técnica
    RepairServiceTransport = 3, // Retirada ou devolução de aparelho de assistência técnica
    ClientVisit = 4,            // Visita comercial / prospecção CRM
    DigitalProjectService = 5,  // Atendimento técnico / implantação de software
    ManufacturingDelivery = 6,  // Transporte de insumos ou peças 3D
    Administrative = 7,         // Atividade de cartório, banco, compras gerais
    MixedPurpose = 8            // Múltiplas finalidades
}

/// <summary>
/// Deslocamento / Viagem realizada com veículo para atendimento operacional ou comercial.
/// </summary>
public class FleetTrip : TenantEntity
{
    public Guid BranchId { get; private set; }
    public string TripNumber { get; private set; } // Ex: "TRIP-2026-0001"
    public Guid VehicleId { get; private set; }
    public FleetVehicle? Vehicle { get; private set; }
    public Guid DriverUserId { get; private set; }
    public string DriverName { get; private set; }
    public TripPurpose Purpose { get; private set; }
    public string OriginCity { get; private set; }
    public string DestinationCity { get; private set; }
    public string? Description { get; private set; }
    public DateTime StartTimeUtc { get; private set; }
    public DateTime? EndTimeUtc { get; private set; }
    public decimal InitialOdometerKm { get; private set; }
    public decimal? FinalOdometerKm { get; private set; }
    public decimal DistanceKm { get; private set; } // Calculado autoritativamente pelo backend
    public TripStatus Status { get; private set; }
    public decimal TotalFuelExpenses { get; private set; }
    public decimal TotalOtherExpenses { get; private set; }
    public decimal TotalAllocatedCost { get; private set; } // Total já rateado para compras/vendas
    public string? Notes { get; private set; }

    private FleetTrip()
    {
        TripNumber = string.Empty;
        DriverName = string.Empty;
        OriginCity = string.Empty;
        DestinationCity = string.Empty;
    }

    public FleetTrip(
        Guid tenantId,
        Guid branchId,
        string tripNumber,
        Guid vehicleId,
        Guid driverUserId,
        string driverName,
        TripPurpose purpose,
        string originCity,
        string destinationCity,
        decimal initialOdometerKm,
        DateTime startTimeUtc,
        string? description = null,
        string? notes = null) : base(tenantId)
    {
        if (string.IsNullOrWhiteSpace(tripNumber))
            throw new ArgumentException("Número da viagem é obrigatório.", nameof(tripNumber));
        if (vehicleId == Guid.Empty)
            throw new ArgumentException("Veículo é obrigatório.", nameof(vehicleId));
        if (string.IsNullOrWhiteSpace(driverName))
            throw new ArgumentException("Nome do condutor/responsável é obrigatório.", nameof(driverName));
        if (string.IsNullOrWhiteSpace(originCity))
            throw new ArgumentException("Cidade de origem é obrigatória.", nameof(originCity));
        if (string.IsNullOrWhiteSpace(destinationCity))
            throw new ArgumentException("Cidade de destino é obrigatória.", nameof(destinationCity));
        if (initialOdometerKm < 0)
            throw new ArgumentException("Hodômetro inicial não pode ser negativo.", nameof(initialOdometerKm));

        BranchId = branchId;
        TripNumber = tripNumber.Trim().ToUpperInvariant();
        VehicleId = vehicleId;
        DriverUserId = driverUserId;
        DriverName = driverName.Trim();
        Purpose = purpose;
        OriginCity = originCity.Trim();
        DestinationCity = destinationCity.Trim();
        InitialOdometerKm = initialOdometerKm;
        StartTimeUtc = startTimeUtc;
        Status = TripStatus.InProgress;
        Description = description?.Trim();
        Notes = notes?.Trim();
        DistanceKm = 0;
    }

    public void CompleteTrip(decimal finalOdometerKm, DateTime endTimeUtc, string? completionNotes = null)
    {
        if (Status != TripStatus.InProgress)
            throw new InvalidOperationException($"Não é possível concluir uma viagem que está com status '{Status}'. Deve estar 'InProgress'.");

        if (finalOdometerKm < InitialOdometerKm)
            throw new InvalidOperationException($"Hodômetro final ({finalOdometerKm} km) não pode ser menor que o inicial ({InitialOdometerKm} km).");

        FinalOdometerKm = finalOdometerKm;
        DistanceKm = finalOdometerKm - InitialOdometerKm;
        EndTimeUtc = endTimeUtc;
        Status = TripStatus.Completed;

        if (!string.IsNullOrWhiteSpace(completionNotes))
        {
            Notes = string.IsNullOrWhiteSpace(Notes)
                ? completionNotes.Trim()
                : $"{Notes} | Conclusão: {completionNotes.Trim()}";
        }
    }

    public void Cancel(string reason)
    {
        if (Status == TripStatus.Completed)
            throw new InvalidOperationException("Não é possível cancelar uma viagem já concluída.");

        Status = TripStatus.Cancelled;
        Notes = string.IsNullOrWhiteSpace(Notes)
            ? $"Cancelada: {reason.Trim()}"
            : $"{Notes} | Cancelada: {reason.Trim()}";
    }

    public void AddExpenses(decimal fuelAmount, decimal otherAmount)
    {
        TotalFuelExpenses += fuelAmount;
        TotalOtherExpenses += otherAmount;
    }

    public void RegisterAllocation(decimal allocatedAmount)
    {
        var totalAvailable = TotalFuelExpenses + TotalOtherExpenses;
        if (totalAvailable > 0 && TotalAllocatedCost + allocatedAmount > totalAvailable)
        {
            throw new InvalidOperationException($"O valor total rateado ({TotalAllocatedCost + allocatedAmount:C2}) não pode ultrapassar o custo elegível total da viagem ({totalAvailable:C2}).");
        }

        TotalAllocatedCost += allocatedAmount;
    }
}
