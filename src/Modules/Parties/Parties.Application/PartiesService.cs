using Microsoft.EntityFrameworkCore;
using BuildingBlocks.Application;
using BuildingBlocks.Infrastructure;
using Parties.Domain;

namespace Parties.Application;

public interface IPartiesService
{
    Task<IReadOnlyList<PartyResponse>> ListAsync(string? search, bool? onlyCustomers, bool? onlySuppliers, int page = 1, int pageSize = 20, CancellationToken ct = default);
    Task<PartyResponse?> GetByIdAsync(Guid id, CancellationToken ct = default);
    Task<PartyResponse> CreateAsync(CreatePartyRequest request, CancellationToken ct = default);
    Task<PartyResponse> UpdateAsync(Guid id, UpdatePartyRequest request, CancellationToken ct = default);
    Task SetStatusAsync(Guid id, bool isActive, CancellationToken ct = default);
    Task<CustomerEquipmentResponse> AddEquipmentAsync(Guid partyId, AddEquipmentRequest request, CancellationToken ct = default);
    Task<PartyConsentResponse> RecordConsentAsync(Guid partyId, RecordConsentRequest request, CancellationToken ct = default);
    Task<PartyContactResponse> AddContactAsync(Guid partyId, AddContactRequest request, CancellationToken ct = default);
    Task<PartyAddressResponse> AddAddressAsync(Guid partyId, AddAddressRequest request, CancellationToken ct = default);
}

public class PartiesService : IPartiesService
{
    private readonly AppDbContext _dbContext;
    private readonly IExecutionContext _executionContext;

    public PartiesService(AppDbContext dbContext, IExecutionContext executionContext)
    {
        _dbContext = dbContext;
        _executionContext = executionContext;
    }

    public async Task<IReadOnlyList<PartyResponse>> ListAsync(string? search, bool? onlyCustomers, bool? onlySuppliers, int page = 1, int pageSize = 20, CancellationToken ct = default)
    {
        var query = _dbContext.Parties
            .Include(p => p.CustomerProfile)
            .Include(p => p.SupplierProfile)
            .Include(p => p.Contacts)
            .Include(p => p.Addresses)
            .Include(p => p.Equipments)
            .Include(p => p.Consents)
            .AsNoTracking();

        if (!string.IsNullOrWhiteSpace(search))
        {
            var cleanSearch = search.Trim().ToLower();
            query = query.Where(p => p.Name.ToLower().Contains(cleanSearch) || 
                                     (p.TradeName != null && p.TradeName.ToLower().Contains(cleanSearch)) ||
                                     (p.DocumentNumber != null && p.DocumentNumber.Contains(cleanSearch)));
        }

        if (onlyCustomers == true)
        {
            query = query.Where(p => p.CustomerProfile != null);
        }

        if (onlySuppliers == true)
        {
            query = query.Where(p => p.SupplierProfile != null);
        }

        var items = await query
            .OrderByDescending(p => p.CreatedAtUtc)
            .Skip((page - 1) * pageSize)
            .Take(pageSize)
            .ToListAsync(ct);

        return items.Select(MapToResponse).ToList();
    }

    public async Task<PartyResponse?> GetByIdAsync(Guid id, CancellationToken ct = default)
    {
        var party = await _dbContext.Parties
            .Include(p => p.CustomerProfile)
            .Include(p => p.SupplierProfile)
            .Include(p => p.Contacts)
            .Include(p => p.Addresses)
            .Include(p => p.Equipments)
            .Include(p => p.Consents)
            .FirstOrDefaultAsync(p => p.Id == id, ct);

        return party == null ? null : MapToResponse(party);
    }

    public async Task<PartyResponse> CreateAsync(CreatePartyRequest request, CancellationToken ct = default)
    {
        var party = new Party(
            _executionContext.TenantId,
            request.Type,
            request.Name,
            request.TradeName,
            request.DocumentNumber,
            request.StateRegistration,
            request.MunicipalRegistration,
            request.BirthDate,
            request.Notes
        );

        if (request.EnableCustomer)
        {
            party.EnableCustomerProfile(request.CustomerNotes);
        }

        if (request.EnableSupplier)
        {
            party.EnableSupplierProfile(request.SupplyCategories, request.PaymentTerms);
        }

        if (!string.IsNullOrWhiteSpace(request.PrimaryPhone) || !string.IsNullOrWhiteSpace(request.PrimaryEmail))
        {
            party.AddContact(
                name: request.Name,
                email: request.PrimaryEmail,
                phone: request.PrimaryPhone,
                whatsapp: request.PrimaryPhone,
                isPrimary: true
            );
        }

        _dbContext.Parties.Add(party);
        await _dbContext.SaveChangesAsync(ct);

        return MapToResponse(party);
    }

    public async Task<PartyResponse> UpdateAsync(Guid id, UpdatePartyRequest request, CancellationToken ct = default)
    {
        var party = await _dbContext.Parties
            .Include(p => p.CustomerProfile)
            .Include(p => p.SupplierProfile)
            .Include(p => p.Contacts)
            .Include(p => p.Addresses)
            .Include(p => p.Equipments)
            .Include(p => p.Consents)
            .FirstOrDefaultAsync(p => p.Id == id, ct);

        if (party == null)
            throw new KeyNotFoundException($"Pessoa {id} não encontrada.");

        if (request.ExpectedVersion != 0 && party.Version != request.ExpectedVersion)
        {
            throw new DbUpdateConcurrencyException("Conflito de concorrência detectado: o registro foi alterado por outro usuário.");
        }

        party.UpdateGeneralInfo(request.Name, request.TradeName, request.Notes);
        await _dbContext.SaveChangesAsync(ct);

        return MapToResponse(party);
    }

    public async Task SetStatusAsync(Guid id, bool isActive, CancellationToken ct = default)
    {
        var party = await _dbContext.Parties.FirstOrDefaultAsync(p => p.Id == id, ct);
        if (party == null) throw new KeyNotFoundException($"Pessoa {id} não encontrada.");

        party.SetActiveStatus(isActive);
        await _dbContext.SaveChangesAsync(ct);
    }

    public async Task<CustomerEquipmentResponse> AddEquipmentAsync(Guid partyId, AddEquipmentRequest request, CancellationToken ct = default)
    {
        var party = await _dbContext.Parties.FirstOrDefaultAsync(p => p.Id == partyId, ct);
        if (party == null) throw new KeyNotFoundException($"Cliente {partyId} não encontrado.");

        var eq = party.AddEquipment(request.EquipmentType, request.Brand, request.Model, request.SerialNumber, request.Imei1, request.Imei2, request.Color, request.Notes);
        _dbContext.CustomerEquipments.Add(eq);
        await _dbContext.SaveChangesAsync(ct);

        return new CustomerEquipmentResponse(eq.Id, eq.EquipmentType, eq.Brand, eq.Model, eq.SerialNumber, eq.Imei1, eq.Imei2, eq.Color, eq.Notes);
    }

    public async Task<PartyConsentResponse> RecordConsentAsync(Guid partyId, RecordConsentRequest request, CancellationToken ct = default)
    {
        var party = await _dbContext.Parties.FirstOrDefaultAsync(p => p.Id == partyId, ct);
        if (party == null) throw new KeyNotFoundException($"Pessoa {partyId} não encontrada.");

        var c = party.RecordConsent(request.Channel, request.Purpose, request.IsOptIn, request.Origin, request.Evidence);
        _dbContext.PartyConsentRecords.Add(c);
        await _dbContext.SaveChangesAsync(ct);

        return new PartyConsentResponse(c.Id, c.Channel, c.Purpose, c.IsOptIn, c.Origin, c.EventDateUtc);
    }

    public async Task<PartyContactResponse> AddContactAsync(Guid partyId, AddContactRequest request, CancellationToken ct = default)
    {
        var party = await _dbContext.Parties.FirstOrDefaultAsync(p => p.Id == partyId, ct);
        if (party == null) throw new KeyNotFoundException($"Pessoa {partyId} não encontrada.");

        var contact = party.AddContact(request.Name, request.Email, request.Phone, request.WhatsApp, request.IsPrimary);
        _dbContext.PartyContacts.Add(contact);
        await _dbContext.SaveChangesAsync(ct);

        return new PartyContactResponse(contact.Id, contact.Name, contact.Email, contact.Phone, contact.WhatsApp, contact.IsPrimary);
    }

    public async Task<PartyAddressResponse> AddAddressAsync(Guid partyId, AddAddressRequest request, CancellationToken ct = default)
    {
        var party = await _dbContext.Parties.FirstOrDefaultAsync(p => p.Id == partyId, ct);
        if (party == null) throw new KeyNotFoundException($"Pessoa {partyId} não encontrada.");

        var address = party.AddAddress(request.Street, request.Number, request.Complement, request.Neighborhood, request.City, request.State, request.PostalCode, request.IsPrimary);
        _dbContext.PartyAddresses.Add(address);
        await _dbContext.SaveChangesAsync(ct);

        return new PartyAddressResponse(address.Id, address.Street, address.Number, address.Complement, address.Neighborhood, address.City, address.State, address.PostalCode, address.IsPrimary);
    }

    private static PartyResponse MapToResponse(Party p) => new(
        p.Id,
        p.Type,
        p.Name,
        p.TradeName,
        p.DocumentNumber,
        p.StateRegistration,
        p.MunicipalRegistration,
        p.BirthDate,
        p.IsActive,
        p.Notes,
        p.CustomerProfile != null,
        p.SupplierProfile != null,
        p.Contacts.Select(c => new PartyContactResponse(c.Id, c.Name, c.Email, c.Phone, c.WhatsApp, c.IsPrimary)).ToList(),
        p.Addresses.Select(a => new PartyAddressResponse(a.Id, a.Street, a.Number, a.Complement, a.Neighborhood, a.City, a.State, a.PostalCode, a.IsPrimary)).ToList(),
        p.Equipments.Select(e => new CustomerEquipmentResponse(e.Id, e.EquipmentType, e.Brand, e.Model, e.SerialNumber, e.Imei1, e.Imei2, e.Color, e.Notes)).ToList(),
        p.Consents.Select(c => new PartyConsentResponse(c.Id, c.Channel, c.Purpose, c.IsOptIn, c.Origin, c.EventDateUtc)).ToList(),
        p.CreatedAtUtc,
        p.Version
    );
}
