using Microsoft.EntityFrameworkCore;
using ProjectTracker.API.Data;
using ProjectTracker.API.DTOs.Logistics.Shipments;
using ProjectTracker.API.Models.Logistics.Shipments;

namespace ProjectTracker.API.Services.Logistics
{
    /// <summary>
    /// The single booking intake used by every channel: the ops "New booking" dialog, CSV,
    /// the API and the Rocket Freight client portal. Validation and creation live here so
    /// a portal booking is checked by exactly the same rules as one captured by ops.
    /// </summary>
    public interface IBookingIntakeService
    {
        List<string> Validate(CreateBookingDto dto);
        Task<(ClientBooking booking, List<Shipment> shipments)> CreateAsync(CreateBookingDto dto, int? userId, string? userName);
        Task<ShipmentAddress> ResolveAddressAsync(AddressInputDto dto, int customerId, int? userId);
    }

    public class BookingIntakeService : IBookingIntakeService
    {
        private readonly ApplicationDbContext _db;
        private readonly INumberSequenceService _seq;
        private readonly IShipmentLifecycleService _lifecycle;
        private readonly ILogger<BookingIntakeService> _logger;

        public BookingIntakeService(ApplicationDbContext db, INumberSequenceService seq, IShipmentLifecycleService lifecycle, ILogger<BookingIntakeService> logger)
        {
            _db = db; _seq = seq; _lifecycle = lifecycle; _logger = logger;
        }

        public async Task<(ClientBooking booking, List<Shipment> shipments)> CreateAsync(CreateBookingDto dto, int? userId, string? userName)
        {
            var errors = Validate(dto);
            if (errors.Count > 0) throw new BookingValidationException(errors);

            var customer = await _db.LogisticsCustomers.FindAsync(dto.CustomerId)
                ?? throw new BookingValidationException(new List<string> { "Unknown client (customerId)" });

            var source = string.IsNullOrWhiteSpace(dto.Source) ? "ops" : dto.Source.ToLower();
            var created = new List<Shipment>();
            ClientBooking booking;

            await using var tx = await _db.Database.BeginTransactionAsync();
            try
            {
                booking = new ClientBooking
                {
                    BookingNo = await _seq.NextAsync("BK"),
                    CustomerId = dto.CustomerId,
                    Source = source,
                    ClientReference = dto.ClientReference?.Trim(),
                    RequestedByName = dto.RequestedByName?.Trim(),
                    RequestedByEmail = dto.RequestedByEmail?.Trim(),
                    RequestedByPhone = dto.RequestedByPhone?.Trim(),
                    Notes = dto.Notes,
                    CreatedByUserId = userId,
                    Status = ShipmentStatus.Booked
                };
                _db.ClientBookings.Add(booking);
                await _db.SaveChangesAsync();

                foreach (var sd in dto.Shipments)
                {
                    var pickup = await ResolveAddressAsync(sd.Pickup, dto.CustomerId, userId);
                    var delivery = await ResolveAddressAsync(sd.Delivery, dto.CustomerId, userId);
                    var shipment = new Shipment
                    {
                        BookingId = booking.Id,
                        PickupAddressId = pickup.Id,
                        DeliveryAddressId = delivery.Id,
                        CollectionDate = sd.CollectionDate.Date,
                        CollectionWindowFrom = sd.CollectionWindowFrom,
                        CollectionWindowTo = sd.CollectionWindowTo,
                        RequestedDeliveryDate = sd.RequestedDeliveryDate.Date,
                        Fragile = sd.Fragile,
                        Hazardous = sd.Hazardous,
                        HazardClass = sd.Hazardous ? sd.HazardClass?.Trim() : null,
                        TemperatureRange = sd.TemperatureRange?.Trim(),
                        SpecialInstructions = sd.SpecialInstructions,
                        Status = ShipmentStatus.Booked,
                        TotalWeightKg = sd.Items.Sum(i => i.WeightKg * Math.Max(1, i.Qty)),
                        TotalPallets = sd.Items.Where(i => i.Type.Equals("pallet", StringComparison.OrdinalIgnoreCase)).Sum(i => i.Qty),
                        TotalParcels = sd.Items.Where(i => !i.Type.Equals("pallet", StringComparison.OrdinalIgnoreCase)).Sum(i => i.Qty)
                    };
                    foreach (var it in sd.Items)
                        shipment.Items.Add(new ShipmentItem
                        {
                            Type = it.Type.ToLower(), Qty = it.Qty, WeightKg = it.WeightKg,
                            LengthCm = it.LengthCm, WidthCm = it.WidthCm, HeightCm = it.HeightCm, Description = it.Description?.Trim()
                        });
                    _db.Shipments.Add(shipment);
                    created.Add(shipment);
                }
                await _db.SaveChangesAsync();
                await tx.CommitAsync();
            }
            catch
            {
                await tx.RollbackAsync();
                throw;
            }

            // Initial BOOKED event + confirmation email per shipment (outside the transaction).
            var ctx = new TransitionContext(source == "ops" ? ShipmentEventSource.Ops : ShipmentEventSource.Client, userId, userName, "Booking submitted");
            foreach (var s in created) await _lifecycle.RecordInitialAsync(s, ctx);

            _logger.LogInformation("Booking {No} ({Source}) created with {Count} shipment(s) for customer {Cust}", booking.BookingNo, source, created.Count, dto.CustomerId);
            return (booking, created);
        }

        public async Task<ShipmentAddress> ResolveAddressAsync(AddressInputDto dto, int customerId, int? userId)
        {
            if (dto.AddressId.HasValue)
            {
                var saved = await _db.ShipmentAddresses.FindAsync(dto.AddressId.Value);
                if (saved != null)
                {
                    // Portal / ops may only use their own customer's saved addresses.
                    if (saved.CustomerId.HasValue && saved.CustomerId != customerId)
                        throw new BookingValidationException(new List<string> { "That saved address belongs to a different client." });

                    // Allow per-shipment contact overrides without mutating the saved entry.
                    if (!string.IsNullOrWhiteSpace(dto.ContactName) && dto.ContactName != saved.ContactName
                        || !string.IsNullOrWhiteSpace(dto.ContactPhone) && dto.ContactPhone != saved.ContactPhone)
                    {
                        var copy = new ShipmentAddress
                        {
                            CustomerId = saved.CustomerId, Label = saved.Label, Line1 = saved.Line1, Line2 = saved.Line2, Suburb = saved.Suburb, City = saved.City,
                            Province = saved.Province, PostalCode = saved.PostalCode, Latitude = saved.Latitude, Longitude = saved.Longitude, GooglePlaceId = saved.GooglePlaceId,
                            ContactName = dto.ContactName ?? saved.ContactName, ContactPhone = dto.ContactPhone ?? saved.ContactPhone, ContactEmail = dto.ContactEmail ?? saved.ContactEmail,
                            GeofenceRadiusM = saved.GeofenceRadiusM, IsSaved = false, CreatedByUserId = userId
                        };
                        _db.ShipmentAddresses.Add(copy);
                        await _db.SaveChangesAsync();
                        return copy;
                    }
                    return saved;
                }
            }
            var a = new ShipmentAddress
            {
                CustomerId = customerId,
                Label = dto.Label?.Trim(),
                Line1 = dto.Line1!.Trim(),
                Line2 = dto.Line2?.Trim(),
                Suburb = dto.Suburb?.Trim(),
                City = dto.City?.Trim(),
                Province = dto.Province?.Trim(),
                PostalCode = dto.PostalCode?.Trim(),
                Latitude = dto.Latitude,
                Longitude = dto.Longitude,
                GooglePlaceId = dto.GooglePlaceId,
                ContactName = dto.ContactName?.Trim(),
                ContactPhone = dto.ContactPhone?.Trim(),
                ContactEmail = dto.ContactEmail?.Trim(),
                IsSaved = dto.SaveToAddressBook,
                CreatedByUserId = userId
            };
            _db.ShipmentAddresses.Add(a);
            await _db.SaveChangesAsync();
            return a;
        }

        public List<string> Validate(CreateBookingDto dto)
        {
            var errors = new List<string>();
            if (dto.CustomerId <= 0) errors.Add("Client is required.");
            if (dto.Shipments == null || dto.Shipments.Count == 0) { errors.Add("At least one shipment is required."); return errors; }
            if (dto.Shipments.Count > 500) errors.Add("Maximum 500 shipments per booking.");
            if (!string.IsNullOrEmpty(dto.ClientReference) && dto.ClientReference.Length > 50) errors.Add("Client reference may not exceed 50 characters.");

            var today = DateTime.UtcNow.AddHours(2).Date;
            for (int i = 0; i < dto.Shipments.Count; i++)
            {
                var s = dto.Shipments[i]; var p = $"Shipment {i + 1}: ";
                errors.AddRange(ValidateAddress(s.Pickup, p + "pickup"));
                errors.AddRange(ValidateAddress(s.Delivery, p + "delivery"));
                if (!s.Pickup.AddressId.HasValue && !s.Delivery.AddressId.HasValue
                    && string.Equals(s.Pickup.Line1?.Trim(), s.Delivery.Line1?.Trim(), StringComparison.OrdinalIgnoreCase)
                    && string.Equals(s.Pickup.PostalCode?.Trim(), s.Delivery.PostalCode?.Trim(), StringComparison.OrdinalIgnoreCase))
                    errors.Add(p + "delivery address must differ from the pickup address.");
                if (s.Pickup.AddressId.HasValue && s.Pickup.AddressId == s.Delivery.AddressId)
                    errors.Add(p + "delivery address must differ from the pickup address.");
                if (s.CollectionDate == default) errors.Add(p + "collection date is required.");
                else if (s.CollectionDate.Date < today) errors.Add(p + "collection date must be today or later.");
                if (s.RequestedDeliveryDate == default) errors.Add(p + "requested delivery date is required.");
                else if (s.RequestedDeliveryDate.Date < s.CollectionDate.Date) errors.Add(p + "requested delivery date must be on or after the collection date.");
                if (!string.IsNullOrEmpty(s.CollectionWindowFrom) && !string.IsNullOrEmpty(s.CollectionWindowTo)
                    && TimeSpan.TryParse(s.CollectionWindowFrom, out var wf) && TimeSpan.TryParse(s.CollectionWindowTo, out var wt) && wf >= wt)
                    errors.Add(p + "collection window 'from' must be before 'to'.");
                if (s.Items == null || s.Items.Count == 0) errors.Add(p + "at least one cargo line is required.");
                else for (int j = 0; j < s.Items.Count; j++)
                {
                    var it = s.Items[j]; var ip = $"{p}cargo line {j + 1}: ";
                    if (it.Type != "parcel" && it.Type != "pallet") errors.Add(ip + "type must be parcel or pallet.");
                    if (it.Qty <= 0) errors.Add(ip + "quantity must be greater than 0.");
                    if (it.WeightKg <= 0) errors.Add(ip + "weight must be greater than 0 kg.");
                    if (string.IsNullOrWhiteSpace(it.Description)) errors.Add(ip + "description is required.");
                }
                if (s.Hazardous && string.IsNullOrWhiteSpace(s.HazardClass)) errors.Add(p + "hazard class is required when hazardous is ticked.");
            }
            return errors;
        }

        private static IEnumerable<string> ValidateAddress(AddressInputDto a, string prefix)
        {
            if (a == null) { yield return prefix + " address is required."; yield break; }
            if (a.AddressId.HasValue) yield break;
            if (string.IsNullOrWhiteSpace(a.Line1)) yield return prefix + " address line 1 is required.";
            if (string.IsNullOrWhiteSpace(a.ContactName)) yield return prefix + " contact name is required.";
            if (string.IsNullOrWhiteSpace(a.ContactPhone)) yield return prefix + " contact phone is required.";
        }
    }

    public class BookingValidationException : Exception
    {
        public List<string> Errors { get; }
        public BookingValidationException(List<string> errors) : base(string.Join(" ", errors)) => Errors = errors;
    }
}
