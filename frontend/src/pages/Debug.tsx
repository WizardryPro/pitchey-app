// Self-service diagnostics page — a route a user can open and screenshot so we
// never need them in DevTools. Reports build versions, session/role/tier, edge
// colo, and live reachability of the third parties the app depends on. A red row
// on a third party = CSP / ad-blocker / network block; a stale client build =
// they're on an old deploy. Public route (no auth) so it always loads.
import { useEffect, useState } from 'react';
import { WS_URL } from '../config';

type Status = 'pending' | 'ok' | 'fail';
const SENTRY_DSN = (import.meta.env as Record<string, string>)['VITE_SENTRY_DSN'] || '';
const CLIENT_BUILD = (import.meta.env as Record<string, string>)['VITE_APP_VERSION'] || 'unknown';

// Load a <script> and resolve whether it loaded — tests script-src CSP + network
// + extension blocking for Stripe / Turnstile (the things that actually break).
function probeScript(src: string, timeoutMs = 8000): Promise<boolean> {
  return new Promise((resolve) => {
    let done = false;
    const finish = (ok: boolean) => { if (!done) { done = true; el.remove(); resolve(ok); } };
    const el = document.createElement('script');
    el.src = src;
    el.async = true;
    el.onload = () => finish(true);
    el.onerror = () => finish(false);
    document.head.appendChild(el);
    setTimeout(() => finish(false), timeoutMs);
  });
}

function probeWebSocket(url: string, timeoutMs = 6000): Promise<boolean> {
  return new Promise((resolve) => {
    let done = false;
    const finish = (ok: boolean) => { if (!done) { done = true; try { ws.close(); } catch { /* noop */ } resolve(ok); } };
    let ws: WebSocket;
    try {
      ws = new WebSocket(url);
    } catch {
      resolve(false);
      return;
    }
    // onopen = the wss upgrade succeeded → network path is NOT blocked (the server
    // may close afterwards for missing auth; that's fine, we only probe reachability).
    ws.onopen = () => finish(true);
    ws.onerror = () => finish(false);
    setTimeout(() => finish(false), timeoutMs);
  });
}

export default function Debug() {
  const [meta, setMeta] = useState<Record<string, string>>({
    clientBuild: CLIENT_BUILD,
  });
  const [checks, setChecks] = useState<Record<string, Status>>({
    Session: 'pending',
    'Stripe JS': 'pending',
    'Turnstile JS': 'pending',
    WebSocket: 'pending',
  });

  useEffect(() => {
    let alive = true;
    const setCheck = (k: string, s: Status) => alive && setChecks((c) => ({ ...c, [k]: s }));
    const setM = (patch: Record<string, string>) => alive && setMeta((m) => ({ ...m, ...patch }));

    // Server (worker) build + edge colo, from a same-origin no-store probe.
    fetch('/api/version', { cache: 'no-store' })
      .then(async (r) => {
        const ray = r.headers.get('cf-ray') || '';
        const colo = ray.includes('-') ? ray.split('-')[1] : '';
        const body = await r.json().catch(() => ({}));
        setM({ workerVersion: body.version || 'unknown', colo: colo || 'unknown' });
      })
      .catch(() => setM({ workerVersion: 'unreachable', colo: 'unknown' }));

    // Session validity + who they are.
    fetch('/api/auth/session', { credentials: 'include', cache: 'no-store' })
      .then(async (r) => {
        if (!r.ok) { setCheck('Session', 'fail'); return; }
        const b = await r.json().catch(() => ({}));
        const u = b?.user || b?.data?.user || {};
        setM({
          userType: u.userType || u.user_type || 'none',
          tier: u.subscriptionTier || u.subscription_tier || 'free',
          username: u.username || u.name || u.email || '—',
        });
        setCheck('Session', u && (u.id || u.userType) ? 'ok' : 'fail');
      })
      .catch(() => setCheck('Session', 'fail'));

    probeScript('https://js.stripe.com/v3/').then((ok) => setCheck('Stripe JS', ok ? 'ok' : 'fail'));
    probeScript('https://challenges.cloudflare.com/turnstile/v0/api.js').then((ok) => setCheck('Turnstile JS', ok ? 'ok' : 'fail'));
    probeWebSocket(WS_URL).then((ok) => setCheck('WebSocket', ok ? 'ok' : 'fail'));

    return () => { alive = false; };
  }, []);

  const icon = (s: Status) => (s === 'ok' ? '✅' : s === 'fail' ? '❌' : '…');
  const rowStyle: React.CSSProperties = { fontFamily: 'monospace', fontSize: 16, padding: '6px 0', borderBottom: '1px solid #eee' };

  const infoRow = (label: string, value: string) => (
    <div style={rowStyle} key={label}>
      <span style={{ color: '#666' }}>{label}:</span> <strong>{value || '…'}</strong>
    </div>
  );
  const checkRow = (label: string, s: Status) => (
    <div style={rowStyle} key={label}>
      {icon(s)} <span>{label}</span>
    </div>
  );

  return (
    <div style={{ padding: 24, maxWidth: 560, margin: '0 auto', color: '#111' }}>
      <h1 style={{ fontSize: 22, marginBottom: 4 }}>Pitchey self-check</h1>
      <p style={{ color: '#666', marginTop: 0 }}>Screenshot this whole screen and send it over.</p>

      <h3 style={{ marginBottom: 4 }}>Build</h3>
      {infoRow('Client build', meta.clientBuild)}
      {infoRow('Worker version', meta.workerVersion)}
      {infoRow('Edge colo', meta.colo)}

      <h3 style={{ marginBottom: 4, marginTop: 20 }}>Account</h3>
      {infoRow('Role', meta.userType)}
      {infoRow('Tier', meta.tier)}
      {infoRow('User', meta.username)}

      <h3 style={{ marginBottom: 4, marginTop: 20 }}>Connectivity</h3>
      {checkRow('Session valid', checks.Session)}
      {checkRow('Stripe', checks['Stripe JS'])}
      {checkRow('Turnstile', checks['Turnstile JS'])}
      {checkRow('WebSocket', checks.WebSocket)}
      {infoRow('Sentry', SENTRY_DSN ? 'configured' : 'NOT configured')}

      <p style={{ marginTop: 20, color: '#888', fontSize: 13 }}>
        ❌ on Stripe / Turnstile / WebSocket = a CSP, ad-blocker, or network block (often only on one
        person's machine). A "Client build" that doesn't match the current deploy = stale cached app —
        hard-refresh or try a private window.
      </p>
    </div>
  );
}
