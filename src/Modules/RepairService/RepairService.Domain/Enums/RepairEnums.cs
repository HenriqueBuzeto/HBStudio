using BuildingBlocks.Domain;

namespace RepairService.Domain.Enums;

public enum RepairOrderStatus
{
    Received = 1,                 // Equipamento recebido no balcão em custódia
    WaitingDiagnosis = 2,         // Aguardando avaliação do técnico
    Diagnosing = 3,               // Técnico executando diagnóstico na bancada
    WaitingEstimateApproval = 4,  // Orçamento emitido, aguardando aprovação do cliente
    Approved = 5,                 // Orçamento aprovado pelo cliente
    Rejected = 6,                 // Orçamento rejeitado pelo cliente (sem reparo)
    WaitingParts = 7,             // Aguardando peças em estoque/compra
    InRepair = 8,                 // Reparo em execução
    WaitingExternalService = 9,   // Terceirizado em laboratório parceiro
    QualityCheck = 10,            // Inspeção e testes de saída
    ReadyForPickup = 11,          // Pronto para retirada pelo cliente
    Delivered = 12,               // Equipamento entregue ao cliente (saída de custódia)
    Cancelled = 13,               // Cancelado antes da execução
    WarrantyReturn = 14,          // Retorno em garantia vinculado à OS original
    Unrepairable = 15             // Sem possibilidade técnica de reparo
}

public enum RepairEstimateItemType
{
    LaborService = 1,             // Mão de obra técnica / serviço comercial
    Part = 2,                     // Peça/componente físico do estoque
    ExternalService = 3           // Serviço terceirizado especializado
}

public enum ChecklistItemStatus
{
    Conforming = 1,               // Conforme / Funcional
    NonConforming = 2,            // Não conforme / Defeituoso
    NotTested = 3,                // Não testado (ex: aparelho não liga)
    NotApplicable = 4             // Não se aplica ao modelo
}

public enum WarrantyCoverageDecision
{
    UnderReview = 1,              // Em análise técnica
    Covered = 2,                  // Coberto integralmente pela garantia legal/contratual
    RejectedMisuse = 3,           // Negado por dano físico, oxidação ou intervenção de terceiros
    RejectedExpired = 4           // Prazo legal/contratual expirado
}
