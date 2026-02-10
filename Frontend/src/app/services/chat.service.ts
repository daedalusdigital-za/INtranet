import { Injectable } from '@angular/core';
import { Observable, Subject } from 'rxjs';
import { environment } from '../../environments/environment';

export interface ChatMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: Date;
}

@Injectable({
  providedIn: 'root'
})
export class ChatService {
  // Use backend API for AI chat
  private apiUrl = `${environment.apiUrl}/aichat`;
  private conversationHistory: ChatMessage[] = [];
  
  // Session ID for server-side conversation memory
  private sessionId: string | null = null;

  constructor() {
    // Try to restore session from storage
    this.sessionId = sessionStorage.getItem('welly_session_id');
  }

  /**
   * Get or create a session ID
   */
  private getSessionId(): string {
    if (!this.sessionId) {
      this.sessionId = crypto.randomUUID();
      sessionStorage.setItem('welly_session_id', this.sessionId);
    }
    return this.sessionId;
  }

  /**
   * Send a message to AI and get a streaming response
   * Uses server-side conversation memory for context
   */
  sendMessage(message: string): Observable<string> {
    const responseSubject = new Subject<string>();

    // Add user message to local history for display
    this.conversationHistory.push({
      role: 'user',
      content: message,
      timestamp: new Date()
    });

    // Stream the response using session-based endpoint
    this.streamChatWithSession(message, responseSubject);

    return responseSubject.asObservable();
  }

  /**
   * Stream chat response using session-based endpoint with server-side memory
   */
  private async streamChatWithSession(userMessage: string, subject: Subject<string>): Promise<void> {
    try {
      const response = await fetch(`${this.apiUrl}/chat/session`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          prompt: userMessage,
          sessionId: this.getSessionId()
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
          const lines = chunk.split('\n').filter(line => line.startsWith('data:'));

          for (const line of lines) {
            const data = line.substring(5).trim();
            
            if (data === '[DONE]') {
              break;
            }

            try {
              const json = JSON.parse(data);
              if (json.token) {
                fullResponse += json.token;
                subject.next(json.token);
              }
              if (json.message) {
                fullResponse += json.message;
                subject.next(json.message);
              }
              // Update session ID if server provides one
              if (json.sessionId) {
                this.sessionId = json.sessionId;
                sessionStorage.setItem('welly_session_id', json.sessionId);
              }
            } catch (e) {
              // Skip invalid JSON
            }
          }
        }
      }

      // Add assistant response to local history for display
      this.conversationHistory.push({
        role: 'assistant',
        content: fullResponse.trim(),
        timestamp: new Date()
      });

      subject.complete();
    } catch (error) {
      console.error('Chat error:', error);
      subject.error('Failed to connect to AI service. Please try again.');
    }
  }

  /**
   * Clear conversation history (both local and server-side)
   */
  clearHistory(): void {
    // Clear server-side session
    if (this.sessionId) {
      fetch(`${this.apiUrl}/chat/session/${this.sessionId}`, {
        method: 'DELETE'
      }).catch(err => console.warn('Failed to clear server session:', err));
    }
    
    // Clear local state
    this.conversationHistory = [];
    this.sessionId = null;
    sessionStorage.removeItem('welly_session_id');
  }

  /**
   * Get conversation history
   */
  getHistory(): ChatMessage[] {
    return [...this.conversationHistory];
  }

  /**
   * Check if AI service is available
   */
  checkHealth(): Observable<boolean> {
    return new Observable(observer => {
      fetch(`${this.apiUrl}/health`)
        .then(response => response.json())
        .then(data => {
          observer.next(data.status === 'ready');
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

      const response = await fetch(`${this.apiUrl}/upload-pdf`, {
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


