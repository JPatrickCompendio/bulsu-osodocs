import React, { useState, useEffect } from 'react';
import { Check, Info, UserRound, Loader2 } from 'lucide-react';
import { SectionCard } from './SectionCard';

const inputClass =
  'w-full rounded-lg border border-line bg-white px-3 py-2.5 text-sm text-ink outline-none transition-colors duration-150 placeholder:text-ink-faint focus:border-forest-400 focus:ring-2 focus:ring-forest-100';

export function AccountSettings({
  account,
  abbreviation: initialAbbr = '',
  isOrg = true,
  isPresident = true,
  onSave,
  isSaving = false,
}) {
  const [fullName, setFullName] = useState(account.fullName || '');
  const [abbreviation, setAbbreviation] = useState(initialAbbr || '');
  const [contactNumber, setContactNumber] = useState(account.contactNumber || '');
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    setFullName(account.fullName || '');
    setAbbreviation(initialAbbr || '');
    setContactNumber(account.contactNumber || '');
  }, [account.fullName, account.contactNumber, initialAbbr]);

  const isDirty =
    isPresident &&
    (fullName.trim() !== (account.fullName || '').trim() ||
    (isOrg && abbreviation.trim() !== (initialAbbr || '').trim()) ||
    contactNumber.trim() !== (account.contactNumber || '').trim());

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!isPresident || !isDirty || isSaving) return;

    if (onSave) {
      const success = await onSave({
        fullName: fullName.trim(),
        abbreviation: abbreviation.trim(),
        contactNumber: contactNumber.trim(),
      });
      if (success) {
        setSaved(true);
        setTimeout(() => setSaved(false), 4000);
      }
    }
  };

  return (
    <SectionCard
      title="Account details"
      description={
        isOrg
          ? "Official organization and Organization President details for the current academic year."
          : "Manage your personal information and contact details."
      }
      icon={<UserRound className="h-5 w-5" />}
    >
      <form onSubmit={handleSubmit} noValidate>
        {!isPresident && isOrg && (
          <div className="mb-5 rounded-xl border border-line bg-canvas p-3.5 flex items-start gap-2.5 text-xs text-ink-muted">
            <Info className="h-4 w-4 text-forest-600 shrink-0 mt-0.5" />
            <div>
              <p className="font-semibold text-ink">Organization President Details (View Only)</p>
              <p className="mt-0.5 text-ink-muted">
                These credentials belong to the Organization President for this academic year. Active officers cannot edit organization account details.
              </p>
            </div>
          </div>
        )}

        <div className="grid gap-5 sm:grid-cols-2">
          <div className="sm:col-span-2">
            <label
              htmlFor="fullName"
              className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-ink-faint"
            >
              Full name
            </label>
            <input
              id="fullName"
              className={!isPresident ? `${inputClass} bg-canvas cursor-not-allowed opacity-85` : inputClass}
              readOnly={!isPresident}
              value={fullName}
              onChange={(e) => {
                if (!isPresident) return;
                setFullName(e.target.value);
                setSaved(false);
              }}
              autoComplete="name"
              placeholder="e.g. Juan Dela Cruz"
              required
            />
            <p className="mt-1.5 flex items-start gap-1.5 text-xs text-ink-faint">
              <Info
                className="mt-px h-3.5 w-3.5 shrink-0"
                aria-hidden="true"
              />
              {isOrg ? "Appears on verified documents and approval logs as the Organization President." : "Appears on verified documents and approval logs."}
            </p>
          </div>

          {isOrg && (
            <div className="sm:col-span-2">
              <label
                htmlFor="abbreviation"
                className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-ink-faint"
              >
                Organization abbreviation
              </label>
              <input
                id="abbreviation"
                maxLength={15}
                className={!isPresident ? `${inputClass} bg-canvas cursor-not-allowed opacity-85` : inputClass}
                readOnly={!isPresident}
                value={abbreviation}
                onChange={(e) => {
                  if (!isPresident) return;
                  setAbbreviation(e.target.value.toUpperCase());
                  setSaved(false);
                }}
                placeholder="e.g. ASICS"
              />
              <p className="mt-1.5 flex items-start gap-1.5 text-xs text-ink-faint">
                <Info
                  className="mt-px h-3.5 w-3.5 shrink-0"
                  aria-hidden="true"
                />
                Used to generate your official document tracking numbers (max 15 characters).
              </p>
            </div>
          )}

          <div>
            <label
              htmlFor="email"
              className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-ink-faint"
            >
              Email address
            </label>
            <input
              id="email"
              type="email"
              readOnly
              className={`${inputClass} bg-canvas cursor-not-allowed opacity-85`}
              value={account.email || ''}
              autoComplete="email"
            />
          </div>

          <div>
            <label
              htmlFor="contactNumber"
              className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-ink-faint"
            >
              Contact number
            </label>
            <input
              id="contactNumber"
              type="tel"
              className={!isPresident ? `${inputClass} bg-canvas cursor-not-allowed opacity-85` : inputClass}
              readOnly={!isPresident}
              value={contactNumber}
              onChange={(e) => {
                if (!isPresident) return;
                setContactNumber(e.target.value);
                setSaved(false);
              }}
              placeholder="e.g. 09123456789"
              autoComplete="tel"
            />
          </div>

          {isOrg && (
            <div className="sm:col-span-2">
              <p className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-ink-faint">
                Student number
              </p>
              <p className="rounded-lg border border-dashed border-line bg-canvas px-3 py-2.5 text-sm text-ink-muted">
                {account.studentNumber || 'N/A'}
                <span className="ml-2 text-xs text-ink-faint">
                  &middot; Registrar-issued &middot; cannot be edited
                </span>
              </p>
            </div>
          )}
        </div>

        {isPresident && (
          <div className="mt-6 flex items-center justify-end gap-3 border-t border-line pt-5">
            <p
              className="text-sm font-medium text-forest-600"
              role="status"
              aria-live="polite"
            >
              {saved ? (
                <span className="inline-flex items-center gap-1.5">
                  <Check className="h-4 w-4 text-forest-600" aria-hidden="true" />
                  Changes saved
                </span>
              ) : null}
            </p>

            <button
              type="submit"
              disabled={!isDirty || isSaving}
              className="inline-flex items-center gap-2 rounded-lg bg-forest-600 px-4 py-2.5 text-sm font-semibold text-white transition-colors duration-150 hover:bg-forest-700 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-forest-500 disabled:cursor-not-allowed disabled:bg-forest-100 disabled:text-forest-300 cursor-pointer shadow-2xs"
            >
              {isSaving && <Loader2 className="animate-spin h-4 w-4" />}
              Save changes
            </button>
          </div>
        )}
      </form>
    </SectionCard>
  );
}

export default AccountSettings;
