import { describe, it, expect, vi, beforeEach } from 'vitest';
import { prepareImageForUpload, PRE_COMPRESSION_MAX_BYTES } from '../imageUpload';

// ─── Mock browser-image-compression ─────────────────────────────────────────
const mockCompression = vi.fn();
vi.mock('browser-image-compression', () => ({
  default: (...args: any[]) => mockCompression(...args),
}));

// ─── Mock heic2any (dynamic import) ─────────────────────────────────────────
const mockHeic2any = vi.fn();
vi.mock('heic2any', () => ({
  default: (...args: any[]) => mockHeic2any(...args),
}));

// ─── Helpers ─────────────────────────────────────────────────────────────────
function makeFile(name: string, type: string, content: ArrayBuffer | string = 'x'): File {
  const blob = typeof content === 'string'
    ? new Blob([content], { type })
    : new Blob([content], { type });
  return new File([blob], name, { type });
}


beforeEach(() => {
  mockCompression.mockReset();
  mockHeic2any.mockReset();
  // Default: compression returns the input file
  mockCompression.mockImplementation((file: File) => Promise.resolve(file));
});

// ============================================================================
// PRE_COMPRESSION_MAX_BYTES
// ============================================================================
describe('PRE_COMPRESSION_MAX_BYTES', () => {
  it('equals 30MB in bytes', () => {
    expect(PRE_COMPRESSION_MAX_BYTES).toBe(30 * 1024 * 1024);
  });
});

// ============================================================================
// prepareImageForUpload — JPEG file (non-HEIC)
// ============================================================================
describe('prepareImageForUpload - standard JPEG', () => {
  it('calls imageCompression with avatar preset', async () => {
    const file = makeFile('photo.jpg', 'image/jpeg');
    await prepareImageForUpload(file, 'avatar');

    expect(mockCompression).toHaveBeenCalledWith(
      file,
      expect.objectContaining({
        maxWidthOrHeight: 512,
        maxSizeMB: 1,
        useWebWorker: true,
        fileType: 'image/jpeg',
        initialQuality: 0.85,
      })
    );
  });

  it('calls imageCompression with cover preset', async () => {
    const file = makeFile('banner.jpg', 'image/jpeg');
    await prepareImageForUpload(file, 'cover');

    expect(mockCompression).toHaveBeenCalledWith(
      file,
      expect.objectContaining({
        maxWidthOrHeight: 1920,
        maxSizeMB: 1.5,
      })
    );
  });

  it('returns the result from imageCompression', async () => {
    const inputFile = makeFile('input.jpg', 'image/jpeg');
    const outputFile = makeFile('output.jpg', 'image/jpeg', 'compressed');
    mockCompression.mockResolvedValueOnce(outputFile);

    const result = await prepareImageForUpload(inputFile, 'avatar');
    expect(result).toBe(outputFile);
  });

  it('does not call heic2any for JPEG files', async () => {
    const file = makeFile('photo.jpg', 'image/jpeg');
    await prepareImageForUpload(file, 'avatar');
    expect(mockHeic2any).not.toHaveBeenCalled();
  });

  it('does not call heic2any for PNG files', async () => {
    const file = makeFile('image.png', 'image/png');
    await prepareImageForUpload(file, 'avatar');
    expect(mockHeic2any).not.toHaveBeenCalled();
  });
});

// ============================================================================
// prepareImageForUpload — HEIC file (by extension)
// ============================================================================
describe('prepareImageForUpload - HEIC file by extension', () => {
  it('converts .heic file via heic2any before compression', async () => {
    const heicFile = makeFile('photo.heic', 'image/jpeg');
    const convertedBlob = new Blob(['jpeg-data'], { type: 'image/jpeg' });
    mockHeic2any.mockResolvedValueOnce(convertedBlob);

    await prepareImageForUpload(heicFile, 'avatar');

    expect(mockHeic2any).toHaveBeenCalledWith(
      expect.objectContaining({ blob: heicFile, toType: 'image/jpeg', quality: 0.9 })
    );
    // compression should be called with the converted file
    expect(mockCompression).toHaveBeenCalledWith(
      expect.objectContaining({ name: 'photo.jpg', type: 'image/jpeg' }),
      expect.any(Object)
    );
  });

  it('converts .heif file via heic2any', async () => {
    const heifFile = makeFile('photo.heif', 'image/heif');
    const convertedBlob = new Blob(['jpeg-data'], { type: 'image/jpeg' });
    mockHeic2any.mockResolvedValueOnce(convertedBlob);

    await prepareImageForUpload(heifFile, 'cover');

    expect(mockHeic2any).toHaveBeenCalled();
  });

  it('handles heic2any returning an array of blobs', async () => {
    const heicFile = makeFile('photo.heic', 'image/heic');
    const convertedBlob = new Blob(['jpeg-data'], { type: 'image/jpeg' });
    mockHeic2any.mockResolvedValueOnce([convertedBlob, convertedBlob]);

    await prepareImageForUpload(heicFile, 'avatar');

    // Should use first element of array
    expect(mockCompression).toHaveBeenCalled();
  });
});

// ============================================================================
// prepareImageForUpload — HEIC file by MIME type
// ============================================================================
describe('prepareImageForUpload - HEIC file by MIME type', () => {
  it('detects image/heic MIME type as HEIC', async () => {
    const file = makeFile('photo.dat', 'image/heic');
    const convertedBlob = new Blob(['jpeg-data'], { type: 'image/jpeg' });
    mockHeic2any.mockResolvedValueOnce(convertedBlob);

    await prepareImageForUpload(file, 'avatar');

    expect(mockHeic2any).toHaveBeenCalled();
  });

  it('detects image/heif MIME type as HEIC', async () => {
    const file = makeFile('photo.dat', 'image/heif');
    const convertedBlob = new Blob(['jpeg-data'], { type: 'image/jpeg' });
    mockHeic2any.mockResolvedValueOnce(convertedBlob);

    await prepareImageForUpload(file, 'cover');

    expect(mockHeic2any).toHaveBeenCalled();
  });
});

// Note: magic-bytes HEIC detection (ftyp box in raw bytes) cannot be reliably tested
// in jsdom because File.slice().arrayBuffer() does not faithfully reproduce binary
// content written into the File constructor in the jsdom environment.
// Extension (.heic/.heif) and MIME type (image/heic, image/heif) detection paths
// cover the vast majority of real-world cases and are tested above.
