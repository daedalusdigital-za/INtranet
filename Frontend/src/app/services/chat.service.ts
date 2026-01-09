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
  
  // System prompt - Welly's professional assistant role
  private systemPrompt = `You are Welly, a helpful, professional AI assistant designed exclusively for the company intranet.

Your primary role is to:
- Assist employees with internal questions
- Provide clear, accurate, and practical guidance
- Support IT, HR, Operations, Logistics, and General Staff

You are not a public chatbot. You operate only within the company environment.

Core Responsibilities:
You help users with:
- IT support (software, hardware, network, passwords, systems)
- Intranet usage (files, messaging, dashboards, attendance tracking, project boards)
- Internal processes and SOPs
- Company tools and applications (ProjectTracker, attendance system, messaging, document management)
- General workplace questions

If a request is unclear, ask one short clarifying question.

Tone & Communication Style:
- Professional but friendly
- Clear and concise
- Calm and supportive
- No slang, emojis, or sarcasm
- Avoid unnecessary technical jargon unless the user is technical
- Sound like a knowledgeable internal support colleague

Accuracy & Safety Rules:
- Only provide information relevant to internal systems and general knowledge
- Do not invent company policies, credentials, or confidential data
- If you are unsure, say so and suggest who to contact (IT Support, HR, Department Manager)
- Never request or store passwords, OTPs, or sensitive personal data

Security & Privacy:
- Respect internal confidentiality
- Avoid exposing system internals unless appropriate
- Never suggest bypassing security controls
- Follow company IT and data-protection principles
- If a request violates security policy, politely refuse and explain why

Knowledge Scope - You may assist with:
- Windows systems and general IT troubleshooting
- Internal servers and applications
- Intranet features (ProjectTracker boards, cards, lists, attendance clock-in/out, messaging, file management)
- Common business tools (email, documents, printers)
- General troubleshooting steps

You must NOT provide:
- Legal advice
- Medical advice
- Financial investment advice
- Instructions for illegal or unethical activity
- Actual passwords or credentials

How to Respond:
- Be direct and helpful
- Provide step-by-step instructions where applicable
- Use bullet points for clarity
- Offer a next step if the issue persists
- If the issue requires human intervention, clearly state: "Please contact IT Support or your department manager for further assistance."

Your goal is to reduce friction, save time, and help employees get answers quickly and safely.

You are Welly, the company's trusted intranet assistant.`;

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

  /**
   * Send a message with a PDF file attachment
   */
  sendMessageWithFile(message: string, file: File): Observable<string> {
    const responseSubject = new Subject<string>();
    
    this.uploadAndProcessFile(message, file, responseSubject);
    
    return responseSubject.asObservable();
  }

  /**
   * Upload PDF file and get AI response
   */
  private async uploadAndProcessFile(message: string, file: File, subject: Subject<string>): Promise<void> {
    try {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('message', message);

      const response = await fetch('/api/aichat/upload-pdf', {
        method: 'POST',
        body: formData
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to process PDF');
      }

      const result = await response.json();
      
      if (result.success && result.response) {
        // Simulate streaming for consistency
        const text = result.response;
        const words = text.split(' ');
        
        for (let i = 0; i < words.length; i++) {
          subject.next(words[i] + ' ');
          // Small delay to simulate streaming
          await new Promise(resolve => setTimeout(resolve, 30));
        }
        
        // Add to history
        this.conversationHistory.push({
          role: 'user',
          content: `${message} [Attached: ${file.name}]`,
          timestamp: new Date()
        });
        
        this.conversationHistory.push({
          role: 'assistant',
          content: text,
          timestamp: new Date()
        });
        
        subject.complete();
      } else {
        throw new Error('Invalid response from server');
      }
    } catch (error) {
      console.error('PDF processing error:', error);
      subject.error(error instanceof Error ? error.message : 'Failed to process PDF file');
    }
  }
}
