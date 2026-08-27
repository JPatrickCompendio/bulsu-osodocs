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
  selectedSyId,
  onSelectSy,
  onNewEvent,
  onEditEvent,
  onDeleteEvent,
  onToggleBlock
}) {
  const [categoryFilter, setCategoryFilter] = useState('ALL');
  const selectedSy = schoolYears.find(sy => sy.id === selectedSyId) || schoolYears.find(sy => sy.is_active) || schoolYears[0];
  const syEvents = events.filter(ev => ev.school_year_id === selectedSy?.id);

  const filteredEvents = syEvents.filter(ev => {
    if (categoryFilter === 'ALL') return true;
    return ev.event_type === categoryFilter;
  });

  const eventTypeLabels = {
    school_event: 'School Event',
    blocked_activity: 'Blocked Activity',
    submission_window: 'Submission Window',
    holiday: 'Holiday',
    exam_week: 'Exam Week',
    enrollment: 'Enrollment',
    announcement: 'Announcement'
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
          {/* Header & Filter pills */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <h3 className="font-extrabold text-gray-900 text-lg flex items-center gap-2">
                <CalendarDays className="text-emerald-700" size={20} />
                Calendar & Blocked Dates
              </h3>
              <p className="text-xs text-gray-500 mt-0.5">
                Manage university events and proposal blackout dates for {selectedSy?.name}.
              </p>
            </div>

            <button
              onClick={() => onNewEvent(selectedSy?.id)}
              className="bg-emerald-700 hover:bg-emerald-800 text-white px-4 py-2.5 rounded-xl font-bold text-xs flex items-center gap-2 shadow-sm transition shrink-0"
            >
              <Plus size={16} /> Add Calendar Event
            </button>
          </div>

          {/* Category Filter Pills */}
          <div className="flex flex-wrap items-center gap-1.5 bg-gray-100 p-1 rounded-xl w-fit border border-gray-200">
            {[
              { id: 'ALL', label: 'All Events' },
              { id: 'school_event', label: 'School Events' },
              { id: 'holiday', label: 'Holidays' },
              { id: 'exam_week', label: 'Exams' },
              { id: 'enrollment', label: 'Enrollment' }
            ].map(cat => (
              <button
                key={cat.id}
                onClick={() => setCategoryFilter(cat.id)}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition ${
                  categoryFilter === cat.id
                    ? 'bg-white text-gray-900 shadow-2xs font-extrabold'
                    : 'text-gray-500 hover:text-gray-800'
                }`}
              >
                {cat.label}
              </button>
            ))}
          </div>

          {/* Table / List */}
          <div className="bg-white rounded-2xl border border-gray-100 shadow-xs overflow-hidden">
            <table className="w-full text-left text-sm">
              <thead className="bg-[#073c2d] text-white font-bold border-b border-[#073c2d] uppercase tracking-wider text-xs">
                <tr>
                  <th className="p-4 text-white">Event Title</th>
                  <th className="p-4 text-white">Category</th>
                  <th className="p-4 text-white">Duration</th>
                  <th className="p-4 text-white">Blocks Proposals</th>
                  <th className="p-4 text-right text-white">Actions</th>
                </tr>
              </thead>

              <tbody className="divide-y divide-gray-100">
                {filteredEvents.map(ev => {
                  const isBlocked = ev.event_type === 'blocked_activity' || ev.blocks_activity || ev.description === 'BLOCKS_ACTIVITY';

                  return (
                    <tr key={ev.id} className="hover:bg-gray-50/70 transition">
                      <td className="p-4 font-extrabold text-gray-900">
                        <div className="flex items-center gap-2">
                          {isBlocked && <Lock size={14} className="text-red-500 shrink-0" />}
                          <span>{ev.title}</span>
                        </div>
                      </td>

                      <td className="p-4 text-xs font-bold text-gray-600">
                        <span className="bg-gray-100 border border-gray-200 px-2.5 py-1 rounded-full text-gray-700">
                          {eventTypeLabels[ev.event_type] || ev.event_type}
                        </span>
                      </td>

                      <td className="p-4 text-gray-600 font-semibold text-xs">
                        {formatDateRange(ev.start_date, ev.end_date)}
                      </td>

                      <td className="p-4">
                        <button
                          onClick={() => onToggleBlock(ev)}
                          className={`w-10 h-5 flex items-center rounded-full p-0.5 transition cursor-pointer ${
                            isBlocked ? 'bg-red-500' : 'bg-gray-300'
                          }`}
                          title="Toggle proposal date blocking for this event"
                        >
                          <div className={`bg-white w-4 h-4 rounded-full shadow-md transform transition-transform ${
                            isBlocked ? 'translate-x-5' : ''
                          }`} />
                        </button>
                      </td>

                      <td className="p-4 text-right">
                        <div className="flex items-center justify-end gap-2">
                          <button
                            onClick={() => onEditEvent(ev)}
                            className="p-1.5 text-gray-400 hover:text-emerald-700 hover:bg-emerald-50 rounded-lg transition"
                            title="Edit Event"
                          >
                            <Edit3 size={16} />
                          </button>
                          <button
                            onClick={() => onDeleteEvent(ev.id)}
                            className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition"
                            title="Delete Event"
                          >
                            <Trash2 size={16} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}

                {filteredEvents.length === 0 && (
                  <tr>
                    <td colSpan="5" className="p-12 text-center text-gray-400 font-semibold">
                      No calendar events configured for {selectedSy?.name || 'this school year'}.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Right 1 Col: Mini Calendar & Proposal Preview */}
        <div className="space-y-6">
          <BlockedDatesCalendar events={syEvents} />
          <ProposalPreview events={syEvents} />
        </div>
      </div>
    </div>
  );
}
