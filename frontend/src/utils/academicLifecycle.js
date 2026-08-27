import { format, parseISO, isWithinInterval, isBefore, isAfter } from 'date-fns';

export function parseDateSafe(dateStr) {
  if (!dateStr) return null;
  try {
    return typeof dateStr === 'string' ? parseISO(dateStr) : new Date(dateStr);
  } catch {
    return null;
  }
}

export function formatDateRange(startDate, endDate) {
  const start = parseDateSafe(startDate);
  const end = parseDateSafe(endDate);
  if (!start || !end) return 'Dates unspecified';
  return `${format(start, 'MMM d, yyyy')} – ${format(end, 'MMM d, yyyy')}`;
}

export function determineSchoolYearStatus(sy) {
  if (!sy) return 'Unknown';
  if (sy.is_active) return 'Active';
  if (sy.status === 'archived' || sy.is_archived || sy.status === 'closed' || sy.is_closed) return 'Archived';
  
  const today = new Date();
  const start = parseDateSafe(sy.start_date);
  const end = parseDateSafe(sy.end_date);

  if (end && isAfter(today, end)) return 'Archived';
  if (start && isBefore(today, start)) return 'Upcoming';

  return 'Upcoming';
}

export function getSchoolYearStatusBadge(status) {
  switch (status) {
    case 'Active':
      return {
        label: 'Active',
        bg: 'bg-emerald-100 text-emerald-800 border-emerald-300',
        dot: 'bg-emerald-500'
      };
    case 'Upcoming':
      return {
        label: 'Upcoming',
        bg: 'bg-amber-100 text-amber-800 border-amber-300',
        dot: 'bg-amber-500'
      };
    case 'Archived':
      return {
        label: 'Archived',
        bg: 'bg-red-100 text-red-800 border-red-300',
        dot: 'bg-red-500'
      };
    default:
      return {
        label: status || 'Upcoming',
        bg: 'bg-gray-100 text-gray-700 border-gray-300',
        dot: 'bg-gray-400'
      };
  }
}

export function determineSemesterStatus(sem) {
  if (!sem) return 'Scheduled';
  if (sem.status === 'archived' || sem.is_archived) return 'Archived';
  if (sem.is_active) return 'Ongoing';
  
  const today = new Date();
  const start = parseDateSafe(sem.start_date);
  const end = parseDateSafe(sem.end_date);

  if (start && end) {
    if (isBefore(today, start)) return 'Upcoming';
    if (isAfter(today, end)) return 'Ended';
    if (isWithinInterval(today, { start, end })) return 'Ongoing';
  }

  return 'Upcoming';
}

export function determineWindowStatus(window) {
  if (!window || window.is_active === false) return 'Closed';
  
  const today = new Date();
  const start = parseDateSafe(window.start_date);
  const end = parseDateSafe(window.end_date);

  if (!start && !end) return 'Accepting now';
  if (start && end) {
    if (isWithinInterval(today, { start, end })) return 'Accepting now';
    if (isBefore(today, start)) return 'Opens later';
    if (isAfter(today, end)) return 'Closed';
  }
  if (start && isBefore(today, start)) return 'Opens later';
  if (end && isAfter(today, end)) return 'Closed';

  return 'Accepting now';
}
