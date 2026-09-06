import React from 'react';

export function SectionCard({
  title,
  description,
  icon,
  action,
  children,
  as: Tag = 'section',
  className = '',
}) {
  return (
    <Tag className={`rounded-2xl border border-line bg-white shadow-card ${className}`}>
      <div className="flex flex-wrap items-start justify-between gap-4 border-b border-line px-6 py-5">
        <div className="flex min-w-0 items-start gap-3">
          {icon ? (
            <span className="mt-0.5 text-forest-500 shrink-0" aria-hidden="true">
              {icon}
            </span>
          ) : null}
          <div className="min-w-0">
            <h2 className="text-base font-semibold tracking-tight text-forest-700">
              {title}
            </h2>
            {description ? (
              <p className="mt-1 max-w-xl text-sm leading-relaxed text-ink-muted">
                {description}
              </p>
            ) : null}
          </div>
        </div>
        {action ? <div className="shrink-0">{action}</div> : null}
      </div>
      <div className="px-6 py-5">{children}</div>
    </Tag>
  );
}

export default SectionCard;
