import React, { useState } from 'react';
import { Lock, Eye, EyeOff } from 'lucide-react';

interface PasswordInputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  /** Tailwind classes for the <input> itself. Leave room on the right (pr-10) for the toggle. */
  inputClassName?: string;
}

/**
 * Password field with a leading lock icon and a trailing show/hide ("eye") toggle.
 * Drop-in replacement for the repeated `relative` + Lock + `<input type="password">`
 * block used across the auth pages.
 */
export default function PasswordInput({ inputClassName = '', ...rest }: PasswordInputProps) {
  const [show, setShow] = useState(false);

  return (
    <div className="mt-1 relative">
      <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
        <Lock className="h-5 w-5 text-gray-400" />
      </div>
      <input {...rest} type={show ? 'text' : 'password'} className={inputClassName} />
      <button
        type="button"
        onClick={() => setShow((s) => !s)}
        tabIndex={-1}
        aria-label={show ? 'Hide password' : 'Show password'}
        className="absolute inset-y-0 right-0 pr-3 flex items-center text-gray-400 hover:text-gray-600 focus:outline-none"
      >
        {show ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
      </button>
    </div>
  );
}
