using BuildingBlocks.Domain;

namespace FleetLogistics.Domain.Entities;

public enum OilChangePlanStatus
{
    NoConfiguration = 0, // Sem plano cadastrado
    UpToDate = 1,        // Em dia (faltam mais de 1.000 km e mais de 30 dias)
    Upcoming = 2,        // Próxima (faltam menos de 1.000 km ou menos de 30 dias)
    Overdue = 3          // Vencida por quilometragem ou por tempo
}

/// <summary>
/// Plano de manutenção preventiva configurado por veículo (ex: troca de óleo a cada 10.000 km ou 6 meses).
/// </summary>
public class FleetMaintenancePlan : TenantEntity
{
    public Guid VehicleId { get; private set; }
    public FleetVehicle? Vehicle { get; private set; }
    public string PlanName { get; private set; }             // Ex: "Troca de Óleo Motor 5W30 Sintético"
    public int RecommendedIntervalKm { get; private set; }  // Ex: 10000 km (ou 7500 para severo)
    public int RecommendedIntervalDays { get; private set; }// Ex: 180 dias (6 meses)
    public decimal? LastServiceOdometerKm { get; private set; }
    public DateTime? LastServiceDateUtc { get; private set; }
    public decimal? NextServiceOdometerKm { get; private set; }
    public DateTime? NextServiceDateUtc { get; private set; }
    public string? OilSpecification { get; private set; }   // Ex: "5W-30 API SP / Dexos 1 Gen 3"
    public bool IsActive { get; private set; } = true;

    private FleetMaintenancePlan()
    {
        PlanName = string.Empty;
    }

    public FleetMaintenancePlan(
        Guid tenantId,
        Guid vehicleId,
        string planName,
        int recommendedIntervalKm,
        int recommendedIntervalDays,
        decimal? lastServiceOdometerKm = null,
        DateTime? lastServiceDateUtc = null,
        string? oilSpecification = null) : base(tenantId)
    {
        if (vehicleId == Guid.Empty)
            throw new ArgumentException("Veículo é obrigatório.", nameof(vehicleId));
        if (string.IsNullOrWhiteSpace(planName))
            throw new ArgumentException("Nome do plano é obrigatório.", nameof(planName));
        if (recommendedIntervalKm <= 0)
            throw new ArgumentException("Intervalo em km deve ser maior que zero.", nameof(recommendedIntervalKm));
        if (recommendedIntervalDays <= 0)
            throw new ArgumentException("Intervalo em dias deve ser maior que zero.", nameof(recommendedIntervalDays));

        VehicleId = vehicleId;
        PlanName = planName.Trim();
        RecommendedIntervalKm = recommendedIntervalKm;
        RecommendedIntervalDays = recommendedIntervalDays;
        OilSpecification = oilSpecification?.Trim();
        IsActive = true;

        if (lastServiceOdometerKm.HasValue)
        {
            RecordServiceExecution(lastServiceOdometerKm.Value, lastServiceDateUtc ?? DateTime.UtcNow);
        }
    }

    public void RecordServiceExecution(decimal serviceOdometerKm, DateTime serviceDateUtc)
    {
        if (serviceOdometerKm < 0)
            throw new ArgumentException("Hodômetro da manutenção não pode ser negativo.", nameof(serviceOdometerKm));

        LastServiceOdometerKm = serviceOdometerKm;
        LastServiceDateUtc = serviceDateUtc;
        NextServiceOdometerKm = serviceOdometerKm + RecommendedIntervalKm;
        NextServiceDateUtc = serviceDateUtc.AddDays(RecommendedIntervalDays);
    }

    public OilChangePlanStatus EvaluateStatus(decimal currentVehicleOdometerKm, DateTime nowUtc)
    {
        if (!NextServiceOdometerKm.HasValue || !NextServiceDateUtc.HasValue)
            return OilChangePlanStatus.NoConfiguration;

        // Vencido se passou do KM ou passou da data
        if (currentVehicleOdometerKm >= NextServiceOdometerKm.Value || nowUtc >= NextServiceDateUtc.Value)
            return OilChangePlanStatus.Overdue;

        var kmRemaining = NextServiceOdometerKm.Value - currentVehicleOdometerKm;
        var daysRemaining = (NextServiceDateUtc.Value - nowUtc).TotalDays;

        // Próximo se faltam menos de 1000 km ou menos de 30 dias
        if (kmRemaining <= 1000 || daysRemaining <= 30)
            return OilChangePlanStatus.Upcoming;

        return OilChangePlanStatus.UpToDate;
    }

    public decimal GetRemainingKm(decimal currentVehicleOdometerKm)
    {
        if (!NextServiceOdometerKm.HasValue) return 0;
        return Math.Max(0, NextServiceOdometerKm.Value - currentVehicleOdometerKm);
    }
}
