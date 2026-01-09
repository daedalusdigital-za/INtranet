import { Injectable } from '@angular/core';
import { Observable, Subject } from 'rxjs';

export interface ChatMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: Date;
}

export interface OllamaResponse {
  model: string;
  created_at: string;
  message: {
    role: string;
    content: string;
  };
  done: boolean;
}

@Injectable({
  providedIn: 'root'
})
export class ChatService {
  // Use relative path so it works on any intranet host
  private ollamaUrl = '/ai';
  private modelName = 'mistral:latest';
  private conversationHistory: ChatMessage[] = [];
  
  // System prompt - Welly's personality
  private systemPrompt = `You are Welly, a friendly IT support specialist who works in the IT department. You've been with the company for a few years and know the ins and outs of ProjectTracker.

Your Personality:
- Friendly but professional - you're a colleague, not a robot
- You have opinions and aren't afraid to share them (politely)
- You use light humor when appropriate - a quick joke or witty remark here and there
- You're helpful but also a bit cheeky sometimes
- You genuinely care about helping your coworkers

IMPORTANT RULES:
- NEVER mention being an AI, language model, or being "powered by" anything
- You ARE Welly from IT - that's your identity, stick to it
- If asked what you are, you're just Welly, the IT guy who handles support
- Don't be robotic - use casual language like "honestly", "to be fair", "in my experience"

Your Expertise:
- ProjectTracker application (boards, cards, lists)
- Attendance system (clock in/out, leave requests)
- General IT troubleshooting
- Company procedures and policies

Response Style:
- Keep it conversational and concise
- Give your honest opinion when asked
- Use humor sparingly but naturally
- If you don't know something, say "Let me check on that" or "That's above my pay grade, try HR"
- Sign off casually sometimes: "Cheers!", "Let me know if you need anything else", "Happy to help!"`;

  constructor() {}

  /**
   * Send a message to Ollama and get a streaming response
   */
  sendMessage(message: string): Observable<string> {
    const responseSubject = new Subject<string>();

    // Add user message to history
    this.conversationHistory.push({
      role: 'user',
      content: message,
      timestamp: new Date()
    });

    // Stream the response
    this.streamChat(message, responseSubject);

    return responseSubject.asObservable();
  }

  /**
   * Stream chat response from Ollama
   */
  private async streamChat(userMessage: string, subject: Subject<string>): Promise<void> {
    try {
      // Build messages array with system prompt and history
      const messages: any[] = [
        {
          role: 'system',
          content: this.systemPrompt
        }
      ];

      // Include last 6 messages for context (3 exchanges)
      const recentHistory = this.conversationHistory.slice(-7, -1); // Exclude the just-added user message
      for (const msg of recentHistory) {
        messages.push({
          role: msg.role,
          content: msg.content
        });
      }

      // Add current user message
      messages.push({
        role: 'user',
        content: userMessage
      });

      const response = await fetch(`${this.ollamaUrl}/api/chat`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: this.modelName,
          messages: messages,
          stream: true,
          options: {
            temperature: 0.7,
            num_predict: 512
          }
        })
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const reader = response.body?.getReader();
      const decoder = new TextDecoder();
      let fullResponse = '';

      if (reader) {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          const chunk = decoder.decode(value);
          const lines = chunk.split('\n').filter(line => line.trim());

          for (const line of lines) {
            try {
              const json: OllamaResponse = JSON.parse(line);
              if (json.message?.content) {
                fullResponse += json.message.content;
                subject.next(json.message.content);
              }
              if (json.done) break;
            } catch (e) {
              // Skip invalid JSON
            }
          }
        }
      }

      // Add assistant response to history
      this.conversationHistory.push({
        role: 'assistant',
        content: fullResponse.trim(),
        timestamp: new Date()
      });

      subject.complete();
    } catch (error) {
      console.error('Chat error:', error);
      subject.error('Failed to connect to AI service. Please ensure Ollama is running.');
    }
  }

  /**
   * Clear conversation history
   */
  clearHistory(): void {
    this.conversationHistory = [];
  }

  /**
   * Get conversation history
   */
  getHistory(): ChatMessage[] {
    return [...this.conversationHistory];
  }

  /**
   * Check if Ollama service is available
   */
  checkHealth(): Observable<boolean> {
    return new Observable(observer => {
      fetch(`${this.ollamaUrl}/api/tags`)
        .then(response => {
          observer.next(response.ok);
          observer.complete();
        })
        .catch(() => {
          observer.next(false);
          observer.complete();
        });
    });
  }
}
