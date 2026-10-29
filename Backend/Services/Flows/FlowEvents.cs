using System.Text.Json.Nodes;
using Microsoft.EntityFrameworkCore;
using ProjectTracker.API.Data;
using ProjectTracker.API.Models.Flows;

namespace ProjectTracker.API.Services.Flows
{
    /// <summary>
    /// Fire-and-forget business events. Publishers (shipment lifecycle, etc.) call this from inside a request;
    /// the actual flow dispatch runs on a fresh scope so it never slows down or breaks the caller.
    /// </summary>
    public interface IFlowEventPublisher
    {
        void Publish(string eventName, JsonObject payload, string? entityType = null, string? entityKey = null);
        void PublishShipmentEvent(string eventName, int shipmentId, JsonObject? extra = null);
        IReadOnlyList<(string Key, string Description)> KnownEvents { get; }
    }

    public class FlowEventPublisher : IFlowEventPublisher
    {
        private readonly IServiceScopeFactory _scopes;
        private readonly ILogger<FlowEventPublisher> _logger;

        public FlowEventPublisher(IServiceScopeFactory scopes, ILogger<FlowEventPublisher> logger)
        {
            _scopes = scopes; _logger = logger;
        }

        public IReadOnlyList<(string Key, string Description)> KnownEvents { get; } = new List<(string, string)>
        {
            ("shipment.status_changed", "Any shipment status transition (entity.status, entity.fromStatus)"),
            ("shipment.delivered", "Shipment marked DELIVERED"),
            ("shipment.delivery_failed", "Driver logged a failed delivery"),
            ("shipment.collection_failed", "Driver logged a failed collection"),
            ("shipment.booked", "New client booking created"),
            ("shipment.cancelled", "Shipment cancelled"),
            ("flow.manual", "Started by a person from the Flows screen"),
        };

        public void Publish(string eventName, JsonObject payload, string? entityType = null, string? entityKey = null)
        {
            _ = Task.Run(async () =>
            {
                try
                {
                    using var scope = _scopes.CreateScope();
                    var engine = scope.ServiceProvider.GetRequiredService<IFlowEngine>();
                    await engine.DispatchEventAsync(eventName, payload, entityType, entityKey);
                }
                catch (Exception ex) { _logger.LogError(ex, "Flow event {Event} dispatch failed", eventName); }
            });
        }

        public void PublishShipmentEvent(string eventName, int shipmentId, JsonObject? extra = null)
        {
            _ = Task.Run(async () =>
            {
                try
                {
                    using var scope = _scopes.CreateScope();
                    // Only do the (relatively expensive) entity projection if someone is actually listening
                    var db = scope.ServiceProvider.GetRequiredService<ApplicationDbContext>();
                    var anyListeners = await db.FlowDefinitions.AnyAsync(d => d.IsEnabled && !d.IsTemplate && d.TriggerType == FlowTriggerType.Event);
                    if (!anyListeners) return;

                    var sources = scope.ServiceProvider.GetRequiredService<IFlowDataSources>();
                    var entity = await sources.ShipmentEntityAsync(shipmentId, CancellationToken.None);
                    if (entity == null) return;
                    if (extra != null) foreach (var kv in extra) entity[kv.Key] = kv.Value?.DeepClone();
                    entity["eventName"] = eventName;

                    var engine = scope.ServiceProvider.GetRequiredService<IFlowEngine>();
                    await engine.DispatchEventAsync(eventName, entity, "shipment", shipmentId.ToString());
                    if (eventName != "shipment.status_changed")
                        await engine.DispatchEventAsync("shipment.status_changed", entity, "shipment", shipmentId.ToString());
                }
                catch (Exception ex) { _logger.LogError(ex, "Flow shipment event {Event} dispatch failed", eventName); }
            });
        }
    }

    /// <summary>Drives timers, escalations and scheduled triggers.</summary>
    public class FlowSchedulerService : BackgroundService
    {
        private readonly IServiceScopeFactory _scopes;
        private readonly ILogger<FlowSchedulerService> _logger;
        private static readonly TimeSpan Interval = TimeSpan.FromSeconds(60);

        public FlowSchedulerService(IServiceScopeFactory scopes, ILogger<FlowSchedulerService> logger)
        {
            _scopes = scopes; _logger = logger;
        }

        protected override async Task ExecuteAsync(CancellationToken stoppingToken)
        {
            await Task.Delay(TimeSpan.FromSeconds(20), stoppingToken);
            _logger.LogInformation("Flow scheduler started (tick every {Sec}s)", Interval.TotalSeconds);
            while (!stoppingToken.IsCancellationRequested)
            {
                try
                {
                    using var scope = _scopes.CreateScope();
                    await FlowTemplates.EnsureSeededAsync(scope.ServiceProvider.GetRequiredService<ApplicationDbContext>(), stoppingToken);
                    await scope.ServiceProvider.GetRequiredService<IFlowEngine>().TickAsync(stoppingToken);
                }
                catch (OperationCanceledException) when (stoppingToken.IsCancellationRequested) { }
                catch (Exception ex) { _logger.LogError(ex, "Flow scheduler tick failed"); }
                try { await Task.Delay(Interval, stoppingToken); } catch (OperationCanceledException) { }
            }
        }
    }
}
