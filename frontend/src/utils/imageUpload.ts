import imageCompression from 'browser-image-compression';

export type ImagePreset = 'avatar' | 'cover';

const PRESETS: Record<ImagePreset, { maxWidthOrHeight: number; maxSizeMB: number }> = {
  avatar: { maxWidthOrHeight: 512, maxSizeMB: 1 },
  cover: { maxWidthOrHeight: 1920, maxSizeMB: 1.5 },
};

// Generous pre-compression sanity check — anything bigger almost certainly
// isn't a real image, and we don't want to read 100MB into a Web Worker.
export const PRE_COMPRESSION_MAX_BYTES = 30 * 1024 * 1024;

export async function prepareImageForUpload(file: File, preset: ImagePreset): Promise<File> {
  let working = file;

  if (await isHeic(file)) {
    const heic2any = (await import('heic2any')).default;
    const out = await heic2any({ blob: file, toType: 'image/jpeg', quality: 0.9 });
    const blob = Array.isArray(out) ? out[0] : out;
    working = new File(
      [blob],
      file.name.replace(/\.(heic|heif)$/i, '.jpg') || 'image.jpg',
      { type: 'image/jpeg' },
    );
  }

  return imageCompression(working, {
    ...PRESETS[preset],
    useWebWorker: true,
    fileType: 'image/jpeg',
    initialQuality: 0.85,
  });
}

// HEIC detection: extension first (cheap), MIME next, magic bytes last.
// Magic bytes live at offset 4 in the ftyp box. Brands that mean HEIC/HEIF:
// heic, heix, heim, heis, hevc, hevm, hevs, mif1, msf1.
async function isHeic(file: File): Promise<boolean> {
  if (/\.(heic|heif)$/i.test(file.name)) return true;
  if (file.type === 'image/heic' || file.type === 'image/heif') return true;
  try {
    const head = await file.slice(0, 12).arrayBuffer();
    const bytes = new Uint8Array(head);
    if (bytes.length < 12) return false;
    // 'ftyp' at offset 4
    if (bytes[4] !== 0x66 || bytes[5] !== 0x74 || bytes[6] !== 0x79 || bytes[7] !== 0x70) return false;
    const brand = String.fromCharCode(bytes[8], bytes[9], bytes[10], bytes[11]);
    return ['heic', 'heix', 'heim', 'heis', 'hevc', 'hevm', 'hevs', 'mif1', 'msf1'].includes(brand);
  } catch {
    return false;
  }
}
