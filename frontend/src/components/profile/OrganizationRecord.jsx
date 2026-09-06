import React from 'react';
import { Building2, Lock, UserCheck } from 'lucide-react';
import { SectionCard } from './SectionCard';

export function OrganizationRecord({ organization, term }) {
  const advisers = term?.advisers || [];

  return (
    <SectionCard
      title="Organization details"
      description="Maintained by the Office of Student Affairs. Request a correction if anything here is out of date."
      icon={<Building2 className="h-5 w-5" />}
      action={
        <span className="inline-flex items-center gap-1.5 rounded-full bg-canvas px-2.5 py-1 text-xs font-medium text-ink-muted border border-line">
          <Lock className="h-3.5 w-3.5" aria-hidden="true" />
          Read only
        </span>
      }
    >
      <div className="flex flex-wrap items-baseline gap-x-3 gap-y-2">
        <h3 className="text-xl font-semibold leading-snug tracking-tight text-forest-800">
          {organization.name || 'Organization Name'}
        </h3>
        {organization.abbreviation && (
          <span className="rounded-md bg-forest-50 border border-forest-100 px-2 py-0.5 text-sm font-semibold text-forest-600">
            {organization.abbreviation}
          </span>
        )}
      </div>

      {organization.college && (
        <p className="mt-1.5 text-sm text-ink-muted">{organization.college}</p>
      )}
      {organization.officialEmail && (
        <p className="text-sm text-ink-muted">{organization.officialEmail}</p>
      )}

      <div className="mt-6 grid gap-6 border-t border-line pt-5 sm:grid-cols-[auto_1fr] sm:gap-10">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-ink-faint">
            Active members
          </p>
          <p className="mt-1 text-3xl font-bold tabular-nums leading-none text-forest-700">
            {term?.memberCount ?? 0}
          </p>
          <p className="mt-1.5 text-xs text-ink-faint">
            as of {term?.shortYear || 'Current Term'}
          </p>
        </div>

        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-ink-faint">
            Faculty advisers
          </p>
          {advisers.length > 0 ? (
            <ul className="mt-2 space-y-2">
              {advisers.map((adviser, idx) => (
                <li key={idx} className="flex items-start gap-2.5">
                  <UserCheck
                    className="mt-0.5 h-4 w-4 shrink-0 text-forest-500"
                    aria-hidden="true"
                  />
                  <span className="text-sm text-ink font-medium">
                    {adviser.name}
                    {adviser.role && (
                      <span className="ml-2 text-xs text-ink-faint font-normal">
                        ({adviser.role})
                      </span>
                    )}
                  </span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="mt-2 text-xs text-ink-faint italic">No faculty advisers on record</p>
          )}
        </div>
      </div>
    </SectionCard>
  );
}

export default OrganizationRecord;
