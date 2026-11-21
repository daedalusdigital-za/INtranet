# tools

Operational and developer scripts. Nothing here is required at runtime; the application is built from
`Backend/`, `Frontend/`, `mcp-logistics/` and `portal-edge/` only.

| Folder | What's in it |
|---|---|
| `smoke/` | API smoke tests (`smoke-creditors*.ps1`, `flows-smoke.ps1`, `flows-ai-smoke.ps1`) and demo seeders (`seed-demo.ps1`, `seed-creditors-demo.ps1`). |
| `portal/` | Client-portal hosting: Azure provisioning, SWA deploy, GitHub secrets, probes and e2e tests. `portal-azure-output.local.txt` (gitignored) holds the provisioning output the scripts read. |
| `stock/` | Stock-count / warehouse helpers: spreadsheet dumpers, code-collision checks, count verification, dispatch approval, forced deductions. |
| `finance/` | `import-ap-aging.ps1` — load supplier aging spreadsheets. |
| `ocr/` | `ocr-bench*.sh` — tesseract/poppler benchmarks run inside the backend container. |
| `github/` | GitHub Actions helpers (`gh_runs.py`, `gh_run_log.py`, `gh_rerun.py`). |
| `welly/` | Ask Welly from the CLI; lane inspection. |
| `llm/` | `start-llm-server.ps1` — local llama.cpp server on :8090 (must match `LLM_API_KEY` in `docker-compose.yml`). |
| `dev/` | Code-base utilities (`tokenize-colors.mjs`, `fix-mojibake.ps1`). |

Scripts are run from the repo root, e.g. `.\tools\smoke\smoke-creditors.ps1`.
Frontend-only build tooling lives in `Frontend/tools/`.
