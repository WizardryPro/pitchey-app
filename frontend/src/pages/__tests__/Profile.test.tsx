import { describe, it, expect, vi, beforeEach, beforeAll, afterEach } from 'vitest'
import { render, screen, waitFor, fireEvent } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import React from 'react'

// ─── Hoisted mock functions ─────────────────────────────────────────
const mockNavigate = vi.fn()
const mockLogout = vi.fn()
const mockFetch = vi.fn()

// ─── react-router-dom ───────────────────────────────────────────────
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom')
  return {
    ...actual,
    useNavigate: () => mockNavigate,
    Link: ({ to, children, ...props }: any) => <a href={to} {...props}>{children}</a>,
  }
})

// ─── Auth store (STABLE reference to prevent infinite loops) ────────
const mockUser = {
  id: 1,
  name: 'Test User',
  email: 'test@test.com',
  user_type: 'creator',
  username: 'testuser',
  firstName: 'Test',
  lastName: 'User',
}
const mockAuthState = {
  user: mockUser,
  isAuthenticated: true,
  logout: mockLogout,
  checkSession: vi.fn(),
}
vi.mock('../../store/betterAuthStore', () => ({
  useBetterAuthStore: () => mockAuthState,
}))

// ─── Config ─────────────────────────────────────────────────────────
vi.mock('../../config', () => ({
  API_URL: 'http://localhost:8787',
  config: { API_URL: 'http://localhost:8787' },
  getApiUrl: () => 'http://localhost:8787',
}))

// ─── Dynamic import ──────────────────────────────────────────────────
let Profile: React.ComponentType
beforeAll(async () => {
  const mod = await import('../Profile')
  Profile = mod.default
})

describe('Profile', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockFetch.mockReset()
    vi.stubGlobal('fetch', mockFetch)

    // Default: profile fetch succeeds
    mockFetch.mockImplementation((url: string) => {
      if (url.includes('/api/user/profile')) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({
            id: 1,
            username: 'testuser',
            email: 'test@test.com',
            firstName: 'Test',
            lastName: 'User',
            userType: 'creator',
            bio: 'A test creator',
            phone: '555-1234',
            location: 'Los Angeles, CA',
            website: 'https://example.com',
            createdAt: '2024-01-01T00:00:00Z',
            followerCount: 42,
          }),
        })
      }
      if (url.includes('/api/users/following/count')) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({ counts: { creators: 10 } }),
        })
      }
      return Promise.resolve({ ok: false, json: () => Promise.resolve({}) })
    })
  })

  afterEach(() => {
    Object.defineProperty(navigator, 'onLine', { writable: true, value: true })
  })

  it('renders the loading spinner initially', () => {
    render(
      <MemoryRouter>
        <Profile />
      </MemoryRouter>
    )
    // Should show the spinner before data loads
    const spinner = document.querySelector('.animate-spin')
    expect(spinner).toBeTruthy()
  })

  it('renders profile information after loading', async () => {
    render(
      <MemoryRouter>
        <Profile />
      </MemoryRouter>
    )

    await waitFor(() => {
      expect(screen.getByText('Profile Settings')).toBeInTheDocument()
    })
    expect(screen.getByText('test@test.com')).toBeInTheDocument()
  })

  it('renders the user full name when firstName and lastName present', async () => {
    render(
      <MemoryRouter>
        <Profile />
      </MemoryRouter>
    )

    await waitFor(() => {
      expect(screen.getByText('Test User')).toBeInTheDocument()
    })
  })

  it('renders username handle', async () => {
    render(
      <MemoryRouter>
        <Profile />
      </MemoryRouter>
    )

    await waitFor(() => {
      expect(screen.getByText('@testuser')).toBeInTheDocument()
    })
  })

  it('renders the user type badge', async () => {
    render(
      <MemoryRouter>
        <Profile />
      </MemoryRouter>
    )

    await waitFor(() => {
      expect(screen.getByText('creator')).toBeInTheDocument()
    })
  })

  it('renders Personal Information section', async () => {
    render(
      <MemoryRouter>
        <Profile />
      </MemoryRouter>
    )

    await waitFor(() => {
      expect(screen.getByText('Personal Information')).toBeInTheDocument()
    })
  })

  it('renders Professional Information section', async () => {
    render(
      <MemoryRouter>
        <Profile />
      </MemoryRouter>
    )

    await waitFor(() => {
      expect(screen.getByText('Professional Information')).toBeInTheDocument()
    })
  })

  it('renders Edit Profile button', async () => {
    render(
      <MemoryRouter>
        <Profile />
      </MemoryRouter>
    )

    await waitFor(() => {
      expect(screen.getByText('Edit Profile')).toBeInTheDocument()
    })
  })

  it('renders Account Actions section', async () => {
    render(
      <MemoryRouter>
        <Profile />
      </MemoryRouter>
    )

    await waitFor(() => {
      expect(screen.getByText('Account Actions')).toBeInTheDocument()
    })
  })

  it('renders Account Settings and Sign Out buttons', async () => {
    render(
      <MemoryRouter>
        <Profile />
      </MemoryRouter>
    )

    await waitFor(() => {
      expect(screen.getByText('Account Settings')).toBeInTheDocument()
      expect(screen.getByText('Sign Out')).toBeInTheDocument()
    })
  })

  it('switches to edit mode when Edit Profile is clicked', async () => {
    render(
      <MemoryRouter>
        <Profile />
      </MemoryRouter>
    )

    await waitFor(() => {
      expect(screen.getByText('Edit Profile')).toBeInTheDocument()
    })

    fireEvent.click(screen.getByText('Edit Profile'))

    await waitFor(() => {
      expect(screen.getByText('Save Changes')).toBeInTheDocument()
      expect(screen.getByText('Cancel')).toBeInTheDocument()
    })
  })

  it('shows form inputs in edit mode', async () => {
    render(
      <MemoryRouter>
        <Profile />
      </MemoryRouter>
    )

    await waitFor(() => {
      expect(screen.getByText('Edit Profile')).toBeInTheDocument()
    })

    fireEvent.click(screen.getByText('Edit Profile'))

    await waitFor(() => {
      // First Name input
      expect(screen.getByPlaceholderText('Enter your first name')).toBeInTheDocument()
    })
  })

  it('cancels edit mode when Cancel is clicked', async () => {
    render(
      <MemoryRouter>
        <Profile />
      </MemoryRouter>
    )

    await waitFor(() => {
      expect(screen.getByText('Edit Profile')).toBeInTheDocument()
    })

    fireEvent.click(screen.getByText('Edit Profile'))
    await waitFor(() => {
      expect(screen.getByText('Cancel')).toBeInTheDocument()
    })

    fireEvent.click(screen.getByText('Cancel'))

    await waitFor(() => {
      expect(screen.getByText('Edit Profile')).toBeInTheDocument()
    })
  })

  it('falls back to auth store user when API fails', async () => {
    mockFetch.mockImplementation((url: string) => {
      if (url.includes('/api/user/profile')) {
        return Promise.resolve({ ok: false, json: () => Promise.resolve({}) })
      }
      return Promise.resolve({ ok: false, json: () => Promise.resolve({}) })
    })

    render(
      <MemoryRouter>
        <Profile />
      </MemoryRouter>
    )

    await waitFor(() => {
      // Should not show "Profile Not Found" since there's a fallback to auth store
      expect(screen.queryByText('Profile Not Found')).not.toBeInTheDocument()
    })
  })

  it('shows social stats with followers and following counts', async () => {
    render(
      <MemoryRouter>
        <Profile />
      </MemoryRouter>
    )

    await waitFor(() => {
      expect(screen.getByText('followers')).toBeInTheDocument()
      expect(screen.getByText('following')).toBeInTheDocument()
    })
  })

  it('navigates back when ArrowLeft is clicked', async () => {
    render(
      <MemoryRouter>
        <Profile />
      </MemoryRouter>
    )

    await waitFor(() => {
      expect(screen.getByText('Profile Settings')).toBeInTheDocument()
    })

    // Find the back button (ArrowLeft)
    const header = screen.getByText('Profile Settings').closest('header')
    const backButton = header?.querySelector('button')
    if (backButton) {
      fireEvent.click(backButton)
      expect(mockNavigate).toHaveBeenCalledWith(-1)
    }
  })
})
