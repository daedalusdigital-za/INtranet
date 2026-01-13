import { Injectable } from '@angular/core';
import { MatSnackBar } from '@angular/material/snack-bar';
import { BehaviorSubject } from 'rxjs';

export interface NotificationConfig {
  title: string;
  message: string;
  type?: 'info' | 'success' | 'warning' | 'error';
  duration?: number;
  playSound?: boolean;
  showPopup?: boolean;
}

@Injectable({
  providedIn: 'root'
})
export class NotificationService {
  private audio: HTMLAudioElement | null = null;
  private notificationPermission: NotificationPermission = 'default';
  
  // Observable for unread message count
  private unreadCountSubject = new BehaviorSubject<number>(0);
  public unreadCount$ = this.unreadCountSubject.asObservable();

  constructor(private snackBar: MatSnackBar) {
    this.initAudio();
    this.requestNotificationPermission();
  }

  private initAudio(): void {
    // Create audio element for notification sound
    this.audio = new Audio();
    // Use a simple notification sound (we'll create a simple beep with Web Audio API)
    this.audio.src = this.createNotificationSound();
    this.audio.load();
  }

  private createNotificationSound(): string {
    // Create a simple notification beep using Web Audio API and convert to data URL
    const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
    const duration = 0.2;
    const sampleRate = audioContext.sampleRate;
    const buffer = audioContext.createBuffer(1, duration * sampleRate, sampleRate);
    const channel = buffer.getChannelData(0);
    
    // Generate a pleasant notification tone (two quick beeps)
    for (let i = 0; i < buffer.length; i++) {
      const t = i / sampleRate;
      const freq = 800; // Hz
      let value = Math.sin(2 * Math.PI * freq * t);
      
      // Envelope to avoid clicks
      const attack = 0.01;
      const release = 0.05;
      let envelope = 1;
      if (t < attack) {
        envelope = t / attack;
      } else if (t > duration - release) {
        envelope = (duration - t) / release;
      }
      
      // Two beeps pattern
      if (t < 0.08 || (t > 0.12 && t < 0.2)) {
        value *= envelope * 0.3;
      } else {
        value = 0;
      }
      
      channel[i] = value;
    }
    
    // Convert to WAV and data URL
    const wav = this.bufferToWave(buffer, buffer.length);
    const blob = new Blob([wav], { type: 'audio/wav' });
    return URL.createObjectURL(blob);
  }

  private bufferToWave(abuffer: AudioBuffer, len: number): ArrayBuffer {
    const numOfChan = abuffer.numberOfChannels;
    const length = len * numOfChan * 2 + 44;
    const buffer = new ArrayBuffer(length);
    const view = new DataView(buffer);
    const channels = [];
    let sample;
    let offset = 0;
    let pos = 0;

    // Write WAV header
    setUint32(0x46464952); // "RIFF"
    setUint32(length - 8); // file length - 8
    setUint32(0x45564157); // "WAVE"
    setUint32(0x20746d66); // "fmt " chunk
    setUint32(16); // length = 16
    setUint16(1); // PCM (uncompressed)
    setUint16(numOfChan);
    setUint32(abuffer.sampleRate);
    setUint32(abuffer.sampleRate * 2 * numOfChan); // avg. bytes/sec
    setUint16(numOfChan * 2); // block-align
    setUint16(16); // 16-bit
    setUint32(0x61746164); // "data" - chunk
    setUint32(length - pos - 4); // chunk length

    // Write interleaved data
    for (let i = 0; i < abuffer.numberOfChannels; i++) {
      channels.push(abuffer.getChannelData(i));
    }

    while (pos < length) {
      for (let i = 0; i < numOfChan; i++) {
        sample = Math.max(-1, Math.min(1, channels[i][offset]));
        sample = (0.5 + sample < 0 ? sample * 32768 : sample * 32767) | 0;
        view.setInt16(pos, sample, true);
        pos += 2;
      }
      offset++;
    }

    return buffer;

    function setUint16(data: number) {
      view.setUint16(pos, data, true);
      pos += 2;
    }

    function setUint32(data: number) {
      view.setUint32(pos, data, true);
      pos += 4;
    }
  }

  private async requestNotificationPermission(): Promise<void> {
    if ('Notification' in window) {
      this.notificationPermission = await Notification.requestPermission();
    }
  }

  public playNotificationSound(): void {
    if (this.audio) {
      this.audio.currentTime = 0;
      this.audio.play().catch(err => {
        console.log('Could not play notification sound:', err);
      });
    }
  }

  public showNotification(config: NotificationConfig): void {
    const {
      title,
      message,
      type = 'info',
      duration = 5000,
      playSound = true,
      showPopup = true
    } = config;

    // Play sound if enabled
    if (playSound) {
      this.playNotificationSound();
    }

    // Show snackbar
    this.snackBar.open(message, 'View', {
      duration,
      horizontalPosition: 'right',
      verticalPosition: 'top',
      panelClass: [`notification-${type}`]
    });

    // Show browser notification if enabled and permission granted
    if (showPopup && this.notificationPermission === 'granted' && document.hidden) {
      const notification = new Notification(title, {
        body: message,
        icon: '/favicon.ico',
        badge: '/favicon.ico',
        tag: 'message-notification',
        requireInteraction: false
      });

      notification.onclick = () => {
        window.focus();
        notification.close();
      };

      // Auto close after duration
      setTimeout(() => notification.close(), duration);
    }
  }

  public showMessageNotification(senderName: string, message: string): void {
    this.showNotification({
      title: `New message from ${senderName}`,
      message: message.length > 50 ? message.substring(0, 50) + '...' : message,
      type: 'info',
      playSound: true,
      showPopup: true
    });
  }

  public showTodoNotification(notification: any): void {
    let title = 'ToDo Notification';
    let type: 'info' | 'success' | 'warning' | 'error' = 'info';
    
    switch (notification.notificationType) {
      case 'TaskAssigned':
        title = 'New Task Assigned';
        type = 'info';
        break;
      case 'TaskAccepted':
        title = 'Task Accepted';
        type = 'success';
        break;
      case 'TaskDeclined':
        title = 'Task Declined';
        type = 'warning';
        break;
      case 'TaskCompleted':
        title = 'Task Completed';
        type = 'success';
        break;
    }

    this.showNotification({
      title,
      message: notification.message,
      type,
      playSound: true,
      showPopup: true,
      duration: 8000
    });
  }

  public updateUnreadCount(count: number): void {
    this.unreadCountSubject.next(count);
    
    // Update document title
    if (count > 0) {
      document.title = `(${count}) Intranet - Messages`;
    } else {
      document.title = 'Intranet';
    }
  }

  public incrementUnreadCount(): void {
    const current = this.unreadCountSubject.value;
    this.updateUnreadCount(current + 1);
  }

  public decrementUnreadCount(amount: number = 1): void {
    const current = this.unreadCountSubject.value;
    this.updateUnreadCount(Math.max(0, current - amount));
  }

  public getUnreadCount(): number {
    return this.unreadCountSubject.value;
  }
}
