using System;
using System.Collections.Generic;
using BuildingBlocks.Domain;

namespace Fiscal.Domain.Entities;

public enum FiscalEnvironment
{
    Homologation = 1,
    Production = 2
}

public enum FiscalDocumentType
{
    NFCe = 65,
    NFe = 55
}

public enum FiscalDocumentStatus
{
    Draft = 1,
    Signed = 2,
    Transmitted = 3,
    Authorized = 4,
    Rejected = 5,
    Denied = 6,
    Cancelled = 7,
    ContingencyOffline = 8
}

public enum TaxRegime
{
    SimplesNacional = 1,
    SimplesNacionalExcessoSublimite = 2,
    RegimeNormal = 3
}

public class FiscalEstablishment : TenantEntity
{
    public Guid BranchId { get; private set; }
    public string CorporateName { get; private set; } = string.Empty;
    public string TradeName { get; private set; } = string.Empty;
    public string Cnpj { get; private set; } = string.Empty;
    public string StateRegistration { get; private set; } = string.Empty; // IE
    public string MunicipalRegistration { get; private set; } = string.Empty;
    public string Cnae { get; private set; } = string.Empty;
    public TaxRegime Regime { get; private set; } = TaxRegime.SimplesNacional;

    // Endereço Fiscal Oficial
    public string Street { get; private set; } = string.Empty;
    public string Number { get; private set; } = string.Empty;
    public string? Complement { get; private set; }
    public string Neighborhood { get; private set; } = string.Empty;
    public string CityCodeIbge { get; private set; } = "3550308"; // Ex: São Paulo
    public string CityName { get; private set; } = "São Paulo";
    public string State { get; private set; } = "SP";
    public string PostalCode { get; private set; } = "01310-200";

    // Configurações Operacionais de Emissão
    public FiscalEnvironment Environment { get; private set; } = FiscalEnvironment.Homologation;
    public int NfceDefaultSeries { get; private set; } = 1;
    public int NfceNextNumber { get; private set; } = 1;
    public bool IsNfceEnabled { get; private set; } = true;
    public bool IsActive { get; private set; } = true;

    private FiscalEstablishment() { }

    public FiscalEstablishment(
        Guid tenantId,
        Guid branchId,
        string corporateName,
        string tradeName,
        string cnpj,
        string stateRegistration,
        TaxRegime regime,
        string street,
        string number,
        string neighborhood,
        string cityCodeIbge,
        string cityName,
        string state,
        string postalCode) : base(tenantId)
    {
        BranchId = branchId;
        CorporateName = corporateName.Trim();
        TradeName = tradeName.Trim();
        Cnpj = cnpj.Trim().Replace(".", "").Replace("/", "").Replace("-", "");
        StateRegistration = stateRegistration.Trim();
        Regime = regime;
        Street = street.Trim();
        Number = number.Trim();
        Neighborhood = neighborhood.Trim();
        CityCodeIbge = cityCodeIbge.Trim();
        CityName = cityName.Trim();
        State = state.Trim().ToUpperInvariant();
        PostalCode = postalCode.Trim();
    }

    public void UpdateSeriesAndNumber(int series, int nextNumber)
    {
        NfceDefaultSeries = series;
        NfceNextNumber = nextNumber;
        UpdatedAtUtc = DateTime.UtcNow;
    }

    public void SwitchEnvironment(FiscalEnvironment env)
    {
        Environment = env;
        UpdatedAtUtc = DateTime.UtcNow;
    }

    public int ReserveNextNfceNumber()
    {
        int num = NfceNextNumber;
        NfceNextNumber++;
        UpdatedAtUtc = DateTime.UtcNow;
        return num;
    }
}

public class FiscalCertificate : TenantEntity
{
    public Guid EstablishmentId { get; private set; }
    public string SubjectName { get; private set; } = string.Empty;
    public string Thumbprint { get; private set; } = string.Empty;
    public string Cnpj { get; private set; } = string.Empty;
    public DateTime ValidFromUtc { get; private set; }
    public DateTime ValidUntilUtc { get; private set; }
    
    // Criptografia e Armazenamento Seguro
    public byte[] EncryptedRawData { get; private set; } = [];
    public byte[] EncryptedPassword { get; private set; } = [];
    public string KeyIvBase64 { get; private set; } = string.Empty;
    public bool IsActive { get; private set; } = true;

    private FiscalCertificate() { }

    public FiscalCertificate(
        Guid tenantId,
        Guid establishmentId,
        string subjectName,
        string thumbprint,
        string cnpj,
        DateTime validFromUtc,
        DateTime validUntilUtc,
        byte[] encryptedRawData,
        byte[] encryptedPassword,
        string keyIvBase64) : base(tenantId)
    {
        EstablishmentId = establishmentId;
        SubjectName = subjectName;
        Thumbprint = thumbprint;
        Cnpj = cnpj;
        ValidFromUtc = validFromUtc;
        ValidUntilUtc = validUntilUtc;
        EncryptedRawData = encryptedRawData;
        EncryptedPassword = encryptedPassword;
        KeyIvBase64 = keyIvBase64;
    }

    public void Deactivate()
    {
        IsActive = false;
        UpdatedAtUtc = DateTime.UtcNow;
    }
}

public class FiscalCsc : TenantEntity
{
    public Guid EstablishmentId { get; private set; }
    public string CscId { get; private set; } = "000001"; // ID do Token CSC (ex: 1, 000001)
    public byte[] EncryptedCscToken { get; private set; } = []; // Valor criptografado
    public string CscTokenMasked { get; private set; } = string.Empty; // Ex: ABC***XYZ
    public FiscalEnvironment Environment { get; private set; }
    public bool IsActive { get; private set; } = true;

    private FiscalCsc() { }

    public FiscalCsc(
        Guid tenantId,
        Guid establishmentId,
        string cscId,
        byte[] encryptedCscToken,
        string cscTokenMasked,
        FiscalEnvironment environment) : base(tenantId)
    {
        EstablishmentId = establishmentId;
        CscId = cscId.Trim();
        EncryptedCscToken = encryptedCscToken;
        CscTokenMasked = cscTokenMasked;
        Environment = environment;
    }

    public void Revoke()
    {
        IsActive = false;
        UpdatedAtUtc = DateTime.UtcNow;
    }
}

public class FiscalDocument : TenantEntity
{
    public Guid EstablishmentId { get; private set; }
    public Guid? SaleId { get; private set; } // Vínculo com a venda no PDV
    public FiscalDocumentType DocumentType { get; private set; } = FiscalDocumentType.NFCe;
    public FiscalEnvironment Environment { get; private set; }
    public FiscalDocumentStatus Status { get; private set; } = FiscalDocumentStatus.Draft;
    
    public int Series { get; private set; }
    public int Number { get; private set; }
    public string AccessKey { get; private set; } = string.Empty; // Chave de 44 dígitos
    public DateTime IssuedAtUtc { get; private set; }
    
    // Dados Comerciais e Totais Fiscais
    public decimal TotalAmount { get; private set; }
    public decimal TotalDiscounts { get; private set; }
    public decimal TotalNetProductAmount { get; private set; }
    public decimal TotalTaxesEstimated { get; private set; }
    
    // Destinatário (Consumidor na NFC-e)
    public string? RecipientCpf { get; private set; }
    public string? RecipientName { get; private set; }

    // Protocolo e Resposta SEFAZ
    public string? ProtocolNumber { get; private set; }
    public DateTime? ProtocolReceivedAtUtc { get; private set; }
    public int? SefazStatusCode { get; private set; }
    public string? SefazStatusReason { get; private set; }
    public string? QrCodeUrl { get; private set; }
    public string? DanfeXmlContent { get; private set; }
    public string? CancellationXmlContent { get; private set; }
    public string? CancellationReason { get; private set; }
    public DateTime? CancelledAtUtc { get; private set; }

    private readonly List<FiscalDocumentItem> _items = [];
    public IReadOnlyCollection<FiscalDocumentItem> Items => _items.AsReadOnly();

    private FiscalDocument() { }

    public FiscalDocument(
        Guid tenantId,
        Guid establishmentId,
        Guid? saleId,
        FiscalDocumentType documentType,
        FiscalEnvironment environment,
        int series,
        int number,
        string accessKey,
        decimal totalAmount,
        decimal totalDiscounts,
        string? recipientCpf = null,
        string? recipientName = null) : base(tenantId)
    {
        EstablishmentId = establishmentId;
        SaleId = saleId;
        DocumentType = documentType;
        Environment = environment;
        Series = series;
        Number = number;
        AccessKey = accessKey.Trim();
        IssuedAtUtc = DateTime.UtcNow;
        TotalAmount = totalAmount;
        TotalDiscounts = totalDiscounts;
        TotalNetProductAmount = totalAmount - totalDiscounts;
        RecipientCpf = recipientCpf;
        RecipientName = recipientName;
        Status = FiscalDocumentStatus.Draft;
    }

    public void AddItem(FiscalDocumentItem item)
    {
        _items.Add(item);
    }

    public void SetAuthorized(string protocolNumber, int statusCode, string statusReason, string qrCodeUrl, string xmlContent)
    {
        ProtocolNumber = protocolNumber;
        SefazStatusCode = statusCode;
        SefazStatusReason = statusReason;
        QrCodeUrl = qrCodeUrl;
        DanfeXmlContent = xmlContent;
        ProtocolReceivedAtUtc = DateTime.UtcNow;
        Status = FiscalDocumentStatus.Authorized;
        UpdatedAtUtc = DateTime.UtcNow;
    }

    public void SetRejected(int statusCode, string statusReason)
    {
        SefazStatusCode = statusCode;
        SefazStatusReason = statusReason;
        Status = FiscalDocumentStatus.Rejected;
        UpdatedAtUtc = DateTime.UtcNow;
    }

    public void Cancel(string protocolNumber, string reason, string xmlContent)
    {
        if (Status != FiscalDocumentStatus.Authorized)
            throw new InvalidOperationException("Apenas documentos autorizados podem ser cancelados.");

        ProtocolNumber = protocolNumber;
        CancellationReason = reason;
        CancellationXmlContent = xmlContent;
        CancelledAtUtc = DateTime.UtcNow;
        Status = FiscalDocumentStatus.Cancelled;
        UpdatedAtUtc = DateTime.UtcNow;
    }
}

public class FiscalDocumentItem : BaseEntity
{
    public Guid FiscalDocumentId { get; private set; }
    public int ItemIndex { get; private set; }
    public Guid? SkuId { get; private set; }
    public string ProductCode { get; private set; } = string.Empty;
    public string Description { get; private set; } = string.Empty;
    public string Ncm { get; private set; } = string.Empty;
    public string? Cest { get; private set; }
    public string Cfop { get; private set; } = "5102"; // Venda balcão padrão dentro do estado
    public string UnitOfMeasure { get; private set; } = "UN";
    public decimal Quantity { get; private set; }
    public decimal UnitPrice { get; private set; }
    public decimal TotalGrossAmount { get; private set; }
    public decimal DiscountAmount { get; private set; }
    public decimal NetAmount { get; private set; }

    // Rastreabilidade IMEI (Smartphone / Aparelho Usado)
    public string? SerialOrImei { get; private set; }

    // Dados Tributários
    public string Origem { get; private set; } = "0"; // Nacional
    public string Csosn { get; private set; } = "102"; // Tributada pelo Simples Nacional sem permissão de crédito
    public decimal EstimatedTaxRate { get; private set; } // Lei da Transparência (IBPT)

    private FiscalDocumentItem() { }

    public FiscalDocumentItem(
        Guid fiscalDocumentId,
        int itemIndex,
        Guid? skuId,
        string productCode,
        string description,
        string ncm,
        string? cest,
        string cfop,
        decimal quantity,
        decimal unitPrice,
        decimal discountAmount,
        string? serialOrImei = null,
        string csosn = "102",
        decimal estimatedTaxRate = 18.0m)
    {
        FiscalDocumentId = fiscalDocumentId;
        ItemIndex = itemIndex;
        SkuId = skuId;
        ProductCode = productCode.Trim();
        Description = description.Trim();
        Ncm = ncm.Trim().Replace(".", "");
        Cest = cest?.Trim()?.Replace(".", "");
        Cfop = cfop.Trim();
        Quantity = quantity;
        UnitPrice = unitPrice;
        DiscountAmount = discountAmount;
        TotalGrossAmount = quantity * unitPrice;
        NetAmount = TotalGrossAmount - discountAmount;
        SerialOrImei = serialOrImei;
        Csosn = csosn;
        EstimatedTaxRate = estimatedTaxRate;
    }
}

public class InboundFiscalDocument : TenantEntity
{
    public string AccessKey { get; private set; } = string.Empty;
    public int Number { get; private set; }
    public int Series { get; private set; }
    public DateTime IssuedAtUtc { get; private set; }
    public DateTime ReceivedAtUtc { get; private set; }
    
    // Fornecedor / Emitente
    public string SupplierCnpj { get; private set; } = string.Empty;
    public string SupplierName { get; private set; } = string.Empty;
    public string? SupplierStateRegistration { get; private set; }
    
    // Destinatário
    public string RecipientCnpj { get; private set; } = string.Empty;

    // Totais
    public decimal TotalProductsAmount { get; private set; }
    public decimal TotalInvoiceAmount { get; private set; }
    public decimal TotalIcmsAmount { get; private set; }

    // XML Integral Original Protegido
    public string RawXmlContent { get; private set; } = string.Empty;
    public Guid? AssociatedPurchaseOrderId { get; private set; }
    public bool IsConciliated { get; private set; } = false;

    private readonly List<InboundFiscalItem> _items = [];
    public IReadOnlyCollection<InboundFiscalItem> Items => _items.AsReadOnly();

    private InboundFiscalDocument() { }

    public InboundFiscalDocument(
        Guid tenantId,
        string accessKey,
        int number,
        int series,
        DateTime issuedAtUtc,
        string supplierCnpj,
        string supplierName,
        string? supplierStateRegistration,
        string recipientCnpj,
        decimal totalProductsAmount,
        decimal totalInvoiceAmount,
        decimal totalIcmsAmount,
        string rawXmlContent) : base(tenantId)
    {
        AccessKey = accessKey.Trim();
        Number = number;
        Series = series;
        IssuedAtUtc = issuedAtUtc;
        ReceivedAtUtc = DateTime.UtcNow;
        SupplierCnpj = supplierCnpj.Trim();
        SupplierName = supplierName.Trim();
        SupplierStateRegistration = supplierStateRegistration;
        RecipientCnpj = recipientCnpj.Trim();
        TotalProductsAmount = totalProductsAmount;
        TotalInvoiceAmount = totalInvoiceAmount;
        TotalIcmsAmount = totalIcmsAmount;
        RawXmlContent = rawXmlContent;
    }

    public void AddItem(InboundFiscalItem item)
    {
        _items.Add(item);
    }

    public void ConciliateWithPurchaseOrder(Guid purchaseOrderId)
    {
        AssociatedPurchaseOrderId = purchaseOrderId;
        IsConciliated = true;
        UpdatedAtUtc = DateTime.UtcNow;
    }
}

public class InboundFiscalItem : BaseEntity
{
    public Guid InboundFiscalDocumentId { get; private set; }
    public int ItemIndex { get; private set; }
    public string SupplierProductCode { get; private set; } = string.Empty;
    public string ProductDescription { get; private set; } = string.Empty;
    public string Ncm { get; private set; } = string.Empty;
    public string? Cfop { get; private set; }
    public decimal Quantity { get; private set; }
    public decimal UnitCost { get; private set; }
    public decimal TotalCost { get; private set; }
    public Guid? LinkedCatalogSkuId { get; private set; }

    private InboundFiscalItem() { }

    public InboundFiscalItem(
        Guid inboundFiscalDocumentId,
        int itemIndex,
        string supplierProductCode,
        string productDescription,
        string ncm,
        string? cfop,
        decimal quantity,
        decimal unitCost,
        decimal totalCost)
    {
        InboundFiscalDocumentId = inboundFiscalDocumentId;
        ItemIndex = itemIndex;
        SupplierProductCode = supplierProductCode.Trim();
        ProductDescription = productDescription.Trim();
        Ncm = ncm.Trim();
        Cfop = cfop?.Trim();
        Quantity = quantity;
        UnitCost = unitCost;
        TotalCost = totalCost;
    }

    public void LinkToSku(Guid skuId)
    {
        LinkedCatalogSkuId = skuId;
    }
}
