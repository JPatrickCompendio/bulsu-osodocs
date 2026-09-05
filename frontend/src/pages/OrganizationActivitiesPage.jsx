import React, { useState, useEffect } from 'react';
import { apiFetch } from '../config/api';
import { CheckCircle2, AlertCircle, Check } from 'lucide-react';
import PageHeader from '../components/PageHeader';

import { ApprovedActivitiesTab } from '../components/academic/ApprovedActivitiesTab';
import { fetchApprovedActivitySchedules } from '../utils/activityScheduleFetcher';

const OrganizationActivitiesPage = () => {
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState(null);

  const [schoolYears, setSchoolYears] = useState([]);
  const [selectedSyId, setSelectedSyId] = useState('');
  const [approvedActivities, setApprovedActivities] = useState([]);
  const [activitiesLoading, setActivitiesLoading] = useState(false);

  const showMessage = (msg, type = 'success') => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3500);
  };

  const fetchData = async () => {
    setLoading(true);
    try {
      const syRes = await apiFetch('/api/school-years');
      const syData = await syRes.json();

      if (syData.success) {
        const sys = syData.data || [];
        setSchoolYears(sys);
        const activeSy = sys.find((s) => s.is_active) || sys[0];
        if (activeSy && !selectedSyId) {
          setSelectedSyId(activeSy.id);
        }
      }
    } catch (err) {
      showMessage('Failed to fetch school year data', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  useEffect(() => {
    if (selectedSyId) {
      loadApprovedActivities(selectedSyId);
    }
  }, [selectedSyId]);

  const loadApprovedActivities = async (syId) => {
    setActivitiesLoading(true);
    try {
      const acts = await fetchApprovedActivitySchedules(syId);
      setApprovedActivities(acts || []);
    } catch (err) {
      console.error('Failed to load approved activities:', err);
    } finally {
      setActivitiesLoading(false);
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
          title="Organization Activities"
          subtitle="Calendar and schedule listing of approved student organization activities."
          icon={CheckCircle2}
          iconColor="green"
        />
      </div>

      {loading ? (
        <div className="bg-white rounded-2xl p-16 text-center text-gray-400 font-bold border border-gray-100">
          Loading Organization Activities...
        </div>
      ) : (
        <ApprovedActivitiesTab
          schoolYears={schoolYears}
          approvedActivities={approvedActivities}
          selectedSyId={selectedSyId}
          onSelectSy={setSelectedSyId}
          loading={activitiesLoading}
        />
      )}
    </div>
  );
};

export default OrganizationActivitiesPage;
