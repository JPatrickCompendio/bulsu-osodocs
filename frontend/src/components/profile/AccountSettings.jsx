import React, { useState, useEffect, useMemo } from 'react';
import { Check, Info, UserRound, Loader2, Plus, X } from 'lucide-react';
import { SectionCard } from './SectionCard';

const inputClass =
  'w-full rounded-lg border border-line bg-white px-3 py-2.5 text-sm text-ink outline-none transition-colors duration-150 placeholder:text-ink-faint focus:border-forest-400 focus:ring-2 focus:ring-forest-100';

const parseCoAdvisersList = (raw) => {
  if (Array.isArray(raw)) return raw.filter(Boolean);
  if (typeof raw === 'string' && raw.trim()) {
    try {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) return parsed.filter(Boolean);
      return [raw.trim()];
    } catch {
      return raw.split(',').map((s) => s.trim()).filter(Boolean);
    }
  }
  return [];
};

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
  const [studentNumber, setStudentNumber] = useState(account.studentNumber && account.studentNumber !== 'N/A' ? account.studentNumber : '');
  const [noMember, setNoMember] = useState(account.noMember != null ? String(account.noMember) : '');
  const [adviserName, setAdviserName] = useState(account.adviserName || '');
  const [coAdvisers, setCoAdvisers] = useState(parseCoAdvisersList(account.coAdvisers));
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    setFullName(account.fullName || '');
    setAbbreviation(initialAbbr || '');
    setContactNumber(account.contactNumber || '');
    setStudentNumber(account.studentNumber && account.studentNumber !== 'N/A' ? account.studentNumber : '');
    setNoMember(account.noMember != null ? String(account.noMember) : '');
    setAdviserName(account.adviserName || '');
    setCoAdvisers(parseCoAdvisersList(account.coAdvisers));
  }, [
    account.fullName,
    account.contactNumber,
    account.studentNumber,
    account.noMember,
    account.adviserName,
    account.coAdvisers,
    initialAbbr
  ]);

  const isDirty = useMemo(() => {
    if (!isPresident) return false;
    const nameChanged = fullName.trim() !== (account.fullName || '').trim();
    const abbrChanged = isOrg && abbreviation.trim() !== (initialAbbr || '').trim();
    const contactChanged = contactNumber.trim() !== (account.contactNumber || '').trim();
    const origStudentNo = account.studentNumber && account.studentNumber !== 'N/A' ? account.studentNumber : '';
    const studentNoChanged = isOrg && studentNumber.trim() !== origStudentNo.trim();
    const origNoMember = account.noMember != null ? String(account.noMember) : '';
    const noMemberChanged = isOrg && noMember.trim() !== origNoMember.trim();
    const adviserChanged = isOrg && adviserName.trim() !== (account.adviserName || '').trim();

    const currCoAdvs = coAdvisers.map((s) => s.trim()).filter(Boolean);
    const origCoAdvs = parseCoAdvisersList(account.coAdvisers).map((s) => s.trim()).filter(Boolean);
    const coAdvsChanged = isOrg && JSON.stringify(currCoAdvs) !== JSON.stringify(origCoAdvs);

    return (
      nameChanged ||
      abbrChanged ||
      contactChanged ||
      studentNoChanged ||
      noMemberChanged ||
      adviserChanged ||
      coAdvsChanged
    );
  }, [
    isPresident,
    fullName,
    abbreviation,
    contactNumber,
    studentNumber,
    noMember,
    adviserName,
    coAdvisers,
    account,
    initialAbbr,
    isOrg
  ]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!isPresident || !isDirty || isSaving) return;

    if (onSave) {
      const success = await onSave({
        fullName: fullName.trim(),
        abbreviation: abbreviation.trim(),
        contactNumber: contactNumber.trim(),
        studentNumber: studentNumber.trim(),
        noMember: noMember.trim() !== '' ? parseInt(noMember.trim(), 10) : null,
        adviserName: adviserName.trim(),
        coAdvisers: coAdvisers.map((s) => s.trim()).filter(Boolean),
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
          ? "Official organization, Organization President, and academic year details for the current term."
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
            <p className="mt-1.5 flex items-start gap-1.5 text-xs text-ink-faint">
              <Info className="mt-px h-3.5 w-3.5 shrink-0" aria-hidden="true" />
              Official account login email.
            </p>
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
              maxLength={11}
              className={!isPresident ? `${inputClass} bg-canvas cursor-not-allowed opacity-85` : inputClass}
              readOnly={!isPresident}
              value={contactNumber}
              onChange={(e) => {
                if (!isPresident) return;
                setContactNumber(e.target.value.replace(/[^\d]/g, ''));
                setSaved(false);
              }}
              placeholder="e.g. 09123456789"
              autoComplete="tel"
            />
            <p className="mt-1.5 flex items-start gap-1.5 text-xs text-ink-faint">
              <Info className="mt-px h-3.5 w-3.5 shrink-0" aria-hidden="true" />
              11-digit mobile number starting with 09.
            </p>
          </div>

          {isOrg && (
            <>
              <div>
                <label
                  htmlFor="studentNumber"
                  className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-ink-faint"
                >
                  Student number
                </label>
                <input
                  id="studentNumber"
                  type="text"
                  className={!isPresident ? `${inputClass} bg-canvas cursor-not-allowed opacity-85` : inputClass}
                  readOnly={!isPresident}
                  value={studentNumber}
                  onChange={(e) => {
                    if (!isPresident) return;
                    setStudentNumber(e.target.value);
                    setSaved(false);
                  }}
                  placeholder="e.g. 2023200438"
                />
                <p className="mt-1.5 flex items-start gap-1.5 text-xs text-ink-faint">
                  <Info className="mt-px h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                  President&apos;s student number for the active academic year.
                </p>
              </div>

              <div>
                <label
                  htmlFor="noMember"
                  className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-ink-faint"
                >
                  Active Members Count
                </label>
                <input
                  id="noMember"
                  type="text"
                  className={!isPresident ? `${inputClass} bg-canvas cursor-not-allowed opacity-85` : inputClass}
                  readOnly={!isPresident}
                  value={noMember}
                  onChange={(e) => {
                    if (!isPresident) return;
                    setNoMember(e.target.value.replace(/[^\d]/g, ''));
                    setSaved(false);
                  }}
                  placeholder="e.g. 50"
                />
                <p className="mt-1.5 flex items-start gap-1.5 text-xs text-ink-faint">
                  <Info className="mt-px h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                  Total registered members for current academic year.
                </p>
              </div>

              <div className="sm:col-span-2">
                <label
                  htmlFor="adviserName"
                  className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-ink-faint"
                >
                  Primary Faculty Adviser
                </label>
                <input
                  id="adviserName"
                  type="text"
                  className={!isPresident ? `${inputClass} bg-canvas cursor-not-allowed opacity-85` : inputClass}
                  readOnly={!isPresident}
                  value={adviserName}
                  onChange={(e) => {
                    if (!isPresident) return;
                    setAdviserName(e.target.value);
                    setSaved(false);
                  }}
                  placeholder="e.g. Prof. Juan Dela Cruz"
                />
                <p className="mt-1.5 flex items-start gap-1.5 text-xs text-ink-faint">
                  <Info className="mt-px h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                  Official faculty adviser recognized for this academic year.
                </p>
              </div>

              <div className="sm:col-span-2 space-y-3 pt-1">
                <div className="flex items-center justify-between">
                  <label className="block text-xs font-semibold uppercase tracking-wide text-ink-faint">
                    Co-Advisers (Optional)
                  </label>
                  {isPresident && (
                    <button
                      type="button"
                      onClick={() => {
                        setCoAdvisers([...coAdvisers, '']);
                        setSaved(false);
                      }}
                      className="text-xs font-bold text-forest-700 hover:text-forest-800 flex items-center gap-1 transition-colors cursor-pointer"
                    >
                      <Plus size={14} /> Add Co-Adviser
                    </button>
                  )}
                </div>

                {coAdvisers.length === 0 && (
                  <p className="text-xs text-ink-faint italic bg-canvas rounded-lg p-3 border border-dashed border-line">
                    No co-advisers added yet. Click &ldquo;+ Add Co-Adviser&rdquo; if your organization has co-advisers.
                  </p>
                )}

                {coAdvisers.map((coAdv, idx) => (
                  <div key={idx} className="flex gap-2 items-center animate-in fade-in zoom-in duration-150">
                    <input
                      type="text"
                      className={!isPresident ? `${inputClass} bg-canvas cursor-not-allowed opacity-85` : inputClass}
                      readOnly={!isPresident}
                      placeholder={`Co-Adviser ${idx + 1} Name (e.g. Engr. Maria Santos)`}
                      value={coAdv}
                      onChange={(e) => {
                        if (!isPresident) return;
                        const updated = [...coAdvisers];
                        updated[idx] = e.target.value;
                        setCoAdvisers(updated);
                        setSaved(false);
                      }}
                    />
                    {isPresident && (
                      <button
                        type="button"
                        onClick={() => {
                          const updated = coAdvisers.filter((_, i) => i !== idx);
                          setCoAdvisers(updated);
                          setSaved(false);
                        }}
                        className="p-2.5 text-danger-500 hover:bg-danger-50 rounded-lg transition-colors shrink-0 cursor-pointer"
                        title="Remove co-adviser"
                      >
                        <X size={16} />
                      </button>
                    )}
                  </div>
                ))}
              </div>
            </>
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

