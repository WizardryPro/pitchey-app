import { describe, it, expect, vi, beforeEach, beforeAll } from 'vitest'
import { render, screen, waitFor, fireEvent } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import React from 'react'

// ─── Hoisted mock functions ─────────────────────────────────────────
const mockNavigate = vi.fn()
const mockCheckSession = vi.fn()
const mockLogout = vi.fn()
const mockUpdateProfile = vi.fn()
const mockUploadProfileImage = vi.fn()
const mockUploadCoverImage = vi.fn()
const mockToastSuccess = vi.fn()
const mockToastError = vi.fn()

// ─── react-router-dom ───────────────────────────────────────────────
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom')
  return {
    ...actual,
    useNavigate: () => mockNavigate,
  }
})

// ─── Auth store (STABLE reference) ──────────────────────────────────
const mockUser = {
  id: 1,
  name: 'Jane Doe',
  username: 'janedoe',
  email: 'jane@example.com',
  userType: 'creator',
  firstName: 'Jane',
  lastName: 'Doe',
  bio: 'Film creator',
  location: 'Los Angeles',
  website: 'https://jane.com',
  socialLinks: { twitter: '@janedoe' },
  profileImage: undefined,
  coverImage: undefined,
}

const mockAuthState = {
  user: mockUser,
  isAuthenticated: true,
  logout: mockLogout,
  checkSession: mockCheckSession,
}

vi.mock('../../store/betterAuthStore', () => ({
  useBetterAuthStore: () => mockAuthState,
}))

// ─── UserService ─────────────────────────────────────────────────────
vi.mock('../../services/user.service', () => ({
  UserService: {
    updateProfile: (...args: any[]) => mockUpdateProfile(...args),
    uploadProfileImage: (...args: any[]) => mockUploadProfileImage(...args),
    uploadCoverImage: (...args: any[]) => mockUploadCoverImage(...args),
  },
}))

// ─── react-hot-toast ─────────────────────────────────────────────────
vi.mock('react-hot-toast', () => ({
  default: { success: mockToastSuccess, error: mockToastError, loading: vi.fn() },
  toast: { success: mockToastSuccess, error: mockToastError, loading: vi.fn() },
}))

// ─── Dynamic import ──────────────────────────────────────────────────
let SettingsProfile: React.ComponentType
beforeAll(async () => {
  const mod = await import('../settings/SettingsProfile')
  SettingsProfile = mod.default
})

const renderComponent = () =>
  render(
    <MemoryRouter>
      <SettingsProfile />
    </MemoryRouter>
  )

describe('SettingsProfile', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockCheckSession.mockResolvedValue(undefined)
    mockUpdateProfile.mockResolvedValue({})
    mockUploadProfileImage.mockResolvedValue('https://cdn.example.com/avatar.jpg')
    mockUploadCoverImage.mockResolvedValue('https://cdn.example.com/cover.jpg')
  })

  describe('Layout', () => {
    it('renders the Personal Information heading', () => {
      renderComponent()
      expect(screen.getByText('Personal Information')).toBeInTheDocument()
    })

    it('renders section headings', () => {
      renderComponent()
      expect(screen.getByText('Personal Information')).toBeInTheDocument()
      expect(screen.getByText('Professional Information')).toBeInTheDocument()
      expect(screen.getByText('Social Media')).toBeInTheDocument()
    })

    it('renders action buttons', () => {
      renderComponent()
      expect(screen.getByText('Save Changes')).toBeInTheDocument()
      expect(screen.getByText('Cancel')).toBeInTheDocument()
    })

    it('renders cover image change button', () => {
      renderComponent()
      expect(screen.getByText('Change Cover')).toBeInTheDocument()
    })
  })

  describe('Form pre-population', () => {
    it('pre-populates first name from user store', () => {
      renderComponent()
      const firstNameInput = screen.getByDisplayValue('Jane')
      expect(firstNameInput).toBeInTheDocument()
    })

    it('pre-populates last name from user store', () => {
      renderComponent()
      const lastNameInput = screen.getByDisplayValue('Doe')
      expect(lastNameInput).toBeInTheDocument()
    })

    it('pre-populates email field (disabled)', () => {
      renderComponent()
      const emailInput = screen.getByDisplayValue('jane@example.com')
      expect(emailInput).toBeDisabled()
    })

    it('pre-populates username', () => {
      renderComponent()
      expect(screen.getByDisplayValue('janedoe')).toBeInTheDocument()
    })

    it('pre-populates bio', () => {
      renderComponent()
      expect(screen.getByDisplayValue('Film creator')).toBeInTheDocument()
    })

    it('pre-populates location', () => {
      renderComponent()
      expect(screen.getByDisplayValue('Los Angeles')).toBeInTheDocument()
    })

    it('pre-populates website', () => {
      renderComponent()
      expect(screen.getByDisplayValue('https://jane.com')).toBeInTheDocument()
    })

    it('pre-populates twitter social link', () => {
      renderComponent()
      expect(screen.getByDisplayValue('@janedoe')).toBeInTheDocument()
    })
  })

  describe('Form labels', () => {
    it('renders all personal information labels', () => {
      renderComponent()
      expect(screen.getByText('First Name')).toBeInTheDocument()
      expect(screen.getByText('Last Name')).toBeInTheDocument()
      expect(screen.getByText('Username')).toBeInTheDocument()
      expect(screen.getByText('Email')).toBeInTheDocument()
      expect(screen.getByText('Location')).toBeInTheDocument()
      expect(screen.getByText('Bio')).toBeInTheDocument()
    })

    it('renders professional information labels', () => {
      renderComponent()
      expect(screen.getByText('Company')).toBeInTheDocument()
      expect(screen.getByText('Position')).toBeInTheDocument()
      expect(screen.getByText('Website')).toBeInTheDocument()
    })

    it('renders social media labels', () => {
      renderComponent()
      expect(screen.getByText('Twitter')).toBeInTheDocument()
      expect(screen.getByText('LinkedIn')).toBeInTheDocument()
      expect(screen.getByText('Instagram')).toBeInTheDocument()
      expect(screen.getByText('YouTube')).toBeInTheDocument()
    })
  })

  describe('Save action', () => {
    it('calls UserService.updateProfile on save', async () => {
      const user = userEvent.setup()
      renderComponent()

      await user.click(screen.getByText('Save Changes'))

      await waitFor(() => {
        expect(mockUpdateProfile).toHaveBeenCalledWith(
          expect.objectContaining({
            name: 'Jane Doe',
            username: 'janedoe',
            bio: 'Film creator',
          })
        )
      })
    })

    it('calls checkSession after successful save', async () => {
      const user = userEvent.setup()
      renderComponent()

      await user.click(screen.getByText('Save Changes'))

      await waitFor(() => {
        expect(mockCheckSession).toHaveBeenCalled()
      })
    })

    it('shows success toast after save', async () => {
      const user = userEvent.setup()
      renderComponent()

      await user.click(screen.getByText('Save Changes'))

      await waitFor(() => {
        expect(mockToastSuccess).toHaveBeenCalledWith('Profile updated successfully!')
      })
    })

    it('shows error toast when save fails', async () => {
      mockUpdateProfile.mockRejectedValue(new Error('Network error'))
      const user = userEvent.setup()
      renderComponent()

      await user.click(screen.getByText('Save Changes'))

      await waitFor(() => {
        expect(mockToastError).toHaveBeenCalledWith('Network error')
      })
    })
  })

  describe('Cancel action', () => {
    it('navigates back when Cancel is clicked', async () => {
      const user = userEvent.setup()
      renderComponent()

      await user.click(screen.getByText('Cancel'))

      expect(mockNavigate).toHaveBeenCalledWith(-1)
    })
  })

  describe('Input editing', () => {
    it('allows editing first name field', async () => {
      const user = userEvent.setup()
      renderComponent()

      const firstNameInput = screen.getByDisplayValue('Jane')
      await user.clear(firstNameInput)
      await user.type(firstNameInput, 'Jessica')

      expect(screen.getByDisplayValue('Jessica')).toBeInTheDocument()
    })

    it('allows editing bio textarea', async () => {
      const user = userEvent.setup()
      renderComponent()

      const bioTextarea = screen.getByDisplayValue('Film creator')
      await user.clear(bioTextarea)
      await user.type(bioTextarea, 'New bio text')

      expect(screen.getByDisplayValue('New bio text')).toBeInTheDocument()
    })
  })
})
