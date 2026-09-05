import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { apiFetch } from '../config/api';
import { AlertCircle, Check, Info, Plus, BookOpen } from 'lucide-react';
import PageHeader from '../components/PageHeader';
import { ActiveYearPanel } from '../components/academic/ActiveYearPanel';
import { SchoolYearsTable } from '../components/academic/SchoolYearsTable';

import { SchoolYearModal } from '../components/academic/SchoolYearModal';
import { SemesterModal } from '../components/academic/SemesterModal';
import { ArchiveConfirmModal } from '../components/academic/ArchiveConfirmModal';
import { CloseConfirmModal } from '../components/academic/CloseConfirmModal';

const SchoolYearPage = () => {
  const { user } = useAuth();
  const canEdit = user?.role === 'admin';

  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState(null);

  // Core Data
  const [schoolYears, setSchoolYears] = useState([]);
  const [semesters, setSemesters] = useState([]);
  const [academicEvents, setAcademicEvents] = useState([]);
  const [selectedSyId, setSelectedSyId] = useState('');

  // Modals
  const [showSyModal, setShowSyModal] = useState(false);
  const [syForm, setSyForm] = useState({ id: null, name: '', start_date: '', end_date: '', is_active: false });

  const [showSemModal, setShowSemModal] = useState(false);
  const [semForm, setSemForm] = useState({ id: null, school_year_id: '', name: '', start_date: '', end_date: '', is_active: false });

  const [archiveModal, setArchiveModal] = useState({ show: false, sy: null });
  const [closeModal, setCloseModal] = useState({ show: false, sy: null });

  const showMessage = (msg, type = 'success') => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3500);
  };

  const fetchData = async () => {
    setLoading(true);
    try {
      const [syRes, semRes, evRes] = await Promise.all([
        apiFetch('/api/school-years'),
        apiFetch('/api/semesters?includeArchived=true'),
        apiFetch('/api/academic-events'),
      ]);

      const [syData, semData, evData] = await Promise.all([
        syRes.json(),
        semRes.json(),
        evRes.json(),
      ]);

      if (syData.success) {
        const sys = syData.data || [];
        setSchoolYears(sys);
        const activeSy = sys.find((s) => s.is_active) || sys[0];
        if (activeSy && !selectedSyId) {
          setSelectedSyId(activeSy.id);
        }
      }

      if (semData.success) setSemesters(semData.data || []);
      if (evData.success) setAcademicEvents(evData.data || []);
    } catch (err) {
      showMessage('Failed to fetch school year and semester data', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const activeSy = schoolYears.find((s) => s.is_active);
  const activeSemester = semesters.find((s) => s.school_year_id === activeSy?.id && s.is_active);
  const blockedDaysCount = academicEvents.filter(
    (e) =>
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

      const dup = schoolYears.find(
        (s) =>
          s.id !== syForm.id &&
          (s.name.toLowerCase().trim() === finalName.toLowerCase() ||
            (s.start_date.split('T')[0] === syForm.start_date && s.end_date.split('T')[0] === syForm.end_date))
      );

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

  const handleOpenCloseModal = (sy) => {
    setCloseModal({ show: true, sy });
  };

  const closeSchoolYearSubmissions = async (sy) => {
    if (!sy) return;
    try {
      const payload = { ...sy, is_closed: true };
      const res = await apiFetch(`/api/school-years/${sy.id}`, {
        method: 'PUT',
        body: JSON.stringify(payload),
      });
      if (res.ok) {
        showMessage(`Submissions for ${sy.name} are now CLOSED.`);
        setCloseModal({ show: false, sy: null });
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
      const sy = schoolYears.find((s) => s.id === semForm.school_year_id);
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

  return (
    <div className="min-h-screen bg-[#f8fafc] pb-32 relative">
      {/* Toast Notification */}
      {toast && (
        <div
          className={`fixed top-20 right-4 sm:right-10 z-[999999] px-6 py-4 rounded-xl shadow-2xl flex items-center gap-3 text-white font-extrabold text-xs tracking-wide ${
            toast.type === 'error' ? 'bg-red-600' : 'bg-emerald-700'
          } animate-in slide-in-from-top-4`}
        >
          {toast.type === 'error' ? <AlertCircle size={20} /> : <Check size={20} />}
          <span>{toast.msg}</span>
        </div>
      )}

      {/* Header */}
      <div className="mb-6 border-b border-gray-100 pb-6">
        <PageHeader
          title="School Year & Semesters"
          subtitle="Configure academic school years, active term statuses, and semester schedules."
          icon={BookOpen}
          iconColor="emerald"
        />
      </div>

      {!canEdit && (
        <div className="mb-6 bg-blue-50 border border-blue-200 rounded-2xl p-4 text-blue-800 flex items-center gap-3 text-xs font-bold shadow-2xs">
          <Info size={18} className="text-blue-600 shrink-0" />
          <span>
            You are viewing School Year Settings in <strong>Read-Only Mode</strong>. Only System Administrators can configure school years and semesters.
          </span>
        </div>
      )}

      {loading ? (
        <div className="bg-white rounded-2xl p-16 text-center text-gray-400 font-bold border border-gray-100">
          Loading School Year & Semester Settings...
        </div>
      ) : (
        <div className="space-y-6">
          <ActiveYearPanel
            activeSy={activeSy}
            activeSemester={activeSemester}
            blockedDaysCount={blockedDaysCount}
            canEdit={canEdit}
            onEdit={(sy) => {
              setSyForm(sy);
              setShowSyModal(true);
            }}
          />

          <SchoolYearsTable
            schoolYears={schoolYears}
            semesters={semesters}
            canEdit={canEdit}
            onNewSchoolYear={() => {
              setSyForm({ id: null, name: '', start_date: '', end_date: '', is_active: false });
              setShowSyModal(true);
            }}
            onEdit={(sy) => {
              setSyForm(sy);
              setShowSyModal(true);
            }}
            onArchive={(sy) => setArchiveModal({ show: true, sy })}
            onDelete={deleteSchoolYear}
            onNewSemester={(targetSyId) => {
              setSemForm({
                id: null,
                school_year_id: targetSyId || selectedSyId,
                name: '',
                start_date: '',
                end_date: '',
                is_active: false,
              });
              setShowSemModal(true);
            }}
            onEditSemester={(sem) => {
              setSemForm(sem);
              setShowSemModal(true);
            }}
            onArchiveSemester={archiveSemester}
          />
        </div>
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

      <ArchiveConfirmModal
        isOpen={archiveModal.show}
        onClose={() => setArchiveModal({ show: false, sy: null })}
        onConfirm={confirmArchiveSchoolYear}
        targetSy={archiveModal.sy}
      />

      <CloseConfirmModal
        isOpen={closeModal.show}
        onClose={() => setCloseModal({ show: false, sy: null })}
        onConfirm={closeSchoolYearSubmissions}
        targetSy={closeModal.sy}
      />
    </div>
  );
};

export default SchoolYearPage;
