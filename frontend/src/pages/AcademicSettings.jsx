import React, { useState, useEffect } from 'react';
import { supabase } from '../supabaseClient';
import { useAuth } from '../context/AuthContext';
import { apiFetch } from '../config/api';
import { 
  Calendar, BookOpen, Clock, CalendarDays, FileText, Check, AlertCircle 
} from 'lucide-react';
import PageHeader from '../components/PageHeader';

import { ActiveYearPanel } from '../components/academic/ActiveYearPanel';
import { LifecycleLegend } from '../components/academic/LifecycleLegend';
import { SchoolYearsTable } from '../components/academic/SchoolYearsTable';
import { SemestersTab } from '../components/academic/SemestersTab';
import { CalendarTab } from '../components/academic/CalendarTab';
import { SubmissionWindowsTab } from '../components/academic/SubmissionWindowsTab';

import { SchoolYearModal } from '../components/academic/SchoolYearModal';
import { SemesterModal } from '../components/academic/SemesterModal';
import { EventModal } from '../components/academic/EventModal';
import { ArchiveConfirmModal } from '../components/academic/ArchiveConfirmModal';

const AcademicSettings = () => {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState('school-years');
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState(null);

  // Core Data State
  const [schoolYears, setSchoolYears] = useState([]);
  const [academicEvents, setAcademicEvents] = useState([]);
  const [documentTypes, setDocumentTypes] = useState([]);
  const [semesters, setSemesters] = useState([]);
  const [selectedSyId, setSelectedSyId] = useState('');

  // Modals State
  const [showSyModal, setShowSyModal] = useState(false);
  const [syForm, setSyForm] = useState({ id: null, name: '', start_date: '', end_date: '', is_active: false });

  const [showSemModal, setShowSemModal] = useState(false);
  const [semForm, setSemForm] = useState({ id: null, school_year_id: '', name: '', start_date: '', end_date: '', is_active: false });

  const [showEventModal, setShowEventModal] = useState(false);
  const [eventForm, setEventForm] = useState({
    id: null, school_year_id: '', semester_id: '', title: '', description: '', event_type: 'school_event',
    document_type_id: '', start_date: '', end_date: '', blocks_activity: false, is_active: true
  });

  const [archiveModal, setArchiveModal] = useState({ show: false, sy: null });

  useEffect(() => {
    fetchData();
  }, []);

  const showMessage = (msg, type = 'success') => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3500);
  };

  const fetchData = async () => {
    setLoading(true);
    try {
      const syRes = await apiFetch('/api/school-years');
      const evRes = await apiFetch('/api/academic-events');
      
      const { data: dtRes } = await supabase.from('documentType').select('*').order('name');
      setDocumentTypes(dtRes || []);

      const semRes = await apiFetch('/api/semesters?includeArchived=true');
      const semData = await semRes.json();
      if (semData.success) setSemesters(semData.data || []);

      const syData = await syRes.json();
      const evData = await evRes.json();

      if (syData.success) {
        const sys = syData.data || [];
        setSchoolYears(sys);
        const activeSy = sys.find(s => s.is_active) || sys[0];
        if (activeSy && !selectedSyId) {
          setSelectedSyId(activeSy.id);
        }
      }
      if (evData.success) setAcademicEvents(evData.data || []);
    } catch (err) {
      showMessage('Failed to fetch academic settings data', 'error');
    } finally {
      setLoading(false);
    }
  };

  const activeSy = schoolYears.find(s => s.is_active);
  const activeSemester = semesters.find(s => s.school_year_id === activeSy?.id && s.is_active);
  const blockedDaysCount = academicEvents.filter(e => 
    e.school_year_id === activeSy?.id && 
    (e.event_type === 'blocked_activity' || e.description === 'BLOCKS_ACTIVITY' || e.blocks_activity)
  ).length;

  // --- SCHOOL YEAR HANDLERS ---
  const saveSchoolYear = async (e) => {
    if (e && e.preventDefault) e.preventDefault();
    try {
      let finalName = syForm.name.trim();
      const startYr = syForm.start_date ? new Date(syForm.start_date).getFullYear() : '';
      const endYr = syForm.end_date ? new Date(syForm.end_date).getFullYear() : '';
      if (startYr && endYr && startYr === endYr) {
        finalName = finalName.replace(/\d{4}-\d{4}/, `${startYr}`);
      }
      if (!finalName.toLowerCase().startsWith('academic year')) {
        finalName = `Academic Year ${finalName}`;
      }

      const dup = schoolYears.find(s => s.id !== syForm.id && (
        s.name.toLowerCase().trim() === finalName.toLowerCase() ||
        (s.start_date.split('T')[0] === syForm.start_date && s.end_date.split('T')[0] === syForm.end_date)
      ));

      if (dup) {
        if (dup.name.toLowerCase().trim() === finalName.toLowerCase()) {
          showMessage('A School Year with this title already exists.', 'error');
        } else {
          showMessage('A School Year with these exact start and end dates already exists.', 'error');
        }
        return;
      }

      const payload = { ...syForm, name: finalName };
      const path = syForm.id ? `/api/school-years/${syForm.id}` : '/api/school-years';
      const method = syForm.id ? 'PUT' : 'POST';

      const res = await apiFetch(path, {
        method,
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      if (res.ok) {
        showMessage('School Year saved successfully!');
        setShowSyModal(false);
        fetchData();
      } else {
        throw new Error(data.error || 'Failed to save school year');
      }
    } catch (err) {
      showMessage(err.message, 'error');
    }
  };

  const activateSchoolYear = async (id) => {
    try {
      const res = await apiFetch(`/api/school-years/${id}/activate`, { method: 'PUT' });
      if (res.ok) {
        showMessage('School Year activated!');
        fetchData();
      }
    } catch (err) {
      showMessage('Failed to activate school year', 'error');
    }
  };

  const closeSchoolYearSubmissions = async (sy) => {
    if (!window.confirm(`Are you sure you want to close submissions for ${sy.name}?`)) return;
    try {
      const payload = { ...sy, is_closed: true };
      const res = await apiFetch(`/api/school-years/${sy.id}`, {
        method: 'PUT',
        body: JSON.stringify(payload)
      });
      if (res.ok) {
        showMessage(`Submissions for ${sy.name} are now CLOSED.`);
        fetchData();
      }
    } catch (err) {
      showMessage('Failed to close submissions', 'error');
    }
  };

  const confirmArchiveSchoolYear = async (id) => {
    try {
      const res = await apiFetch(`/api/school-years/${id}`, { method: 'DELETE' });
      const data = await res.json();
      if (res.ok) {
        showMessage('School Year archived!');
        setArchiveModal({ show: false, sy: null });
        fetchData();
      } else {
        throw new Error(data.error || 'Failed to archive school year');
      }
    } catch (err) {
      showMessage(err.message, 'error');
    }
  };

  const deleteSchoolYear = async (id) => {
    if (!window.confirm('Are you sure you want to delete this School Year?')) return;
    try {
      const res = await apiFetch(`/api/school-years/${id}`, { method: 'DELETE' });
      const data = await res.json();
      if (res.ok) {
        showMessage('School Year deleted!');
        fetchData();
      } else {
        throw new Error(data.error || 'Failed to delete');
      }
    } catch (err) {
      showMessage(err.message, 'error');
    }
  };

  // --- SEMESTER HANDLERS ---
  const saveSemester = async (e) => {
    if (e && e.preventDefault) e.preventDefault();
    try {
      const sy = schoolYears.find(s => s.id === semForm.school_year_id);
      if (sy) {
        const syStart = sy.start_date.split('T')[0];
        const syEnd = sy.end_date.split('T')[0];
        if (semForm.start_date < syStart) {
          showMessage(`Semester start date cannot precede School Year start date (${syStart}).`, 'error');
          return;
        }
        if (semForm.end_date > syEnd) {
          showMessage(`Semester end date cannot exceed School Year end date (${syEnd}).`, 'error');
          return;
        }
      }

      if (semForm.start_date > semForm.end_date) {
        showMessage('Semester start date cannot be after the end date.', 'error');
        return;
      }

      const path = semForm.id ? `/api/semesters/${semForm.id}` : '/api/semesters';
      const method = semForm.id ? 'PUT' : 'POST';

      const res = await apiFetch(path, {
        method,
        body: JSON.stringify(semForm),
      });

      const data = await res.json();
      if (res.ok) {
        showMessage('Semester saved successfully!');
        setShowSemModal(false);
        fetchData();
      } else {
        throw new Error(data.error || 'Failed to save semester');
      }
    } catch (err) {
      showMessage(err.message, 'error');
    }
  };

  const activateSemester = async (id) => {
    try {
      const res = await apiFetch(`/api/semesters/${id}/activate`, { method: 'PUT' });
      const data = await res.json();
      if (res.ok) {
        showMessage('Semester set as current!');
        fetchData();
      } else {
        throw new Error(data.error || 'Failed to activate semester');
      }
    } catch (err) {
      showMessage(err.message, 'error');
    }
  };

  const archiveSemester = async (id) => {
    if (!window.confirm('Are you sure you want to archive this Semester?')) return;
    try {
      const res = await apiFetch(`/api/semesters/${id}`, { method: 'DELETE' });
      const data = await res.json();
      if (res.ok) {
        showMessage('Semester archived!');
        fetchData();
      } else {
        throw new Error(data.error || 'Failed to archive semester');
      }
    } catch (err) {
      showMessage(err.message, 'error');
    }
  };

  // --- ACADEMIC CALENDAR & EVENT HANDLERS ---
  const saveEvent = async (e) => {
    if (e && e.preventDefault) e.preventDefault();
    try {
      if (!schoolYears || schoolYears.length === 0) {
        showMessage('Cannot create calendar events because no School Year is configured.', 'error');
        return;
      }

      const path = eventForm.id ? `/api/academic-events/${eventForm.id}` : '/api/academic-events';
      const method = eventForm.id ? 'PUT' : 'POST';

      const payload = { ...eventForm, created_by: user?.id || null };
      if (!payload.school_year_id) {
        const activeSyObj = schoolYears.find(sy => sy.is_active) || schoolYears[0];
        if (activeSyObj) payload.school_year_id = activeSyObj.id;
      }

      if (payload.event_type === 'school_event') {
        if (payload.blocks_activity) {
          payload.event_type = 'blocked_activity';
        } else {
          payload.event_type = 'announcement';
        }
      }

      if (payload.event_type === 'submission_window') {
        const dt = documentTypes.find(d => d.id === payload.document_type_id);
        if (dt) {
          payload.title = `${dt.name} Submission Window`;
        }
      }

      if (!payload.start_date) payload.start_date = null;
      if (!payload.end_date) payload.end_date = null;
      if (payload.event_type !== 'submission_window') payload.document_type_id = null;
      if (payload.blocks_activity) payload.description = 'BLOCKS_ACTIVITY';
      else if (payload.description === 'BLOCKS_ACTIVITY') payload.description = '';

      const res = await apiFetch(path, {
        method,
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      if (res.ok) {
        showMessage('Event saved successfully!');
        setShowEventModal(false);
        fetchData();
      } else {
        throw new Error(data.error || data.details || 'Failed to save event');
      }
    } catch (err) {
      showMessage(err.message, 'error');
    }
  };

  const toggleEventBlock = async (ev) => {
    try {
      const isCurrentlyBlocked = ev.event_type === 'blocked_activity' || ev.blocks_activity || ev.description === 'BLOCKS_ACTIVITY';
      const updatedType = isCurrentlyBlocked ? 'announcement' : 'blocked_activity';
      const updatedDesc = isCurrentlyBlocked ? '' : 'BLOCKS_ACTIVITY';

      const res = await apiFetch(`/api/academic-events/${ev.id}`, {
        method: 'PUT',
        body: JSON.stringify({
          ...ev,
          event_type: updatedType,
          description: updatedDesc
        })
      });

      if (res.ok) {
        showMessage(`Proposal blocking ${isCurrentlyBlocked ? 'disabled' : 'enabled'} for "${ev.title}".`);
        fetchData();
      }
    } catch (err) {
      showMessage('Failed to toggle blocking', 'error');
    }
  };

  const deleteEvent = async (id) => {
    if (!window.confirm('Are you sure you want to delete this calendar event?')) return;
    try {
      const res = await apiFetch(`/api/academic-events/${id}`, { method: 'DELETE' });
      if (res.ok) {
        showMessage('Calendar event deleted!');
        fetchData();
      }
    } catch (err) {
      showMessage('Failed to delete event', 'error');
    }
  };

  const openEventModal = (ev = null, defaultType = 'school_event', defaultSyId = '') => {
    if (ev) {
      setEventForm({
        ...ev,
        blocks_activity: ev.event_type === 'blocked_activity' || ev.description === 'BLOCKS_ACTIVITY',
        start_date: ev.start_date ? ev.start_date.split('T')[0] : '',
        end_date: ev.end_date ? ev.end_date.split('T')[0] : '',
        document_type_id: ev.document_type_id || ''
      });
    } else {
      const targetSyId = defaultSyId || selectedSyId || (activeSy ? activeSy.id : '');
      setEventForm({
        id: null,
        school_year_id: targetSyId,
        title: '',
        description: '',
        blocks_activity: false,
        event_type: defaultType,
        document_type_id: '',
        start_date: '',
        end_date: '',
        is_active: true
      });
    }
    setShowEventModal(true);
  };

  return (
    <div className="min-h-screen bg-[#f8fafc] pb-32 relative">
      {/* Toast Notification Banner */}
      {toast && (
        <div className={`fixed top-20 right-4 sm:right-10 z-[999999] px-6 py-4 rounded-xl shadow-2xl flex items-center gap-3 text-white font-extrabold text-xs tracking-wide ${
          toast.type === 'error' ? 'bg-red-600' : 'bg-emerald-700'
        } animate-in slide-in-from-top-4`}>
          {toast.type === 'error' ? <AlertCircle size={20} /> : <Check size={20} />}
          <span>{toast.msg}</span>
        </div>
      )}

      {/* Header */}
      <div className="mb-6 border-b border-gray-100 pb-6">
        <PageHeader
          title="Academic Settings"
          subtitle="Manage School Years, Semesters, Calendar Events, and Document Schedules"
          icon={Calendar}
          iconColor="pink"
        />
      </div>

      {/* 4-Step Navigation Tabs */}
      <div className="flex items-center gap-2 overflow-x-auto pb-2 sm:pb-0 mb-6 bg-white p-2 rounded-2xl border border-gray-100 shadow-2xs scrollbar-none">
        <button
          className={`px-4 sm:px-5 py-2.5 sm:py-3 font-extrabold text-xs rounded-xl transition flex items-center gap-2 shrink-0 ${
            activeTab === 'school-years'
              ? 'bg-emerald-800 text-white shadow-md'
              : 'text-gray-600 hover:text-gray-900 hover:bg-gray-100'
          }`}
          onClick={() => setActiveTab('school-years')}
        >
          <BookOpen size={16} /> 1. School Years
        </button>

        <button
          className={`px-4 sm:px-5 py-2.5 sm:py-3 font-extrabold text-xs rounded-xl transition flex items-center gap-2 shrink-0 ${
            activeTab === 'semesters'
              ? 'bg-emerald-800 text-white shadow-md'
              : 'text-gray-600 hover:text-gray-900 hover:bg-gray-100'
          }`}
          onClick={() => setActiveTab('semesters')}
        >
          <Clock size={16} /> 2. Semesters & Terms
        </button>

        <button
          className={`px-4 sm:px-5 py-2.5 sm:py-3 font-extrabold text-xs rounded-xl transition flex items-center gap-2 shrink-0 ${
            activeTab === 'calendar'
              ? 'bg-emerald-800 text-white shadow-md'
              : 'text-gray-600 hover:text-gray-900 hover:bg-gray-100'
          }`}
          onClick={() => setActiveTab('calendar')}
        >
          <CalendarDays size={16} /> 3. Calendar & Blocked Dates
        </button>

        <button
          className={`px-4 sm:px-5 py-2.5 sm:py-3 font-extrabold text-xs rounded-xl transition flex items-center gap-2 shrink-0 ${
            activeTab === 'submission-windows'
              ? 'bg-emerald-800 text-white shadow-md'
              : 'text-gray-600 hover:text-gray-900 hover:bg-gray-100'
          }`}
          onClick={() => setActiveTab('submission-windows')}
        >
          <FileText size={16} /> 4. Submission Windows
        </button>
      </div>

      {loading ? (
        <div className="bg-white rounded-2xl p-16 text-center text-gray-400 font-bold border border-gray-100">
          Loading Academic Settings...
        </div>
      ) : (
        <>
          {/* STEP 1: SCHOOL YEARS TAB */}
          {activeTab === 'school-years' && (
            <div>
              <ActiveYearPanel
                activeSy={activeSy}
                activeSemester={activeSemester}
                blockedDaysCount={blockedDaysCount}
                onEdit={(sy) => {
                  setSyForm(sy);
                  setShowSyModal(true);
                }}
                onCloseSubmissions={closeSchoolYearSubmissions}
              />

              <LifecycleLegend />

              <SchoolYearsTable
                schoolYears={schoolYears}
                semesters={semesters}
                onNewSchoolYear={() => {
                  setSyForm({ id: null, name: '', start_date: '', end_date: '', is_active: false });
                  setShowSyModal(true);
                }}
                onActivate={activateSchoolYear}
                onEdit={(sy) => {
                  setSyForm(sy);
                  setShowSyModal(true);
                }}
                onClose={closeSchoolYearSubmissions}
                onArchive={(sy) => setArchiveModal({ show: true, sy })}
                onDelete={deleteSchoolYear}
              />
            </div>
          )}

          {/* STEP 2: SEMESTERS TAB */}
          {activeTab === 'semesters' && (
            <SemestersTab
              schoolYears={schoolYears}
              semesters={semesters}
              selectedSyId={selectedSyId}
              onSelectSy={setSelectedSyId}
              onNewSemester={(targetSyId) => {
                setSemForm({ id: null, school_year_id: targetSyId || selectedSyId, name: '', start_date: '', end_date: '', is_active: false });
                setShowSemModal(true);
              }}
              onActivateSemester={activateSemester}
              onEditSemester={(sem) => {
                setSemForm(sem);
                setShowSemModal(true);
              }}
              onArchiveSemester={archiveSemester}
            />
          )}

          {/* STEP 3: CALENDAR & BLOCKED DATES TAB */}
          {activeTab === 'calendar' && (
            <CalendarTab
              schoolYears={schoolYears}
              events={academicEvents}
              selectedSyId={selectedSyId}
              onSelectSy={setSelectedSyId}
              onNewEvent={(targetSyId) => openEventModal(null, 'school_event', targetSyId)}
              onEditEvent={(ev) => openEventModal(ev)}
              onDeleteEvent={deleteEvent}
              onToggleBlock={toggleEventBlock}
            />
          )}

          {/* STEP 4: SUBMISSION WINDOWS TAB */}
          {activeTab === 'submission-windows' && (
            <SubmissionWindowsTab
              schoolYears={schoolYears}
              events={academicEvents}
              documentTypes={documentTypes}
              selectedSyId={selectedSyId}
              onSelectSy={setSelectedSyId}
              onNewWindow={(targetSyId) => openEventModal(null, 'submission_window', targetSyId)}
              onEditWindow={(win) => openEventModal(win)}
              onDeleteWindow={deleteEvent}
            />
          )}
        </>
      )}

      {/* MODALS */}
      <SchoolYearModal
        isOpen={showSyModal}
        onClose={() => setShowSyModal(false)}
        onSave={saveSchoolYear}
        syForm={syForm}
        setSyForm={setSyForm}
      />

      <SemesterModal
        isOpen={showSemModal}
        onClose={() => setShowSemModal(false)}
        onSave={saveSemester}
        semForm={semForm}
        setSemForm={setSemForm}
        schoolYears={schoolYears}
      />

      <EventModal
        isOpen={showEventModal}
        onClose={() => setShowEventModal(false)}
        onSave={saveEvent}
        eventForm={eventForm}
        setEventForm={setEventForm}
        schoolYears={schoolYears}
        documentTypes={documentTypes}
      />

      <ArchiveConfirmModal
        isOpen={archiveModal.show}
        onClose={() => setArchiveModal({ show: false, sy: null })}
        onConfirm={confirmArchiveSchoolYear}
        targetSy={archiveModal.sy}
      />
    </div>
  );
};

export default AcademicSettings;
