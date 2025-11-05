import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

interface ChatMessage {
  text: string;
  isUser: boolean;
  timestamp: Date;
}

@Component({
  selector: 'app-chatbot',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './chatbot.component.html',
  styleUrls: ['./chatbot.component.scss']
})
export class ChatbotComponent implements OnInit {
  isOpen = false;
  isMinimized = false;
  messages: ChatMessage[] = [];
  userInput = '';
  isTyping = false;

  ngOnInit(): void {
    // Welcome message
    this.addBotMessage('Hello! 👋 I\'m your PharmaCare assistant. How can I help you today?');
  }

  toggleChat(): void {
    if (this.isMinimized) {
      this.isMinimized = false;
    }
    this.isOpen = !this.isOpen;
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
    if (!this.userInput.trim()) return;

    const userMessage = this.userInput.trim();
    this.messages.push({
      text: userMessage,
      isUser: true,
      timestamp: new Date()
    });

    this.userInput = '';
    this.isTyping = true;

    // Simulate bot response
    setTimeout(() => {
      this.handleBotResponse(userMessage);
      this.isTyping = false;
      this.scrollToBottom();
    }, 1000 + Math.random() * 1000);

    this.scrollToBottom();
  }

  private handleBotResponse(userMessage: string): void {
    const message = userMessage.toLowerCase();
    let response = '';

    if (message.includes('attendance') || message.includes('clock in') || message.includes('time')) {
      response = 'For attendance queries, you can:\n• View real-time employee status on the People page\n• Check weekly attendance patterns\n• Monitor clock-in/clock-out times\n• The on-time threshold is 07:30 AM';
    } else if (message.includes('project') || message.includes('board') || message.includes('task')) {
      response = 'Project management features:\n• Create and manage project boards\n• Organize tasks in lists\n• Track project progress\n• Collaborate with your team';
    } else if (message.includes('help') || message.includes('how')) {
      response = 'I can help you with:\n• Employee attendance tracking\n• Project management\n• Navigation tips\n• General system features\n\nWhat would you like to know more about?';
    } else if (message.includes('login') || message.includes('password')) {
      response = 'For login issues:\n• Contact your system administrator\n• Default credentials are provided during onboarding\n• Password resets can be requested through admin';
    } else if (message.includes('employee') || message.includes('people')) {
      response = 'Employee features:\n• Real-time attendance monitoring\n• View employee profiles and photos\n• Check weekly attendance history\n• See who\'s present, late, or absent';
    } else if (message.includes('thank') || message.includes('thanks')) {
      response = 'You\'re welcome! Feel free to ask if you need anything else. 😊';
    } else if (message.includes('hi') || message.includes('hello')) {
      response = 'Hello! How can I assist you today?';
    } else {
      response = 'I\'m here to help! You can ask me about:\n• Employee attendance\n• Project management\n• System features\n• Navigation help\n\nWhat would you like to know?';
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
}
