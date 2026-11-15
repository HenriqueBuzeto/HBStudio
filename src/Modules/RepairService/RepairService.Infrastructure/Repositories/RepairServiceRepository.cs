using Microsoft.EntityFrameworkCore;
using RepairService.Domain.Entities;
using RepairService.Domain.Enums;
using RepairService.Domain.Repositories;
using BuildingBlocks.Infrastructure;

namespace RepairService.Infrastructure.Repositories;

public class RepairServiceRepository : IRepairServiceRepository
{
    private readonly AppDbContext _dbContext;

    public RepairServiceRepository(AppDbContext dbContext)
    {
        _dbContext = dbContext;
    }

    public async Task<RepairOrder?> GetByIdAsync(Guid id, CancellationToken ct = default)
    {
        return await _dbContext.Set<RepairOrder>()
            .Include(r => r.ChecklistItems)
            .Include(r => r.EstimateItems)
            .Include(r => r.PartUsages)
            .Include(r => r.StatusHistory)
            .Include(r => r.Attachments)
            .Include(r => r.WarrantyClaims)
            .FirstOrDefaultAsync(r => r.Id == id, ct);
    }

    public async Task<RepairOrder?> GetByOrderNumberAsync(string orderNumber, CancellationToken ct = default)
    {
        var normalized = orderNumber.Trim().ToUpperInvariant();
        return await _dbContext.Set<RepairOrder>()
            .Include(r => r.ChecklistItems)
            .Include(r => r.EstimateItems)
            .Include(r => r.PartUsages)
            .Include(r => r.StatusHistory)
            .Include(r => r.Attachments)
            .Include(r => r.WarrantyClaims)
            .FirstOrDefaultAsync(r => r.OrderNumber == normalized, ct);
    }

    public async Task<IReadOnlyList<RepairOrder>> ListAsync(Guid? branchId, RepairOrderStatus? status, Guid? customerId, CancellationToken ct = default)
    {
        var query = _dbContext.Set<RepairOrder>()
            .Include(r => r.ChecklistItems)
            .Include(r => r.EstimateItems)
            .Include(r => r.PartUsages)
            .Include(r => r.StatusHistory)
            .Include(r => r.WarrantyClaims)
            .AsNoTracking();

        if (branchId.HasValue)
            query = query.Where(r => r.BranchId == branchId.Value);

        if (status.HasValue)
            query = query.Where(r => r.Status == status.Value);

        if (customerId.HasValue)
            query = query.Where(r => r.CustomerId == customerId.Value);

        return await query.OrderByDescending(r => r.ReceivedAtUtc).ToListAsync(ct);
    }

    public async Task AddAsync(RepairOrder repairOrder, CancellationToken ct = default)
    {
        await _dbContext.Set<RepairOrder>().AddAsync(repairOrder, ct);
    }

    public Task UpdateAsync(RepairOrder repairOrder, CancellationToken ct = default)
    {
        // Se a entidade já está sendo rastreada pelo contexto, não chamar Update() pois força estado Modified em todas as propriedades e relacionamentos
        var entry = _dbContext.Entry(repairOrder);
        if (entry.State == EntityState.Detached)
        {
            _dbContext.Set<RepairOrder>().Update(repairOrder);
        }
        return Task.CompletedTask;
    }

    public async Task SaveChangesAsync(CancellationToken ct = default)
    {
        await _dbContext.SaveChangesAsync(ct);
    }
}
