# Download TinyLlama model for llama.cpp
# This script downloads the quantized Q4_K_M version (~670MB)

$modelUrl = "https://huggingface.co/TheBloke/TinyLlama-1.1B-Chat-v1.0-GGUF/resolve/main/tinyllama-1.1b-chat-v1.0.Q4_K_M.gguf"
$modelPath = "ai-data/models/tinyllama-1.1b-chat-v1.0.Q4_K_M.gguf"

# Create models directory if it doesn't exist
New-Item -ItemType Directory -Force -Path "ai-data/models" | Out-Null

Write-Host "Downloading TinyLlama 1.1B (Q4_K_M quantized)..." -ForegroundColor Cyan
Write-Host "Size: ~670MB" -ForegroundColor Yellow
Write-Host ""

# Download with progress
try {
    $ProgressPreference = 'Continue'
    Invoke-WebRequest -Uri $modelUrl -OutFile $modelPath -UseBasicParsing
    Write-Host ""
    Write-Host "Download complete!" -ForegroundColor Green
    Write-Host "Model saved to: $modelPath" -ForegroundColor Green
} catch {
    Write-Host "Error downloading model: $_" -ForegroundColor Red
    Write-Host ""
    Write-Host "Alternative: Download manually from:" -ForegroundColor Yellow
    Write-Host $modelUrl -ForegroundColor Cyan
    Write-Host "And save to: $modelPath" -ForegroundColor Yellow
    exit 1
}

Write-Host ""
Write-Host "You can now run: docker-compose up -d" -ForegroundColor Cyan
