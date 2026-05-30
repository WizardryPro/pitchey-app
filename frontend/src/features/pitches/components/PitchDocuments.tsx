import { FileText, Download } from 'lucide-react';

/**
 * Shared renderer for a pitch's downloadable attachments (script, pitch deck, etc.).
 *
 * Prefers the full `documents[]` array (one row per uploaded file from
 * `pitch_documents`); falls back to the legacy scalar slots (script/pitchDeck/
 * trailer) only when no documents[] rows exist, so old pitches still render and
 * new pitches don't show each file twice. Returns null when there's nothing to show.
 */
export interface PitchDocumentRow {
  id?: number | string;
  file_url?: string;
  url?: string;
  original_file_name?: string;
  file_name?: string;
  document_type?: string;
}

interface PitchDocumentsProps {
  documents?: PitchDocumentRow[];
  script?: string;
  pitchDeck?: string;
  trailer?: string;
  className?: string;
}

function DocRow({ url, label }: { url?: string; label: string }) {
  if (!url) return null;
  return (
    <a
      href={url}
      target="_blank"
      rel="noopener noreferrer"
      className="flex items-center justify-between p-2 hover:bg-gray-50 rounded"
    >
      <span className="flex items-center text-blue-600 min-w-0">
        <FileText className="h-4 w-4 mr-2 shrink-0" />
        <span className="truncate">{label}</span>
      </span>
      <Download className="h-4 w-4 text-gray-400 shrink-0" />
    </a>
  );
}

export default function PitchDocuments({
  documents = [],
  script,
  pitchDeck,
  trailer,
  className = '',
}: PitchDocumentsProps) {
  const docs = Array.isArray(documents) ? documents : [];
  const legacy = [
    script ? { label: 'Script', url: script } : null,
    pitchDeck ? { label: 'Pitch Deck', url: pitchDeck } : null,
    trailer ? { label: 'Trailer', url: trailer } : null,
  ].filter(Boolean) as Array<{ label: string; url: string }>;

  if (docs.length === 0 && legacy.length === 0) return null;

  return (
    <div className={`space-y-2 ${className}`}>
      {docs.length > 0
        ? docs.map((d, i) => (
            <DocRow
              key={d.id ?? i}
              url={d.file_url || d.url}
              label={d.original_file_name || d.file_name || d.document_type || 'Document'}
            />
          ))
        : legacy.map((l, i) => <DocRow key={i} url={l.url} label={l.label} />)}
    </div>
  );
}
