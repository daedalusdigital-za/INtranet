import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Subscription } from 'rxjs';
import { ChatService } from '../../services/chat.service';

interface ChatMessage {
  text: string;
  isUser: boolean;
  timestamp: Date;
  attachmentName?: string;
  attachmentType?: string;
}

@Component({
  selector: 'app-chatbot',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './chatbot.component.html',
  styleUrls: ['./chatbot.component.scss'],
  providers: [ChatService]
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

  constructor(private chatService: ChatService) {}

  ngOnInit(): void {
    // Check if AI service is available
    this.checkServiceHealth();
    // Welcome message
    this.addBotMessage('Hey there! 👋 I\'m Welly from IT. Need help with ProjectTracker or anything tech-related? Fire away!');
  }

  ngOnDestroy(): void {
    this.chatSubscription?.unsubscribe();
  }

  private checkServiceHealth(): void {
    this.chatService.checkHealth().subscribe(available => {
      this.isServiceAvailable = available;
      if (!available) {
        this.addBotMessage('⚠️ AI service is currently offline. Falling back to basic responses.');
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
        // Add the complete response as a message
        if (this.currentStreamingText.trim()) {
          this.addBotMessage(this.currentStreamingText.trim());
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
      response = 'Ah, attendance stuff! Here\'s the deal:\n• Check the People page for live status\n• Weekly patterns are there too\n• On-time means before 07:30 AM - don\'t be that person who\'s always "just a minute late" 😉';
    } else if (message.includes('project') || message.includes('board') || message.includes('task')) {
      response = 'Projects are my jam! You can:\n• Create boards for different projects\n• Drag cards between lists (very satisfying, trust me)\n• Track progress without endless email chains\n\nHonestly, once you get the hang of it, you\'ll wonder how you lived without it.';
    } else if (message.includes('help') || message.includes('how')) {
      response = 'I\'m your guy for:\n• Attendance & time tracking\n• Project boards & tasks\n• General IT stuff\n• Random tech questions\n\nWhat\'s on your mind?';
    } else if (message.includes('login') || message.includes('password')) {
      response = 'Login trouble? Classic. Here\'s what to try:\n• Double-check caps lock (happens to the best of us)\n• Try your default credentials from onboarding\n• If all else fails, shoot me or admin a message for a reset\n\nWe\'ll get you sorted!';
    } else if (message.includes('employee') || message.includes('people')) {
      response = 'The People page is pretty handy:\n• See who\'s in, who\'s out, who\'s running late\n• Check profiles and attendance history\n• It updates in real-time, so no more walking to someone\'s desk only to find they\'re not there 😅';
    } else if (message.includes('thank') || message.includes('thanks')) {
      response = 'No problem at all! That\'s what I\'m here for. Give me a shout if anything else comes up. Cheers! 🙌';
    } else if (message.includes('hi') || message.includes('hello') || message.includes('hey')) {
      response = 'Hey! 👋 What can I help you with today?';
    } else if (message.includes('who are you') || message.includes('what are you')) {
      response = 'I\'m Welly! I work in IT and handle support for ProjectTracker and general tech stuff. Been here a few years now, so I know my way around. What do you need help with?';
    } else {
      response = 'Hmm, I\'m not quite sure about that one. Try asking me about:\n• Attendance & time tracking\n• Project boards\n• Login issues\n• General app help\n\nOr just describe your problem and I\'ll do my best!';
    }

    this.addBotMessage(response);
  }

  private addBotMessage(text: string): void {
    this.messages.push({
      text,
      isUser: false,
      timestamp: new Date()
    });
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
        if (this.currentStreamingText.trim()) {
          this.addBotMessage(this.currentStreamingText.trim());
        }
        this.currentStreamingText = '';
        this.isTyping = false;
        this.scrollToBottom();
      }
    });
  }
}
