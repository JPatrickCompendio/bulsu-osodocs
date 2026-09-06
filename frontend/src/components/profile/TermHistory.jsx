import React, { useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { ChevronDown, History } from 'lucide-react';

const easing = [0.23, 1, 0.32, 1];

export function TermHistory({ terms = [] }) {
  const [openId, setOpenId] = useState(null);

  if (!terms || terms.length === 0) {
    return null;
  }

  return (
    <section className="rounded-2xl border border-line bg-white shadow-card">
      <div className="flex items-start gap-3 border-b border-line px-6 py-5">
        <History
          className="mt-0.5 h-5 w-5 text-forest-500 shrink-0"
          aria-hidden="true"
        />
        <div>
          <h2 className="text-base font-semibold tracking-tight text-forest-700">
            Term history
          </h2>
          <p className="mt-1 max-w-xl text-sm leading-relaxed text-ink-muted">
            Every academic year on record &mdash; the president and their contact number, the advisers, the member count, and the officers as they stood that year.
          </p>
        </div>
      </div>

      <ol className="px-6 py-5">
        {terms.map((term, index) => {
          const isOpen = openId === term.id;
          const isCurrent = term.status === 'current';
          const isLast = index === terms.length - 1;
          const president = term.president || {};
          const advisers = term.advisers || [];
          const board = term.board || [];

          return (
            <li key={term.id} className="relative pl-8">
              {!isLast ? (
                <span
                  className="absolute bottom-0 left-[7px] top-6 w-px bg-line"
                  aria-hidden="true"
                />
              ) : null}
              <span
                className={`absolute left-0 top-4 h-[15px] w-[15px] rounded-full border-2 ${
                  isCurrent
                    ? 'border-forest-500 bg-forest-500'
                    : 'border-forest-200 bg-white'
                }`}
                aria-hidden="true"
              />

              <h3>
                <button
                  type="button"
                  onClick={() => setOpenId(isOpen ? null : term.id)}
                  aria-expanded={isOpen}
                  aria-controls={`term-panel-${term.id}`}
                  className="flex w-full items-center gap-3 rounded-lg py-3 pr-2 text-left transition-colors duration-150 hover:bg-canvas focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-forest-500 cursor-pointer"
                >
                  <span className="min-w-0 flex-1">
                    <span className="flex flex-wrap items-center gap-2">
                      <span className="text-sm font-semibold text-forest-800">
                        {term.shortYear || term.academicYear}
                      </span>
                      {isCurrent ? (
                        <span className="rounded-full bg-forest-50 px-2 py-0.5 text-[11px] font-semibold text-forest-600 border border-forest-100">
                          Current term
                        </span>
                      ) : null}
                    </span>
                    <span className="mt-0.5 block truncate text-sm text-ink-muted">
                      {president.name || 'President'} &middot; President
                    </span>
                  </span>

                  <span className="hidden shrink-0 text-sm tabular-nums text-ink-muted sm:block">
                    {term.memberCount ?? 0} members
                  </span>

                  <ChevronDown
                    className={`h-4 w-4 shrink-0 text-ink-faint transition-transform duration-200 ${
                      isOpen ? 'rotate-180 text-forest-600' : ''
                    }`}
                    aria-hidden="true"
                  />
                </button>
              </h3>

              <AnimatePresence initial={false}>
                {isOpen && (
                  <motion.div
                    id={`term-panel-${term.id}`}
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: 'auto', opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={{ duration: 0.22, ease: easing }}
                    className="overflow-hidden"
                  >
                    <div className="mb-4 rounded-xl border border-line bg-canvas px-4 py-4">
                      <div className="grid gap-4 sm:grid-cols-2">
                        <div>
                          <p className="text-xs font-semibold uppercase tracking-wide text-ink-faint">
                            President
                          </p>
                          <p className="mt-1.5 text-sm font-medium text-ink">
                            {president.name || '—'}
                          </p>
                          {president.studentNumber && (
                            <p className="text-xs text-ink-faint">
                              SN: {president.studentNumber}
                            </p>
                          )}
                          {president.contactNumber && (
                            <p className="mt-1 text-sm text-ink">
                              {president.contactNumber}
                              <span className="ml-2 text-xs text-ink-faint">
                                contact number
                              </span>
                            </p>
                          )}
                        </div>

                        <div>
                          <p className="text-xs font-semibold uppercase tracking-wide text-ink-faint">
                            Advisers
                          </p>
                          {advisers.length > 0 ? (
                            <ul className="mt-1.5 space-y-1">
                              {advisers.map((adviser, idx) => (
                                <li
                                  key={idx}
                                  className="text-sm text-ink"
                                >
                                  {adviser.name}
                                  {adviser.role && (
                                    <span className="ml-2 text-xs text-ink-faint">
                                      ({adviser.role})
                                    </span>
                                  )}
                                </li>
                              ))}
                            </ul>
                          ) : (
                            <p className="mt-1 text-xs text-ink-faint italic">No advisers recorded</p>
                          )}
                          <p className="mt-3 text-sm text-ink">
                            {term.memberCount ?? 0} members
                            <span className="ml-2 text-xs text-ink-faint">
                              at close of term
                            </span>
                          </p>
                        </div>
                      </div>

                      <div className="mt-4 border-t border-line pt-4">
                        <p className="text-xs font-semibold uppercase tracking-wide text-ink-faint">
                          Executive board &middot; {board.length} {board.length === 1 ? 'officer' : 'officers'}
                        </p>
                        {board.length > 0 ? (
                          <ul className="mt-2 divide-y divide-line/80">
                            {board.map((member) => (
                              <li
                                key={member.id}
                                className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-0.5 py-2"
                              >
                                <span className="text-sm font-medium text-ink">
                                  {member.name || member.full_name}
                                </span>
                                <span className="text-sm text-ink-muted">
                                  {member.position}
                                </span>
                              </li>
                            ))}
                          </ul>
                        ) : (
                          <p className="mt-2 text-xs text-ink-faint italic">No officers recorded for this term</p>
                        )}
                      </div>

                      {term.note ? (
                        <p className="mt-4 border-l-2 border-amber-400 pl-3 text-sm italic text-ink-muted">
                          {term.note}
                        </p>
                      ) : null}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </li>
          );
        })}
      </ol>
    </section>
  );
}

export default TermHistory;
