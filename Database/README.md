# Database

The **schema is owned by EF Core migrations** in `Backend/Migrations/` — they run automatically on
backend start-up (`context.Database.Migrate()` in `Backend/Program.cs`). Do not hand-edit the schema
here; add a migration instead.

| Path | Purpose |
|---|---|
| `Backup-Database.ps1` | Nightly full backup inside the SQL container → `C:\Backups\ProjectTrackerDB` + NAS copy. Referenced by the Windows scheduled task **ProjectTrackerDB_NightlyBackup** — do not move. |
| `Setup-BackupSchedule.ps1` | Registers / repairs that scheduled task. |
| `views/` | SQL views + least-privilege login used by the MCP logistics connector (`CreateMcpReadonlyViews.sql`, `AddMcpIncidentsView.sql`). Re-run when the views change. |
| `legacy-schema/` | Pre-migration `Create*`/`Add*` scripts kept for reference (tables created before EF migrations were introduced). Already applied to production; not needed for a fresh install that runs migrations. |

One-off seed / import / data-fix scripts (stock counts, price lists, tripsheet imports, demo boards, …)
were applied once and have been removed from the tree — they remain in git history
(`git log --diff-filter=D -- Database/`).

The database runs in **SIMPLE** recovery (daily full backups only).
