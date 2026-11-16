using Microsoft.EntityFrameworkCore;
using BuildingBlocks.Application;
using DigitalProjects.Domain.Entities;
using DigitalProjects.Application.DTOs;

namespace DigitalProjects.Application.Services;

public class DigitalProjectsAppService
{
    private readonly DbContext _dbContext;
    private readonly IExecutionContext _executionContext;

    public DigitalProjectsAppService(DbContext dbContext, IExecutionContext executionContext)
    {
        _dbContext = dbContext;
        _executionContext = executionContext;
    }

    public async Task<DigitalProjectDto> CreateProjectAsync(CreateDigitalProjectRequest req, CancellationToken ct = default)
    {
        var tenantId = _executionContext.TenantId;
        var branchId = _executionContext.BranchId ?? Guid.Empty;

        var count = await _dbContext.Set<DigitalProject>().CountAsync(p => p.TenantId == tenantId, ct);
        var projectCode = $"PRJ-{DateTime.UtcNow.Year}-{count + 1:D3}";

        var project = new DigitalProject(
            tenantId,
            branchId,
            projectCode,
            req.Name,
            req.Description,
            (DigitalProjectType)req.Type,
            (PricingModel)req.PricingModel,
            req.CustomerPartyId,
            req.CrmOpportunityId,
            req.SalesOrderId,
            req.LeadTechnicianUserId,
            req.LeadTechnicianName,
            req.ContractedPrice,
            req.EstimatedHours,
            req.PlannedStartDateUtc,
            req.PlannedDeliveryDateUtc
        );

        _dbContext.Set<DigitalProject>().Add(project);
        await _dbContext.SaveChangesAsync(ct);

        return MapProject(project);
    }

    public async Task<DigitalProjectDetailsDto> GetProjectDetailsAsync(Guid projectId, CancellationToken ct = default)
    {
        var project = await _dbContext.Set<DigitalProject>()
            .Include(p => p.Milestones)
            .Include(p => p.Tasks)
            .Include(p => p.TimeEntries)
            .Include(p => p.Deliverables)
            .Include(p => p.ChangeRequests)
            .FirstOrDefaultAsync(p => p.Id == projectId, ct);

        if (project == null) throw new KeyNotFoundException($"Projeto {projectId} não encontrado.");

        return new DigitalProjectDetailsDto(
            project.Id,
            project.ProjectCode,
            project.Name,
            project.Description,
            project.Type.ToString(),
            project.PricingModel.ToString(),
            project.Status.ToString(),
            project.CustomerPartyId,
            project.LeadTechnicianName,
            project.ContractedPrice,
            project.EstimatedHours,
            project.TotalActualLaborCost,
            project.TotalActualCost,
            project.InvoicedAmount,
            project.PaidAmount,
            project.IntellectualPropertyPolicy,
            project.LgpdProcessingRole,
            project.Milestones.Select(m => new MilestoneDto(
                m.Id, m.SequenceOrder, m.Title, m.Description, m.TargetDateUtc, m.MilestonePrice, m.IsBillable, m.Status.ToString(), m.ApprovedAtUtc, m.HasBeenBilled
            )).ToList(),
            project.Tasks.Select(t => new TaskDto(
                t.Id, t.MilestoneId, t.Title, t.Description, t.AssignedUserName, t.EstimatedHours, t.DueDateUtc, t.Status.ToString()
            )).ToList(),
            project.TimeEntries.Select(e => new TimeEntryDto(
                e.Id, e.DigitalProjectTaskId, e.UserName, e.WorkDateUtc, e.DurationHours, e.ActivityType.ToString(), e.Description, e.IsBillable, e.HistoricalHourlyCost, e.TotalCost, e.IsApproved
            )).ToList(),
            project.Deliverables.Select(d => new DeliverableDto(
                d.Id, d.Title, d.Type.ToString(), d.ArtifactVersion, d.StorageUriOrUrl, d.Sha256Hash, d.Status.ToString()
            )).ToList(),
            project.ChangeRequests.Select(c => new ChangeRequestDto(
                c.Id, c.CrNumber, c.Title, c.RequesterName, c.ImpactHours, c.ImpactCost, c.ImpactPrice, c.Status.ToString()
            )).ToList()
        );
    }

    public async Task<IReadOnlyList<DigitalProjectDto>> ListProjectsAsync(CancellationToken ct = default)
    {
        var tenantId = _executionContext.TenantId;
        var projects = await _dbContext.Set<DigitalProject>()
            .Where(p => p.TenantId == tenantId)
            .OrderByDescending(p => p.CreatedAtUtc)
            .ToListAsync(ct);

        return projects.Select(MapProject).ToList();
    }

    public async Task<MilestoneDto> AddMilestoneAsync(Guid projectId, CreateMilestoneRequest req, CancellationToken ct = default)
    {
        var project = await _dbContext.Set<DigitalProject>().Include(p => p.Milestones).FirstOrDefaultAsync(p => p.Id == projectId, ct);
        if (project == null) throw new KeyNotFoundException($"Projeto {projectId} não encontrado.");

        var milestone = project.AddMilestone(req.Title, req.Description, req.TargetDateUtc, req.MilestonePrice, req.IsBillable);
        await _dbContext.SaveChangesAsync(ct);

        return new MilestoneDto(
            milestone.Id,
            milestone.SequenceOrder,
            milestone.Title,
            milestone.Description,
            milestone.TargetDateUtc,
            milestone.MilestonePrice,
            milestone.IsBillable,
            milestone.Status.ToString(),
            milestone.ApprovedAtUtc,
            milestone.HasBeenBilled
        );
    }

    public async Task ApproveMilestoneAsync(Guid projectId, Guid milestoneId, string approvalNotes, CancellationToken ct = default)
    {
        var project = await _dbContext.Set<DigitalProject>().Include(p => p.Milestones).FirstOrDefaultAsync(p => p.Id == projectId, ct);
        if (project == null) throw new KeyNotFoundException($"Projeto {projectId} não encontrado.");

        var milestone = project.Milestones.FirstOrDefault(m => m.Id == milestoneId);
        if (milestone == null) throw new KeyNotFoundException($"Marco {milestoneId} não encontrado.");

        milestone.AcceptMilestone(approvalNotes);
        await _dbContext.SaveChangesAsync(ct);
    }

    public async Task<TaskDto> AddTaskAsync(Guid projectId, CreateProjectTaskRequest req, CancellationToken ct = default)
    {
        var project = await _dbContext.Set<DigitalProject>().Include(p => p.Tasks).FirstOrDefaultAsync(p => p.Id == projectId, ct);
        if (project == null) throw new KeyNotFoundException($"Projeto {projectId} não encontrado.");

        var task = project.AddTask(req.MilestoneId, req.Title, req.Description, req.AssignedUserId, req.AssignedUserName, req.EstimatedHours, req.DueDateUtc);
        await _dbContext.SaveChangesAsync(ct);

        return new TaskDto(
            task.Id,
            task.MilestoneId,
            task.Title,
            task.Description,
            task.AssignedUserName,
            task.EstimatedHours,
            task.DueDateUtc,
            task.Status.ToString()
        );
    }

    public async Task UpdateTaskStatusAsync(Guid projectId, Guid taskId, int newStatus, CancellationToken ct = default)
    {
        var project = await _dbContext.Set<DigitalProject>().Include(p => p.Tasks).FirstOrDefaultAsync(p => p.Id == projectId, ct);
        if (project == null) throw new KeyNotFoundException($"Projeto {projectId} não encontrado.");

        var task = project.Tasks.FirstOrDefault(t => t.Id == taskId);
        if (task == null) throw new KeyNotFoundException($"Tarefa {taskId} não encontrada.");

        task.UpdateStatus((ProjectTaskStatus)newStatus);
        await _dbContext.SaveChangesAsync(ct);
    }

    public async Task<TimeEntryDto> RecordTimeEntryAsync(Guid projectId, CreateTimeEntryRequest req, CancellationToken ct = default)
    {
        var project = await _dbContext.Set<DigitalProject>().Include(p => p.TimeEntries).FirstOrDefaultAsync(p => p.Id == projectId, ct);
        if (project == null) throw new KeyNotFoundException($"Projeto {projectId} não encontrado.");

        var entry = project.AddTimeEntry(
            req.TaskId,
            req.UserId,
            req.UserName,
            req.WorkDateUtc,
            req.DurationHours,
            (TimeEntryActivityType)req.ActivityType,
            req.Description,
            req.IsBillable,
            req.HistoricalHourlyCost
        );

        await _dbContext.SaveChangesAsync(ct);

        return new TimeEntryDto(
            entry.Id,
            entry.DigitalProjectTaskId,
            entry.UserName,
            entry.WorkDateUtc,
            entry.DurationHours,
            entry.ActivityType.ToString(),
            entry.Description,
            entry.IsBillable,
            entry.HistoricalHourlyCost,
            entry.TotalCost,
            entry.IsApproved
        );
    }

    public async Task<DeliverableDto> AddDeliverableAsync(Guid projectId, CreateDeliverableRequest req, CancellationToken ct = default)
    {
        var project = await _dbContext.Set<DigitalProject>().Include(p => p.Deliverables).FirstOrDefaultAsync(p => p.Id == projectId, ct);
        if (project == null) throw new KeyNotFoundException($"Projeto {projectId} não encontrado.");

        var deliverable = project.AddDeliverable(
            req.MilestoneId,
            req.Title,
            (DeliverableType)req.Type,
            req.Version,
            req.Description,
            req.StorageUriOrUrl,
            req.Sha256Hash
        );

        await _dbContext.SaveChangesAsync(ct);

        return new DeliverableDto(
            deliverable.Id,
            deliverable.Title,
            deliverable.Type.ToString(),
            deliverable.ArtifactVersion,
            deliverable.StorageUriOrUrl,
            deliverable.Sha256Hash,
            deliverable.Status.ToString()
        );
    }

    public async Task AcceptDeliverableAsync(Guid projectId, Guid deliverableId, string notes, CancellationToken ct = default)
    {
        var project = await _dbContext.Set<DigitalProject>().Include(p => p.Deliverables).FirstOrDefaultAsync(p => p.Id == projectId, ct);
        if (project == null) throw new KeyNotFoundException($"Projeto {projectId} não encontrado.");

        var deliverable = project.Deliverables.FirstOrDefault(d => d.Id == deliverableId);
        if (deliverable == null) throw new KeyNotFoundException($"Entregável {deliverableId} não encontrado.");

        deliverable.Accept(notes);
        await _dbContext.SaveChangesAsync(ct);
    }

    public async Task<ChangeRequestDto> AddChangeRequestAsync(Guid projectId, CreateChangeRequestRequest req, CancellationToken ct = default)
    {
        var project = await _dbContext.Set<DigitalProject>().Include(p => p.ChangeRequests).FirstOrDefaultAsync(p => p.Id == projectId, ct);
        if (project == null) throw new KeyNotFoundException($"Projeto {projectId} não encontrado.");

        var cr = project.AddChangeRequest(
            req.Title,
            req.RequesterName,
            req.Reason,
            req.ProposedScopeChanges,
            req.ImpactHours,
            req.ImpactCost,
            req.ImpactPrice,
            req.ImpactDays
        );

        await _dbContext.SaveChangesAsync(ct);

        return new ChangeRequestDto(
            cr.Id,
            cr.CrNumber,
            cr.Title,
            cr.RequesterName,
            cr.ImpactHours,
            cr.ImpactCost,
            cr.ImpactPrice,
            cr.Status.ToString()
        );
    }

    public async Task ApproveChangeRequestAsync(Guid projectId, Guid changeRequestId, string notes, CancellationToken ct = default)
    {
        var project = await _dbContext.Set<DigitalProject>().Include(p => p.ChangeRequests).FirstOrDefaultAsync(p => p.Id == projectId, ct);
        if (project == null) throw new KeyNotFoundException($"Projeto {projectId} não encontrado.");

        var cr = project.ChangeRequests.FirstOrDefault(c => c.Id == changeRequestId);
        if (cr == null) throw new KeyNotFoundException($"Change Request {changeRequestId} não encontrado.");

        cr.Approve(notes);
        await _dbContext.SaveChangesAsync(ct);
    }

    private static DigitalProjectDto MapProject(DigitalProject p) =>
        new(
            p.Id,
            p.ProjectCode,
            p.Name,
            p.Description,
            p.Type.ToString(),
            p.PricingModel.ToString(),
            p.Status.ToString(),
            p.CustomerPartyId,
            p.LeadTechnicianName,
            p.ContractedPrice,
            p.EstimatedHours,
            p.TotalActualLaborCost,
            p.TotalActualCost,
            p.InvoicedAmount,
            p.PaidAmount,
            p.CreatedAtUtc
        );
}
