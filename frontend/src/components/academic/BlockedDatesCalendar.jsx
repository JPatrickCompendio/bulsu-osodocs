import React, { useState } from 'react';
import { 
  format, 
  addMonths, 
  subMonths, 
  startOfMonth, 
  endOfMonth, 
  startOfWeek, 
  endOfWeek, 
  eachDayOfInterval, 
  isSameMonth, 
  isSameDay, 
  isWithinInterval, 
  parseISO 
} from 'date-fns';
import { ChevronLeft, ChevronRight, Lock, Calendar as CalendarIcon, Info } from 'lucide-react';

export function BlockedDatesCalendar({ events = [], approvedActivities = [] }) {
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [selectedDayEvent, setSelectedDayEvent] = useState(null);

  const monthStart = startOfMonth(currentMonth);
  const monthEnd = endOfMonth(monthStart);
  const startDate = startOfWeek(monthStart);
  const endDate = endOfWeek(monthEnd);

  const days = eachDayOfInterval({ start: startDate, end: endDate });

  const nextMonth = () => setCurrentMonth(addMonths(currentMonth, 1));
  const prevMonth = () => setCurrentMonth(subMonths(currentMonth, 1));

  // Find events blocking or scheduled for a specific day
  const getEventsForDay = (day) => {
    const matchedEvents = events.filter(ev => {
      if (!ev.start_date || !ev.end_date) return false;
      try {
        const start = typeof ev.start_date === 'string' ? parseISO(ev.start_date) : new Date(ev.start_date);
        const end = typeof ev.end_date === 'string' ? parseISO(ev.end_date) : new Date(ev.end_date);
        start.setHours(0,0,0,0);
        end.setHours(23,59,59,999);
        return isWithinInterval(day, { start, end });
      } catch {
        return false;
      }
    });

    const matchedActivities = approvedActivities.filter(act => {
      if (!act.date) return false;
      try {
        const start = new Date(act.date);
        const end = act.endDate ? new Date(act.endDate) : new Date(act.date);
        start.setHours(0,0,0,0);
        end.setHours(23,59,59,999);
        return isWithinInterval(day, { start, end });
      } catch {
        return false;
      }
    });

    return {
      adminEvents: matchedEvents,
      activityEvents: matchedActivities,
      allCount: matchedEvents.length + matchedActivities.length
    };
  };

  return (
    <div className="bg-white border border-gray-200 rounded-2xl p-5 shadow-xs">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2 font-extrabold text-gray-900 text-sm">
          <CalendarIcon size={18} className="text-emerald-700" />
          <span>{format(currentMonth, 'MMMM yyyy')}</span>
        </div>

        <div className="flex items-center gap-1">
          <button
            onClick={prevMonth}
            className="p-1.5 text-gray-500 hover:text-gray-900 hover:bg-gray-100 rounded-lg transition"
          >
            <ChevronLeft size={18} />
          </button>
          <button
            onClick={nextMonth}
            className="p-1.5 text-gray-500 hover:text-gray-900 hover:bg-gray-100 rounded-lg transition"
          >
            <ChevronRight size={18} />
          </button>
        </div>
      </div>

      {/* Weekday headers */}
      <div className="grid grid-cols-7 gap-1 text-center text-[11px] font-extrabold text-gray-400 uppercase mb-2">
        <span>Sun</span>
        <span>Mon</span>
        <span>Tue</span>
        <span>Wed</span>
        <span>Thu</span>
        <span>Fri</span>
        <span>Sat</span>
      </div>

      {/* Days grid */}
      <div className="grid grid-cols-7 gap-1">
        {days.map((day) => {
          const { adminEvents, activityEvents, allCount } = getEventsForDay(day);
          const isBlocked = adminEvents.some(e => e.event_type === 'blocked_activity' || e.description === 'BLOCKS_ACTIVITY' || e.blocks_activity);
          const hasApprovedActivity = activityEvents.length > 0;
          const isCurrentMonth = isSameMonth(day, currentMonth);

          return (
            <button
              key={day.toString()}
              onClick={() => {
                if (allCount > 0) {
                  setSelectedDayEvent({ day, adminEvents, activityEvents });
                } else {
                  setSelectedDayEvent(null);
                }
              }}
              className={`h-9 rounded-lg flex flex-col items-center justify-center relative text-xs font-bold transition ${
                !isCurrentMonth ? 'text-gray-300 pointer-events-none' : 'text-gray-800'
              } ${
                isBlocked 
                  ? 'bg-red-500 text-white font-extrabold shadow-2xs hover:bg-red-600' 
                  : hasApprovedActivity
                    ? 'bg-purple-100 text-purple-900 font-extrabold border border-purple-300 hover:bg-purple-200'
                    : adminEvents.length > 0
                      ? 'bg-emerald-100 text-emerald-900 hover:bg-emerald-200'
                      : 'hover:bg-gray-100'
              }`}
            >
              <span>{format(day, 'd')}</span>
              {isBlocked && (
                <Lock size={9} className="absolute bottom-1 right-1 text-white/90" />
              )}
            </button>
          );
        })}
      </div>

      {/* Legend & Selected Day Info */}
      <div className="mt-4 pt-3 border-t border-gray-100 space-y-2">
        <div className="flex flex-wrap items-center justify-between text-[11px] text-gray-500 font-semibold gap-2">
          <div className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-md bg-red-500 inline-block" />
            <span>Blocked Date</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-md bg-purple-200 border border-purple-400 inline-block" />
            <span>Approved Activity</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-md bg-emerald-100 inline-block" />
            <span>Academic Event</span>
          </div>
        </div>

        {selectedDayEvent && (
          <div className="mt-3 p-3 bg-gray-50 border border-gray-200 rounded-xl text-xs space-y-1.5">
            <div className="flex items-center justify-between font-bold text-gray-900 border-b border-gray-200 pb-1">
              <span className="flex items-center gap-1 text-emerald-800">
                <Info size={14} /> {format(selectedDayEvent.day, 'MMMM d, yyyy')}
              </span>
              <button onClick={() => setSelectedDayEvent(null)} className="text-gray-400 hover:text-gray-800 font-extrabold">✕</button>
            </div>
            
            {selectedDayEvent.adminEvents.map((ev, i) => (
              <p key={`admin-${i}`} className={`font-semibold ${
                ev.event_type === 'blocked_activity' || ev.blocks_activity || ev.description === 'BLOCKS_ACTIVITY'
                  ? 'text-red-700 font-bold'
                  : 'text-emerald-800'
              }`}>
                • <strong>{ev.title}</strong> {(ev.event_type === 'blocked_activity' || ev.blocks_activity || ev.description === 'BLOCKS_ACTIVITY') ? '(Proposals Blocked)' : ''}
              </p>
            ))}

            {selectedDayEvent.activityEvents.map((act, i) => (
              <p key={`act-${i}`} className="text-purple-800 font-semibold">
                • <span className="bg-purple-100 text-purple-800 px-1 rounded text-[10px] font-bold">Approved</span> <strong>{act.title}</strong> ({act.org})
              </p>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
