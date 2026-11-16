using System;
using System.Linq;
using System.Threading;
using System.Threading.Tasks;
using Fiscal.Application.Contracts;
using Fiscal.Application.Services;
using Fiscal.Domain.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Logging;

namespace Fiscal.Infrastructure.Workers;

/// <summary>
/// Worker de reconciliação fiscal em background para recuperação automática de timeouts e instabilidades SEFAZ.
/// Executa a cada 60 segundos buscando documentos em estado pendente (Submitting ou ManualReviewRequired)
/// que ultrapassaram o tempo limite de tolerância (>= 2 minutos) e consulta o status definitivo do lote/recibo na SEFAZ.
/// </summary>
public class FiscalReconciliationWorker : BackgroundService
{
    private readonly Guid _workerInstanceId = Guid.NewGuid();
    private readonly IServiceProvider _serviceProvider;
    private readonly ILogger<FiscalReconciliationWorker> _logger;
    private readonly TimeSpan _pollingInterval = TimeSpan.FromSeconds(60);
    private readonly TimeSpan _staleThreshold = TimeSpan.FromMinutes(2);
    private readonly TimeSpan _leaseDuration = TimeSpan.FromSeconds(90);

    public FiscalReconciliationWorker(IServiceProvider serviceProvider, ILogger<FiscalReconciliationWorker> logger)
    {
        _serviceProvider = serviceProvider;
        _logger = logger;
    }

    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        _logger.LogInformation("FiscalReconciliationWorker [{WorkerId}] iniciado com ciclo de varredura a cada {Interval}s.", _workerInstanceId, _pollingInterval.TotalSeconds);

        while (!stoppingToken.IsCancellationRequested)
        {
            try
            {
                await ReconcilePendingDocumentsAsync(stoppingToken);
            }
            catch (Exception ex) when (!stoppingToken.IsCancellationRequested)
            {
                _logger.LogError(ex, "Erro inesperado durante execução do ciclo de reconciliação fiscal automática no worker {WorkerId}.", _workerInstanceId);
            }

            try
            {
                await Task.Delay(_pollingInterval, stoppingToken);
            }
            catch (OperationCanceledException)
            {
                break;
            }
        }

        _logger.LogInformation("FiscalReconciliationWorker [{WorkerId}] finalizado.", _workerInstanceId);
    }

    public async Task<int> ReconcilePendingDocumentsAsync(CancellationToken ct)
    {
        using var scope = _serviceProvider.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<IFiscalDbContext>();
        var fiscalService = scope.ServiceProvider.GetRequiredService<IFiscalService>();

        var now = DateTime.UtcNow;
        var cutoffUtc = now.Subtract(_staleThreshold);

        // Busca documentos pendentes de resposta da SEFAZ elegíveis para claim e que não estejam sob lease ativo de outra instância
        var eligibleDocs = await db.FiscalDocuments
            .Where(d => (d.Status == FiscalDocumentStatus.Submitting || d.Status == FiscalDocumentStatus.ManualReviewRequired)
                        && d.CreatedAtUtc <= cutoffUtc
                        && (d.NextReconcileAttemptAtUtc == null || d.NextReconcileAttemptAtUtc <= now)
                        && (d.ReconcileLeaseExpiresAtUtc == null || d.ReconcileLeaseExpiresAtUtc <= now))
            .OrderBy(d => d.CreatedAtUtc)
            .Take(10)
            .ToListAsync(ct);

        if (eligibleDocs.Count == 0) return 0;

        _logger.LogInformation("Worker [{WorkerId}]: {Count} documentos elegíveis para reconciliação concorrente.", _workerInstanceId, eligibleDocs.Count);

        int reconciledCount = 0;

        foreach (var doc in eligibleDocs)
        {
            if (ct.IsCancellationRequested) break;

            // 1. Concorrência Segura: Adquire lease exclusivo para esta instância do Worker
            if (!doc.TryAcquireReconcileLease(_workerInstanceId, _leaseDuration))
            {
                continue; // Outra instância tomou o lock primeiro
            }

            // Persiste o claim imediatamente no banco antes de iniciar a operação externa
            await db.SaveChangesAsync(ct);

            try
            {
                _logger.LogInformation("Worker [{WorkerId}] reconciliando documento {DocId} (Chave: {Key}, Status: {Status})...", _workerInstanceId, doc.Id, doc.AccessKey, doc.Status);
                
                var reconciled = await fiscalService.ReconcileDocumentStatusAsync(doc.TenantId, doc.Id, ct);
                
                _logger.LogInformation("Worker [{WorkerId}] documento {DocId} reconciliado com sucesso. Status atual: {Status}.", _workerInstanceId, doc.Id, reconciled.Status);
                reconciledCount++;
            }
            catch (Exception ex)
            {
                _logger.LogWarning(ex, "Worker [{WorkerId}] falha ao reconciliar automaticamente documento fiscal {DocId}.", _workerInstanceId, doc.Id);
                doc.ReleaseReconcileLease();
                await db.SaveChangesAsync(ct);
            }
        }

        return reconciledCount;
    }
}
