import React, { useState } from 'react';
import { 
  Plus, CalendarDays, Edit3, Trash2, Lock, AlertCircle, Info, Filter 
} from 'lucide-react';
import { YearScopePicker } from './YearScopePicker';
import { BlockedDatesCalendar } from './BlockedDatesCalendar';
import { ProposalPreview } from './ProposalPreview';
import { formatDateRange } from '../../utils/academicLifecycle';

export function CalendarTab({
  schoolYears,
  events,
  approvedActivities = [],
  selectedSyId,
  onSelectSy,
  onNewEvent,
  onEditEvent,
  onDeleteEvent,
  onToggleBlock,
  canEdit = true
}) {
  const [categoryFilter, setCategoryFilter] = useState('ALL');
  const selectedSy = schoolYears.find(sy => sy.id === selectedSyId) || schoolYears.find(sy => sy.is_active) || schoolYears[0];
  const syEvents = events.filter(ev => ev.school_year_id === selectedSy?.id && ev.event_type !== 'submission_window');

  const filteredEvents = syEvents.filter(ev => {
    if (categoryFilter === 'ALL') return true;
    if (categoryFilter === 'school_event') {
      return ev.event_type === 'school_event' || ev.event_type === 'announcement';
    }
    if (categoryFilter === 'blocked_activity') {
      return ev.event_type === 'blocked_activity' || ev.blocks_activity || ev.description === 'BLOCKS_ACTIVITY';
    }
    return ev.event_type === categoryFilter;
  });

  const eventTypeLabels = {
    school_event: 'School Event',
    announcement: 'School Event',
    blocked_activity: 'Blocked Activity',
    submission_window: 'Submission Window',
    holiday: 'Holiday',
    exam_week: 'Exam Week',
    enrollment: 'Enrollment'
  };

  return (
    <div className="space-y-6">
      {/* Top Scope Selector */}
      <YearScopePicker
        schoolYears={schoolYears}
        selectedSyId={selectedSyId}
        onSelectSy={onSelectSy}
      />

      {/* Main Grid: Left List + Right Preview Panels */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left 2 Cols: Events List */}
        <div className="lg:col-span-2 space-y-4">
          {/* Filter Pills & Add Action Button */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            {/* Category Filter Pills */}
            <div className="flex items-center gap-1.5 overflow-x-auto pb-1.5 max-w-full bg-gray-100 p-1 rounded-xl w-full sm:w-fit border border-gray-200 scrollbar-none">
              {[
                { id: 'ALL', label: 'All Events' },
                { id: 'school_event', label: 'School Events' },
                { id: 'blocked_activity', label: 'Blocked Dates' },
                { id: 'holiday', label: 'Holidays' },
                { id: 'exam_week', label: 'Exams' },
                { id: 'enrollment', label: 'Enrollment' }
              ].map(cat => (
                <button
                  key={cat.id}
                  onClick={() => setCategoryFilter(cat.id)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition shrink-0 ${
                    categoryFilter === cat.id
                      ? 'bg-emerald-800 text-white shadow-xs font-extrabold'
                      : 'text-gray-600 hover:text-gray-900 hover:bg-gray-200/60'
                  }`}
                >
                  {cat.label}
                </button>
              ))}
            </div>

            {canEdit && (
              <button
                onClick={() => onNewEvent(selectedSy?.id)}
                className="bg-emerald-700 hover:bg-emerald-800 text-white px-4 py-2 rounded-xl font-bold text-xs flex items-center gap-2 shadow-xs transition shrink-0"
              >
                <Plus size={15} /> Add Calendar Event
              </button>
            )}
          </div>

          {/* Table / List */}
          <div className="bg-white rounded-2xl border border-gray-100 shadow-xs overflow-hidden">
            <table className="w-full text-left text-sm">
              <thead className="bg-[#073c2d] text-white font-bold border-b border-[#073c2d] uppercase tracking-wider text-xs">
                <tr>
                  <th className="px-3 sm:p-4 text-white">Event Title</th>
                  <th className="hidden sm:table-cell p-4 text-white">Category</th>
                  <th className="hidden md:table-cell p-4 text-white">Duration</th>
                  <th className="px-2 sm:p-4 text-center sm:text-left text-white">Blocks</th>
                  {canEdit && <th className="px-3 sm:p-4 text-right text-white">Actions</th>}
                </tr>
              </thead>

              <tbody className="divide-y divide-gray-100">
                {filteredEvents.map(ev => {
                  const isBlocked = ev.event_type === 'blocked_activity' || ev.blocks_activity || ev.description === 'BLOCKS_ACTIVITY';

                  return (
                    <tr key={ev.id} className="hover:bg-gray-50/70 transition">
                      <td className="px-3 sm:p-4 font-extrabold text-gray-900">
                        <div className="flex items-center gap-2">
                          {isBlocked && <Lock size={14} className="text-red-500 shrink-0" />}
                          <div>
                            <span className="text-xs sm:text-sm">{ev.title}</span>
                            <div className="sm:hidden flex flex-wrap items-center gap-1 mt-0.5">
                              <span className="text-[10px] font-bold text-gray-500 bg-gray-100 px-1.5 py-0.5 rounded">
                                {eventTypeLabels[ev.event_type] || ev.event_type}
                              </span>
                              <span className="text-[10px] font-bold text-gray-400">
                                {formatDateRange(ev.start_date, ev.end_date)}
                              </span>
                            </div>
                          </div>
                        </div>
                      </td>

                      <td className="hidden sm:table-cell p-4 text-xs font-bold text-gray-600">
                        <span className="bg-gray-100 text-gray-700 px-2 py-1 rounded-lg border border-gray-200">
                          {eventTypeLabels[ev.event_type] || ev.event_type}
                        </span>
                      </td>

                      <td className="hidden md:table-cell p-4 text-xs font-bold text-gray-600">
                        {formatDateRange(ev.start_date, ev.end_date)}
                      </td>

                      <td className="px-2 sm:p-4 text-center sm:text-left">
                        {canEdit ? (
                          <button
                            onClick={() => onToggleBlock(ev)}
                            className={`px-2.5 py-1 rounded-full text-[10px] font-extrabold uppercase transition border ${
                              isBlocked
                                ? 'bg-red-100 text-red-800 border-red-200 hover:bg-red-200'
                                : 'bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-100'
                            }`}
                          >
                            {isBlocked ? 'Blocked' : 'Open'}
                          </button>
                        ) : (
                          <span
                            className={`inline-block px-2.5 py-1 rounded-full text-[10px] font-extrabold uppercase border ${
                              isBlocked
                                ? 'bg-red-100 text-red-800 border-red-200'
                                : 'bg-emerald-50 text-emerald-700 border-emerald-200'
                            }`}
                          >
                            {isBlocked ? 'Blocked' : 'Open'}
                          </span>
                        )}
                      </td>

                      {canEdit && (
                        <td className="px-3 sm:p-4 text-right">
                          <div className="flex items-center justify-end gap-1 sm:gap-2">
                            <button
                              onClick={() => onEditEvent(ev)}
                              className="p-1.5 text-gray-400 hover:text-emerald-700 hover:bg-emerald-50 rounded-lg transition"
                              title="Edit Event"
                            >
                              <Edit3 size={15} />
                            </button>
                            <button
                              onClick={() => onDeleteEvent(ev.id)}
                              className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition"
                              title="Delete Event"
                            >
                              <Trash2 size={15} />
                            </button>
                          </div>
                        </td>
                      )}
                    </tr>
                  );
                })}

                {filteredEvents.length === 0 && (
                  <tr>
                    <td colSpan="5" className="p-8 text-center text-gray-400 font-semibold text-xs">
                      No calendar events found for {selectedSy?.name || 'the selected filter'}.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Right Col: Mini Calendar & Proposal Preview Panel */}
        <div className="space-y-6">
          <BlockedDatesCalendar events={syEvents} approvedActivities={approvedActivities} />
          <ProposalPreview events={syEvents} />
        </div>
      </div>
    </div>
  );
}
