using System;
using System.Collections.Generic;
using System.Linq;
using System.Threading;
using System.Threading.Tasks;
using BuildingBlocks.Infrastructure;
using Microsoft.EntityFrameworkCore;
using PartnersCapital.Domain.Entities;
using PartnersCapital.Domain.Repositories;

namespace PartnersCapital.Infrastructure.Repositories;

public class PartnersCapitalRepository : IPartnersCapitalRepository
{
    private readonly AppDbContext _context;

    public PartnersCapitalRepository(AppDbContext context)
    {
        _context = context;
    }

    public async Task<Partner?> GetPartnerByIdAsync(Guid id, Guid tenantId, CancellationToken cancellationToken = default)
    {
        return await _context.Set<Partner>()
            .FirstOrDefaultAsync(p => p.Id == id && p.TenantId == tenantId, cancellationToken);
    }

    public async Task<Partner?> GetPartnerByPartyIdAsync(Guid partyId, Guid tenantId, CancellationToken cancellationToken = default)
    {
        return await _context.Set<Partner>()
            .FirstOrDefaultAsync(p => p.PartyId == partyId && p.TenantId == tenantId, cancellationToken);
    }

    public async Task<IReadOnlyList<Partner>> ListPartnersAsync(Guid tenantId, CancellationToken cancellationToken = default)
    {
        return await _context.Set<Partner>()
            .Where(p => p.TenantId == tenantId)
            .OrderBy(p => p.AdmissionDate)
            .ToListAsync(cancellationToken);
    }

    public async Task AddPartnerAsync(Partner partner, CancellationToken cancellationToken = default)
    {
        await _context.Set<Partner>().AddAsync(partner, cancellationToken);
    }

    public async Task<IReadOnlyList<EquityParticipation>> GetCurrentCapTableAsync(Guid tenantId, CancellationToken cancellationToken = default)
    {
        return await _context.Set<EquityParticipation>()
            .Where(e => e.TenantId == tenantId && e.IsCurrent)
            .OrderByDescending(e => e.Percentage)
            .ToListAsync(cancellationToken);
    }

    public async Task<IReadOnlyList<EquityParticipation>> GetPartnerEquityHistoryAsync(Guid partnerId, Guid tenantId, CancellationToken cancellationToken = default)
    {
        return await _context.Set<EquityParticipation>()
            .Where(e => e.TenantId == tenantId && e.PartnerId == partnerId)
            .OrderByDescending(e => e.EffectiveDate)
            .ToListAsync(cancellationToken);
    }

    public async Task AddEquityParticipationAsync(EquityParticipation equity, CancellationToken cancellationToken = default)
    {
        await _context.Set<EquityParticipation>().AddAsync(equity, cancellationToken);
    }

    public async Task<IReadOnlyList<CapitalContribution>> ListContributionsAsync(Guid tenantId, Guid? partnerId = null, CancellationToken cancellationToken = default)
    {
        var query = _context.Set<CapitalContribution>().Where(c => c.TenantId == tenantId);
        if (partnerId.HasValue)
            query = query.Where(c => c.PartnerId == partnerId.Value);

        return await query.OrderByDescending(c => c.SubscriptionDate).ToListAsync(cancellationToken);
    }

    public async Task<CapitalContribution?> GetContributionByIdAsync(Guid id, Guid tenantId, CancellationToken cancellationToken = default)
    {
        return await _context.Set<CapitalContribution>()
            .FirstOrDefaultAsync(c => c.Id == id && c.TenantId == tenantId, cancellationToken);
    }

    public async Task AddContributionAsync(CapitalContribution contribution, CancellationToken cancellationToken = default)
    {
        await _context.Set<CapitalContribution>().AddAsync(contribution, cancellationToken);
    }

    public async Task<IReadOnlyList<PartnerLoan>> ListLoansAsync(Guid tenantId, Guid? partnerId = null, CancellationToken cancellationToken = default)
    {
        var query = _context.Set<PartnerLoan>().Where(l => l.TenantId == tenantId);
        if (partnerId.HasValue)
            query = query.Where(l => l.PartnerId == partnerId.Value);

        return await query.OrderByDescending(l => l.IssueDate).ToListAsync(cancellationToken);
    }

    public async Task<PartnerLoan?> GetLoanByIdAsync(Guid id, Guid tenantId, CancellationToken cancellationToken = default)
    {
        return await _context.Set<PartnerLoan>()
            .FirstOrDefaultAsync(l => l.Id == id && l.TenantId == tenantId, cancellationToken);
    }

    public async Task AddLoanAsync(PartnerLoan loan, CancellationToken cancellationToken = default)
    {
        await _context.Set<PartnerLoan>().AddAsync(loan, cancellationToken);
    }

    public async Task<IReadOnlyList<PartnerCompensation>> ListCompensationsAsync(Guid tenantId, int? year = null, int? month = null, CancellationToken cancellationToken = default)
    {
        var query = _context.Set<PartnerCompensation>().Where(c => c.TenantId == tenantId);
        if (year.HasValue) query = query.Where(c => c.ReferenceYear == year.Value);
        if (month.HasValue) query = query.Where(c => c.ReferenceMonth == month.Value);

        return await query.OrderByDescending(c => c.ScheduledPaymentDate).ToListAsync(cancellationToken);
    }

    public async Task<PartnerCompensation?> GetCompensationByIdAsync(Guid id, Guid tenantId, CancellationToken cancellationToken = default)
    {
        return await _context.Set<PartnerCompensation>()
            .FirstOrDefaultAsync(c => c.Id == id && c.TenantId == tenantId, cancellationToken);
    }

    public async Task AddCompensationAsync(PartnerCompensation compensation, CancellationToken cancellationToken = default)
    {
        await _context.Set<PartnerCompensation>().AddAsync(compensation, cancellationToken);
    }

    public async Task<IReadOnlyList<ProfitDistributionProposal>> ListProposalsAsync(Guid tenantId, int? fiscalYear = null, CancellationToken cancellationToken = default)
    {
        var query = _context.Set<ProfitDistributionProposal>()
            .Include(p => p.Items)
            .Where(p => p.TenantId == tenantId);

        if (fiscalYear.HasValue) query = query.Where(p => p.FiscalYear == fiscalYear.Value);

        return await query.OrderByDescending(p => p.DeliberationDate).ToListAsync(cancellationToken);
    }

    public async Task<ProfitDistributionProposal?> GetProposalByIdAsync(Guid id, Guid tenantId, CancellationToken cancellationToken = default)
    {
        return await _context.Set<ProfitDistributionProposal>()
            .Include(p => p.Items)
            .FirstOrDefaultAsync(p => p.Id == id && p.TenantId == tenantId, cancellationToken);
    }

    public async Task AddProposalAsync(ProfitDistributionProposal proposal, CancellationToken cancellationToken = default)
    {
        await _context.Set<ProfitDistributionProposal>().AddAsync(proposal, cancellationToken);
    }

    public async Task SaveChangesAsync(CancellationToken cancellationToken = default)
    {
        await _context.SaveChangesAsync(cancellationToken);
    }
}
