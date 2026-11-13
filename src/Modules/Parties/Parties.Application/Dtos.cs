using Parties.Domain;

namespace Parties.Application;

public record PartyResponse(
    Guid Id,
    PartyType Type,
    string Name,
    string? TradeName,
    string? DocumentNumber,
    string? StateRegistration,
    string? MunicipalRegistration,
    DateTime? BirthDate,
    bool IsActive,
    string? Notes,
    bool IsCustomer,
    bool IsSupplier,
    IReadOnlyList<PartyContactResponse> Contacts,
    IReadOnlyList<PartyAddressResponse> Addresses,
    IReadOnlyList<CustomerEquipmentResponse> Equipments,
    IReadOnlyList<PartyConsentResponse> Consents,
    DateTime CreatedAtUtc,
    uint Version
);

public record PartyContactResponse(Guid Id, string Name, string? Email, string? Phone, string? WhatsApp, bool IsPrimary);
public record PartyAddressResponse(Guid Id, string Street, string Number, string? Complement, string Neighborhood, string City, string State, string PostalCode, bool IsPrimary);
public record CustomerEquipmentResponse(Guid Id, string EquipmentType, string Brand, string Model, string? SerialNumber, string? Imei1, string? Imei2, string? Color, string? Notes);
public record PartyConsentResponse(Guid Id, string Channel, string Purpose, bool IsOptIn, string Origin, DateTime EventDateUtc);

public record CreatePartyRequest(
    PartyType Type,
    string Name,
    string? TradeName,
    string? DocumentNumber,
    string? StateRegistration,
    string? MunicipalRegistration,
    DateTime? BirthDate,
    string? Notes,
    bool EnableCustomer,
    bool EnableSupplier,
    string? CustomerNotes,
    string? SupplyCategories,
    string? PaymentTerms,
    string? PrimaryPhone,
    string? PrimaryEmail
);

public record UpdatePartyRequest(
    string Name,
    string? TradeName,
    string? Notes,
    uint ExpectedVersion
);

public record AddEquipmentRequest(
    string EquipmentType,
    string Brand,
    string Model,
    string? SerialNumber,
    string? Imei1,
    string? Imei2,
    string? Color,
    string? Notes
);

public record RecordConsentRequest(
    string Channel,
    string Purpose,
    bool IsOptIn,
    string Origin,
    string? Evidence
);

public record AddContactRequest(
    string Name,
    string? Email,
    string? Phone,
    string? WhatsApp,
    bool IsPrimary
);

public record AddAddressRequest(
    string Street,
    string Number,
    string? Complement,
    string Neighborhood,
    string City,
    string State,
    string PostalCode,
    bool IsPrimary
);
