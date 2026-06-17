import { describe, it, expect, vi, beforeEach, beforeAll } from 'vitest'

// ─── Hoisted mock functions ──────────────────────────────────────────
const mockApiGet = vi.fn()
const mockApiPost = vi.fn()
const mockApiPut = vi.fn()
const mockApiDelete = vi.fn()

// ─── Mock the api-client singleton ───────────────────────────────────
vi.mock('../api-client', () => ({
  default: {
    get: mockApiGet,
    post: mockApiPost,
    put: mockApiPut,
    delete: mockApiDelete,
    patch: vi.fn(),
  },
  // Named exports used by apiServices via re-export spread
  ndaAPI: {
    requestNDA: vi.fn(),
    getRequests: vi.fn(),
    approveRequest: vi.fn(),
    rejectRequest: vi.fn(),
    getSignedNDAs: vi.fn(),
    getNDAById: vi.fn(),
    getActiveNDAs: vi.fn(),
    getIncomingRequests: vi.fn(),
    getOutgoingRequests: vi.fn(),
  },
  savedPitchesAPI: {
    getSavedPitches: vi.fn(),
    savePitch: vi.fn(),
    unsavePitch: vi.fn(),
    isPitchSaved: vi.fn(),
    updateSavedPitchNotes: vi.fn(),
    getSavedPitchStats: vi.fn(),
  },
  authAPI: {
    login: vi.fn(),
    logout: vi.fn(),
    getSession: vi.fn(),
  },
}))

// ─── Mock betterAuthStore ─────────────────────────────────────────────
vi.mock('../../store/betterAuthStore', () => ({
  useBetterAuthStore: {
    getState: vi.fn().mockReturnValue({ user: { id: 1, name: 'Test' } }),
  },
}))

// ─── Mock config ───────────────────────────────────────────────────────
vi.mock('../../config', () => ({
  config: { API_URL: 'http://localhost:8001' },
  API_URL: 'http://localhost:8001',
}))

// ─── Dynamic import (after all vi.mock calls) ─────────────────────────
let ndaAPI: any
let companyAPI: any
let analyticsAPI: any
let messageAPI: any
let pitchServicesAPI: any
let paymentsAPI: any
let savedPitchesService: any
let getUserId: any

beforeAll(async () => {
  const mod = await import('../apiServices')
  ndaAPI = mod.ndaAPI
  companyAPI = mod.companyAPI
  analyticsAPI = mod.analyticsAPI
  messageAPI = mod.messageAPI
  pitchServicesAPI = mod.pitchServicesAPI
  paymentsAPI = mod.paymentsAPI
  savedPitchesService = mod.savedPitchesService
  getUserId = mod.getUserId
})

function success(data: any) {
  return { success: true, data }
}
function failure(msg: string) {
  return { success: false, error: { message: msg } }
}

describe('apiServices.ts', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  // ─── getUserId ─────────────────────────────────────────────────────
  describe('getUserId', () => {
    it('returns string id from auth store user', () => {
      expect(getUserId()).toBe('1')
    })
  })

  // ─── ndaAPI ───────────────────────────────────────────────────────
  describe('ndaAPI.getSignedNDAs', () => {
    it('returns success with spread data', async () => {
      mockApiGet.mockResolvedValueOnce(success({ ndas: [{ id: 1 }], count: 1 }))
      const result = await ndaAPI.getSignedNDAs()
      expect(result.success).toBe(true)
    })

    it('returns success:false on API error', async () => {
      mockApiGet.mockResolvedValueOnce(failure('Not found'))
      const result = await ndaAPI.getSignedNDAs()
      expect(result.success).toBe(false)
      expect(result.error).toBe('Not found')
    })
  })

  describe('ndaAPI.getIncomingSignedNDAs', () => {
    it('returns ndas array when api succeeds', async () => {
      mockApiGet.mockResolvedValueOnce(success({ ndas: [{ id: 1 }], count: 1 }))
      const result = await ndaAPI.getIncomingSignedNDAs()
      expect(result.success).toBe(true)
      expect(result.ndas).toEqual([{ id: 1 }])
      expect(result.count).toBe(1)
    })

    it('returns empty ndas on error', async () => {
      mockApiGet.mockResolvedValueOnce(failure('Error'))
      const result = await ndaAPI.getIncomingSignedNDAs()
      expect(result.success).toBe(false)
      expect(result.ndas).toEqual([])
    })
  })

  describe('ndaAPI.getOutgoingSignedNDAs', () => {
    it('returns ndas and count on success', async () => {
      mockApiGet.mockResolvedValueOnce(success({ ndas: [{ id: 2 }], count: 1 }))
      const result = await ndaAPI.getOutgoingSignedNDAs()
      expect(result.ndas).toEqual([{ id: 2 }])
    })
  })

  describe('ndaAPI.getIncomingRequests', () => {
    it('handles array data directly', async () => {
      mockApiGet.mockResolvedValueOnce(success([{ id: 1 }, { id: 2 }]))
      const result = await ndaAPI.getIncomingRequests()
      expect(result.success).toBe(true)
      expect(result.requests).toEqual([{ id: 1 }, { id: 2 }])
      expect(result.count).toBe(2)
    })

    it('handles nested requests property', async () => {
      mockApiGet.mockResolvedValueOnce(success({ requests: [{ id: 3 }] }))
      const result = await ndaAPI.getIncomingRequests()
      expect(result.requests).toEqual([{ id: 3 }])
    })

    it('returns empty requests array on failure', async () => {
      mockApiGet.mockResolvedValueOnce(failure('Unauthorized'))
      const result = await ndaAPI.getIncomingRequests()
      expect(result.requests).toEqual([])
      expect(result.count).toBe(0)
    })
  })

  describe('ndaAPI.getOutgoingRequests', () => {
    it('handles array data', async () => {
      mockApiGet.mockResolvedValueOnce(success([{ id: 5 }]))
      const result = await ndaAPI.getOutgoingRequests()
      expect(result.requests).toEqual([{ id: 5 }])
    })
  })

  // ─── companyAPI ───────────────────────────────────────────────────
  describe('companyAPI.getVerificationStatus', () => {
    it('returns success with spread data', async () => {
      mockApiGet.mockResolvedValueOnce(success({ status: 'pending', verified: false }))
      const result = await companyAPI.getVerificationStatus()
      expect(result.success).toBe(true)
      expect(result.status).toBe('pending')
    })

    it('returns success:false on error', async () => {
      mockApiGet.mockResolvedValueOnce(failure('Not found'))
      const result = await companyAPI.getVerificationStatus()
      expect(result.success).toBe(false)
    })
  })

  describe('companyAPI.submitVerification', () => {
    it('posts verification data and returns spread response', async () => {
      mockApiPost.mockResolvedValueOnce(success({ submitted: true }))
      const result = await companyAPI.submitVerification({
        companyName: 'Acme',
        companyNumber: '12345',
      })
      expect(result.success).toBe(true)
      expect(mockApiPost).toHaveBeenCalledWith('/api/company/verify', {
        companyName: 'Acme',
        companyNumber: '12345',
      })
    })
  })

  // ─── analyticsAPI ─────────────────────────────────────────────────
  describe('analyticsAPI.getDashboardAnalytics', () => {
    it('extracts analytics from nested response', async () => {
      mockApiGet.mockResolvedValueOnce(success({ analytics: { views: 100 } }))
      const result = await analyticsAPI.getDashboardAnalytics()
      expect(result.success).toBe(true)
      expect(result.analytics).toEqual({ views: 100 })
    })

    it('falls back to top-level data when no .analytics key', async () => {
      mockApiGet.mockResolvedValueOnce(success({ views: 50 }))
      const result = await analyticsAPI.getDashboardAnalytics()
      expect(result.analytics).toEqual({ views: 50 })
    })
  })

  describe('analyticsAPI.trackView', () => {
    it('posts pitchId and viewData', async () => {
      mockApiPost.mockResolvedValueOnce(success({ tracked: true }))
      const result = await analyticsAPI.trackView(5, { viewType: 'full' })
      expect(result.success).toBe(true)
      expect(mockApiPost).toHaveBeenCalledWith('/api/analytics/track-view', {
        pitchId: 5,
        viewType: 'full',
      })
    })
  })

  // ─── messageAPI ───────────────────────────────────────────────────
  describe('messageAPI.sendMessage', () => {
    it('posts message data and returns success', async () => {
      mockApiPost.mockResolvedValueOnce(success({ messageId: 1 }))
      const result = await messageAPI.sendMessage({
        pitchId: 1,
        receiverId: 2,
        content: 'Hello',
      })
      expect(result.success).toBe(true)
      expect(mockApiPost).toHaveBeenCalledWith('/api/messages/send', expect.objectContaining({
        pitchId: 1,
        content: 'Hello',
      }))
    })

    it('returns error on failure', async () => {
      mockApiPost.mockResolvedValueOnce(failure('Unauthorized'))
      const result = await messageAPI.sendMessage({
        pitchId: 1,
        receiverId: 2,
        content: 'Hello',
      })
      expect(result.success).toBe(false)
      expect(result.error).toBe('Unauthorized')
    })
  })

  describe('messageAPI.getMessages', () => {
    it('builds endpoint with type and pitchId', async () => {
      mockApiGet.mockResolvedValueOnce(success({ messages: [] }))
      await messageAPI.getMessages('inbox', 42)
      expect(mockApiGet).toHaveBeenCalledWith('/api/messages/list?type=inbox&pitchId=42')
    })

    it('omits pitchId param when not provided', async () => {
      mockApiGet.mockResolvedValueOnce(success({ messages: [] }))
      await messageAPI.getMessages('sent')
      expect(mockApiGet).toHaveBeenCalledWith('/api/messages/list?type=sent')
    })
  })

  describe('messageAPI.markAsRead', () => {
    it('posts to mark-read endpoint', async () => {
      mockApiPost.mockResolvedValueOnce(success({}))
      await messageAPI.markAsRead(7)
      expect(mockApiPost).toHaveBeenCalledWith('/api/messages/7/read')
    })
  })

  describe('messageAPI.approveOffPlatform', () => {
    it('posts to approve-offplatform endpoint', async () => {
      mockApiPost.mockResolvedValueOnce(success({}))
      await messageAPI.approveOffPlatform(3)
      expect(mockApiPost).toHaveBeenCalledWith('/api/messages/3/approve-offplatform')
    })
  })

  // ─── pitchServicesAPI ─────────────────────────────────────────────
  describe('pitchServicesAPI.getPitchesWithNDAStatus', () => {
    it('returns pitches on success', async () => {
      mockApiGet.mockResolvedValueOnce(success([{ id: 1, title: 'Test' }]))
      const result = await pitchServicesAPI.getPitchesWithNDAStatus()
      expect(result.success).toBe(true)
      expect(result.pitches).toEqual([{ id: 1, title: 'Test' }])
    })
  })

  describe('pitchServicesAPI.getFollowingPitches', () => {
    it('returns pitches array from top-level data', async () => {
      mockApiGet.mockResolvedValueOnce(success([{ id: 1 }]))
      const result = await pitchServicesAPI.getFollowingPitches()
      expect(result.pitches).toEqual([{ id: 1 }])
    })

    it('passes through data that already has .pitches property', async () => {
      mockApiGet.mockResolvedValueOnce(success({ pitches: [{ id: 2 }], total: 1 }))
      const result = await pitchServicesAPI.getFollowingPitches()
      expect(result.pitches).toEqual([{ id: 2 }])
    })

    it('returns empty pitches on failure', async () => {
      mockApiGet.mockResolvedValueOnce(failure('Error'))
      const result = await pitchServicesAPI.getFollowingPitches()
      expect(result.pitches).toEqual([])
    })
  })

  describe('pitchServicesAPI.toggleFollow', () => {
    it('posts to follow endpoint when follow=true', async () => {
      mockApiPost.mockResolvedValueOnce(success({}))
      await pitchServicesAPI.toggleFollow(5, true)
      expect(mockApiPost).toHaveBeenCalledWith('/api/pitches/5/follow')
    })

    it('posts to unfollow endpoint when follow=false', async () => {
      mockApiPost.mockResolvedValueOnce(success({}))
      await pitchServicesAPI.toggleFollow(5, false)
      expect(mockApiPost).toHaveBeenCalledWith('/api/pitches/5/unfollow')
    })
  })

  // ─── paymentsAPI ──────────────────────────────────────────────────
  describe('paymentsAPI.getSubscriptionStatus', () => {
    it('returns data on success', async () => {
      mockApiGet.mockResolvedValueOnce(success({ tier: 'creator', active: true }))
      const result = await paymentsAPI.getSubscriptionStatus()
      expect(result).toEqual({ tier: 'creator', active: true })
    })

    it('returns null on failure', async () => {
      mockApiGet.mockResolvedValueOnce(failure('Error'))
      const result = await paymentsAPI.getSubscriptionStatus()
      expect(result).toBeNull()
    })
  })

  describe('paymentsAPI.subscribe', () => {
    it('posts tier and billingInterval', async () => {
      mockApiPost.mockResolvedValueOnce(success({ url: 'https://stripe.com/checkout' }))
      const result = await paymentsAPI.subscribe('creator', 'monthly', 'eur', 'PROMO10')
      expect(result.success).toBe(true)
      expect(mockApiPost).toHaveBeenCalledWith('/api/payments/subscribe', {
        tier: 'creator',
        billingInterval: 'monthly',
        currency: 'eur',
        promoCode: 'PROMO10',
      })
    })
  })

  describe('paymentsAPI.validatePromo', () => {
    it('posts promo code and returns validation result', async () => {
      mockApiPost.mockResolvedValueOnce(success({ valid: true, percentOff: 20 }))
      const result = await paymentsAPI.validatePromo('SAVE20')
      expect(result.success).toBe(true)
      expect(result.valid).toBe(true)
      expect(result.percentOff).toBe(20)
    })

    it('returns success:false when promo invalid', async () => {
      mockApiPost.mockResolvedValueOnce(failure('Invalid promo'))
      const result = await paymentsAPI.validatePromo('BOGUS')
      expect(result.success).toBe(false)
    })
  })

  describe('paymentsAPI.openBillingPortal', () => {
    it('returns url on success', async () => {
      mockApiPost.mockResolvedValueOnce(success({ url: 'https://billing.stripe.com/portal' }))
      const result = await paymentsAPI.openBillingPortal()
      expect(result.success).toBe(true)
      expect((result as any).url).toBe('https://billing.stripe.com/portal')
    })

    it('returns success:false when url missing', async () => {
      mockApiPost.mockResolvedValueOnce(success({}))
      const result = await paymentsAPI.openBillingPortal()
      expect(result.success).toBe(false)
    })

    it('returns success:false on api failure', async () => {
      mockApiPost.mockResolvedValueOnce(failure('Error'))
      const result = await paymentsAPI.openBillingPortal()
      expect(result.success).toBe(false)
    })
  })

  describe('paymentsAPI.getCreditBalance', () => {
    it('returns data on success', async () => {
      mockApiGet.mockResolvedValueOnce(success({ balance: 100 }))
      const result = await paymentsAPI.getCreditBalance()
      expect(result).toEqual({ balance: 100 })
    })

    it('returns null on failure', async () => {
      mockApiGet.mockResolvedValueOnce(failure('Error'))
      const result = await paymentsAPI.getCreditBalance()
      expect(result).toBeNull()
    })
  })

  describe('paymentsAPI.getCredits', () => {
    it('is an alias for getCreditBalance', async () => {
      mockApiGet.mockResolvedValueOnce(success({ balance: 50 }))
      const result = await paymentsAPI.getCredits()
      expect(result).toEqual({ balance: 50 })
    })
  })

  describe('paymentsAPI.purchaseCredits', () => {
    it('posts creditPackage and currency', async () => {
      mockApiPost.mockResolvedValueOnce(success({ success: true }))
      await paymentsAPI.purchaseCredits('pack-10', 'eur')
      expect(mockApiPost).toHaveBeenCalledWith('/api/payments/credits/purchase', {
        creditPackage: 'pack-10',
        currency: 'eur',
      })
    })
  })

  describe('paymentsAPI.useCredits', () => {
    it('posts amount and description', async () => {
      mockApiPost.mockResolvedValueOnce(success({}))
      await paymentsAPI.useCredits(5, 'NDA request', 'nda', 42)
      expect(mockApiPost).toHaveBeenCalledWith('/api/payments/credits/use', {
        amount: 5,
        description: 'NDA request',
        usageType: 'nda',
        pitchId: 42,
      })
    })
  })

  describe('paymentsAPI.getPaymentHistory', () => {
    it('builds query params from filters', async () => {
      mockApiGet.mockResolvedValueOnce(success([]))
      await paymentsAPI.getPaymentHistory({ type: 'purchase', limit: 20, offset: 0 })
      const [url] = mockApiGet.mock.calls[0]
      expect(url).toMatch(/type=purchase/)
      expect(url).toMatch(/limit=20/)
    })

    it('omits query string when no params', async () => {
      mockApiGet.mockResolvedValueOnce(success([]))
      await paymentsAPI.getPaymentHistory()
      const [url] = mockApiGet.mock.calls[0]
      expect(url).toBe('/api/payments/history')
    })
  })

  describe('paymentsAPI.cancelSubscription', () => {
    it('posts to cancel endpoint', async () => {
      mockApiPost.mockResolvedValueOnce(success({ cancelled: true }))
      const result = await paymentsAPI.cancelSubscription()
      expect(result.success).toBe(true)
      expect(mockApiPost).toHaveBeenCalledWith('/api/payments/cancel-subscription')
    })
  })

  // ─── savedPitchesService ──────────────────────────────────────────
  describe('savedPitchesService.getSavedPitches', () => {
    it('wraps savedPitchesAPI.getSavedPitches and spreads data', async () => {
      const { savedPitchesAPI: mockSaved } = await import('../api-client')
      ;(mockSaved.getSavedPitches as any).mockResolvedValueOnce(
        success({ savedPitches: [{ id: 1 }], total: 1 })
      )
      const result = await savedPitchesService.getSavedPitches({ page: 1 })
      expect(result.success).toBe(true)
    })

    it('returns empty savedPitches on error', async () => {
      const { savedPitchesAPI: mockSaved } = await import('../api-client')
      ;(mockSaved.getSavedPitches as any).mockResolvedValueOnce(failure('Error'))
      const result = await savedPitchesService.getSavedPitches()
      expect(result.success).toBe(false)
      expect(result.savedPitches).toEqual([])
    })
  })

  describe('savedPitchesService.savePitch', () => {
    it('calls savePitch and returns success', async () => {
      const { savedPitchesAPI: mockSaved } = await import('../api-client')
      ;(mockSaved.savePitch as any).mockResolvedValueOnce(success({ id: 1 }))
      const result = await savedPitchesService.savePitch(5, 'My notes')
      expect(result.success).toBe(true)
    })
  })

  describe('savedPitchesService.unsavePitch', () => {
    it('calls unsavePitch and returns success', async () => {
      const { savedPitchesAPI: mockSaved } = await import('../api-client')
      ;(mockSaved.unsavePitch as any).mockResolvedValueOnce(success({ success: true }))
      const result = await savedPitchesService.unsavePitch(3)
      expect(result.success).toBe(true)
    })
  })

  describe('savedPitchesService.isPitchSaved', () => {
    it('returns isSaved state', async () => {
      const { savedPitchesAPI: mockSaved } = await import('../api-client')
      ;(mockSaved.isPitchSaved as any).mockResolvedValueOnce(
        success({ isSaved: true, savedPitchId: 7 })
      )
      const result = await savedPitchesService.isPitchSaved(10)
      expect(result.success).toBe(true)
    })

    it('returns isSaved:false on error', async () => {
      const { savedPitchesAPI: mockSaved } = await import('../api-client')
      ;(mockSaved.isPitchSaved as any).mockResolvedValueOnce(failure('Error'))
      const result = await savedPitchesService.isPitchSaved(10)
      expect(result.success).toBe(false)
      expect(result.isSaved).toBe(false)
    })
  })
})
