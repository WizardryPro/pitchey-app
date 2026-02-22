import { describe, it, expect, vi, beforeEach } from 'vitest'

// Mock api-client BEFORE importing the service
vi.mock('../../lib/api-client', () => ({
  apiClient: {
    get: vi.fn(),
    post: vi.fn(),
    put: vi.fn(),
    delete: vi.fn(),
  },
}))

import { apiClient } from '../../lib/api-client'
import { UserService } from '../user.service'

const mockApiClient = apiClient as {
  get: ReturnType<typeof vi.fn>
  post: ReturnType<typeof vi.fn>
  put: ReturnType<typeof vi.fn>
  delete: ReturnType<typeof vi.fn>
}

const mockUser = {
  id: 1,
  email: 'test@test.com',
  username: 'testuser',
  userType: 'creator' as const,
  emailVerified: true,
  isActive: true,
  createdAt: '2024-01-01',
  updatedAt: '2024-01-01',
}

describe('UserService', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    // Mock localStorage
    Object.defineProperty(window, 'localStorage', {
      value: {
        setItem: vi.fn(),
        getItem: vi.fn(),
        removeItem: vi.fn(),
        clear: vi.fn(),
      },
      writable: true,
    })
  })

  describe('getCurrentUser', () => {
    it('returns current user profile', async () => {
      mockApiClient.get.mockResolvedValue({ success: true, data: { user: mockUser } })

      const result = await UserService.getCurrentUser()

      expect(mockApiClient.get).toHaveBeenCalledWith('/api/user/profile')
      expect(result.email).toBe('test@test.com')
    })

    it('throws on API failure', async () => {
      mockApiClient.get.mockResolvedValue({ success: false, error: { message: 'Unauthorized' } })
      await expect(UserService.getCurrentUser()).rejects.toThrow('Unauthorized')
    })

    it('throws when user is missing from response', async () => {
      mockApiClient.get.mockResolvedValue({ success: true, data: {} })
      await expect(UserService.getCurrentUser()).rejects.toThrow('Failed to fetch user profile')
    })
  })

  describe('getUserById', () => {
    it('returns user by ID', async () => {
      mockApiClient.get.mockResolvedValue({ success: true, data: { user: mockUser } })

      const result = await UserService.getUserById(1)

      expect(mockApiClient.get).toHaveBeenCalledWith('/api/users/1')
      expect(result.id).toBe(1)
    })

    it('throws on not found', async () => {
      mockApiClient.get.mockResolvedValue({ success: false, error: { message: 'User not found' } })
      await expect(UserService.getUserById(99)).rejects.toThrow('User not found')
    })
  })

  describe('getUserByUsername', () => {
    it('returns user by username', async () => {
      mockApiClient.get.mockResolvedValue({ success: true, data: { user: mockUser } })

      const result = await UserService.getUserByUsername('testuser')

      expect(mockApiClient.get).toHaveBeenCalledWith('/api/users/username/testuser')
      expect(result.username).toBe('testuser')
    })

    it('throws when not found', async () => {
      mockApiClient.get.mockResolvedValue({ success: false, error: { message: 'User not found' } })
      await expect(UserService.getUserByUsername('nobody')).rejects.toThrow('User not found')
    })
  })

  describe('updateProfile', () => {
    it('updates profile and returns user', async () => {
      const updatedUser = { ...mockUser, name: 'Alice Creator' }
      mockApiClient.put.mockResolvedValue({ success: true, data: { user: updatedUser } })

      const result = await UserService.updateProfile({ name: 'Alice Creator' })

      expect(mockApiClient.put).toHaveBeenCalledWith('/api/user/profile', { name: 'Alice Creator' })
      expect(result.name).toBe('Alice Creator')
    })

    it('stores user in localStorage on update', async () => {
      const updatedUser = { ...mockUser, name: 'New Name' }
      mockApiClient.put.mockResolvedValue({ success: true, data: { user: updatedUser } })

      await UserService.updateProfile({ name: 'New Name' })

      expect(window.localStorage.setItem).toHaveBeenCalledWith('user', JSON.stringify(updatedUser))
    })

    it('throws on failure', async () => {
      mockApiClient.put.mockResolvedValue({ success: false, error: { message: 'Validation failed' } })
      await expect(UserService.updateProfile({ name: '' })).rejects.toThrow('Validation failed')
    })
  })

  describe('updateSettings', () => {
    it('updates settings successfully', async () => {
      mockApiClient.put.mockResolvedValue({ success: true })
      await expect(UserService.updateSettings({ emailNotifications: true })).resolves.toBeUndefined()
      expect(mockApiClient.put).toHaveBeenCalledWith('/api/user/settings', { emailNotifications: true })
    })

    it('throws on failure', async () => {
      mockApiClient.put.mockResolvedValue({ success: false, error: { message: 'Error' } })
      await expect(UserService.updateSettings({})).rejects.toThrow()
    })
  })

  describe('getSettings', () => {
    it('returns settings', async () => {
      const settings = { emailNotifications: true, publicProfile: false }
      mockApiClient.get.mockResolvedValue({ success: true, data: { settings } })

      const result = await UserService.getSettings()

      expect(mockApiClient.get).toHaveBeenCalledWith('/api/user/settings')
      expect(result.emailNotifications).toBe(true)
    })

    it('throws when settings missing', async () => {
      mockApiClient.get.mockResolvedValue({ success: true, data: {} })
      await expect(UserService.getSettings()).rejects.toThrow('Failed to fetch settings')
    })
  })

  describe('changePassword', () => {
    it('changes password successfully', async () => {
      mockApiClient.post.mockResolvedValue({ success: true })
      await expect(UserService.changePassword({ currentPassword: 'old', newPassword: 'new', confirmPassword: 'new' }))
        .resolves.toBeUndefined()
      expect(mockApiClient.post).toHaveBeenCalledWith('/api/user/change-password', expect.any(Object))
    })

    it('throws on failure', async () => {
      mockApiClient.post.mockResolvedValue({ success: false, error: { message: 'Wrong current password' } })
      await expect(UserService.changePassword({ currentPassword: 'wrong', newPassword: 'new', confirmPassword: 'new' }))
        .rejects.toThrow('Wrong current password')
    })
  })

  describe('deleteAccount', () => {
    it('deletes account and clears localStorage', async () => {
      mockApiClient.delete.mockResolvedValue({ success: true })
      await expect(UserService.deleteAccount('password123')).resolves.toBeUndefined()
      expect(window.localStorage.clear).toHaveBeenCalled()
    })

    it('throws on failure', async () => {
      mockApiClient.delete.mockResolvedValue({ success: false, error: { message: 'Wrong password' } })
      await expect(UserService.deleteAccount('wrong')).rejects.toThrow('Wrong password')
    })
  })

  describe('searchUsers', () => {
    it('searches users by query', async () => {
      const users = [mockUser]
      mockApiClient.get.mockResolvedValue({ success: true, data: { users, total: 1 } })

      const result = await UserService.searchUsers('alice', { userType: 'creator', limit: 10 })

      expect(mockApiClient.get).toHaveBeenCalledWith(expect.stringContaining('/api/users/search'))
      expect(result.users).toHaveLength(1)
      expect(result.total).toBe(1)
    })

    it('throws on failure', async () => {
      mockApiClient.get.mockResolvedValue({ success: false, error: { message: 'Search failed' } })
      await expect(UserService.searchUsers('test')).rejects.toThrow('Search failed')
    })
  })

  describe('getUserStats', () => {
    it('returns stats for current user', async () => {
      const stats = { totalPitches: 5, totalFollowers: 100 }
      mockApiClient.get.mockResolvedValue({ success: true, data: { stats } })

      const result = await UserService.getUserStats()

      expect(mockApiClient.get).toHaveBeenCalledWith('/api/user/stats')
      expect(result.totalPitches).toBe(5)
    })

    it('returns stats for specific user', async () => {
      const stats = { totalPitches: 3 }
      mockApiClient.get.mockResolvedValue({ success: true, data: { stats } })

      await UserService.getUserStats(42)
      expect(mockApiClient.get).toHaveBeenCalledWith('/api/users/42/stats')
    })

    it('throws on failure', async () => {
      mockApiClient.get.mockResolvedValue({ success: false, error: { message: 'Error' } })
      await expect(UserService.getUserStats()).rejects.toThrow()
    })
  })

  describe('verifyEmail', () => {
    it('verifies email with token', async () => {
      mockApiClient.post.mockResolvedValue({ success: true })
      await expect(UserService.verifyEmail('abc123')).resolves.toBeUndefined()
      expect(mockApiClient.post).toHaveBeenCalledWith('/api/user/verify-email', { token: 'abc123' })
    })

    it('throws on failure', async () => {
      mockApiClient.post.mockResolvedValue({ success: false, error: { message: 'Invalid token' } })
      await expect(UserService.verifyEmail('bad')).rejects.toThrow('Invalid token')
    })
  })

  describe('resendVerificationEmail', () => {
    it('resends verification email', async () => {
      mockApiClient.post.mockResolvedValue({ success: true })
      await expect(UserService.resendVerificationEmail()).resolves.toBeUndefined()
      expect(mockApiClient.post).toHaveBeenCalledWith('/api/user/resend-verification', {})
    })
  })

  describe('requestPasswordReset', () => {
    it('requests password reset', async () => {
      mockApiClient.post.mockResolvedValue({ success: true })
      await expect(UserService.requestPasswordReset('test@test.com')).resolves.toBeUndefined()
      expect(mockApiClient.post).toHaveBeenCalledWith('/api/user/forgot-password', { email: 'test@test.com' })
    })
  })

  describe('resetPassword', () => {
    it('resets password with token', async () => {
      mockApiClient.post.mockResolvedValue({ success: true })
      await expect(UserService.resetPassword('token123', 'newPass')).resolves.toBeUndefined()
      expect(mockApiClient.post).toHaveBeenCalledWith('/api/user/reset-password', { token: 'token123', newPassword: 'newPass' })
    })

    it('throws on failure', async () => {
      mockApiClient.post.mockResolvedValue({ success: false, error: { message: 'Token expired' } })
      await expect(UserService.resetPassword('bad', 'pass')).rejects.toThrow('Token expired')
    })
  })

  describe('getNotificationPreferences', () => {
    it('returns notification preferences', async () => {
      const preferences = { emailEnabled: true, pushEnabled: false }
      mockApiClient.get.mockResolvedValue({ success: true, data: { preferences } })

      const result = await UserService.getNotificationPreferences()

      expect(mockApiClient.get).toHaveBeenCalledWith('/api/user/notification-preferences')
      expect(result.emailEnabled).toBe(true)
    })
  })

  describe('updateNotificationPreferences', () => {
    it('updates notification preferences', async () => {
      mockApiClient.put.mockResolvedValue({ success: true })
      await expect(UserService.updateNotificationPreferences({ emailEnabled: false })).resolves.toBeUndefined()
      expect(mockApiClient.put).toHaveBeenCalledWith('/api/user/notification-preferences', { emailEnabled: false })
    })
  })

  describe('uploadProfileImage', () => {
    it('uploads profile image via fetch', async () => {
      const mockFetch = vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ imageUrl: 'https://example.com/img.jpg' }),
      })
      vi.stubGlobal('fetch', mockFetch)

      const file = new File(['img'], 'photo.jpg', { type: 'image/jpeg' })
      const result = await UserService.uploadProfileImage(file)

      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('/api/upload'),
        expect.objectContaining({ method: 'POST', credentials: 'include' })
      )
      expect(result).toBe('https://example.com/img.jpg')

      vi.unstubAllGlobals()
    })

    it('throws when upload fails', async () => {
      const mockFetch = vi.fn().mockResolvedValue({ ok: false, status: 400 })
      vi.stubGlobal('fetch', mockFetch)

      const file = new File(['img'], 'photo.jpg', { type: 'image/jpeg' })
      await expect(UserService.uploadProfileImage(file)).rejects.toThrow('Failed to upload profile image')

      vi.unstubAllGlobals()
    })
  })

  describe('uploadCoverImage', () => {
    it('uploads cover image via fetch', async () => {
      const mockFetch = vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ imageUrl: 'https://example.com/cover.jpg' }),
      })
      vi.stubGlobal('fetch', mockFetch)

      const file = new File(['img'], 'cover.jpg', { type: 'image/jpeg' })
      const result = await UserService.uploadCoverImage(file)
      expect(result).toBe('https://example.com/cover.jpg')

      vi.unstubAllGlobals()
    })

    it('throws when upload fails', async () => {
      const mockFetch = vi.fn().mockResolvedValue({ ok: false, status: 500 })
      vi.stubGlobal('fetch', mockFetch)

      const file = new File(['img'], 'cover.jpg', { type: 'image/jpeg' })
      await expect(UserService.uploadCoverImage(file)).rejects.toThrow('Failed to upload cover image')

      vi.unstubAllGlobals()
    })
  })
})
