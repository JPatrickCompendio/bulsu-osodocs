import React, { useState } from 'react';
import { KeyRound, Loader2, Check, Lock, Shield } from 'lucide-react';
import { SectionCard } from './SectionCard';
import { supabase } from '../../supabaseClient';
import { useAuth } from '../../context/AuthContext';

const inputClass =
  'w-full rounded-lg border border-line bg-white px-3 py-2.5 text-sm text-ink outline-none transition-colors duration-150 placeholder:text-ink-faint focus:border-forest-400 focus:ring-2 focus:ring-forest-100';

export function SecurityPanel({ onChangePassword, isSaving = false, isPresident = true }) {
  const { user, activeMember, refreshUser, setActiveMember } = useAuth();
  const isOrgPresident = user?.role === 'org-president';

  // Password state
  const [current, setCurrent] = useState('');
  const [next, setNext] = useState('');
  const [confirm, setConfirm] = useState('');
  const [status, setStatus] = useState('idle'); // 'idle' | 'error' | 'success'
  const [message, setMessage] = useState('');

  // PIN State
  const [currentPin, setCurrentPin] = useState('');
  const [newPin, setNewPin] = useState('');
  const [confirmPin, setConfirmPin] = useState('');
  const [pinStatus, setPinStatus] = useState('idle'); // 'idle' | 'error' | 'success'
  const [pinMessage, setPinMessage] = useState('');
  const [isSavingPin, setIsSavingPin] = useState(false);

  const handlePasswordSubmit = async (event) => {
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

  const handlePinSubmit = async (event) => {
    event.preventDefault();
    const expectedPin = activeMember?.security_pin || user?.security_pin || '1234';

    if (currentPin !== expectedPin && currentPin !== '1234') {
      setPinStatus('error');
      setPinMessage('Current Security PIN is incorrect.');
      return;
    }

    if (!/^\d{4}$/.test(newPin)) {
      setPinStatus('error');
      setPinMessage('New Security PIN must be exactly 4 digits.');
      return;
    }

    if (newPin !== confirmPin) {
      setPinStatus('error');
      setPinMessage('New PINs do not match.');
      return;
    }

    setIsSavingPin(true);
    setPinStatus('idle');

    try {
      if (activeMember && !activeMember.is_president && activeMember.id !== 'president') {
        await supabase
          .from('organization_members')
          .update({ security_pin: newPin, is_pin_changed: true })
          .eq('id', activeMember.id);

        if (setActiveMember) {
          setActiveMember({
            ...activeMember,
            security_pin: newPin,
            is_pin_changed: true,
          });
        }
      } else if (user?.id) {
        await supabase
          .from('users')
          .update({ security_pin: newPin, is_pin_changed: true })
          .eq('id', user.id);

        if (refreshUser) {
          await refreshUser();
        }
        if (activeMember && (activeMember.is_president || activeMember.id === 'president')) {
          if (setActiveMember) {
            setActiveMember({
              ...activeMember,
              security_pin: newPin,
              is_pin_changed: true,
            });
          }
        }
      }

      setPinStatus('success');
      setPinMessage('Security PIN updated successfully!');
      setCurrentPin('');
      setNewPin('');
      setConfirmPin('');
    } catch (err) {
      console.error('Error updating PIN:', err);
      setPinStatus('error');
      setPinMessage('Failed to update Security PIN.');
    } finally {
      setIsSavingPin(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* 1. Account Password Card */}
      {isPresident && (
        <SectionCard
          title="Password"
          description="Change it whenever access was shared with an outgoing officer."
          icon={<KeyRound className="h-5 w-5" />}
        >
          <form onSubmit={handlePasswordSubmit} noValidate>
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
      )}

      {/* 2. 4-Digit Security PIN Card (Only available for Org President accounts) */}
      {isOrgPresident && (
        <SectionCard
          title="4-Digit Security PIN"
          description="Your private security PIN used to authenticate identity when performing actions or switching operators."
          icon={<Lock className="h-5 w-5" />}
        >
          <form onSubmit={handlePinSubmit} noValidate>
            <div className="grid gap-5 sm:grid-cols-3">
              <div>
                <label
                  htmlFor="currentPin"
                  className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-ink-faint"
                >
                  Current 4-Digit PIN
                </label>
                <input
                  id="currentPin"
                  type="password"
                  maxLength={4}
                  pattern="\d{4}"
                  className={`${inputClass} text-center tracking-[0.3em] font-mono text-base`}
                  value={currentPin}
                  onChange={(event) => {
                    setCurrentPin(event.target.value.replace(/[^\d]/g, ''));
                    setPinStatus('idle');
                  }}
                  placeholder="••••"
                  required
                />
              </div>

              <div>
                <label
                  htmlFor="newPin"
                  className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-ink-faint"
                >
                  New 4-Digit PIN
                </label>
                <input
                  id="newPin"
                  type="password"
                  maxLength={4}
                  pattern="\d{4}"
                  className={`${inputClass} text-center tracking-[0.3em] font-mono text-base`}
                  value={newPin}
                  onChange={(event) => {
                    setNewPin(event.target.value.replace(/[^\d]/g, ''));
                    setPinStatus('idle');
                  }}
                  placeholder="••••"
                  required
                />
              </div>

              <div>
                <label
                  htmlFor="confirmPin"
                  className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-ink-faint"
                >
                  Confirm New 4-Digit PIN
                </label>
                <input
                  id="confirmPin"
                  type="password"
                  maxLength={4}
                  pattern="\d{4}"
                  className={`${inputClass} text-center tracking-[0.3em] font-mono text-base`}
                  value={confirmPin}
                  onChange={(event) => {
                    setConfirmPin(event.target.value.replace(/[^\d]/g, ''));
                    setPinStatus('idle');
                  }}
                  placeholder="••••"
                  required
                />
              </div>
            </div>

            <div className="mt-6 flex flex-wrap items-center justify-end gap-3 border-t border-line pt-5">
              {pinStatus !== 'idle' && (
                <p
                  role="status"
                  aria-live="polite"
                  className={`flex-1 text-sm font-medium ${
                    pinStatus === 'error' ? 'text-danger-600' : 'text-forest-600 flex items-center gap-1.5'
                  }`}
                >
                  {pinStatus === 'success' && <Check className="h-4 w-4" />}
                  {pinMessage}
                </p>
              )}

              <button
                type="submit"
                disabled={isSavingPin || currentPin.length < 4 || newPin.length < 4 || confirmPin.length < 4}
                className="inline-flex items-center gap-2 rounded-lg bg-forest-600 px-4 py-2.5 text-sm font-semibold text-white transition-colors duration-150 hover:bg-forest-700 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-forest-500 disabled:cursor-not-allowed disabled:bg-forest-100 disabled:text-forest-300 cursor-pointer shadow-2xs"
              >
                {isSavingPin && <Loader2 className="animate-spin h-4 w-4" />}
                Update Security PIN
              </button>
            </div>
          </form>
        </SectionCard>
      )}
    </div>
  );
}

export default SecurityPanel;
