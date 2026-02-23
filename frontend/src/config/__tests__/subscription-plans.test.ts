import { describe, it, expect } from 'vitest'
import {
  CREDIT_COSTS,
  CREDIT_PACKAGES,
  SUBSCRIPTION_TIERS,
  getCreditCost,
  canAffordAction,
  calculateCreditsRemaining,
  getSubscriptionTier,
  getSubscriptionTiersByUserType,
  type CreditCost,
} from '../subscription-plans'

describe('subscription-plans credit utilities', () => {
  // ── getCreditCost ──────────────────────────────────────────────
  describe('getCreditCost', () => {
    it('returns 10 for basic_upload', () => {
      expect(getCreditCost('basic_upload')).toBe(10)
    })

    it('returns 3 for word_doc', () => {
      expect(getCreditCost('word_doc')).toBe(3)
    })

    it('returns 5 for picture_doc', () => {
      expect(getCreditCost('picture_doc')).toBe(5)
    })

    it('returns 1 for extra_image', () => {
      expect(getCreditCost('extra_image')).toBe(1)
    })

    it('returns 1 for video_link', () => {
      expect(getCreditCost('video_link')).toBe(1)
    })

    it('returns 10 for promoted_pitch', () => {
      expect(getCreditCost('promoted_pitch')).toBe(10)
    })

    it('returns 10 for view_pitch', () => {
      expect(getCreditCost('view_pitch')).toBe(10)
    })

    it('returns 2 for send_message', () => {
      expect(getCreditCost('send_message')).toBe(2)
    })

    it('returns 0 for unknown action', () => {
      expect(getCreditCost('nonexistent_action')).toBe(0)
    })
  })

  // ── canAffordAction ────────────────────────────────────────────
  describe('canAffordAction', () => {
    it('returns true when balance equals cost', () => {
      expect(canAffordAction(10, 'basic_upload')).toBe(true)
    })

    it('returns true when balance exceeds cost', () => {
      expect(canAffordAction(50, 'basic_upload')).toBe(true)
    })

    it('returns false when balance is below cost', () => {
      expect(canAffordAction(5, 'basic_upload')).toBe(false)
    })

    it('returns true for unlimited users regardless of balance', () => {
      expect(canAffordAction(0, 'basic_upload', 1, true)).toBe(true)
    })

    it('accounts for quantity > 1', () => {
      // 3 extra_images = 3 credits, balance is 2
      expect(canAffordAction(2, 'extra_image', 3)).toBe(false)
      // 3 extra_images = 3 credits, balance is 3
      expect(canAffordAction(3, 'extra_image', 3)).toBe(true)
    })

    it('returns true for unknown action (cost 0)', () => {
      expect(canAffordAction(0, 'unknown_action')).toBe(true)
    })
  })

  // ── calculateCreditsRemaining ──────────────────────────────────
  describe('calculateCreditsRemaining', () => {
    it('subtracts cost from balance', () => {
      expect(calculateCreditsRemaining(30, 'basic_upload')).toBe(20)
    })

    it('never returns negative values', () => {
      expect(calculateCreditsRemaining(5, 'basic_upload')).toBe(0)
    })

    it('returns zero when balance equals cost', () => {
      expect(calculateCreditsRemaining(10, 'basic_upload')).toBe(0)
    })

    it('handles quantity multiplier', () => {
      // 2 word_docs = 6 credits, balance 10 → 4 remaining
      expect(calculateCreditsRemaining(10, 'word_doc', 2)).toBe(4)
    })

    it('clamps to zero with quantity that exceeds balance', () => {
      // 5 extra_images = 5 credits, balance 3 → 0
      expect(calculateCreditsRemaining(3, 'extra_image', 5)).toBe(0)
    })

    it('defaults quantity to 1', () => {
      expect(calculateCreditsRemaining(10, 'send_message')).toBe(8)
    })
  })

  // ── CREDIT_COSTS constants ─────────────────────────────────────
  describe('CREDIT_COSTS', () => {
    it('contains 9 action entries', () => {
      expect(CREDIT_COSTS).toHaveLength(9)
    })

    it('every entry has action, credits, and description', () => {
      for (const entry of CREDIT_COSTS) {
        expect(entry).toHaveProperty('action')
        expect(entry).toHaveProperty('credits')
        expect(entry).toHaveProperty('description')
        expect(typeof entry.action).toBe('string')
        expect(typeof entry.credits).toBe('number')
        expect(typeof entry.description).toBe('string')
        expect(entry.credits).toBeGreaterThan(0)
      }
    })

    it('has unique action names', () => {
      const actions = CREDIT_COSTS.map(c => c.action)
      expect(new Set(actions).size).toBe(actions.length)
    })
  })

  // ── CREDIT_PACKAGES ────────────────────────────────────────────
  describe('CREDIT_PACKAGES', () => {
    it('contains 4 packages', () => {
      expect(CREDIT_PACKAGES).toHaveLength(4)
    })

    it('each package has credits and price', () => {
      for (const pkg of CREDIT_PACKAGES) {
        expect(pkg.credits).toBeGreaterThan(0)
        expect(pkg.price).toBeGreaterThan(0)
        expect(pkg.currency).toBe('EUR')
      }
    })

    it('largest package includes a bonus', () => {
      const largest = CREDIT_PACKAGES[CREDIT_PACKAGES.length - 1]
      expect(largest.bonus).toBeDefined()
      expect(largest.bonus).toBeGreaterThan(0)
    })
  })

  // ── getSubscriptionTier ────────────────────────────────────────
  describe('getSubscriptionTier', () => {
    it('returns tier by id', () => {
      const tier = getSubscriptionTier('creator')
      expect(tier).not.toBeNull()
      expect(tier!.name).toBe('Creator')
    })

    it('returns null for unknown id', () => {
      expect(getSubscriptionTier('nonexistent')).toBeNull()
    })

    it('creator_unlimited has -1 credits (unlimited)', () => {
      const tier = getSubscriptionTier('creator_unlimited')
      expect(tier).not.toBeNull()
      expect(tier!.credits).toBe(-1)
    })
  })

  // ── getSubscriptionTiersByUserType ─────────────────────────────
  describe('getSubscriptionTiersByUserType', () => {
    it('returns creator tiers + watcher for creator', () => {
      const tiers = getSubscriptionTiersByUserType('creator')
      expect(tiers.length).toBeGreaterThan(0)
      expect(tiers.every(t => t.userType === 'creator' || t.userType === 'watcher')).toBe(true)
    })

    it('returns production tiers + watcher for production', () => {
      const tiers = getSubscriptionTiersByUserType('production')
      expect(tiers.length).toBeGreaterThan(0)
      expect(tiers.every(t => t.userType === 'production' || t.userType === 'watcher')).toBe(true)
    })

    it('returns exec tiers + watcher for investor', () => {
      const tiers = getSubscriptionTiersByUserType('investor')
      expect(tiers.length).toBeGreaterThan(0)
      expect(tiers.every(t => t.userType === 'exec' || t.userType === 'watcher')).toBe(true)
    })

    it('returns all tiers for unknown user type', () => {
      const tiers = getSubscriptionTiersByUserType('unknown')
      expect(tiers).toEqual(SUBSCRIPTION_TIERS)
    })
  })
})
