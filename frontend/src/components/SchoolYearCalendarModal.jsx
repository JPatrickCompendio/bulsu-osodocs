import React, { useState, useEffect } from 'react';
import { supabase } from '../supabaseClient';
import { 
  X, 
  Calendar as CalendarIcon, 
  List, 
  FileDown, 
  ChevronLeft, 
  ChevronRight, 
  Clock, 
  Lock, 
  ShieldAlert, 
  Info, 
  CheckCircle2, 
  AlertTriangle,
  Tag,
  Sparkles
} from 'lucide-react';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import ReportPreviewModal from './ReportPreviewModal';
import GlobalLoader from './GlobalLoader';
import { useAuth } from '../context/AuthContext';

const SchoolYearCalendarModal = ({ activeSy, onClose }) => {
  const { user } = useAuth();
  const [view, setView] = useState('calendar'); // 'calendar' or 'list'
  const [currentDate, setCurrentDate] = useState(new Date());
  const [activities, setActivities] = useState([]);
  const [semesters, setSemesters] = useState([]);
  const [selectedSemesterId, setSelectedSemesterId] = useState('all');
  const [loading, setLoading] = useState(true);
  const [selectedDayDetails, setSelectedDayDetails] = useState(null);

  const [isReportOpen, setIsReportOpen] = useState(false);
  const [reportData, setReportData] = useState({ title: '', stats: [], headers: [], rows: [], filename: '' });

  useEffect(() => {
    fetchActivities();
  }, [activeSy]);

  const fetchActivities = async () => {
    setLoading(true);
    try {
      let currentSy = activeSy;
      if (!currentSy || !currentSy.id || typeof currentSy.id !== 'string' || currentSy.id === 'undefined') {
        const { data: activeSyDb } = await supabase
          .from('school_years')
          .select('*')
          .eq('is_active', true)
          .maybeSingle();
        currentSy = activeSyDb;
      }

      if (!currentSy || !currentSy.id) {
        setActivities([]);
        setLoading(false);
        return;
      }

      let semsList = [];
      const { data: sems } = await supabase
        .from('semesters')
        .select('*')
        .eq('school_year_id', currentSy.id)
        .neq('status', 'archived')
        .order('start_date', { ascending: true });

      semsList = sems || [];
      setSemesters(semsList);

      const activeSem = semsList.find(s => s.is_active);
      if (activeSem) {
        setSelectedSemesterId(activeSem.id);
      }

      const { data: adminEvents, error: adminErr } = await supabase
        .from('academic_calendar_events')
        .select('*, documentType:document_type_id(name)')
        .eq('school_year_id', currentSy.id);

      if (adminErr) throw adminErr;

      const events = [];

      if (adminEvents) {
        adminEvents.forEach(ev => {
          if (ev.start_date) {
            const semMatch = semsList.find(s => s.id === ev.semester_id);
            events.push({
              id: ev.id,
              title: ev.title,
              org: 'Admin',
              date: new Date(ev.start_date),
              endDate: ev.end_date ? new Date(ev.end_date) : null,
              duration: 0,
              isBlocked: ev.event_type === 'blocked_activity' || ev.event_type === 'blocked' || ev.description === 'BLOCKS_ACTIVITY',
              eventType: ev.event_type,
              semesterId: ev.semester_id,
              semesterName: semMatch?.name || null,
              semesterStart: semMatch?.start_date ? new Date(semMatch.start_date) : null,
              semesterEnd: semMatch?.end_date ? new Date(semMatch.end_date) : null,
              docTypeName: ev.documentType ? ev.documentType.name : null
            });
          }
        });
      }
      
      events.sort((a, b) => a.date - b.date);
      setActivities(events);

      if (currentSy?.start_date && currentSy?.end_date) {
        const now = new Date();
        const syStart = new Date(currentSy.start_date);
        const syEnd = new Date(currentSy.end_date);
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

  const goToToday = () => {
    setCurrentDate(new Date());
  };

  const generateReport = () => {
    const totalEvents = activities.length;
    const blockedCount = activities.filter(a => a.isBlocked).length;
    const windowsCount = activities.filter(a => a.eventType === 'submission_window').length;
    const semesterCount = semesters.length;

    const reportStats = [
      { label: 'Total Scheduled Events', value: totalEvents },
      { label: 'Blocked / Restricted Dates', value: blockedCount },
      { label: 'Submission Windows', value: windowsCount },
      { label: 'Active Semesters', value: semesterCount }
    ];

    const tableHeaders = ['Event / Activity Title', 'Type / Category', 'Date / Period', 'Semester', 'Status'];

    const tableData = activities.map(act => {
      let category = 'Academic Event';
      if (act.isBlocked) {
        category = 'Blocked Date (Prohibited)';
      } else if (act.eventType === 'submission_window') {
        category = `Submission Window (${act.docTypeName || 'Documents'})`;
      }

      const dateDisplay = act.date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) +
        (act.endDate ? ` – ${act.endDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}` : '');

      return [
        act.title,
        category,
        dateDisplay,
        act.semesterName || 'Entire School Year',
        act.isBlocked ? 'BLOCKED' : 'ACTIVE'
      ];
    });

    const syName = activeSy?.name || 'School Year';
    setReportData({
      title: `Academic Calendar & Blocked Dates Report (${syName})`,
      stats: reportStats,
      headers: tableHeaders,
      rows: tableData,
      filename: `Academic_Calendar_Report_${syName.replace(/[^a-z0-9]/gi, '_')}.pdf`
    });
    setIsReportOpen(true);
  };

  // Calendar Grid Calculations
  const getDaysInMonth = (year, month) => new Date(year, month + 1, 0).getDate();
  const getFirstDayOfMonth = (year, month) => new Date(year, month, 1).getDay();

  const daysInMonth = getDaysInMonth(currentDate.getFullYear(), currentDate.getMonth());
  const firstDay = getFirstDayOfMonth(currentDate.getFullYear(), currentDate.getMonth());
  const monthName = currentDate.toLocaleString('default', { month: 'long', year: 'numeric' });

  const renderCalendar = () => {
    const days = [];
    const weekDays = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

    // Weekday Headers
    const headers = weekDays.map(day => (
      <div key={`header-${day}`} className="font-extrabold text-center text-[10px] sm:text-[11px] uppercase tracking-wider py-1.5 sm:py-2.5 text-gray-500 bg-gray-50/80 border-b border-gray-200/80">
        <span className="hidden sm:inline">{day}</span>
        <span className="sm:hidden">{day.charAt(0)}</span>
      </div>
    ));

    // Empty slots before 1st of month
    for (let i = 0; i < firstDay; i++) {
      days.push(
        <div key={`empty-prev-${i}`} className="min-h-[50px] sm:min-h-[105px] border-b border-r border-gray-100 bg-gray-50/30 p-1 sm:p-2"></div>
      );
    }

    // Days with events
    for (let d = 1; d <= daysInMonth; d++) {
      const currentDayDate = new Date(currentDate.getFullYear(), currentDate.getMonth(), d);
      const currentDayMs = currentDayDate.getTime();

      // Find events occurring on this date
      const dayEvents = activities.filter(act => {
        if (act.eventType === 'submission_window') return false;
        if (selectedSemesterId !== 'all' && act.semesterId && act.semesterId !== selectedSemesterId) return false;
        const startMs = new Date(act.date.getFullYear(), act.date.getMonth(), act.date.getDate()).getTime();
        const endMs = act.endDate 
          ? new Date(act.endDate.getFullYear(), act.endDate.getMonth(), act.endDate.getDate()).getTime()
          : startMs;
        
        return currentDayMs >= startMs && currentDayMs <= endMs;
      });

      const blockedEvents = dayEvents.filter(ev => ev.isBlocked);
      const hasBlockedEvent = blockedEvents.length > 0;
      const isToday = new Date().toDateString() === currentDayDate.toDateString();

      const blockedTitle = hasBlockedEvent
        ? `This date cannot be chosen for activity event (${blockedEvents.map(e => e.title).join(', ')})`
        : undefined;

      days.push(
        <div 
          key={d}
          onClick={() => {
            if (dayEvents.length > 0) {
              setSelectedDayDetails({ date: currentDayDate, events: dayEvents, isBlocked: hasBlockedEvent });
            }
          }}
          title={blockedTitle}
          className={`min-h-[50px] sm:min-h-[105px] border-b border-r border-gray-100 p-1 sm:p-2 transition-all relative flex flex-col justify-between group ${
            hasBlockedEvent 
              ? 'bg-rose-50/40 hover:bg-rose-100/50 border-rose-100/70 cursor-pointer' 
              : isToday 
                ? 'bg-emerald-50/20 hover:bg-gray-50/80 cursor-pointer' 
                : dayEvents.length > 0 ? 'hover:bg-gray-50/90 cursor-pointer' : 'hover:bg-gray-50/40'
          }`}
        >
          {/* Day Number Row */}
          <div>
            <div className="flex justify-between items-center mb-0.5 sm:mb-1.5">
              <span className={`text-[10px] sm:text-xs font-bold w-5 h-5 sm:w-6 sm:h-6 flex items-center justify-center rounded-full transition-all ${
                isToday 
                  ? 'bg-primary-green text-white font-extrabold shadow-sm ring-2 ring-emerald-500/20' 
                  : hasBlockedEvent
                    ? 'text-rose-700 font-extrabold'
                    : 'text-gray-700'
              }`}>
                {d}
              </span>

              {hasBlockedEvent && (
                <span className="flex items-center gap-0.5 text-[9px] sm:text-[10px] font-black text-rose-700 bg-rose-100/80 px-1 sm:px-1.5 py-0.5 rounded-full border border-rose-200/80 shrink-0" title={blockedTitle}>
                  <Lock size={10} className="text-rose-600 shrink-0" />
                  <span className="hidden sm:inline">BLOCKED</span>
                </span>
              )}
            </div>

            {/* Display Events (Max 2 visible for clean spacing) */}
            <div className="space-y-1">
              {dayEvents.slice(0, 2).map((ev, idx) => (
                <div 
                  key={idx} 
                  title={ev.isBlocked ? `This date cannot be chosen for activity event (${ev.title})` : ev.title}
                  className={`px-1 sm:px-2 py-0.5 sm:py-1 rounded-md sm:rounded-lg text-[9px] sm:text-[11px] font-bold transition-all truncate flex items-center gap-1 border shadow-2xs ${
                    ev.isBlocked 
                      ? 'bg-rose-100/90 text-rose-900 border-rose-200/80 hover:bg-rose-200/90' 
                      : 'bg-sky-50 text-sky-900 border-sky-200/80 hover:border-sky-300'
                  }`}
                >
                  {ev.isBlocked ? (
                    <ShieldAlert size={10} className="text-rose-600 shrink-0" />
                  ) : (
                    <div className="w-1.5 h-1.5 rounded-full bg-sky-500 shrink-0"></div>
                  )}
                  <span className="truncate hidden sm:inline">{ev.title}</span>
                </div>
              ))}
            </div>
          </div>

          {/* More items overflow badge */}
          {dayEvents.length > 2 && (
            <div className="mt-0.5 flex items-center justify-between text-[9px] sm:text-[10px] font-extrabold text-gray-500 group-hover:text-gray-800">
              <span className="px-1 sm:px-1.5 py-0.5 bg-gray-100 rounded-md border border-gray-200/60">
                +{dayEvents.length - 2}
              </span>
            </div>
          )}
        </div>
      );
    }

    // Trailing empty slots to complete final week row cleanly
    const totalSlots = firstDay + daysInMonth;
    const trailingSlots = (7 - (totalSlots % 7)) % 7;
    for (let i = 0; i < trailingSlots; i++) {
      days.push(
        <div key={`empty-next-${i}`} className="min-h-[50px] sm:min-h-[105px] border-b border-r border-gray-100 bg-gray-50/30 p-1 sm:p-2"></div>
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
        {/* Open Submission Windows Toolbar */}
        {openWindows.length > 0 && (
          <div className="bg-emerald-50/40 border border-emerald-100 rounded-2xl p-3.5 flex flex-wrap items-center justify-between gap-3 shadow-2xs">
            <div className="flex items-center gap-2 text-emerald-900 shrink-0">
              <Sparkles size={16} className="text-emerald-600 animate-pulse" />
              <span className="text-xs font-black uppercase tracking-wider">
                Active Submission Windows
              </span>
            </div>

            <div className="flex items-center gap-2 overflow-x-auto custom-scrollbar max-w-full pb-0.5">
              {openWindows.map((sw, idx) => {
                const winStart = sw.date.toDateString();
                const winEnd = sw.endDate ? sw.endDate.toDateString() : winStart;
                const isEntireSy = (syStart === winStart) && (syEnd === winEnd);

                const matchingSem = semesters.find(sem => {
                  const sStart = sem.start_date ? new Date(sem.start_date).toDateString() : null;
                  const sEnd = sem.end_date ? new Date(sem.end_date).toDateString() : null;
                  return sStart === winStart && sEnd === winEnd;
                });

                const now = new Date();
                const startStr = sw.date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: sw.date.getFullYear() !== now.getFullYear() ? 'numeric' : undefined });
                const endStr = sw.endDate ? sw.endDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: sw.endDate.getFullYear() !== sw.date.getFullYear() ? 'numeric' : undefined }) : '';
                
                let dateDisplay = endStr ? `${startStr} – ${endStr}` : startStr;
                if (isEntireSy) dateDisplay = 'Entire School Year';
                else if (matchingSem) dateDisplay = `Entire ${matchingSem.name}`;
                else if (sw.semesterName) dateDisplay += ` (${sw.semesterName})`;

                return (
                  <div key={idx} className="flex items-center gap-2 px-3 py-1 bg-white border border-emerald-200 rounded-full shadow-2xs shrink-0 text-xs font-bold">
                    <div className="w-2 h-2 rounded-full bg-emerald-500 shadow-[0_0_6px_rgba(16,185,129,0.5)]"></div>
                    <span className="text-gray-800 font-extrabold">{sw.docTypeName || sw.title}</span>
                    <span className="text-gray-300">•</span>
                    <span className="text-emerald-700 text-[11px] font-medium">{dateDisplay}</span>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Calendar Main Grid Container */}
        <div className="bg-white rounded-2xl shadow-xs border border-gray-200 overflow-hidden">
          <div className="grid grid-cols-7 border-b border-gray-200">
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
    const filteredList = activities.filter(act => selectedSemesterId === 'all' || !act.semesterId || act.semesterId === selectedSemesterId);

    if (filteredList.length === 0) {
      return (
        <div className="flex flex-col items-center justify-center p-12 bg-white rounded-2xl border border-gray-200 border-dashed">
          <CalendarIcon size={48} className="text-gray-300 mb-4" />
          <h3 className="text-lg font-bold text-gray-700">No activities scheduled</h3>
          <p className="text-sm text-gray-400 mt-1">There are no academic events for the selected filter.</p>
        </div>
      );
    }

    return (
      <div className="space-y-3">
        {filteredList.map((ev, idx) => (
          <div key={idx} className={`bg-white p-5 rounded-2xl border shadow-2xs hover:shadow-md transition-all flex items-center justify-between gap-5 ${
            ev.isBlocked ? 'border-rose-200/90 bg-rose-50/20' : 'border-gray-100 hover:border-emerald-200'
          }`}>
            <div className="flex items-center gap-4 min-w-0">
              <div className={`w-12 h-12 rounded-xl flex flex-col items-center justify-center shrink-0 border ${
                ev.isBlocked ? 'bg-rose-100 text-rose-800 border-rose-200' : 'bg-emerald-50 text-emerald-800 border-emerald-100'
              }`}>
                <span className="text-[10px] font-extrabold uppercase">{ev.date.toLocaleString('en-US', { month: 'short' })}</span>
                <span className="text-lg font-black leading-none">{ev.date.getDate()}</span>
              </div>
              <div className="truncate">
                <div className="flex items-center gap-2 mb-1">
                  {ev.isBlocked ? (
                    <span className="px-2 py-0.5 rounded-full bg-rose-100 text-rose-800 text-[10px] font-black uppercase tracking-wider flex items-center gap-1 border border-rose-200">
                      <Lock size={10} /> Blocked Activity Date
                    </span>
                  ) : (
                    <span className="px-2 py-0.5 rounded-full bg-blue-50 text-blue-700 text-[10px] font-black uppercase tracking-wider border border-blue-100">
                      Academic Event
                    </span>
                  )}
                  {ev.semesterName && (
                    <span className="text-[10px] text-gray-400 font-bold uppercase">• {ev.semesterName}</span>
                  )}
                </div>
                <h4 className="text-base font-extrabold text-gray-800 truncate">{ev.title}</h4>
              </div>
            </div>

            <div className="text-right shrink-0">
              <div className="text-xs font-bold text-gray-600 flex items-center gap-1.5 justify-end">
                <Clock size={14} className="text-gray-400" />
                <span>{ev.duration === 0 ? 'All Day' : ev.date.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}</span>
              </div>
              {ev.endDate && (
                <div className="text-[11px] font-medium text-gray-400 mt-0.5">
                  until {ev.endDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                </div>
              )}
            </div>
          </div>
        ))}
      </div>
    );
  };

  return (
    <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[99999] flex items-center justify-center p-2 sm:p-6" onClick={onClose}>
      <div className="bg-[#f8fafc] rounded-2xl sm:rounded-3xl shadow-2xl w-full max-w-6xl h-[95vh] sm:h-[92vh] flex flex-col overflow-hidden animate-in zoom-in-95 duration-200 border border-gray-100" onClick={e => e.stopPropagation()}>
        
        {/* Header */}
        <div className="bg-white px-4 sm:px-8 py-3.5 sm:py-5 border-b border-gray-100 flex items-center justify-between shrink-0 sticky top-0 z-10">
          <div className="flex items-center gap-3 sm:gap-4 min-w-0 flex-1">
            <div className="w-9 h-9 sm:w-11 sm:h-11 bg-primary-green/10 text-primary-green rounded-xl sm:rounded-2xl flex items-center justify-center shadow-2xs shrink-0">
              <CalendarIcon size={20} className="sm:w-5 sm:h-5" />
            </div>
            <div className="min-w-0 flex-1">
              <h2 className="text-sm sm:text-xl font-black text-gray-900 tracking-tight truncate">School Year Calendar</h2>
              <p className="text-[10px] sm:text-xs font-bold text-gray-400 mt-0.5 truncate">
                {activeSy ? (
                  <>
                    {activeSy.name} (
                    {new Date(activeSy.start_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                    {' - '}
                    {new Date(activeSy.end_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                    )
                  </>
                ) : 'Loading...'}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 sm:gap-3 shrink-0 ml-2">
            <button
              onClick={generateReport}
              className="flex items-center gap-1.5 sm:gap-2 px-3 sm:px-4 py-1.5 sm:py-2 bg-white border border-gray-200 hover:border-primary-green hover:bg-emerald-50 hover:text-primary-green text-gray-700 text-xs font-bold rounded-xl transition-all shadow-2xs"
            >
              <FileDown size={15} />
              <span className="hidden sm:inline">Export PDF Report</span>
            </button>
            <div className="h-6 w-[1px] bg-gray-200 mx-0.5 hidden sm:block"></div>
            <button
              onClick={onClose}
              className="p-1.5 sm:p-2 text-gray-400 hover:text-gray-700 hover:bg-gray-100 rounded-full transition-colors"
            >
              <X size={20} />
            </button>
          </div>
        </div>

        {/* Unified Control Toolbar & Legend Bar */}
        <div className="px-3 sm:px-8 py-3 bg-white border-b border-gray-100 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 shrink-0 shadow-2xs z-0 relative">
          
          {/* Left Controls: View Switcher & Semester Filter */}
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 sm:gap-3 w-full sm:w-auto">
            <div className="flex bg-gray-100 p-1 rounded-xl w-full sm:w-auto justify-center">
              <button
                onClick={() => setView('calendar')}
                className={`flex-1 sm:flex-initial flex items-center justify-center gap-2 px-3 sm:px-4 py-1.5 rounded-lg text-xs font-extrabold transition-all ${view === 'calendar' ? 'bg-white text-gray-900 shadow-2xs' : 'text-gray-500 hover:text-gray-700'}`}
              >
                <CalendarIcon size={14} /> Calendar
              </button>
              <button
                onClick={() => setView('list')}
                className={`flex-1 sm:flex-initial flex items-center justify-center gap-2 px-3 sm:px-4 py-1.5 rounded-lg text-xs font-extrabold transition-all ${view === 'list' ? 'bg-white text-gray-900 shadow-2xs' : 'text-gray-500 hover:text-gray-700'}`}
              >
                <List size={14} /> List
              </button>
            </div>

            {semesters.length > 0 && (
              <select
                value={selectedSemesterId}
                onChange={e => {
                  const val = e.target.value;
                  setSelectedSemesterId(val);
                  if (val !== 'all') {
                    const matchedSem = semesters.find(s => s.id === val);
                    if (matchedSem?.start_date) {
                      setCurrentDate(new Date(matchedSem.start_date));
                    }
                  }
                }}
                className="w-full sm:w-auto max-w-full truncate px-3 py-1.5 sm:py-2 bg-gray-50 border border-gray-200 rounded-xl text-xs font-bold text-gray-700 outline-none focus:border-primary-green transition-all"
              >
                <option value="all">All Semesters</option>
                {semesters.map(s => (
                  <option key={s.id} value={s.id}>
                    {s.name} {s.is_active ? '(Active)' : ''}
                  </option>
                ))}
              </select>
            )}
          </div>

          {/* Center Month Navigator */}
          {view === 'calendar' && (
            <div className="flex items-center justify-between sm:justify-center gap-2 bg-gray-50 border border-gray-200/80 rounded-xl p-1 shadow-2xs w-full sm:w-auto">
              <button onClick={prevMonth} className="p-1 hover:bg-white rounded-lg text-gray-600 transition-colors shadow-2xs">
                <ChevronLeft size={16} />
              </button>
              <span className="min-w-[110px] sm:min-w-[130px] text-center font-extrabold text-gray-800 text-xs tracking-tight">
                {monthName}
              </span>
              <button onClick={nextMonth} className="p-1 hover:bg-white rounded-lg text-gray-600 transition-colors shadow-2xs">
                <ChevronRight size={16} />
              </button>
              <button 
                onClick={goToToday}
                className="ml-1 px-2.5 py-1 bg-white border border-gray-200 hover:bg-gray-100 text-gray-700 text-[10px] font-extrabold rounded-lg transition-all"
              >
                Today
              </button>
            </div>
          )}

          {/* Right Compact Legend Indicators */}
          <div className="flex flex-wrap items-center justify-center sm:justify-start gap-1.5 sm:gap-3 text-[10px] sm:text-[11px] font-bold text-gray-600 w-full sm:w-auto">
            <div className="flex items-center gap-1.5 bg-rose-50 text-rose-800 px-2 sm:px-2.5 py-0.5 sm:py-1 rounded-md border border-rose-200/80">
              <div className="w-1.5 h-1.5 sm:w-2 sm:h-2 rounded-full bg-rose-600"></div>
              <span>Blocked Date</span>
            </div>
            <div className="flex items-center gap-1.5 bg-emerald-50 text-emerald-800 px-2 sm:px-2.5 py-0.5 sm:py-1 rounded-md border border-emerald-200/80">
              <div className="w-1.5 h-1.5 sm:w-2 sm:h-2 rounded-full bg-emerald-500"></div>
              <span>Open Window</span>
            </div>
            <div className="flex items-center gap-1.5 bg-sky-50 text-sky-800 px-2 sm:px-2.5 py-0.5 sm:py-1 rounded-md border border-sky-200/80">
              <div className="w-1.5 h-1.5 sm:w-2 sm:h-2 rounded-full bg-sky-500"></div>
              <span>Academic Event</span>
            </div>
          </div>

        </div>

        {/* Content View Container */}
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

      {/* Selected Day Event Detail Modal */}
      {selectedDayDetails && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-xs z-[100000] flex items-center justify-center p-4" onClick={() => setSelectedDayDetails(null)}>
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-md overflow-hidden border border-gray-100 animate-in zoom-in-95 duration-200" onClick={e => e.stopPropagation()}>
            <div className={`p-6 text-white flex items-center justify-between ${
              selectedDayDetails.isBlocked ? 'bg-gradient-to-r from-rose-600 to-red-500' : 'bg-gradient-to-r from-emerald-600 to-green-500'
            }`}>
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-white/20 rounded-xl flex items-center justify-center shrink-0">
                  {selectedDayDetails.isBlocked ? <Lock size={20} /> : <CalendarIcon size={20} />}
                </div>
                <div>
                  <h3 className="font-extrabold text-base leading-tight">
                    {selectedDayDetails.date.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })}
                  </h3>
                  <p className="text-white/80 text-xs font-semibold mt-0.5">
                    {selectedDayDetails.isBlocked ? 'Blocked Date (Activity Prohibited)' : 'Scheduled Activities'}
                  </p>
                </div>
              </div>
              <button onClick={() => setSelectedDayDetails(null)} className="p-1 hover:bg-white/20 rounded-full transition-colors text-white">
                <X size={18} />
              </button>
            </div>

            <div className="p-6 space-y-3 max-h-[60vh] overflow-y-auto">
              {selectedDayDetails.isBlocked && (
                <div className="p-3.5 bg-rose-50 border border-rose-200 rounded-2xl flex items-start gap-3">
                  <ShieldAlert className="text-rose-600 shrink-0 mt-0.5" size={18} />
                  <p className="text-xs text-rose-800 font-medium leading-relaxed">
                    This date cannot be chosen for activity proposals as it is designated as a prohibited/blocked activity window.
                  </p>
                </div>
              )}

              <div className="space-y-2">
                {selectedDayDetails.events.map((ev, idx) => (
                  <div key={idx} className="p-4 bg-gray-50 border border-gray-200/80 rounded-2xl space-y-1">
                    <div className="flex items-center justify-between">
                      <span className={`text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded-md ${
                        ev.isBlocked ? 'bg-rose-100 text-rose-800 border border-rose-200' : 'bg-sky-100 text-sky-800 border border-sky-200'
                      }`}>
                        {ev.isBlocked ? 'BLOCKED EVENT' : 'ACADEMIC EVENT'}
                      </span>
                      <span className="text-xs font-bold text-gray-500">{ev.org}</span>
                    </div>
                    <h4 className="font-extrabold text-gray-900 text-sm pt-1">{ev.title}</h4>
                    {ev.endDate && (
                      <p className="text-xs text-gray-400 font-medium">
                        Duration: {ev.date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} – {ev.endDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                      </p>
                    )}
                  </div>
                ))}
              </div>
            </div>

            <div className="p-4 bg-gray-50 border-t border-gray-100 flex justify-end">
              <button
                onClick={() => setSelectedDayDetails(null)}
                className="px-5 py-2 bg-gray-800 hover:bg-black text-white text-xs font-bold rounded-xl transition-all"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Standardized Report Preview Modal */}
      <ReportPreviewModal
        isOpen={isReportOpen}
        onClose={() => setIsReportOpen(false)}
        title={reportData.title}
        stats={reportData.stats}
        tableHeaders={reportData.headers}
        tableData={reportData.rows}
        pdfFilename={reportData.filename}
        schoolYear={activeSy?.name || ''}
        generatedBy={user?.full_name || 'System Administrator'}
      />
    </div>
  );
};

export default SchoolYearCalendarModal;
