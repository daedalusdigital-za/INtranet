# ============================================================
# Qwen2.5-14B-Instruct Local LLM Server Startup Script
# Uses llama.cpp server with OpenAI-compatible API
# ============================================================

$LlamaServer = "C:\Models\llama-cpp\llama-server.exe"
$ModelPath = "C:\Models\Qwen2.5-14B-Instruct-Q4_K_M.gguf"
$Port = 8090
$Threads = 24          # Pin to 1 NUMA node (24 threads) — avoids slow cross-socket memory access
$ThreadsBatch = 36     # Use more threads for prompt processing (batch is less NUMA-sensitive)
$ContextSize = 32768   # Context window (8192 per slot x 4 slots — fits large system prompt + KB + conversation)
$BatchSize = 2048      # Larger batch for faster prompt ingestion
$ParallelSlots = 4     # Number of concurrent users

# Verify files exist
if (-not (Test-Path $LlamaServer)) {
    Write-Host "ERROR: llama-server.exe not found at $LlamaServer" -ForegroundColor Red
    Write-Host "Run the setup to download llama.cpp first."
    exit 1
}

if (-not (Test-Path $ModelPath)) {
    Write-Host "ERROR: Model file not found at $ModelPath" -ForegroundColor Red
    Write-Host "Download the model first: Qwen2.5-14B-Instruct-Q4_K_M.gguf"
    exit 1
}

$modelSize = [math]::Round((Get-Item $ModelPath).Length / 1GB, 2)
Write-Host "============================================================" -ForegroundColor Cyan
Write-Host " Qwen2.5-14B-Instruct Local LLM Server" -ForegroundColor Cyan
Write-Host "============================================================" -ForegroundColor Cyan
Write-Host "Model:     Qwen2.5-14B-Instruct (Q4_K_M, ${modelSize}GB)"
Write-Host "Engine:    llama.cpp server"
Write-Host "Port:      $Port"
Write-Host "Threads:   $Threads (generation) / $ThreadsBatch (batch processing)"
Write-Host "Context:   $ContextSize tokens"
Write-Host "Parallel:  $ParallelSlots slots"
Write-Host "API:       http://localhost:${Port}/v1/chat/completions (OpenAI-compatible)"
Write-Host "Health:    http://localhost:${Port}/health"
Write-Host "============================================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "Starting server... (first load may take 30-60 seconds)" -ForegroundColor Yellow
Write-Host "Press Ctrl+C to stop" -ForegroundColor Yellow
Write-Host ""

& $LlamaServer `
    --model $ModelPath `
    --port $Port `
    --host 0.0.0.0 `
    --threads $Threads `
    --threads-batch $ThreadsBatch `
    --ctx-size $ContextSize `
    --batch-size $BatchSize `
    --ubatch-size 512 `
    --parallel $ParallelSlots `
    --cont-batching `
    --flash-attn auto `
    --reasoning-format none `
    --mlock `
    --no-mmap `
    --prio 2 `
    --prio-batch 2 `
    --cpu-strict 1 `
    --poll 50
