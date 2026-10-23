# ============================================================
# Local LLM Server Startup Script (Multi-Model)
# Uses llama.cpp server with OpenAI-compatible API
# ============================================================
# Usage:
#   .\start-llm-server.ps1              → Start with default model (Gemma 4 26B-A4B MoE)
#   .\start-llm-server.ps1 -Model gemma → Start Gemma 4 26B MoE
#   .\start-llm-server.ps1 -Model qwen  → Start Qwen 2.5 14B (if installed)
#   .\start-llm-server.ps1 -Model deep  → Start DeepSeek-R1 14B (if installed)
# ============================================================

param(
    [ValidateSet("gemma", "qwen", "deep")]
    [string]$Model = "gemma"
)

$LlamaServer = "C:\Models\llama-cpp-b8722\llama-server.exe"
$Port = 8090

# ── Model Configurations ──────────────────────────────────
$Models = @{
    "qwen3" = @{
        Name        = "Qwen3 30B-A3B MoE (Q4_K_M)"
        Path        = "C:\Models\Qwen3-30B-A3B-Instruct-2507-Q4_K_M.gguf"
        ContextSize = 32768     # 256K native, configured to 32K for safety
        BatchSize   = 2048
        Parallel    = 2
        Threads     = 12        # Physical cores on 1 NUMA node
        ThreadsBatch = 24       # All physical cores across both sockets
        ExtraArgs   = @("--reasoning-format", "none")
    }
    "gemma" = @{
        Name        = "Gemma 4 26B-A4B MoE (Q4_K_M)"
        Path        = "C:\Models\gemma-4-26B-A4B-it-Q4_K_M.gguf"
        ContextSize = 16384     # 8K per slot with parallel=2 (supports 256K native)
        BatchSize   = 2048
        Parallel    = 2
        Threads     = 12        # Physical cores on 1 NUMA node
        ThreadsBatch = 24       # All physical cores across both sockets
        ExtraArgs   = @("--reasoning-format", "deepseek", "--reasoning", "off")
    }
    "deep" = @{
        Name        = "DeepSeek-R1-Distill-Qwen 14B (Q4_K_M)"
        Path        = "C:\Models\DeepSeek-R1-Distill-Qwen-14B-Q4_K_M.gguf"
        ContextSize = 16384
        BatchSize   = 2048
        Parallel    = 2
        Threads     = 12
        ThreadsBatch = 24
        ExtraArgs   = @("--reasoning-format", "deepseek")
    }
}

# ── Select model ──────────────────────────────────────────
$cfg = $Models[$Model]
$ModelPath = $cfg.Path

# ── Verify files exist ────────────────────────────────────
if (-not (Test-Path $LlamaServer)) {
    Write-Host "ERROR: llama-server.exe not found at $LlamaServer" -ForegroundColor Red
    exit 1
}

if (-not (Test-Path $ModelPath)) {
    Write-Host "ERROR: Model file not found at $ModelPath" -ForegroundColor Red
    Write-Host ""
    Write-Host "Available models:" -ForegroundColor Yellow
    foreach ($key in $Models.Keys) {
        $exists = if (Test-Path $Models[$key].Path) { "[OK]" } else { "[MISSING]" }
        Write-Host "  -Model $key  =>  $($Models[$key].Name)  $exists"
    }
    exit 1
}

$modelSize = [math]::Round((Get-Item $ModelPath).Length / 1GB, 2)

# ── Display banner ────────────────────────────────────────
Write-Host ""
Write-Host "============================================================" -ForegroundColor Cyan
Write-Host " Local LLM Server" -ForegroundColor Cyan
Write-Host "============================================================" -ForegroundColor Cyan
Write-Host "Model:     $($cfg.Name) (${modelSize} GB)" -ForegroundColor White
Write-Host "Engine:    llama.cpp server" -ForegroundColor Gray
Write-Host "Port:      $Port" -ForegroundColor Gray
Write-Host "Threads:   $($cfg.Threads) (gen) / $($cfg.ThreadsBatch) (batch)" -ForegroundColor Gray
Write-Host "Context:   $($cfg.ContextSize) tokens ($($cfg.ContextSize / $cfg.Parallel) per slot)" -ForegroundColor Gray
Write-Host "Parallel:  $($cfg.Parallel) slots" -ForegroundColor Gray
Write-Host "API:       http://localhost:${Port}/v1/chat/completions" -ForegroundColor Green
Write-Host "Health:    http://localhost:${Port}/health" -ForegroundColor Green
Write-Host "============================================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "Switch models:  .\start-llm-server.ps1 -Model gemma|qwen|deep" -ForegroundColor DarkGray
Write-Host ""
Write-Host "Starting server... (first load may take 30-90 seconds)" -ForegroundColor Yellow
Write-Host "Press Ctrl+C to stop" -ForegroundColor Yellow
Write-Host ""

# ── Build argument list ───────────────────────────────────
$serverArgs = @(
    "--model",         $ModelPath,
    "--port",          $Port,
    "--host",          "0.0.0.0",
    "--threads",       $cfg.Threads,
    "--threads-batch", $cfg.ThreadsBatch,
    "--ctx-size",      $cfg.ContextSize,
    "--batch-size",    $cfg.BatchSize,
    "--ubatch-size",   512,
    "--parallel",      $cfg.Parallel,
    "--cont-batching",
    "--flash-attn",    "auto",
    "--mlock",
    "--no-mmap",
    "--prio",          2,
    "--prio-batch",    3
)

# Add model-specific extra args
if ($cfg.ExtraArgs) {
    $serverArgs += $cfg.ExtraArgs
}

# ── API key ───────────────────────────────────────────────
# The server listens on 0.0.0.0 so the backend container can reach it via
# host.docker.internal. Require a bearer key so other machines on the LAN can't
# use it. Same value as LOCAL_LLM_API_KEY in the repo .env (passed to the backend
# as LocalLlm__ApiKey by docker-compose).
$ApiKey = $env:LOCAL_LLM_API_KEY
if (-not $ApiKey) {
    $envFile = Join-Path $PSScriptRoot ".env"
    if (Test-Path $envFile) {
        $line = Get-Content $envFile | Where-Object { $_ -match '^\s*LOCAL_LLM_API_KEY\s*=' } | Select-Object -First 1
        if ($line) { $ApiKey = ($line -split '=', 2)[1].Trim().Trim('"') }
    }
}
if ($ApiKey) {
    $serverArgs += @("--api-key", $ApiKey)
    Write-Host "API key:   required (LOCAL_LLM_API_KEY)" -ForegroundColor Green
} else {
    Write-Host "WARNING: LOCAL_LLM_API_KEY is not set - the LLM server is open to anyone on the network." -ForegroundColor Red
}

# ── Launch ────────────────────────────────────────────────
& $LlamaServer @serverArgs
