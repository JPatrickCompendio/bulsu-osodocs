import React from 'react';
import { ShieldCheck } from 'lucide-react';

export function OrgProfileHeader({
  organizationAbbreviation,
  academicYear,
}) {
  return (
    <header className="border-b border-line bg-white mb-8 -mx-4 sm:-mx-6 -mt-4 sm:-mt-6">
      <div className="mx-auto flex max-w-6xl flex-wrap items-end justify-between gap-4 px-6 py-7">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-forest-800">
            My Profile
          </h1>
          <p className="mt-1 text-sm text-ink-muted">
            Your account, your organization&rsquo;s details, and the leadership history behind it.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">

          {(organizationAbbreviation || academicYear) && (
            <p className="flex items-center gap-2 rounded-full border border-forest-100 bg-forest-50 px-3.5 py-1.5 text-xs font-semibold text-forest-700 shadow-2xs">
              <ShieldCheck className="h-4 w-4 text-forest-600" aria-hidden="true" />
              <span>
                {organizationAbbreviation}
                {organizationAbbreviation && academicYear ? ' \u00B7 ' : ''}
                {academicYear}
              </span>
            </p>
          )}
        </div>
      </div>
    </header>
  );
}

export default OrgProfileHeader;
