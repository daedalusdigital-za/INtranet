# AI Assistant Setup (llama.cpp)

This folder contains the AI model and configuration for the internal chat assistant.

## Quick Start

### 1. Download the Model

Run the download script from the project root:

```powershell
.\download-model.ps1
```

Or download manually:
- URL: https://huggingface.co/TheBloke/TinyLlama-1.1B-Chat-v1.0-GGUF/resolve/main/tinyllama-1.1b-chat-v1.0.Q4_K_M.gguf
- Save to: `ai-data/models/tinyllama-1.1b-chat-v1.0.Q4_K_M.gguf`

### 2. Start the Service

```bash
docker-compose up -d llama
```

### 3. Test the API

```bash
curl http://localhost:8080/health
```

## Folder Structure

```
ai-data/
├── models/                           # GGUF model files
│   └── tinyllama-1.1b-chat-v1.0.Q4_K_M.gguf
├── prompts/                          # System prompts
│   └── system.txt                    # Edit this for your company
└── training/                         # Training data (for fine-tuning)
    └── dataset.jsonl
```

## Customizing the Assistant

Edit `prompts/system.txt` to customize:
- Company information
- Office hours
- Contact details
- Application-specific instructions

## Hardware Requirements

| Quantization | Model Size | RAM Usage | Quality |
|--------------|-----------|-----------|---------|
| Q4_K_M       | ~670MB    | ~1.5GB    | Good    |
| Q5_K_M       | ~780MB    | ~1.8GB    | Better  |
| Q8_0         | ~1.1GB    | ~2.5GB    | Best    |

**Minimum**: 2GB RAM, 2 CPU cores
**Recommended**: 4GB RAM, 4 CPU cores

## Fine-tuning (Advanced)

To fine-tune with your own data:

1. Add training examples to `training/dataset.jsonl`:
```jsonl
{"instruction": "Your question", "output": "Expected answer"}
```

2. Use a tool like `llama.cpp`'s training scripts or convert to LoRA format

## API Endpoints

- `GET /health` - Health check
- `POST /completion` - Generate text
- `POST /v1/chat/completions` - OpenAI-compatible chat
