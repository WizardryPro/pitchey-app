import React, { type ReactElement } from 'react'
import { render, RenderOptions } from '@testing-library/react'
import { BrowserRouter } from 'react-router-dom'
import { NotificationToastProvider } from '@shared/components/feedback/NotificationToastContainer'
import { vi } from 'vitest'

// Mock react-router-dom
const mockNavigate = vi.fn()
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom')
  return {
    ...actual,
    useNavigate: () => mockNavigate,
  }
})

// Mock WebSocket + Notifications context to avoid real sockets in tests
vi.mock('@shared/contexts/WebSocketContext', () => {
  const React = require('react')
  const fakeContextValue = {
    // Connection state
    connectionStatus: { status: 'disconnected', reconnectAttempts: 0 },
    queueStatus: { size: 0, dropped: 0 },
    isConnected: false,
    // Real-time data
    notifications: [],
    dashboardMetrics: null,
    onlineUsers: [],
    typingIndicators: [],
    uploadProgress: [],
    pitchViews: new Map(),
    // Actions
    sendMessage: vi.fn(() => true),
    markNotificationAsRead: vi.fn(),
    clearAllNotifications: vi.fn(),
    updatePresence: vi.fn(),
    startTyping: vi.fn(),
    stopTyping: vi.fn(),
    trackPitchView: vi.fn(),
    // Connection control
    connect: vi.fn(),
    disconnect: vi.fn(),
    clearQueue: vi.fn(),
    // Emergency controls
    disableWebSocket: vi.fn(),
    enableWebSocket: vi.fn(),
    isWebSocketDisabled: true,
    // Subscriptions
    subscribeToNotifications: vi.fn(() => () => {}),
    subscribeToDashboard: vi.fn(() => () => {}),
    subscribeToPresence: vi.fn(() => () => {}),
    subscribeToTyping: vi.fn(() => () => {}),
    subscribeToUploads: vi.fn(() => () => {}),
    subscribeToPitchViews: vi.fn(() => () => {}),
    subscribeToMessages: vi.fn(() => () => {}),
    // Notification permission
    requestNotificationPermission: vi.fn(async () => 'denied'),
  }
  return {
    WebSocketProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>,
    useWebSocket: () => fakeContextValue,
    useNotifications: () => ({
      notifications: [],
      markNotificationAsRead: vi.fn(),
      clearAllNotifications: vi.fn(),
      subscribeToNotifications: vi.fn(() => () => {}),
    }),
  }
})

// Mock Zustand stores
const mockAuthStore = {
  user: null,
  session: null,
  isAuthenticated: false,
  login: vi.fn(),
  logout: vi.fn(),
  updateUser: vi.fn(),
  checkSession: vi.fn(),
  refreshSession: vi.fn(),
  loginCreator: vi.fn(),
  loginInvestor: vi.fn(),
  loginProduction: vi.fn(),
  loading: false,
  error: null,
}

const mockPitchStore = {
  pitches: [],
  currentPitch: null,
  loading: false,
  error: null,
  fetchPitches: vi.fn(),
  createPitch: vi.fn(),
  updatePitch: vi.fn(),
  deletePitch: vi.fn(),
  setPitches: vi.fn(),
  setCurrentPitch: vi.fn(),
  setLoading: vi.fn(),
  setError: vi.fn(),
}

// Mock stores
vi.mock('../store/pitchStore', () => ({
  usePitchStore: () => mockPitchStore,
}))

// Mock betterAuthStore (used by login pages)
vi.mock('../store/betterAuthStore', () => ({
  useBetterAuthStore: () => mockAuthStore,
}))

// Test data factories
export const createMockUser = (overrides = {}) => ({
  id: 'mock-user-uuid-' + Date.now(),
  email: 'test@example.com',
  name: 'Test User',
  portalType: 'creator',
  role: 'creator',
  company: 'Test Company',
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
  subscription_tier: 'basic',
  ...overrides,
})

export const createMockPitch = (overrides = {}) => ({
  id: 'mock-pitch-uuid-' + Date.now(),
  title: 'Test Pitch',
  logline: 'A compelling test pitch logline',
  tagline: 'A test tagline',
  synopsis: 'A detailed synopsis of the test pitch',
  genre: 'Drama',
  budget: '1000000',
  format: 'Feature Film',
  status: 'published',
  thumbnail: '',
  views: 0,
  rating: 0,
  creator: {
    id: 'mock-creator-uuid-' + Date.now(),
    name: 'Test Creator',
    company: 'Test Production Co'
  },
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
  viewCount: 0,
  isPublic: true,
  ndaRequired: false,
  genres: ['Drama', 'Action'],
  target_audience: '18-35',
  comparables: 'Similar to Test Movie A and Test Movie B',
  characters: [],
  documents: [],
  ...overrides,
})

export const createMockNDARequest = (overrides = {}) => ({
  id: 'mock-nda-uuid-' + Date.now(),
  pitchId: 'mock-pitch-uuid-' + Date.now(),
  investorId: 'mock-investor-uuid-' + Date.now(),
  status: 'pending',
  requestedAt: new Date().toISOString(),
  investor: {
    id: 'mock-investor-uuid-' + Date.now(),
    name: 'Test Investor',
    email: 'investor@example.com',
    company: 'Test Investment Co.',
  },
  ...overrides,
})

export const createMockCharacter = (overrides = {}) => ({
  id: 'mock-character-uuid-' + Date.now(),
  name: 'Test Character',
  description: 'A test character description',
  age: 25,
  role: 'protagonist',
  importance: 'main',
  arc: 'Character development arc',
  background: 'Character background story',
  ...overrides,
})

// Mock WebSocket context - just pass through since we've mocked the module
const MockWebSocketProvider = ({ children }: { children: React.ReactNode }) => {
  return <>{children}</>
}

// Custom render function that includes providers
const AllTheProviders = ({ children }: { children: React.ReactNode }) => {
  return (
    <BrowserRouter>
      <MockWebSocketProvider>
        <NotificationToastProvider>
          {children}
        </NotificationToastProvider>
      </MockWebSocketProvider>
    </BrowserRouter>
  )
}

const customRender = (
  ui: ReactElement,
  options?: Omit<RenderOptions, 'wrapper'>
) => {
  const result = render(ui, { wrapper: AllTheProviders, ...options })
  return {
    ...result,
    navigate: mockNavigate,
  }
}

// Helper functions
export const mockLocalStorage = () => {
  const store: Record<string, string> = {}
  
  const mockStorage = {
    getItem: vi.fn((key: string) => store[key] || null),
    setItem: vi.fn((key: string, value: string) => {
      store[key] = value
    }),
    removeItem: vi.fn((key: string) => {
      delete store[key]
    }),
    clear: vi.fn(() => {
      Object.keys(store).forEach(key => delete store[key])
    }),
  }

  Object.defineProperty(window, 'localStorage', {
    value: mockStorage,
    writable: true,
  })

  return mockStorage
}

export const mockSessionStorage = () => {
  const store: Record<string, string> = {}
  
  const mockStorage = {
    getItem: vi.fn((key: string) => store[key] || null),
    setItem: vi.fn((key: string, value: string) => {
      store[key] = value
    }),
    removeItem: vi.fn((key: string) => {
      delete store[key]
    }),
    clear: vi.fn(() => {
      Object.keys(store).forEach(key => delete store[key])
    }),
  }

  Object.defineProperty(window, 'sessionStorage', {
    value: mockStorage,
    writable: true,
  })

  return mockStorage
}

export const waitForLoadingToFinish = () =>
  new Promise((resolve) => setTimeout(resolve, 0))

// Custom assertions
export const expectElementToBeVisible = (element: HTMLElement) => {
  // @ts-expect-error - expect is globally available in vitest
  expect(element).toBeInTheDocument()
  // @ts-expect-error - expect is globally available in vitest
  expect(element).toBeVisible()
}

export const expectElementToHaveAccessibleName = (
  element: HTMLElement,
  name: string
) => {
  // @ts-expect-error - expect is globally available in vitest
  expect(element).toHaveAccessibleName(name)
}

// RBAC test helpers
export const createMockPermissions = (role: 'admin' | 'creator' | 'investor' | 'production' | 'viewer' = 'viewer') => {
  return { role }
}

/**
 * Set up localStorage with a specific userType for RBAC tests.
 * Call in beforeEach and clean up in afterEach.
 */
export const setMockUserType = (userType: string) => {
  (localStorage.getItem as ReturnType<typeof vi.fn>).mockImplementation((key: string) => {
    if (key === 'userType') return userType
    return null
  })
}

/**
 * Configure the betterAuthStore mock for permission/guard testing.
 */
export const setMockAuthenticated = (authenticated: boolean) => {
  mockAuthStore.isAuthenticated = authenticated
}

// Store getters for testing
export const getMockAuthStore = () => mockAuthStore
export const getMockPitchStore = () => mockPitchStore
export const getMockNavigate = () => mockNavigate

// Re-export everything
export * from '@testing-library/react'
export { customRender as render }