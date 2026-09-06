import React from 'react';
import { Pencil, Plus, Trash2, Users } from 'lucide-react';
import { getInitials } from '../../utils/initials';

export function BoardRoster({
  academicYear,
  members = [],
  editable = true,
  isPresident = true,
  onAddOfficer,
  onEditOfficer,
  onDeleteOfficer,
}) {
  return (
    <section className="rounded-2xl border border-line bg-white shadow-card">
      <div className="flex flex-wrap items-start justify-between gap-4 border-b border-line px-6 py-5">
        <div className="flex items-start gap-3">
          <Users
            className="mt-0.5 h-5 w-5 text-forest-500 shrink-0"
            aria-hidden="true"
          />
          <div>
            <h2 className="text-base font-semibold tracking-tight text-forest-700">
              Executive board
            </h2>
            <p className="mt-1 text-sm text-ink-muted">
              {academicYear} &middot; {members.length} {members.length === 1 ? 'officer' : 'officers'} on record
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          {editable && isPresident ? (
            <button
              type="button"
              onClick={onAddOfficer}
              className="inline-flex items-center gap-1.5 rounded-lg border border-forest-200 bg-white px-3 py-2 text-sm font-semibold text-forest-600 transition-colors duration-150 hover:bg-forest-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-forest-500 shadow-2xs cursor-pointer"
            >
              <Plus className="h-4 w-4" aria-hidden="true" />
              Add officer
            </button>
          ) : !editable ? (
            <span className="rounded-full bg-canvas border border-line px-2.5 py-1 text-xs font-medium text-ink-muted">
              Archived roster
            </span>
          ) : null}
        </div>
      </div>

      <ul className="divide-y divide-line">
        {members.map((member) => {
          const subText = member.email || member.student_number || member.contact_number || '';
          return (
            <li key={member.id} className="flex items-center gap-4 px-6 py-3.5 hover:bg-canvas/50 transition-colors">
              <span
                className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-forest-50 text-xs font-semibold text-forest-600 border border-forest-100"
                aria-hidden="true"
              >
                {getInitials(member.name || member.full_name)}
              </span>

              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium text-ink">
                  {member.name || member.full_name}
                </p>
                {subText ? (
                  <p className="truncate text-xs text-ink-faint">
                    {member.student_number ? `SN: ${member.student_number}` : subText}
                    {member.contact_number && member.student_number ? ` · ${member.contact_number}` : ''}
                  </p>
                ) : null}
              </div>

              <p className="hidden w-56 shrink-0 text-sm font-medium text-ink-muted sm:block">
                {member.position}
              </p>

              {editable && isPresident ? (
                <div className="flex shrink-0 items-center gap-1">
                  <button
                    type="button"
                    onClick={() => onEditOfficer && onEditOfficer(member)}
                    aria-label={`Edit ${member.name || member.full_name}`}
                    className="rounded-md p-2 text-ink-faint transition-colors duration-150 hover:bg-canvas hover:text-forest-600 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-forest-500 cursor-pointer"
                  >
                    <Pencil className="h-4 w-4" />
                  </button>
                  <button
                    type="button"
                    onClick={() => onDeleteOfficer && onDeleteOfficer(member.id)}
                    aria-label={`Remove ${member.name || member.full_name}`}
                    className="rounded-md p-2 text-ink-faint transition-colors duration-150 hover:bg-danger-50 hover:text-danger-600 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-danger-500 cursor-pointer"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              ) : null}
            </li>
          );
        })}
      </ul>

      {members.length === 0 ? (
        <p className="px-6 py-10 text-center text-sm text-ink-faint">
          No officers recorded for this term yet.
        </p>
      ) : null}
    </section>
  );
}

export default BoardRoster;
