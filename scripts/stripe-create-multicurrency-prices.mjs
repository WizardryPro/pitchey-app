#!/usr/bin/env node
/**
 * stripe-create-multicurrency-prices.mjs
 *
 * P7 multi-currency billing. The 12 live subscription Prices are EUR-only and
 * Stripe Prices are immutable, so we create NEW Prices that carry the same
 * numeric amount in EUR + GBP + USD via `currency_options`. One new Price ID
 * per tier/interval then charges in whichever currency Checkout requests.
 *
 * Credit packages use dynamic price_data at checkout, so they need no script —
 * the worker sets the currency on the fly.
 *
 * Usage:
 *   STRIPE_SECRET_KEY=sk_live_xxx node scripts/stripe-create-multicurrency-prices.mjs
 *   # or run without the env var and paste the key when prompted (no echo)
 *
 * Output: the old→new price-ID mapping plus a ready-to-paste block for
 * src/config/subscription-plans.ts. Nothing is deleted; the old EUR prices stay
 * (deactivate them in the Stripe dashboard later if you want).
 *
 * Same-numeric-value policy (owner decision 2026-06-02): £/$ amount == € amount.
 */

import { createInterface } from 'node:readline';

// The current live EUR price IDs, keyed by tier+interval (from subscription-plans.ts).
const PRICES = [
  ['creator.monthly', 'price_1TbgA0Gfa7gtG8Qy0IKu4kUO'],
  ['creator.annual', 'price_1TbgJIGfa7gtG8Qyhh1BtwNR'],
  ['creator_plus.monthly', 'price_1TbgCnGfa7gtG8QyQpBUOaf5'],
  ['creator_plus.annual', 'price_1TbgJvGfa7gtG8QycMQjlnUB'],
  ['creator_unlimited.monthly', 'price_1TbgFPGfa7gtG8QyOEVd45Dp'],
  ['creator_unlimited.annual', 'price_1TbgICGfa7gtG8QyT4vdxXEI'],
  ['production.monthly', 'price_1TbgLDGfa7gtG8QyW7Qpe528'],
  ['production.annual', 'price_1TbgMAGfa7gtG8Qyku7xIHHE'],
  ['production_plus.monthly', 'price_1TbgX6Gfa7gtG8QyZJEvAkeh'],
  ['production_plus.annual', 'price_1TbgX6Gfa7gtG8QyCeVTfUYC'],
  ['production_unlimited.monthly', 'price_1TbgYLGfa7gtG8QyAEXziPu2'],
  ['production_unlimited.annual', 'price_1TbgYoGfa7gtG8QyMOlKAHOQ'],
  ['exec.monthly', 'price_1TbgaTGfa7gtG8QywRU1eSyT'],
  ['exec.annual', 'price_1TbgaTGfa7gtG8QykqA7SoAY'],
  ['exec_unlimited.monthly', 'price_1TbgbVGfa7gtG8QylWn9PeN9'],
  ['exec_unlimited.annual', 'price_1TbgbVGfa7gtG8QyIc8JP9kl'],
];

const EXTRA_CURRENCIES = ['gbp', 'usd']; // EUR is the base currency on the Price

function prompt(question, { silent = false } = {}) {
  return new Promise((resolve) => {
    const rl = createInterface({ input: process.stdin, output: process.stdout });
    if (silent) {
      const onData = (char) => {
        const s = String(char);
        if (s === '\n' || s === '\r' || s === '') process.stdout.write('\n');
        else process.stdout.write('\x1B[2K\x1B[200D' + question);
      };
      process.stdin.on('data', onData);
      rl.question(question, (val) => { process.stdin.removeListener('data', onData); rl.close(); resolve(val.trim()); });
    } else {
      rl.question(question, (val) => { rl.close(); resolve(val.trim()); });
    }
  });
}

async function stripe(key, method, path, params) {
  const body = params
    ? Object.entries(params).map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(v)}`).join('&')
    : undefined;
  const resp = await fetch(`https://api.stripe.com/v1${path}`, {
    method,
    headers: {
      Authorization: `Bearer ${key}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body,
  });
  const data = await resp.json();
  if (!resp.ok) {
    throw new Error(`Stripe ${method} ${path} -> ${resp.status}: ${data.error?.message || JSON.stringify(data)}`);
  }
  return data;
}

async function main() {
  let key = process.env.STRIPE_SECRET_KEY;
  if (!key) key = await prompt('Stripe secret key (sk_live_… / sk_test_…): ', { silent: true });
  if (!/^sk_(live|test)_/.test(key)) {
    console.error('That does not look like a Stripe secret key. Aborting.');
    process.exit(1);
  }
  const mode = key.startsWith('sk_live') ? 'LIVE' : 'TEST';
  console.log(`\nMode: ${mode}. Creating multi-currency replacements for ${PRICES.length} prices (EUR + ${EXTRA_CURRENCIES.map(c => c.toUpperCase()).join(' + ')}, same numeric amount).\n`);

  const mapping = {};
  for (const [label, oldId] of PRICES) {
    const old = await stripe(key, 'GET', `/prices/${oldId}`);
    const unitAmount = old.unit_amount;            // cents, same across currencies
    const product = typeof old.product === 'string' ? old.product : old.product?.id;
    const params = {
      product,
      currency: 'eur',
      unit_amount: String(unitAmount),
      'metadata[multicurrency]': 'true',
      'metadata[source_price]': oldId,
    };
    if (old.recurring?.interval) {
      params['recurring[interval]'] = old.recurring.interval;
      if (old.recurring.interval_count) params['recurring[interval_count]'] = String(old.recurring.interval_count);
    }
    for (const cur of EXTRA_CURRENCIES) {
      params[`currency_options[${cur}][unit_amount]`] = String(unitAmount);
    }
    const created = await stripe(key, 'POST', '/prices', params);
    mapping[label] = created.id;
    console.log(`  ${label.padEnd(30)} ${oldId}  ->  ${created.id}`);
  }

  console.log('\n--- Paste these into src/config/subscription-plans.ts (stripePriceId per tier) ---\n');
  console.log(JSON.stringify(mapping, null, 2));
  console.log('\nThen set MULTI_CURRENCY_ENABLED = true in src/config/currency.ts and deploy the worker.');
}

main().catch((e) => { console.error('\nFailed:', e.message); process.exit(1); });
