using BuildingBlocks.Infrastructure;
using CRM.Domain.Entities;
using CRM.Domain.Repositories;
using Microsoft.EntityFrameworkCore;

namespace CRM.Infrastructure.Repositories;

public class CrmRepository : ICrmRepository
{
    private readonly AppDbContext _context;

    public CrmRepository(AppDbContext context)
    {
        _context = context;
    }

    public async Task<CrmLead?> GetLeadByIdAsync(Guid id, CancellationToken ct = default)
    {
        return await _context.Set<CrmLead>()
            .FirstOrDefaultAsync(l => l.Id == id, ct);
    }

    public async Task<List<CrmLead>> ListLeadsAsync(Guid tenantId, Guid? branchId = null, CancellationToken ct = default)
    {
        var query = _context.Set<CrmLead>()
            .Where(l => l.TenantId == tenantId);

        if (branchId.HasValue && branchId.Value != Guid.Empty)
        {
            query = query.Where(l => l.BranchId == branchId.Value);
        }

        return await query.OrderByDescending(l => l.CreatedAtUtc).ToListAsync(ct);
    }

    public async Task AddLeadAsync(CrmLead lead, CancellationToken ct = default)
    {
        await _context.Set<CrmLead>().AddAsync(lead, ct);
    }

    public Task UpdateLeadAsync(CrmLead lead, CancellationToken ct = default)
    {
        _context.Set<CrmLead>().Update(lead);
        return Task.CompletedTask;
    }

    public async Task<CrmPipeline?> GetPipelineByIdAsync(Guid id, CancellationToken ct = default)
    {
        return await _context.Set<CrmPipeline>()
            .Include(p => p.Stages)
            .FirstOrDefaultAsync(p => p.Id == id, ct);
    }

    public async Task<List<CrmPipeline>> ListPipelinesAsync(Guid tenantId, CancellationToken ct = default)
    {
        return await _context.Set<CrmPipeline>()
            .Include(p => p.Stages)
            .Where(p => p.TenantId == tenantId && p.IsActive)
            .ToListAsync(ct);
    }

    public async Task AddPipelineAsync(CrmPipeline pipeline, CancellationToken ct = default)
    {
        await _context.Set<CrmPipeline>().AddAsync(pipeline, ct);
    }

    public async Task<CrmOpportunity?> GetOpportunityByIdAsync(Guid id, CancellationToken ct = default)
    {
        return await _context.Set<CrmOpportunity>()
            .Include(o => o.Activities)
            .FirstOrDefaultAsync(o => o.Id == id, ct);
    }

    public async Task<List<CrmOpportunity>> ListOpportunitiesAsync(Guid tenantId, Guid? branchId = null, Guid? pipelineId = null, CancellationToken ct = default)
    {
        var query = _context.Set<CrmOpportunity>()
            .Include(o => o.Activities)
            .Where(o => o.TenantId == tenantId);

        if (branchId.HasValue && branchId.Value != Guid.Empty)
        {
            query = query.Where(o => o.BranchId == branchId.Value);
        }

        if (pipelineId.HasValue && pipelineId.Value != Guid.Empty)
        {
            query = query.Where(o => o.PipelineId == pipelineId.Value);
        }

        return await query.OrderByDescending(o => o.CreatedAtUtc).ToListAsync(ct);
    }

    public async Task AddOpportunityAsync(CrmOpportunity opportunity, CancellationToken ct = default)
    {
        await _context.Set<CrmOpportunity>().AddAsync(opportunity, ct);
    }

    public Task UpdateOpportunityAsync(CrmOpportunity opportunity, CancellationToken ct = default)
    {
        _context.Set<CrmOpportunity>().Update(opportunity);
        return Task.CompletedTask;
    }

    public async Task<CrmPurchaseIntent?> GetPurchaseIntentByIdAsync(Guid id, CancellationToken ct = default)
    {
        return await _context.Set<CrmPurchaseIntent>()
            .Include(i => i.Matches)
            .FirstOrDefaultAsync(i => i.Id == id, ct);
    }

    public async Task<List<CrmPurchaseIntent>> ListActivePurchaseIntentsAsync(Guid tenantId, Guid? branchId = null, CancellationToken ct = default)
    {
        var query = _context.Set<CrmPurchaseIntent>()
            .Include(i => i.Matches)
            .Where(i => i.TenantId == tenantId && i.ClosedAtUtc == null);

        if (branchId.HasValue && branchId.Value != Guid.Empty)
        {
            query = query.Where(i => i.BranchId == branchId.Value);
        }

        return await query.OrderByDescending(i => i.CreatedAtUtc).ToListAsync(ct);
    }

    public async Task AddPurchaseIntentAsync(CrmPurchaseIntent intent, CancellationToken ct = default)
    {
        await _context.Set<CrmPurchaseIntent>().AddAsync(intent, ct);
    }

    public Task UpdatePurchaseIntentAsync(CrmPurchaseIntent intent, CancellationToken ct = default)
    {
        _context.Set<CrmPurchaseIntent>().Update(intent);
        return Task.CompletedTask;
    }

    public async Task<CrmInventoryMatch?> GetMatchByIdAsync(Guid id, CancellationToken ct = default)
    {
        return await _context.Set<CrmInventoryMatch>()
            .FirstOrDefaultAsync(m => m.Id == id, ct);
    }

    public async Task<List<CrmInventoryMatch>> ListMatchesByIntentAsync(Guid intentId, CancellationToken ct = default)
    {
        return await _context.Set<CrmInventoryMatch>()
            .Where(m => m.PurchaseIntentId == intentId)
            .OrderByDescending(m => m.EvaluatedAtUtc)
            .ToListAsync(ct);
    }

    public async Task AddMatchAsync(CrmInventoryMatch match, CancellationToken ct = default)
    {
        await _context.Set<CrmInventoryMatch>().AddAsync(match, ct);
    }

    public Task UpdateMatchAsync(CrmInventoryMatch match, CancellationToken ct = default)
    {
        _context.Set<CrmInventoryMatch>().Update(match);
        return Task.CompletedTask;
    }

    public async Task<int> SaveChangesAsync(CancellationToken ct = default)
    {
        return await _context.SaveChangesAsync(ct);
    }
}
