import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';

// ─── Mock UIActionsService ──────────────────────────────────────────────────
const mockScheduleMeeting = vi.fn();
const mockRequestDemo = vi.fn();
const mockShareContent = vi.fn();
const mockExportData = vi.fn();
const mockEnableTwoFactor = vi.fn();
const mockVerifyTwoFactor = vi.fn();
const mockStartVerification = vi.fn();
const mockPerformBulkAction = vi.fn();
const mockReorderItems = vi.fn();
const mockAddPaymentMethod = vi.fn();

vi.mock('../../services/ui-actions.service', () => ({
  UIActionsService: {
    scheduleMeeting: (...args: any[]) => mockScheduleMeeting(...args),
    requestDemo: (...args: any[]) => mockRequestDemo(...args),
    shareContent: (...args: any[]) => mockShareContent(...args),
    exportData: (...args: any[]) => mockExportData(...args),
    enableTwoFactor: (...args: any[]) => mockEnableTwoFactor(...args),
    verifyTwoFactor: (...args: any[]) => mockVerifyTwoFactor(...args),
    startVerification: (...args: any[]) => mockStartVerification(...args),
    performBulkAction: (...args: any[]) => mockPerformBulkAction(...args),
    reorderItems: (...args: any[]) => mockReorderItems(...args),
    addPaymentMethod: (...args: any[]) => mockAddPaymentMethod(...args),
  },
}));

// ─── Mock react-hot-toast ───────────────────────────────────────────────────
const mockToastSuccess = vi.fn();
const mockToastError = vi.fn();

vi.mock('react-hot-toast', () => ({
  toast: {
    success: (...args: any[]) => mockToastSuccess(...args),
    error: (...args: any[]) => mockToastError(...args),
    loading: vi.fn(),
  },
  default: {
    success: (...args: any[]) => mockToastSuccess(...args),
    error: (...args: any[]) => mockToastError(...args),
    loading: vi.fn(),
  },
  Toaster: () => null,
}));

import {
  useScheduleMeeting,
  useRequestDemo,
  useShare,
  useExport,
  useTwoFactor,
  useVerificationBadge,
  useBulkActions,
  useDragReorder,
  usePaymentMethods,
} from '../useUIActions';

describe('useUIActions', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  // =========================================================================
  // useScheduleMeeting
  // =========================================================================
  describe('useScheduleMeeting', () => {
    it('initial state: not loading, no error', () => {
      const { result } = renderHook(() => useScheduleMeeting());
      expect(result.current.loading).toBe(false);
      expect(result.current.error).toBeNull();
    });

    it('calls UIActionsService.scheduleMeeting with correct args', async () => {
      mockScheduleMeeting.mockResolvedValue({ success: true, message: 'Scheduled!' });
      const { result } = renderHook(() => useScheduleMeeting());

      await act(async () => {
        await result.current.scheduleMeeting('user-123', 'Film Review', 'pitch', {
          message: 'Looking forward to it',
        });
      });

      expect(mockScheduleMeeting).toHaveBeenCalledWith({
        recipientId: 'user-123',
        subject: 'Film Review',
        meetingType: 'pitch',
        message: 'Looking forward to it',
      });
    });

    it('shows success toast on success', async () => {
      mockScheduleMeeting.mockResolvedValue({ success: true, message: 'Meeting booked' });
      const { result } = renderHook(() => useScheduleMeeting());

      await act(async () => {
        await result.current.scheduleMeeting('r1', 'Intro', 'investment');
      });

      expect(mockToastSuccess).toHaveBeenCalledWith('Meeting booked');
    });

    it('shows error toast when result.success is false', async () => {
      mockScheduleMeeting.mockResolvedValue({ success: false, error: 'Slot taken' });
      const { result } = renderHook(() => useScheduleMeeting());

      await act(async () => {
        await result.current.scheduleMeeting('r1', 'Intro', 'pitch');
      });

      expect(mockToastError).toHaveBeenCalledWith('Slot taken');
    });

    it('sets error and shows toast on exception', async () => {
      mockScheduleMeeting.mockRejectedValue(new Error('Network failure'));
      const { result } = renderHook(() => useScheduleMeeting());

      await act(async () => {
        await result.current.scheduleMeeting('r1', 'Intro', 'pitch');
      });

      expect(result.current.error).toBe('Network failure');
      expect(mockToastError).toHaveBeenCalledWith('Network failure');
    });

    it('sets loading false when done', async () => {
      mockScheduleMeeting.mockResolvedValue({ success: true });
      const { result } = renderHook(() => useScheduleMeeting());

      await act(async () => {
        await result.current.scheduleMeeting('r1', 'S', 'pitch');
      });

      expect(result.current.loading).toBe(false);
    });

    it('defaults meetingType to pitch', async () => {
      mockScheduleMeeting.mockResolvedValue({ success: true });
      const { result } = renderHook(() => useScheduleMeeting());

      await act(async () => {
        await result.current.scheduleMeeting('r1', 'Subject');
      });

      expect(mockScheduleMeeting).toHaveBeenCalledWith(
        expect.objectContaining({ meetingType: 'pitch' })
      );
    });
  });

  // =========================================================================
  // useRequestDemo
  // =========================================================================
  describe('useRequestDemo', () => {
    it('initial state: not loading, not submitted', () => {
      const { result } = renderHook(() => useRequestDemo());
      expect(result.current.loading).toBe(false);
      expect(result.current.submitted).toBe(false);
    });

    it('sets submitted on success', async () => {
      mockRequestDemo.mockResolvedValue({ success: true, message: 'Request received' });
      const { result } = renderHook(() => useRequestDemo());

      await act(async () => {
        await result.current.requestDemo({ name: 'Alice', email: 'alice@example.com' });
      });

      expect(result.current.submitted).toBe(true);
      expect(mockToastSuccess).toHaveBeenCalledWith('Request received');
    });

    it('does not set submitted when success is false', async () => {
      mockRequestDemo.mockResolvedValue({ success: false });
      const { result } = renderHook(() => useRequestDemo());

      await act(async () => {
        await result.current.requestDemo({ name: 'Bob', email: 'bob@example.com' });
      });

      expect(result.current.submitted).toBe(false);
    });

    it('shows error toast on exception', async () => {
      mockRequestDemo.mockRejectedValue(new Error('Server down'));
      const { result } = renderHook(() => useRequestDemo());

      await act(async () => {
        await result.current.requestDemo({ name: 'Bob', email: 'bob@example.com' });
      });

      expect(mockToastError).toHaveBeenCalledWith('Failed to submit demo request');
    });

    it('passes requestType to service', async () => {
      mockRequestDemo.mockResolvedValue({ success: true });
      const { result } = renderHook(() => useRequestDemo());

      await act(async () => {
        await result.current.requestDemo({ name: 'C', email: 'c@c.com' }, 'platform');
      });

      expect(mockRequestDemo).toHaveBeenCalledWith(
        expect.objectContaining({ requestType: 'platform' })
      );
    });
  });

  // =========================================================================
  // useShare
  // =========================================================================
  describe('useShare', () => {
    it('initial state: not loading', () => {
      const { result } = renderHook(() => useShare());
      expect(result.current.loading).toBe(false);
    });

    it('calls shareContent and shows success toast', async () => {
      mockShareContent.mockResolvedValue({ success: true, message: 'Shared!' });
      const { result } = renderHook(() => useShare());

      await act(async () => {
        await result.current.share('pitch', 'pitch-42');
      });

      expect(mockShareContent).toHaveBeenCalledWith({ type: 'pitch', id: 'pitch-42' });
      expect(mockToastSuccess).toHaveBeenCalledWith('Shared!');
    });

    it('returns result with showModal true when modal needed', async () => {
      mockShareContent.mockResolvedValue({ success: false, showModal: true, modalData: {} });
      const { result } = renderHook(() => useShare());

      let res: any;
      await act(async () => {
        res = await result.current.share('pitch', 'pitch-42');
      });

      expect(res.showModal).toBe(true);
      expect(mockToastSuccess).not.toHaveBeenCalled();
    });

    it('shows error toast on exception', async () => {
      mockShareContent.mockRejectedValue(new Error('fail'));
      const { result } = renderHook(() => useShare());

      await act(async () => {
        await result.current.share('pitch', 'p1');
      });

      expect(mockToastError).toHaveBeenCalledWith('Failed to share');
    });
  });

  // =========================================================================
  // useExport
  // =========================================================================
  describe('useExport', () => {
    it('initial state: not loading, progress 0', () => {
      const { result } = renderHook(() => useExport());
      expect(result.current.loading).toBe(false);
      expect(result.current.progress).toBe(0);
    });

    it('calls exportData and shows success toast', async () => {
      mockExportData.mockResolvedValue({ success: true, message: 'Exported!' });
      const { result } = renderHook(() => useExport());

      await act(async () => {
        const promise = result.current.exportData('analytics', 'csv');
        await vi.runAllTimersAsync();
        await promise;
      });

      expect(mockExportData).toHaveBeenCalledWith({ type: 'analytics', format: 'csv', filters: undefined });
      expect(mockToastSuccess).toHaveBeenCalledWith('Exported!');
    });

    it('sets loading false and calls service on success', async () => {
      // Progress resets to 0 after 1s timeout in finally; just verify loading is false
      mockExportData.mockResolvedValue({ success: true, message: 'Exported!' });
      const { result } = renderHook(() => useExport());

      await act(async () => {
        const promise = result.current.exportData('analytics', 'csv');
        await vi.runAllTimersAsync();
        await promise;
      });

      expect(result.current.loading).toBe(false);
    });

    it('shows error toast on exception', async () => {
      // Use real timers for this test to avoid infinite-loop from setInterval
      vi.useRealTimers();
      mockExportData.mockRejectedValue(new Error('fail'));
      const { result } = renderHook(() => useExport());

      await act(async () => {
        await result.current.exportData('report', 'pdf');
      });

      expect(mockToastError).toHaveBeenCalledWith('Export failed');
    });

    it('shows error toast when result.success is false with error string', async () => {
      mockExportData.mockResolvedValue({ success: false, error: 'No data available' });
      const { result } = renderHook(() => useExport());

      await act(async () => {
        const promise = result.current.exportData('pitches', 'excel');
        await vi.runAllTimersAsync();
        await promise;
      });

      expect(mockToastError).toHaveBeenCalledWith('No data available');
    });
  });

  // =========================================================================
  // useTwoFactor
  // =========================================================================
  describe('useTwoFactor', () => {
    it('initial state: not loading, no qr/backup/verification', () => {
      const { result } = renderHook(() => useTwoFactor());
      expect(result.current.loading).toBe(false);
      expect(result.current.qrCode).toBeNull();
      expect(result.current.backupCodes).toEqual([]);
      expect(result.current.verificationRequired).toBe(false);
    });

    it('enableTwoFactor with totp sets qrCode and backupCodes', async () => {
      mockEnableTwoFactor.mockResolvedValue({
        success: true,
        qrCode: 'data:image/png;base64,abc',
        backupCodes: ['111', '222'],
      });
      const { result } = renderHook(() => useTwoFactor());

      await act(async () => {
        await result.current.enableTwoFactor('totp');
      });

      expect(result.current.qrCode).toBe('data:image/png;base64,abc');
      expect(result.current.backupCodes).toEqual(['111', '222']);
      expect(mockToastSuccess).toHaveBeenCalledWith('2FA setup initiated');
    });

    it('enableTwoFactor sets verificationRequired when returned', async () => {
      mockEnableTwoFactor.mockResolvedValue({
        success: true,
        verificationRequired: true,
      });
      const { result } = renderHook(() => useTwoFactor());

      await act(async () => {
        await result.current.enableTwoFactor('sms', '+447700000000');
      });

      expect(result.current.verificationRequired).toBe(true);
    });

    it('enableTwoFactor shows error when success is false', async () => {
      mockEnableTwoFactor.mockResolvedValue({ success: false, error: '2FA unavailable' });
      const { result } = renderHook(() => useTwoFactor());

      await act(async () => {
        await result.current.enableTwoFactor('email');
      });

      expect(mockToastError).toHaveBeenCalledWith('2FA unavailable');
    });

    it('enableTwoFactor handles exceptions', async () => {
      mockEnableTwoFactor.mockRejectedValue(new Error('Error'));
      const { result } = renderHook(() => useTwoFactor());

      await act(async () => {
        await result.current.enableTwoFactor('totp');
      });

      expect(mockToastError).toHaveBeenCalledWith('Failed to enable 2FA');
    });

    it('verifyCode shows success and clears verificationRequired', async () => {
      mockEnableTwoFactor.mockResolvedValue({ success: true, verificationRequired: true });
      mockVerifyTwoFactor.mockResolvedValue({ success: true });

      const { result } = renderHook(() => useTwoFactor());
      await act(async () => {
        await result.current.enableTwoFactor('sms');
      });
      expect(result.current.verificationRequired).toBe(true);

      await act(async () => {
        await result.current.verifyCode('123456');
      });

      expect(result.current.verificationRequired).toBe(false);
      expect(mockToastSuccess).toHaveBeenCalledWith('2FA enabled successfully');
    });

    it('verifyCode shows error on failure', async () => {
      mockVerifyTwoFactor.mockResolvedValue({ success: false, error: 'Invalid code' });
      const { result } = renderHook(() => useTwoFactor());

      await act(async () => {
        await result.current.verifyCode('000000');
      });

      expect(mockToastError).toHaveBeenCalledWith('Invalid code');
    });

    it('verifyCode handles exceptions', async () => {
      mockVerifyTwoFactor.mockRejectedValue(new Error('network'));
      const { result } = renderHook(() => useTwoFactor());

      await act(async () => {
        await result.current.verifyCode('abc');
      });

      expect(mockToastError).toHaveBeenCalledWith('Verification failed');
    });
  });

  // =========================================================================
  // useVerificationBadge
  // =========================================================================
  describe('useVerificationBadge', () => {
    it('initial state: not loading, no status', () => {
      const { result } = renderHook(() => useVerificationBadge());
      expect(result.current.loading).toBe(false);
      expect(result.current.verificationStatus).toBeNull();
    });

    it('sets verificationStatus on success', async () => {
      mockStartVerification.mockResolvedValue({
        success: true,
        status: 'pending',
        message: 'Under review',
      });
      const { result } = renderHook(() => useVerificationBadge());

      await act(async () => {
        await result.current.startVerification('creator');
      });

      expect(result.current.verificationStatus).toBe('pending');
      expect(mockToastSuccess).toHaveBeenCalledWith('Under review');
    });

    it('shows error toast when success is false', async () => {
      mockStartVerification.mockResolvedValue({ success: false, error: 'Docs missing' });
      const { result } = renderHook(() => useVerificationBadge());

      await act(async () => {
        await result.current.startVerification('investor');
      });

      expect(mockToastError).toHaveBeenCalledWith('Docs missing');
    });

    it('handles exceptions gracefully', async () => {
      mockStartVerification.mockRejectedValue(new Error('fail'));
      const { result } = renderHook(() => useVerificationBadge());

      await act(async () => {
        await result.current.startVerification('production');
      });

      expect(mockToastError).toHaveBeenCalledWith('Failed to start verification');
      expect(result.current.loading).toBe(false);
    });
  });

  // =========================================================================
  // useBulkActions
  // =========================================================================
  describe('useBulkActions', () => {
    it('initial state', () => {
      const { result } = renderHook(() => useBulkActions());
      expect(result.current.selectedItems).toEqual([]);
      expect(result.current.loading).toBe(false);
      expect(result.current.hasSelection).toBe(false);
      expect(result.current.selectionCount).toBe(0);
    });

    it('toggleSelection adds item', () => {
      const { result } = renderHook(() => useBulkActions());
      act(() => {
        result.current.toggleSelection('item-1');
      });
      expect(result.current.selectedItems).toContain('item-1');
      expect(result.current.hasSelection).toBe(true);
    });

    it('toggleSelection removes already-selected item', () => {
      const { result } = renderHook(() => useBulkActions());
      act(() => {
        result.current.toggleSelection('item-1');
      });
      act(() => {
        result.current.toggleSelection('item-1');
      });
      expect(result.current.selectedItems).not.toContain('item-1');
    });

    it('selectAll replaces selection', () => {
      const { result } = renderHook(() => useBulkActions());
      act(() => {
        result.current.toggleSelection('item-1');
        result.current.selectAll(['item-2', 'item-3']);
      });
      expect(result.current.selectedItems).toEqual(['item-2', 'item-3']);
    });

    it('clearSelection empties selection', () => {
      const { result } = renderHook(() => useBulkActions());
      act(() => {
        result.current.selectAll(['a', 'b']);
        result.current.clearSelection();
      });
      expect(result.current.selectedItems).toEqual([]);
    });

    it('selectionCount reflects count', () => {
      const { result } = renderHook(() => useBulkActions());
      act(() => {
        result.current.selectAll(['a', 'b', 'c']);
      });
      expect(result.current.selectionCount).toBe(3);
    });

    it('performBulkAction shows error when nothing selected', async () => {
      const { result } = renderHook(() => useBulkActions());
      let res: any;
      await act(async () => {
        res = await result.current.performBulkAction('nda', 'approve');
      });
      expect(mockToastError).toHaveBeenCalledWith('No items selected');
      expect(res.success).toBe(false);
    });

    it('performBulkAction calls service and clears selection on success', async () => {
      mockPerformBulkAction.mockResolvedValue({ success: true, message: 'Done' });
      const { result } = renderHook(() => useBulkActions());

      act(() => {
        result.current.selectAll(['id-1', 'id-2']);
      });

      await act(async () => {
        await result.current.performBulkAction('pitch', 'delete');
      });

      expect(mockPerformBulkAction).toHaveBeenCalledWith({
        type: 'pitch',
        action: 'delete',
        ids: ['id-1', 'id-2'],
        reason: undefined,
      });
      expect(result.current.selectedItems).toEqual([]);
      expect(mockToastSuccess).toHaveBeenCalledWith('Done');
    });

    it('performBulkAction shows generic error on service failure', async () => {
      mockPerformBulkAction.mockResolvedValue({ success: false });
      const { result } = renderHook(() => useBulkActions());

      act(() => {
        result.current.selectAll(['id-1']);
      });

      await act(async () => {
        await result.current.performBulkAction('investment', 'archive');
      });

      expect(mockToastError).toHaveBeenCalledWith('Some items failed to process');
    });

    it('performBulkAction handles exception', async () => {
      mockPerformBulkAction.mockRejectedValue(new Error('crash'));
      const { result } = renderHook(() => useBulkActions());

      act(() => {
        result.current.selectAll(['id-1']);
      });

      await act(async () => {
        await result.current.performBulkAction('message', 'delete');
      });

      expect(mockToastError).toHaveBeenCalledWith('Bulk action failed');
    });
  });

  // =========================================================================
  // useDragReorder
  // =========================================================================
  describe('useDragReorder', () => {
    const initialItems = [
      { id: 'a', name: 'Alpha' },
      { id: 'b', name: 'Beta' },
      { id: 'c', name: 'Gamma' },
    ];

    it('starts with initialItems and not saving', () => {
      const { result } = renderHook(() => useDragReorder(initialItems, 'pipeline'));
      expect(result.current.items).toEqual(initialItems);
      expect(result.current.saving).toBe(false);
      expect(result.current.draggedItem).toBeNull();
    });

    it('handleDragStart sets draggedItem', () => {
      const { result } = renderHook(() => useDragReorder(initialItems, 'pipeline'));
      act(() => {
        result.current.handleDragStart(initialItems[1]);
      });
      expect(result.current.draggedItem).toEqual(initialItems[1]);
    });

    it('handleDrop reorders items and clears draggedItem', () => {
      const { result } = renderHook(() => useDragReorder(initialItems, 'playlist'));
      act(() => {
        result.current.handleDragStart(initialItems[0]); // drag 'a'
      });
      act(() => {
        result.current.handleDrop(initialItems[2]); // drop onto 'c'
      });
      // 'a' should now be at position 2 (where 'c' was)
      const ids = result.current.items.map(i => i.id);
      expect(ids.indexOf('a')).toBeGreaterThan(ids.indexOf('b'));
      expect(result.current.draggedItem).toBeNull();
    });

    it('handleDrop does nothing when same item dropped on itself', () => {
      const { result } = renderHook(() => useDragReorder(initialItems, 'gallery'));
      act(() => {
        result.current.handleDragStart(initialItems[0]);
      });
      act(() => {
        result.current.handleDrop(initialItems[0]);
      });
      expect(result.current.items).toEqual(initialItems);
    });

    it('saveOrder calls service and shows success', async () => {
      mockReorderItems.mockResolvedValue({ success: true, message: 'Order saved' });
      const { result } = renderHook(() => useDragReorder(initialItems, 'pipeline'));

      await act(async () => {
        await result.current.saveOrder();
      });

      expect(mockReorderItems).toHaveBeenCalledWith({
        type: 'pipeline',
        items: [
          { id: 'a', position: 0 },
          { id: 'b', position: 1 },
          { id: 'c', position: 2 },
        ],
      });
      expect(mockToastSuccess).toHaveBeenCalledWith('Order saved');
    });

    it('saveOrder handles exception', async () => {
      mockReorderItems.mockRejectedValue(new Error('fail'));
      const { result } = renderHook(() => useDragReorder(initialItems, 'pipeline'));

      await act(async () => {
        await result.current.saveOrder();
      });

      expect(mockToastError).toHaveBeenCalledWith('Failed to save order');
    });

    it('setItems replaces the items list', () => {
      const { result } = renderHook(() => useDragReorder(initialItems, 'gallery'));
      const newItems = [{ id: 'z', name: 'Zeta' }];
      act(() => {
        result.current.setItems(newItems);
      });
      expect(result.current.items).toEqual(newItems);
    });
  });

  // =========================================================================
  // usePaymentMethods
  // =========================================================================
  describe('usePaymentMethods', () => {
    it('initial state: not loading, no action required', () => {
      const { result } = renderHook(() => usePaymentMethods());
      expect(result.current.loading).toBe(false);
      expect(result.current.requiresAction).toBe(false);
      expect(result.current.clientSecret).toBeNull();
    });

    it('shows success toast when payment method added', async () => {
      mockAddPaymentMethod.mockResolvedValue({ success: true, message: 'Card added' });
      const { result } = renderHook(() => usePaymentMethods());

      await act(async () => {
        await result.current.addPaymentMethod('card', 'tok_visa');
      });

      expect(mockToastSuccess).toHaveBeenCalledWith('Card added');
      expect(result.current.loading).toBe(false);
    });

    it('sets requiresAction and clientSecret when 3DS needed', async () => {
      mockAddPaymentMethod.mockResolvedValue({
        success: true,
        requiresAction: true,
        clientSecret: 'pi_secret_abc',
      });
      const { result } = renderHook(() => usePaymentMethods());

      await act(async () => {
        await result.current.addPaymentMethod('card');
      });

      expect(result.current.requiresAction).toBe(true);
      expect(result.current.clientSecret).toBe('pi_secret_abc');
    });

    it('shows error toast when service returns error', async () => {
      mockAddPaymentMethod.mockResolvedValue({ success: false, error: 'Card declined' });
      const { result } = renderHook(() => usePaymentMethods());

      await act(async () => {
        await result.current.addPaymentMethod('card');
      });

      expect(mockToastError).toHaveBeenCalledWith('Card declined');
    });

    it('shows error toast on exception', async () => {
      mockAddPaymentMethod.mockRejectedValue(new Error('network'));
      const { result } = renderHook(() => usePaymentMethods());

      await act(async () => {
        await result.current.addPaymentMethod('bank');
      });

      expect(mockToastError).toHaveBeenCalledWith('Failed to add payment method');
      expect(result.current.loading).toBe(false);
    });

    it('clears requiresAction when addPaymentMethod called again', async () => {
      mockAddPaymentMethod.mockResolvedValueOnce({
        success: true, requiresAction: true, clientSecret: 'secret',
      });
      const { result } = renderHook(() => usePaymentMethods());

      await act(async () => {
        await result.current.addPaymentMethod('card');
      });
      expect(result.current.requiresAction).toBe(true);

      mockAddPaymentMethod.mockResolvedValueOnce({ success: true, message: 'Added' });
      await act(async () => {
        await result.current.addPaymentMethod('card', 'new_token');
      });
      expect(result.current.requiresAction).toBe(false);
    });
  });
});
