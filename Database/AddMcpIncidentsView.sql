-- =============================================================================
-- MCP connector — incidents view (for the incident_history tool)
-- Safe to re-run.
-- =============================================================================
USE ProjectTrackerDB;
GO

CREATE OR ALTER VIEW dbo.vw_mcp_incidents AS
    SELECT Id, Type, Severity, Registration, Driver,
           Latitude, Longitude, Address, Speed, Zone, DistanceMeters,
           DuringCurfew, Details, IncidentDate, OccurredAtSast
    FROM dbo.LogisticsIncidents;
GO

GRANT SELECT ON dbo.vw_mcp_incidents TO mcp_readonly;
GO
