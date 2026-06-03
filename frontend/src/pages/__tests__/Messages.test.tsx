import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '../../test/utils'
import userEvent from '@testing-library/user-event'
import Messages from '../Messages'

// Hoisted mocks
const { mockNavigate, mockMessaging, mockAuthStore } = vi.hoisted(() => ({
  mockNavigate: vi.fn(),
  mockMessaging: {
    conversations: [] as any[],
    setConversations: vi.fn(),
    currentMessages: [] as any[],
    setCurrentMessages: vi.fn(),
    typingUsers: {} as Record<number, string[]>,
    onlineUsers: {} as Record<number, boolean>,
    unreadCounts: {} as Record<number, number>,
    isConnected: true,
    sendChatMessage: vi.fn(),
    markMessageAsRead: vi.fn(),
    startTyping: vi.fn(),
    stopTyping: vi.fn(),
    joinConversation: vi.fn(),
    markConversationAsRead: vi.fn(),
  },
  mockAuthStore: {
    user: { id: 1, name: 'Test User', email: 'test@test.com', userType: 'investor' } as any,
    isAuthenticated: true,
  },
}))

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom')
  return { ...actual, useNavigate: () => mockNavigate }
})

vi.mock('@features/notifications/hooks/useWebSocket', () => ({
  useMessaging: () => mockMessaging,
}))

vi.mock('../../store/betterAuthStore', () => ({
  useBetterAuthStore: () => mockAuthStore,
}))

vi.mock('../../lib/apiServices', () => ({
  getUserId: () => '1',
}))

vi.mock('../../lib/api-client', () => ({
  apiClient: {
    get: vi.fn().mockResolvedValue({ success: true, data: { conversations: [] } }),
    post: vi.fn().mockResolvedValue({ success: true, data: { conversation: { id: 1 } } }),
  },
}))

vi.mock('../../config/subscription-plans', () => ({
  // getCreditCost returns a NUMBER (the credit cost), not an object — matching the real impl.
  getCreditCost: () => 2,
}))

// Mock the messaging types import (resolves to backend types)
vi.mock('../../../src/types/messaging.types', () => ({}))

const createMockConversation = (id: number, overrides = {}) => ({
  id,
  participantName: `User ${id}`,
  participantType: 'creator' as const,
  lastMessageText: `Last message in conversation ${id}`,
  lastMessage: { content: `Last message in conversation ${id}`, timestamp: '2026-02-15T10:00:00Z' },
  lastMessageAt: '2026-02-15T10:00:00Z',
  timestamp: '2026-02-15T10:00:00Z',
  isOnline: false,
  hasUnreadMessages: false,
  pitchTitle: `Pitch ${id}`,
  unreadCount: 0,
  ...overrides,
})

const createMockMessage = (id: number, overrides = {}) => ({
  id,
  conversationId: 1,
  senderId: 2,
  senderName: 'Other User',
  senderType: 'creator' as const,
  content: `Message ${id}`,
  message: `Message ${id}`,
  timestamp: `2026-02-15T10:0${id}:00Z`,
  isRead: false,
  hasAttachment: false,
  delivered: true,
  ...overrides,
})

describe('Messages', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockMessaging.conversations = []
    mockMessaging.currentMessages = []
    mockMessaging.typingUsers = {}
    mockMessaging.onlineUsers = {}
    mockMessaging.unreadCounts = {}
    mockMessaging.isConnected = true
  })

  // ─── Initial Render ────────────────────────────────────────────────

  describe('Initial Render', () => {
    it('renders Messages page', () => {
      render(<Messages />)
      expect(screen.getByText(/select a conversation/i)).toBeInTheDocument()
    })

    it('shows empty state when no conversations', async () => {
      render(<Messages />)
      await waitFor(() => {
        expect(screen.getByText('No conversations yet')).toBeInTheDocument()
      })
    })
  })

  // ─── Conversation List ─────────────────────────────────────────────

  describe('Conversation List', () => {
    it('renders conversation list items', async () => {
      mockMessaging.conversations = [
        createMockConversation(1, { participantName: 'Alice' }),
        createMockConversation(2, { participantName: 'Bob' }),
      ]

      render(<Messages />)

      await waitFor(() => {
        expect(screen.getByText('Alice')).toBeInTheDocument()
        expect(screen.getByText('Bob')).toBeInTheDocument()
      })
    })

    it('shows last message preview', async () => {
      mockMessaging.conversations = [
        createMockConversation(1, {
          lastMessageText: 'Hey, check this out!',
          lastMessage: { content: 'Hey, check this out!', timestamp: '2026-02-15T10:00:00Z' },
        }),
      ]

      render(<Messages />)

      await waitFor(() => {
        expect(screen.getByText('Hey, check this out!')).toBeInTheDocument()
      })
    })

    it('shows unread count badge', async () => {
      mockMessaging.conversations = [
        createMockConversation(1, { hasUnreadMessages: true, unreadCount: 3 }),
      ]
      mockMessaging.unreadCounts = { 1: 3 }

      render(<Messages />)

      await waitFor(() => {
        expect(screen.getByText('3')).toBeInTheDocument()
      })
    })
  })

  // ─── Search ────────────────────────────────────────────────────────

  describe('Search', () => {
    it('renders search input', () => {
      render(<Messages />)
      const input = screen.getByPlaceholderText(/search/i)
      expect(input).toBeInTheDocument()
    })

    it('filters conversations by search term', async () => {
      const u = userEvent.setup()
      mockMessaging.conversations = [
        createMockConversation(1, { participantName: 'Alice Director' }),
        createMockConversation(2, { participantName: 'Bob Producer' }),
      ]

      render(<Messages />)

      await waitFor(() => {
        expect(screen.getByText('Alice Director')).toBeInTheDocument()
      })

      const input = screen.getByPlaceholderText(/search/i)
      await u.type(input, 'Alice')

      await waitFor(() => {
        expect(screen.getByText('Alice Director')).toBeInTheDocument()
        expect(screen.queryByText('Bob Producer')).not.toBeInTheDocument()
      })
    })
  })

  // ─── Message Display ──────────────────────────────────────────────

  describe('Message Display', () => {
    it('displays messages for selected conversation', async () => {
      const u = userEvent.setup()
      mockMessaging.conversations = [
        createMockConversation(1, { participantName: 'Alice' }),
      ]
      mockMessaging.currentMessages = [
        createMockMessage(1, { content: 'Hello there!', message: 'Hello there!' }),
        createMockMessage(2, { content: 'How are you?', message: 'How are you?' }),
      ]

      render(<Messages />)

      await waitFor(() => {
        expect(screen.getByText('Alice')).toBeInTheDocument()
      })

      await u.click(screen.getByText('Alice'))

      await waitFor(() => {
        expect(screen.getByText('Hello there!')).toBeInTheDocument()
        expect(screen.getByText('How are you?')).toBeInTheDocument()
      })
    })
  })

  // ─── Message Input ─────────────────────────────────────────────────

  describe('Message Input', () => {
    it('renders message input when conversation is selected', async () => {
      const u = userEvent.setup()
      mockMessaging.conversations = [
        createMockConversation(1, { participantName: 'Alice' }),
      ]

      render(<Messages />)

      await waitFor(() => {
        expect(screen.getByText('Alice')).toBeInTheDocument()
      })

      await u.click(screen.getByText('Alice'))

      await waitFor(() => {
        const input = screen.getByPlaceholderText(/type.*message/i)
        expect(input).toBeInTheDocument()
      })
    })
  })

  // ─── Connection Status ─────────────────────────────────────────────

  describe('Connection Status', () => {
    it('does not show disconnected warning when connected', () => {
      mockMessaging.isConnected = true
      render(<Messages />)
      expect(screen.queryByText(/disconnected|reconnecting/i)).not.toBeInTheDocument()
    })

    it('shows disconnected warning when not connected', () => {
      mockMessaging.isConnected = false
      render(<Messages />)
      const matches = screen.getAllByText(/disconnected|reconnecting|connection/i)
      expect(matches.length).toBeGreaterThan(0)
    })
  })
})
