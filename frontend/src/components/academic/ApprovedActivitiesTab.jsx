import React, { useState } from 'react';
import { 
  CheckCircle2, Search, Calendar as CalendarIcon, Clock, MapPin, Building2, 
  Download, LayoutList, CalendarDays, ChevronLeft, ChevronRight, Info, ChevronRight as ChevronRightIcon
} from 'lucide-react';
import { 
  format, addMonths, subMonths, startOfMonth, endOfMonth, 
  startOfWeek, endOfWeek, eachDayOfInterval, isSameMonth, isSameDay, isWithinInterval 
} from 'date-fns';
import { YearScopePicker } from './YearScopePicker';
import { getScheduleStatus } from '../../utils/activityScheduleFetcher';

const getStatusBorderClass = (statusKey) => {
  switch (statusKey) {
    case 'ONGOING':
      return 'border-l-emerald-500';
    case 'UPCOMING':
      return 'border-l-amber-500';
    case 'COMPLETED':
      return 'border-l-purple-500';
    default:
      return 'border-l-purple-500';
  }
};

const getRelativeDateString = (startDate, endDate) => {
  if (!startDate) return '';
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const start = new Date(startDate.getFullYear(), startDate.getMonth(), startDate.getDate());
  const end = endDate ? new Date(endDate.getFullYear(), endDate.getMonth(), endDate.getDate()) : start;

  if (today >= start && today <= end) return 'Happening now';
  const diffTime = start.getTime() - today.getTime();
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  
  if (diffDays > 0) return `In ${diffDays} day${diffDays > 1 ? 's' : ''}`;
  const agoDays = Math.abs(diffDays);
  return `${agoDays} day${agoDays > 1 ? 's' : ''} ago`;
};

export function ApprovedActivitiesTab({
  schoolYears,
  approvedActivities = [],
  selectedSyId,
  onSelectSy,
  loading = false
}) {
  const [viewMode, setViewMode] = useState('calendar');
  const [searchTerm, setSearchTerm] = useState('');
  const [orgFilter, setOrgFilter] = useState('ALL');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [selectedDayActivities, setSelectedDayActivities] = useState(null);

  const selectedSy = schoolYears.find(sy => sy.id === selectedSyId) || schoolYears.find(sy => sy.is_active) || schoolYears[0];

  // Map activities with calculated status
  const activitiesWithStatus = approvedActivities.map(act => ({
    ...act,
    scheduleStatus: getScheduleStatus(act.date, act.endDate)
  }));

  // Calculate status counts
  const ongoingCount = activitiesWithStatus.filter(a => a.scheduleStatus.key === 'ONGOING').length;
  const upcomingCount = activitiesWithStatus.filter(a => a.scheduleStatus.key === 'UPCOMING').length;
  const completedCount = activitiesWithStatus.filter(a => a.scheduleStatus.key === 'COMPLETED').length;

  // Extract unique orgs for filter dropdown
  const uniqueOrgs = Array.from(new Set(activitiesWithStatus.map(a => a.org).filter(Boolean)));

  // Filter activities based on Search, Org, and Status
  const filteredActivities = activitiesWithStatus.filter(act => {
    const matchesSearch = searchTerm === '' || 
      (act.title && act.title.toLowerCase().includes(searchTerm.toLowerCase())) ||
      (act.org && act.org.toLowerCase().includes(searchTerm.toLowerCase())) ||
      (act.venue && act.venue.toLowerCase().includes(searchTerm.toLowerCase())) ||
      (act.trackingNumber && act.trackingNumber.toLowerCase().includes(searchTerm.toLowerCase()));

    const matchesOrg = orgFilter === 'ALL' || act.org === orgFilter;
    const matchesStatus = statusFilter === 'ALL' || act.scheduleStatus.key === statusFilter;

    return matchesSearch && matchesOrg && matchesStatus;
  });

  // Activities for the selected month in Calendar View
  const monthActivities = filteredActivities.filter(act => {
    if (!act.date) return false;
    return isSameMonth(act.date, currentMonth) || (act.endDate && isSameMonth(act.endDate, currentMonth));
  });

  // Month grid calculation for Calendar View
  const monthStart = startOfMonth(currentMonth);
  const monthEnd = endOfMonth(monthStart);
  const calendarStartDate = startOfWeek(monthStart);
  const calendarEndDate = endOfWeek(monthEnd);
  const calendarDays = eachDayOfInterval({ start: calendarStartDate, end: calendarEndDate });

  const nextMonth = () => setCurrentMonth(addMonths(currentMonth, 1));
  const prevMonth = () => setCurrentMonth(subMonths(currentMonth, 1));

  // Find activities for a specific day in calendar view
  const getActivitiesForDay = (day) => {
    return filteredActivities.filter(act => {
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
  };

  // CSV Export Handler
  const handleExportCSV = () => {
    if (!filteredActivities || filteredActivities.length === 0) return;
    const headers = ['Title', 'Organization', 'Venue', 'Date', 'End Date', 'Start Time', 'End Time', 'Tracking Number', 'Status'];
    const rows = filteredActivities.map(act => [
      `"${(act.title || '').replace(/"/g, '""')}"`,
      `"${(act.org || '').replace(/"/g, '""')}"`,
      `"${(act.venue || '').replace(/"/g, '""')}"`,
      `"${act.date ? format(act.date, 'yyyy-MM-dd') : ''}"`,
      `"${act.endDate ? format(act.endDate, 'yyyy-MM-dd') : ''}"`,
      `"${act.formattedStartTime || act.startTime || ''}"`,
      `"${act.formattedEndTime || act.endTime || ''}"`,
      `"${act.trackingNumber || ''}"`,
      `"${act.scheduleStatus?.label || ''}"`
    ]);

    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map(e => e.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `approved_activities_${selectedSy?.name || 'export'}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="space-y-6">
      {/* Top Scope Selector */}
      <YearScopePicker
        schoolYears={schoolYears}
        selectedSyId={selectedSyId}
        onSelectSy={onSelectSy}
      />

      {/* Stats Overview Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Card 1: ALL ACTIVITIES */}
        <button
          onClick={() => setStatusFilter('ALL')}
          className={`p-5 rounded-2xl bg-white border text-left transition-all shadow-2xs ${
            statusFilter === 'ALL'
              ? 'border-2 border-purple-600 shadow-md ring-2 ring-purple-600/10'
              : 'border-gray-200 hover:border-gray-300'
          }`}
        >
          <div className="text-xs font-black uppercase tracking-wider text-purple-700">ALL ACTIVITIES</div>
          <div className="text-2xl font-black text-gray-900 mt-1">{approvedActivities.length}</div>
          <div className="text-xs font-bold text-gray-400 mt-0.5">schedules in scope</div>
        </button>

        {/* Card 2: ONGOING */}
        <button
          onClick={() => setStatusFilter('ONGOING')}
          className={`p-5 rounded-2xl bg-white border text-left transition-all shadow-2xs ${
            statusFilter === 'ONGOING'
              ? 'border-2 border-emerald-600 shadow-md ring-2 ring-emerald-600/10'
              : 'border-gray-200 hover:border-gray-300'
          }`}
        >
          <div className="flex items-center gap-1.5 text-xs font-black uppercase tracking-wider text-gray-700">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
            <span>ONGOING</span>
          </div>
          <div className="text-2xl font-black text-gray-900 mt-1">{ongoingCount}</div>
          <div className="text-xs font-bold text-gray-400 mt-0.5">happening now</div>
        </button>

        {/* Card 3: UPCOMING */}
        <button
          onClick={() => setStatusFilter('UPCOMING')}
          className={`p-5 rounded-2xl bg-white border text-left transition-all shadow-2xs ${
            statusFilter === 'UPCOMING'
              ? 'border-2 border-amber-600 shadow-md ring-2 ring-amber-600/10'
              : 'border-gray-200 hover:border-gray-300'
          }`}
        >
          <div className="flex items-center gap-1.5 text-xs font-black uppercase tracking-wider text-gray-700">
            <span className="w-2 h-2 rounded-full bg-amber-500" />
            <span>UPCOMING</span>
          </div>
          <div className="text-2xl font-black text-gray-900 mt-1">{upcomingCount}</div>
          <div className="text-xs font-bold text-gray-400 mt-0.5">not yet started</div>
        </button>

        {/* Card 4: COMPLETED */}
        <button
          onClick={() => setStatusFilter('COMPLETED')}
          className={`p-5 rounded-2xl bg-white border text-left transition-all shadow-2xs ${
            statusFilter === 'COMPLETED'
              ? 'border-2 border-slate-600 shadow-md ring-2 ring-slate-600/10'
              : 'border-gray-200 hover:border-gray-300'
          }`}
        >
          <div className="flex items-center gap-1.5 text-xs font-black uppercase tracking-wider text-gray-700">
            <span className="w-2 h-2 rounded-full bg-slate-400" />
            <span>COMPLETED</span>
          </div>
          <div className="text-2xl font-black text-gray-900 mt-1">{completedCount}</div>
          <div className="text-xs font-bold text-gray-400 mt-0.5">already finished</div>
        </button>
      </div>

      {/* Main Activity Schedules Card Container */}
      <div className="bg-white rounded-2xl border border-gray-200 shadow-xs p-5 sm:p-6 space-y-5">
        {/* Controls Toolbar: Search, Org Dropdown, Count, Export, View Toggle */}
        <div className="flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-3 pt-1">
          {/* Left Controls: Search & Org Select */}
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 flex-1">
            <div className="relative flex-1 max-w-md">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={15} />
              <input
                type="text"
                placeholder="Search title, organization, venue, or trac"
                value={searchTerm}
                onChange={e => setSearchTerm(e.target.value)}
                className="w-full pl-9 pr-3 py-2 bg-white border border-gray-200 rounded-xl text-xs font-medium outline-none focus:border-purple-600 transition shadow-2xs"
              />
            </div>

            <select
              value={orgFilter}
              onChange={e => setOrgFilter(e.target.value)}
              className="px-3 py-2 bg-white border border-gray-200 rounded-xl text-xs font-bold text-gray-700 outline-none focus:border-purple-600 transition shadow-2xs"
            >
              <option value="ALL">All organizations ({uniqueOrgs.length})</option>
              {uniqueOrgs.map(org => (
                <option key={org} value={org}>{org}</option>
              ))}
            </select>
          </div>

          {/* Right Controls: Count, Export Button, View Mode Toggle */}
          <div className="flex items-center justify-between sm:justify-end gap-3">
            <span className="text-xs font-bold text-gray-500 shrink-0">
              {filteredActivities.length} shown
            </span>

            <button
              onClick={handleExportCSV}
              className="px-3.5 py-1.5 bg-white border border-gray-200 hover:bg-gray-50 text-gray-700 text-xs font-bold rounded-xl transition flex items-center gap-1.5 shadow-2xs"
            >
              <Download size={14} /> Export
            </button>

            <div className="flex items-center bg-gray-100 p-1 rounded-xl border border-gray-200">
              <button
                onClick={() => setViewMode('list')}
                className={`px-3 py-1 rounded-lg text-xs font-extrabold transition flex items-center gap-1.5 ${
                  viewMode === 'list'
                    ? 'bg-white text-gray-900 shadow-2xs'
                    : 'text-gray-500 hover:text-gray-800'
                }`}
              >
                <LayoutList size={14} /> List
              </button>
              <button
                onClick={() => setViewMode('calendar')}
                className={`px-3 py-1 rounded-lg text-xs font-extrabold transition flex items-center gap-1.5 ${
                  viewMode === 'calendar'
                    ? 'bg-white text-gray-900 shadow-2xs'
                    : 'text-gray-500 hover:text-gray-800'
                }`}
              >
                <CalendarDays size={14} /> Calendar
              </button>
            </div>
          </div>
        </div>

        {/* VIEW 1: LIST VIEW */}
        {viewMode === 'list' && (
          <div className="overflow-x-auto rounded-xl border border-gray-200">
            <table className="w-full text-left text-sm">
              <thead className="bg-[#073c2d] text-white font-bold border-b border-[#073c2d] uppercase tracking-wider text-xs">
                <tr>
                  <th className="px-4 py-3.5 text-white">Activity Title & Org</th>
                  <th className="px-4 py-3.5 text-white">Venue</th>
                  <th className="px-4 py-3.5 text-white">Schedule Date & Time</th>
                  <th className="px-4 py-3.5 text-white">Tracking #</th>
                  <th className="px-4 py-3.5 text-center text-white">Schedule Status</th>
                </tr>
              </thead>

              <tbody className="divide-y divide-gray-100">
                {loading ? (
                  <tr>
                    <td colSpan="5" className="p-12 text-center text-gray-400 font-semibold">
                      Loading approved activities...
                    </td>
                  </tr>
                ) : filteredActivities.map(act => (
                  <tr key={act.id} className="hover:bg-purple-50/20 transition">
                    <td className="px-4 py-4 font-extrabold text-gray-900">
                      <div className="space-y-0.5">
                        <div className="text-sm font-extrabold text-gray-900">{act.title}</div>
                        <div className="text-xs font-bold text-purple-700 flex items-center gap-1">
                          <Building2 size={12} className="shrink-0" />
                          <span>{act.org}</span>
                        </div>
                      </div>
                    </td>

                    <td className="px-4 py-4 text-xs font-semibold text-gray-600">
                      {act.venue && act.venue !== 'N/A' ? (
                        <span className="flex items-center gap-1 text-gray-700">
                          <MapPin size={13} className="text-rose-500 shrink-0" />
                          {act.venue}
                        </span>
                      ) : (
                        <span className="text-gray-400">N/A</span>
                      )}
                    </td>

                    <td className="px-4 py-4 text-xs font-semibold text-gray-700">
                      <div className="space-y-0.5">
                        <div className="flex items-center gap-1.5 font-bold text-gray-800">
                          <CalendarIcon size={13} className="text-purple-600 shrink-0" />
                          <span>
                            {act.date ? act.date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : 'Unspecified'}
                            {act.endDate ? ` – ${act.endDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}` : ''}
                          </span>
                        </div>
                        {(act.formattedStartTime || act.startTime) && (
                          <div className="flex items-center gap-1 text-[11px] text-gray-500 pl-5">
                            <Clock size={11} className="shrink-0 text-gray-400" />
                            <span>
                              {act.formattedStartTime
                                ? (act.formattedEndTime ? `${act.formattedStartTime} – ${act.formattedEndTime}` : act.formattedStartTime)
                                : `${act.startTime} – ${act.endTime}`}
                            </span>
                          </div>
                        )}
                      </div>
                    </td>

                    <td className="px-4 py-4 text-xs font-extrabold text-purple-800">
                      {act.trackingNumber ? (
                        <span className="bg-purple-100 text-purple-800 px-2 py-0.5 rounded-md border border-purple-200">
                          #{act.trackingNumber}
                        </span>
                      ) : (
                        <span className="text-gray-400">-</span>
                      )}
                    </td>

                    <td className="px-4 py-4 text-center">
                      <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-wider border ${act.scheduleStatus.bg}`}>
                        <span className={`w-1.5 h-1.5 rounded-full ${act.scheduleStatus.dot}`} />
                        {act.scheduleStatus.label}
                      </span>
                    </td>
                  </tr>
                ))}

                {!loading && filteredActivities.length === 0 && (
                  <tr>
                    <td colSpan="5" className="p-12 text-center text-gray-400 font-semibold">
                      {searchTerm || orgFilter !== 'ALL' || statusFilter !== 'ALL'
                        ? 'No approved activities match your search or filter criteria.' 
                        : `No approved Activity Proposal schedules found for ${selectedSy?.name || 'the selected school year'}.`}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}

        {/* VIEW 2: CALENDAR GRID + AGENDA SIDEBAR VIEW */}
        {viewMode === 'calendar' && (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
            
            {/* LEFT 8/12 COLS: CALENDAR GRID */}
            <div className="lg:col-span-8 space-y-4">
              
              {/* Calendar Month Controls Bar */}
              <div className="flex items-center justify-between">
                <div>
                  <h4 className="font-extrabold text-gray-900 text-lg">
                    {format(currentMonth, 'MMMM yyyy')}
                  </h4>
                  <p className="text-xs text-gray-500 font-semibold mt-0.5">
                    {monthActivities.length} activity schedules in view
                  </p>
                </div>

                <div className="flex items-center gap-1.5">
                  <button
                    onClick={prevMonth}
                    className="p-1.5 border border-gray-200 hover:bg-gray-100 text-gray-600 rounded-lg transition"
                    title="Previous Month"
                  >
                    <ChevronLeft size={16} />
                  </button>
                  <button
                    onClick={() => setCurrentMonth(new Date())}
                    className="px-3 py-1.5 border border-gray-200 hover:bg-gray-100 text-gray-700 text-xs font-bold rounded-lg transition"
                  >
                    Today
                  </button>
                  <button
                    onClick={nextMonth}
                    className="p-1.5 border border-gray-200 hover:bg-gray-100 text-gray-600 rounded-lg transition"
                    title="Next Month"
                  >
                    <ChevronRight size={16} />
                  </button>
                </div>
              </div>

              {/* Grid Wrapper */}
              <div className="bg-white rounded-xl border border-gray-200 overflow-hidden shadow-2xs">
                {/* Weekday Headers */}
                <div className="grid grid-cols-7 border-b border-gray-200 bg-gray-50/70 text-center py-2 text-[11px] font-extrabold text-gray-500 uppercase tracking-wider">
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
                    const dayActs = getActivitiesForDay(day);
                    const isCurrentMonth = isSameMonth(day, currentMonth);
                    const isTodayDay = isSameDay(day, new Date());

                    return (
                      <div
                        key={day.toString()}
                        onClick={() => {
                          if (dayActs.length > 0) {
                            setSelectedDayActivities({ day, activities: dayActs });
                          }
                        }}
                        className={`min-h-[110px] p-1.5 border-b border-r border-gray-100 transition flex flex-col justify-between ${
                          !isCurrentMonth 
                            ? 'bg-gray-50/40 text-gray-300' 
                            : 'bg-white text-gray-800 hover:bg-gray-50/60'
                        } ${dayActs.length > 0 ? 'cursor-pointer' : ''}`}
                      >
                        <div>
                          {/* Date Header Row */}
                          <div className="flex items-center justify-between mb-1">
                            <span className={`text-xs font-bold w-5 h-5 flex items-center justify-center rounded-full ${
                              isTodayDay 
                                ? 'bg-purple-700 text-white font-black' 
                                : !isCurrentMonth 
                                  ? 'text-gray-300' 
                                  : 'text-gray-700'
                            }`}>
                              {format(day, 'd')}
                            </span>
                            {dayActs.length > 0 && (
                              <span className="text-[10px] font-bold text-gray-400">
                                {dayActs.length}
                              </span>
                            )}
                          </div>

                          {/* Activity Items inside Cell */}
                          <div className="space-y-1 overflow-hidden">
                            {dayActs.slice(0, 2).map((act) => {
                              const borderClass = getStatusBorderClass(act.scheduleStatus.key);
                              const isStart = isSameDay(day, act.date);
                              const timeStr = isStart && (act.formattedStartTime || act.startTime) 
                                ? (act.formattedStartTime || act.startTime) 
                                : 'continues';

                              return (
                                <div
                                  key={act.id}
                                  className={`p-1 rounded-md text-[10px] font-bold border-l-2 bg-gray-50/80 hover:bg-gray-100/90 transition truncate ${borderClass}`}
                                  title={`${act.title} - ${act.org} (${act.venue})`}
                                >
                                  <div className="truncate font-extrabold text-gray-800 leading-tight">
                                    {act.title}
                                  </div>
                                  <div className="truncate text-[9px] text-gray-500 font-semibold">
                                    {act.orgAbbr || act.org} · {timeStr}
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        </div>

                        {/* Overflow indicator */}
                        {dayActs.length > 2 && (
                          <div className="text-[9px] font-extrabold text-purple-600 hover:underline pt-0.5">
                            +{dayActs.length - 2} more
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>

            {/* RIGHT 4/12 COLS: AGENDA SIDEBAR */}
            <div className="lg:col-span-4 bg-white border border-gray-200 rounded-2xl p-4 space-y-4 shadow-2xs">
              <div>
                <h4 className="font-extrabold text-gray-900 text-sm">
                  {format(currentMonth, 'MMMM')} agenda
                </h4>
                <p className="text-xs text-gray-500 font-semibold mt-0.5">
                  {monthActivities.length} activity schedules this month
                </p>
              </div>

              {/* Scrollable Agenda Activity Cards */}
              <div className="space-y-3 max-h-[560px] overflow-y-auto pr-1 scrollbar-none">
                {monthActivities.length === 0 ? (
                  <div className="p-8 text-center text-gray-400 font-semibold text-xs border border-dashed border-gray-200 rounded-xl">
                    No approved activity schedules for {format(currentMonth, 'MMMM yyyy')}.
                  </div>
                ) : (
                  monthActivities.map(act => {
                    const borderClass = getStatusBorderClass(act.scheduleStatus.key);
                    const relativeStr = getRelativeDateString(act.date, act.endDate);

                    return (
                      <div
                        key={act.id}
                        onClick={() => setSelectedDayActivities({ day: act.date, activities: [act] })}
                        className={`bg-white p-3.5 rounded-xl border border-gray-200 shadow-2xs hover:shadow-xs transition relative overflow-hidden cursor-pointer border-l-4 ${borderClass}`}
                      >
                        <div className="flex items-center justify-between gap-2 mb-1">
                          <span className="text-[11px] font-black uppercase tracking-wide text-purple-700">
                            {act.orgAbbr || act.org}
                          </span>
                          <div className="flex items-center gap-1">
                            <span className={`px-2 py-0.5 rounded-full text-[10px] font-extrabold uppercase ${act.scheduleStatus.bg}`}>
                              <span className={`inline-block w-1.5 h-1.5 rounded-full mr-1 ${act.scheduleStatus.dot}`} />
                              {act.scheduleStatus.label}
                            </span>
                            <ChevronRightIcon size={14} className="text-gray-400" />
                          </div>
                        </div>

                        <h5 className="font-extrabold text-xs text-gray-900 leading-snug line-clamp-2 hover:text-purple-700 transition">
                          {act.title}
                        </h5>

                        <div className="text-[11px] text-gray-500 font-medium flex items-center gap-1 pt-1.5">
                          <span>
                            {format(act.date, 'MMM d')}
                            {act.endDate && !isSameDay(act.date, act.endDate) 
                              ? ` – ${format(act.endDate, 'd, yyyy')}` 
                              : `, ${format(act.date, 'yyyy')}`}
                          </span>
                          <span>·</span>
                          <span className="text-gray-600 font-bold">{relativeStr}</span>
                        </div>

                        {act.venue && act.venue !== 'N/A' && (
                          <div className="text-[11px] text-gray-500 font-medium flex items-center gap-1 pt-0.5">
                            <MapPin size={11} className="text-gray-400 shrink-0" />
                            <span className="truncate">{act.venue}</span>
                          </div>
                        )}
                      </div>
                    );
                  })
                )}
              </div>
            </div>

          </div>
        )}

        {/* Selected Day Activities Modal / Popover */}
        {selectedDayActivities && (
          <div className="fixed inset-0 bg-black/40 backdrop-blur-xs z-[10000] flex items-center justify-center p-4" onClick={() => setSelectedDayActivities(null)}>
            <div className="bg-white rounded-3xl shadow-2xl w-full max-w-lg overflow-hidden border border-gray-100 animate-in zoom-in-95 duration-150" onClick={e => e.stopPropagation()}>
              <div className="p-5 bg-gradient-to-r from-purple-700 to-indigo-700 text-white flex items-center justify-between">
                <div className="flex items-center gap-2 font-extrabold text-sm">
                  <Info size={18} />
                  <span>Activities on {format(selectedDayActivities.day, 'MMMM d, yyyy')}</span>
                </div>
                <button
                  onClick={() => setSelectedDayActivities(null)}
                  className="p-1 hover:bg-white/20 rounded-full transition text-white font-extrabold text-sm"
                >
                  ✕
                </button>
              </div>

              <div className="p-5 space-y-3 max-h-[65vh] overflow-y-auto">
                {selectedDayActivities.activities.map(act => {
                  const borderClass = getStatusBorderClass(act.scheduleStatus.key);
                  return (
                    <div key={act.id} className={`bg-white p-4 rounded-2xl border border-gray-200 shadow-2xs space-y-2 border-l-4 ${borderClass}`}>
                      <div className="flex items-start justify-between gap-2">
                        <h4 className="font-extrabold text-sm text-gray-900">{act.title}</h4>
                        <span className={`px-2 py-0.5 rounded-full text-[10px] font-extrabold uppercase shrink-0 ${act.scheduleStatus.bg}`}>
                          {act.scheduleStatus.label}
                        </span>
                      </div>
                      
                      <div className="text-xs font-bold text-purple-700 flex items-center gap-1">
                        <Building2 size={13} className="shrink-0" />
                        <span>{act.org} ({act.orgAbbr})</span>
                      </div>

                      <div className="text-xs text-gray-600 flex items-center gap-1">
                        <MapPin size={12} className="text-rose-500 shrink-0" />
                        <span>{act.venue}</span>
                      </div>

                      {(act.formattedStartTime || act.startTime) && (
                        <div className="text-xs text-gray-500 flex items-center gap-1">
                          <Clock size={12} className="shrink-0 text-gray-400" />
                          <span>{act.formattedStartTime || act.startTime} {act.formattedEndTime ? `– ${act.formattedEndTime}` : ''}</span>
                        </div>
                      )}

                      {act.trackingNumber && (
                        <div className="text-xs font-bold text-purple-800 pt-1 border-t border-gray-100">
                          Tracking Number: #{act.trackingNumber}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        )}

      </div>
    </div>
  );
}
