import { Injectable } from '@angular/core';
import { environment } from '../../environments/environment';

/**
 * Log levels for filtering
 */
export enum LogLevel {
  Debug = 0,
  Info = 1,
  Warn = 2,
  Error = 3,
  None = 4
}

/**
 * Structured log entry
 */
export interface LogEntry {
  timestamp: Date;
  level: LogLevel;
  context: string;
  message: string;
  data?: any;
  error?: Error;
}

/**
 * Centralized logging service for the application.
 * 
 * Benefits over raw console.error:
 * - Consistent formatting with timestamps and context
 * - Can be disabled in production
 * - Can be extended to send logs to backend/monitoring
 * - Type-safe with structured log entries
 * - Easy to filter by log level
 * 
 * Usage:
 * ```typescript
 * constructor(private logger: LoggingService) {}
 * 
 * this.logger.error('MyComponent', 'Failed to load data', error);
 * this.logger.warn('MyComponent', 'Rate limit approaching', { current: 95 });
 * this.logger.info('MyComponent', 'User logged in', { userId: 123 });
 * this.logger.debug('MyComponent', 'Request payload', payload);
 * ```
 */
@Injectable({
  providedIn: 'root'
})
export class LoggingService {
  private minLevel: LogLevel;
  private logBuffer: LogEntry[] = [];
  private maxBufferSize = 100;

  constructor() {
    // In production, only log errors. In development, log everything.
    this.minLevel = environment.production ? LogLevel.Error : LogLevel.Debug;
  }

  /**
   * Set the minimum log level
   */
  setLogLevel(level: LogLevel): void {
    this.minLevel = level;
  }

  /**
   * Log a debug message (development only)
   */
  debug(context: string, message: string, data?: any): void {
    this.log(LogLevel.Debug, context, message, data);
  }

  /**
   * Log an informational message
   */
  info(context: string, message: string, data?: any): void {
    this.log(LogLevel.Info, context, message, data);
  }

  /**
   * Log a warning message
   */
  warn(context: string, message: string, data?: any): void {
    this.log(LogLevel.Warn, context, message, data);
  }

  /**
   * Log an error message
   */
  error(context: string, message: string, error?: any, data?: any): void {
    this.log(LogLevel.Error, context, message, data, error);
  }

  /**
   * Get recent log entries (useful for debugging/support)
   */
  getRecentLogs(count: number = 50): LogEntry[] {
    return this.logBuffer.slice(-count);
  }

  /**
   * Clear the log buffer
   */
  clearLogs(): void {
    this.logBuffer = [];
  }

  /**
   * Core logging method
   */
  private log(level: LogLevel, context: string, message: string, data?: any, error?: Error): void {
    if (level < this.minLevel) {
      return;
    }

    const entry: LogEntry = {
      timestamp: new Date(),
      level,
      context,
      message,
      data,
      error
    };

    // Add to buffer
    this.logBuffer.push(entry);
    if (this.logBuffer.length > this.maxBufferSize) {
      this.logBuffer.shift();
    }

    // Format and output
    const timestamp = entry.timestamp.toISOString();
    const levelName = LogLevel[level].toUpperCase();
    const prefix = `[${timestamp}] [${levelName}] [${context}]`;

    switch (level) {
      case LogLevel.Debug:
        if (data !== undefined) {
          console.debug(prefix, message, data);
        } else {
          console.debug(prefix, message);
        }
        break;

      case LogLevel.Info:
        if (data !== undefined) {
          console.info(prefix, message, data);
        } else {
          console.info(prefix, message);
        }
        break;

      case LogLevel.Warn:
        if (data !== undefined) {
          console.warn(prefix, message, data);
        } else {
          console.warn(prefix, message);
        }
        break;

      case LogLevel.Error:
        if (error) {
          console.error(prefix, message, error, data || '');
        } else if (data !== undefined) {
          console.error(prefix, message, data);
        } else {
          console.error(prefix, message);
        }
        break;
    }

    // Future: Send critical errors to backend
    // if (level === LogLevel.Error && environment.production) {
    //   this.sendToBackend(entry);
    // }
  }

  /**
   * Future enhancement: Send logs to backend monitoring
   */
  // private sendToBackend(entry: LogEntry): void {
  //   // POST to /api/logs or similar
  // }
}
