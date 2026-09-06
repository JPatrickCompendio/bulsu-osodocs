import React, { useState } from 'react';
import { KeyRound, Loader2, Check } from 'lucide-react';
import { SectionCard } from './SectionCard';

const inputClass =
  'w-full rounded-lg border border-line bg-white px-3 py-2.5 text-sm text-ink outline-none transition-colors duration-150 placeholder:text-ink-faint focus:border-forest-400 focus:ring-2 focus:ring-forest-100';

export function SecurityPanel({ onChangePassword, isSaving = false, isPresident = true }) {
  const [current, setCurrent] = useState('');
  const [next, setNext] = useState('');
  const [confirm, setConfirm] = useState('');
  const [status, setStatus] = useState('idle'); // 'idle' | 'error' | 'success'
  const [message, setMessage] = useState('');

  if (!isPresident) {
    return null;
  }

  const handleSubmit = async (event) => {
    event.preventDefault();

    if (!current || !next || !confirm) {
      setStatus('error');
      setMessage('Fill in all three fields to change the password.');
      return;
    }
    if (next.length < 6) {
      setStatus('error');
      setMessage('The new password must be at least 6 characters.');
      return;
    }
    if (next !== confirm) {
      setStatus('error');
      setMessage('The new passwords do not match.');
      return;
    }

    if (onChangePassword) {
      try {
        setStatus('idle');
        const res = await onChangePassword({
          currentPassword: current,
          newPassword: next,
          confirmPassword: confirm,
        });

        if (res?.success) {
          setStatus('success');
          setMessage('Password updated successfully. Use it at your next sign-in.');
          setCurrent('');
          setNext('');
          setConfirm('');
        } else {
          setStatus('error');
          setMessage(res?.error || 'Failed to update password.');
        }
      } catch (err) {
        setStatus('error');
        setMessage(err.message || 'Failed to update password.');
      }
    }
  };

  return (
    <SectionCard
      title="Password"
      description="Change it whenever access was shared with an outgoing officer."
      icon={<KeyRound className="h-5 w-5" />}
    >
      <form onSubmit={handleSubmit} noValidate>
        <div className="grid gap-5 sm:grid-cols-3">
          <div>
            <label
              htmlFor="currentPassword"
              className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-ink-faint"
            >
              Current password
            </label>
            <input
              id="currentPassword"
              type="password"
              className={inputClass}
              value={current}
              onChange={(event) => {
                setCurrent(event.target.value);
                setStatus('idle');
              }}
              autoComplete="current-password"
              placeholder="••••••••"
              required
            />
          </div>

          <div>
            <label
              htmlFor="newPassword"
              className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-ink-faint"
            >
              New password
            </label>
            <input
              id="newPassword"
              type="password"
              className={inputClass}
              value={next}
              onChange={(event) => {
                setNext(event.target.value);
                setStatus('idle');
              }}
              autoComplete="new-password"
              aria-describedby="newPasswordHint"
              placeholder="••••••••"
              required
            />
            <p id="newPasswordHint" className="mt-1.5 text-xs text-ink-faint">
              Minimum 6 characters.
            </p>
          </div>

          <div>
            <label
              htmlFor="confirmPassword"
              className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-ink-faint"
            >
              Confirm new password
            </label>
            <input
              id="confirmPassword"
              type="password"
              className={inputClass}
              value={confirm}
              onChange={(event) => {
                setConfirm(event.target.value);
                setStatus('idle');
              }}
              autoComplete="new-password"
              placeholder="••••••••"
              required
            />
          </div>
        </div>

        <div className="mt-6 flex flex-wrap items-center justify-end gap-3 border-t border-line pt-5">
          {status !== 'idle' && (
            <p
              role="status"
              aria-live="polite"
              className={`flex-1 text-sm font-medium ${
                status === 'error' ? 'text-danger-600' : 'text-forest-600 flex items-center gap-1.5'
              }`}
            >
              {status === 'success' && <Check className="h-4 w-4" />}
              {message}
            </p>
          )}

          <button
            type="submit"
            disabled={isSaving || !current || !next || !confirm}
            className="inline-flex items-center gap-2 rounded-lg bg-forest-600 px-4 py-2.5 text-sm font-semibold text-white transition-colors duration-150 hover:bg-forest-700 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-forest-500 disabled:cursor-not-allowed disabled:bg-forest-100 disabled:text-forest-300 cursor-pointer shadow-2xs"
          >
            {isSaving && <Loader2 className="animate-spin h-4 w-4" />}
            Update password
          </button>
        </div>
      </form>
    </SectionCard>
  );
}

export default SecurityPanel;
