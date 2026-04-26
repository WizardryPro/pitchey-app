#!/usr/bin/env node
//
// scripts/stripe/sync-prices.mjs
//
// Reads STRIPE_SECRET_KEY from env, lists products whose metadata.tier is set,
// groups their prices by recurring interval (month/year), and prints a JSON
// map:
//
//   {
//     "creator":             { "monthly": "price_...", "annual": "price_..." },
//     "creator_plus":        { "monthly": "price_...", "annual": "price_..." },
//     "creator_unlimited":   { "monthly": "price_...", "annual": "price_..." },
//     "production":          { "monthly": "price_...", "annual": "price_..." },
//     "production_plus":     { "monthly": "price_...", "annual": "price_..." },
//     "production_unlimited":{ "monthly": "price_...", "annual": "price_..." },
//     "exec":                { "monthly": "price_...", "annual": "price_..." },
//     "exec_unlimited":      { "monthly": "price_...", "annual": "price_..." }
//   }
//
// Read-only — makes no mutations. Handles pagination. Reports any tier that's
// missing a product or missing either interval.
//
// Usage:
//   STRIPE_SECRET_KEY=sk_test_... node scripts/stripe/sync-prices.mjs
//   STRIPE_SECRET_KEY=sk_test_... node scripts/stripe/sync-prices.mjs --verbose

import process from 'node:process';

const STRIPE_KEY = process.env.STRIPE_SECRET_KEY;
const VERBOSE = process.argv.includes('--verbose') || process.argv.includes('-v');

if (!STRIPE_KEY) {
  console.error('✗ STRIPE_SECRET_KEY env var is required.');
  process.exit(1);
}

const STRIPE_API = 'https://api.stripe.com/v1';

// Tiers the Dashboard is expected to have products for (Watcher is free, so
// no product). Matches the Ultraplan checklist.
const EXPECTED_TIERS = [
  'creator',
  'creator_plus',
  'creator_unlimited',
  'production',
  'production_plus',
  'production_unlimited',
  'exec',
  'exec_unlimited',
];

async function stripeGet(path, query = {}) {
  const qs = new URLSearchParams(query).toString();
  const url = `${STRIPE_API}${path}${qs ? `?${qs}` : ''}`;
  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${STRIPE_KEY}` },
  });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Stripe ${path} -> ${res.status}: ${body}`);
  }
  return res.json();
}

async function listAll(path, query = {}) {
  const out = [];
  let startingAfter;
  while (true) {
    const q = { limit: 100, ...query };
    if (startingAfter) q.starting_after = startingAfter;
    const page = await stripeGet(path, q);
    out.push(...page.data);
    if (!page.has_more) break;
    startingAfter = page.data[page.data.length - 1].id;
  }
  return out;
}

function intervalKey(price) {
  if (price.type !== 'recurring' || !price.recurring) return null;
  if (price.recurring.interval === 'month' && price.recurring.interval_count === 1) return 'monthly';
  if (price.recurring.interval === 'year' && price.recurring.interval_count === 1) return 'annual';
  return null;
}

async function main() {
  const products = await listAll('/products', { active: 'true' });
  if (VERBOSE) console.error(`Fetched ${products.length} active products from Stripe.`);

  // Filter to products that have a metadata.tier we care about
  const byTier = {};
  for (const p of products) {
    const tier = p.metadata?.tier;
    if (!tier) continue;
    if (!EXPECTED_TIERS.includes(tier)) {
      if (VERBOSE) console.error(`  skip: product ${p.id} has metadata.tier="${tier}" (not in expected set)`);
      continue;
    }
    if (byTier[tier]) {
      console.error(`✗ Duplicate products for tier="${tier}": ${byTier[tier].id} and ${p.id}. Archive one.`);
      process.exit(1);
    }
    byTier[tier] = p;
  }

  if (VERBOSE) {
    console.error(`Matched ${Object.keys(byTier).length}/${EXPECTED_TIERS.length} expected tiers.`);
  }

  // For each matched product, fetch its prices
  const result = {};
  const issues = [];
  for (const tier of EXPECTED_TIERS) {
    const product = byTier[tier];
    if (!product) {
      issues.push(`✗ tier="${tier}": no product with metadata.tier="${tier}" found`);
      continue;
    }
    const prices = await listAll('/prices', { product: product.id, active: 'true' });
    const entry = { monthly: null, annual: null };
    for (const price of prices) {
      const key = intervalKey(price);
      if (!key) continue;
      if (price.currency !== 'eur') {
        issues.push(`⚠ tier="${tier}": price ${price.id} currency is ${price.currency} (expected eur) — skipped`);
        continue;
      }
      if (entry[key]) {
        issues.push(`⚠ tier="${tier}": multiple ${key} prices on product ${product.id} — keeping ${entry[key]}, ignoring ${price.id}`);
        continue;
      }
      entry[key] = price.id;
    }
    if (!entry.monthly) issues.push(`✗ tier="${tier}": no active monthly recurring EUR price on product ${product.id}`);
    if (!entry.annual) issues.push(`✗ tier="${tier}": no active annual recurring EUR price on product ${product.id}`);
    result[tier] = entry;
  }

  // Issues to stderr, JSON map to stdout so `node ... > mapping.json` works
  if (issues.length > 0) {
    console.error(`\nFound ${issues.length} issue(s):`);
    for (const i of issues) console.error(`  ${i}`);
  }

  console.log(JSON.stringify(result, null, 2));

  // Non-zero exit if any expected tier is missing a price — catches half-done
  // Dashboard setup.
  const incomplete = Object.values(result).some((e) => !e.monthly || !e.annual);
  if (incomplete) process.exit(2);
}

main().catch((err) => {
  console.error(`✗ ${err.message}`);
  process.exit(1);
});
