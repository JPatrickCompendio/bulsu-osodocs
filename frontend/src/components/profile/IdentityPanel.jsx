import React, { useRef } from 'react';
import { 
  CalendarDays, 
  Hash, 
  Mail, 
  Phone, 
  Camera, 
  Loader2 
} from 'lucide-react';
import Avatar from '../Avatar';

export function IdentityPanel({
  account = {},
  organization = {},
  onImageUpload,
  isUploadingImage = false,
  canEditImage = true,
  showStudentNumber = true,
  isOrg = true,
}) {
  const fileInputRef = useRef(null);

  const formatPosition = () => {
    if (!account.position) return '';
    if (!isOrg) return account.position;
    const abbr = organization?.abbreviation;
    if (abbr && !account.position.toLowerCase().includes(abbr.toLowerCase())) {
      return `${account.position}, ${abbr}`;
    }
    return account.position;
  };

  const rows = [
    { label: 'Email address', value: account.email || '—', icon: Mail },
    ...(showStudentNumber && isOrg && account.studentNumber && account.studentNumber !== 'N/A'
      ? [{ label: 'Student number', value: account.studentNumber, icon: Hash }]
      : []),
    { label: 'Contact number', value: account.contactNumber || 'N/A', icon: Phone },
    { label: 'Active since', value: account.activeSince || 'N/A', icon: CalendarDays },
  ];

  return (
    <aside className="overflow-hidden rounded-2xl border border-line bg-white shadow-card">
      <div className="flex flex-col items-center bg-forest-900 px-6 pb-6 pt-8 text-center relative group">
        <div className="relative h-24 w-24 rounded-full overflow-hidden ring-4 ring-white/20 mb-4 bg-forest-800 flex items-center justify-center shadow-md">
          <Avatar
            profileImage={account.profileImage || organization?.crestUrl}
            name={account.fullName || organization?.name || 'User'}
            className="h-full w-full object-cover"
            fallbackClassName="bg-forest-700 text-white text-2xl font-bold flex items-center justify-center h-full w-full"
          />

          {/* Photo upload overlay */}
          {canEditImage && (
            <label 
              className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity duration-200 flex flex-col items-center justify-center cursor-pointer backdrop-blur-xs text-white"
              title={isOrg ? "Upload new organization crest or photo" : "Upload new profile photo"}
            >
              <input
                type="file"
                ref={fileInputRef}
                className="hidden"
                accept="image/png, image/jpeg, image/jpg, image/webp"
                onChange={onImageUpload}
                disabled={isUploadingImage}
              />
              {isUploadingImage ? (
                <Loader2 className="animate-spin text-white" size={18} />
              ) : (
                <div className="flex flex-col items-center gap-1">
                  <Camera size={16} />
                  <span className="text-[9px] font-bold uppercase tracking-wider">Change</span>
                </div>
              )}
            </label>
          )}
        </div>

        <p className="text-xl font-bold leading-tight text-white">
          {account.fullName}
        </p>
        <p className="mt-1 text-sm font-medium text-white/80">
          {formatPosition()}
        </p>

        {account.isActive ? (
          <p className="mt-3 inline-flex items-center gap-1.5 rounded-full bg-white/10 px-2.5 py-1 text-xs font-semibold text-forest-200">
            <span className="h-1.5 w-1.5 rounded-full bg-forest-300 animate-pulse" />
            {account.badgeText || (isOrg ? 'Active officer' : 'Active')}
          </p>
        ) : (
          <p className="mt-3 inline-flex items-center rounded-full bg-white/10 px-2.5 py-1 text-xs font-medium text-white/60">
            Inactive
          </p>
        )}
      </div>

      <dl className="px-6 py-5">
        {rows.map(({ label, value, icon: Icon }) => (
          <div
            key={label}
            className="flex items-start gap-3 border-b border-line/70 py-3 first:pt-0 last:border-b-0 last:pb-0"
          >
            <Icon
              className="mt-0.5 h-4 w-4 shrink-0 text-ink-faint"
              aria-hidden="true"
            />
            <div className="min-w-0 flex-1">
              <dt className="text-xs font-semibold uppercase tracking-wide text-ink-faint">
                {label}
              </dt>
              <dd className="mt-0.5 break-words text-sm font-medium text-ink">{value}</dd>
            </div>
          </div>
        ))}
      </dl>
    </aside>
  );
}

export default IdentityPanel;
