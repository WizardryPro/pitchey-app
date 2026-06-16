/**
 * Centralized Logger Utility
 * 
 * This logger provides a unified interface for logging throughout the application.
 * In production, it only logs errors and warnings to avoid console clutter.
 * In development, all log levels are available.
 */

type LogLevel = 'debug' | 'info' | 'warn' | 'error';

interface LoggerConfig {
  enableInProduction: boolean;
  logLevel: LogLevel;
  prefix?: string;
}

class Logger {
  private config: LoggerConfig;
  private isDevelopment: boolean;
  private logLevels: Record<LogLevel, number> = {
    debug: 0,
    info: 1,
    warn: 2,
    error: 3,
  };

  constructor(config?: Partial<LoggerConfig>) {
    this.isDevelopment = import.meta.env.DEV || import.meta.env.MODE === 'development';
    this.config = {
      enableInProduction: false,
      logLevel: this.isDevelopment ? 'debug' : 'error',
      prefix: '[Pitchey]',
      ...config,
    };
  }

  private shouldLog(level: LogLevel): boolean {
    // In production, only log errors and warnings unless explicitly enabled
    if (!this.isDevelopment && !this.config.enableInProduction) {
      return level === 'error' || level === 'warn';
    }

    const currentLevelValue = this.logLevels[this.config.logLevel];
    const messageLevelValue = this.logLevels[level];
    return messageLevelValue >= currentLevelValue;
  }

  private formatMessage(level: LogLevel, message: string, data?: any): string {
    const timestamp = new Date().toISOString();
    const prefix = this.config.prefix || '';
    return `${prefix} [${timestamp}] [${level.toUpperCase()}] ${message}`;
  }

  debug(message: string, data?: any): void {
    if (this.shouldLog('debug')) {
      const formatted = this.formatMessage('debug', message);
      if (data) {
        console.debug(formatted, data);
      } else {
        console.debug(formatted);
      }
    }
  }

  info(message: string, data?: any): void {
    if (this.shouldLog('info')) {
      const formatted = this.formatMessage('info', message);
      if (data) {
        console.info(formatted, data);
      } else {
        console.info(formatted);
      }
    }
  }

  warn(message: string, data?: any): void {
    if (this.shouldLog('warn')) {
      const formatted = this.formatMessage('warn', message);
      if (data) {
        console.warn(formatted, data);
      } else {
        console.warn(formatted);
      }
    }
  }

  error(message: string, error?: any): void {
    if (this.shouldLog('error')) {
      const formatted = this.formatMessage('error', message);
      if (error) {
        console.error(formatted, error);
        
        // Send to error tracking service in production
        if (!this.isDevelopment && typeof window !== 'undefined' && (window as any).Sentry) {
          (window as any).Sentry.captureException(error, {
            extra: {
              message,
              timestamp: new Date().toISOString(),
            },
          });
        }
      } else {
        console.error(formatted);
      }
    }
  }

  /**
   * Group related logs together
   */
  group(label: string, fn: () => void): void {
    if (this.isDevelopment) {
      console.group(label);
      fn();
      console.groupEnd();
    } else {
      fn();
    }
  }

  /**
   * Time a function execution
   */
  async time<T>(label: string, fn: () => Promise<T>): Promise<T> {
    if (this.isDevelopment) {
      console.time(label);
      try {
        const result = await fn();
        console.timeEnd(label);
        return result;
      } catch (error) {
        console.timeEnd(label);
        throw error;
      }
    } else {
      return fn();
    }
  }

  /**
   * Create a child logger with a specific prefix
   */
  child(prefix: string): Logger {
    return new Logger({
      ...this.config,
      prefix: `${this.config.prefix} [${prefix}]`,
    });
  }
}

// Export singleton instance for general use
export const logger = new Logger();

// Export class for creating custom instances
export { Logger };

// Export typed logger creators for specific modules
export const createModuleLogger = (moduleName: string) => logger.child(moduleName);

// Convenience exports for common modules
export const authLogger = createModuleLogger('Auth');
export const apiLogger = createModuleLogger('API');
export const wsLogger = createModuleLogger('WebSocket');
export const ndaLogger = createModuleLogger('NDA');
export const notificationLogger = createModuleLogger('Notification');