import React, { useState, useEffect } from 'react';
import { supabase } from '../supabaseClient';
import { useAuth } from '../context/AuthContext';
import { apiFetch } from '../config/api';
import { Calendar, Settings, Plus, Check, X, Edit, Trash2, CalendarDays, BookOpen, Clock, AlertCircle } from 'lucide-react';
import PageHeader from '../components/PageHeader';

const AcademicSettings = () => {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState('school-years');
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState(null);

  // Data state
  const [schoolYears, setSchoolYears] = useState([]);
  const [academicEvents, setAcademicEvents] = useState([]);
  const [documentTypes, setDocumentTypes] = useState([]);
  const [semesters, setSemesters] = useState([]);
  const [showSemModal, setShowSemModal] = useState(false);
  const [semForm, setSemForm] = useState({ id: null, school_year_id: '', name: '', start_date: '', end_date: '', is_active: false });
  const [warningModal, setWarningModal] = useState({ show: false, message: '', semId: null });

  // Modals state
  const [showSyModal, setShowSyModal] = useState(false);
  const [syForm, setSyForm] = useState({ id: null, name: '', start_date: '', end_date: '', is_active: false });

  const [showEventModal, setShowEventModal] = useState(false);
  const [eventForm, setEventForm] = useState({
    id: null, school_year_id: '', semester_id: '', title: '', description: '', event_type: 'school_event',
    document_type_id: '', start_date: '', end_date: '', is_active: true
  });

  const eventTypes = [
    { value: 'school_event', label: 'School Event' },
    { value: 'submission_window', label: 'Submission Window' },
    { value: 'holiday', label: 'Holiday' },
    { value: 'exam_week', label: 'Exam Week' },
    { value: 'enrollment', label: 'Enrollment' },
    { value: 'announcement', label: 'Announcement' }
  ];

  useEffect(() => {
    fetchData();
  }, []);

  const showMessage = (msg, type = 'success') => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3000);
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
      if (semData.success) setSemesters(semData.data);

      const syData = await syRes.json();
      const evData = await evRes.json();

      if (syData.success) setSchoolYears(syData.data);
      if (evData.success) setAcademicEvents(evData.data);
    } catch (err) {
      showMessage('Failed to fetch data', 'error');
    } finally {
      setLoading(false);
    }
  };

  // --- SCHOOL YEAR HANDLERS ---
  const saveSchoolYear = async (e) => {
    e.preventDefault();
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

      // Check duplicates
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
        showMessage('School Year saved!');
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
      showMessage('Failed to activate', 'error');
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
    e.preventDefault();
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
        showMessage('Semester saved!');
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
        if (data.warning) {
          setWarningModal({ show: true, message: data.warning, semId: id });
        } else {
          showMessage('Semester activated!');
        }
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

  // --- ACADEMIC CALENDAR EVENT HANDLERS ---
  const saveEvent = async (e) => {
    e.preventDefault();
    try {
      if (!schoolYears || schoolYears.length === 0) {
        showMessage('Cannot create or save calendar events because no School Year is configured.', 'error');
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
        showMessage('Event saved!');
        setShowEventModal(false);
        fetchData();
      } else {
        throw new Error(data.error || data.details || 'Failed to save event');
      }
    } catch (err) {
      showMessage(err.message, 'error');
    }
  };

  const deleteEvent = async (id) => {
    if (!window.confirm('Are you sure you want to delete this event?')) return;
    try {
      const res = await apiFetch(`/api/academic-events/${id}`, { method: 'DELETE' });
      if (res.ok) {
        showMessage('Event deleted!');
        fetchData();
      }
    } catch (err) {
      showMessage('Failed to delete event', 'error');
    }
  };

  const openEventModal = (ev = null) => {
    if (ev) {
      setEventForm({
        ...ev,
        blocks_activity: ev.event_type === 'blocked_activity' || ev.event_type === 'school_event' && ev.description === 'BLOCKS_ACTIVITY' || ev.description === 'BLOCKS_ACTIVITY',
        start_date: ev.start_date ? ev.start_date.split('T')[0] : '',
        end_date: ev.end_date ? ev.end_date.split('T')[0] : '',
        document_type_id: ev.document_type_id || ''
      });
    } else {
      const activeSy = schoolYears.find(s => s.is_active);
      setEventForm({
        id: null, school_year_id: activeSy ? activeSy.id : '', title: '', description: '',
        blocks_activity: false,
        event_type: 'school_event', document_type_id: '', start_date: '', end_date: '', is_active: true
      });
    }
    setShowEventModal(true);
  };

  return (
    <div className="min-h-screen bg-gray-50 pb-32 relative">
      {toast && (
        <div className={`fixed top-10 right-10 z-[200] px-6 py-4 rounded-xl shadow-xl flex items-center gap-3 text-white font-bold ${toast.type === 'error' ? 'bg-red-600' : 'bg-green-600'} animate-in slide-in-from-right`}>
          {toast.type === 'error' ? <AlertCircle size={20} /> : <Check size={20} />}
          {toast.msg}
        </div>
      )}

      <div className="flex items-end justify-between mb-8 border-b border-gray-100 pb-6">
        <PageHeader 
          title="Academic Settings" 
          subtitle="Manage School Years, Calendar Events, and Document Schedules" 
          icon={Calendar} 
          iconColor="pink" 
        />
      </div>

      <div className="flex gap-4 border-b border-gray-200 mb-8">
        <button 
          className={`pb-4 px-4 font-bold transition-all border-b-2 flex items-center gap-2 ${activeTab === 'school-years' ? 'border-primary-green text-primary-green' : 'border-transparent text-gray-500 hover:text-gray-700'}`}
          onClick={() => setActiveTab('school-years')}
        >
          <BookOpen size={18} /> School Years
        </button>
        <button 
          className={`pb-4 px-4 font-bold transition-all border-b-2 flex items-center gap-2 ${activeTab === 'semesters' ? 'border-primary-green text-primary-green' : 'border-transparent text-gray-500 hover:text-gray-700'}`}
          onClick={() => setActiveTab('semesters')}
        >
          <Clock size={18} /> Semesters
        </button>
        <button 
          className={`pb-4 px-4 font-bold transition-all border-b-2 flex items-center gap-2 ${activeTab === 'academic-events' ? 'border-primary-green text-primary-green' : 'border-transparent text-gray-500 hover:text-gray-700'}`}
          onClick={() => setActiveTab('academic-events')}
        >
          <CalendarDays size={18} /> Calendar Events
        </button>
      </div>

      {loading ? (
        <div className="text-center py-20 text-gray-500 font-bold">Loading...</div>
      ) : (
        <>
          {/* SEMESTERS TAB */}
          {activeTab === 'semesters' && (
            <div className="space-y-6">
              <div className="flex justify-end">
                <button 
                  onClick={() => {
                    const activeSy = schoolYears.find(s => s.is_active);
                    setSemForm({ id: null, school_year_id: activeSy ? activeSy.id : '', name: '', start_date: '', end_date: '', is_active: false });
                    setShowSemModal(true);
                  }}
                  className="bg-primary-green text-white px-5 py-2.5 rounded-lg font-bold flex items-center gap-2 hover:bg-green-700 shadow-sm"
                >
                  <Plus size={18} /> New Semester
                </button>
              </div>

              <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
                <table className="w-full text-left text-sm">
                  <thead className="bg-gray-50 text-gray-600 font-bold border-b border-gray-100 uppercase tracking-wider text-xs">
                    <tr>
                      <th className="p-4">Semester Name</th>
                      <th className="p-4">School Year</th>
                      <th className="p-4">Duration</th>
                      <th className="p-4">Status</th>
                      <th className="p-4 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {semesters.map(sem => {
                      const sy = schoolYears.find(s => s.id === sem.school_year_id);
                      const isArchived = sem.status === 'archived';
                      return (
                        <tr key={sem.id} className="border-b border-gray-50 hover:bg-gray-50/50">
                          <td className="p-4 font-bold text-gray-800">{sem.name}</td>
                          <td className="p-4 text-gray-600 font-medium">{sy ? sy.name : 'N/A'}</td>
                          <td className="p-4 text-gray-500">{new Date(sem.start_date).toLocaleDateString()} - {new Date(sem.end_date).toLocaleDateString()}</td>
                          <td className="p-4">
                            {isArchived ? (
                              <span className="bg-red-100 text-red-700 px-3 py-1 rounded-full text-xs font-bold uppercase">Archived</span>
                            ) : sem.is_active ? (
                              <span className="bg-green-100 text-green-700 px-3 py-1 rounded-full text-xs font-bold uppercase">Active</span>
                            ) : (
                              <span className="bg-gray-100 text-gray-500 px-3 py-1 rounded-full text-xs font-bold uppercase">Inactive</span>
                            )}
                          </td>
                          <td className="p-4 text-right flex justify-end gap-2">
                            {!sem.is_active && !isArchived && (
                              <button onClick={() => activateSemester(sem.id)} className="px-3 py-1.5 bg-blue-50 text-blue-600 rounded-lg text-xs font-bold hover:bg-blue-100">Activate</button>
                            )}
                            {!isArchived && (
                              <button onClick={() => { setSemForm(sem); setShowSemModal(true); }} className="p-1.5 text-gray-400 hover:text-primary-green hover:bg-green-50 rounded-lg"><Edit size={16} /></button>
                            )}
                            <button 
                              onClick={() => archiveSemester(sem.id)} 
                              disabled={sem.is_active || isArchived}
                              title={sem.is_active ? "Active semesters cannot be archived" : isArchived ? "Already archived" : "Archive Semester"}
                              className={`p-1.5 rounded-lg ${sem.is_active || isArchived ? 'text-gray-300 cursor-not-allowed' : 'text-gray-400 hover:text-red-500 hover:bg-red-50'}`}
                            >
                              <Trash2 size={16} />
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                    {semesters.length === 0 && (
                      <tr><td colSpan="5" className="text-center p-8 text-gray-400 font-medium">No semesters configured.</td></tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* SCHOOL YEARS TAB */}
          {activeTab === 'school-years' && (
            <div className="space-y-6">
              <div className="flex justify-end">
                <button 
                  onClick={() => {
                    setSyForm({ id: null, name: '', start_date: '', end_date: '', is_active: false });
                    setShowSyModal(true);
                  }}
                  className="bg-primary-green text-white px-5 py-2.5 rounded-lg font-bold flex items-center gap-2 hover:bg-green-700 shadow-sm"
                >
                  <Plus size={18} /> New School Year
                </button>
              </div>

              <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
                <table className="w-full text-left text-sm">
                  <thead className="bg-gray-50 text-gray-600 font-bold border-b border-gray-100 uppercase tracking-wider text-xs">
                    <tr>
                      <th className="p-4">Name</th>
                      <th className="p-4">Duration</th>
                      <th className="p-4">Status</th>
                      <th className="p-4 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {schoolYears.map(sy => (
                      <tr key={sy.id} className="border-b border-gray-50 hover:bg-gray-50/50">
                        <td className="p-4 font-bold text-gray-800">{sy.name}</td>
                        <td className="p-4 text-gray-500">{new Date(sy.start_date).toLocaleDateString()} - {new Date(sy.end_date).toLocaleDateString()}</td>
                        <td className="p-4">
                          {sy.is_active ? (
                            <span className="bg-green-100 text-green-700 px-3 py-1 rounded-full text-xs font-bold uppercase">Active</span>
                          ) : (
                            <span className="bg-gray-100 text-gray-500 px-3 py-1 rounded-full text-xs font-bold uppercase">Inactive</span>
                          )}
                        </td>
                        <td className="p-4 text-right flex justify-end gap-2">
                          {!sy.is_active && (
                            <button onClick={() => activateSchoolYear(sy.id)} className="px-3 py-1.5 bg-blue-50 text-blue-600 rounded-lg text-xs font-bold hover:bg-blue-100">Activate</button>
                          )}
                          <button onClick={() => { setSyForm(sy); setShowSyModal(true); }} className="p-1.5 text-gray-400 hover:text-primary-green hover:bg-green-50 rounded-lg"><Edit size={16} /></button>
                          <button onClick={() => deleteSchoolYear(sy.id)} className="p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg"><Trash2 size={16} /></button>
                        </td>
                      </tr>
                    ))}
                    {schoolYears.length === 0 && (
                      <tr><td colSpan="4" className="text-center p-8 text-gray-400 font-medium">No school years configured.</td></tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* ACADEMIC EVENTS TAB */}
          {activeTab === 'academic-events' && (
            <div className="space-y-6">
              <div className="flex justify-between items-center bg-blue-50 p-4 rounded-xl border border-blue-100">
                <div className="flex items-start gap-3">
                  <AlertCircle className="text-blue-500 mt-0.5 shrink-0" size={20} />
                  <div>
                    <h4 className="font-bold text-blue-800">Activity Blocks & Calendar Events</h4>
                    <p className="text-sm text-blue-600 mt-1">Configure blocked dates for Activity Proposals across the active school year.</p>
                  </div>
                </div>
                <button 
                  onClick={() => openEventModal()}
                  className="bg-primary-green text-white px-5 py-2.5 rounded-lg font-bold flex items-center gap-2 hover:bg-green-700 shadow-sm shrink-0"
                >
                  <Plus size={18} /> Add Event
                </button>
              </div>

              <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
                <table className="w-full text-left text-sm">
                  <thead className="bg-gray-50 text-gray-600 font-bold border-b border-gray-100 uppercase tracking-wider text-xs">
                    <tr>
                      <th className="p-4">Event Title</th>
                      <th className="p-4">Event Type</th>
                      <th className="p-4">School Year</th>
                      <th className="p-4">Duration</th>
                      <th className="p-4 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {academicEvents.map(ev => {
                      const sy = schoolYears.find(s => s.id === ev.school_year_id);
                      return (
                        <tr key={ev.id} className="border-b border-gray-50 hover:bg-gray-50/50">
                          <td className="p-4 font-bold text-gray-800">{ev.title}</td>
                          <td className="p-4">
                            <span className="bg-gray-100 text-gray-600 px-3 py-1 rounded-full text-xs font-bold">{eventTypes.find(t => t.value === ev.event_type)?.label || ev.event_type}</span>
                          </td>
                          <td className="p-4 text-gray-500 font-medium">{sy ? sy.name : 'N/A'}</td>
                          <td className="p-4 text-gray-500 font-medium">
                            {ev.start_date && ev.end_date ? (
                              <>{new Date(ev.start_date).toLocaleDateString()} - {new Date(ev.end_date).toLocaleDateString()}</>
                            ) : (
                              <span className="italic">Always Available</span>
                            )}
                          </td>
                          <td className="p-4 text-right flex justify-end gap-2">
                            <button onClick={() => openEventModal(ev)} className="p-1.5 text-gray-400 hover:text-primary-green hover:bg-green-50 rounded-lg"><Edit size={16} /></button>
                            <button onClick={() => deleteEvent(ev.id)} className="p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg"><Trash2 size={16} /></button>
                          </td>
                        </tr>
                      );
                    })}
                    {academicEvents.length === 0 && (
                      <tr><td colSpan="5" className="text-center p-8 text-gray-400 font-medium">No calendar events configured.</td></tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </>
      )}

      {/* MODALS */}
      {showSyModal && (
        <div className="fixed inset-0 z-[100] bg-black/40 flex items-center justify-center backdrop-blur-sm">
          <div className="bg-white rounded-2xl w-full max-w-md p-6 shadow-xl">
            <h3 className="text-xl font-bold mb-4">{syForm.id ? 'Edit' : 'Create'} School Year</h3>
            <form onSubmit={saveSchoolYear} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-xs font-bold text-gray-500 uppercase">Start Date</label>
                  <input required type="date" className="w-full mt-1 p-2 border rounded-lg outline-none focus:border-primary-green bg-white" value={syForm.start_date} onChange={e => {
                    const newStart = e.target.value;
                    const startYr = newStart ? new Date(newStart).getFullYear() : '';
                    const endYr = syForm.end_date ? new Date(syForm.end_date).getFullYear() : (startYr ? startYr + 1 : '');
                    const autoName = (startYr && endYr) ? (startYr === endYr ? `${startYr}` : `${startYr}-${endYr}`) : syForm.name;
                    setSyForm({ ...syForm, start_date: newStart, name: autoName });
                  }} />
                </div>
                <div>
                  <label className="text-xs font-bold text-gray-500 uppercase">End Date</label>
                  <input required type="date" className="w-full mt-1 p-2 border rounded-lg outline-none focus:border-primary-green bg-white" value={syForm.end_date} onChange={e => {
                    const newEnd = e.target.value;
                    const endYr = newEnd ? new Date(newEnd).getFullYear() : '';
                    const startYr = syForm.start_date ? new Date(syForm.start_date).getFullYear() : (endYr ? endYr - 1 : '');
                    const autoName = (startYr && endYr) ? (startYr === endYr ? `${startYr}` : `${startYr}-${endYr}`) : syForm.name;
                    setSyForm({ ...syForm, end_date: newEnd, name: autoName });
                  }} />
                </div>
              </div>
              <div>
                <label className="text-xs font-bold text-gray-500 uppercase">School Year</label>
                <div className="flex items-center gap-2 mt-1">
                  <span className="bg-gray-100 text-gray-600 font-bold px-3 py-2 rounded-lg text-xs shrink-0 border border-gray-200">Academic Year</span>
                  <input 
                    required 
                    type="text" 
                    placeholder="e.g. 2026-2027" 
                    className="w-full p-2 border rounded-lg outline-none focus:border-primary-green font-bold text-gray-800" 
                    value={syForm.name.replace(/^Academic Year\s*/i, '')} 
                    onChange={e => setSyForm({...syForm, name: e.target.value})} 
                  />
                </div>
              </div>
              <div className="pt-4 flex justify-end gap-3">
                <button type="button" onClick={() => setShowSyModal(false)} className="px-4 py-2 text-gray-500 font-bold hover:bg-gray-100 rounded-lg">Cancel</button>
                <button type="submit" className="px-4 py-2 bg-primary-green text-white font-bold rounded-lg hover:bg-green-700">Save</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {showEventModal && (
        <div className="fixed inset-0 z-[100] bg-black/40 flex items-center justify-center backdrop-blur-sm">
          <div className="bg-white rounded-2xl w-full max-w-lg p-6 shadow-xl">
            <h3 className="text-xl font-bold mb-4">{eventForm.id ? 'Edit' : 'Create'} Calendar Event</h3>
            <form onSubmit={saveEvent} className="space-y-4">
              <div>
                <label className="text-xs font-bold text-gray-500 uppercase">School Year</label>
                <select required className="w-full mt-1 p-2 border rounded-lg outline-none focus:border-primary-green bg-white" value={eventForm.school_year_id} onChange={e => setEventForm({...eventForm, school_year_id: e.target.value})}>
                  <option value="">Select School Year...</option>
                  {schoolYears.map(sy => <option key={sy.id} value={sy.id}>{sy.name}</option>)}
                </select>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-xs font-bold text-gray-500 uppercase">Event Type</label>
                  <select required className="w-full mt-1 p-2 border rounded-lg outline-none focus:border-primary-green bg-white" value={eventForm.event_type} onChange={e => {
                    const newType = e.target.value;
                    setEventForm({...eventForm, event_type: newType, blocks_activity: (newType === 'school_event' && eventForm.blocks_activity) || eventForm.blocks_activity})
                  }}>
                    {eventTypes.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
                  </select>
                </div>
                {eventForm.event_type === 'submission_window' && (
                  <div>
                    <label className="text-xs font-bold text-gray-500 uppercase">Document Type</label>
                    <select required className="w-full mt-1 p-2 border rounded-lg outline-none focus:border-primary-green bg-white" value={eventForm.document_type_id} onChange={e => setEventForm({...eventForm, document_type_id: e.target.value})}>
                      <option value="">Select Document...</option>
                      {documentTypes.map(dt => <option key={dt.id} value={dt.id}>{dt.name}</option>)}
                    </select>
                  </div>
                )}
              </div>
              {eventForm.event_type === 'submission_window' ? (
                <div>
                  <label className="text-xs font-bold text-gray-500 uppercase">Event Title</label>
                  <input 
                    type="text" 
                    disabled 
                    className="w-full mt-1 p-2 border rounded-lg bg-gray-100 text-gray-500 cursor-not-allowed font-medium italic text-xs" 
                    value={(() => {
                      const dt = documentTypes.find(d => d.id === eventForm.document_type_id);
                      return dt ? `${dt.name} Submission Window` : 'Auto-generated based on Document Type';
                    })()} 
                  />
                </div>
              ) : (
                <div>
                  <label className="text-xs font-bold text-gray-500 uppercase">Event Title</label>
                  <input required type="text" className="w-full mt-1 p-2 border rounded-lg outline-none focus:border-primary-green" value={eventForm.title} onChange={e => setEventForm({...eventForm, title: e.target.value})} />
                </div>
              )}
              
              <div className="border border-gray-100 rounded-xl p-4 bg-gray-50/50 mt-4">
                <div className="flex items-center justify-between mb-3">
                  <label className="text-xs font-bold text-gray-500 uppercase">Schedule</label>
                </div>
                
                <div className="grid grid-cols-2 gap-4">
                  {(() => {
                    const selectedSy = schoolYears.find(sy => sy.id === eventForm.school_year_id);
                    const isEntireSy = eventForm.event_type === 'submission_window' && selectedSy && eventForm.start_date === selectedSy.start_date.split('T')[0] && eventForm.end_date === selectedSy.end_date.split('T')[0];
                    return (
                      <>
                        <div>
                          <label className="text-[10px] font-bold text-gray-400 uppercase">Start Date</label>
                          <input type="date" className={`w-full mt-1 p-2 border rounded-lg outline-none focus:border-primary-green ${isEntireSy ? 'bg-gray-100 text-gray-500 cursor-not-allowed border-gray-200' : 'bg-white'}`} value={eventForm.start_date || ''} onChange={e => setEventForm({...eventForm, start_date: e.target.value})} required disabled={isEntireSy} />
                        </div>
                        <div>
                          <label className="text-[10px] font-bold text-gray-400 uppercase">End Date</label>
                          <input type="date" className={`w-full mt-1 p-2 border rounded-lg outline-none focus:border-primary-green ${isEntireSy ? 'bg-gray-100 text-gray-500 cursor-not-allowed border-gray-200' : 'bg-white'}`} value={eventForm.end_date || ''} onChange={e => setEventForm({...eventForm, end_date: e.target.value})} required disabled={isEntireSy} />
                        </div>
                      </>
                    );
                  })()}
                </div>

                <div className="flex flex-col gap-4 mt-4 pt-4 border-t border-gray-100">
                  {eventForm.event_type === 'submission_window' && eventForm.school_year_id && (() => {
                    const selectedSy = schoolYears.find(sy => sy.id === eventForm.school_year_id);
                    const isEntireSy = selectedSy && eventForm.start_date === selectedSy.start_date.split('T')[0] && eventForm.end_date === selectedSy.end_date.split('T')[0];
                    return (
                      <div className="flex items-center justify-between">
                        <label className="text-sm font-bold text-gray-700 cursor-pointer select-none">
                          Entire School Year
                        </label>
                        <div 
                          className={`w-11 h-6 flex items-center rounded-full p-1 cursor-pointer transition-colors ${isEntireSy ? 'bg-primary-green' : 'bg-gray-300'}`}
                          onClick={() => {
                            if (!isEntireSy && selectedSy) {
                              setEventForm({
                                ...eventForm,
                                start_date: selectedSy.start_date.split('T')[0],
                                end_date: selectedSy.end_date.split('T')[0]
                              });
                            } else {
                              setEventForm({
                                ...eventForm,
                                start_date: '',
                                end_date: ''
                              });
                            }
                          }}
                        >
                          <div className={`bg-white w-4 h-4 rounded-full shadow-md transform transition-transform ${isEntireSy ? 'translate-x-5' : ''}`}></div>
                        </div>
                      </div>
                    );
                  })()}
                  
                  <div className="flex items-center justify-between">
                    <label className="text-sm font-bold text-gray-700 cursor-pointer select-none">
                      Block Activity Proposals on these dates
                    </label>
                    <div 
                      className={`w-11 h-6 flex items-center rounded-full p-1 cursor-pointer transition-colors ${eventForm.blocks_activity ? 'bg-primary-green' : 'bg-gray-300'}`}
                      onClick={() => setEventForm({...eventForm, blocks_activity: !eventForm.blocks_activity})}
                    >
                      <div className={`bg-white w-4 h-4 rounded-full shadow-md transform transition-transform ${eventForm.blocks_activity ? 'translate-x-5' : ''}`}></div>
                    </div>
                  </div>
                </div>
              </div>

              <div className="pt-4 flex justify-end gap-3">
                <button type="button" onClick={() => setShowEventModal(false)} className="px-4 py-2 text-gray-500 font-bold hover:bg-gray-100 rounded-lg">Cancel</button>
                <button type="submit" className="px-4 py-2 bg-primary-green text-white font-bold rounded-lg hover:bg-green-700">Save</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* SEMESTER MODAL */}
      {showSemModal && (
        <div className="fixed inset-0 z-[100] bg-black/40 flex items-center justify-center backdrop-blur-sm">
          <div className="bg-white rounded-2xl w-full max-w-md p-6 shadow-xl">
            <h3 className="text-xl font-bold mb-4">{semForm.id ? 'Edit' : 'Create'} Semester</h3>
            <form onSubmit={saveSemester} className="space-y-4">
              <div>
                <label className="text-xs font-bold text-gray-500 uppercase">School Year</label>
                <select required className="w-full mt-1 p-2 border rounded-lg outline-none focus:border-primary-green bg-white" value={semForm.school_year_id} onChange={e => setSemForm({...semForm, school_year_id: e.target.value})}>
                  <option value="">Select School Year...</option>
                  {schoolYears.map(sy => <option key={sy.id} value={sy.id}>{sy.name}</option>)}
                </select>
              </div>
              <div>
                <label className="text-xs font-bold text-gray-500 uppercase">Semester Name (e.g., First Semester)</label>
                <input required type="text" className="w-full mt-1 p-2 border rounded-lg outline-none focus:border-primary-green" value={semForm.name} onChange={e => setSemForm({...semForm, name: e.target.value})} />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-xs font-bold text-gray-500 uppercase">Start Date</label>
                  <input required type="date" className="w-full mt-1 p-2 border rounded-lg outline-none focus:border-primary-green" value={semForm.start_date} onChange={e => setSemForm({...semForm, start_date: e.target.value})} />
                </div>
                <div>
                  <label className="text-xs font-bold text-gray-500 uppercase">End Date</label>
                  <input required type="date" className="w-full mt-1 p-2 border rounded-lg outline-none focus:border-primary-green" value={semForm.end_date} onChange={e => setSemForm({...semForm, end_date: e.target.value})} />
                </div>
              </div>
              <div className="pt-4 flex justify-end gap-3">
                <button type="button" onClick={() => setShowSemModal(false)} className="px-4 py-2 text-gray-500 font-bold hover:bg-gray-100 rounded-lg">Cancel</button>
                <button type="submit" className="px-4 py-2 bg-primary-green text-white font-bold rounded-lg hover:bg-green-700">Save</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ACTIVATION WARNING MODAL */}
      {warningModal.show && (
        <div className="fixed inset-0 z-[110] bg-black/40 flex items-center justify-center backdrop-blur-sm">
          <div className="bg-white rounded-2xl w-full max-w-md p-6 shadow-xl border border-amber-100">
            <div className="flex items-center gap-3 text-amber-600 mb-4">
              <AlertCircle size={28} />
              <h3 className="text-lg font-bold text-gray-800">Date Range Warning</h3>
            </div>
            <p className="text-sm text-gray-600 mb-6">{warningModal.message}</p>
            <div className="flex justify-end">
              <button 
                onClick={() => setWarningModal({ show: false, message: '', semId: null })}
                className="px-5 py-2 bg-primary-green text-white font-bold rounded-lg hover:bg-green-700 text-xs"
              >
                Understand & Continue
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};

export default AcademicSettings;
