// Backend vitest setup. The Worker runtime exposes some globals that Node's test
// environment lacks; stub the ones our pure-logic modules touch at import time so a
// missing binding can't crash the whole suite before a test even runs.
import { vi, afterEach } from 'vitest'

// Workers expose `crypto.subtle` / `crypto.randomUUID` globally; Node ≥18 does too,
// but guard in case a module reaches for it during import on older runners.
if (typeof globalThis.crypto === 'undefined') {
  // @ts-expect-error - minimal shim
  globalThis.crypto = require('node:crypto').webcrypto
}

// Keep tests deterministic and prevent accidental real network calls. Individual
// tests that need fetch should mock it explicitly with vi.fn() / vi.stubGlobal.
afterEach(() => {
  vi.restoreAllMocks()
})
