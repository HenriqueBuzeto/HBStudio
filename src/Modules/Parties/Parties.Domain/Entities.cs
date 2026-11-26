using System.Text.RegularExpressions;
using BuildingBlocks.Domain;

namespace Parties.Domain;

public enum PartyType
{
    Individual = 1, // Pessoa Física
    LegalEntity = 2 // Pessoa Jurídica
}

public class Party : TenantEntity
{
    public PartyType Type { get; private set; }
    public string Name { get; private set; } // Nome Completo ou Razão Social
    public string? TradeName { get; private set; } // Nome Social ou Nome Fantasia
    public string? DocumentNumber { get; private set; } // CPF ou CNPJ normalizado (somente números)
    public string? StateRegistration { get; private set; } // Inscrição Estadual
    public string? MunicipalRegistration { get; private set; } // Inscrição Municipal
    public DateTime? BirthDate { get; private set; }
    public bool IsActive { get; private set; } = true;
    public string? Notes { get; private set; }

    public CustomerProfile? CustomerProfile { get; private set; }
    public SupplierProfile? SupplierProfile { get; private set; }

    private readonly List<PartyContact> _contacts = [];
    public IReadOnlyCollection<PartyContact> Contacts => _contacts.AsReadOnly();

    private readonly List<PartyAddress> _addresses = [];
    public IReadOnlyCollection<PartyAddress> Addresses => _addresses.AsReadOnly();

    private readonly List<CustomerEquipment> _equipments = [];
    public IReadOnlyCollection<CustomerEquipment> Equipments => _equipments.AsReadOnly();

    private readonly List<PartyConsentRecord> _consents = [];
    public IReadOnlyCollection<PartyConsentRecord> Consents => _consents.AsReadOnly();

    private Party() { Name = string.Empty; }

    public Party(
        Guid tenantId,
        PartyType type,
        string name,
        string? tradeName = null,
        string? documentNumber = null,
        string? stateRegistration = null,
        string? municipalRegistration = null,
        DateTime? birthDate = null,
        string? notes = null) : base(tenantId)
    {
        if (string.IsNullOrWhiteSpace(name))
            throw new ArgumentException("O nome ou razão social é obrigatório.", nameof(name));

        Type = type;
        Name = name.Trim();
        TradeName = string.IsNullOrWhiteSpace(tradeName) ? null : tradeName.Trim();
        DocumentNumber = NormalizeDocument(documentNumber);
        StateRegistration = string.IsNullOrWhiteSpace(stateRegistration) ? null : stateRegistration.Trim();
        MunicipalRegistration = string.IsNullOrWhiteSpace(municipalRegistration) ? null : municipalRegistration.Trim();
        if (birthDate.HasValue && (type != PartyType.Individual || birthDate.Value.Date < new DateTime(1900, 1, 1) || birthDate.Value.Date > DateTime.UtcNow.Date))
            throw new ArgumentException("Data de nascimento inválida para pessoa física.", nameof(birthDate));
        BirthDate = birthDate.HasValue ? DateTime.SpecifyKind(birthDate.Value.Date, DateTimeKind.Utc) : null;
        Notes = notes?.Trim();

        ValidateDocument();
    }

    public static string? NormalizeDocument(string? doc)
    {
        if (string.IsNullOrWhiteSpace(doc)) return null;
        var clean = Regex.Replace(doc, @"[^\d]", "");
        return string.IsNullOrEmpty(clean) ? null : clean;
    }

    private void ValidateDocument()
    {
        if (string.IsNullOrEmpty(DocumentNumber)) return;

        if (Type == PartyType.Individual && DocumentNumber.Length != 11)
            throw new ArgumentException("CPF deve conter exatamente 11 dígitos numéricos.", nameof(DocumentNumber));

        if (Type == PartyType.LegalEntity && DocumentNumber.Length != 14)
            throw new ArgumentException("CNPJ deve conter exatamente 14 dígitos numéricos.", nameof(DocumentNumber));
    }

    public void EnableCustomerProfile(string? internalNotes = null)
    {
        CustomerProfile ??= new CustomerProfile(TenantId, Id, internalNotes);
    }

    public void EnableSupplierProfile(string? supplyCategories = null, string? paymentTerms = null)
    {
        SupplierProfile ??= new SupplierProfile(TenantId, Id, supplyCategories, paymentTerms);
    }

    public PartyContact AddContact(string name, string? email, string? phone, string? whatsapp, bool isPrimary = false)
    {
        if (isPrimary)
        {
            foreach (var c in _contacts) c.RemovePrimary();
        }

        var contact = new PartyContact(TenantId, Id, name, email, phone, whatsapp, isPrimary);
        _contacts.Add(contact);
        return contact;
    }

    public PartyAddress AddAddress(string street, string number, string? complement, string neighborhood, string city, string state, string postalCode, bool isPrimary = false)
    {
        if (isPrimary)
        {
            foreach (var a in _addresses) a.RemovePrimary();
        }

        var address = new PartyAddress(TenantId, Id, street, number, complement, neighborhood, city, state, postalCode, isPrimary);
        _addresses.Add(address);
        return address;
    }

    public CustomerEquipment AddEquipment(string equipmentType, string brand, string model, string? serialNumber, string? imei1, string? imei2, string? color, string? notes)
    {
        var eq = new CustomerEquipment(TenantId, Id, equipmentType, brand, model, serialNumber, imei1, imei2, color, notes);
        _equipments.Add(eq);
        return eq;
    }

    public PartyConsentRecord RecordConsent(string channel, string purpose, bool isOptIn, string origin, string? evidence = null)
    {
        var consent = new PartyConsentRecord(TenantId, Id, channel, purpose, isOptIn, origin, evidence);
        _consents.Add(consent);
        return consent;
    }

    public void UpdateGeneralInfo(string name, string? tradeName, string? notes)
    {
        if (string.IsNullOrWhiteSpace(name))
            throw new ArgumentException("Nome não pode ser vazio.", nameof(name));

        Name = name.Trim();
        TradeName = string.IsNullOrWhiteSpace(tradeName) ? null : tradeName.Trim();
        Notes = notes?.Trim();
        UpdatedAtUtc = DateTime.UtcNow;
    }

    public void SetActiveStatus(bool active)
    {
        IsActive = active;
        UpdatedAtUtc = DateTime.UtcNow;
    }
}

public class CustomerProfile : TenantEntity
{
    public Guid PartyId { get; private set; }
    public string? InternalNotes { get; private set; }
    public decimal TotalSalesValue { get; private set; } = 0m;
    public int CompletedRepairsCount { get; private set; } = 0;

    private CustomerProfile() { }

    public CustomerProfile(Guid tenantId, Guid partyId, string? internalNotes = null) : base(tenantId)
    {
        PartyId = partyId;
        InternalNotes = internalNotes;
    }
}

public class SupplierProfile : TenantEntity
{
    public Guid PartyId { get; private set; }
    public string? SupplyCategories { get; private set; } // Categorias de fornecimento
    public string? PaymentTerms { get; private set; } // Condições comerciais de pagamento
    public int LeadTimeDays { get; private set; } = 0; // Prazo médio de entrega

    private SupplierProfile() { }

    public SupplierProfile(Guid tenantId, Guid partyId, string? supplyCategories, string? paymentTerms, int leadTimeDays = 0) : base(tenantId)
    {
        PartyId = partyId;
        SupplyCategories = supplyCategories;
        PaymentTerms = paymentTerms;
        LeadTimeDays = leadTimeDays;
    }
}

public class PartyContact : TenantEntity
{
    public Guid PartyId { get; private set; }
    public string Name { get; private set; }
    public string? Email { get; private set; }
    public string? Phone { get; private set; }
    public string? WhatsApp { get; private set; }
    public bool IsPrimary { get; private set; }

    private PartyContact() { Name = string.Empty; }

    public PartyContact(Guid tenantId, Guid partyId, string name, string? email, string? phone, string? whatsapp, bool isPrimary = false) : base(tenantId)
    {
        if (string.IsNullOrWhiteSpace(name)) throw new ArgumentException("Nome do contato obrigatório.", nameof(name));
        PartyId = partyId;
        Name = name.Trim();
        Email = email?.Trim().ToLowerInvariant();
        Phone = Party.NormalizeDocument(phone);
        WhatsApp = Party.NormalizeDocument(whatsapp);
        IsPrimary = isPrimary;
    }

    public void RemovePrimary() => IsPrimary = false;
}

public class PartyAddress : TenantEntity
{
    public Guid PartyId { get; private set; }
    public string Street { get; private set; }
    public string Number { get; private set; }
    public string? Complement { get; private set; }
    public string Neighborhood { get; private set; }
    public string City { get; private set; }
    public string State { get; private set; }
    public string PostalCode { get; private set; }
    public bool IsPrimary { get; private set; }

    private PartyAddress() { Street = string.Empty; Number = string.Empty; Neighborhood = string.Empty; City = string.Empty; State = string.Empty; PostalCode = string.Empty; }

    public PartyAddress(Guid tenantId, Guid partyId, string street, string number, string? complement, string neighborhood, string city, string state, string postalCode, bool isPrimary = false) : base(tenantId)
    {
        PartyId = partyId;
        Street = street.Trim();
        Number = number.Trim();
        Complement = complement?.Trim();
        Neighborhood = neighborhood.Trim();
        City = city.Trim();
        State = state.Trim().ToUpperInvariant();
        PostalCode = Party.NormalizeDocument(postalCode) ?? string.Empty;
        IsPrimary = isPrimary;
    }

    public void RemovePrimary() => IsPrimary = false;
}

public class CustomerEquipment : TenantEntity
{
    public Guid PartyId { get; private set; }
    public string EquipmentType { get; private set; } // Celular, Notebook, PC Gamer, Videogame, etc.
    public string Brand { get; private set; } // Apple, Samsung, Dell, etc.
    public string Model { get; private set; } // iPhone 14 Pro Max, Inspiron 15, etc.
    public string? SerialNumber { get; private set; }
    public string? Imei1 { get; private set; }
    public string? Imei2 { get; private set; }
    public string? Color { get; private set; }
    public string? Notes { get; private set; }

    private CustomerEquipment() { EquipmentType = string.Empty; Brand = string.Empty; Model = string.Empty; }

    public CustomerEquipment(Guid tenantId, Guid partyId, string equipmentType, string brand, string model, string? serialNumber, string? imei1, string? imei2, string? color, string? notes) : base(tenantId)
    {
        if (string.IsNullOrWhiteSpace(equipmentType)) throw new ArgumentException("Tipo de equipamento obrigatório.", nameof(equipmentType));
        if (string.IsNullOrWhiteSpace(brand)) throw new ArgumentException("Marca obrigatória.", nameof(brand));
        if (string.IsNullOrWhiteSpace(model)) throw new ArgumentException("Modelo obrigatório.", nameof(model));

        PartyId = partyId;
        EquipmentType = equipmentType.Trim();
        Brand = brand.Trim();
        Model = model.Trim();
        SerialNumber = serialNumber?.Trim();
        Imei1 = Party.NormalizeDocument(imei1);
        Imei2 = Party.NormalizeDocument(imei2);
        Color = color?.Trim();
        Notes = notes?.Trim();
    }
}

public class PartyConsentRecord : TenantEntity
{
    public Guid PartyId { get; private set; }
    public string Channel { get; private set; } // WhatsApp, Email, SMS
    public string Purpose { get; private set; } // ServiceUpdates (Operacional), Marketing (Promocional)
    public bool IsOptIn { get; private set; } // true = Consentiu, false = Revogou / Oposição
    public string Origin { get; private set; } // Balcão, Site, Termo de OS
    public string? Evidence { get; private set; } // Assinatura, IP, Protocolo
    public DateTime EventDateUtc { get; private set; } = DateTime.UtcNow;

    private PartyConsentRecord() { Channel = string.Empty; Purpose = string.Empty; Origin = string.Empty; }

    public PartyConsentRecord(Guid tenantId, Guid partyId, string channel, string purpose, bool isOptIn, string origin, string? evidence = null) : base(tenantId)
    {
        PartyId = partyId;
        Channel = channel.Trim().ToUpperInvariant();
        Purpose = purpose.Trim();
        IsOptIn = isOptIn;
        Origin = origin.Trim();
        Evidence = evidence?.Trim();
        EventDateUtc = DateTime.UtcNow;
    }
}
