import React, { useState, useEffect } from 'react';
import { supabase } from '../supabaseClient';
import { X, Calendar as CalendarIcon, List, FileDown, ChevronLeft, ChevronRight, Clock, MapPin } from 'lucide-react';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import GlobalLoader from './GlobalLoader';

const SchoolYearCalendarModal = ({ activeSy, onClose }) => {
  const [view, setView] = useState('calendar'); // 'calendar' or 'list'
  const [currentDate, setCurrentDate] = useState(new Date());
  const [activities, setActivities] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchActivities();
  }, [activeSy]);

  const fetchActivities = async () => {
    setLoading(true);
    try {
      const { data: adminEvents, error: adminErr } = await supabase
        .from('academic_calendar_events')
        .select('*, documentType:document_type_id(name)')
        .eq('school_year_id', activeSy?.id);

      if (adminErr) throw adminErr;

      const events = [];

      if (adminEvents) {
        adminEvents.forEach(ev => {
          if (ev.start_date) {
            events.push({
              id: ev.id,
              title: ev.title,
              org: 'Admin',
              date: new Date(ev.start_date),
              endDate: ev.end_date ? new Date(ev.end_date) : null,
              duration: 0,
              isBlocked: ev.event_type === 'blocked_activity',
              eventType: ev.event_type,
              docTypeName: ev.documentType ? ev.documentType.name : null
            });
          }
        });
      }
      
      events.sort((a, b) => a.date - b.date);
      setActivities(events);

      // If activeSy exists, maybe set initial date to its start date if current date is outside it
      if (activeSy) {
        const now = new Date();
        const syStart = new Date(activeSy.start_date);
        const syEnd = new Date(activeSy.end_date);
        if (now < syStart || now > syEnd) {
          setCurrentDate(syStart);
        }
      }
    } catch (err) {
      console.error('Error fetching calendar activities:', err);
    } finally {
      setLoading(false);
    }
  };

  const nextMonth = () => {
    setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 1));
  };

  const prevMonth = () => {
    setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() - 1, 1));
  };

  const generateReport = () => {
    const doc = new jsPDF();
    const syTitle = activeSy ? activeSy.name : 'School Year';
    
    doc.setFontSize(16);
    doc.text(`Activity Calendar Report - ${syTitle}`, 14, 20);
    doc.setFontSize(10);
    doc.text(`Generated on: ${new Date().toLocaleDateString()}`, 14, 28);

    const tableData = activities.map(act => [
      act.date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }),
      act.title,
      act.org,
      act.date.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }) + (act.endDate ? ` - ${act.endDate.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}` : '')
    ]);

    autoTable(doc, {
      startY: 35,
      head: [['Date', 'Activity Title', 'Organization', 'Time']],
      body: tableData,
      theme: 'grid',
      headStyles: { fillColor: [4, 120, 87] }, // primary green
      styles: { fontSize: 9 }
    });

    doc.save(`Activity_Report_${syTitle.replace(/[^a-z0-9]/gi, '_')}.pdf`);
  };

  // Calendar Grid Logic
  const getDaysInMonth = (year, month) => new Date(year, month + 1, 0).getDate();
  const getFirstDayOfMonth = (year, month) => new Date(year, month, 1).getDay();

  const daysInMonth = getDaysInMonth(currentDate.getFullYear(), currentDate.getMonth());
  const firstDay = getFirstDayOfMonth(currentDate.getFullYear(), currentDate.getMonth());
  const monthName = currentDate.toLocaleString('default', { month: 'long', year: 'numeric' });

  const renderCalendar = () => {
    const days = [];
    const weekDays = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

    // Headers
    const headers = weekDays.map(day => (
      <div key={`header-${day}`} className="font-bold text-center text-sm py-2 text-gray-500 border-b border-gray-100">
        {day}
      </div>
    ));

    // Empty slots before first day
    for (let i = 0; i < firstDay; i++) {
      days.push(<div key={`empty-${i}`} className="min-h-[100px] border-b border-r border-gray-50 bg-gray-50/50 p-2"></div>);
    }

    // Days with events
    for (let d = 1; d <= daysInMonth; d++) {
      const currentDayDate = new Date(currentDate.getFullYear(), currentDate.getMonth(), d);
      
      const currentDayMs = currentDayDate.getTime();
      
      const dayEvents = activities.filter(act => {
        if (act.eventType === 'submission_window') return false;
        const startMs = new Date(act.date.getFullYear(), act.date.getMonth(), act.date.getDate()).getTime();
        const endMs = act.endDate 
          ? new Date(act.endDate.getFullYear(), act.endDate.getMonth(), act.endDate.getDate()).getTime()
          : startMs;
        
        return currentDayMs >= startMs && currentDayMs <= endMs;
      });

      const isToday = new Date().toDateString() === currentDayDate.toDateString();

      days.push(
        <div key={d} className={`min-h-[100px] border-b border-r border-gray-100 p-2 transition-colors hover:bg-gray-50 ${isToday ? 'bg-green-50/30' : ''}`}>
          <div className="flex justify-between items-start mb-1">
            <span className={`text-sm font-semibold w-7 h-7 flex items-center justify-center rounded-full ${isToday ? 'bg-primary-green text-white shadow-sm' : 'text-gray-700'}`}>
              {d}
            </span>
            {dayEvents.length > 0 && (
              <span className="text-[10px] font-bold text-gray-400 bg-gray-100 px-1.5 py-0.5 rounded-md">
                {dayEvents.length}
              </span>
            )}
          </div>
          <div className="space-y-1.5 mt-2">
            {dayEvents.slice(0, 3).map((ev, idx) => (
              <div key={idx} className="bg-white border border-gray-200 rounded-md p-1.5 text-xs shadow-sm hover:border-primary-green hover:shadow-md transition-all cursor-default group">
                <div className="font-bold text-gray-800 truncate group-hover:text-primary-green transition-colors" title={ev.title}>{ev.title}</div>
                <div className="text-[10px] text-gray-500 font-medium truncate flex items-center gap-1 mt-0.5">
                  <div className="w-1.5 h-1.5 rounded-full bg-primary-green/60"></div>
                  {ev.org}
                </div>
              </div>
            ))}
            {dayEvents.length > 3 && (
              <div className="text-[10px] text-gray-400 font-medium pl-1">
                +{dayEvents.length - 3} more
              </div>
            )}
          </div>
        </div>
      );
    }

    const submissionWindows = activities.filter(act => act.eventType === 'submission_window');
    const openWindows = submissionWindows.filter(sw => {
      const now = new Date();
      const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      const start = new Date(sw.date.getFullYear(), sw.date.getMonth(), sw.date.getDate());
      const end = sw.endDate ? new Date(sw.endDate.getFullYear(), sw.endDate.getMonth(), sw.endDate.getDate()) : start;
      return today >= start && today <= end;
    });

    const syStart = activeSy?.start_date ? new Date(activeSy.start_date).toDateString() : null;
    const syEnd = activeSy?.end_date ? new Date(activeSy.end_date).toDateString() : null;

    return (
      <div className="space-y-4">
        {openWindows.length > 0 && (
          <div className="w-full flex items-center gap-3 overflow-x-auto pb-2 custom-scrollbar">
            <span className="text-xs font-black text-gray-500 uppercase tracking-widest whitespace-nowrap shrink-0">
              Open Submission Windows
            </span>
            {openWindows.map((sw, idx) => {
              const winStart = sw.date.toDateString();
              const winEnd = sw.endDate ? sw.endDate.toDateString() : winStart;
              const isEntireSy = (syStart === winStart) && (syEnd === winEnd);

              const now = new Date();
              const startStr = sw.date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: sw.date.getFullYear() !== now.getFullYear() ? 'numeric' : undefined });
              const endStr = sw.endDate ? sw.endDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: sw.endDate.getFullYear() !== sw.date.getFullYear() ? 'numeric' : undefined }) : '';
              
              const dateDisplay = isEntireSy ? 'Entire School Year' : (endStr ? `${startStr} – ${endStr}` : startStr);

              return (
                <div key={idx} className="flex items-center gap-2 px-3 py-1.5 bg-white border border-gray-200 rounded-full shadow-sm shrink-0">
                  <div className="w-2 h-2 rounded-full bg-green-500 shadow-[0_0_6px_rgba(34,197,94,0.4)]"></div>
                  <span className="text-xs font-black text-gray-800">{sw.docTypeName || sw.title}</span>
                  <span className="text-[10px] font-bold text-gray-400">•</span>
                  <span className="text-[10px] font-bold text-gray-500">{dateDisplay}</span>
                </div>
              );
            })}
          </div>
        )}

        <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
          <div className="grid grid-cols-7 bg-gray-50/80">
            {headers}
          </div>
          <div className="grid grid-cols-7 border-l border-t border-gray-100">
            {days}
          </div>
        </div>
      </div>
    );
  };

  const renderList = () => {
    if (activities.length === 0) {
      return (
        <div className="flex flex-col items-center justify-center p-12 bg-white rounded-xl border border-gray-200 border-dashed">
          <CalendarIcon size={48} className="text-gray-300 mb-4" />
          <h3 className="text-lg font-bold text-gray-700">No activities found</h3>
          <p className="text-sm text-gray-500 mt-1">There are no approved activities for this school year.</p>
        </div>
      );
    }

    return (
      <div className="space-y-4">
        {activities.map((ev, idx) => (
          <div key={idx} className="bg-white p-5 rounded-xl border border-gray-100 shadow-sm hover:shadow-md hover:border-primary-green/30 transition-all group flex gap-5">
            <div className="flex flex-col items-center justify-center min-w-[70px] px-4 py-2 bg-green-50 rounded-lg border border-green-100 shrink-0">
              <span className="text-sm font-bold text-primary-green uppercase tracking-wider">{ev.date.toLocaleString('en-US', { month: 'short' })}</span>
              <span className="text-2xl font-black text-gray-800">{ev.date.getDate()}</span>
            </div>
            <div className="flex-1 min-w-0 py-1">
              <div className="flex justify-between items-start gap-4">
                <div>
                  <h4 className="text-base font-bold text-gray-900 group-hover:text-primary-green transition-colors leading-tight mb-1">{ev.title}</h4>
                  <span className="inline-flex items-center gap-1.5 px-2 py-1 rounded-md bg-gray-100 text-gray-600 text-xs font-bold uppercase tracking-wider">
                    {ev.org}
                  </span>
                </div>
              </div>
              <div className="flex flex-col gap-1.5 mt-3 text-sm text-gray-500 font-medium">
                <div className="flex items-center gap-1.5">
                  <CalendarIcon size={16} className="text-gray-400" />
                  {ev.date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                  {ev.endDate && ev.endDate.toDateString() !== ev.date.toDateString() && ` - ${ev.endDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}`}
                </div>
                <div className="flex items-center gap-1.5">
                  <Clock size={16} className="text-gray-400" />
                  {ev.duration === 0 ? 'All Day' : (
                    <>
                      {ev.date.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}
                      {ev.endDate && ` - ${ev.endDate.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}`}
                    </>
                  )}
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>
    );
  };

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4 sm:p-6" onClick={onClose}>
      <div className="bg-[#f8fafc] rounded-2xl shadow-2xl w-full max-w-6xl h-[90vh] flex flex-col overflow-hidden animate-in zoom-in-95 duration-200" onClick={e => e.stopPropagation()}>
        
        {/* Header */}
        <div className="bg-white px-6 py-5 border-b border-gray-100 flex items-center justify-between shrink-0 sticky top-0 z-10">
          <div>
            <div className="flex items-center gap-3 mb-1">
              <div className="w-10 h-10 bg-green-100 text-primary-green rounded-xl flex items-center justify-center shadow-sm">
                <CalendarIcon size={20} />
              </div>
              <div>
                <h2 className="text-xl font-bold text-gray-900">School Year Calendar</h2>
                <p className="text-sm font-medium text-gray-500">
                  {activeSy ? `${activeSy.name} (${activeSy.semester_type || 'Semester'})` : 'Loading...'}
                </p>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={generateReport}
              className="flex items-center gap-2 px-4 py-2 bg-white border border-gray-200 hover:border-primary-green hover:bg-green-50 hover:text-primary-green text-gray-700 text-sm font-bold rounded-xl transition-all shadow-sm"
            >
              <FileDown size={16} />
              <span className="hidden sm:inline">Export Report</span>
            </button>
            <div className="h-6 w-[1px] bg-gray-200 mx-1"></div>
            <button
              onClick={onClose}
              className="p-2 text-gray-400 hover:text-gray-700 hover:bg-gray-100 rounded-full transition-colors"
            >
              <X size={20} />
            </button>
          </div>
        </div>

        {/* Controls */}
        <div className="px-6 py-4 bg-white border-b border-gray-100 flex flex-col sm:flex-row items-center justify-between gap-4 shrink-0 shadow-sm z-0 relative">
          <div className="flex bg-gray-100 p-1 rounded-xl w-full sm:w-auto">
            <button
              onClick={() => setView('calendar')}
              className={`flex-1 sm:flex-none flex items-center justify-center gap-2 px-6 py-2 rounded-lg text-sm font-bold transition-all ${view === 'calendar' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
            >
              <CalendarIcon size={16} /> Calendar
            </button>
            <button
              onClick={() => setView('list')}
              className={`flex-1 sm:flex-none flex items-center justify-center gap-2 px-6 py-2 rounded-lg text-sm font-bold transition-all ${view === 'list' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
            >
              <List size={16} /> List
            </button>
          </div>

          {view === 'calendar' && (
            <div className="flex items-center gap-4 bg-white border border-gray-200 rounded-xl p-1 shadow-sm">
              <button onClick={prevMonth} className="p-1.5 hover:bg-gray-100 rounded-lg text-gray-600 transition-colors">
                <ChevronLeft size={18} />
              </button>
              <span className="min-w-[140px] text-center font-bold text-gray-800 text-sm">
                {monthName}
              </span>
              <button onClick={nextMonth} className="p-1.5 hover:bg-gray-100 rounded-lg text-gray-600 transition-colors">
                <ChevronRight size={18} />
              </button>
            </div>
          )}
        </div>

        {/* Content Area */}
        <div className="flex-1 overflow-y-auto p-6 bg-gray-50/50">
          {loading ? (
            <div className="h-full flex items-center justify-center">
              <GlobalLoader />
            </div>
          ) : (
            <div className="max-w-6xl mx-auto">
              {view === 'calendar' ? renderCalendar() : renderList()}
            </div>
          )}
        </div>
        
      </div>
    </div>
  );
};

export default SchoolYearCalendarModal;
