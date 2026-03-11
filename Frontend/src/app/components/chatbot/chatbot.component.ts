import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Subscription } from 'rxjs';
import { ChatService, ActionResult } from '../../services/chat.service';

interface ChatMessage {
  text: string;
  isUser: boolean;
  timestamp: Date;
  attachmentName?: string;
  attachmentType?: string;
  isAction?: boolean;
  actionSuccess?: boolean;
}

@Component({
  selector: 'app-chatbot',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './chatbot.component.html',
  styleUrls: ['./chatbot.component.scss']
})
export class ChatbotComponent implements OnInit, OnDestroy {
  isOpen = false;
  isMinimized = false;
  messages: ChatMessage[] = [];
  userInput = '';
  isTyping = false;
  isServiceAvailable = false;
  currentStreamingText = '';
  selectedFile: File | null = null;
  fileInputError = '';
  
  private chatSubscription?: Subscription;
  private actionSubscription?: Subscription;
  private readonly STORAGE_KEY = 'welly_chat_messages';

  constructor(private chatService: ChatService) {}

  ngOnInit(): void {
    // Check if AI service is available
    this.checkServiceHealth();
    // Restore previous messages from session, or show welcome if first time
    this.restoreMessages();
    // Subscribe to AI action results (ticket created, meeting scheduled, etc.)
    this.actionSubscription = this.chatService.actionResults$.subscribe(action => {
      this.handleActionResult(action);
    });
  }

  ngOnDestroy(): void {
    this.chatSubscription?.unsubscribe();
    this.actionSubscription?.unsubscribe();
  }

  private checkServiceHealth(): void {
    this.chatService.checkHealth().subscribe(available => {
      this.isServiceAvailable = available;
      if (!available) {
        this.addBotMessage('⚠️ AI is currently offline — using basic responses.');
      }
    });
  }

  toggleChat(): void {
    if (this.isMinimized) {
      this.isMinimized = false;
    }
    this.isOpen = !this.isOpen;
    if (this.isOpen && !this.isServiceAvailable) {
      this.checkServiceHealth();
    }
  }

  minimizeChat(): void {
    this.isMinimized = true;
  }

  maximizeChat(): void {
    this.isMinimized = false;
  }

  closeChat(): void {
    this.isOpen = false;
    this.isMinimized = false;
  }

  sendMessage(): void {
    if (!this.userInput.trim() && !this.selectedFile) return;

    const userMessage = this.userInput.trim() || 'Please analyze this file';
    this.messages.push({
      text: userMessage,
      isUser: true,
      timestamp: new Date(),
      attachmentName: this.selectedFile?.name,
      attachmentType: this.selectedFile?.type
    });
    this.saveMessages();

    const fileToSend = this.selectedFile;
    this.userInput = '';
    this.selectedFile = null;
    this.fileInputError = '';
    this.isTyping = true;
    this.currentStreamingText = '';
    this.scrollToBottom();

    // Use AI service if available, otherwise fall back to basic responses
    if (this.isServiceAvailable) {
      if (fileToSend) {
        this.sendFileToAI(userMessage, fileToSend);
      } else {
        this.sendToAI(userMessage);
      }
    } else {
      // Fallback to basic responses
      setTimeout(() => {
        if (fileToSend) {
          this.addBotMessage('Sorry, file analysis requires the AI service to be online. The service is currently unavailable.');
        } else {
          this.handleFallbackResponse(userMessage);
        }
        this.isTyping = false;
        this.scrollToBottom();
      }, 500);
    }
  }

  private sendToAI(userMessage: string): void {
    this.chatSubscription = this.chatService.sendMessage(userMessage).subscribe({
      next: (chunk) => {
        this.currentStreamingText += chunk;
        this.scrollToBottom();
      },
      error: (error) => {
        console.error('AI Error:', error);
        this.isTyping = false;
        this.currentStreamingText = '';
        this.addBotMessage('Sorry, I encountered an error. Please try again.');
        this.scrollToBottom();
      },
      complete: () => {
        // Add the complete response as a message (strip any action tags)
        const cleanText = this.stripActionTags(this.currentStreamingText).trim();
        if (cleanText) {
          this.addBotMessage(cleanText);
        }
        this.currentStreamingText = '';
        this.isTyping = false;
        this.scrollToBottom();
      }
    });
  }

  private handleFallbackResponse(userMessage: string): void {
    const message = userMessage.toLowerCase();
    let response = '';

    if (message.includes('attendance') || message.includes('clock in') || message.includes('time')) {
      response = 'Check the **People** page for live attendance status and weekly patterns. On-time = before 07:30 AM.';
    } else if (message.includes('project') || message.includes('board') || message.includes('task')) {
      response = 'Head to **Project Boards** to create boards, drag tasks between lists, and track progress.';
    } else if (message.includes('help') || message.includes('how')) {
      response = 'I can help with attendance, projects, login issues, and general IT queries. What do you need?';
    } else if (message.includes('login') || message.includes('password')) {
      response = 'Check caps lock, try your default credentials, or contact IT/admin for a password reset.';
    } else if (message.includes('employee') || message.includes('people')) {
      response = 'The **People** page shows who\'s in, out, or late — updated in real-time.';
    } else if (message.includes('thank') || message.includes('thanks')) {
      response = 'Happy to help! Let me know if you need anything else. 🙌';
    } else if (message.includes('hi') || message.includes('hello') || message.includes('hey')) {
      response = 'Hi! 👋 How can I help?';
    } else if (message.includes('who are you') || message.includes('what are you')) {
      response = 'I\'m Welly, the IT assistant for ProMed Technologies. I can help with attendance, projects, logistics, stock, and more.';
    } else {
      response = 'I\'m not sure about that. Try asking about attendance, projects, login issues, or app features.';
    }

    this.addBotMessage(response);
  }

  private addBotMessage(text: string): void {
    this.messages.push({
      text,
      isUser: false,
      timestamp: new Date()
    });
    this.saveMessages();
  }

  private handleActionResult(action: ActionResult): void {
    const icon = action.success ? '✅' : '❌';
    const typeLabel = action.type === 'CREATE_TICKET' ? 'Support Ticket' :
                      action.type === 'CREATE_MEETING' ? 'Meeting' :
                      action.type === 'SEND_EMAIL' ? 'Email' :
                      action.type === 'ASSIGN_TODO' ? 'Todo Assigned' :
                      action.type === 'TRACK_VEHICLE' ? 'Vehicle Tracking' :
                      action.type === 'FLEET_STATUS' ? 'Fleet Status' :
                      action.type === 'TRIPSHEET_CREATE' ? 'TripSheet Created' :
                      action.type === 'TRIPSHEET_GET_WAREHOUSES' ? 'Warehouses' :
                      action.type === 'TRIPSHEET_GET_INVOICES' ? 'Pending Invoices' :
                      action.type === 'TRIPSHEET_GET_DRIVERS' ? 'Available Drivers' :
                      action.type === 'TRIPSHEET_GET_VEHICLES' ? 'Available Vehicles' :
                      action.type === 'TRIPSHEET_PREVIEW' ? 'TripSheet Preview' : action.type;

    // For TripSheet data-fetch actions and vehicle tracking, show the data as a regular bot message (not a small action banner)
    const isTripSheetData = action.type.startsWith('TRIPSHEET_') && action.type !== 'TRIPSHEET_CREATE';
    const isTrackingData = action.type === 'TRACK_VEHICLE' || action.type === 'FLEET_STATUS';
    const isDataAction = isTripSheetData || isTrackingData;
    
    this.messages.push({
      text: isDataAction ? action.message : `${icon} **${typeLabel}**: ${action.message}`,
      isUser: false,
      timestamp: new Date(),
      isAction: !isDataAction,
      actionSuccess: isDataAction ? undefined : action.success
    });
    this.saveMessages();
    this.scrollToBottom();
  }

  private restoreMessages(): void {
    try {
      const saved = sessionStorage.getItem(this.STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        this.messages = parsed.map((m: any) => ({
          ...m,
          timestamp: new Date(m.timestamp)
        }));
        setTimeout(() => this.scrollToBottom(), 100);
        return;
      }
    } catch { }
    // First visit — show welcome
    this.addBotMessage('Hi there! 👋 I\'m Welly, your IT assistant. How can I help?');
  }

  private saveMessages(): void {
    try {
      // Keep last 50 messages to avoid filling storage
      const toSave = this.messages.slice(-50);
      sessionStorage.setItem(this.STORAGE_KEY, JSON.stringify(toSave));
    } catch { }
  }

  private scrollToBottom(): void {
    setTimeout(() => {
      const chatMessages = document.querySelector('.chat-messages');
      if (chatMessages) {
        chatMessages.scrollTop = chatMessages.scrollHeight;
      }
    }, 100);
  }

  handleKeyPress(event: KeyboardEvent): void {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      this.sendMessage();
    }
  }

  onFileSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    if (input.files && input.files.length > 0) {
      const file = input.files[0];
      
      // Validate file type (PDF only)
      if (file.type !== 'application/pdf') {
        this.fileInputError = 'Only PDF files are supported';
        this.selectedFile = null;
        return;
      }
      
      // Validate file size (max 10MB)
      const maxSize = 10 * 1024 * 1024; // 10MB
      if (file.size > maxSize) {
        this.fileInputError = 'File size must be less than 10MB';
        this.selectedFile = null;
        return;
      }
      
      this.selectedFile = file;
      this.fileInputError = '';
    }
    // Reset input
    input.value = '';
  }

  removeSelectedFile(): void {
    this.selectedFile = null;
    this.fileInputError = '';
  }

  triggerFileInput(): void {
    const fileInput = document.getElementById('fileInput') as HTMLInputElement;
    fileInput?.click();
  }

  private sendFileToAI(message: string, file: File): void {
    this.chatSubscription = this.chatService.sendMessageWithFile(message, file).subscribe({
      next: (chunk) => {
        this.currentStreamingText += chunk;
        this.scrollToBottom();
      },
      error: (error) => {
        console.error('AI Error:', error);
        this.isTyping = false;
        this.currentStreamingText = '';
        this.addBotMessage('Sorry, I encountered an error processing the file. Please try again.');
        this.scrollToBottom();
      },
      complete: () => {
        const cleanText = this.stripActionTags(this.currentStreamingText).trim();
        if (cleanText) {
          this.addBotMessage(cleanText);
        }
        this.currentStreamingText = '';
        this.isTyping = false;
        this.scrollToBottom();
      }
    });
  }

  /**
   * Strip AI action tags from displayed text so users only see the natural response
   */
  private stripActionTags(text: string): string {
    // Handle nested JSON (arrays, nested objects) in action tags
    return text.replace(/\[ACTION:\w+\]\s*\{(?:[^{}]|\{(?:[^{}]|\{[^{}]*\})*\})*\}\s*\[\/ACTION\]/g, '').trim();
  }
}

