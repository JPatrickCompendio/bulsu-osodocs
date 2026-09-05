import React from 'react';
import { Navigate, useParams, useSearchParams } from 'react-router-dom';

const AcademicSettings = () => {
  const { tab: tabFromParams } = useParams();
  const [searchParams] = useSearchParams();

  const raw = (tabFromParams || searchParams.get('tab') || '').toLowerCase().trim();
  if (raw === 'events' || raw === 'calendar') {
    return <Navigate to="/admin/academic-dates/events" replace />;
  }
  if (raw === 'submission-windows' || raw === 'submission-window') {
    return <Navigate to="/admin/academic-dates/submission-windows" replace />;
  }
  if (raw === 'organization-activities' || raw === 'approved-activities' || raw === 'activities') {
    return <Navigate to="/admin/academic-dates/organization-activities" replace />;
  }
  if (raw === 'semesters') {
    return <Navigate to="/admin/academic-dates/school-year?view=semesters" replace />;
  }
  return <Navigate to="/admin/academic-dates/school-year" replace />;
};

export default AcademicSettings;
