namespace BuildingBlocks.Domain;

public static class PermissionCatalog
{
    // Clientes
    public const string CustomersView = "customers.view";
    public const string CustomersCreate = "customers.create";
    public const string CustomersEdit = "customers.edit";
    public const string CustomersExport = "customers.export";
    public const string CustomersSensitiveView = "customers.sensitive.view";

    // Fornecedores
    public const string SuppliersView = "suppliers.view";
    public const string SuppliersCreate = "suppliers.create";
    public const string SuppliersEdit = "suppliers.edit";

    // Catálogo
    public const string CatalogProductsView = "catalog.products.view";
    public const string CatalogProductsManage = "catalog.products.manage";
    public const string CatalogCostView = "catalog.cost.view";

    // Estoque
    public const string InventoryView = "inventory.view";
    public const string InventoryMove = "inventory.move";
    public const string InventoryAdjust = "inventory.adjust";
    public const string InventoryCostView = "inventory.cost.view";
    public const string InventorySerialsView = "inventory.serials.view";

    // Compras
    public const string PurchasesView = "purchases.view";
    public const string PurchasesCreate = "purchases.create";
    public const string PurchasesApprove = "purchases.approve";
    public const string PurchasesReceive = "purchases.receive";
    public const string PurchasesCostView = "purchases.cost.view";

    // PDV / Vendas
    public const string SalesPosUse = "sales.pos.use";
    public const string SalesCreate = "sales.create";
    public const string SalesDiscountOverride = "sales.discount.override";
    public const string SalesCancel = "sales.cancel";
    public const string SalesCostView = "sales.cost.view";

    // Caixa & Turnos (CashManagement)
    public const string CashOpen = "cash.open";
    public const string CashSupply = "cash.supply";
    public const string CashWithdraw = "cash.withdraw";
    public const string CashClose = "cash.close";
    public const string CashReconcile = "cash.reconcile";
    public const string CashApproveDifference = "cash.approve_difference";
    public const string CashRegisterView = "cash.register.view";
    public const string CashRegisterManage = "cash.register.manage";
    public const string CashShiftView = "cash.shift.view";
    public const string CashShiftCount = "cash.shift.count";
    public const string CashShiftApprove = "cash.shift.approve";
    public const string CashMovementView = "cash.movement.view";
    public const string CashDiscrepancyView = "cash.discrepancy.view";
    public const string CashDiscrepancyResolve = "cash.discrepancy.resolve";
    public const string CashAuditView = "cash.audit.view";

    // Assistência Técnica
    public const string RepairsView = "repairs.view";
    public const string RepairsCreate = "repairs.create";
    public const string RepairsDiagnose = "repairs.diagnose";
    public const string RepairsQuote = "repairs.quote";
    public const string RepairsApprove = "repairs.approve";
    public const string RepairsAssign = "repairs.assign";
    public const string RepairsExecute = "repairs.execute";
    public const string RepairsPartsReserve = "repairs.parts.reserve";
    public const string RepairsPartsConsume = "repairs.parts.consume";
    public const string RepairsQualityCheck = "repairs.quality";
    public const string RepairsDeliver = "repairs.deliver";
    public const string RepairsWarranty = "repairs.warranty";
    public const string RepairsCostView = "repairs.cost.view";

    // CRM
    public const string CrmView = "crm.view";
    public const string CrmManage = "crm.manage";
    public const string CrmInterestManage = "crm.interest.manage";
    public const string CrmCampaignSend = "crm.campaign.send";
    public const string CrmMessageView = "crm.message.view";

    // Financeiro (MOD-12 Financial)
    public const string FinancePayablesView = "finance.payables.view";
    public const string FinancePay = "finance.pay";
    public const string FinanceReceivablesView = "finance.receivables.view";
    public const string FinanceSettle = "finance.settle";
    public const string FinanceReconcile = "finance.reconcile";
    public const string FinanceReportsView = "finance.reports.view";
    public const string FinanceBanksManage = "finance.banks.manage";
    public const string FinanceJournalView = "finance.journal.view";
    public const string FinanceCostCentersManage = "finance.costcenters.manage";
    public const string FinancePeriodClose = "finance.period.close";

    // Societário & Investimentos
    public const string PartnersView = "partners.view";
    public const string PartnersManage = "partners.manage";
    public const string PartnersCapitalManage = "partners.capital.manage";
    public const string PartnersLoanManage = "partners.loan.manage";
    public const string PartnersCompensationManage = "partners.compensation.manage";
    public const string PartnersDistributionPropose = "partners.distribution.propose";
    public const string PartnersDistributionApprove = "partners.distribution.approve";
    public const string PartnersDistributionPay = "partners.distribution.pay";
    public const string PartnersDistributionSettle = "partners.distribution.settle";

    // Manufacturing 3D (MOD-10)
    public const string ManufacturingView = "manufacturing.view";
    public const string ManufacturingQuote = "manufacturing.quote";
    public const string ManufacturingSchedule = "manufacturing.schedule";
    public const string ManufacturingExecute = "manufacturing.execute";
    public const string ManufacturingCostView = "manufacturing.cost.view";
    public const string ManufacturingPrintersManage = "manufacturing.printers.manage";
    public const string ManufacturingOrdersManage = "manufacturing.orders.manage";
    public const string ManufacturingQuotesManage = "manufacturing.quotes.manage";
    public const string ManufacturingCostsView = "manufacturing.costs.view";
    public const string ManufacturingQualityApprove = "manufacturing.quality.approve";

    // Projetos Digitais
    public const string ProjectsView = "projects.view";
    public const string ProjectsManage = "projects.manage";
    public const string ProjectsCostView = "projects.cost.view";
    public const string ProjectsBillingManage = "projects.billing.manage";

    // Fiscal
    public const string FiscalDocumentsView = "fiscal.documents.view";
    public const string FiscalIssue = "fiscal.issue";
    public const string FiscalCancel = "fiscal.cancel";
    public const string FiscalSettingsManage = "fiscal.settings.manage";

    // Administração & Auditoria
    public const string AccessManage = "access.manage";
    public const string AuditView = "audit.view";
    public const string AutomationManage = "automation.manage";

    // Mensageria & Notificações (MOD-09)
    public const string MessagingView = "messaging.view";
    public const string MessagingSend = "messaging.send";
    public const string MessagingTemplatesManage = "messaging.templates.manage";
    public const string MessagingChannelsManage = "messaging.channels.manage";
    public const string MessagingConversationsView = "messaging.conversations.view";
    public const string MessagingConversationsReply = "messaging.conversations.reply";
    public const string MessagingNotificationsView = "messaging.notifications.view";

    public static readonly IReadOnlyCollection<string> All = typeof(PermissionCatalog)
        .GetFields(System.Reflection.BindingFlags.Public | System.Reflection.BindingFlags.Static)
        .Where(f => f.IsLiteral && !f.IsInitOnly && f.FieldType == typeof(string))
        .Select(f => (string)f.GetValue(null)!)
        .ToList();
}
