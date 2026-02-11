import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { MatSnackBar } from '@angular/material/snack-bar';
import { BehaviorSubject, forkJoin, of, Observable } from 'rxjs';
import { catchError, tap, map } from 'rxjs/operators';
import { environment } from '../../environments/environment';

export interface NotificationConfig {
  title: string;
  message: string;
  type?: 'info' | 'success' | 'warning' | 'error';
  duration?: number;
  playSound?: boolean;
  showPopup?: boolean;
}

export type NotificationType = 'meeting' | 'announcement' | 'task' | 'system' | 'message';

export interface UnifiedNotification {
  id: string;
  type: NotificationType;
  icon: string;
  iconClass: string;
  title: string;
  message: string;
  timestamp: Date;
  isRead: boolean;
  data?: any;
  actions?: NotificationAction[];
}

export interface NotificationAction {
  label: string;
  action: string;
  color?: 'primary' | 'warn' | 'accent';
}

export interface MeetingNotificationData {
  id: number;
  meetingId: number;
  meetingTitle: string;
  meetingDate: Date;
  startTime: string;
  location: string;
  organizerName: string;
  message: string;
  notificationType: string;
  isRead: boolean;
  createdAt: Date;
}

export interface AnnouncementData {
  announcementId: number;
  title: string;
  content: string;
  createdByName: string;
  createdAt: Date;
  priority: string;
  category?: string;
  isRead: boolean;
}

@Injectable({
  providedIn: 'root'
})
export class NotificationService {
  private audio: HTMLAudioElement | null = null;
  private notificationPermission: NotificationPermission = 'default';
  
  // Notification settings
  private soundEnabled = true;
  private popupEnabled = true;
  private toastEnabled = true;
  
  // Observable for unread message count (for messages specifically)
  private unreadCountSubject = new BehaviorSubject<number>(0);
  public unreadCount$ = this.unreadCountSubject.asObservable();

  // Unified notifications
  private notificationsSubject = new BehaviorSubject<UnifiedNotification[]>([]);
  public notifications$ = this.notificationsSubject.asObservable();

  private totalUnreadSubject = new BehaviorSubject<number>(0);
  public totalUnread$ = this.totalUnreadSubject.asObservable();

  private loadingSubject = new BehaviorSubject<boolean>(false);
  public loading$ = this.loadingSubject.asObservable();

  constructor(
    private snackBar: MatSnackBar,
    private http: HttpClient
  ) {
    this.loadSettings();
    this.initAudio();
    this.requestNotificationPermission();
  }

  private loadSettings(): void {
    const settings = localStorage.getItem('notificationSettings');
    if (settings) {
      const parsed = JSON.parse(settings);
      this.soundEnabled = parsed.soundEnabled ?? true;
      this.popupEnabled = parsed.popupEnabled ?? true;
      this.toastEnabled = parsed.toastEnabled ?? true;
    }
  }

  public saveSettings(settings: { soundEnabled?: boolean; popupEnabled?: boolean; toastEnabled?: boolean }): void {
    if (settings.soundEnabled !== undefined) this.soundEnabled = settings.soundEnabled;
    if (settings.popupEnabled !== undefined) this.popupEnabled = settings.popupEnabled;
    if (settings.toastEnabled !== undefined) this.toastEnabled = settings.toastEnabled;
    localStorage.setItem('notificationSettings', JSON.stringify({
      soundEnabled: this.soundEnabled,
      popupEnabled: this.popupEnabled,
      toastEnabled: this.toastEnabled
    }));
  }

  public getSettings(): { soundEnabled: boolean; popupEnabled: boolean; toastEnabled: boolean } {
    return {
      soundEnabled: this.soundEnabled,
      popupEnabled: this.popupEnabled,
      toastEnabled: this.toastEnabled
    };
  }

  private getHeaders(): HttpHeaders {
    const token = localStorage.getItem('token');
    return new HttpHeaders({
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`
    });
  }

  private initAudio(): void {
    // Create audio element for notification sound
    this.audio = new Audio();
    // Use a simple notification sound (we'll create a simple beep with Web Audio API)
    this.audio.src = this.createNotificationSound();
    this.audio.load();
  }

  private createNotificationSound(): string {
    // Create a pleasant notification sound using Web Audio API
    const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
    const duration = 0.5;
    const sampleRate = audioContext.sampleRate;
    const buffer = audioContext.createBuffer(1, duration * sampleRate, sampleRate);
    const channel = buffer.getChannelData(0);
    
    // Generate a pleasant two-tone notification chime
    for (let i = 0; i < buffer.length; i++) {
      const t = i / sampleRate;
      let value = 0;
      
      // First chime (higher pitch)
      if (t < 0.15) {
        const freq = 880; // A5
        let envelope = 1;
        if (t < 0.02) envelope = t / 0.02;
        else if (t > 0.1) envelope = (0.15 - t) / 0.05;
        value += Math.sin(2 * Math.PI * freq * t) * envelope * 0.4;
      }
      
      // Second chime (even higher, delayed)
      if (t > 0.12 && t < 0.35) {
        const localT = t - 0.12;
        const freq = 1046.5; // C6
        let envelope = 1;
        if (localT < 0.02) envelope = localT / 0.02;
        else if (localT > 0.18) envelope = (0.23 - localT) / 0.05;
        value += Math.sin(2 * Math.PI * freq * localT) * envelope * 0.4;
      }
      
      // Third subtle chime
      if (t > 0.25 && t < 0.5) {
        const localT = t - 0.25;
        const freq = 1318.5; // E6
        let envelope = 1;
        if (localT < 0.02) envelope = localT / 0.02;
        else if (localT > 0.2) envelope = (0.25 - localT) / 0.05;
        value += Math.sin(2 * Math.PI * freq * localT) * envelope * 0.3;
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
    if (!this.soundEnabled) return;
    
    if (this.audio) {
      this.audio.currentTime = 0;
      this.audio.volume = 0.5; // Set reasonable volume
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
    if (playSound && this.soundEnabled) {
      this.playNotificationSound();
    }

    // Show snackbar (always show for messages, respects toastEnabled)
    if (this.toastEnabled) {
      this.snackBar.open(`${title}: ${message}`, 'View', {
        duration,
        horizontalPosition: 'right',
        verticalPosition: 'top',
        panelClass: [`notification-${type}`, 'message-notification-snack']
      });
    }

    // Show browser notification if enabled and permission granted
    if (showPopup && this.popupEnabled && this.notificationPermission === 'granted') {
      const notification = new Notification(title, {
        body: message,
        icon: '/favicon.ico',
        badge: '/favicon.ico',
        tag: 'message-notification-' + Date.now(),
        requireInteraction: false,
        silent: true // We play our own sound
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

  // ===== Unified Notification Center Methods =====

  loadAllNotifications(): void {
    this.loadingSubject.next(true);
    
    forkJoin({
      meetings: this.http.get<MeetingNotificationData[]>(
        `${environment.apiUrl}/meetings/notifications?unreadOnly=false`,
        { headers: this.getHeaders() }
      ).pipe(catchError(() => of([]))),
      announcements: this.http.get<AnnouncementData[]>(
        `${environment.apiUrl}/announcements?activeOnly=true&limit=20`,
        { headers: this.getHeaders() }
      ).pipe(catchError(() => of([])))
    }).subscribe({
      next: ({ meetings, announcements }) => {
        const unifiedNotifications: UnifiedNotification[] = [];

        // Convert meeting notifications
        meetings.forEach((m: MeetingNotificationData) => {
          const actions: NotificationAction[] = [];
          if (m.notificationType === 'Invitation' && !m.isRead) {
            actions.push(
              { label: 'Accept', action: 'accept', color: 'primary' },
              { label: 'Decline', action: 'decline', color: 'warn' }
            );
          }

          unifiedNotifications.push({
            id: `meeting-${m.id}`,
            type: 'meeting',
            icon: this.getMeetingIcon(m.notificationType),
            iconClass: this.getMeetingIconClass(m.notificationType),
            title: m.meetingTitle,
            message: m.message,
            timestamp: new Date(m.createdAt),
            isRead: m.isRead,
            data: m,
            actions
          });
        });

        // Convert announcements (show unread ones as notifications)
        announcements.forEach((a: AnnouncementData) => {
          if (!a.isRead) {
            unifiedNotifications.push({
              id: `announcement-${a.announcementId}`,
              type: 'announcement',
              icon: 'campaign',
              iconClass: this.getAnnouncementPriorityClass(a.priority),
              title: a.title,
              message: a.content.substring(0, 100) + (a.content.length > 100 ? '...' : ''),
              timestamp: new Date(a.createdAt),
              isRead: a.isRead,
              data: a
            });
          }
        });

        // Sort by timestamp (newest first)
        unifiedNotifications.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());

        this.notificationsSubject.next(unifiedNotifications);
        this.updateTotalUnread(unifiedNotifications);
        this.loadingSubject.next(false);
      },
      error: () => {
        this.loadingSubject.next(false);
      }
    });
  }

  private updateTotalUnread(notifications: UnifiedNotification[]): void {
    const unreadCount = notifications.filter(n => !n.isRead).length;
    this.totalUnreadSubject.next(unreadCount);
  }

  private getMeetingIcon(notificationType: string): string {
    switch (notificationType) {
      case 'Invitation': return 'event';
      case 'Reminder': return 'alarm';
      case 'Cancelled': return 'event_busy';
      case 'Updated': return 'update';
      case 'Response': return 'how_to_reg';
      default: return 'event';
    }
  }

  private getMeetingIconClass(notificationType: string): string {
    switch (notificationType) {
      case 'Invitation': return 'icon-primary';
      case 'Reminder': return 'icon-warning';
      case 'Cancelled': return 'icon-error';
      case 'Updated': return 'icon-info';
      case 'Response': return 'icon-success';
      default: return 'icon-info';
    }
  }

  private getAnnouncementPriorityClass(priority: string): string {
    switch (priority?.toLowerCase()) {
      case 'urgent': return 'icon-error';
      case 'high': return 'icon-warning';
      case 'normal': return 'icon-primary';
      case 'low': return 'icon-info';
      default: return 'icon-info';
    }
  }

  markNotificationAsRead(notificationId: string): void {
    const notifications = this.notificationsSubject.value;
    const notification = notifications.find(n => n.id === notificationId);
    
    if (notification && !notification.isRead) {
      // Handle meeting notification
      if (notification.type === 'meeting') {
        const meetingNotificationId = notification.data?.id;
        if (meetingNotificationId) {
          this.http.post<void>(
            `${environment.apiUrl}/meetings/notifications/${meetingNotificationId}/read`,
            {},
            { headers: this.getHeaders() }
          ).subscribe();
        }
      }
      
      // Handle announcement
      if (notification.type === 'announcement') {
        const announcementId = notification.data?.announcementId;
        if (announcementId) {
          this.http.post<void>(
            `${environment.apiUrl}/announcements/${announcementId}/mark-read`,
            {},
            { headers: this.getHeaders() }
          ).subscribe();
        }
      }

      // Update local state
      notification.isRead = true;
      this.notificationsSubject.next([...notifications]);
      this.updateTotalUnread(notifications);
    }
  }

  markAllNotificationsAsRead(): void {
    const notifications = this.notificationsSubject.value;
    
    // Mark all meeting notifications as read
    this.http.post<void>(
      `${environment.apiUrl}/meetings/notifications/read-all`,
      {},
      { headers: this.getHeaders() }
    ).pipe(catchError(() => of(null))).subscribe();

    // Mark all announcements as read
    notifications
      .filter(n => n.type === 'announcement' && !n.isRead)
      .forEach(n => {
        const announcementId = n.data?.announcementId;
        if (announcementId) {
          this.http.post<void>(
            `${environment.apiUrl}/announcements/${announcementId}/mark-read`,
            {},
            { headers: this.getHeaders() }
          ).subscribe();
        }
      });

    // Update local state
    notifications.forEach(n => n.isRead = true);
    this.notificationsSubject.next([...notifications]);
    this.totalUnreadSubject.next(0);
  }

  respondToMeetingNotification(notificationId: string, response: 'Accepted' | 'Declined'): Observable<any> {
    const notifications = this.notificationsSubject.value;
    const notification = notifications.find(n => n.id === notificationId);
    
    if (notification && notification.type === 'meeting') {
      const meetingId = notification.data?.meetingId;
      if (meetingId) {
        return this.http.post(
          `${environment.apiUrl}/meetings/${meetingId}/respond`,
          { responseStatus: response },
          { headers: this.getHeaders() }
        ).pipe(
          tap(() => {
            // Mark as read after responding
            this.markNotificationAsRead(notificationId);
            // Remove the actions since response is complete
            notification.actions = [];
            notification.message = `You ${response.toLowerCase()} this meeting`;
            this.notificationsSubject.next([...notifications]);
          })
        );
      }
    }
    return of(null);
  }

  getTimeAgo(date: Date): string {
    const now = new Date();
    const diffMs = now.getTime() - new Date(date).getTime();
    const diffMins = Math.floor(diffMs / (1000 * 60));
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;
    return new Date(date).toLocaleDateString();
  }

  refreshNotifications(): void {
    this.loadAllNotifications();
  }

  getNotifications(): UnifiedNotification[] {
    return this.notificationsSubject.value;
  }

  getTotalUnread(): number {
    return this.totalUnreadSubject.value;
  }
}
