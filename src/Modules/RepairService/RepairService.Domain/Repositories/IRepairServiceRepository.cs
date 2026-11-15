using RepairService.Domain.Entities;
using RepairService.Domain.Enums;

namespace RepairService.Domain.Repositories;

public interface IRepairServiceRepository
{
    Task<RepairOrder?> GetByIdAsync(Guid id, CancellationToken ct = default);
    Task<RepairOrder?> GetByOrderNumberAsync(string orderNumber, CancellationToken ct = default);
    Task<IReadOnlyList<RepairOrder>> ListAsync(Guid? branchId, RepairOrderStatus? status, Guid? customerId, CancellationToken ct = default);
    Task AddAsync(RepairOrder repairOrder, CancellationToken ct = default);
    Task UpdateAsync(RepairOrder repairOrder, CancellationToken ct = default);
    Task SaveChangesAsync(CancellationToken ct = default);
}
