/**
 * Route Contract Test
 *
 * Validates that every frontend API call has a matching backend route.
 * Reads backend routes from worker-integrated.ts and scans frontend source
 * for fetch/apiClient calls, then checks they match.
 */
import { describe, it, expect } from 'vitest'
import * as fs from 'node:fs'
import * as path from 'node:path'

// ─── Helpers ──────────────────────────────────────────────────────────────────

const ROOT = path.resolve(__dirname, '..', '..', '..')
const WORKER_FILE = path.join(ROOT, 'src', 'worker-integrated.ts')
const FRONTEND_SRC = path.join(ROOT, 'frontend', 'src')

interface BackendRoute {
  method: string
  path: string
  line: number
}

interface FrontendCall {
  method: string
  path: string
  file: string
  line: number
}

/**
 * Extract all this.register('METHOD', '/api/...', ...) and
 * this.registerPortalRoute('METHOD', '/api/...', ...) calls from the worker.
 */
function extractBackendRoutes(): BackendRoute[] {
  const src = fs.readFileSync(WORKER_FILE, 'utf-8')
  const lines = src.split('\n')
  const routes: BackendRoute[] = []

  // Match both this.register(...) and this.registerPortalRoute(...)
  const re = /this\.register(?:PortalRoute)?\(\s*'(GET|POST|PUT|DELETE|PATCH)'\s*,\s*'(\/api\/[^']+)'/

  for (let i = 0; i < lines.length; i++) {
    const m = lines[i].match(re)
    if (m) {
      routes.push({ method: m[1], path: m[2], line: i + 1 })
    }
  }
  return routes
}

/**
 * Recursively collect all .ts/.tsx files under a directory,
 * excluding node_modules, __tests__, and .test. files.
 */
function collectSourceFiles(dir: string): string[] {
  const results: string[] = []
  const entries = fs.readdirSync(dir, { withFileTypes: true })
  for (const entry of entries) {
    const full = path.join(dir, entry.name)
    if (entry.isDirectory()) {
      if (entry.name === 'node_modules' || entry.name === '__tests__' || entry.name === 'test') continue
      results.push(...collectSourceFiles(full))
    } else if (/\.(ts|tsx)$/.test(entry.name) && !entry.name.includes('.test.')) {
      results.push(full)
    }
  }
  return results
}

/**
 * Extract frontend API calls from source files.
 *
 * Patterns matched:
 * 1. apiClient.get('/api/...') / .post(...) / .put(...) / .delete(...)
 * 2. fetch(`${API_URL}/api/...`) or fetch(`${config.API_URL}/api/...`)
 * 3. fetch(`/api/...`)
 */
function extractFrontendCalls(): FrontendCall[] {
  const files = collectSourceFiles(FRONTEND_SRC)
  const calls: FrontendCall[] = []

  // apiClient.METHOD('/api/path...')
  const apiClientRe = /apiClient\.(get|post|put|delete|patch)\s*(?:<[^>]*>)?\s*\(\s*[`'"]([^`'"]*\/api\/[^`'"]*)[`'"]/gi

  // fetch(`${...}/api/path...`)  or  fetch('/api/path...')
  const fetchRe = /fetch\(\s*[`'"](?:\$\{[^}]*\})?(\/api\/[^`'"]*)[`'"]/gi

  // Method from fetch — look for method: 'POST' etc nearby, default GET
  const methodFromContext = (line: string): string => {
    const m = line.match(/method:\s*['"](\w+)['"]/i)
    return m ? m[1].toUpperCase() : 'GET'
  }

  for (const file of files) {
    const src = fs.readFileSync(file, 'utf-8')
    const lines = src.split('\n')
    const relFile = path.relative(FRONTEND_SRC, file)

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i]

      // Reset lastIndex for global regex
      apiClientRe.lastIndex = 0
      let m: RegExpExecArray | null
      while ((m = apiClientRe.exec(line)) !== null) {
        calls.push({
          method: m[1].toUpperCase(),
          path: normalizePath(m[2]),
          file: relFile,
          line: i + 1,
        })
      }

      fetchRe.lastIndex = 0
      while ((m = fetchRe.exec(line)) !== null) {
        // Look at surrounding lines for method context
        const context = lines.slice(Math.max(0, i - 2), Math.min(lines.length, i + 5)).join(' ')
        calls.push({
          method: methodFromContext(context),
          path: normalizePath(m[1]),
          file: relFile,
          line: i + 1,
        })
      }
    }
  }
  return calls
}

/**
 * Normalize a URL path:
 * - Replace template-literal expressions ${...} with :param
 * - Truncate unclosed template expressions (ternary in template literals)
 * - Strip query strings
 * - Strip trailing slashes
 */
function normalizePath(raw: string): string {
  let p = raw
    // Replace closed template expressions: ${varName} or ${obj.prop} → :param
    .replace(/\$\{[^}]+\}/g, ':param')
    // Truncate at unclosed ${ (happens with ternary expressions in nested templates)
    .replace(/\$\{.*$/, '')
    // Strip query strings
    .replace(/\?.*$/, '')
    // Strip trailing slash
    .replace(/\/+$/, '')
  return p
}

/**
 * Check if a frontend path matches a backend route path.
 * Segments with : prefix (params) match anything.
 */
function pathsMatch(frontendPath: string, backendPath: string): boolean {
  const fSegs = frontendPath.split('/').filter(Boolean)
  const bSegs = backendPath.split('/').filter(Boolean)

  if (fSegs.length !== bSegs.length) return false

  for (let i = 0; i < fSegs.length; i++) {
    const f = fSegs[i]
    const b = bSegs[i]
    // Either side has a param wildcard
    if (f.startsWith(':') || b.startsWith(':')) continue
    if (f !== b) return false
  }
  return true
}

// ─── Allowlist for known exceptions ──────────────────────────────────────────
// Documents all existing frontend→backend gaps. The contract test catches NEW
// mismatches going forward. Remove entries as gaps are fixed.
const ALLOWLIST = new Set([
  // ── Auth SDK (handled by Better Auth client, not worker routes) ──
  '/api/auth/sign-in',
  '/api/auth/sign-up',
  '/api/auth/sign-out',
  '/api/auth/session',
  '/api/auth/get-session',

  // ── Debug / placeholder paths ──
  '/api/analytics',            // quickLogin debug path in Analytics.tsx
  '/api/endpoint',             // placeholder in EmailAlerts.tsx

  // ── Upload service (frontend "multipart" vs backend "chunked") ──
  '/api/upload/check-duplicate',
  '/api/upload/presigned',
  '/api/upload/multipart/initiate',
  '/api/upload/multipart/init',
  '/api/upload/multipart/complete',
  '/api/upload/multipart/abort',
  '/api/upload/multipart/chunk',
  '/api/upload/complete-multipart',
  '/api/upload/generate-thumbnail',
  '/api/analytics/upload',
  '/api/upload/analytics',

  // ── Payment stubs (naming mismatches) ──
  '/api/payments/methods/add',
  '/api/payments/payment-methods',  // DELETE — backend only has GET/POST

  // ── Character reorder (not yet registered) ──
  '/api/pitches/:param/characters/reorder',
  '/api/pitches/:param/characters/:param/position',

  // ── Team sub-routes (different backend structure) ──
  '/api/teams/:param/members',
  '/api/teams/:param/roles',
  '/api/teams/:param/roles/:param',

  // ── File/document naming mismatch ──
  '/api/documents/:param',
  '/api/files/check/:param',

  // ── Not-yet-implemented features ──
  '/api/notifications/push/subscriptions',
  '/api/filters/saved',
  '/api/filters/saved/:param',
  '/api/filters/saved/:param/track',
  '/api/filters/saved/:param/default',
  '/api/search/suggestions',
  '/api/search/saved/popular',
  '/api/search/saved/:param/execute',
  '/api/search/saved',
  '/api/user/privacy/consent',
  '/api/user/privacy/request',
  '/api/user/settings',          // DELETE method not registered
  '/api/pitches/browse/enhanced',
  '/api/portfolio/:param',
  '/api/creator/portfolio/:param',

  // ── NDA naming (frontend /nda, backend /ndas) ──
  '/api/nda/request',
  '/api/nda/:param/approve',
  '/api/nda/:param/reject',

  // ── Misc stubs ──
  '/api/media/:param/:param',
  '/api/messages/:param/approve-offplatform',
  '/api/pitches/:param',          // POST — used for pitch update, backend uses PUT
])

// ─── Tests ───────────────────────────────────────────────────────────────────

describe('Route Contract: Frontend → Backend', () => {
  const backendRoutes = extractBackendRoutes()
  const frontendCalls = extractFrontendCalls()

  it('extracts 500+ backend routes', () => {
    expect(backendRoutes.length).toBeGreaterThanOrEqual(500)
  })

  it('extracts 20+ frontend endpoint calls', () => {
    expect(frontendCalls.length).toBeGreaterThanOrEqual(20)
  })

  it('every frontend API call has a matching backend route', () => {
    // Group backend routes by method for efficient lookup
    const routesByMethod = new Map<string, BackendRoute[]>()
    for (const route of backendRoutes) {
      const existing = routesByMethod.get(route.method) ?? []
      existing.push(route)
      routesByMethod.set(route.method, existing)
    }

    const unmatched: string[] = []

    for (const call of frontendCalls) {
      // Skip allowlisted paths (exact match or prefix match for /api/admin/*)
      if (ALLOWLIST.has(call.path)) continue
      if (call.path.startsWith('/api/admin/')) continue

      // Skip fully-dynamic paths (3+ param segments — too generic to match reliably)
      const paramCount = (call.path.match(/:param/g) ?? []).length
      if (paramCount >= 3) continue

      // Skip HEAD requests — most servers handle HEAD via GET handler automatically
      if (call.method === 'HEAD') continue

      // Skip paths that start with /api/:param (too generic, e.g. /api/:param/reorder)
      if (call.path.startsWith('/api/:param')) continue

      // Skip truncated paths (from ternary expressions) that lost their trailing segments
      if (call.path.endsWith('/')) continue

      const candidates = routesByMethod.get(call.method) ?? []
      const matched = candidates.some((route) => pathsMatch(call.path, route.path))

      if (!matched) {
        unmatched.push(
          `${call.method} ${call.path}  — called in ${call.file}:${call.line}`
        )
      }
    }

    if (unmatched.length > 0) {
      // Deduplicate by method+path
      const seen = new Set<string>()
      const deduplicated = unmatched.filter((entry) => {
        const key = entry.split('  —')[0]
        if (seen.has(key)) return false
        seen.add(key)
        return true
      })

      expect(deduplicated).toEqual([])
    }
  })
})
