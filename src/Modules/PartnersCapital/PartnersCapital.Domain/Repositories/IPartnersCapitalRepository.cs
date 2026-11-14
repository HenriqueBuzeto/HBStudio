using System;
using System.Collections.Generic;
using System.Threading;
using System.Threading.Tasks;
using PartnersCapital.Domain.Entities;

namespace PartnersCapital.Domain.Repositories;

public interface IPartnersCapitalRepository
{
    Task<Partner?> GetPartnerByIdAsync(Guid id, Guid tenantId, CancellationToken cancellationToken = default);
    Task<Partner?> GetPartnerByPartyIdAsync(Guid partyId, Guid tenantId, CancellationToken cancellationToken = default);
    Task<IReadOnlyList<Partner>> ListPartnersAsync(Guid tenantId, CancellationToken cancellationToken = default);
    Task AddPartnerAsync(Partner partner, CancellationToken cancellationToken = default);

    Task<IReadOnlyList<EquityParticipation>> GetCurrentCapTableAsync(Guid tenantId, CancellationToken cancellationToken = default);
    Task<IReadOnlyList<EquityParticipation>> GetPartnerEquityHistoryAsync(Guid partnerId, Guid tenantId, CancellationToken cancellationToken = default);
    Task AddEquityParticipationAsync(EquityParticipation equity, CancellationToken cancellationToken = default);

    Task<IReadOnlyList<CapitalContribution>> ListContributionsAsync(Guid tenantId, Guid? partnerId = null, CancellationToken cancellationToken = default);
    Task<CapitalContribution?> GetContributionByIdAsync(Guid id, Guid tenantId, CancellationToken cancellationToken = default);
    Task AddContributionAsync(CapitalContribution contribution, CancellationToken cancellationToken = default);

    Task<IReadOnlyList<PartnerLoan>> ListLoansAsync(Guid tenantId, Guid? partnerId = null, CancellationToken cancellationToken = default);
    Task<PartnerLoan?> GetLoanByIdAsync(Guid id, Guid tenantId, CancellationToken cancellationToken = default);
    Task AddLoanAsync(PartnerLoan loan, CancellationToken cancellationToken = default);

    Task<IReadOnlyList<PartnerCompensation>> ListCompensationsAsync(Guid tenantId, int? year = null, int? month = null, CancellationToken cancellationToken = default);
    Task<PartnerCompensation?> GetCompensationByIdAsync(Guid id, Guid tenantId, CancellationToken cancellationToken = default);
    Task AddCompensationAsync(PartnerCompensation compensation, CancellationToken cancellationToken = default);

    Task<IReadOnlyList<ProfitDistributionProposal>> ListProposalsAsync(Guid tenantId, int? fiscalYear = null, CancellationToken cancellationToken = default);
    Task<ProfitDistributionProposal?> GetProposalByIdAsync(Guid id, Guid tenantId, CancellationToken cancellationToken = default);
    Task AddProposalAsync(ProfitDistributionProposal proposal, CancellationToken cancellationToken = default);

    Task SaveChangesAsync(CancellationToken cancellationToken = default);
}
