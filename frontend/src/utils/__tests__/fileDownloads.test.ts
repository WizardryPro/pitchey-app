import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { convertToDownloadableUrl, handleFileDownload, createDownloadClickHandler } from '../fileDownloads';

// ─── Mock ../config ──────────────────────────────────────────────────────────
vi.mock('../../config', () => ({
  getApiUrl: () => 'http://localhost:8001',
}));

// ─── Helpers ──────────────────────────────────────────────────────────────────
const mockWindowOpen = vi.fn();
const mockAlert = vi.fn();
const mockFetch = vi.fn();

beforeEach(() => {
  vi.stubGlobal('open', mockWindowOpen);
  vi.stubGlobal('alert', mockAlert);
  vi.stubGlobal('fetch', mockFetch);
  mockWindowOpen.mockClear();
  mockAlert.mockClear();
  mockFetch.mockClear();
});

afterEach(() => {
  vi.unstubAllGlobals();
});

// ============================================================================
// convertToDownloadableUrl
// ============================================================================
describe('convertToDownloadableUrl', () => {
  it('returns HTTP URL unchanged', async () => {
    const url = 'http://example.com/file.pdf';
    expect(await convertToDownloadableUrl(url)).toBe(url);
  });

  it('returns HTTPS URL unchanged', async () => {
    const url = 'https://cdn.example.com/image.jpg';
    expect(await convertToDownloadableUrl(url)).toBe(url);
  });

  it('converts a valid r2:// URL to an API endpoint', async () => {
    const r2Url = 'r2://pitches/226/script_final.pdf';
    const result = await convertToDownloadableUrl(r2Url);
    expect(result).toBe('http://localhost:8001/api/pitches/226/attachments/script_final.pdf');
  });

  it('converts r2:// URL with nested path', async () => {
    const r2Url = 'r2://pitches/42/docs/script.pdf';
    const result = await convertToDownloadableUrl(r2Url);
    expect(result).toBe('http://localhost:8001/api/pitches/42/attachments/docs/script.pdf');
  });

  it('returns original for r2:// URL with wrong bucket', async () => {
    const r2Url = 'r2://avatars/user1/photo.jpg';
    const result = await convertToDownloadableUrl(r2Url);
    // Not a "pitches" bucket → falls back to original URL
    expect(result).toBe(r2Url);
  });

  it('returns original for r2:// URL with insufficient path parts', async () => {
    const r2Url = 'r2://pitches/onlyOneSegment';
    const result = await convertToDownloadableUrl(r2Url);
    expect(result).toBe(r2Url);
  });

  it('returns original URL for unknown scheme', async () => {
    const url = 'blob://some-blob-url';
    expect(await convertToDownloadableUrl(url)).toBe(url);
  });
});

// ============================================================================
// handleFileDownload — HTTP URL (direct open)
// ============================================================================
describe('handleFileDownload - direct HTTP URL', () => {
  it('opens direct HTTP URL without fetch', async () => {
    const url = 'https://example.com/file.pdf';
    await handleFileDownload(url, 'file.pdf');
    expect(mockFetch).not.toHaveBeenCalled();
    expect(mockWindowOpen).toHaveBeenCalledWith(url, '_blank');
  });
});

// ============================================================================
// handleFileDownload — API URL (fetches presigned URL)
// ============================================================================
describe('handleFileDownload - API endpoint (r2:// url)', () => {
  it('fetches presigned URL and opens it on success', async () => {
    const presignedUrl = 'https://r2-presigned.example.com/file.pdf';
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ success: true, data: { downloadUrl: presignedUrl } }),
    });

    await handleFileDownload('r2://pitches/226/script.pdf', 'script.pdf');

    expect(mockFetch).toHaveBeenCalledWith(
      'http://localhost:8001/api/pitches/226/attachments/script.pdf',
      expect.objectContaining({ method: 'GET', credentials: 'include' })
    );
    expect(mockWindowOpen).toHaveBeenCalledWith(presignedUrl, '_blank');
    expect(mockAlert).not.toHaveBeenCalled();
  });

  it('alerts when API response is not ok', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 404,
    });

    await handleFileDownload('r2://pitches/226/missing.pdf', 'missing.pdf');

    expect(mockAlert).toHaveBeenCalledWith(expect.stringContaining('missing.pdf'));
    expect(mockWindowOpen).not.toHaveBeenCalled();
  });

  it('alerts when success flag is false in response', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ success: false, error: 'File not found' }),
    });

    await handleFileDownload('r2://pitches/1/bad.pdf', 'bad.pdf');

    expect(mockAlert).toHaveBeenCalledWith(expect.stringContaining('bad.pdf'));
    expect(mockWindowOpen).not.toHaveBeenCalled();
  });

  it('alerts when fetch throws', async () => {
    mockFetch.mockRejectedValueOnce(new Error('Network error'));

    await handleFileDownload('r2://pitches/1/crash.pdf', 'crash.pdf');

    expect(mockAlert).toHaveBeenCalledWith(expect.stringContaining('crash.pdf'));
  });

  it('alerts with generic message when fileName is not provided', async () => {
    mockFetch.mockRejectedValueOnce(new Error('Network error'));

    await handleFileDownload('r2://pitches/1/crash.pdf');

    expect(mockAlert).toHaveBeenCalledWith(expect.stringContaining('file'));
  });
});

// ============================================================================
// createDownloadClickHandler
// ============================================================================
describe('createDownloadClickHandler', () => {
  it('returns a function', () => {
    const handler = createDownloadClickHandler('https://example.com/file.pdf', 'file.pdf');
    expect(typeof handler).toBe('function');
  });

  it('calls event.preventDefault and triggers download', async () => {
    const presignedUrl = 'https://cdn.example.com/download.pdf';
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ success: true, data: { downloadUrl: presignedUrl } }),
    });

    const handler = createDownloadClickHandler('r2://pitches/42/doc.pdf', 'doc.pdf');
    const mockEvent = { preventDefault: vi.fn() } as any;

    handler(mockEvent);

    expect(mockEvent.preventDefault).toHaveBeenCalled();
  });
});
