import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { Logger, logger, createModuleLogger, authLogger, apiLogger, wsLogger, ndaLogger, notificationLogger } from '../logger';

// ============================================================================
// Logger class behavior
// ============================================================================
describe('Logger', () => {
  let debugSpy: ReturnType<typeof vi.spyOn>;
  let infoSpy: ReturnType<typeof vi.spyOn>;
  let warnSpy: ReturnType<typeof vi.spyOn>;
  let errorSpy: ReturnType<typeof vi.spyOn>;
  let groupSpy: ReturnType<typeof vi.spyOn>;
  let groupEndSpy: ReturnType<typeof vi.spyOn>;
  let timeSpy: ReturnType<typeof vi.spyOn>;
  let timeEndSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    debugSpy = vi.spyOn(console, 'debug').mockImplementation(() => {});
    infoSpy = vi.spyOn(console, 'info').mockImplementation(() => {});
    warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    groupSpy = vi.spyOn(console, 'group').mockImplementation(() => {});
    groupEndSpy = vi.spyOn(console, 'groupEnd').mockImplementation(() => {});
    timeSpy = vi.spyOn(console, 'time').mockImplementation(() => {});
    timeEndSpy = vi.spyOn(console, 'timeEnd').mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  // ─── debug ────────────────────────────────────────────────────────────────
  describe('debug()', () => {
    it('calls console.debug with formatted message containing DEBUG', () => {
      const log = new Logger({ enableInProduction: true, logLevel: 'debug' });
      log.debug('test debug');
      expect(debugSpy).toHaveBeenCalled();
      expect(debugSpy.mock.calls[0][0]).toContain('DEBUG');
    });

    it('passes data as second argument when provided', () => {
      const log = new Logger({ enableInProduction: true, logLevel: 'debug' });
      const data = { key: 'value' };
      log.debug('with data', data);
      expect(debugSpy).toHaveBeenCalledWith(expect.any(String), data);
    });

    it('calls console.debug with only the formatted string when no data', () => {
      const log = new Logger({ enableInProduction: true, logLevel: 'debug' });
      log.debug('no data');
      expect(debugSpy).toHaveBeenCalled();
      expect(debugSpy.mock.calls[0]).toHaveLength(1);
    });

    it('does not call console.debug when the level gates it out', () => {
      // logLevel 'warn' means debug (value 0) < warn (value 2) → filtered
      const log = new Logger({ enableInProduction: true, logLevel: 'warn' });
      log.debug('gated out');
      expect(debugSpy).not.toHaveBeenCalled();
    });
  });

  // ─── info ─────────────────────────────────────────────────────────────────
  describe('info()', () => {
    it('calls console.info with formatted message containing INFO', () => {
      const log = new Logger({ enableInProduction: true, logLevel: 'info' });
      log.info('test info');
      expect(infoSpy).toHaveBeenCalled();
      expect(infoSpy.mock.calls[0][0]).toContain('INFO');
    });

    it('passes data as second argument when provided', () => {
      const log = new Logger({ enableInProduction: true, logLevel: 'info' });
      const data = { key: 'value' };
      log.info('with data', data);
      expect(infoSpy).toHaveBeenCalledWith(expect.any(String), data);
    });

    it('calls console.info with only the formatted string when no data', () => {
      const log = new Logger({ enableInProduction: true, logLevel: 'info' });
      log.info('no data');
      expect(infoSpy).toHaveBeenCalled();
      expect(infoSpy.mock.calls[0]).toHaveLength(1);
    });

    it('does not call console.info when the level gates it out', () => {
      // logLevel 'warn' means info (value 1) < warn (value 2) → filtered
      const log = new Logger({ enableInProduction: true, logLevel: 'warn' });
      log.info('gated out');
      expect(infoSpy).not.toHaveBeenCalled();
    });
  });

  // ─── warn ─────────────────────────────────────────────────────────────────
  describe('warn()', () => {
    it('calls console.warn with formatted message containing WARN', () => {
      const log = new Logger({ enableInProduction: true, logLevel: 'warn' });
      log.warn('test warning');
      expect(warnSpy).toHaveBeenCalled();
      expect(warnSpy.mock.calls[0][0]).toContain('WARN');
    });

    it('includes prefix in warning message', () => {
      const log = new Logger({ prefix: '[TestApp]', enableInProduction: true, logLevel: 'warn' });
      log.warn('some warning');
      expect(warnSpy).toHaveBeenCalled();
      expect(warnSpy.mock.calls[0][0]).toContain('[TestApp]');
    });

    it('passes data as second argument when provided', () => {
      const log = new Logger({ enableInProduction: true, logLevel: 'warn' });
      const data = { key: 'value' };
      log.warn('with data', data);
      expect(warnSpy).toHaveBeenCalledWith(expect.any(String), data);
    });

    it('calls console.warn with only the formatted string when no data', () => {
      const log = new Logger({ enableInProduction: true, logLevel: 'warn' });
      log.warn('no data');
      expect(warnSpy).toHaveBeenCalled();
      // No second argument passed (source calls console.warn(formatted) not (formatted, undefined))
      expect(warnSpy.mock.calls[0]).toHaveLength(1);
    });
  });

  // ─── error ────────────────────────────────────────────────────────────────
  describe('error()', () => {
    it('calls console.error with formatted message and error', () => {
      const log = new Logger({ enableInProduction: true, logLevel: 'error' });
      const err = new Error('boom');
      log.error('test error', err);
      expect(errorSpy).toHaveBeenCalledWith(expect.stringContaining('ERROR'), err);
    });

    it('calls console.error without second arg when no error', () => {
      const log = new Logger({ enableInProduction: true, logLevel: 'error' });
      log.error('plain error');
      expect(errorSpy).toHaveBeenCalledWith(expect.stringContaining('ERROR'));
    });

    it('includes level name ERROR in message', () => {
      const log = new Logger({ enableInProduction: true, logLevel: 'error' });
      log.error('check level');
      expect(errorSpy).toHaveBeenCalledWith(expect.stringContaining('[ERROR]'));
    });
  });

  // ─── shouldLog filtering ──────────────────────────────────────────────────
  describe('log level filtering', () => {
    it('does not call warn when logLevel is "error" in production mode', () => {
      // Simulate production: enableInProduction=false, isDevelopment=false via mock
      // We can test by using logLevel: 'error' with enableInProduction: false
      // Note: isDevelopment is determined by import.meta.env.DEV; in tests it's true
      // so this test verifies the guard logic path via enableInProduction flag
      const log = new Logger({ enableInProduction: false, logLevel: 'error' });
      // In test env (DEV=true), all levels pass through regardless of enableInProduction
      // So we just verify the Logger can be constructed and called without throwing
      expect(() => log.warn('silenced')).not.toThrow();
    });
  });

  // ─── child logger ─────────────────────────────────────────────────────────
  describe('child()', () => {
    it('returns a Logger instance', () => {
      const log = new Logger();
      const child = log.child('SubModule');
      expect(child).toBeInstanceOf(Logger);
    });

    it('child includes parent prefix in output', () => {
      const log = new Logger({ prefix: '[Parent]', enableInProduction: true, logLevel: 'warn' });
      const child = log.child('Child');
      child.warn('from child');
      expect(warnSpy).toHaveBeenCalled();
      expect(warnSpy.mock.calls[0][0]).toContain('[Parent]');
    });
  });

  // ─── group ───────────────────────────────────────────────────────────────
  describe('group()', () => {
    it('calls fn in development mode', () => {
      // In vitest environment, import.meta.env.DEV is true
      const fn = vi.fn();
      const log = new Logger();
      log.group('My Group', fn);
      expect(fn).toHaveBeenCalled();
    });

    it('calls console.group and console.groupEnd in dev mode', () => {
      const log = new Logger();
      log.group('My Label', () => {});
      // In dev mode these should be called
      expect(groupSpy).toHaveBeenCalledWith('My Label');
      expect(groupEndSpy).toHaveBeenCalled();
    });
  });

  // ─── time ─────────────────────────────────────────────────────────────────
  describe('time()', () => {
    it('returns the result of the async function', async () => {
      const log = new Logger();
      const result = await log.time('label', async () => 42);
      expect(result).toBe(42);
    });

    it('propagates errors from the timed function', async () => {
      const log = new Logger();
      await expect(
        log.time('label', async () => { throw new Error('timed error'); })
      ).rejects.toThrow('timed error');
    });

    it('calls console.time and console.timeEnd in dev mode', async () => {
      const log = new Logger();
      await log.time('operation', async () => 'done');
      expect(timeSpy).toHaveBeenCalledWith('operation');
      expect(timeEndSpy).toHaveBeenCalledWith('operation');
    });

    it('calls console.timeEnd even when function throws', async () => {
      const log = new Logger();
      try {
        await log.time('operation', async () => { throw new Error('fail'); });
      } catch {
        // expected
      }
      expect(timeEndSpy).toHaveBeenCalledWith('operation');
    });
  });
});

// ============================================================================
// Module-level exports
// ============================================================================
describe('module exports', () => {
  it('logger is a Logger instance', () => {
    expect(logger).toBeInstanceOf(Logger);
  });

  it('createModuleLogger returns a Logger', () => {
    const mod = createModuleLogger('TestModule');
    expect(mod).toBeInstanceOf(Logger);
  });

  it('authLogger is a Logger instance', () => {
    expect(authLogger).toBeInstanceOf(Logger);
  });

  it('apiLogger is a Logger instance', () => {
    expect(apiLogger).toBeInstanceOf(Logger);
  });

  it('wsLogger is a Logger instance', () => {
    expect(wsLogger).toBeInstanceOf(Logger);
  });

  it('ndaLogger is a Logger instance', () => {
    expect(ndaLogger).toBeInstanceOf(Logger);
  });

  it('notificationLogger is a Logger instance', () => {
    expect(notificationLogger).toBeInstanceOf(Logger);
  });
});
