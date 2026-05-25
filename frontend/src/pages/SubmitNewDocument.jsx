import React, { useState, useEffect, useRef, useMemo } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import * as subService from '../services/submissionService';
import * as reqService from '../services/requirementService';
import { supabase } from '../supabaseClient';
import { 
  FileText, Upload, Send, Save, ArrowLeft, CheckCircle2, 
  AlertCircle, Loader2, Info, Calendar, User, MapPin, 
  Clock, Users, Search, ChevronRight, RefreshCcw, X, 
  FileCheck, Download, Eye, Trash2, File as FileIcon, 
  Eraser, Check, CheckSquare
} from 'lucide-react';

const SubmitNewDocument = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  
  // Navigation & State
  const [view, setView] = useState('dashboard'); // 'dashboard' or 'form'
  const [loading, setLoading] = useState(true);
  const [docTypes, setDocTypes] = useState([]);
  const [reqCounts, setReqCounts] = useState({}); // Dynamic counts
  const [selectedType, setSelectedType] = useState(null);
  const [subType, setSubType] = useState('');
  const [requirements, setRequirements] = useState([]);
  
  // UI States
  const [showClearModal, setShowClearModal] = useState(false);
  const [showUnsavedModal, setShowUnsavedModal] = useState(false);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [toast, setToast] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [showUploadModal, setShowUploadModal] = useState(false);

  // Form Data
  const defaultForm = {
    activity_number: '', organization_name: '', adviser_name: '', activity_title: '',
    person_in_charge: '', student_id_no: '', contact_number: '', target_venue: '', 
    target_date: '', target_time: '', duration: '', number_of_students: '',
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
      const reqs = await supabase.from('requirements').select('documentTypeID, proposal_type');
      const counts = {};
      if (reqs.data) {
        reqs.data.forEach(r => {
          const key = r.proposal_type ? `${r.documentTypeID}-${r.proposal_type}` : r.documentTypeID;
          counts[key] = (counts[key] || 0) + 1;
        });
      }
      setReqCounts(counts);
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
      const details = Array.isArray(version?.activity_proposal_details)
        ? version.activity_proposal_details[0]
        : version?.activity_proposal_details || {};
      const proposalType = isProposal ? humanizeProposalType(details?.proposal_type) : '';
      const reqs = await subService.getRequirementsForType(type.id, isProposal ? proposalType : null);

      setRequirements(reqs || []);
      setSelectedType(type);
      setSubType(proposalType);
      setExistingAttachments(version?.submission_attachments || []);
      setActiveDraft({ submissionId: submission.id, versionId: version?.id });
      setDraftNotice('Loaded draft from your previous session.');

      if (isProposal) {
        setProposalDetails({
          ...defaultForm,
          ...details,
          organization_name: details.organization_name || user?.org_name || '',
          adviser_name: details.adviser_name || user?.adviser_name || '',
          person_in_charge: details.person_in_charge || user?.full_name || '',
          student_id_no: details.student_id_no || user?.student_no || '',
          contact_number: details.contact_number || user?.contact_number || ''
        });
      } else {
        setProposalDetails({
          ...defaultForm,
          organization_name: user?.org_name || '',
          adviser_name: user?.adviser_name || '',
          person_in_charge: user?.full_name || '',
          student_id_no: user?.student_no || '',
          contact_number: user?.contact_number || ''
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

  const initializeSubmissionForm = async (type, subName = '') => {
    setLoading(true);
    try {
      const isProposal = type.name.toLowerCase().includes('activity proposal');
      const proposalType = isProposal ? subName : null;
      const draft = await subService.getDraftSubmission(user.id, type.id, proposalType);
      const reqs = await subService.getRequirementsForType(type.id, proposalType);

      setRequirements(reqs || []);
      setSelectedType(type);
      setSubType(subName);
      setShowUnsavedModal(false);
      setLocalFiles({});
      setExistingAttachments([]);
      setActiveDraft({ submissionId: null, versionId: null });
      setDraftNotice('');

      if (draft?.submission && draft?.version) {
        const details = Array.isArray(draft.version.activity_proposal_details)
          ? draft.version.activity_proposal_details[0]
          : draft.version.activity_proposal_details || {};
        setExistingAttachments(draft.version.submission_attachments || []);
        setActiveDraft({ submissionId: draft.submission.id, versionId: draft.version.id });
        setDraftNotice('Continuing an existing draft for this category.');

        if (isProposal) {
          setProposalDetails({
            ...defaultForm,
            ...details,
            activity_number: details.activity_number || `AP-${new Date().getFullYear()}-${(new Date().getMonth() + 1).toString().padStart(2, '0')}-001`,
            organization_name: details.organization_name || user?.org_name || '',
            adviser_name: details.adviser_name || user?.adviser_name || '',
            person_in_charge: details.person_in_charge || user?.full_name || '',
            student_id_no: details.student_id_no || user?.student_no || '',
            contact_number: details.contact_number || user?.contact_number || ''
          });
        } else {
          setProposalDetails({
            ...defaultForm,
            organization_name: user?.org_name || '',
            adviser_name: user?.adviser_name || '',
            person_in_charge: user?.full_name || '',
            student_id_no: user?.student_no || '',
            contact_number: user?.contact_number || ''
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
            contact_number: user?.contact_number || ''
          });
        } else {
          setProposalDetails({
            ...defaultForm,
            organization_name: user?.org_name || '',
            adviser_name: user?.adviser_name || '',
            person_in_charge: user?.full_name || '',
            student_id_no: user?.student_no || '',
            contact_number: user?.contact_number || ''
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

  const getReqCount = (typeId, subName) => {
    const pType = subName ? subName.toLowerCase().replace(' ', '-') : null;
    const specificCount = reqCounts[`${typeId}-${pType}`] || 0;
    const generalCount = reqCounts[typeId] || 0;
    return pType ? specificCount + generalCount : generalCount;
  };

  const handleSelectType = async (type, subName = '') => {
    await initializeSubmissionForm(type, subName);
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
        const { submission, version } = await subService.startNewSubmission(user.id, selectedType.id, selectedType.name);
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
        await subService.saveProposalDetails(versionId, proposalDetails, subType);
      }

      // 4. If status is 'submitted', finalize it
      if (status === 'submitted') {
        await subService.submitForReview(submissionId, versionId, user.id);
        showToast('Document Registered Successfully!');
        setTimeout(() => navigate('/my-documents'), 2000);
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
      if (!proposalDetails.activity_title || !proposalDetails.target_date || !proposalDetails.target_time) {
        showToast('Please fill in all required form fields.', 'error');
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

  if (loading && view === 'dashboard') {
    return <div className="flex h-screen items-center justify-center"><Loader2 className="animate-spin text-primary-green" size={48} /></div>;
  }

  const isProposal = selectedType?.name.toLowerCase().includes('activity proposal');

  return (
    <div className="min-h-screen bg-[#F8F9FA] text-gray-700 font-sans pb-32 relative">
      {toast && (
        <div className={`fixed top-10 right-10 z-[200] flex items-center gap-4 px-6 py-4 rounded-xl shadow-xl animate-in slide-in-from-right-full ${
          toast.type === 'error' ? 'bg-red-600 text-white' : 'bg-primary-green text-white'
        }`}>
          {toast.type === 'error' ? <AlertCircle size={20} /> : <CheckCircle2 size={20} />}
          <span className="font-bold text-sm">{toast.message}</span>
        </div>
      )}

      {/* DASHBOARD VIEW */}
      {view === 'dashboard' && (
        <div className="p-8 max-w-7xl mx-auto animate-in fade-in duration-500">
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-10 gap-6">
            <div className="flex items-center gap-5">
              <div className="p-3 bg-primary-green rounded-xl shadow-lg">
                <FileCheck className="text-white" size={28} />
              </div>
              <div>
                <h1 className="text-3xl font-black text-gray-800 tracking-tight">Submit New Document</h1>
                <p className="text-gray-400 font-bold text-sm">Select a category to start your submission</p>
              </div>
            </div>
            <div className="relative w-full max-w-sm">
              <input 
                type="text" placeholder="Search"
                className="w-full pl-5 pr-10 py-3 bg-white border border-gray-200 rounded-lg focus:border-primary-green outline-none transition-all shadow-sm text-sm font-bold"
                value={searchQuery} onChange={e => setSearchQuery(e.target.value)}
              />
              <Search className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-16">
            {/* Activity Proposal */}
            {docTypes.find(t => t.name.toLowerCase().includes('activity proposal')) && (
              <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden flex flex-col">
                <div className="p-6 flex items-start gap-4">
                  <div className="w-12 h-12 bg-blue-50 text-blue-500 rounded-xl flex items-center justify-center shrink-0">
                    <FileText size={24} />
                  </div>
                  <div>
                    <h3 className="text-lg font-black text-gray-800 uppercase">Activity Proposal</h3>
                    <p className="text-gray-400 text-xs font-bold mt-1">Requirements for activity proposals</p>
                  </div>
                </div>
                <div className="mt-auto border-t border-gray-50 bg-gray-50/30">
                  {['In Campus', 'Off Campus'].map((sub, i) => {
                    const typeObj = docTypes.find(t => t.name.toLowerCase().includes('activity proposal'));
                    return (
                      <button 
                        key={sub}
                        onClick={() => handleSelectType(typeObj, sub)}
                        className={`w-full px-6 py-4 flex items-center justify-between hover:bg-white transition-all group/btn ${i === 0 ? 'border-b border-gray-50' : ''}`}
                      >
                        <div className="flex items-center gap-6">
                          <span className="text-sm font-bold text-gray-500 group-hover/btn:text-primary-green">{sub}</span>
                          <span className="text-[10px] font-black text-gray-300 uppercase">• {getReqCount(typeObj.id, sub)} Reqs</span>
                        </div>
                        <ChevronRight size={18} className="text-gray-300 group-hover/btn:text-primary-green" />
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Year End Report */}
            {docTypes.find(t => t.name.toLowerCase().includes('report')) && (
              <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden flex flex-col">
                <div className="p-6 flex items-start gap-4">
                  <div className="w-12 h-12 bg-orange-50 text-orange-500 rounded-xl flex items-center justify-center shrink-0">
                    <Calendar size={24} />
                  </div>
                  <div>
                    <h3 className="text-lg font-black text-gray-800 uppercase">Reports</h3>
                    <p className="text-gray-400 text-xs font-bold mt-1">Annual & Mid-year summaries</p>
                  </div>
                </div>
                <div className="mt-auto border-t border-gray-50 bg-gray-50/30">
                  {['Mid-Year Report', 'Year-End Report'].map((sub, i) => {
                    const typeObj = docTypes.find(t => t.name.toLowerCase().includes(sub.toLowerCase()));
                    if (!typeObj) return null;
                    return (
                      <button 
                        key={sub}
                        onClick={() => handleSelectType(typeObj, sub)}
                        className={`w-full px-6 py-4 flex items-center justify-between hover:bg-white transition-all group/btn ${i === 0 ? 'border-b border-gray-50' : ''}`}
                      >
                        <div className="flex items-center gap-6">
                          <span className="text-sm font-bold text-gray-500 group-hover/btn:text-primary-green">{sub}</span>
                          <span className="text-[10px] font-black text-gray-300 uppercase">• {getReqCount(typeObj.id, null)} Reqs</span>
                        </div>
                        <ChevronRight size={18} className="text-gray-300 group-hover/btn:text-primary-green" />
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Renewal */}
            {docTypes.find(t => t.name.toLowerCase().includes('renewal')) && (() => {
              const typeObj = docTypes.find(t => t.name.toLowerCase().includes('renewal'));
              return (
                <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden flex flex-col group">
                  <div className="p-6 flex items-start gap-4">
                    <div className="w-12 h-12 bg-amber-50 text-amber-500 rounded-xl flex items-center justify-center shrink-0">
                      <RefreshCcw size={24} />
                    </div>
                    <div>
                      <h3 className="text-lg font-black text-gray-800 uppercase">Renewal Document</h3>
                      <p className="text-gray-400 text-xs font-bold mt-1">Requirements for org renewal</p>
                    </div>
                  </div>
                  <div className="mt-auto border-t border-gray-50 bg-gray-50/30 h-full flex items-center justify-between px-6 py-6 cursor-pointer hover:bg-white transition-all"
                    onClick={() => handleSelectType(typeObj, 'Renewal Document')}
                  >
                    <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest">{getReqCount(typeObj.id, null)} Requirements</span>
                    <ChevronRight size={24} className="text-gray-300 group-hover:text-primary-green transition-all" />
                  </div>
                </div>
              )
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
                        <input type="text" required className="w-full px-4 py-3 bg-gray-50 border-b-2 border-gray-200 focus:border-primary-green font-bold text-sm outline-none transition-all" value={proposalDetails.activity_title} onChange={e => setProposalDetails({...proposalDetails, activity_title: e.target.value})} />
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
                        <input type="text" required className="w-full px-4 py-3 bg-gray-50 border-b-2 border-gray-200 focus:border-primary-green font-bold text-sm outline-none transition-all" value={proposalDetails.contact_number} onChange={e => setProposalDetails({...proposalDetails, contact_number: e.target.value.replace(/[^0-9]/g, '')})} />
                      </div>
                      <div className="space-y-2 md:col-span-2">
                        <label className="text-xs font-black text-gray-600 uppercase">Target Venue <span className="text-red-500">*</span></label>
                        <input type="text" required className="w-full px-4 py-3 bg-gray-50 border-b-2 border-gray-200 focus:border-primary-green font-bold text-sm outline-none transition-all" value={proposalDetails.target_venue} onChange={e => setProposalDetails({...proposalDetails, target_venue: e.target.value})} />
                      </div>
                      
                      {/* Date & Time combined visually */}
                      <div className="space-y-2 md:col-span-2">
                        <label className="text-xs font-black text-gray-600 uppercase">Target Date and Time <span className="text-red-500">*</span></label>
                        <div className="flex gap-4">
                          <input type="date" required className="flex-1 px-4 py-3 bg-gray-50 border-b-2 border-gray-200 focus:border-primary-green font-bold text-sm outline-none transition-all" value={proposalDetails.target_date} onChange={e => setProposalDetails({...proposalDetails, target_date: e.target.value})} />
                          <input type="time" required className="flex-1 px-4 py-3 bg-gray-50 border-b-2 border-gray-200 focus:border-primary-green font-bold text-sm outline-none transition-all" value={proposalDetails.target_time} onChange={e => setProposalDetails({...proposalDetails, target_time: e.target.value})} />
                        </div>
                      </div>
                      
                      <div className="space-y-2">
                        <label className="text-xs font-black text-gray-600 uppercase">Duration (Hours)</label>
                        <input type="text" className="w-full px-4 py-3 bg-gray-50 border-b-2 border-gray-200 focus:border-primary-green font-bold text-sm outline-none transition-all" value={proposalDetails.duration} onChange={e => setProposalDetails({...proposalDetails, duration: e.target.value.replace(/[^0-9]/g, '')})} />
                      </div>
                      <div className="space-y-2">
                        <label className="text-xs font-black text-gray-600 uppercase">Number of Student Involved</label>
                        <input type="text" className="w-full px-4 py-3 bg-gray-50 border-b-2 border-gray-200 focus:border-primary-green font-bold text-sm outline-none transition-all" value={proposalDetails.number_of_students} onChange={e => setProposalDetails({...proposalDetails, number_of_students: e.target.value.replace(/[^0-9]/g, '')})} />
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
                              <input type="radio" name="target_audience" className="hidden" checked={proposalDetails.target_audience === opt} onChange={() => setProposalDetails({...proposalDetails, target_audience: opt})} />
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
                              <input type="radio" name="nature" className="hidden" checked={proposalDetails.nature_of_activity === opt} onChange={() => setProposalDetails({...proposalDetails, nature_of_activity: opt})} />
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
                            <input type="text" className="flex-1 px-4 py-2 bg-gray-50 border-b-2 border-gray-200 focus:border-primary-green font-bold text-sm outline-none transition-all" value={proposalDetails.others_objective} onChange={e => setProposalDetails({...proposalDetails, others_objective: e.target.value})} disabled={!proposalDetails.objectives.includes('Others')} />
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
                          <input type="text" className="flex-1 px-4 py-2 bg-gray-50 border-b-2 border-gray-200 focus:border-primary-green font-bold text-sm outline-none transition-all disabled:opacity-50 disabled:cursor-not-allowed" disabled={!proposalDetails.satisfaction_goal_2} value={proposalDetails.satisfaction_goal_3} onChange={e => setProposalDetails({...proposalDetails, satisfaction_goal_3: e.target.value})} />
                        </div>
                      </div>
                    </div>

                    {/* Partners & Sponsors */}
                    <div className="pt-6 border-t border-gray-100 space-y-4">
                      <div className="space-y-2">
                        <label className="text-xs font-black text-gray-600 uppercase">Name of Partners (if any):</label>
                        <input type="text" className="w-full px-4 py-3 bg-gray-50 border-b-2 border-gray-200 focus:border-primary-green font-bold text-sm outline-none transition-all" value={proposalDetails.partners} onChange={e => setProposalDetails({...proposalDetails, partners: e.target.value})} />
                      </div>
                      <div className="space-y-2">
                        <label className="text-xs font-black text-gray-600 uppercase">Name of Sponsors (if any):</label>
                        <input type="text" className="w-full px-4 py-3 bg-gray-50 border-b-2 border-gray-200 focus:border-primary-green font-bold text-sm outline-none transition-all" value={proposalDetails.sponsors} onChange={e => setProposalDetails({...proposalDetails, sponsors: e.target.value})} />
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}
            </div>
          </div>

          {/* Fixed Bottom Action Bar */}
          <div className="fixed bottom-0 left-64 right-0 bg-white border-t border-gray-100 shadow-[0_-5px_20px_rgba(0,0,0,0.05)] z-50 p-4 flex justify-center w-[calc(100%-16rem)]">
            <div className="max-w-[90rem] w-full flex items-center justify-end gap-4 px-4">
              
              {/* Action Buttons */}
              <div className="flex items-center gap-3">
                <button 
                  type="button"
                  onClick={() => setShowUploadModal(true)}
                  className="px-5 py-2.5 bg-blue-50 text-blue-600 border border-blue-200 font-black rounded-lg hover:bg-blue-100 transition-all flex items-center gap-2 text-[11px] uppercase shadow-sm tracking-widest"
                >
                  <Upload size={14} /> Upload Requirements ({attachedRequirementIds.size}/{requirements.length})
                </button>
                <div className="h-6 w-px bg-gray-200 mx-2"></div>
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
            
            <div className="flex-1 overflow-y-auto p-6 space-y-4 bg-gray-50/50">
              {requirements.map((req, i) => {
                const existing = existingAttachmentMap[req.id];
                return (
                  <div key={req.id} className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-5 bg-white rounded-xl shadow-sm border border-gray-100 hover:border-blue-200 transition-all">
                    <div className="flex items-center gap-4">
                      <div className="w-10 h-10 bg-gray-50 text-gray-500 font-black text-sm flex items-center justify-center rounded-lg shrink-0 border border-gray-100">
                        {i + 1}
                      </div>
                      <div>
                        <h4 className="text-sm font-black text-gray-800 leading-tight">{req.title}</h4>
                        <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest">{req.referenceCode || 'REQ'}</span>
                      </div>
                    </div>
                    
                    {localFiles[req.id] ? (
                      <div className="flex items-center gap-3 bg-green-50 px-4 py-2 rounded-lg border border-green-100 self-start sm:self-auto shrink-0">
                        <Check className="text-green-600" size={16} />
                        <span className="text-xs font-bold text-green-700 max-w-[150px] truncate" title={localFiles[req.id].name}>
                          {localFiles[req.id].name}
                        </span>
                        <button type="button" onClick={() => setLocalFiles(prev => {
                          const next = {...prev}; delete next[req.id]; return next;
                        })} className="p-1 text-red-400 hover:text-red-600 hover:bg-red-50 rounded-md transition-all ml-2">
                          <Trash2 size={14} />
                        </button>
                      </div>
                    ) : existing ? (
                      <div className="flex flex-col gap-2 bg-yellow-50 px-4 py-3 rounded-lg border border-yellow-100 self-start sm:self-auto shrink-0 max-w-full">
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
                        onClick={() => document.getElementById(`modal-file-${req.id}`).click()}
                        className="px-5 py-2.5 bg-white border-2 border-dashed border-gray-200 text-gray-500 font-bold rounded-xl hover:border-blue-400 hover:bg-blue-50 hover:text-blue-600 transition-all text-xs flex items-center justify-center gap-2 self-start sm:self-auto shrink-0"
                      >
                        <Upload size={14} /> Attach File
                        <input 
                          type="file" id={`modal-file-${req.id}`} className="hidden" accept=".pdf"
                          onChange={(e) => handleFileUpload(req.id, e.target.files[0])}
                        />
                      </button>
                    )}
                  </div>
                );
              })}
              {requirements.length === 0 && (
                <div className="py-12 flex flex-col items-center justify-center text-gray-400">
                  <FileText size={48} className="mb-4 opacity-20" />
                  <p className="font-bold text-sm">No requirements found for this category.</p>
                </div>
              )}
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
