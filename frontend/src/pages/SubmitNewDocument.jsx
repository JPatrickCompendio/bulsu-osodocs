import React, { useState, useEffect, useRef, useMemo } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import * as subService from '../services/submissionService';
import * as reqService from '../services/requirementService';
import * as subtypeService from '../services/subtypeService';
import { supabase } from '../supabaseClient';
import { apiClient, apiUrl } from '../config/apiClient';
import {
  FileText, Upload, Send, Save, ArrowLeft, CheckCircle2,
  AlertCircle, Loader2, Info, Calendar, User, MapPin,
  Clock, Users, Search, ChevronRight, RefreshCcw, X,
  FileCheck, Download, Eye, Trash2, File as FileIcon,
  Eraser, Check, CheckSquare, Lock, Paperclip, Settings, FilePlus
} from 'lucide-react';
import PageHeader from '../components/PageHeader';

const SubmitNewDocument = () => {
  const { user, refreshUser } = useAuth();
  const navigate = useNavigate();

  // Navigation & State
  const [view, setView] = useState('dashboard'); // 'dashboard' or 'form'
  const [loading, setLoading] = useState(true);
  const [docTypes, setDocTypes] = useState([]);
  const [reqCounts, setReqCounts] = useState({}); // Dynamic counts
  const [availability, setAvailability] = useState({}); // Document availability from system
  const [blockedEvents, setBlockedEvents] = useState([]); // Blocked activity dates
  const [globalWarning, setGlobalWarning] = useState(''); // School Year bounds warning
  const [selectedType, setSelectedType] = useState(null);
  const [subType, setSubType] = useState('');
  const [selectedSubtypeObj, setSelectedSubtypeObj] = useState(null);
  const [requirements, setRequirements] = useState([]);
  const [docSubtypes, setDocSubtypes] = useState({}); // Mapping from docTypeId -> active subtypes

  // UI States
  const [showClearModal, setShowClearModal] = useState(false);
  const [showUnsavedModal, setShowUnsavedModal] = useState(false);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [toast, setToast] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [adminEmail, setAdminEmail] = useState('');
  const [activeSchoolYearId, setActiveSchoolYearId] = useState(null);

  const isSuspended = user?.status?.startsWith('Suspended') && user?.role === 'org-president';

  useEffect(() => {
    if (isSuspended) {
      apiClient.get(apiUrl('/api/system/admin-email'))
        .then(res => {
          if (res.data?.email) {
            setAdminEmail(res.data.email);
          }
        })
        .catch(err => console.error('Error fetching admin email:', err));
    }
  }, [isSuspended]);

  // Form Data
  const defaultForm = {
    activity_number: '', organization_name: '', adviser_name: '', activity_title: '',
    person_in_charge: '', student_id_no: '', contact_number: '', target_venue: '',
    target_date: '', target_time: '', target_end_time: '', duration: '', is_indefinite_end_time: false, number_of_students: '',
    activity_dates: [], // Multi-date selection
    schedules: [], // New schedules array
    target_audience: '', nature_of_activity: '', objectives: [], others_objective: '',
    satisfaction_goal_1: '', satisfaction_goal_2: '', satisfaction_goal_3: '', partners: '', sponsors: ''
  };
  const [proposalDetails, setProposalDetails] = useState(defaultForm);
  const [localFiles, setLocalFiles] = useState({}); // Stores actual File objects before uploading
  const [existingAttachments, setExistingAttachments] = useState([]);
  const [activeDraft, setActiveDraft] = useState({ submissionId: null, versionId: null });
  const [draftNotice, setDraftNotice] = useState('');
  const location = useLocation();

  useEffect(() => {
    loadDocumentTypes();
  }, []);

  const showToast = (message, type = 'success') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 4000);
  };

  const loadDocumentTypes = async () => {
    try {
      const types = await reqService.fetchDocumentTypes();
      setDocTypes(types || []);

      // Fetch dynamic requirement counts
      const reqs = await supabase.from('requirements').select('documentTypeID, subtype_id');
      const counts = {};
      if (reqs.data) {
        reqs.data.forEach(r => {
          const key = r.subtype_id ? `${r.documentTypeID}-${r.subtype_id}` : r.documentTypeID;
          counts[key] = (counts[key] || 0) + 1;
        });
      }
      setReqCounts(counts);

      // Fetch all active subtypes for these document types
      const subtypesRes = await supabase
        .from('document_subtypes')
        .select('*')
        .eq('status', 'active')
        .order('sort_order', { ascending: true });
        
      if (subtypesRes.data) {
        const subtypesMap = {};
        subtypesRes.data.forEach(st => {
          if (!subtypesMap[st.document_type_id]) subtypesMap[st.document_type_id] = [];
          subtypesMap[st.document_type_id].push(st);
        });
        setDocSubtypes(subtypesMap);
      }

      // Fetch document availability
      if (user?.id) {
        const availRes = await apiClient.get(apiUrl('/api/system/document-availability'), {
          params: { userId: user.id },
        });
        if (availRes.data?.success) {
          let frontendAvailability = availRes.data.availability || {};
          setBlockedEvents(availRes.data.blockedEvents || []);
          const sy = availRes.data.activeSchoolYear;

          if (!sy || availRes.data.message === 'The current date is outside the active School Year.') {
            setGlobalWarning(availRes.data.message || 'No active school year configured.');
            setAvailability(frontendAvailability);
          } else {
            setActiveSchoolYearId(sy.id);

            try {
              const { data: userSubs } = await supabase
                .from('submissions')
                .select('status, document_type_id, documentType:document_type_id(name)')
                .eq('user_id', user.id)
                .eq('school_year_id', sy.id);

              if (userSubs && userSubs.length > 0) {
                const existingDocTypeIds = new Set();
                userSubs.forEach(s => {
                  if (s.status !== 'disapproved' && s.document_type_id) {
                    existingDocTypeIds.add(String(s.document_type_id));
                    existingDocTypeIds.add(Number(s.document_type_id));
                  }
                });

                types.forEach(dt => {
                  const isActivityProposal = dt.name.toLowerCase() === 'activity proposal' || dt.name.toLowerCase().includes('proposal');
                  if (!isActivityProposal && existingDocTypeIds.has(dt.id)) {
                    if (!frontendAvailability[dt.id]) frontendAvailability[dt.id] = { isAvailable: true };
                    frontendAvailability[dt.id].isAvailable = false;
                    frontendAvailability[dt.id].lockedReason = 'You already have an active submission for this category. Check your My Documents page.';
                  }
                });
              }
            } catch (err) {
              console.error('Failed to fetch user submissions for availability check:', err);
            }

            setAvailability(frontendAvailability);
          }
        }
      }
    } catch (err) {
      showToast('Failed to load categories', 'error');
    } finally {
      setLoading(false);
    }
  };

  const humanizeProposalType = (type) => {
    if (!type) return '';
    return type.replace(/-/g, ' ').replace(/\b\w/g, (char) => char.toUpperCase());
  };

  const getAttachedRequirementIds = () => {
    const existingIds = existingAttachments.map((item) => item.requirement_id);
    const uploadedIds = Object.keys(localFiles).map((key) => Number(key));
    return new Set([...existingIds, ...uploadedIds]);
  };

  const loadSubmissionById = async (submissionId) => {
    setLoading(true);
    try {
      const result = await subService.getSubmissionById(submissionId);
      if (!result) {
        showToast('Could not find saved draft.', 'error');
        return;
      }

      const { submission, version } = result;
      console.debug('Loaded submission for editing:', { submission, version });
      const type = submission.documentType;
      const isProposal = type?.name?.toLowerCase().includes('activity proposal');
      const rawDetails = version?.activity_proposal_details;
      const details = (Array.isArray(rawDetails) ? rawDetails[0] : rawDetails) || {};
      
      const proposalTypeStr = isProposal ? humanizeProposalType(submission?.proposal_type) : '';
      let subtypeId = submission?.subtype_id || null;
      let matchedSubtype = null;

      if (!subtypeId && proposalTypeStr) {
        // Fallback mapping for existing records without subtype_id
        const stRes = await supabase.from('document_subtypes').select('*').eq('document_type_id', type.id).eq('name', proposalTypeStr).single();
        if (stRes.data) {
           subtypeId = stRes.data.id;
           matchedSubtype = stRes.data;
        }
      } else if (subtypeId) {
        const stRes = await supabase.from('document_subtypes').select('*').eq('id', subtypeId).single();
        if (stRes.data) matchedSubtype = stRes.data;
      }

      const subtypeName = matchedSubtype ? matchedSubtype.name : proposalTypeStr;

      const reqs = await subService.getRequirementsForType(type.id, subtypeId, isProposal ? subtypeName : null);

      setRequirements(reqs || []);
      setSelectedType(type);
      setSubType(subtypeName);
      setSelectedSubtypeObj(matchedSubtype);
      setExistingAttachments(version?.submission_attachments || []);
      setActiveDraft({ submissionId: submission.id, versionId: version?.id });
      setDraftNotice('Loaded draft from your previous session.');

      if (isProposal) {
        const scheds = details.activity_schedules || [];
        setProposalDetails({
          ...defaultForm,
          ...details,
          schedules: scheds.length > 0 ? scheds : (details.target_date ? details.target_date.split(',').map(d => ({
            activity_date: d.trim(),
            start_time: details.target_time || '',
            end_time: details.target_end_time || '',
            is_indefinite: details.is_indefinite_end_time || false,
            duration_minutes: details.duration ? Math.round(parseFloat(details.duration) * 60) : 0
          })).filter(s => s.activity_date) : []),
          activity_dates: details.target_date ? details.target_date.split(',').map(d => d.trim()).filter(Boolean) : [],
          organization_name: details.organization_name || user?.org_name || '',
          adviser_name: details.adviser_name || user?.adviser_name || '',
          person_in_charge: details.person_in_charge || user?.full_name || '',
          student_id_no: details.student_id_no || user?.student_no || '',
          contact_number: details.contact_number || user?.contact_no || ''
        });
      } else {
        setProposalDetails({
          ...defaultForm,
          organization_name: user?.org_name || '',
          adviser_name: user?.adviser_name || '',
          person_in_charge: user?.full_name || '',
          student_id_no: user?.student_no || '',
          contact_number: user?.contact_no || ''
        });
      }

      setLocalFiles({});
      setView('form');
    } catch (err) {
      console.error('Failed to load draft by ID:', err);
      showToast('Could not load saved draft details.', 'error');
    } finally {
      setLoading(false);
    }
  };

  const initializeSubmissionForm = async (type, subtypeObj = null, subName = '') => {
    setLoading(true);
    try {
      const isProposal = type.name.toLowerCase().includes('activity proposal');
      const subtypeId = subtypeObj ? subtypeObj.id : null;
      const proposalType = isProposal ? subName : null;
      const draft = await subService.getDraftSubmission(user.id, type.id, subtypeId, proposalType);
      const reqs = await subService.getRequirementsForType(type.id, subtypeId, proposalType);

      setRequirements(reqs || []);
      setSelectedType(type);
      setSubType(subName);
      setSelectedSubtypeObj(subtypeObj);
      setShowUnsavedModal(false);
      setLocalFiles({});
      setExistingAttachments([]);
      setActiveDraft({ submissionId: null, versionId: null });
      setDraftNotice('');

      if (draft?.submission && draft?.version) {
        const rawDetails = draft.version.activity_proposal_details;
        const details = (Array.isArray(rawDetails) ? rawDetails[0] : rawDetails) || {};
        setExistingAttachments(draft.version.submission_attachments || []);
        setActiveDraft({ submissionId: draft.submission.id, versionId: draft.version.id });
        setDraftNotice('Continuing an existing draft for this category.');

        if (isProposal) {
          const scheds = details.activity_schedules || [];
          setProposalDetails({
            ...defaultForm,
            ...details,
            schedules: scheds.length > 0 ? scheds : (details.target_date ? details.target_date.split(',').map(d => ({
              activity_date: d.trim(),
              start_time: details.target_time || '',
              end_time: details.target_end_time || '',
              is_indefinite: details.is_indefinite_end_time || false,
              duration_minutes: details.duration ? Math.round(parseFloat(details.duration) * 60) : 0
            })).filter(s => s.activity_date) : []),
            activity_dates: details.target_date ? details.target_date.split(',').map(d => d.trim()).filter(Boolean) : [],
            activity_number: details.activity_number || `AP-${new Date().getFullYear()}-${(new Date().getMonth() + 1).toString().padStart(2, '0')}-001`,
            organization_name: details.organization_name || user?.org_name || '',
            adviser_name: details.adviser_name || user?.adviser_name || '',
            person_in_charge: details.person_in_charge || user?.full_name || '',
            student_id_no: details.student_id_no || user?.student_no || '',
            contact_number: details.contact_number || user?.contact_no || ''
          });
        } else {
          setProposalDetails({
            ...defaultForm,
            organization_name: user?.org_name || '',
            adviser_name: user?.adviser_name || '',
            person_in_charge: user?.full_name || '',
            student_id_no: user?.student_no || '',
            contact_number: user?.contact_no || ''
          });
        }
      } else {
        if (isProposal) {
          const dateStr = `${new Date().getFullYear()}-${(new Date().getMonth() + 1).toString().padStart(2, '0')}`;
          setProposalDetails({
            ...defaultForm,
            activity_number: `AP-${dateStr}-001`,
            organization_name: user?.org_name || '',
            adviser_name: user?.adviser_name || '',
            person_in_charge: user?.full_name || '',
            student_id_no: user?.student_no || '',
            contact_number: user?.contact_no || ''
          });
        } else {
          setProposalDetails({
            ...defaultForm,
            organization_name: user?.org_name || '',
            adviser_name: user?.adviser_name || '',
            person_in_charge: user?.full_name || '',
            student_id_no: user?.student_no || '',
            contact_number: user?.contact_no || ''
          });
        }
      }
      setView('form');
    } catch (err) {
      console.error('Failed to initialize submission:', err);
      showToast('Could not initialize submission', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const submissionId = new URLSearchParams(location.search).get('submissionId');
    if (submissionId) {
      loadSubmissionById(submissionId);
    }
  }, [location.search]);

  const existingAttachmentMap = useMemo(() => {
    return Object.fromEntries(existingAttachments.map((item) => [item.requirement_id, item]));
  }, [existingAttachments]);

  const attachedRequirementIds = useMemo(() => getAttachedRequirementIds(), [existingAttachments, localFiles]);

  const getReqCount = (typeId, subtypeObj) => {
    const sId = subtypeObj ? subtypeObj.id : null;
    const specificCount = sId ? (reqCounts[`${typeId}-${sId}`] || 0) : 0;
    const generalCount = reqCounts[typeId] || 0;
    return sId ? specificCount + generalCount : generalCount;
  };

  const handleSelectType = async (type, subtypeObj = null, subName = '') => {
    await initializeSubmissionForm(type, subtypeObj, subName);
  };

  const handleFileUpload = (reqId, file) => {
    if (!file) return;
    setLocalFiles(prev => ({ ...prev, [reqId]: file }));
  };

  useEffect(() => {
    // Detect if the user has made any meaningful unsaved changes
    const isDirty = Object.keys(localFiles).length > 0 ||
      proposalDetails.activity_title.trim() !== '' ||
      proposalDetails.target_date !== '' ||
      proposalDetails.target_venue !== '' ||
      proposalDetails.nature_of_activity !== '';
    setHasUnsavedChanges(isDirty);
  }, [proposalDetails, localFiles]);

  const processUploadsAndSave = async (status) => {
    setIsSaving(true);
    try {
      let submissionId = activeDraft.submissionId;
      let versionId = activeDraft.versionId;
      let versionNumber = 1;

      // 1. Create submission and version records first if not existing
      if (!submissionId || !versionId) {
        const { submission, version } = await subService.startNewSubmission(user.id, selectedType.id, selectedType.name, activeSchoolYearId, selectedSubtypeObj?.id || null);
        submissionId = submission.id;
        versionId = version.id;
        versionNumber = version.version_number;
        setActiveDraft({ submissionId, versionId });
      }

      // 2. Upload all local files to bucket
      for (const [reqId, file] of Object.entries(localFiles)) {
        const path = await subService.uploadSubmissionFile(file, selectedType.name, submissionId, versionNumber, subType);
        await subService.saveAttachmentRecord(versionId, reqId, file.name, path);
      }

      // Clear local files to avoid re-uploading the same files on next draft save
      if (status !== 'submitted') {
        setLocalFiles({});
      }

      // 3. Save Proposal Details if it's an Activity Proposal
      const isProposal = selectedType.name.toLowerCase().includes('activity proposal');
      if (isProposal) {
        await subService.saveProposalDetails(versionId, proposalDetails, selectedSubtypeObj?.id || null, subType);
      }

      // 4. If status is 'submitted', finalize it
      if (status === 'submitted') {
        await subService.submitForReview(submissionId, versionId, user.id);
        if (refreshUser) {
          await refreshUser();
        }
        showToast('Document Registered Successfully!');
        setTimeout(() => navigate('/my-documents', { state: { highlightedId: submissionId } }), 2000);
      } else {
        showToast('Progress Saved as Draft!', 'success');
        setHasUnsavedChanges(false);
      }
    } catch (err) {
      console.error('Registration error:', err);
      showToast('Action failed: ' + (err.message || ''), 'error');
    } finally {
      setIsSaving(false);
    }
  };

  const handleRegisterDocument = (e) => {
    e.preventDefault();
    if (isSaving) return;

    // Validate form inputs if proposal
    const isProposal = selectedType.name.toLowerCase().includes('activity proposal');
    if (isProposal) {
      const p = proposalDetails;
      
      const hasInvalidSchedule = p.schedules.length === 0 || p.schedules.some(s => 
        !s.activity_date || !s.start_time || (!s.is_indefinite && !s.end_time)
      );

      if (
        !p.activity_title ||
        hasInvalidSchedule ||
        !p.person_in_charge ||
        !p.student_id_no ||
        !p.contact_number ||
        !p.target_venue ||
        !p.number_of_students ||
        !p.target_audience ||
        !p.nature_of_activity ||
        p.objectives.length === 0 ||
        !p.satisfaction_goal_1
      ) {
        showToast('Please fill in all required form fields.', 'error');
        return;
      }

      if (!/^09\d{9}$/.test(p.contact_number)) {
        showToast('Contact number must start with 09 and have exactly 11 digits.', 'error');
        return;
      }
    }

    const attachedIds = getAttachedRequirementIds();
    if (attachedIds.size < requirements.length) {
      showToast(`Please attach all ${requirements.length} required documents before registering.`, 'error');
      return;
    }

    processUploadsAndSave('submitted');
  };

  const handleSaveDraft = () => {
    if (isSaving) return;
    if (Object.keys(localFiles).length === 0 && !hasUnsavedChanges) {
      showToast('Nothing to save yet.', 'error');
      return;
    }
    processUploadsAndSave('draft');
  };

  const handleBackNavigation = () => {
    if (hasUnsavedChanges) {
      setShowUnsavedModal(true);
    } else {
      clearFormOptions('both', true);
      setView('dashboard');
    }
  };

  const clearFormOptions = (type, silent = false) => {
    if (type === 'details' || type === 'both') setProposalDetails(defaultForm);
    if (type === 'attachments' || type === 'both') setLocalFiles({});
    if (type === 'both') setActiveDraft({ submissionId: null, versionId: null });
    setShowClearModal(false);
    if (!silent) {
      showToast('Cleared successfully', 'info');
    }
  };

  const toggleArrayField = (field, value) => {
    setProposalDetails(prev => {
      const current = prev[field];
      if (current.includes(value)) {
        return { ...prev, [field]: current.filter(item => item !== value) };
      } else {
        return { ...prev, [field]: [...current, value] };
      }
    });
  };

  const handleAddDate = (dateStr) => {
    if (!dateStr) return;

    // Check if blocked
    const dateObj = new Date(dateStr);
    // To properly compare dates without time zone offsets messing it up
    dateObj.setHours(0, 0, 0, 0);

    const blockedEvent = blockedEvents.find(e => {
      if (e.document_type_id && e.document_type_id !== selectedType?.id) return false;
      const start = e.start_date ? new Date(e.start_date) : null;
      const end = e.end_date ? new Date(e.end_date) : null;

      if (start) start.setHours(0, 0, 0, 0);
      if (end) end.setHours(0, 0, 0, 0);

      if (start && end) return dateObj >= start && dateObj <= end;
      if (start) return dateObj >= start;
      if (end) return dateObj <= end;
      return false;
    });

    if (blockedEvent) {
      showToast(`Cannot select ${dateStr}: Blocked by "${blockedEvent.title}"`, 'error');
      return;
    }

    if (!proposalDetails.activity_dates.includes(dateStr)) {
      setProposalDetails(prev => ({
        ...prev,
        activity_dates: [...prev.activity_dates, dateStr].sort()
      }));
    }
  };

  const handleRemoveDate = (dateStr) => {
    setProposalDetails(prev => ({
      ...prev,
      activity_dates: prev.activity_dates.filter(d => d !== dateStr)
    }));
  };


  if (isSuspended) {
    let suspensionMessage = 'Your account has been suspended due to system requirements or missing submissions.';
    if (user.status.includes(':')) {
      suspensionMessage = user.status.split(':').slice(1).join(':').trim();
    }

    return (
      <div className="fixed inset-0 bg-slate-900/80 backdrop-blur-md z-[9999] flex items-center justify-center p-4">
        <div className="bg-white rounded-3xl shadow-2xl w-full max-w-lg overflow-hidden border border-gray-100 flex flex-col animate-in zoom-in-95 duration-300">
          <div className="p-6 text-white flex items-center gap-4 bg-gradient-to-r from-red-600 to-red-500">
            <div className="w-12 h-12 bg-white/20 rounded-full flex items-center justify-center text-white shrink-0">
              <Lock size={28} />
            </div>
            <div>
              <h2 className="text-xl font-black tracking-wide">ACCOUNT SUSPENDED</h2>
              <p className="text-white/80 text-xs mt-0.5 font-medium">Access to document submission is restricted</p>
            </div>
          </div>

          <div className="p-8 text-gray-800">
            <p className="text-gray-600 text-sm leading-relaxed mb-6 font-medium">
              An administrator has suspended your organization's account. While suspended, you can access your dashboard and view documents, but you cannot submit new documents or new versions.
            </p>

            <div className="mb-6 p-4 bg-red-50 rounded-xl border border-red-100">
              <span className="block text-[10px] font-black text-red-500 uppercase tracking-widest mb-1.5">Suspension Reason</span>
              <p className="text-red-700 text-xs leading-relaxed italic whitespace-pre-wrap">
                "{suspensionMessage}"
              </p>
            </div>

            <div className="bg-gray-50 rounded-xl p-4 border border-gray-100 flex items-center gap-3">
              <AlertCircle className="text-red-500 shrink-0" size={20} />
              <span className="text-xs text-gray-500 font-medium text-left">
                Please contact the SDS Coordinator at {adminEmail && adminEmail.includes('@') ? (
                  <a href={`mailto:${adminEmail}`} className="text-blue-600 hover:underline font-bold">{adminEmail}</a>
                ) : adminEmail ? (
                  <span className="font-bold text-gray-800">{adminEmail}</span>
                ) : (
                  <span className="font-bold text-gray-800">the administrator</span>
                )} to reactivate your account.
              </span>
            </div>
          </div>

          <div className="p-4 bg-gray-50 border-t border-gray-100 flex justify-end gap-3 shrink-0">
            <button
              type="button"
              onClick={() => navigate('/')}
              className="px-6 py-2.5 bg-primary-green hover:bg-green-700 text-white text-xs font-black rounded-xl transition-all duration-200 shadow-md shadow-green-600/10"
            >
              Back to Dashboard
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (loading && view === 'dashboard') {
    return (
      <div className="flex h-[80vh] items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <div className="w-10 h-10 border-4 border-primary-green border-t-transparent rounded-full animate-spin"></div>
          <span className="text-primary-green font-bold tracking-[0.2em] text-xs uppercase animate-pulse">Loading Data...</span>
        </div>
      </div>
    );
  }

  const isProposal = selectedType?.name.toLowerCase().includes('activity proposal');

  const renderRequirementsList = (isModal = false) => (
    <div className={`space-y-4 ${isModal ? '' : 'w-full max-w-5xl mx-auto'}`}>
      {requirements.map((req, i) => {
        const existing = existingAttachmentMap[req.id];
        return (
          <div key={req.id} className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-6 bg-white rounded-xl shadow-sm border border-gray-100 hover:border-amber-200 transition-all">
            <div className="flex items-start sm:items-center gap-4 sm:gap-6">
              <div className="w-10 h-10 bg-green-100 text-green-800 font-black text-sm flex items-center justify-center rounded-lg shrink-0">
                {i + 1}
              </div>
              <div className="flex flex-col">
                <h4 className="text-sm font-black text-gray-800 leading-tight uppercase">{req.title}</h4>
                <p className="text-[11px] font-bold text-gray-500 mt-1">{req.description || 'Please provide the requested document'}</p>
                <span className="text-[11px] font-bold text-gray-400 mt-2 block">{req.referenceCode || 'REQ'}</span>
              </div>
            </div>

            {localFiles[req.id] ? (
              <div className="flex items-center gap-3 bg-green-50 px-5 py-2.5 rounded-lg border border-green-100 self-start sm:self-auto shrink-0">
                <Check className="text-green-600" size={16} />
                <span className="text-xs font-bold text-green-700 max-w-[150px] truncate" title={localFiles[req.id].name}>
                  {localFiles[req.id].name}
                </span>
                <button type="button" onClick={() => setLocalFiles(prev => {
                  const next = { ...prev }; delete next[req.id]; return next;
                })} className="p-1 text-red-400 hover:text-red-600 hover:bg-red-50 rounded-md transition-all ml-2">
                  <Trash2 size={14} />
                </button>
              </div>
            ) : existing ? (
              <div className="flex flex-col gap-2 bg-yellow-50 px-5 py-3 rounded-lg border border-yellow-100 self-start sm:self-auto shrink-0 max-w-full">
                <div className="flex items-center gap-3">
                  <CheckSquare className="text-amber-600" size={16} />
                  <span className="text-xs font-bold text-amber-700 truncate max-w-[180px]" title={existing.file_name}>{existing.file_name}</span>
                </div>
                <div className="flex items-center gap-2">
                  <button type="button" onClick={() => setExistingAttachments(prev => prev.filter(a => a.requirement_id !== req.id))} className="text-xs text-blue-600 font-bold hover:underline">Remove saved file</button>
                </div>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => document.getElementById(`file-${isModal ? 'modal' : 'inline'}-${req.id}`).click()}
                className="px-6 py-2.5 bg-[#f5b027] text-white font-bold rounded-lg hover:bg-amber-500 transition-all text-xs flex items-center justify-center gap-2 self-start sm:self-auto shrink-0 shadow-md"
              >
                <Paperclip size={14} /> Attach File
                <input
                  type="file" id={`file-${isModal ? 'modal' : 'inline'}-${req.id}`} className="hidden" accept=".pdf"
                  onChange={(e) => handleFileUpload(req.id, e.target.files[0])}
                />
              </button>
            )}
          </div>
        );
      })}
      {requirements.length === 0 && (
        <div className="py-12 flex flex-col items-center justify-center text-gray-400 bg-white rounded-2xl border border-gray-100">
          <FileText size={48} className="mb-4 opacity-20" />
          <p className="font-bold text-sm">No requirements found for this category.</p>
        </div>
      )}
    </div>
  );

  return (
    <div className="min-h-screen bg-[#F8F9FA] text-gray-700 font-sans pb-32 relative">
      {toast && (
        <div className={`fixed top-10 right-10 z-[200] flex items-center gap-4 px-6 py-4 rounded-xl shadow-xl animate-in slide-in-from-right-full ${toast.type === 'error' ? 'bg-red-600 text-white' : 'bg-primary-green text-white'
          }`}>
          {toast.type === 'error' ? <AlertCircle size={20} /> : <CheckCircle2 size={20} />}
          <span className="font-bold text-sm">{toast.message}</span>
        </div>
      )}

      {/* DASHBOARD VIEW */}
      {view === 'dashboard' && (
        <div className="animate-in fade-in duration-500">
          <div className="flex flex-col md:flex-row justify-between items-start md:items-end mb-8 border-b border-gray-100 pb-6 gap-6">
            <PageHeader 
              title="Submit New Document" 
              subtitle="Select a category to start your submission" 
              icon={FilePlus} 
              iconColor="gold" 
            />
            <div className="relative w-full max-w-sm">
              <input
                type="text" placeholder="Search"
                className="w-full pl-5 pr-10 py-3 bg-white border border-gray-200 rounded-lg focus:border-primary-green outline-none transition-all shadow-sm text-sm font-bold"
                value={searchQuery} onChange={e => setSearchQuery(e.target.value)}
              />
              <Search className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
            </div>
          </div>

          {globalWarning && (
            <div className="mb-8 p-6 bg-red-50 border-2 border-red-200 rounded-2xl flex items-start gap-4">
              <div className="p-3 bg-red-100 text-red-600 rounded-xl">
                <AlertCircle size={24} />
              </div>
              <div>
                <h3 className="text-lg font-black text-red-800 uppercase">System Unavailable</h3>
                <p className="text-red-600 font-bold text-sm mt-1">{globalWarning}</p>
                <p className="text-red-500 font-bold text-xs mt-2">Document submissions are currently disabled. Please contact your system administrator to configure the active School Year.</p>
              </div>
            </div>
          )}

          <div className={`grid grid-cols-1 md:grid-cols-3 gap-6 mb-16 ${globalWarning ? 'opacity-50 pointer-events-none' : ''}`}>
            {/* Helper for rendering item */}
            {(() => {
              const renderCategoryItem = (typeObj, subName, isLast = false) => {
                if (!typeObj) return null;
                const avail = availability[typeObj.id];
                const isLocked = avail && !avail.isAvailable;

                if (isLocked) {
                  return (
                    <div key={subName} className={`w-full px-6 py-4 flex items-center justify-between bg-gray-50/50 ${!isLast ? 'border-b border-gray-100' : ''}`}>
                      <div className="flex items-center gap-4">
                        <Lock size={16} className="text-gray-400" />
                        <div className="flex flex-col items-start text-left">
                          <span className="text-sm font-bold text-gray-400 line-through">{subName}</span>
                          <span className="text-[10px] font-bold text-red-500 mt-0.5">{avail.lockedReason}</span>
                        </div>
                      </div>
                    </div>
                  );
                }

                return (
                  <button
                    key={subName}
                    onClick={() => handleSelectType(typeObj, typeObj.__subtype, subName)}
                    className={`w-full px-6 py-4 flex items-center justify-between hover:bg-white transition-all group/btn ${!isLast ? 'border-b border-gray-50' : ''}`}
                  >
                    <div className="flex items-center gap-6">
                      <span className="text-sm font-bold text-gray-500 group-hover/btn:text-primary-green">{subName}</span>
                      <span className="text-[10px] font-black text-gray-300 uppercase">• {getReqCount(typeObj.id, typeObj.__subtype)} Reqs</span>
                    </div>
                    <ChevronRight size={18} className="text-gray-300 group-hover/btn:text-primary-green" />
                  </button>
                );
              };

              return (
                <>
                  {docTypes.map(typeObj => {
                    const subtypes = docSubtypes[typeObj.id] || [];
                    const isActivityProposal = typeObj.name.toLowerCase().includes('activity proposal');
                    const isReport = typeObj.name.toLowerCase().includes('report');
                    const isRenewal = typeObj.name.toLowerCase().includes('renewal');

                    let icon = <FileText size={24} />;
                    let bg = 'bg-blue-50 text-blue-500';
                    let desc = 'Required documents';

                    if (isReport) { icon = <Calendar size={24} />; bg = 'bg-orange-50 text-orange-500'; desc = 'Annual & Mid-year summaries'; }
                    if (isRenewal) { icon = <RefreshCcw size={24} />; bg = 'bg-amber-50 text-amber-500'; desc = 'Requirements for org renewal'; }

                    return (
                      <div key={typeObj.id} className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden flex flex-col">
                        <div className="p-6 flex items-start gap-4">
                          <div className={`w-12 h-12 rounded-xl flex items-center justify-center shrink-0 ${bg}`}>
                            {icon}
                          </div>
                          <div>
                            <h3 className="text-lg font-black text-gray-800 uppercase">{typeObj.name}</h3>
                            <p className="text-gray-400 text-xs font-bold mt-1">{desc}</p>
                          </div>
                        </div>
                        <div className="mt-auto border-t border-gray-50 bg-gray-50/30 flex flex-col h-full justify-end">
                          {subtypes.length > 0 ? (
                            subtypes.map((st, idx) => {
                              const tObj = { ...typeObj, __subtype: st };
                              return renderCategoryItem(tObj, st.name, idx === subtypes.length - 1);
                            })
                          ) : (
                            renderCategoryItem(typeObj, typeObj.name, true)
                          )}
                        </div>
                      </div>
                    );
                  })}
                </>
              );
            })()}
          </div>
        </div>
      )}

      {/* FORM VIEW */}
      {view === 'form' && (
        <form onSubmit={handleRegisterDocument} className="flex flex-col animate-in fade-in duration-500 relative min-h-screen">
          {/* Header - Stretches full width */}
          <div className="fixed top-16 left-64 right-0 z-40 bg-white border-b border-gray-100 px-8 py-5 flex items-center justify-between shadow-sm">
            <div className="flex items-center gap-6">
              <button type="button" onClick={handleBackNavigation} className="p-2 hover:bg-gray-50 rounded-lg transition-all">
                <ArrowLeft size={24} className="text-gray-500" />
              </button>
              <div className="flex items-center gap-4">
                <div className="p-2 bg-primary-green rounded-lg">
                  <FileText className="text-white" size={24} />
                </div>
                <div>
                  <h1 className="text-xl font-black text-gray-800 uppercase">{selectedType.name}</h1>
                  <p className="text-gray-400 font-bold text-[10px] uppercase tracking-widest">{subType}</p>
                  {draftNotice && (
                    <p className="text-[10px] text-blue-600 font-bold mt-1">{draftNotice}</p>
                  )}
                </div>
              </div>
            </div>

            <div className="text-xs font-bold text-gray-400 uppercase tracking-widest bg-gray-50 px-4 py-2 rounded-lg border border-gray-100">
              Draft Mode
            </div>
          </div>

          <div className="flex-1 p-8 pb-32 pt-28 bg-gray-50/20">
            <div className={`w-full max-w-5xl mx-auto space-y-8`}>

              {/* Conditional Proposal Form */}
              {isProposal && (
                <div className="space-y-8">
                  <div className="bg-white p-10 rounded-2xl shadow-sm border border-gray-100 space-y-8">
                    <div className="text-center pb-8 border-b border-gray-100">
                      <h2 className="text-2xl font-black text-gray-800 uppercase tracking-widest">Activity Proposal Form</h2>
                    </div>

                    <div className="space-y-6">
                      {/* Basic Info */}
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-6">
                        <div className="space-y-2 md:col-span-2">
                          <label className="text-xs font-black text-gray-600 uppercase">Name of Student Organization <span className="text-red-500">*</span></label>
                          <input type="text" required className="w-full px-4 py-3 bg-gray-100 border-b-2 border-gray-200 text-gray-500 font-bold text-sm outline-none cursor-not-allowed" value={proposalDetails.organization_name} readOnly />
                        </div>
                        <div className="space-y-2">
                          <label className="text-xs font-black text-gray-600 uppercase">Name of Adviser <span className="text-red-500">*</span></label>
                          <input type="text" required className="w-full px-4 py-3 bg-gray-100 border-b-2 border-gray-200 text-gray-500 font-bold text-sm outline-none cursor-not-allowed" value={proposalDetails.adviser_name} readOnly />
                        </div>
                        <div className="space-y-2">
                          <label className="text-xs font-black text-gray-600 uppercase">Activity Number</label>
                          <input type="text" className="w-full px-4 py-3 bg-gray-100 text-gray-500 border-b-2 border-gray-200 font-bold text-sm outline-none" value={proposalDetails.activity_number} readOnly />
                        </div>
                        <div className="space-y-2 md:col-span-2">
                          <label className="text-xs font-black text-gray-600 uppercase">Activity Title <span className="text-red-500">*</span></label>
                          <input type="text" required className="w-full px-4 py-3 bg-gray-50 border-b-2 border-gray-200 focus:border-primary-green font-bold text-sm outline-none transition-all" value={proposalDetails.activity_title} onChange={e => setProposalDetails({ ...proposalDetails, activity_title: e.target.value })} />
                        </div>
                        <div className="space-y-2">
                          <label className="text-xs font-black text-gray-600 uppercase">Name of Person-In-Charge <span className="text-red-500">*</span></label>
                          <input type="text" required className="w-full px-4 py-3 bg-gray-100 border-b-2 border-gray-200 text-gray-500 font-bold text-sm outline-none cursor-not-allowed" value={proposalDetails.person_in_charge} readOnly />
                        </div>
                        <div className="space-y-2">
                          <label className="text-xs font-black text-gray-600 uppercase">Student ID No. <span className="text-red-500">*</span></label>
                          <input type="text" required className="w-full px-4 py-3 bg-gray-100 border-b-2 border-gray-200 text-gray-500 font-bold text-sm outline-none cursor-not-allowed" value={proposalDetails.student_id_no} readOnly />
                        </div>
                        <div className="space-y-2 md:col-span-2">
                          <label className="text-xs font-black text-gray-600 uppercase">Contact Number of Person-In-Charge <span className="text-red-500">*</span></label>
                          <input type="text" required maxLength={11} pattern="^09\d{9}$" className="w-full px-4 py-3 bg-gray-50 border-b-2 border-gray-200 focus:border-primary-green font-bold text-sm outline-none transition-all" value={proposalDetails.contact_number} onChange={e => setProposalDetails({ ...proposalDetails, contact_number: e.target.value.replace(/[^0-9]/g, '') })} />
                        </div>
                        <div className="space-y-2 md:col-span-2">
                          <label className="text-xs font-black text-gray-600 uppercase">Target Venue <span className="text-red-500">*</span></label>
                          <input type="text" required className="w-full px-4 py-3 bg-gray-50 border-b-2 border-gray-200 focus:border-primary-green font-bold text-sm outline-none transition-all" value={proposalDetails.target_venue} onChange={e => setProposalDetails({ ...proposalDetails, target_venue: e.target.value })} />
                        </div>

                        {/* Multi-Date Schedules */}
                        <div className="space-y-4 md:col-span-2">
                          <div className="flex items-center justify-between border-b border-gray-100 pb-2">
                            <label className="text-xs font-black text-gray-600 uppercase">Activity Schedules <span className="text-red-500">*</span></label>
                            <button
                              type="button"
                              onClick={() => setProposalDetails(prev => ({
                                ...prev,
                                schedules: [...prev.schedules, { activity_date: '', start_time: '', end_time: '', is_indefinite: false, duration_minutes: 0 }]
                              }))}
                              className="text-xs font-bold text-primary-green hover:bg-green-50 px-3 py-1.5 rounded-lg transition-all"
                            >
                              + Add Schedule
                            </button>
                          </div>
                          
                          {proposalDetails.schedules.length === 0 ? (
                            <div className="text-center py-6 bg-gray-50 rounded-xl border border-dashed border-gray-200">
                              <p className="text-xs font-bold text-gray-400 uppercase">No schedules added yet.</p>
                            </div>
                          ) : (
                            <div className="space-y-4">
                              {proposalDetails.schedules.map((sched, idx) => (
                                <div key={idx} className="bg-white border border-gray-200 rounded-xl p-4 relative group hover:border-primary-green transition-colors">
                                  <button
                                    type="button"
                                    onClick={() => setProposalDetails(prev => ({
                                      ...prev,
                                      schedules: prev.schedules.filter((_, i) => i !== idx)
                                    }))}
                                    className="absolute -top-3 -right-3 w-7 h-7 bg-white border border-red-200 text-red-500 rounded-full flex items-center justify-center hover:bg-red-50 shadow-sm opacity-0 group-hover:opacity-100 transition-opacity"
                                  >
                                    <X size={14} />
                                  </button>
                                  
                                  <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                                    <div className="space-y-1">
                                      <span className="text-[10px] font-bold text-gray-400 uppercase">Date</span>
                                      <input
                                        type="date"
                                        required
                                        className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg focus:border-primary-green font-bold text-xs outline-none"
                                        value={sched.activity_date}
                                        onChange={e => {
                                          const val = e.target.value;
                                          const isBlocked = blockedEvents.some(ev => {
                                            const evStart = new Date(ev.start_date);
                                            const evEnd = ev.end_date ? new Date(ev.end_date) : evStart;
                                            const check = new Date(val);
                                            evStart.setHours(0,0,0,0);
                                            evEnd.setHours(0,0,0,0);
                                            check.setHours(0,0,0,0);
                                            return check >= evStart && check <= evEnd;
                                          });
                                          
                                          if (isBlocked) {
                                            showToast(`Cannot select ${val}: This date is blocked by the Academic Calendar.`, 'error');
                                            return;
                                          }

                                          const newScheds = [...proposalDetails.schedules];
                                          newScheds[idx].activity_date = val;
                                          setProposalDetails(prev => ({ ...prev, schedules: newScheds }));
                                        }}
                                      />
                                    </div>
                                    <div className="space-y-1">
                                      <span className="text-[10px] font-bold text-gray-400 uppercase">Start Time</span>
                                      <input
                                        type="time"
                                        required
                                        className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg focus:border-primary-green font-bold text-xs outline-none"
                                        value={sched.start_time}
                                        onChange={e => {
                                          const newScheds = [...proposalDetails.schedules];
                                          newScheds[idx].start_time = e.target.value;
                                          
                                          // calc duration
                                          if (newScheds[idx].start_time && newScheds[idx].end_time && !newScheds[idx].is_indefinite) {
                                            const start = new Date(`1970-01-01T${newScheds[idx].start_time}`);
                                            const end = new Date(`1970-01-01T${newScheds[idx].end_time}`);
                                            let diff = (end - start) / (1000 * 60);
                                            if (diff < 0) diff += 24 * 60;
                                            newScheds[idx].duration_minutes = Math.round(diff);
                                          }
                                          setProposalDetails(prev => ({ ...prev, schedules: newScheds }));
                                        }}
                                      />
                                    </div>
                                    <div className="space-y-1">
                                      <span className="text-[10px] font-bold text-gray-400 uppercase">End Time</span>
                                      <input
                                        type="time"
                                        required={!sched.is_indefinite}
                                        disabled={sched.is_indefinite}
                                        className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg focus:border-primary-green font-bold text-xs outline-none disabled:opacity-50"
                                        value={sched.end_time}
                                        onChange={e => {
                                          const newScheds = [...proposalDetails.schedules];
                                          newScheds[idx].end_time = e.target.value;
                                          
                                          // calc duration
                                          if (newScheds[idx].start_time && newScheds[idx].end_time && !newScheds[idx].is_indefinite) {
                                            const start = new Date(`1970-01-01T${newScheds[idx].start_time}`);
                                            const end = new Date(`1970-01-01T${newScheds[idx].end_time}`);
                                            let diff = (end - start) / (1000 * 60);
                                            if (diff < 0) diff += 24 * 60;
                                            newScheds[idx].duration_minutes = Math.round(diff);
                                          }
                                          setProposalDetails(prev => ({ ...prev, schedules: newScheds }));
                                        }}
                                      />
                                      <label className="flex items-center gap-2 cursor-pointer mt-1">
                                        <input
                                          type="checkbox"
                                          checked={sched.is_indefinite}
                                          onChange={e => {
                                            const newScheds = [...proposalDetails.schedules];
                                            newScheds[idx].is_indefinite = e.target.checked;
                                            if (e.target.checked) {
                                              newScheds[idx].end_time = '';
                                              newScheds[idx].duration_minutes = 0;
                                            }
                                            setProposalDetails(prev => ({ ...prev, schedules: newScheds }));
                                          }}
                                          className="rounded text-primary-green focus:ring-primary-green"
                                        />
                                        <span className="text-[10px] font-bold text-gray-500">Indefinite</span>
                                      </label>
                                    </div>
                                    <div className="space-y-1">
                                      <span className="text-[10px] font-bold text-gray-400 uppercase">Duration</span>
                                      <div className="w-full px-3 py-2 bg-gray-100 border border-gray-200 rounded-lg text-gray-500 font-bold text-xs flex items-center justify-between">
                                        <span>{sched.is_indefinite ? 'N/A' : `${(sched.duration_minutes / 60).toFixed(1)} hrs`}</span>
                                      </div>
                                    </div>
                                  </div>
                                </div>
                              ))}
                              
                              <div className="flex justify-between items-center bg-green-50 p-4 rounded-xl border border-green-200">
                                <span className="text-sm font-black text-green-800 uppercase tracking-wide">Total Duration</span>
                                <span className="text-lg font-black text-primary-green">
                                  {(proposalDetails.schedules.reduce((acc, s) => acc + (s.duration_minutes || 0), 0) / 60).toFixed(1)} Hours
                                </span>
                              </div>
                            </div>
                          )}
                        </div>
                        <div className="space-y-2">
                          <label className="text-xs font-black text-gray-600 uppercase">Number of Student Involved <span className="text-red-500">*</span></label>
                          <input type="text" required className="w-full px-4 py-3 bg-gray-50 border-b-2 border-gray-200 focus:border-primary-green font-bold text-sm outline-none transition-all" value={proposalDetails.number_of_students} onChange={e => setProposalDetails({ ...proposalDetails, number_of_students: e.target.value.replace(/[^0-9]/g, '') })} />
                        </div>
                      </div>

                      {/* Checkboxes Section */}
                      <div className="pt-6 border-t border-gray-100 space-y-6">
                        <div className="space-y-3">
                          <label className="text-xs font-black text-gray-800 uppercase">Target Audience/Participants:</label>
                          <div className="flex flex-wrap gap-8">
                            {['Members only', 'BulSUans only', 'Open to the public'].map(opt => (
                              <label key={opt} className="flex items-center gap-3 cursor-pointer group">
                                <div className={`w-5 h-5 rounded-full flex items-center justify-center border-2 ${proposalDetails.target_audience === opt ? 'border-primary-green' : 'border-gray-300 group-hover:border-primary-green'}`}>
                                  {proposalDetails.target_audience === opt && <div className="w-2.5 h-2.5 bg-primary-green rounded-full" />}
                                </div>
                                <span className="text-sm font-bold text-gray-600">{opt}</span>
                                <input type="radio" name="target_audience" className="hidden" checked={proposalDetails.target_audience === opt} onChange={() => setProposalDetails({ ...proposalDetails, target_audience: opt })} />
                              </label>
                            ))}
                          </div>
                        </div>

                        <div className="space-y-3">
                          <label className="text-xs font-black text-gray-800 uppercase">Nature of Activity:</label>
                          <div className="flex flex-wrap gap-8">
                            {['Co-Curricular', 'Extra-Curricular'].map(opt => (
                              <label key={opt} className="flex items-center gap-3 cursor-pointer group">
                                <div className={`w-5 h-5 rounded-full flex items-center justify-center border-2 ${proposalDetails.nature_of_activity === opt ? 'border-primary-green' : 'border-gray-300 group-hover:border-primary-green'}`}>
                                  {proposalDetails.nature_of_activity === opt && <div className="w-2.5 h-2.5 bg-primary-green rounded-full" />}
                                </div>
                                <span className="text-sm font-bold text-gray-600">{opt}</span>
                                <input type="radio" name="nature" className="hidden" checked={proposalDetails.nature_of_activity === opt} onChange={() => setProposalDetails({ ...proposalDetails, nature_of_activity: opt })} />
                              </label>
                            ))}
                          </div>
                        </div>

                        <div className="space-y-4">
                          <label className="text-xs font-black text-gray-800 uppercase">Objectives of the Activity:</label>
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            {[
                              'Leadership Development and Formation',
                              'Membership Development and Formation',
                              'Organizational Program Management',
                              'Values Enrichment',
                              'Skills Enhancement'
                            ].map(opt => (
                              <label key={opt} className="flex items-center gap-3 cursor-pointer group">
                                <div className={`w-5 h-5 rounded flex items-center justify-center border-2 shrink-0 ${proposalDetails.objectives.includes(opt) ? 'bg-primary-green border-primary-green text-white' : 'border-gray-300 group-hover:border-primary-green'}`}>
                                  {proposalDetails.objectives.includes(opt) && <Check size={14} strokeWidth={3} />}
                                </div>
                                <span className="text-sm font-bold text-gray-600 leading-tight">{opt}</span>
                                <input type="checkbox" className="hidden" checked={proposalDetails.objectives.includes(opt)} onChange={() => toggleArrayField('objectives', opt)} />
                              </label>
                            ))}
                            <div className="flex items-center gap-3 col-span-1 md:col-span-2">
                              <label className="flex items-center gap-3 cursor-pointer group shrink-0">
                                <div className={`w-5 h-5 rounded flex items-center justify-center border-2 ${proposalDetails.objectives.includes('Others') ? 'bg-primary-green border-primary-green text-white' : 'border-gray-300 group-hover:border-primary-green'}`}>
                                  {proposalDetails.objectives.includes('Others') && <Check size={14} strokeWidth={3} />}
                                </div>
                                <span className="text-sm font-bold text-gray-600">Others:</span>
                                <input type="checkbox" className="hidden" checked={proposalDetails.objectives.includes('Others')} onChange={() => toggleArrayField('objectives', 'Others')} />
                              </label>
                              <input type="text" className="flex-1 px-4 py-2 bg-gray-50 border-b-2 border-gray-200 focus:border-primary-green font-bold text-sm outline-none transition-all" value={proposalDetails.others_objective} onChange={e => setProposalDetails({ ...proposalDetails, others_objective: e.target.value })} disabled={!proposalDetails.objectives.includes('Others')} />
                            </div>
                          </div>
                        </div>
                      </div>

                      {/* Needs and Goals */}
                      <div className="pt-6 border-t border-gray-100 space-y-4">
                        <label className="text-xs font-bold text-gray-600 italic">
                          Describe how this activity will satisfy the needs of the organization and how it will help the organization achieve its goals:
                        </label>
                        <div className="space-y-3">
                          <div className="flex items-start gap-4">
                            <span className="font-bold text-gray-600 mt-2">1.</span>
                            <input type="text" className="flex-1 px-4 py-2 bg-gray-50 border-b-2 border-gray-200 focus:border-primary-green font-bold text-sm outline-none transition-all" value={proposalDetails.satisfaction_goal_1} onChange={e => {
                              const val = e.target.value;
                              setProposalDetails(prev => ({
                                ...prev,
                                satisfaction_goal_1: val,
                                satisfaction_goal_2: val ? prev.satisfaction_goal_2 : '',
                                satisfaction_goal_3: val ? prev.satisfaction_goal_3 : ''
                              }));
                            }} />
                          </div>
                          <div className="flex items-start gap-4">
                            <span className="font-bold text-gray-600 mt-2">2.</span>
                            <input type="text" className="flex-1 px-4 py-2 bg-gray-50 border-b-2 border-gray-200 focus:border-primary-green font-bold text-sm outline-none transition-all disabled:opacity-50 disabled:cursor-not-allowed" disabled={!proposalDetails.satisfaction_goal_1} value={proposalDetails.satisfaction_goal_2} onChange={e => {
                              const val = e.target.value;
                              setProposalDetails(prev => ({
                                ...prev,
                                satisfaction_goal_2: val,
                                satisfaction_goal_3: val ? prev.satisfaction_goal_3 : ''
                              }));
                            }} />
                          </div>
                          <div className="flex items-start gap-4">
                            <span className="font-bold text-gray-600 mt-2">3.</span>
                            <input type="text" className="flex-1 px-4 py-2 bg-gray-50 border-b-2 border-gray-200 focus:border-primary-green font-bold text-sm outline-none transition-all disabled:opacity-50 disabled:cursor-not-allowed" disabled={!proposalDetails.satisfaction_goal_2} value={proposalDetails.satisfaction_goal_3} onChange={e => setProposalDetails({ ...proposalDetails, satisfaction_goal_3: e.target.value })} />
                          </div>
                        </div>
                      </div>

                      {/* Partners & Sponsors */}
                      <div className="pt-6 border-t border-gray-100 space-y-4">
                        <div className="space-y-2">
                          <label className="text-xs font-black text-gray-600 uppercase">Name of Partners (if any):</label>
                          <input type="text" className="w-full px-4 py-3 bg-gray-50 border-b-2 border-gray-200 focus:border-primary-green font-bold text-sm outline-none transition-all" value={proposalDetails.partners} onChange={e => setProposalDetails({ ...proposalDetails, partners: e.target.value })} />
                        </div>
                        <div className="space-y-2">
                          <label className="text-xs font-black text-gray-600 uppercase">Name of Sponsors (if any):</label>
                          <input type="text" className="w-full px-4 py-3 bg-gray-50 border-b-2 border-gray-200 focus:border-primary-green font-bold text-sm outline-none transition-all" value={proposalDetails.sponsors} onChange={e => setProposalDetails({ ...proposalDetails, sponsors: e.target.value })} />
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Conditional Non-Proposal List */}
              {!isProposal && renderRequirementsList(false)}
            </div>
          </div>

          {/* Fixed Bottom Action Bar */}
          <div className="fixed bottom-0 left-64 right-0 bg-white border-t border-gray-100 shadow-[0_-5px_20px_rgba(0,0,0,0.05)] z-50 p-4 flex justify-center w-[calc(100%-16rem)]">
            <div className="max-w-[90rem] w-full flex items-center justify-end gap-4 px-4">

              {/* Action Buttons */}
              <div className="flex items-center gap-3">
                {isProposal && (
                  <>
                    <button
                      type="button"
                      onClick={() => setShowUploadModal(true)}
                      className="px-5 py-2.5 bg-blue-50 text-blue-600 border border-blue-200 font-black rounded-lg hover:bg-blue-100 transition-all flex items-center gap-2 text-[11px] uppercase shadow-sm tracking-widest"
                    >
                      <Upload size={14} /> Upload Requirements ({attachedRequirementIds.size}/{requirements.length})
                    </button>
                    <div className="h-6 w-px bg-gray-200 mx-2"></div>
                  </>
                )}
                <button
                  type="button"
                  onClick={() => setShowClearModal(true)}
                  className="px-4 py-2.5 bg-white border border-gray-200 text-gray-500 font-black rounded-lg hover:bg-gray-50 transition-all flex items-center gap-2 text-[11px] uppercase shadow-sm tracking-widest"
                >
                  <Eraser size={14} /> Clear Form
                </button>
                <button
                  type="button"
                  onClick={handleSaveDraft}
                  disabled={isSaving}
                  className="px-5 py-2.5 bg-amber-50 text-amber-600 border border-amber-200 font-black rounded-lg hover:bg-amber-100 transition-all flex items-center gap-2 text-[11px] uppercase shadow-sm tracking-widest"
                >
                  <Save size={14} /> Save Draft
                </button>
                <button
                  type="submit"
                  disabled={isSaving}
                  className="px-6 py-2.5 bg-primary-green text-white font-black rounded-lg hover:bg-green-700 hover:scale-105 active:scale-95 transition-all shadow-md shadow-green-600/20 flex items-center gap-2 text-[11px] uppercase disabled:opacity-50 tracking-widest"
                >
                  {isSaving ? <Loader2 className="animate-spin" size={14} /> : <Send size={14} />}
                  Register
                </button>
              </div>
            </div>
          </div>
        </form>
      )}

      {/* Upload Requirements Modal */}
      {showUploadModal && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center p-6 bg-black/40 backdrop-blur-sm animate-in fade-in">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-2xl max-h-[85vh] flex flex-col animate-in zoom-in-95">
            <div className="flex items-center justify-between p-6 border-b border-gray-100">
              <div>
                <h2 className="text-xl font-black text-gray-800 uppercase">Required Attachments</h2>
                <p className="text-xs font-bold text-gray-400 mt-1">Please provide all necessary documents below</p>
              </div>
              <div className="flex items-center gap-4">
                <span className="text-xs font-black text-blue-600 bg-blue-50 px-3 py-1.5 rounded-lg uppercase tracking-widest">
                  {attachedRequirementIds.size} / {requirements.length} attached
                </span>
                <button type="button" onClick={() => setShowUploadModal(false)} className="p-2 hover:bg-gray-100 rounded-xl transition-all text-gray-400 hover:text-gray-600">
                  <X size={20} />
                </button>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto p-6 bg-gray-50/50">
              {renderRequirementsList(true)}
            </div>

            <div className="p-6 border-t border-gray-100 flex justify-end bg-white rounded-b-2xl">
              <button
                type="button"
                onClick={() => setShowUploadModal(false)}
                className="px-6 py-2.5 bg-gray-900 text-white font-black rounded-lg hover:bg-black transition-all shadow-md text-xs uppercase tracking-widest"
              >
                Done
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Clear Modal */}
      {showClearModal && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center p-6 bg-black/40 backdrop-blur-sm animate-in fade-in">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm p-6 text-center animate-in zoom-in-95">
            <h3 className="text-lg font-black text-gray-800 mb-4 uppercase">Clear Progress</h3>
            <p className="text-sm font-bold text-gray-500 mb-6">What would you like to clear?</p>
            <div className="space-y-3">
              {isProposal && (
                <button type="button" onClick={() => clearFormOptions('details')} className="w-full py-3 bg-gray-50 hover:bg-gray-100 font-bold rounded-lg text-sm transition-all text-gray-700">Clear Form Details Only</button>
              )}
              <button type="button" onClick={() => clearFormOptions('attachments')} className="w-full py-3 bg-gray-50 hover:bg-gray-100 font-bold rounded-lg text-sm transition-all text-gray-700">Remove All Attachments</button>
              <button type="button" onClick={() => clearFormOptions('both')} className="w-full py-3 bg-red-50 hover:bg-red-100 text-red-600 font-bold rounded-lg text-sm transition-all">Clear Everything</button>
              <button type="button" onClick={() => setShowClearModal(false)} className="w-full py-3 text-gray-400 font-bold text-sm hover:text-gray-600 transition-all mt-2">Cancel</button>
            </div>
          </div>
        </div>
      )}

      {/* Unsaved Changes Warning Modal */}
      {showUnsavedModal && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center p-6 bg-black/40 backdrop-blur-sm animate-in fade-in">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md p-8 text-center animate-in zoom-in-95">
            <AlertCircle size={56} className="text-amber-500 mx-auto mb-6" />
            <h3 className="text-2xl font-black text-gray-800 mb-2 uppercase tracking-tight">Unsaved Progress</h3>
            <p className="text-sm font-bold text-gray-500 mb-8">You have unsaved changes. Would you like to save them as a draft before leaving?</p>
            <div className="flex flex-col gap-3">
              <button
                type="button"
                onClick={() => {
                  setShowUnsavedModal(false);
                  handleSaveDraft();
                }}
                className="w-full py-3.5 bg-primary-green text-white font-black rounded-xl hover:bg-green-700 transition-all uppercase tracking-widest text-sm shadow-lg shadow-green-600/20"
              >
                Save as Draft
              </button>
              <button
                type="button"
                onClick={() => {
                  setShowUnsavedModal(false);
                  clearFormOptions('both', true);
                  setView('dashboard');
                }}
                className="w-full py-3.5 bg-red-50 text-red-600 hover:bg-red-100 font-black rounded-xl transition-all uppercase tracking-widest text-sm"
              >
                Discard Changes
              </button>
              <button
                type="button"
                onClick={() => setShowUnsavedModal(false)}
                className="w-full py-3 text-gray-400 font-bold text-sm hover:text-gray-600 transition-all mt-2 uppercase tracking-widest"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};

export default SubmitNewDocument;
