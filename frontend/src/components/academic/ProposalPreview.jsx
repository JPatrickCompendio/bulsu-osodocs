import React, { useState } from 'react';
import { ShieldAlert, CheckCircle2, Calendar as CalendarIcon, Info, Lock } from 'lucide-react';
import { parseISO, isWithinInterval } from 'date-fns';

export function ProposalPreview({ events }) {
  const [testDate, setTestDate] = useState('');

  const blockingEvents = events.filter(e => e.event_type === 'blocked_activity' || e.blocks_activity || e.description === 'BLOCKS_ACTIVITY');

  let blockedEventMatch = null;
  if (testDate) {
    const selected = new Date(testDate);
    selected.setHours(0,0,0,0);

    blockedEventMatch = blockingEvents.find(ev => {
      if (!ev.start_date || !ev.end_date) return false;
      try {
        const start = typeof ev.start_date === 'string' ? parseISO(ev.start_date) : new Date(ev.start_date);
        const end = typeof ev.end_date === 'string' ? parseISO(ev.end_date) : new Date(ev.end_date);
        start.setHours(0,0,0,0);
        end.setHours(23,59,59,999);
        return isWithinInterval(selected, { start, end });
      } catch {
        return false;
      }
    });
  }

  return (
    <div className="bg-gradient-to-br from-gray-900 to-gray-800 text-white rounded-2xl p-5 shadow-lg border border-gray-700">
      <div className="flex items-center gap-2 mb-3">
        <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
        <span className="text-[11px] font-extrabold uppercase tracking-wider text-emerald-400">
          Student Form Preview Mode
        </span>
      </div>

      <h4 className="font-extrabold text-white text-sm mb-1">
        How Org Presidents See Blocked Dates
      </h4>
      <p className="text-xs text-gray-300 mb-4">
        Test a date below to simulate form validation on the Activity Proposal page.
      </p>

      <div className="space-y-3 bg-gray-900/80 p-3.5 rounded-xl border border-gray-700">
        <div>
          <label className="text-[11px] font-bold text-gray-400 uppercase tracking-wider block mb-1">
            Target Activity Date
          </label>
          <input
            type="date"
            value={testDate}
            onChange={(e) => setTestDate(e.target.value)}
            className="w-full bg-gray-800 border border-gray-600 text-white text-xs font-bold p-2.5 rounded-lg outline-none focus:border-emerald-500"
          />
        </div>

        {testDate && (
          <div>
            {blockedEventMatch ? (
              <div className="bg-red-500/20 border border-red-500/50 p-3 rounded-xl text-red-200 text-xs space-y-1">
                <div className="flex items-center gap-1.5 font-bold text-red-400">
                  <Lock size={14} /> Submission Date Unavailable
                </div>
                <p className="text-gray-300">
                  This date is blocked due to <strong className="text-white font-bold">{blockedEventMatch.title}</strong>.
                </p>
                <p className="text-[10px] text-red-300 italic">
                  Activity proposals cannot be scheduled on official university blackout dates.
                </p>
              </div>
            ) : (
              <div className="bg-emerald-500/20 border border-emerald-500/50 p-3 rounded-xl text-emerald-200 text-xs space-y-1">
                <div className="flex items-center gap-1.5 font-bold text-emerald-400">
                  <CheckCircle2 size={14} /> Date Available
                </div>
                <p className="text-gray-300">
                  No university blocking events exist for this date.
                </p>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
