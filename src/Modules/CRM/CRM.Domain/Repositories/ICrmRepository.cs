using CRM.Domain.Entities;

namespace CRM.Domain.Repositories;

public interface ICrmRepository
{
    // Leads
    Task<CrmLead?> GetLeadByIdAsync(Guid id, CancellationToken ct = default);
    Task<List<CrmLead>> ListLeadsAsync(Guid tenantId, Guid? branchId = null, CancellationToken ct = default);
    Task AddLeadAsync(CrmLead lead, CancellationToken ct = default);
    Task UpdateLeadAsync(CrmLead lead, CancellationToken ct = default);

    // Pipelines
    Task<CrmPipeline?> GetPipelineByIdAsync(Guid id, CancellationToken ct = default);
    Task<List<CrmPipeline>> ListPipelinesAsync(Guid tenantId, CancellationToken ct = default);
    Task AddPipelineAsync(CrmPipeline pipeline, CancellationToken ct = default);

    // Opportunities
    Task<CrmOpportunity?> GetOpportunityByIdAsync(Guid id, CancellationToken ct = default);
    Task<List<CrmOpportunity>> ListOpportunitiesAsync(Guid tenantId, Guid? branchId = null, Guid? pipelineId = null, CancellationToken ct = default);
    Task AddOpportunityAsync(CrmOpportunity opportunity, CancellationToken ct = default);
    Task UpdateOpportunityAsync(CrmOpportunity opportunity, CancellationToken ct = default);

    // Purchase Intents
    Task<CrmPurchaseIntent?> GetPurchaseIntentByIdAsync(Guid id, CancellationToken ct = default);
    Task<List<CrmPurchaseIntent>> ListActivePurchaseIntentsAsync(Guid tenantId, Guid? branchId = null, CancellationToken ct = default);
    Task AddPurchaseIntentAsync(CrmPurchaseIntent intent, CancellationToken ct = default);
    Task UpdatePurchaseIntentAsync(CrmPurchaseIntent intent, CancellationToken ct = default);

    // Matches
    Task<CrmInventoryMatch?> GetMatchByIdAsync(Guid id, CancellationToken ct = default);
    Task<List<CrmInventoryMatch>> ListMatchesByIntentAsync(Guid intentId, CancellationToken ct = default);
    Task AddMatchAsync(CrmInventoryMatch match, CancellationToken ct = default);
    Task UpdateMatchAsync(CrmInventoryMatch match, CancellationToken ct = default);

    // Unit of work
    Task<int> SaveChangesAsync(CancellationToken ct = default);
}
