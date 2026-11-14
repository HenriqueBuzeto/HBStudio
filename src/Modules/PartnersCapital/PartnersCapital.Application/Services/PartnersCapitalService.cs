using System;
using System.Collections.Generic;
using System.Linq;
using System.Threading;
using System.Threading.Tasks;
using Microsoft.EntityFrameworkCore;
using BuildingBlocks.Application;
using BuildingBlocks.Infrastructure;
using Financial.Application;
using Financial.Domain;
using PartnersCapital.Application.DTOs;
using PartnersCapital.Domain.Entities;
using PartnersCapital.Domain.Repositories;

namespace PartnersCapital.Application.Services;

public class PartnersCapitalService
{
    private readonly IPartnersCapitalRepository _repository;
    private readonly AppDbContext _dbContext;
    private readonly FinancialService _financialService;
    private readonly IExecutionContext _executionContext;

    public PartnersCapitalService(
        IPartnersCapitalRepository repository,
        AppDbContext dbContext,
        FinancialService financialService,
        IExecutionContext executionContext)
    {
        _repository = repository;
        _dbContext = dbContext;
        _financialService = financialService;
        _executionContext = executionContext;
    }

    public async Task<Partner> CreatePartnerAsync(Guid tenantId, CreatePartnerRequest request, CancellationToken cancellationToken = default)
    {
        var existing = await _repository.GetPartnerByPartyIdAsync(request.PartyId, tenantId, cancellationToken);
        if (existing != null)
        {
            throw new InvalidOperationException($"A partner with PartyId {request.PartyId} already exists in tenant {tenantId}.");
        }

        var partner = new Partner(
            tenantId,
            request.PartyId,
            request.Name,
            request.DocumentNumber,
            request.Email,
            request.Type,
            request.AdmissionDate,
            request.MonthlyCompensationCap,
            request.Notes
        );

        await _repository.AddPartnerAsync(partner, cancellationToken);
        await _repository.SaveChangesAsync(cancellationToken);
        return partner;
    }

    public async Task<CapTableSummaryDto> UpdateCapTableAsync(Guid tenantId, UpdateCapTableRequest request, CancellationToken cancellationToken = default)
    {
        if (request.Entries == null || request.Entries.Count == 0)
            throw new ArgumentException("At least one partner entry is required.", nameof(request.Entries));

        var totalPercentage = request.Entries.Sum(e => e.Percentage);
        if (Math.Abs(totalPercentage - 100.00m) > 0.01m)
        {
            throw new InvalidOperationException($"The sum of equity percentages must equal 100.00%. Current sum: {totalPercentage}%.");
        }

        var currentCapTable = await _repository.GetCurrentCapTableAsync(tenantId, cancellationToken);
        foreach (var oldEquity in currentCapTable)
        {
            oldEquity.Supersede(request.EffectiveDate);
        }

        var partners = await _repository.ListPartnersAsync(tenantId, cancellationToken);
        var partnerDict = partners.ToDictionary(p => p.Id);

        var listResult = new List<CapTablePartnerDto>();
        decimal sumQuotas = 0;
        decimal sumNominal = 0;

        foreach (var entry in request.Entries)
        {
            if (!partnerDict.ContainsKey(entry.PartnerId))
                throw new InvalidOperationException($"Partner with ID {entry.PartnerId} not found in tenant.");

            var newEquity = new EquityParticipation(
                tenantId,
                entry.PartnerId,
                entry.Quotas,
                entry.Percentage,
                entry.NominalValuePerQuota,
                request.EffectiveDate,
                request.LegalDocumentReference
            );

            await _repository.AddEquityParticipationAsync(newEquity, cancellationToken);
            sumQuotas += entry.Quotas;
            sumNominal += newEquity.TotalNominalValue;

            listResult.Add(new CapTablePartnerDto(
                entry.PartnerId,
                partnerDict[entry.PartnerId].Name,
                entry.Quotas,
                entry.Percentage,
                newEquity.TotalNominalValue
            ));
        }

        await _repository.SaveChangesAsync(cancellationToken);

        return new CapTableSummaryDto(sumQuotas, sumNominal, listResult);
    }

    public async Task<CapTableSummaryDto> GetCurrentCapTableSummaryAsync(Guid tenantId, CancellationToken cancellationToken = default)
    {
        var currentEquities = await _repository.GetCurrentCapTableAsync(tenantId, cancellationToken);
        var partners = await _repository.ListPartnersAsync(tenantId, cancellationToken);
        var partnerDict = partners.ToDictionary(p => p.Id);

        var list = currentEquities.Select(e => new CapTablePartnerDto(
            e.PartnerId,
            partnerDict.TryGetValue(e.PartnerId, out var p) ? p.Name : "Desconhecido",
            e.Quotas,
            e.Percentage,
            e.TotalNominalValue
        )).ToList();

        return new CapTableSummaryDto(
            list.Sum(x => x.Quotas),
            list.Sum(x => x.NominalValue),
            list
        );
    }

    public async Task<CapitalContribution> RegisterContributionAsync(Guid tenantId, RegisterContributionRequest request, CancellationToken cancellationToken = default)
    {
        var partner = await _repository.GetPartnerByIdAsync(request.PartnerId, tenantId, cancellationToken);
        if (partner == null) throw new InvalidOperationException($"Partner {request.PartnerId} not found.");

        var contribution = new CapitalContribution(
            tenantId,
            request.PartnerId,
            request.Type,
            request.Amount,
            request.SubscriptionDate,
            request.Description,
            request.FormalInstrumentReference,
            request.BankAccountId
        );

        await _repository.AddContributionAsync(contribution, cancellationToken);
        await _repository.SaveChangesAsync(cancellationToken);
        return contribution;
    }

    public async Task<CapitalContribution> PayInContributionAsync(Guid tenantId, Guid contributionId, PayInContributionRequest request, CancellationToken cancellationToken = default)
    {
        var contribution = await _repository.GetContributionByIdAsync(contributionId, tenantId, cancellationToken);
        if (contribution == null) throw new InvalidOperationException($"Contribution {contributionId} not found.");

        var bankId = request.BankAccountId ?? contribution.BankAccountId;
        Guid? journalId = null;

        var branchId = _executionContext.BranchId ?? Guid.Empty;
        if (branchId == Guid.Empty)
        {
            var firstBranch = await _dbContext.Branches.FirstOrDefaultAsync(b => b.TenantId == tenantId, cancellationToken);
            branchId = firstBranch?.Id ?? Guid.NewGuid();
        }

        if (bankId.HasValue)
        {
            var accounts = await _dbContext.FinancialAccounts
                .Where(a => a.TenantId == tenantId && a.IsActive)
                .ToListAsync(cancellationToken);

            var bankAssetAccount = accounts.FirstOrDefault(a => a.Type == FinancialAccountType.Asset && a.Name.Contains("Banco", StringComparison.OrdinalIgnoreCase))
                ?? accounts.FirstOrDefault(a => a.Type == FinancialAccountType.Asset);

            var equityCapitalAccount = accounts.FirstOrDefault(a => a.Type == FinancialAccountType.Equity && a.Name.Contains("Capital", StringComparison.OrdinalIgnoreCase))
                ?? accounts.FirstOrDefault(a => a.Type == FinancialAccountType.Equity);

            if (bankAssetAccount != null && equityCapitalAccount != null)
            {
                var journalEntry = await _financialService.CreateJournalEntryAsync(new CreateJournalEntryDto(
                    branchId,
                    request.PaidInDate,
                    $"APORTE-{contribution.Id.ToString()[..8]}",
                    "CapitalContribution",
                    contribution.Id.ToString(),
                    $"Integralização de Capital Social - Ref: {contribution.FormalInstrumentReference}",
                    new List<CreateJournalLineDto>
                    {
                        new(bankAssetAccount.Id, JournalLineDirection.Debit, contribution.Amount, null, "Débito em Ativo Circulante (Banco / Disponibilidades)"),
                        new(equityCapitalAccount.Id, JournalLineDirection.Credit, contribution.Amount, null, "Crédito em Patrimônio Líquido (Capital Social Realizado - Não DRE)")
                    }
                ), cancellationToken);

                journalId = journalEntry.Id;
            }

            var bankAccount = await _dbContext.BankAccounts
                .FirstOrDefaultAsync(b => b.TenantId == tenantId && b.Id == bankId.Value, cancellationToken);

            if (bankAccount != null)
            {
                var tx = new BankTransaction(
                    tenantId,
                    bankAccount.Id,
                    request.PaidInDate,
                    contribution.Amount,
                    $"APORTE-{contribution.Id.ToString()[..8]}-{DateTime.UtcNow.Ticks % 10000}",
                    $"Aporte Capital Social - {contribution.FormalInstrumentReference}"
                );
                if (journalId.HasValue) tx.MarkReconciled(journalId.Value);

                await _dbContext.BankTransactions.AddAsync(tx, cancellationToken);
                bankAccount.ApplyMovement(contribution.Amount);
            }
        }

        contribution.MarkPaidIn(request.PaidInDate, journalId, bankId);
        await _repository.SaveChangesAsync(cancellationToken);
        return contribution;
    }

    public async Task<PartnerLoan> RegisterLoanAsync(Guid tenantId, RegisterLoanRequest request, CancellationToken cancellationToken = default)
    {
        var partner = await _repository.GetPartnerByIdAsync(request.PartnerId, tenantId, cancellationToken);
        if (partner == null) throw new InvalidOperationException($"Partner {request.PartnerId} not found.");

        Guid? journalId = null;

        var branchId = _executionContext.BranchId ?? Guid.Empty;
        if (branchId == Guid.Empty)
        {
            var firstBranch = await _dbContext.Branches.FirstOrDefaultAsync(b => b.TenantId == tenantId, cancellationToken);
            branchId = firstBranch?.Id ?? Guid.NewGuid();
        }

        if (request.BankAccountId.HasValue)
        {
            var accounts = await _dbContext.FinancialAccounts
                .Where(a => a.TenantId == tenantId && a.IsActive)
                .ToListAsync(cancellationToken);

            var bankAssetAccount = accounts.FirstOrDefault(a => a.Type == FinancialAccountType.Asset && a.Name.Contains("Banco", StringComparison.OrdinalIgnoreCase))
                ?? accounts.FirstOrDefault(a => a.Type == FinancialAccountType.Asset);

            var loanLiabilityAccount = accounts.FirstOrDefault(a => a.Type == FinancialAccountType.Liability && (a.Name.Contains("Mútuo", StringComparison.OrdinalIgnoreCase) || a.Name.Contains("Empréstimo", StringComparison.OrdinalIgnoreCase)))
                ?? accounts.FirstOrDefault(a => a.Type == FinancialAccountType.Liability);

            if (bankAssetAccount != null && loanLiabilityAccount != null)
            {
                if (request.Direction == LoanDirection.PartnerToCompany)
                {
                    var journal = await _financialService.CreateJournalEntryAsync(new CreateJournalEntryDto(
                        branchId,
                        request.IssueDate,
                        $"MUTUO-IN-{request.ContractNumber}",
                        "PartnerLoan",
                        request.ContractNumber,
                        $"Empréstimo de Sócio (Mútuo Passivo) - Contrato {request.ContractNumber}",
                        new List<CreateJournalLineDto>
                        {
                            new(bankAssetAccount.Id, JournalLineDirection.Debit, request.PrincipalAmount, null, "Débito em Ativo Banco"),
                            new(loanLiabilityAccount.Id, JournalLineDirection.Credit, request.PrincipalAmount, null, "Crédito em Passivo Exigível (Mútuo de Sócios - Não DRE)")
                        }
                    ), cancellationToken);
                    journalId = journal.Id;

                    var bankAccount = await _dbContext.BankAccounts
                        .FirstOrDefaultAsync(b => b.TenantId == tenantId && b.Id == request.BankAccountId.Value, cancellationToken);

                    if (bankAccount != null)
                    {
                        var tx = new BankTransaction(
                            tenantId,
                            bankAccount.Id,
                            request.IssueDate,
                            request.PrincipalAmount,
                            $"MUTUO-IN-{request.ContractNumber}-{DateTime.UtcNow.Ticks % 10000}",
                            $"Entrada Mútuo Sócio {request.ContractNumber}"
                        );
                        if (journalId.HasValue) tx.MarkReconciled(journalId.Value);

                        await _dbContext.BankTransactions.AddAsync(tx, cancellationToken);
                        bankAccount.ApplyMovement(request.PrincipalAmount);
                    }
                }
            }
        }

        var loan = new PartnerLoan(
            tenantId,
            request.PartnerId,
            request.Direction,
            request.PrincipalAmount,
            request.AnnualInterestRate,
            request.IssueDate,
            request.DueDate,
            request.ContractNumber,
            request.Notes,
            request.BankAccountId,
            journalId
        );

        await _repository.AddLoanAsync(loan, cancellationToken);
        await _repository.SaveChangesAsync(cancellationToken);
        return loan;
    }

    public async Task<PartnerLoan> AmortizeLoanAsync(Guid tenantId, Guid loanId, AmortizeLoanRequest request, CancellationToken cancellationToken = default)
    {
        var loan = await _repository.GetLoanByIdAsync(loanId, tenantId, cancellationToken);
        if (loan == null) throw new InvalidOperationException($"Loan {loanId} not found.");

        var bankId = request.BankAccountId ?? loan.BankAccountId;
        var branchId = _executionContext.BranchId ?? Guid.Empty;
        if (branchId == Guid.Empty)
        {
            var firstBranch = await _dbContext.Branches.FirstOrDefaultAsync(b => b.TenantId == tenantId, cancellationToken);
            branchId = firstBranch?.Id ?? Guid.NewGuid();
        }

        if (bankId.HasValue)
        {
            var accounts = await _dbContext.FinancialAccounts
                .Where(a => a.TenantId == tenantId && a.IsActive)
                .ToListAsync(cancellationToken);

            var bankAssetAccount = accounts.FirstOrDefault(a => a.Type == FinancialAccountType.Asset && a.Name.Contains("Banco", StringComparison.OrdinalIgnoreCase))
                ?? accounts.FirstOrDefault(a => a.Type == FinancialAccountType.Asset);

            var loanLiabilityAccount = accounts.FirstOrDefault(a => a.Type == FinancialAccountType.Liability && (a.Name.Contains("Mútuo", StringComparison.OrdinalIgnoreCase) || a.Name.Contains("Empréstimo", StringComparison.OrdinalIgnoreCase)))
                ?? accounts.FirstOrDefault(a => a.Type == FinancialAccountType.Liability);

            if (bankAssetAccount != null && loanLiabilityAccount != null && loan.Direction == LoanDirection.PartnerToCompany)
            {
                var journal = await _financialService.CreateJournalEntryAsync(new CreateJournalEntryDto(
                    branchId,
                    request.PaymentDate,
                    $"MUTUO-OUT-{loan.ContractNumber}",
                    "PartnerLoanAmortization",
                    loan.ContractNumber,
                    $"Amortização Mútuo Sócio - Contrato {loan.ContractNumber}",
                    new List<CreateJournalLineDto>
                    {
                        new(loanLiabilityAccount.Id, JournalLineDirection.Debit, request.Amount, null, "Débito em Passivo (Baixa de Mútuo de Sócios - Não DRE)"),
                        new(bankAssetAccount.Id, JournalLineDirection.Credit, request.Amount, null, "Crédito em Ativo Banco")
                    }
                ), cancellationToken);

                var bankAccount = await _dbContext.BankAccounts
                    .FirstOrDefaultAsync(b => b.TenantId == tenantId && b.Id == bankId.Value, cancellationToken);

                if (bankAccount != null)
                {
                    var tx = new BankTransaction(
                        tenantId,
                        bankAccount.Id,
                        request.PaymentDate,
                        -request.Amount,
                        $"MUTUO-OUT-{loan.ContractNumber}-{DateTime.UtcNow.Ticks % 10000}",
                        $"Pagto Amortização Mútuo Sócio {loan.ContractNumber}"
                    );
                    tx.MarkReconciled(journal.Id);

                    await _dbContext.BankTransactions.AddAsync(tx, cancellationToken);
                    bankAccount.ApplyMovement(-request.Amount);
                }
            }
        }

        loan.Amortize(request.Amount);
        await _repository.SaveChangesAsync(cancellationToken);
        return loan;
    }

    public async Task<PartnerCompensation> ScheduleCompensationAsync(Guid tenantId, ScheduleCompensationRequest request, CancellationToken cancellationToken = default)
    {
        var partner = await _repository.GetPartnerByIdAsync(request.PartnerId, tenantId, cancellationToken);
        if (partner == null) throw new InvalidOperationException($"Partner {request.PartnerId} not found.");

        if (partner.MonthlyCompensationCap > 0 && request.GrossAmount > partner.MonthlyCompensationCap)
        {
            throw new InvalidOperationException($"Requested gross compensation of {request.GrossAmount:C} exceeds the partner's monthly cap of {partner.MonthlyCompensationCap:C}.");
        }

        var branches = await _dbContext.Branches.Where(b => b.TenantId == tenantId).ToListAsync(cancellationToken);
        var branchId = branches.FirstOrDefault()?.Id ?? _executionContext.BranchId ?? Guid.NewGuid();

        var payable = await _financialService.CreateAccountPayableAsync(new CreateAccountPayableDto(
            branchId,
            partner.PartyId,
            $"PROLABORE-{request.ReferenceYear}-{request.ReferenceMonth:D2}-{partner.Id.ToString()[..4]}",
            $"Pró-labore ref. {request.ReferenceMonth:D2}/{request.ReferenceYear} - {partner.Name}",
            request.ScheduledPaymentDate,
            request.ScheduledPaymentDate,
            request.GrossAmount - request.InssWithholding - request.IrrfWithholding
        ), cancellationToken);

        var compensation = new PartnerCompensation(
            tenantId,
            request.PartnerId,
            request.ReferenceYear,
            request.ReferenceMonth,
            request.GrossAmount,
            request.InssWithholding,
            request.IrrfWithholding,
            request.ScheduledPaymentDate,
            request.Notes,
            payable.Id
        );

        await _repository.AddCompensationAsync(compensation, cancellationToken);
        await _repository.SaveChangesAsync(cancellationToken);
        return compensation;
    }

    public async Task<ProfitDistributionProposal> CreateDistributionProposalAsync(Guid tenantId, CreateDistributionProposalRequest request, CancellationToken cancellationToken = default)
    {
        var startUtc = DateTime.SpecifyKind(new DateTime(request.FiscalYear, 1, 1), DateTimeKind.Utc);
        var endUtc = DateTime.SpecifyKind(new DateTime(request.FiscalYear, 12, 31, 23, 59, 59), DateTimeKind.Utc);

        var dre = await _financialService.GetDreReportAsync(
            startUtc,
            endUtc,
            null,
            cancellationToken);

        if (dre.NetResult <= 0)
        {
            throw new InvalidOperationException($"Cannot distribute profit: Financial DRE Net Result is {dre.NetResult:C} (must be strictly positive).");
        }

        if (request.BaseNetProfit > dre.NetResult)
        {
            throw new InvalidOperationException($"Base profit requested ({request.BaseNetProfit:C}) exceeds actual certified net profit from DRE ({dre.NetResult:C}).");
        }

        var proposal = new ProfitDistributionProposal(
            tenantId,
            request.ProtocolNumber,
            request.FiscalYear,
            request.FiscalQuarter,
            request.BaseNetProfit,
            request.LegalReserveRetention,
            request.WorkingCapitalRetention,
            request.DeliberationDate,
            request.MeetingMinutesReference,
            request.Notes
        );

        var capTable = await _repository.GetCurrentCapTableAsync(tenantId, cancellationToken);
        if (capTable.Count == 0)
        {
            throw new InvalidOperationException("Cannot create a distribution proposal without an active Cap Table.");
        }

        var distributable = proposal.DistributableAmount;
        foreach (var equity in capTable)
        {
            var partnerShare = Math.Round(distributable * (equity.Percentage / 100.00m), 2);
            proposal.AddItem(equity.PartnerId, equity.Percentage, partnerShare);
        }

        await _repository.AddProposalAsync(proposal, cancellationToken);
        await _repository.SaveChangesAsync(cancellationToken);
        return proposal;
    }

    public async Task<ProfitDistributionProposal> ApproveProposalAsync(Guid tenantId, Guid proposalId, string meetingMinutes, CancellationToken cancellationToken = default)
    {
        var proposal = await _repository.GetProposalByIdAsync(proposalId, tenantId, cancellationToken);
        if (proposal == null) throw new InvalidOperationException($"Proposal {proposalId} not found.");

        proposal.Approve(meetingMinutes);
        await _repository.SaveChangesAsync(cancellationToken);
        return proposal;
    }

    public async Task<ProfitDistributionProposal> SettleProposalItemAsync(
        Guid tenantId,
        Guid proposalId,
        Guid partnerId,
        SettleDistributionItemRequest request,
        CancellationToken cancellationToken = default)
    {
        var proposal = await _repository.GetProposalByIdAsync(proposalId, tenantId, cancellationToken);
        if (proposal == null) throw new InvalidOperationException($"Proposal {proposalId} not found.");

        if (proposal.Status != DistributionStatus.Approved && proposal.Status != DistributionStatus.PartiallyPaid)
            throw new InvalidOperationException($"Proposal must be approved before settlement. Current status: {proposal.Status}.");

        var item = proposal.Items.FirstOrDefault(i => i.PartnerId == partnerId);
        if (item == null) throw new InvalidOperationException($"Partner {partnerId} has no share in proposal {proposalId}.");
        if (item.IsPaid) throw new InvalidOperationException($"Share for partner {partnerId} has already been settled.");

        var branchId = _executionContext.BranchId ?? Guid.Empty;
        if (branchId == Guid.Empty)
        {
            var firstBranch = await _dbContext.Branches.FirstOrDefaultAsync(b => b.TenantId == tenantId, cancellationToken);
            branchId = firstBranch?.Id ?? Guid.NewGuid();
        }

        var accounts = await _dbContext.FinancialAccounts
            .Where(a => a.TenantId == tenantId && a.IsActive)
            .ToListAsync(cancellationToken);

        var bankAssetAccount = accounts.FirstOrDefault(a => a.Type == FinancialAccountType.Asset && a.Name.Contains("Banco", StringComparison.OrdinalIgnoreCase))
            ?? accounts.FirstOrDefault(a => a.Type == FinancialAccountType.Asset);

        var retainedEarningsAccount = accounts.FirstOrDefault(a => a.Type == FinancialAccountType.Equity && (a.Name.Contains("Lucro", StringComparison.OrdinalIgnoreCase) || a.Name.Contains("Resultado", StringComparison.OrdinalIgnoreCase)))
            ?? accounts.FirstOrDefault(a => a.Type == FinancialAccountType.Equity);

        Guid? journalId = null;
        if (bankAssetAccount != null && retainedEarningsAccount != null)
        {
            var journal = await _financialService.CreateJournalEntryAsync(new CreateJournalEntryDto(
                branchId,
                request.PaymentDate,
                $"DIV-{proposal.ProtocolNumber}-{partnerId.ToString()[..4]}",
                "ProfitDistribution",
                proposal.ProtocolNumber,
                $"Pagamento de Distribuição de Lucros - Protocolo {proposal.ProtocolNumber} - Sócio {partnerId}",
                new List<CreateJournalLineDto>
                {
                    new(retainedEarningsAccount.Id, JournalLineDirection.Debit, item.NetAmount, null, "Débito em Patrimônio Líquido (Lucros Distribuídos)"),
                    new(bankAssetAccount.Id, JournalLineDirection.Credit, item.NetAmount, null, "Crédito em Ativo Circulante (Disponibilidades Bancárias)")
                }
            ), cancellationToken);
            journalId = journal.Id;
        }

        var bankAccount = await _dbContext.BankAccounts
            .FirstOrDefaultAsync(b => b.TenantId == tenantId && b.Id == request.BankAccountId, cancellationToken);

        if (bankAccount != null)
        {
            var tx = new BankTransaction(
                tenantId,
                bankAccount.Id,
                request.PaymentDate,
                -item.NetAmount,
                $"DIV-{proposal.ProtocolNumber}-{partnerId.ToString()[..4]}-{DateTime.UtcNow.Ticks % 10000}",
                $"Distribuição Lucros {proposal.ProtocolNumber}"
            );
            if (journalId.HasValue) tx.MarkReconciled(journalId.Value);

            await _dbContext.BankTransactions.AddAsync(tx, cancellationToken);
            bankAccount.ApplyMovement(-item.NetAmount);
        }

        item.MarkPaid(request.PaymentDate, request.BankAccountId, journalId);

        if (proposal.Items.All(i => i.IsPaid))
        {
            proposal.MarkSettled();
        }

        await _repository.SaveChangesAsync(cancellationToken);
        return proposal;
    }

    public async Task<LiquiditySimulationResultDto> SimulateLiquidityAsync(
        Guid tenantId,
        decimal proposedDistributionAmount,
        decimal minimumOperatingReserve = 20000m,
        CancellationToken cancellationToken = default)
    {
        var bankAccounts = await _dbContext.BankAccounts
            .Where(b => b.TenantId == tenantId && b.IsActive)
            .ToListAsync(cancellationToken);

        var totalAvailableBalance = bankAccounts.Sum(b => b.CurrentBalance);

        var payables = await _dbContext.AccountsPayable
            .Where(p => p.TenantId == tenantId && (p.Status == PayableStatus.Open || p.Status == PayableStatus.PartiallyPaid))
            .ToListAsync(cancellationToken);

        var pendingShortTermPayables = payables.Sum(p => p.BalanceRemaining);

        var netLiquidSurplus = totalAvailableBalance - pendingShortTermPayables - minimumOperatingReserve;
        var distributableCap = Math.Max(0, netLiquidSurplus);
        var isSufficient = proposedDistributionAmount <= distributableCap;

        string assessment;
        if (isSufficient)
        {
            assessment = $"Liquidez APROVADA: Saldo em contas ({totalAvailableBalance:C}) é suficiente para cobrir os passivos imediatos ({pendingShortTermPayables:C}), a reserva mínima ({minimumOperatingReserve:C}) e a distribuição proposta de {proposedDistributionAmount:C}.";
        }
        else
        {
            assessment = $"Liquidez INSUFICIENTE: A distribuição de {proposedDistributionAmount:C} comprometeria o caixa operacional. O teto prudencial máximo para distribuição agora é de {distributableCap:C}.";
        }

        return new LiquiditySimulationResultDto(
            totalAvailableBalance,
            pendingShortTermPayables,
            minimumOperatingReserve,
            netLiquidSurplus,
            distributableCap,
            isSufficient,
            assessment
        );
    }

    public async Task<IReadOnlyList<PartnerSummaryDto>> ListPartnerSummariesAsync(Guid tenantId, CancellationToken cancellationToken = default)
    {
        var partners = await _repository.ListPartnersAsync(tenantId, cancellationToken);
        var capTable = await _repository.GetCurrentCapTableAsync(tenantId, cancellationToken);
        var contributions = await _repository.ListContributionsAsync(tenantId, null, cancellationToken);
        var loans = await _repository.ListLoansAsync(tenantId, null, cancellationToken);

        var capDict = capTable.ToDictionary(c => c.PartnerId);

        return partners.Select(p =>
        {
            capDict.TryGetValue(p.Id, out var cap);
            var partnerContributions = contributions.Where(c => c.PartnerId == p.Id && c.Status == ContributionStatus.PaidIn).Sum(c => c.Amount);
            var partnerLoans = loans.Where(l => l.PartnerId == p.Id && l.Direction == LoanDirection.PartnerToCompany && l.Status != LoanStatus.Settled).Sum(l => l.OutstandingBalance);

            return new PartnerSummaryDto(
                p.Id,
                p.PartyId,
                p.Name,
                p.DocumentNumber,
                p.Email,
                p.Type.ToString(),
                p.Status.ToString(),
                p.AdmissionDate,
                cap?.Quotas ?? 0,
                cap?.Percentage ?? 0,
                partnerContributions,
                partnerLoans,
                p.MonthlyCompensationCap
            );
        }).ToList();
    }
}
