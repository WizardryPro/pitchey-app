import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import NDAUploadSection, { type NDADocument } from '../NDAUploadSection';

// These targeted tests replace NDA-section coverage that previously lived in
// src/components/__tests__/PitchForm.test.tsx. The PitchForm-level tests could
// not reach NDAUploadSection's rendered output reliably through two layers
// (CreatePitch → DocumentUploadHub → NDAUploadSection). Testing the component
// directly is both more robust and more honest about the unit under test.

const { mockGetNDATemplates, mockSuccess, mockError } = vi.hoisted(() => ({
  mockGetNDATemplates: vi.fn(),
  mockSuccess: vi.fn(),
  mockError: vi.fn(),
}));

vi.mock('../../services/nda.service', () => ({
  NDAService: {
    getNDATemplates: (...args: unknown[]) => mockGetNDATemplates(...args),
  },
}));

vi.mock('@shared/components/feedback/ToastProvider', () => ({
  useToast: () => ({ success: mockSuccess, error: mockError }),
}));

vi.mock('@features/uploads/services/upload.service', () => ({
  uploadService: { uploadFile: vi.fn() },
}));

describe('NDAUploadSection', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetNDATemplates.mockResolvedValue({ templates: [] });
  });

  it('renders the NDA section heading', () => {
    render(<NDAUploadSection onChange={vi.fn()} />);
    expect(
      screen.getByRole('heading', { name: 'Non-Disclosure Agreement (NDA)' }),
    ).toBeInTheDocument();
  });

  it('renders all four NDA type options', () => {
    render(<NDAUploadSection onChange={vi.fn()} />);
    expect(screen.getByText('Use Platform Standard NDA')).toBeInTheDocument();
    expect(screen.getByText('Upload Custom NDA')).toBeInTheDocument();
    expect(screen.getByText('Select from Your Templates')).toBeInTheDocument();
    expect(screen.getByText('No NDA Required')).toBeInTheDocument();
  });

  it('fires onChange with ndaType=standard when Platform Standard NDA is picked', async () => {
    const onChange = vi.fn();
    const user = userEvent.setup();
    render(<NDAUploadSection onChange={onChange} />);

    await user.click(screen.getByRole('radio', { name: /Use Platform Standard NDA/i }));

    expect(onChange).toHaveBeenCalledWith(
      expect.objectContaining({ ndaType: 'standard', isCustom: false }),
    );
  });

  it('fires onChange with ndaType=custom when Upload Custom NDA is picked', async () => {
    const onChange = vi.fn();
    const user = userEvent.setup();
    render(<NDAUploadSection onChange={onChange} />);

    await user.click(screen.getByRole('radio', { name: /Upload Custom NDA/i }));

    expect(onChange).toHaveBeenCalledWith(
      expect.objectContaining({ ndaType: 'custom', isCustom: true }),
    );
  });

  it('fires onChange(null) when No NDA Required is picked', async () => {
    const onChange = vi.fn();
    const user = userEvent.setup();
    // Start with a non-none selection so "No NDA Required" is the state-changing click.
    const initialDoc: NDADocument = {
      id: 'pre',
      title: 'Platform Standard NDA',
      uploadStatus: 'completed',
      uploadProgress: 100,
      isCustom: false,
      ndaType: 'standard',
    };
    render(<NDAUploadSection ndaDocument={initialDoc} onChange={onChange} />);

    await user.click(screen.getByRole('radio', { name: /No NDA Required/i }));

    expect(onChange).toHaveBeenCalledWith(null);
  });

  it('reveals the custom upload area ("Choose PDF File") when ndaType is custom and no file yet', () => {
    const customDoc: NDADocument = {
      id: 'custom-1',
      title: 'Custom NDA Document',
      uploadStatus: 'idle',
      uploadProgress: 0,
      isCustom: true,
      ndaType: 'custom',
    };
    render(<NDAUploadSection ndaDocument={customDoc} onChange={vi.fn()} />);

    expect(screen.getByText('Choose PDF File')).toBeInTheDocument();
  });

  it('marks "No NDA Required" as disabled when required prop is true', () => {
    render(<NDAUploadSection onChange={vi.fn()} required />);
    // The component passes `disabled || required` to the none-radio only.
    const noneRadio = screen.getByRole('radio', { name: /No NDA Required/i });
    expect(noneRadio).toBeDisabled();
  });
});
