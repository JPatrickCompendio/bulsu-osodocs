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
  MapPin,
  Building2,
  Tag,
  Sparkles,
  CheckCircle2
} from 'lucide-react';
import ReportPreviewModal from './ReportPreviewModal';
import GlobalLoader from './GlobalLoader';
import { useAuth } from '../context/AuthContext';
import { fetchApprovedActivitySchedules } from '../utils/activityScheduleFetcher';
import { format, isSameDay, isSameMonth, addMonths, subMonths, startOfMonth, endOfMonth, startOfWeek, endOfWeek, eachDayOfInterval, isWithinInterval } from 'date-fns';

const getWindowRemainingBadge = (endDate) => {
  if (!endDate) return null;
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const end = new Date(endDate.getFullYear(), endDate.getMonth(), endDate.getDate());

  const diffTime = end.getTime() - today.getTime();
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

  if (diffDays === 0) return { label: 'Closes today', bg: 'bg-rose-100 text-rose-800 border-rose-200' };
  if (diffDays === 1) return { label: 'Closes tomorrow', bg: 'bg-amber-100 text-amber-800 border-amber-200' };
  if (diffDays > 1) return { label: `${diffDays} days left`, bg: 'bg-emerald-100 text-emerald-800 border-emerald-200' };
  return { label: 'Closed', bg: 'bg-gray-100 text-gray-600 border-gray-200' };
};

const SchoolYearCalendarModal = ({ activeSy, onClose }) => {
  const { user } = useAuth();
  const [view, setView] = useState('calendar'); // 'calendar' or 'list'
  const [currentDate, setCurrentDate] = useState(new Date());
  const [activities, setActivities] = useState([]);
  const [semesters, setSemesters] = useState([]);
  const [selectedSemesterId, setSelectedSemesterId] = useState('all');
  const [categoryFilter, setCategoryFilter] = useState('ALL'); // 'ALL' | 'APPROVED' | 'ACADEMIC' | 'SUBMISSION_WINDOW' | 'BLOCKED'
  const [activeDayModalDate, setActiveDayModalDate] = useState(null); // Clicked date pop-up modal
  const [loading, setLoading] = useState(true);

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

      // 1. Fetch semesters for current SY
      const { data: semsList } = await supabase
        .from('semesters')
        .select('*')
        .eq('school_year_id', currentSy.id)
        .neq('status', 'archived')
        .order('start_date', { ascending: true });

      setSemesters(semsList || []);

      const activeSem = (semsList || []).find(s => s.is_active);
      if (activeSem) {
        setSelectedSemesterId(activeSem.id);
      }

      // 2. Fetch admin calendar events
      const { data: adminEvents, error: adminErr } = await supabase
        .from('academic_calendar_events')
        .select('*, documentType:document_type_id(name)')
        .eq('school_year_id', currentSy.id);

      if (adminErr) throw adminErr;

      const events = [];

      if (adminEvents) {
        adminEvents.forEach(ev => {
          if (ev.start_date) {
            const semMatch = (semsList || []).find(s => s.id === ev.semester_id);
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
              docTypeName: ev.documentType ? ev.documentType.name : null,
              description: ev.description
            });
          }
        });
      }

      // 3. Fetch approved Activity Proposal schedules for current SY dynamically
      const approvedProposalEvents = await fetchApprovedActivitySchedules(currentSy.id);
      if (approvedProposalEvents && approvedProposalEvents.length > 0) {
        approvedProposalEvents.forEach(actEv => {
          const semMatch = (semsList || []).find(s => {
            if (!s.start_date || !s.end_date) return false;
            const semStart = new Date(s.start_date);
            const semEnd = new Date(s.end_date);
            return actEv.date >= semStart && actEv.date <= semEnd;
          });
          actEv.semesterId = semMatch?.id || null;
          actEv.semesterName = semMatch?.name || null;
          actEv.isActivityProposal = true;
          events.push(actEv);
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

  const nextMonth = () => setCurrentDate(addMonths(currentDate, 1));
  const prevMonth = () => setCurrentDate(subMonths(currentDate, 1));
  const goToToday = () => setCurrentDate(new Date());

  // PDF Report Generation
  const generateReport = () => {
    const totalEvents = activities.length;
    const blockedCount = activities.filter(a => a.isBlocked).length;
    const windowsCount = activities.filter(a => a.eventType === 'submission_window').length;
    const approvedCount = activities.filter(a => a.isActivityProposal).length;

    const reportStats = [
      { label: 'Total Scheduled Events', value: totalEvents },
      { label: 'Approved Activities', value: approvedCount },
      { label: 'Blocked / Blackout Dates', value: blockedCount },
      { label: 'Submission Windows', value: windowsCount }
    ];

    const tableHeaders = ['Title', 'Category', 'Date Range', 'Semester', 'Status'];

    const tableData = activities.map(act => {
      let category = 'Academic Event';
      if (act.isBlocked) category = 'Blocked Date';
      else if (act.isActivityProposal) category = `Approved Activity (${act.orgAbbr || act.org})`;
      else if (act.eventType === 'submission_window') category = `Submission Window (${act.docTypeName || ''})`;

      const dateDisplay = format(act.date, 'MMM d, yyyy') + (act.endDate ? ` – ${format(act.endDate, 'MMM d, yyyy')}` : '');

      return [
        act.title,
        category,
        dateDisplay,
        act.semesterName || 'Entire SY',
        act.isBlocked ? 'BLOCKED' : 'ACTIVE'
      ];
    });

    const syName = activeSy?.name || 'School Year';
    setReportData({
      title: `Academic Calendar Report (${syName})`,
      stats: reportStats,
      headers: tableHeaders,
      rows: tableData,
      filename: `Academic_Calendar_Report_${syName.replace(/[^a-z0-9]/gi, '_')}.pdf`
    });
    setIsReportOpen(true);
  };

  // 1. Filter activities by selected semester (for counts)
  const semesterFilteredActivities = activities.filter(act => {
    if (selectedSemesterId === 'all') return true;
    return !act.semesterId || act.semesterId === selectedSemesterId;
  });

  // Extract counts for live category badges (based on semester selection)
  const approvedCount = semesterFilteredActivities.filter(a => a.isActivityProposal).length;
  const academicEventCount = semesterFilteredActivities.filter(a => !a.isActivityProposal && !a.isBlocked && a.eventType !== 'submission_window').length;
  const submissionWindowCount = semesterFilteredActivities.filter(a => a.eventType === 'submission_window').length;
  const blockedDateCount = semesterFilteredActivities.filter(a => a.isBlocked).length;

  // 2. Final filtered activities (semester + category filter)
  const filteredActivities = semesterFilteredActivities.filter(act => {
    if (categoryFilter === 'APPROVED') return act.isActivityProposal;
    if (categoryFilter === 'ACADEMIC') return !act.isActivityProposal && !act.isBlocked && act.eventType !== 'submission_window';
    if (categoryFilter === 'SUBMISSION_WINDOW') return act.eventType === 'submission_window';
    if (categoryFilter === 'BLOCKED') return act.isBlocked;
    return true;
  });

  // Active submission windows
  const submissionWindows = activities.filter(act => act.eventType === 'submission_window');
  const openWindows = submissionWindows.filter(sw => {
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const start = new Date(sw.date.getFullYear(), sw.date.getMonth(), sw.date.getDate());
    const end = sw.endDate ? new Date(sw.endDate.getFullYear(), sw.endDate.getMonth(), sw.endDate.getDate()) : start;
    return today >= start && today <= end;
  });

  // Month grid calculation for Calendar View
  const monthStart = startOfMonth(currentDate);
  const monthEnd = endOfMonth(monthStart);
  const calendarStartDate = startOfWeek(monthStart);
  const calendarEndDate = endOfWeek(monthEnd);
  const calendarDays = eachDayOfInterval({ start: calendarStartDate, end: calendarEndDate });

  // Get events on a specific day (excluding submission windows from grid)
  const getEventsForDay = (day) => {
    return filteredActivities.filter(act => {
      if (act.eventType === 'submission_window') return false;
      try {
        const start = new Date(act.date);
        const end = act.endDate ? new Date(act.endDate) : new Date(act.date);
        start.setHours(0, 0, 0, 0);
        end.setHours(23, 59, 59, 999);
        return isWithinInterval(day, { start, end });
      } catch {
        return false;
      }
    });
  };

  // Get active submission windows for a specific day
  const getSubmissionWindowsForDay = (day) => {
    if (!day) return [];
    return submissionWindows.filter(sw => {
      try {
        const start = new Date(sw.date);
        const end = sw.endDate ? new Date(sw.endDate) : new Date(sw.date);
        start.setHours(0, 0, 0, 0);
        end.setHours(23, 59, 59, 999);
        return isWithinInterval(day, { start, end });
      } catch {
        return false;
      }
    });
  };

  return (
    <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs z-[99999] flex items-center justify-center p-3 sm:p-6" onClick={onClose}>
      <div className="bg-white rounded-3xl shadow-2xl w-full max-w-7xl h-[95vh] flex flex-col overflow-hidden animate-in zoom-in-95 duration-150 border border-gray-100" onClick={e => e.stopPropagation()}>

        {/* Modal Top Header with Mathematically Centered Month Controls */}
        <div className="px-6 py-3.5 border-b border-gray-100 grid grid-cols-1 md:grid-cols-3 items-center justify-between gap-3 shrink-0 bg-white">
          {/* Left: Title & Subtitle */}
          <div className="flex items-center gap-3.5 justify-start">
            <div className="w-10 h-10 bg-emerald-100/70 text-emerald-800 rounded-xl flex items-center justify-center border border-emerald-200/50 shrink-0">
              <CalendarIcon size={20} className="text-emerald-700" />
            </div>
            <div>
              <h2 className="text-lg font-black text-gray-900 tracking-tight">School Year Calendar</h2>
              <p className="text-xs font-semibold text-gray-400 mt-0.5">
                {activeSy ? (
                  <>
                    {activeSy.name} ({format(new Date(activeSy.start_date), 'MMM d, yyyy')} - {format(new Date(activeSy.end_date), 'MMM d, yyyy')})
                  </>
                ) : 'Academic Calendar'}
              </p>
            </div>
          </div>

          {/* Center: Month Navigation Controls (Perfectly Centered) */}
          <div className="flex items-center justify-center w-full">
            {view === 'calendar' && (
              <div className="flex items-center gap-1.5 bg-gray-50 p-1 border border-gray-200 rounded-xl shadow-2xs">
                <button
                  onClick={prevMonth}
                  className="p-1 hover:bg-gray-200 text-gray-600 rounded-lg transition"
                >
                  <ChevronLeft size={15} />
                </button>
                <span className="min-w-[125px] text-center font-extrabold text-gray-900 text-xs">
                  {format(currentDate, 'MMMM yyyy')}
                </span>
                <button
                  onClick={nextMonth}
                  className="p-1 hover:bg-gray-200 text-gray-600 rounded-lg transition"
                >
                  <ChevronRight size={15} />
                </button>
                <button
                  onClick={goToToday}
                  className="ml-1 px-2.5 py-0.5 bg-white border border-gray-200 hover:bg-gray-100 text-gray-700 text-xs font-bold rounded-md transition shadow-2xs"
                >
                  Today
                </button>
              </div>
            )}
          </div>

          {/* Right: Export PDF & Close Button */}
          <div className="flex items-center gap-3 justify-end">
            <button
              onClick={generateReport}
              className="flex items-center gap-2 px-3.5 py-1.5 bg-white border border-gray-200 hover:bg-gray-50 text-gray-700 text-xs font-extrabold rounded-xl transition shadow-2xs"
            >
              <FileDown size={14} className="text-gray-500" />
              <span>Export PDF Report</span>
            </button>

            <div className="h-5 w-[1px] bg-gray-200" />

            <button
              onClick={onClose}
              className="p-1 text-gray-400 hover:text-gray-600 rounded-lg transition"
            >
              <X size={18} />
            </button>
          </div>
        </div>

        {/* Modal Toolbar: View Switcher, Semester Filter & Filter Pills (Now with extra room!) */}
        <div className="px-6 py-3 border-b border-gray-100 flex flex-col md:flex-row items-center justify-between gap-3 shrink-0 bg-white">
          {/* Left Controls: View Switcher + Semester Select */}
          <div className="flex items-center gap-3 shrink-0">
            {/* View Mode Switcher */}
            <div className="flex bg-gray-100/80 p-1 rounded-xl border border-gray-200/80">
              <button
                onClick={() => setView('calendar')}
                className={`flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-extrabold transition ${view === 'calendar' ? 'bg-white text-gray-900 shadow-2xs' : 'text-gray-500 hover:text-gray-700'}`}
              >
                <CalendarIcon size={13} /> Calendar
              </button>
              <button
                onClick={() => setView('list')}
                className={`flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-extrabold transition ${view === 'list' ? 'bg-white text-gray-900 shadow-2xs' : 'text-gray-500 hover:text-gray-700'}`}
              >
                <List size={13} /> List
              </button>
            </div>

            {/* Semester Filter Dropdown */}
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
                className="px-3.5 py-1.5 bg-white border border-gray-200 rounded-xl text-xs font-bold text-gray-700 outline-none focus:border-purple-600 transition shadow-2xs"
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

          {/* Right Controls: Legend Filter Indicators (Extra Room) */}
          <div className="flex items-center gap-2 overflow-x-auto pb-0.5 [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden">
            {/* Org Activity Pill */}
            <button
              onClick={() => setCategoryFilter(prev => prev === 'APPROVED' ? 'ALL' : 'APPROVED')}
              className={`flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-bold shrink-0 transition-all cursor-pointer border ${categoryFilter === 'APPROVED'
                  ? 'bg-purple-600 text-white border-purple-700 shadow-md'
                  : 'bg-purple-50 hover:bg-purple-100 text-purple-700 border-purple-200/80'
                }`}
            >
              <span className={`w-2 h-2 rounded-full ${categoryFilter === 'APPROVED' ? 'bg-white' : 'bg-purple-600'}`} />
              <span>Org Activity</span>
            </button>

            {/* Blocked Date Pill */}
            <button
              onClick={() => setCategoryFilter(prev => prev === 'BLOCKED' ? 'ALL' : 'BLOCKED')}
              className={`flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-bold shrink-0 transition-all cursor-pointer border ${categoryFilter === 'BLOCKED'
                  ? 'bg-rose-600 text-white border-rose-700 shadow-md'
                  : 'bg-rose-50 hover:bg-rose-100 text-rose-700 border-rose-200/80'
                }`}
            >
              <span className={`w-2 h-2 rounded-full ${categoryFilter === 'BLOCKED' ? 'bg-white' : 'bg-rose-500'}`} />
              <span>Blocked Date</span>
            </button>

            {/* Open Window Pill */}
            <button
              onClick={() => setCategoryFilter(prev => prev === 'SUBMISSION_WINDOW' ? 'ALL' : 'SUBMISSION_WINDOW')}
              className={`flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-bold shrink-0 transition-all cursor-pointer border ${categoryFilter === 'SUBMISSION_WINDOW'
                  ? 'bg-emerald-600 text-white border-emerald-700 shadow-md'
                  : 'bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border-emerald-200/80'
                }`}
            >
              <span className={`w-2 h-2 rounded-full ${categoryFilter === 'SUBMISSION_WINDOW' ? 'bg-white' : 'bg-emerald-500'}`} />
              <span>Open Window</span>
            </button>

            {/* Academic Event Pill */}
            <button
              onClick={() => setCategoryFilter(prev => prev === 'ACADEMIC' ? 'ALL' : 'ACADEMIC')}
              className={`flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-bold shrink-0 transition-all cursor-pointer border ${categoryFilter === 'ACADEMIC'
                  ? 'bg-sky-600 text-white border-sky-700 shadow-md'
                  : 'bg-sky-50 hover:bg-sky-100 text-sky-700 border-sky-200/80'
                }`}
            >
              <span className={`w-2 h-2 rounded-full ${categoryFilter === 'ACADEMIC' ? 'bg-white' : 'bg-sky-500'}`} />
              <span>Academic Event</span>
            </button>

            {categoryFilter !== 'ALL' && (
              <button
                onClick={() => setCategoryFilter('ALL')}
                className="text-[10px] font-extrabold text-gray-500 hover:text-gray-800 underline ml-1 shrink-0"
              >
                Reset
              </button>
            )}
          </div>
        </div>

        {/* Modal Scrollable Body */}
        <div className="flex-1 overflow-y-auto p-5 sm:p-6 bg-gray-50/50 space-y-5">
          {loading ? (
            <div className="h-full flex items-center justify-center p-12">
              <GlobalLoader />
            </div>
          ) : (
            <>
              {/* TOP BANNER: ACTIVE SUBMISSION WINDOWS (HORIZONTAL ROW MATCHING PICTURE 1) */}
              {openWindows.length > 0 && (
                <div className="bg-emerald-50/50 border border-emerald-200/70 rounded-2xl px-5 py-3 flex items-center justify-between flex-wrap gap-3 shadow-2xs">
                  <div className="flex items-center gap-2">
                    <Sparkles size={16} className="text-emerald-700" />
                    <h4 className="text-xs font-black uppercase tracking-wider text-emerald-900">
                      ACTIVE SUBMISSION WINDOWS
                    </h4>
                  </div>

                  <div className="flex items-center gap-2 flex-wrap">
                    {openWindows.map((sw, idx) => (
                      <div
                        key={idx}
                        className="flex items-center gap-2 px-3.5 py-1.5 bg-white border border-emerald-300/80 rounded-full text-xs font-bold shadow-2xs"
                      >
                        <span className="w-2 h-2 rounded-full bg-emerald-500 shrink-0" />
                        <span className="text-gray-900 font-extrabold">{sw.docTypeName || sw.title}</span>
                        <span className="text-gray-300 font-bold">·</span>
                        <span className="text-emerald-700 font-bold text-[11px]">
                          {sw.endDate ? `${format(sw.date, 'MMM d')} – ${format(sw.endDate, 'MMM d')}` : 'Entire School Year'}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* CALENDAR VIEW OR LIST VIEW */}
              {view === 'calendar' ? (
                /* FULL WIDTH CALENDAR GRID (WITHOUT RIGHT SIDEBAR) */
                <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden shadow-2xs w-full">
                  {/* Weekday Headers */}
                  <div className="grid grid-cols-7 border-b border-gray-200 bg-gray-50/80 text-center py-2 text.11px] font-extrabold text-gray-500 uppercase tracking-wider">
                    <span>SUN</span>
                    <span>MON</span>
                    <span>TUE</span>
                    <span>WED</span>
                    <span>THU</span>
                    <span>FRI</span>
                    <span>SAT</span>
                  </div>

                  {/* Day Cells Grid */}
                  <div className="grid grid-cols-7 border-l border-t border-gray-100">
                    {calendarDays.map((day) => {
                      const dayEvents = getEventsForDay(day);
                      const isCurrentMonth = isSameMonth(day, currentDate);
                      const isTodayDay = isSameDay(day, new Date());

                      const hasApproved = dayEvents.some(e => e.isActivityProposal);
                      const hasAcademic = dayEvents.some(e => !e.isActivityProposal && !e.isBlocked);
                      const hasBlocked = dayEvents.some(e => e.isBlocked);

                      return (
                        <div
                          key={day.toString()}
                          onClick={() => {
                            setActiveDayModalDate(day);
                          }}
                          className={`min-h-[115px] p-2 border-b border-r border-gray-100 transition flex flex-col justify-between cursor-pointer group ${!isCurrentMonth
                              ? 'bg-gray-50/40 text-gray-300'
                              : 'bg-white text-gray-800 hover:bg-purple-50/20'
                            }`}
                        >
                          <div>
                            {/* Day Header Row: Date number on Left + Indicator Dots on Right */}
                            <div className="flex items-center justify-between mb-1.5">
                              <span className={`text-xs font-bold w-6 h-6 flex items-center justify-center rounded-full transition ${isTodayDay
                                  ? 'bg-purple-700 text-white font-black shadow-2xs'
                                  : !isCurrentMonth
                                    ? 'text-gray-300'
                                    : 'text-gray-700 group-hover:text-purple-700'
                                }`}>
                                {format(day, 'd')}
                              </span>

                              {/* Category indicator dots in header */}
                              <div className="flex items-center gap-1">
                                {hasApproved && <span className="w-1.5 h-1.5 rounded-full bg-purple-600" title="Approved activity" />}
                                {hasAcademic && <span className="w-1.5 h-1.5 rounded-full bg-sky-500" title="Academic event" />}
                                {hasBlocked && <span className="w-1.5 h-1.5 rounded-full bg-rose-500" title="Blocked date" />}
                              </div>
                            </div>

                            {/* Activity Cards inside Day Cell (with Venue / Location!) */}
                            <div className="space-y-1 overflow-hidden">
                              {dayEvents.slice(0, 2).map((ev, idx) => (
                                <div
                                  key={idx}
                                  className={`p-1.5 rounded-md text-[10px] font-bold border transition overflow-hidden space-y-0.5 ${ev.isBlocked
                                      ? 'bg-rose-50 text-rose-900 border-rose-200'
                                      : ev.isActivityProposal
                                        ? 'bg-purple-50 text-purple-900 border-purple-200'
                                        : 'bg-sky-50 text-sky-900 border-sky-200'
                                    }`}
                                  title={`${ev.title} - ${ev.org || ''} (${ev.venue || 'No venue'})`}
                                >
                                  <div className="flex items-center gap-1">
                                    <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${ev.isBlocked ? 'bg-rose-500' : ev.isActivityProposal ? 'bg-purple-600' : 'bg-sky-500'
                                      }`} />
                                    <span className="truncate font-extrabold leading-tight">{ev.title}</span>
                                  </div>

                                  {/* Venue / Location Line as requested */}
                                  {ev.venue && ev.venue !== 'N/A' && (
                                    <div className="truncate text-[9px] text-gray-500 font-semibold pl-2.5 flex items-center gap-0.5">
                                      <MapPin size={9} className="text-gray-400 shrink-0" />
                                      <span className="truncate">{ev.venue}</span>
                                    </div>
                                  )}
                                </div>
                              ))}
                            </div>
                          </div>

                          {/* Overflow Badge */}
                          {dayEvents.length > 2 && (
                            <div className="text-[9px] font-extrabold text-purple-600 group-hover:underline pt-0.5">
                              +{dayEvents.length - 2} more
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              ) : (
                /* LIST VIEW MODE */
                <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden shadow-2xs">
                  <table className="w-full text-left text-sm">
                    <thead className="bg-[#073c2d] text-white font-bold border-b border-[#073c2d] uppercase tracking-wider text-xs">
                      <tr>
                        <th className="px-4 py-3.5 text-white">Event Title & Org</th>
                        <th className="px-4 py-3.5 text-white">Category</th>
                        <th className="px-4 py-3.5 text-white">Schedule Date</th>
                        <th className="px-4 py-3.5 text-white">Semester</th>
                        <th className="px-4 py-3.5 text-center text-white">Status</th>
                      </tr>
                    </thead>

                    <tbody className="divide-y divide-gray-100">
                      {filteredActivities.map((act, idx) => (
                        <tr key={idx} className="hover:bg-purple-50/20 transition">
                          <td className="px-4 py-4 font-extrabold text-gray-900">
                            <div>
                              <div className="text-sm font-extrabold text-gray-900">{act.title}</div>
                              {act.org && (
                                <div className="text-xs font-bold text-purple-700 mt-0.5">
                                  {act.org}
                                </div>
                              )}
                              {act.venue && act.venue !== 'N/A' && (
                                <div className="text-xs text-gray-500 font-medium flex items-center gap-1 mt-0.5">
                                  <MapPin size={12} className="text-gray-400 shrink-0" />
                                  <span>{act.venue}</span>
                                </div>
                              )}
                            </div>
                          </td>

                          <td className="px-4 py-4 text-xs font-semibold">
                            {act.isBlocked ? (
                              <span className="px-2.5 py-1 rounded-full bg-rose-100 text-rose-800 font-bold border border-rose-200">
                                🔴 Blocked Date
                              </span>
                            ) : act.isActivityProposal ? (
                              <span className="px-2.5 py-1 rounded-full bg-purple-100 text-purple-800 font-bold border border-purple-200">
                                🟣 Approved Activity
                              </span>
                            ) : (
                              <span className="px-2.5 py-1 rounded-full bg-sky-100 text-sky-800 font-bold border border-sky-200">
                                🔵 Academic Event
                              </span>
                            )}
                          </td>

                          <td className="px-4 py-4 text-xs font-semibold text-gray-700">
                            {format(act.date, 'MMM d, yyyy')}
                            {act.endDate && ` – ${format(act.endDate, 'MMM d, yyyy')}`}
                          </td>

                          <td className="px-4 py-4 text-xs font-semibold text-gray-600">
                            {act.semesterName || 'Entire SY'}
                          </td>

                          <td className="px-4 py-4 text-center">
                            <span className={`px-2.5 py-1 rounded-full text-[10px] font-black uppercase ${act.isBlocked ? 'bg-rose-100 text-rose-800' : 'bg-emerald-100 text-emerald-800'
                              }`}>
                              {act.isBlocked ? 'BLOCKED' : 'ACTIVE'}
                            </span>
                          </td>
                        </tr>
                      ))}

                      {filteredActivities.length === 0 && (
                        <tr>
                          <td colSpan="5" className="p-12 text-center text-gray-400 font-semibold">
                            No calendar events found for the selected filter.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              )}
            </>
          )}
        </div>

      </div>

      {/* CLICKED DATE DETAILS POPUP MODAL (REPLACES RIGHT SIDEBAR) */}
      {activeDayModalDate && (
        <div
          className="fixed inset-0 bg-black/50 backdrop-blur-xs z-[100000] flex items-center justify-center p-4"
          onClick={() => setActiveDayModalDate(null)}
        >
          <div
            className="bg-white rounded-3xl shadow-2xl w-full max-w-lg overflow-hidden border border-gray-100 animate-in zoom-in-95 duration-150"
            onClick={e => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div className="p-5 bg-gradient-to-r from-purple-700 to-indigo-700 text-white flex items-center justify-between">
              <div>
                <div className="text-[10px] font-black uppercase tracking-wider text-purple-200">
                  {format(activeDayModalDate, 'EEEE')}
                </div>
                <h3 className="font-extrabold text-base leading-tight">
                  {format(activeDayModalDate, 'MMMM d, yyyy')}
                </h3>
                <p className="text-purple-100 text-xs font-semibold mt-0.5">
                  {getEventsForDay(activeDayModalDate).length} entri{getEventsForDay(activeDayModalDate).length === 1 ? 'y' : 'es'} on this date
                </p>
              </div>

              <button
                onClick={() => setActiveDayModalDate(null)}
                className="p-1 hover:bg-white/20 rounded-full transition text-white font-extrabold text-sm"
              >
                ✕
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-5 space-y-4 max-h-[65vh] overflow-y-auto">

              {/* Event Cards List */}
              <div className="space-y-3">
                {getEventsForDay(activeDayModalDate).length === 0 ? (
                  <div className="p-8 text-center text-gray-400 font-semibold text-xs border border-dashed border-gray-200 rounded-2xl">
                    No scheduled activities or blackout dates on this day.
                  </div>
                ) : (
                  getEventsForDay(activeDayModalDate).map((ev, idx) => (
                    <div
                      key={idx}
                      className={`p-4 rounded-2xl border transition space-y-2 ${ev.isActivityProposal
                          ? 'border-2 border-purple-600 bg-purple-50/20 shadow-2xs'
                          : ev.isBlocked
                            ? 'border-2 border-rose-500 bg-rose-50/20 shadow-2xs'
                            : 'border border-gray-200 bg-white shadow-2xs'
                        }`}
                    >
                      <div className="flex items-center justify-between gap-2 flex-wrap">
                        <span className={`px-2 py-0.5 rounded-full text-[10px] font-extrabold uppercase ${ev.isBlocked
                            ? 'bg-rose-100 text-rose-800'
                            : ev.isActivityProposal
                              ? 'bg-purple-100 text-purple-800'
                              : 'bg-sky-100 text-sky-800'
                          }`}>
                          {ev.isBlocked ? '🔴 Blocked date' : ev.isActivityProposal ? '🟣 Approved activity' : '🔵 Academic event'}
                        </span>

                        {ev.org && (
                          <span className="bg-gray-100 text-gray-700 text-[10px] font-bold px-2 py-0.5 rounded-md border border-gray-200">
                            {ev.orgAbbr || ev.org}
                          </span>
                        )}
                      </div>

                      <h4 className="font-extrabold text-xs text-gray-900 leading-snug">
                        {ev.title}
                      </h4>

                      <div className="space-y-1 text-[11px] text-gray-600 font-medium pt-1">
                        <div className="flex items-center gap-1.5">
                          <Clock size={12} className="text-gray-400 shrink-0" />
                          <span>
                            {ev.endDate && !isSameDay(ev.date, ev.endDate)
                              ? `Multi-day · ${format(ev.date, 'MMM d')} – ${format(ev.endDate, 'MMM d, yyyy')}`
                              : format(ev.date, 'MMM d, yyyy')}
                          </span>
                        </div>

                        {ev.venue && ev.venue !== 'N/A' && (
                          <div className="flex items-center gap-1.5">
                            <MapPin size={12} className="text-gray-400 shrink-0" />
                            <span>{ev.venue}</span>
                          </div>
                        )}

                        {ev.org && ev.org !== 'Admin' && (
                          <div className="flex items-center gap-1.5">
                            <Building2 size={12} className="text-gray-400 shrink-0" />
                            <span>{ev.org}</span>
                          </div>
                        )}

                        {ev.trackingNumber && (
                          <div className="flex items-center gap-1.5 text-purple-700 font-bold pt-0.5">
                            <Tag size={12} className="shrink-0" />
                            <span>#{ev.trackingNumber}</span>
                          </div>
                        )}
                      </div>
                    </div>
                  ))
                )}
              </div>

              {/* Active Submission Windows on this Date */}
              {getSubmissionWindowsForDay(activeDayModalDate).length > 0 && (
                <div className="pt-3 border-t border-gray-100 space-y-2">
                  <div className="text-[10px] font-black uppercase tracking-wider text-gray-400">
                    SUBMISSION WINDOWS OPEN ON THIS DATE
                  </div>
                  {getSubmissionWindowsForDay(activeDayModalDate).map((sw, idx) => {
                    const badge = getWindowRemainingBadge(sw.endDate);
                    return (
                      <div key={idx} className="p-3 bg-emerald-50/60 border border-emerald-200 rounded-xl space-y-1">
                        <div className="flex items-center justify-between gap-2">
                          <h5 className="font-extrabold text-xs text-emerald-950">{sw.docTypeName || sw.title}</h5>
                          {badge && (
                            <span className={`px-2 py-0.5 rounded-full text-[9px] font-extrabold border ${badge.bg}`}>
                              {badge.label}
                            </span>
                          )}
                        </div>
                        <div className="text-[10px] text-gray-500 font-semibold">
                          {format(sw.date, 'MMM d')} – {sw.endDate ? format(sw.endDate, 'MMM d, yyyy') : 'Entire SY'}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}

            </div>

            {/* Modal Footer */}
            <div className="p-4 bg-gray-50 border-t border-gray-100 flex justify-end">
              <button
                onClick={() => setActiveDayModalDate(null)}
                className="px-5 py-2 bg-gray-900 hover:bg-black text-white text-xs font-bold rounded-xl transition"
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
