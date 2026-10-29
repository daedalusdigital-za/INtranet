import { Component, OnInit, OnDestroy, ViewChild } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { Subscription } from 'rxjs';
import { ChatService, ActionResult, ChatStreamEvent } from '../../services/chat.service';
import { WellyMascotComponent, WellyMood } from './welly-mascot/welly-mascot.component';

interface ChatMessage {
  text: string;
  isUser: boolean;
  timestamp: Date;
  attachmentName?: string;
  attachmentType?: string;
  isAction?: boolean;
  actionSuccess?: boolean;
}

// Minimal typings for the Web Speech API (not in default TS lib)
interface ISpeechRecognition extends EventTarget {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  maxAlternatives: number;
  start(): void;
  stop(): void;
  abort(): void;
  onresult: ((event: any) => void) | null;
  onerror: ((event: any) => void) | null;
  onend: (() => void) | null;
  onstart: (() => void) | null;
}
declare global {
  interface Window {
    SpeechRecognition?: { new (): ISpeechRecognition };
    webkitSpeechRecognition?: { new (): ISpeechRecognition };
  }
}

@Component({
  selector: 'app-chatbot',
  standalone: true,
  imports: [CommonModule, FormsModule, MatIconModule, MatButtonModule, WellyMascotComponent],
  templateUrl: './chatbot.component.html',
  styleUrls: ['./chatbot.component.scss']
})
export class ChatbotComponent implements OnInit, OnDestroy {
  @ViewChild(WellyMascotComponent) mascot?: WellyMascotComponent;
  /** Face the floating mascot is holding ('idle' = mascot animates on its own). */
  mascotMood: WellyMood = 'idle';
  /** Unread Welly replies while the window is closed → badge + stronger pulse. */
  unreadReplies = 0;
  private mascotTimer?: any;

  isOpen = false;
  isMinimized = false;
  messages: ChatMessage[] = [];
  userInput = '';
  isTyping = false;
  isServiceAvailable = false;
  currentStreamingText = '';
  /** Live reasoning from the model (shown in a collapsible panel, not part of the answer). */
  currentThinkingText = '';
  thinkingExpanded = false;
  /** Progress note while Welly runs an action ("Checking fleet status…"). */
  currentStatus = '';
  selectedFile: File | null = null;
  fileInputError = '';
  
  // ── Voice (Web Speech API) ──────────────────────────────
  speechSupported = false;
  ttsSupported = false;
  isListening = false;
  isSpeaking = false;
  voiceEnabled = false;        // read Welly's replies out loud
  conversationMode = false;    // hands-free: auto re-open mic after Welly speaks
  interimTranscript = '';
  private recognition?: ISpeechRecognition;
  private manualStop = false;

  // ── Immersive Voice Mode (ChatGPT-style) ────────────────
  voiceModeActive = false;
  voiceState: 'idle' | 'listening' | 'thinking' | 'speaking' = 'idle';
  voiceCaption = '';           // live caption text shown in the overlay
  voiceMuted = false;          // mic muted in voice mode
  private preferredVoice?: SpeechSynthesisVoice;
  private silenceTimer?: any;

  // ── Language selection & permission gate ────────────────
  voiceLangOptions = [
    { code: 'en-ZA', label: 'English' },
    { code: 'af-ZA', label: 'Afrikaans' },
    { code: 'zu-ZA', label: 'isiZulu' }
  ];
  voiceLang = 'en-ZA';
  // Permission gate shown before the orb opens
  showVoicePermission = false;
  permissionRequesting = false;
  permissionError = '';

  private chatSubscription?: Subscription;
  private actionSubscription?: Subscription;
  private streamEventSubscription?: Subscription;
  private readonly STORAGE_KEY = 'welly_chat_messages';

  constructor(private chatService: ChatService) {}

  ngOnInit(): void {
    // Check if AI service is available
    this.checkServiceHealth();
    // Set up voice capabilities
    this.initVoice();
    // Restore previous messages from session, or show welcome if first time
    this.restoreMessages();
    // Subscribe to AI action results (ticket created, meeting scheduled, etc.)
    this.actionSubscription = this.chatService.actionResults$.subscribe(action => {
      this.handleActionResult(action);
    });
    this.streamEventSubscription = this.chatService.streamEvents$.subscribe(ev => this.handleStreamEvent(ev));
  }

  ngOnDestroy(): void {
    this.chatSubscription?.unsubscribe();
    this.actionSubscription?.unsubscribe();
    this.streamEventSubscription?.unsubscribe();
    clearTimeout(this.silenceTimer);
    clearTimeout(this.mascotTimer);
    this.stopListening();
    this.stopSpeaking();
  }

  private checkServiceHealth(): void {
    this.chatService.checkHealth().subscribe(available => {
      this.isServiceAvailable = available;
      if (!available) {
        this.addBotMessage('AI is currently offline — using basic responses.');
        this.setMascotMood('error', 2500);
      }
    });
  }

  /**
   * Drive the floating mascot. Pass a duration to auto-return to 'idle';
   * without one the mood is held until the next call (e.g. 'thinking' while streaming).
   */
  private setMascotMood(mood: WellyMood, holdMs?: number): void {
    clearTimeout(this.mascotTimer);
    this.mascotMood = mood;
    if (holdMs && mood !== 'idle') {
      this.mascotTimer = setTimeout(() => { this.mascotMood = 'idle'; }, holdMs);
    }
  }

  /** Click on the mascot: open the chat (and clear unread). */
  onMascotClick(): void {
    this.unreadReplies = 0;
    this.toggleChat();
  }

  toggleChat(): void {
    if (this.isMinimized) {
      this.isMinimized = false;
    }
    this.isOpen = !this.isOpen;
    if (this.isOpen) {
      this.unreadReplies = 0;
      if (!this.isServiceAvailable) this.checkServiceHealth();
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
    this.setMascotMood('thinking');
    this.currentStreamingText = '';
    this.currentThinkingText = '';
    this.currentStatus = '';
    this.thinkingExpanded = false;
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
        this.currentThinkingText = '';
        this.currentStatus = '';
        this.setMascotMood('error', 3000);
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
        this.currentThinkingText = '';
        this.currentStatus = '';
        this.isTyping = false;
        this.setMascotMood('happy', 2200);
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
      response = 'Happy to help! Let me know if you need anything else.';
    } else if (message.includes('hi') || message.includes('hello') || message.includes('hey')) {
      response = 'Hi! How can I help?';
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
    this.speak(text);
    if (!this.isOpen && this.messages.length > 1) this.unreadReplies++;
  }

  private handleActionResult(action: ActionResult): void {
    const typeLabel = action.type === 'CREATE_TICKET' ? 'Support Ticket' :
                      action.type === 'CREATE_MEETING' ? 'Meeting' :
                      action.type === 'SEND_EMAIL' ? 'Email' :
                      action.type === 'ASSIGN_TODO' ? 'Todo Assigned' :
                      action.type === 'TRACK_VEHICLE' ? 'Vehicle Tracking' :
                      action.type === 'FLEET_STATUS' ? 'Fleet Status' :
                      action.type === 'UPDATE_CUSTOMER' ? 'Customer Updated' :
                      action.type === 'LOOKUP_ADDRESS' ? 'Address Lookup' :
                      action.type === 'EDIT_EMPLOYEE' ? 'Employee Updated' :
                      action.type === 'RESET_PASSWORD' ? 'Password Reset' :
                      action.type === 'SYSTEM_OVERVIEW' ? 'System Overview' :
                      action.type === 'CREATE_ANNOUNCEMENT' ? 'Announcement' :
                      action.type === 'TRIPSHEET_CREATE' ? 'TripSheet Created' :
                      action.type === 'TRIPSHEET_GET_WAREHOUSES' ? 'Warehouses' :
                      action.type === 'TRIPSHEET_GET_INVOICES' ? 'Pending Invoices' :
                      action.type === 'TRIPSHEET_GET_DRIVERS' ? 'Available Drivers' :
                      action.type === 'TRIPSHEET_GET_VEHICLES' ? 'Available Vehicles' :
                      action.type === 'TRIPSHEET_PREVIEW' ? 'TripSheet Preview' : action.type;

    // For TripSheet data-fetch actions and vehicle tracking, show the data as a regular bot message (not a small action banner)
    const isTripSheetData = action.type.startsWith('TRIPSHEET_') && action.type !== 'TRIPSHEET_CREATE';
    const isTrackingData = action.type === 'TRACK_VEHICLE' || action.type === 'FLEET_STATUS' || action.type.startsWith('CONTROLLER_');
    const isAddressLookup = action.type === 'LOOKUP_ADDRESS';
    const isOverview = action.type === 'SYSTEM_OVERVIEW' || action.type === 'SEARCH_WEB';
    const isDataAction = isTripSheetData || isTrackingData || isAddressLookup || isOverview;

    // Tool loop: Welly reads data results himself and writes the answer — don't dump raw data twice.
    if (action.summarized && isDataAction) {
      return;
    }
    
    this.messages.push({
      text: isDataAction ? action.message : `**${typeLabel}**: ${action.message}`,
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
    this.addBotMessage('Hi there! I\'m Welly, your IT assistant. How can I help?');
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

  // ═══════════════════════════════════════════
  // Voice: Speech-to-Text (mic) & Text-to-Speech (speaker)
  // ═══════════════════════════════════════════

  private initVoice(): void {
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    this.speechSupported = !!SR;
    this.ttsSupported = typeof window !== 'undefined' && 'speechSynthesis' in window;

    if (SR) {
      this.recognition = new SR();
      this.recognition.lang = this.voiceLang;
      this.recognition.continuous = false;
      this.recognition.interimResults = true;
      this.recognition.maxAlternatives = 1;

      this.recognition.onstart = () => {
        this.isListening = true;
        this.interimTranscript = '';
      };

      this.recognition.onresult = (event: any) => {
        let interim = '';
        let final = '';
        for (let i = event.resultIndex; i < event.results.length; i++) {
          const transcript = event.results[i][0].transcript;
          if (event.results[i].isFinal) {
            final += transcript;
          } else {
            interim += transcript;
          }
        }
        this.interimTranscript = interim;
        if (final) {
          this.userInput = (this.userInput ? this.userInput + ' ' : '') + final.trim();
        }
        // Live caption in immersive voice mode
        if (this.voiceModeActive) {
          this.voiceCaption = (this.userInput + ' ' + interim).trim();
          // Reset the silence timer on every bit of speech; when the user
          // pauses for ~1.2s we treat the turn as finished and send.
          this.resetSilenceTimer();
        }
      };

      this.recognition.onerror = (event: any) => {
        console.warn('Speech recognition error:', event.error);
        this.isListening = false;
        this.interimTranscript = '';
        if (this.voiceModeActive && event.error === 'not-allowed') {
          this.voiceCaption = 'Microphone blocked. Please allow mic access.';
        }
      };

      this.recognition.onend = () => {
        this.isListening = false;
        this.interimTranscript = '';
        // Single-shot dictation mode: auto-send captured text
        if (!this.manualStop && this.conversationMode && !this.voiceModeActive && this.userInput.trim()) {
          this.sendMessage();
        }
        // Immersive voice mode
        if (this.voiceModeActive && !this.manualStop) {
          // Chrome auto-stops after a pause. If we captured any speech, treat
          // this as the end of the user's turn and send it. Otherwise keep the
          // mic "always on" by restarting recognition.
          if (this.voiceState === 'listening') {
            if (this.spokenText().trim()) {
              this.finalizeVoiceTurn();
            } else {
              this.startRecognition();
            }
          }
        }
        this.manualStop = false;
      };
    }
  }

  private startRecognition(): void {
    if (!this.recognition) return;
    try { this.recognition.start(); } catch { /* already started */ }
  }

  /** Everything the user has said this turn (final + interim). */
  private spokenText(): string {
    return (this.userInput + ' ' + this.interimTranscript).trim();
  }

  /** End the current listening turn and send it to Welly. */
  private finalizeVoiceTurn(): void {
    clearTimeout(this.silenceTimer);
    const text = this.spokenText();
    if (!text) { this.startRecognition(); return; }
    // Make sure the captured interim words become the message
    this.userInput = text;
    this.interimTranscript = '';
    this.manualStop = true;
    try { this.recognition?.stop(); } catch { }
    this.voiceState = 'thinking';
    this.voiceCaption = '';
    this.sendMessage();
  }

  private resetSilenceTimer(): void {
    clearTimeout(this.silenceTimer);
    this.silenceTimer = setTimeout(() => {
      // User paused — finish this turn and send to Welly (use interim too)
      if (this.voiceModeActive && this.voiceState === 'listening' && this.spokenText()) {
        this.finalizeVoiceTurn();
      }
    }, 1200);
  }

  /** Toggle the mic on/off for a single dictation */
  toggleListening(): void {
    if (!this.speechSupported || !this.recognition) return;
    if (this.isListening) {
      this.stopListening();
    } else {
      // Don't listen while Welly is talking
      this.stopSpeaking();
      this.startRecognition();
    }
  }

  private stopListening(): void {
    if (this.recognition && this.isListening) {
      this.manualStop = true;
      try { this.recognition.stop(); } catch { }
    }
  }

  /** Toggle hands-free conversation mode (mic re-opens after Welly speaks) */
  toggleConversationMode(): void {
    this.conversationMode = !this.conversationMode;
    if (this.conversationMode) {
      this.voiceEnabled = true; // conversation needs spoken replies
      if (!this.isListening) this.toggleListening();
    } else {
      this.stopListening();
    }
  }

  /** Toggle whether Welly reads replies aloud */
  toggleVoiceOutput(): void {
    this.voiceEnabled = !this.voiceEnabled;
    if (!this.voiceEnabled) {
      this.stopSpeaking();
      this.conversationMode = false;
    }
  }

  // ═══════════════════════════════════════════
  // Immersive Voice Mode (ChatGPT-style)
  // ═══════════════════════════════════════════

  /** Enter the full-screen hands-free voice conversation */
  startVoiceMode(): void {
    if (!this.speechSupported || !this.ttsSupported) return;
    // Show the permission gate first — this lets the user pick a language and
    // explicitly grant mic access before the orb opens.
    this.permissionError = '';
    this.permissionRequesting = false;
    this.showVoicePermission = true;
  }

  /** Called from the permission gate: request mic access, then open the orb */
  async confirmVoicePermission(): Promise<void> {
    this.permissionError = '';

    // Secure-context check: getUserMedia & SpeechRecognition require HTTPS
    // (localhost is exempt). On a plain http:// LAN address the browser blocks
    // the mic, so surface a clear message instead of failing silently.
    const isSecure = window.isSecureContext ||
      location.hostname === 'localhost' ||
      location.hostname === '127.0.0.1';

    if (!isSecure) {
      this.permissionError =
        'Your browser blocks the microphone on insecure (http://) pages. ' +
        'Ask IT to enable HTTPS, or in Chrome open chrome://flags/#unsafely-treat-insecure-origin-as-secure, ' +
        'add this site’s address, and restart the browser.';
      return;
    }

    this.permissionRequesting = true;
    try {
      // Explicitly prompt for mic access and immediately release the stream —
      // we only need the permission grant; SpeechRecognition opens its own mic.
      if (navigator.mediaDevices?.getUserMedia) {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        stream.getTracks().forEach(t => t.stop());
      }
    } catch (err: any) {
      this.permissionRequesting = false;
      if (err?.name === 'NotAllowedError' || err?.name === 'SecurityError') {
        this.permissionError =
          'Microphone permission was denied. Click the padlock icon in the address bar, ' +
          'allow the microphone for this site, then try again.';
      } else if (err?.name === 'NotFoundError') {
        this.permissionError = 'No microphone was found. Please connect a mic and try again.';
      } else {
        this.permissionError = 'Could not access the microphone. Please check your device settings.';
      }
      return;
    }

    this.permissionRequesting = false;
    this.showVoicePermission = false;

    // Apply chosen language to recognition
    if (this.recognition) this.recognition.lang = this.voiceLang;

    // Make sure the chat window is open so state is consistent
    this.isOpen = true;
    this.isMinimized = false;
    this.voiceModeActive = true;
    this.voiceEnabled = true;
    this.voiceMuted = false;
    this.userInput = '';
    this.voiceCaption = '';
    this.loadPreferredVoice();
    this.beginListeningTurn();
  }

  /** Cancel the permission gate without entering voice mode */
  cancelVoicePermission(): void {
    this.showVoicePermission = false;
    this.permissionError = '';
    this.permissionRequesting = false;
  }

  /** Change language mid-conversation */
  setVoiceLang(code: string): void {
    this.voiceLang = code;
    if (this.recognition) this.recognition.lang = code;
    this.loadPreferredVoice();
  }

  /** Exit voice mode and return to the text chat */
  exitVoiceMode(): void {
    this.voiceModeActive = false;
    this.voiceState = 'idle';
    this.voiceCaption = '';
    clearTimeout(this.silenceTimer);
    this.manualStop = true;
    try { this.recognition?.stop(); } catch { }
    this.stopSpeaking();
  }

  /** Start a listening turn in voice mode */
  private beginListeningTurn(): void {
    if (!this.voiceModeActive || this.voiceMuted) return;
    this.stopSpeaking();
    this.userInput = '';
    this.interimTranscript = '';
    this.voiceCaption = '';
    this.voiceState = 'listening';
    this.manualStop = false;
    this.startRecognition();
  }

  /** Tap the orb: barge-in — interrupt Welly and start listening again */
  onVoiceOrbTap(): void {
    if (this.voiceState === 'speaking') {
      this.stopSpeaking();
      this.beginListeningTurn();
    } else if (this.voiceState === 'listening') {
      // Force-send whatever we have so far
      clearTimeout(this.silenceTimer);
      if (this.spokenText()) {
        this.finalizeVoiceTurn();
      }
    } else if (this.voiceState === 'idle' || this.voiceState === 'thinking') {
      this.beginListeningTurn();
    }
  }

  /** Mute/unmute the mic during voice mode */
  toggleVoiceMute(): void {
    this.voiceMuted = !this.voiceMuted;
    if (this.voiceMuted) {
      this.manualStop = true;
      clearTimeout(this.silenceTimer);
      try { this.recognition?.stop(); } catch { }
      this.voiceState = 'idle';
    } else {
      this.beginListeningTurn();
    }
  }

  private loadPreferredVoice(): void {
    if (!this.ttsSupported) return;
    const langPrefix = (this.voiceLang || 'en-ZA').split('-')[0]; // en / af / zu
    const pick = () => {
      const voices = window.speechSynthesis.getVoices();
      if (!voices.length) return;
      // 1) Exact language match (e.g. zu-ZA, af-ZA, en-ZA)
      // 2) Same language prefix (zu*, af*, en*)
      // 3) Fall back to a natural English voice
      this.preferredVoice =
        voices.find(v => v.lang.toLowerCase() === this.voiceLang.toLowerCase()) ||
        voices.find(v => v.lang.toLowerCase().startsWith(langPrefix)) ||
        voices.find(v => /en-ZA/i.test(v.lang)) ||
        voices.find(v => /en-GB/i.test(v.lang) && /female|Google|Natural/i.test(v.name)) ||
        voices.find(v => /en-GB/i.test(v.lang)) ||
        voices.find(v => /Google US English/i.test(v.name)) ||
        voices.find(v => /^en/i.test(v.lang)) ||
        voices[0];
    };
    pick();
    if (!this.preferredVoice) {
      window.speechSynthesis.onvoiceschanged = () => pick();
    }
  }

  private speak(text: string): void {
    // In immersive voice mode we always speak, regardless of the toggle
    if (!this.ttsSupported || (!this.voiceEnabled && !this.voiceModeActive) || !text) return;
    // Strip markdown / emojis for cleaner speech
    const clean = text
      .replace(/[*_#`>]/g, '')
      .replace(/\[[^\]]*\]\([^)]*\)/g, '')
      .replace(/[\u{1F000}-\u{1FFFF}\u{2600}-\u{27BF}]/gu, '')
      .trim();
    if (!clean) return;

    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(clean);
    if (this.preferredVoice) utterance.voice = this.preferredVoice;
    utterance.lang = this.preferredVoice?.lang || this.voiceLang || 'en-ZA';
    utterance.rate = 1.05;
    utterance.pitch = 1.0;
    utterance.onstart = () => {
      this.isSpeaking = true;
      if (this.voiceModeActive) {
        this.voiceState = 'speaking';
        this.voiceCaption = clean;
      }
    };
    utterance.onend = () => {
      this.isSpeaking = false;
      if (this.voiceModeActive) {
        // Turn finished — automatically listen for the next thing the user says
        this.voiceCaption = '';
        if (!this.voiceMuted) {
          setTimeout(() => this.beginListeningTurn(), 250);
        } else {
          this.voiceState = 'idle';
        }
      } else if (this.conversationMode && !this.isListening) {
        // Legacy in-panel conversation mode
        setTimeout(() => this.toggleListening(), 300);
      }
    };
    utterance.onerror = () => {
      this.isSpeaking = false;
      if (this.voiceModeActive && !this.voiceMuted) {
        setTimeout(() => this.beginListeningTurn(), 250);
      }
    };
    window.speechSynthesis.speak(utterance);
  }

  stopSpeaking(): void {
    if (this.ttsSupported) {
      window.speechSynthesis.cancel();
    }
    this.isSpeaking = false;
  }

  onFileSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    if (input.files && input.files.length > 0) {
      const file = input.files[0];
      
      // Validate file type (PDF, Excel, CSV)
      const allowedTypes = [
        'application/pdf',
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', // .xlsx
        'application/vnd.ms-excel', // .xls
        'text/csv',
        'application/csv'
      ];
      const allowedExtensions = ['.pdf', '.xlsx', '.xls', '.csv'];
      const fileExt = file.name.substring(file.name.lastIndexOf('.')).toLowerCase();
      
      if (!allowedTypes.includes(file.type) && !allowedExtensions.includes(fileExt)) {
        this.fileInputError = 'Only PDF, Excel (.xlsx/.xls), and CSV files are supported';
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
    return text
      .replace(/\[ACTION:\w+\]\s*\{(?:[^{}]|\{(?:[^{}]|\{[^{}]*\})*\})*\}\s*\[\/ACTION\]/g, '')
      // Gemma native tool-call syntax (normalised server-side, but never show it raw)
      .replace(/<\|tool_call>\s*call:\s*\w+\s*\{(?:[^{}]|\{(?:[^{}]|\{[^{}]*\})*\})*\}\s*(?:<tool_call\|>|\[\/ACTION\])?/g, '')
      .trim();
  }

  /**
   * Streaming text safe to show: complete action tags removed, and anything after an
   * unterminated "[ACTION:" (still being generated) hidden so users never see raw JSON.
   */
  get displayStreamingText(): string {
    let text = this.stripActionTags(this.currentStreamingText);
    const open = Math.max(text.lastIndexOf('[ACTION:'), text.lastIndexOf('<|tool_call>'));
    if (open >= 0) {
      text = text.substring(0, open);
    }
    // Hide a partial "[ACTIO" / "<|tool_c" prefix at the tail
    const tail = text.match(/(?:\[(?:A(?:C(?:T(?:I(?:O(?:N:?)?)?)?)?)?)?|<(?:\|(?:t(?:o(?:o(?:l(?:_(?:c(?:a(?:l(?:l>?)?)?)?)?)?)?)?)?)?)?)$/);
    if (tail && tail[0]) text = text.substring(0, text.length - tail[0].length);
    return text;
  }

  /** True while the model is emitting an action tag (shows "Working on it…" instead of JSON). */
  get isEmittingAction(): boolean {
    const t = this.currentStreamingText;
    const open = Math.max(t.lastIndexOf('[ACTION:'), t.lastIndexOf('<|tool_call>'));
    return open >= 0 && this.stripActionTags(t.substring(open)).length > 0;
  }

  private handleStreamEvent(ev: ChatStreamEvent): void {
    if (ev.type === 'thinking') {
      this.currentThinkingText += ev.text;
      if (this.voiceModeActive) this.voiceState = 'thinking';
    } else if (ev.type === 'status') {
      this.currentStatus = ev.text;
      // Welly is running a tool/action → "updating" face while it works
      if (this.isTyping) this.setMascotMood('updating');
    }
    this.scrollToBottom();
  }

  toggleThinking(): void {
    this.thinkingExpanded = !this.thinkingExpanded;
  }
}

