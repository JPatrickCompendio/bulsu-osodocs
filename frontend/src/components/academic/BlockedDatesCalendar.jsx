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

export function BlockedDatesCalendar({ events }) {
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [selectedDayEvent, setSelectedDayEvent] = useState(null);

  const monthStart = startOfMonth(currentMonth);
  const monthEnd = endOfMonth(monthStart);
  const startDate = startOfWeek(monthStart);
  const endDate = endOfWeek(monthEnd);

  const days = eachDayOfInterval({ start: startDate, end: endDate });

  const nextMonth = () => setCurrentMonth(addMonths(currentMonth, 1));
  const prevMonth = () => setCurrentMonth(subMonths(currentMonth, 1));

  // Find events blocking a specific day
  const getEventsForDay = (day) => {
    return events.filter(ev => {
      if (!ev.start_date || !ev.end_date) return false;
      try {
        const start = typeof ev.start_date === 'string' ? parseISO(ev.start_date) : new Date(ev.start_date);
        const end = typeof ev.end_date === 'string' ? parseISO(ev.end_date) : new Date(ev.end_date);
        // Normalize time
        start.setHours(0,0,0,0);
        end.setHours(23,59,59,999);
        return isWithinInterval(day, { start, end });
      } catch {
        return false;
      }
    });
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
        {days.map((day, dayIdx) => {
          const dayEvents = getEventsForDay(day);
          const isBlocked = dayEvents.some(e => e.event_type === 'blocked_activity' || e.description === 'BLOCKS_ACTIVITY' || e.blocks_activity);
          const isCurrentMonth = isSameMonth(day, currentMonth);

          return (
            <button
              key={day.toString()}
              onClick={() => {
                if (dayEvents.length > 0) {
                  setSelectedDayEvent({ day, events: dayEvents });
                } else {
                  setSelectedDayEvent(null);
                }
              }}
              className={`h-9 rounded-lg flex flex-col items-center justify-center relative text-xs font-bold transition ${
                !isCurrentMonth ? 'text-gray-300 pointer-events-none' : 'text-gray-800'
              } ${
                isBlocked 
                  ? 'bg-red-500 text-white font-extrabold shadow-2xs hover:bg-red-600' 
                  : dayEvents.length > 0
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
        <div className="flex items-center justify-between text-xs text-gray-500 font-semibold">
          <div className="flex items-center gap-1.5">
            <span className="w-3 h-3 rounded-md bg-red-500 inline-block" />
            <span>Blocked Proposal Date</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-3 h-3 rounded-md bg-emerald-100 inline-block" />
            <span>Scheduled Event</span>
          </div>
        </div>

        {selectedDayEvent && (
          <div className="mt-3 p-3 bg-red-50 border border-red-200 rounded-xl text-xs space-y-1">
            <div className="flex items-center justify-between font-bold text-red-900">
              <span className="flex items-center gap-1">
                <Info size={14} /> {format(selectedDayEvent.day, 'MMMM d, yyyy')}
              </span>
              <button onClick={() => setSelectedDayEvent(null)} className="text-red-500 hover:text-red-800 font-extrabold">✕</button>
            </div>
            {selectedDayEvent.events.map((ev, i) => (
              <p key={i} className="text-red-700 font-semibold">
                • <strong className="font-bold">{ev.title}</strong> {(ev.event_type === 'blocked_activity' || ev.blocks_activity || ev.description === 'BLOCKS_ACTIVITY') ? '(Proposals Blocked)' : ''}
              </p>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
