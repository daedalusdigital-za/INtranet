using System.Net;
using Microsoft.EntityFrameworkCore;
using ProjectTracker.API.Data;
using ProjectTracker.API.Models.Logistics.Shipments;

namespace ProjectTracker.API.Services.Logistics
{
    /// <summary>
    /// Sends email/SMS from shipment events using templates (section 6.3) and writes every
    /// attempt to ShipmentNotificationLogs. Never throws into the business flow.
    /// </summary>
    public interface IShipmentNotificationService
    {
        Task OnEventAsync(Shipment shipment, ShipmentEvent ev);
    }

    public class ShipmentNotificationService : IShipmentNotificationService
    {
        private readonly ApplicationDbContext _db;
        private readonly IEmailService _email;
        private readonly ISmsService _sms;
        private readonly IConfiguration _config;
        private readonly ILogger<ShipmentNotificationService> _logger;
        private readonly IServiceScopeFactory _scopes;

        public ShipmentNotificationService(ApplicationDbContext db, IEmailService email, ISmsService sms, IConfiguration config,
            ILogger<ShipmentNotificationService> logger, IServiceScopeFactory scopes)
        {
            _db = db; _email = email; _sms = sms; _config = config; _logger = logger; _scopes = scopes;
        }

        /// <summary>
        /// Queues the send on a background task with its own scope so a slow SMTP server never
        /// holds up a booking, scan or planning request. Outcome is still logged per notification.
        /// </summary>
        public Task OnEventAsync(Shipment shipment, ShipmentEvent ev)
        {
            var shipmentId = shipment.Id;
            var evCopy = new ShipmentEvent { Id = ev.Id, ShipmentId = ev.ShipmentId, FromStatus = ev.FromStatus, ToStatus = ev.ToStatus, Note = ev.Note, OccurredAt = ev.OccurredAt, Source = ev.Source };
            _ = Task.Run(async () =>
            {
                try
                {
                    using var scope = _scopes.CreateScope();
                    var svc = (ShipmentNotificationService)scope.ServiceProvider.GetRequiredService<IShipmentNotificationService>();
                    await svc.SendNowAsync(shipmentId, evCopy);
                }
                catch (Exception ex) { _logger.LogWarning(ex, "Shipment notification background task failed for shipment {Id}", shipmentId); }
            });
            return Task.CompletedTask;
        }

        private async Task SendNowAsync(int shipmentId, ShipmentEvent ev)
        {
            var shipment = new Shipment { Id = shipmentId };
            try
            {
                // Make sure we have the booking/addresses/waybill for the template.
                var s = await _db.Shipments.AsNoTracking()
                    .Include(x => x.Booking).ThenInclude(b => b.Customer)
                    .Include(x => x.PickupAddress)
                    .Include(x => x.DeliveryAddress)
                    .Include(x => x.Waybill)
                    .Include(x => x.Items)
                    .FirstOrDefaultAsync(x => x.Id == shipment.Id);
                if (s == null) return;

                var clientEmail = FirstEmail(s.Booking.RequestedByEmail, s.Booking.Customer?.ContactEmail, s.Booking.Customer?.Email);
                var deliveryEmail = FirstEmail(s.DeliveryAddress.ContactEmail);
                var deliveryPhone = s.DeliveryAddress.ContactPhone;
                var clientPhone = s.Booking.RequestedByPhone ?? s.Booking.Customer?.MobileNumber;

                switch (ev.ToStatus)
                {
                    case ShipmentStatus.Booked:
                        await EmailAsync(s, clientEmail, "BOOKED", $"Booking {s.Booking.BookingNo} received", BookedBody(s));
                        break;
                    case ShipmentStatus.Confirmed when ev.FromStatus == ShipmentStatus.Booked:
                        await EmailAsync(s, clientEmail, "CONFIRMED", $"Booking {s.Booking.BookingNo} confirmed", StatusBody(s, "has been confirmed and will be planned for collection."));
                        break;
                    case ShipmentStatus.Rejected:
                        await EmailAsync(s, clientEmail, "REJECTED", $"Booking {s.Booking.BookingNo} could not be accepted", StatusBody(s, $"could not be accepted.<br/><b>Reason:</b> {WebUtility.HtmlEncode(s.Booking.RejectionReason ?? ev.Note ?? "Not specified")}"));
                        break;
                    case ShipmentStatus.Collected:
                        await EmailAsync(s, clientEmail, "COLLECTED", $"Shipment {s.Waybill?.WaybillNo} collected", StatusBody(s, "has been collected and is on its way."));
                        if (deliveryEmail != null && deliveryEmail != clientEmail)
                            await EmailAsync(s, deliveryEmail, "COLLECTED", $"Delivery {s.Waybill?.WaybillNo} on its way", StatusBody(s, "has been collected and is on its way to you."));
                        break;
                    case ShipmentStatus.Arriving:
                        await SmsAsync(s, deliveryPhone, "ARRIVING", $"Rocket Freight: delivery {s.Waybill?.WaybillNo} is arriving shortly at {s.DeliveryAddress.Suburb ?? s.DeliveryAddress.City}. Track: {TrackingUrl(s)}");
                        break;
                    case ShipmentStatus.Delivered:
                        await EmailAsync(s, clientEmail, "DELIVERED", $"Shipment {s.Waybill?.WaybillNo} delivered", StatusBody(s, $"was delivered at {Sast(s.DeliveredAt ?? ev.OccurredAt):dd MMM yyyy HH:mm}. The proof of delivery is available on the tracking page."));
                        break;
                    case ShipmentStatus.CollectionFailed:
                    case ShipmentStatus.DeliveryFailed:
                        var what = ev.ToStatus == ShipmentStatus.CollectionFailed ? "Collection" : "Delivery";
                        await EmailAsync(s, clientEmail, ev.ToStatus, $"{what} failed – {s.Waybill?.WaybillNo ?? s.Booking.BookingNo}", StatusBody(s, $"{what.ToLower()} was not successful.<br/><b>Reason:</b> {WebUtility.HtmlEncode(ev.Note ?? "Not specified")}<br/>Our operations team will contact you to re-plan."));
                        await SmsAsync(s, clientPhone, ev.ToStatus, $"Rocket Freight: {what.ToLower()} for {s.Waybill?.WaybillNo ?? s.Booking.BookingNo} failed – {ev.Note}. We will contact you to re-plan.");
                        break;
                }
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Shipment notification failed for shipment {Id} event {Status}", shipment.Id, ev.ToStatus);
            }
        }

        private async Task EmailAsync(Shipment s, string? to, string template, string subject, string body)
        {
            var log = new ShipmentNotificationLog { ShipmentId = s.Id, Channel = "email", Recipient = to ?? "", Template = template };
            if (string.IsNullOrWhiteSpace(to))
            {
                log.Status = "skipped"; log.Error = "No recipient email";
            }
            else
            {
                var ok = await _email.SendEmailAsync(to, subject, Wrap(body), true);
                log.Status = ok ? "sent" : "failed";
                log.Error = ok ? null : _email.LastError;
                log.SentAt = ok ? DateTime.UtcNow : null;
            }
            _db.ShipmentNotificationLogs.Add(log);
            await _db.SaveChangesAsync();
        }

        private async Task SmsAsync(Shipment s, string? to, string template, string message)
        {
            var log = new ShipmentNotificationLog { ShipmentId = s.Id, Channel = "sms", Recipient = to ?? "", Template = template };
            if (string.IsNullOrWhiteSpace(to)) { log.Status = "skipped"; log.Error = "No recipient phone"; }
            else if (!_sms.IsConfigured) { log.Status = "skipped"; log.Error = "No SMS provider configured"; }
            else
            {
                var (ok, pid, err) = await _sms.SendAsync(to, message);
                log.Status = ok ? "sent" : "failed"; log.ProviderMessageId = pid; log.Error = err; log.SentAt = ok ? DateTime.UtcNow : null;
            }
            _db.ShipmentNotificationLogs.Add(log);
            await _db.SaveChangesAsync();
        }

        public string TrackingUrl(Shipment s)
        {
            var baseUrl = (_config["Shipments:PortalBaseUrl"] ?? "https://192.168.10.151").TrimEnd('/');
            return s.Waybill != null ? $"{baseUrl}/t/{s.Waybill.TrackingToken}" : $"{baseUrl}/logistics/bookings";
        }

        private static DateTime Sast(DateTime utc) => utc.AddHours(2);
        private static string? FirstEmail(params string?[] candidates)
            => candidates.FirstOrDefault(c => !string.IsNullOrWhiteSpace(c) && c.Contains('@'))?.Trim();

        private string BookedBody(Shipment s)
        {
            var b = s.Booking;
            var items = string.Join("", s.Items.Select(i => $"<li>{i.Qty} × {WebUtility.HtmlEncode(i.Type)} – {WebUtility.HtmlEncode(i.Description ?? "")} ({i.WeightKg:N1} kg)</li>"));
            return $@"
<p>Dear {WebUtility.HtmlEncode(b.RequestedByName ?? b.Customer?.ContactPerson ?? "Client")},</p>
<p>We have received your booking <b>{b.BookingNo}</b>{(string.IsNullOrWhiteSpace(b.ClientReference) ? "" : $" (your reference {WebUtility.HtmlEncode(b.ClientReference)})")}. It is now in our operations queue and you will receive a confirmation shortly.</p>
<table style='border-collapse:collapse'>
<tr><td style='padding:4px 12px 4px 0'><b>Collect from</b></td><td>{WebUtility.HtmlEncode(s.PickupAddress.OneLine)}</td></tr>
<tr><td style='padding:4px 12px 4px 0'><b>Deliver to</b></td><td>{WebUtility.HtmlEncode(s.DeliveryAddress.OneLine)}</td></tr>
<tr><td style='padding:4px 12px 4px 0'><b>Collection</b></td><td>{s.CollectionDate:dd MMM yyyy} {s.CollectionWindowFrom}–{s.CollectionWindowTo}</td></tr>
<tr><td style='padding:4px 12px 4px 0'><b>Requested delivery</b></td><td>{s.RequestedDeliveryDate:dd MMM yyyy}</td></tr>
</table>
<p><b>Cargo</b></p><ul>{items}</ul>";
        }

        private string StatusBody(Shipment s, string sentence) => $@"
<p>Dear {WebUtility.HtmlEncode(s.Booking.RequestedByName ?? s.Booking.Customer?.ContactPerson ?? "Client")},</p>
<p>Shipment <b>{s.Waybill?.WaybillNo ?? s.Booking.BookingNo}</b> ({WebUtility.HtmlEncode(s.PickupAddress.Suburb ?? s.PickupAddress.City ?? "")} → {WebUtility.HtmlEncode(s.DeliveryAddress.Suburb ?? s.DeliveryAddress.City ?? "")}) {sentence}</p>
{(s.Waybill != null ? $"<p><a href='{TrackingUrl(s)}'>Track this shipment</a></p>" : "")}";

        private static string Wrap(string inner) => $@"<html><body style='font-family:Arial,sans-serif;line-height:1.5;color:#333'>
<h2 style='color:#033142;margin-bottom:8px'>Rocket Freight</h2>{inner}
<hr style='border:none;border-top:1px solid #ddd;margin-top:24px'/>
<p style='font-size:12px;color:#666'>This is an automated message from the Rocket Freight Logistics System.</p></body></html>";
    }
}
