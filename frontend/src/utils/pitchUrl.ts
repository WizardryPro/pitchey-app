// Canonical path to a pitch's public view. Prefers the human slug
// (/pitch/the-last-frontier) and falls back to the numeric id (/pitch/213) when
// the slug isn't present on the object — so this is always safe to use, and old
// numeric links keep working because the backend resolves either form.
type PitchLike = {
  id?: number | string | null;
  slug?: string | null;
  pitch_id?: number | string | null;
  pitchId?: number | string | null;
};

export function pitchUrl(pitch: PitchLike | number | string | null | undefined): string {
  if (pitch != null && typeof pitch === 'object') {
    const id = pitch.id ?? pitch.pitch_id ?? pitch.pitchId;
    return `/pitch/${pitch.slug || id}`;
  }
  return `/pitch/${pitch ?? ''}`;
}
