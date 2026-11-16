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
    private readonly IServiceProvider _serviceProvider;
    private readonly ILogger<FiscalReconciliationWorker> _logger;
    private readonly TimeSpan _pollingInterval = TimeSpan.FromSeconds(60);
    private readonly TimeSpan _staleThreshold = TimeSpan.FromMinutes(2);

    public FiscalReconciliationWorker(IServiceProvider serviceProvider, ILogger<FiscalReconciliationWorker> logger)
    {
        _serviceProvider = serviceProvider;
        _logger = logger;
    }

    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        _logger.LogInformation("FiscalReconciliationWorker iniciado com ciclo de varredura a cada {Interval}s.", _pollingInterval.TotalSeconds);

        while (!stoppingToken.IsCancellationRequested)
        {
            try
            {
                await ReconcilePendingDocumentsAsync(stoppingToken);
            }
            catch (Exception ex) when (!stoppingToken.IsCancellationRequested)
            {
                _logger.LogError(ex, "Erro inesperado durante execução do ciclo de reconciliação fiscal automática.");
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

        _logger.LogInformation("FiscalReconciliationWorker finalizado.");
    }

    public async Task<int> ReconcilePendingDocumentsAsync(CancellationToken ct)
    {
        using var scope = _serviceProvider.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<IFiscalDbContext>();
        var fiscalService = scope.ServiceProvider.GetRequiredService<IFiscalService>();

        var cutoffUtc = DateTime.UtcNow.Subtract(_staleThreshold);

        // Busca documentos pendentes de resposta da SEFAZ
        var pendingDocs = await db.FiscalDocuments
            .Where(d => (d.Status == FiscalDocumentStatus.Submitting || d.Status == FiscalDocumentStatus.ManualReviewRequired)
                        && d.CreatedAtUtc <= cutoffUtc)
            .OrderBy(d => d.CreatedAtUtc)
            .Take(20)
            .ToListAsync(ct);

        if (pendingDocs.Count == 0) return 0;

        _logger.LogInformation("Reconciliador Fiscal: identificados {Count} documentos pendentes para verificação automática de status na SEFAZ.", pendingDocs.Count);

        int reconciledCount = 0;

        foreach (var doc in pendingDocs)
        {
            if (ct.IsCancellationRequested) break;

            try
            {
                _logger.LogInformation("Reconciliando documento {DocId} (Chave: {Key}, Status: {Status})...", doc.Id, doc.AccessKey, doc.Status);
                
                var reconciled = await fiscalService.ReconcileDocumentStatusAsync(doc.TenantId, doc.Id, ct);
                
                _logger.LogInformation("Documento {DocId} reconciliado com sucesso. Novo Status: {Status}.", doc.Id, reconciled.Status);
                reconciledCount++;
            }
            catch (Exception ex)
            {
                _logger.LogWarning(ex, "Falha ao reconciliar automaticamente documento fiscal {DocId}.", doc.Id);
            }
        }

        return reconciledCount;
    }
}
