import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { OnboardingStepper } from '../OnboardingStepper';

describe('OnboardingStepper', () => {
  it('renders all three step labels', () => {
    render(<OnboardingStepper current={1} />);
    expect(screen.getByText('Create account')).toBeInTheDocument();
    expect(screen.getByText('Verify email')).toBeInTheDocument();
    expect(screen.getByText('Complete profile')).toBeInTheDocument();
  });

  it('marks the current step with aria-current="step"', () => {
    render(<OnboardingStepper current={2} />);
    const current = document.querySelector('[aria-current="step"]');
    expect(current).not.toBeNull();
    expect(current?.textContent).toContain('Verify email');
  });

  it('renders a check (not the number) for completed steps', () => {
    render(<OnboardingStepper current={3} />);
    // Steps 1 and 2 are done → their numerals should not be rendered as text.
    expect(screen.queryByText('1')).not.toBeInTheDocument();
    expect(screen.queryByText('2')).not.toBeInTheDocument();
    // Current step 3 still shows its numeral.
    expect(screen.getByText('3')).toBeInTheDocument();
  });

  it('exposes an accessible progress landmark', () => {
    render(<OnboardingStepper current={1} />);
    expect(screen.getByRole('navigation', { name: 'Sign-up progress' })).toBeInTheDocument();
  });
});
