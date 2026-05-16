import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import * as subService from '../services/submissionService';
import * as reqService from '../services/requirementService';
import { 
  FileText, 
  Upload, 
  Send, 
  Save, 
  ArrowLeft, 
  CheckCircle2, 
  AlertCircle, 
  Loader2, 
  Info,
  Calendar,
  User,
  MapPin,
  Clock,
  Users,
  Target,
  FileCheck
} from 'lucide-react';

const SubmitDocument = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const isPresident = user?.role === 'president';

  // State
  const [docTypes, setDocTypes] = useState([]);
  const [selectedType, setSelectedType] = useState(null);
  const [requirements, setRequirements] = useState([]);
  const [submission, setSubmission] = useState(null);
  const [version, setVersion] = useState(null);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(null); // requirementId
  const [isFinalizing, setIsFinalizing] = useState(false);
  const [toast, setToast] = useState(null);

  // Form States
  const [proposalDetails, setProposalDetails] = useState({
    organization_name: '',
    adviser_name: '',
    activity_number: '',
    activity_title: '',
    person_in_charge: '',
    student_id_no: '',
    contact_number: '',
    target_venue: '',
    target_date: '',
    target_time: '',
    duration: '',
    number_of_students: '',
    target_audience: '',
    nature_of_activity: '',
    objectives: ''
  });

  const [attachments, setAttachments] = useState({}); // {reqId: {name, url}}

  useEffect(() => {
    if (!isPresident) {
      navigate('/dashboard');
      return;
    }
    loadData();
  }, []);

  const showToast = (message, type = 'success') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3000);
  };

  const loadData = async () => {
    try {
      const types = await reqService.fetchDocumentTypes();
      setDocTypes(types || []);
    } catch (err) {
      showToast('Failed to load document types', 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleStartSubmission = async (type) => {
    setLoading(true);
    try {
      const { submission: sub, version: ver } = await subService.startNewSubmission(user.id, type.id, type.name);
      const reqs = await subService.getRequirementsForType(type.id);
      
      setSubmission(sub);
      setVersion(ver);
      setSelectedType(type);
      setRequirements(reqs || []);
      showToast('Draft created successfully');
    } catch (err) {
      showToast('Failed to start submission', 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleFileUpload = async (reqId, file) => {
    if (!file) return;
    setUploading(reqId);
    try {
      // 1. Upload to Storage
      const path = await subService.uploadSubmissionFile(file, selectedType.name, submission.id, version.version_number);
      
      // 2. Save record to DB
      const record = await subService.saveAttachmentRecord(version.id, reqId, file.name, path);
      
      // 3. Update UI
      setAttachments(prev => ({ ...prev, [reqId]: record }));
      showToast(`${file.name} uploaded`);
    } catch (err) {
      showToast('Upload failed', 'error');
    } finally {
      setUploading(null);
    }
  };

  const handleSaveDraft = async () => {
    setIsFinalizing(true);
    try {
      if (selectedType.name.toLowerCase().includes('activity proposal')) {
        await subService.saveProposalDetails(version.id, proposalDetails);
      }
      showToast('Progress saved as draft');
    } catch (err) {
      showToast('Failed to save draft', 'error');
    } finally {
      setIsFinalizing(false);
    }
  };

  const handleFinalSubmit = async () => {
    // Validation
    const uploadedCount = Object.keys(attachments).length;
    if (uploadedCount < requirements.length) {
      showToast('Please upload all required documents first', 'error');
      return;
    }

    if (selectedType.name.toLowerCase().includes('activity proposal')) {
      const emptyFields = Object.values(proposalDetails).some(v => !v);
      if (emptyFields) {
        showToast('Please fill out all Activity Proposal details', 'error');
        return;
      }
    }

    setIsFinalizing(true);
    try {
      // Save details one last time
      if (selectedType.name.toLowerCase().includes('activity proposal')) {
        await subService.saveProposalDetails(version.id, proposalDetails);
      }
      
      // Submit
      await subService.submitForReview(submission.id, version.id, user.id);
      showToast('Document submitted for review!', 'success');
      setTimeout(() => navigate('/my-submissions'), 1500);
    } catch (err) {
      showToast('Submission failed', 'error');
    } finally {
      setIsFinalizing(false);
    }
  };

  if (loading && !selectedType) {
    return (
      <div className="flex h-screen items-center justify-center bg-gray-50/20">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="h-12 w-12 animate-spin text-primary-green" />
          <p className="text-gray-400 font-bold uppercase tracking-widest text-xs">Initializing Submission...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-8 max-w-[1200px] mx-auto min-h-screen">
      {/* Toast */}
      {toast && (
        <div className={`fixed top-10 right-10 z-[200] flex items-center gap-4 px-8 py-5 rounded-2xl shadow-2xl animate-in slide-in-from-right-full ${
          toast.type === 'error' ? 'bg-red-600 text-white' : 'bg-primary-green text-white'
        }`}>
          {toast.type === 'error' ? <AlertCircle size={24} /> : <CheckCircle2 size={24} />}
          <span className="font-bold">{toast.message}</span>
        </div>
      )}

      {/* Header */}
      <div className="mb-12 flex items-center justify-between">
        <div className="flex items-center gap-6">
          <button onClick={() => navigate(-1)} className="p-3 hover:bg-gray-100 rounded-full text-gray-400 transition-colors">
            <ArrowLeft size={28} />
          </button>
          <div>
            <h1 className="text-4xl font-black text-gray-800 uppercase tracking-tighter">Submit Document</h1>
            <p className="text-gray-400 font-bold uppercase tracking-widest text-[10px]">
              {selectedType ? `Step 2: Complete ${selectedType.name}` : 'Step 1: Select Document Type'}
            </p>
          </div>
        </div>

        {selectedType && (
          <div className="flex gap-4">
            <button 
              onClick={handleSaveDraft}
              disabled={isFinalizing}
              className="flex items-center gap-2 px-6 py-3 border-2 border-gray-100 text-gray-500 font-bold rounded-2xl hover:bg-gray-50 transition-all"
            >
              <Save size={20} />
              Save Draft
            </button>
            <button 
              onClick={handleFinalSubmit}
              disabled={isFinalizing}
              className="flex items-center gap-2 px-8 py-3 bg-primary-green text-white font-bold rounded-2xl hover:scale-105 active:scale-95 transition-all shadow-xl shadow-primary-green/20"
            >
              {isFinalizing ? <Loader2 size={20} className="animate-spin" /> : <Send size={20} />}
              Submit for Review
            </button>
          </div>
        )}
      </div>

      {!selectedType ? (
        /* Step 1: Type Selection */
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8 animate-in slide-in-from-bottom-8 duration-500">
          {docTypes.map((type) => (
            <div 
              key={type.id}
              onClick={() => handleStartSubmission(type)}
              className="bg-white p-10 rounded-[3rem] border border-gray-100 shadow-xl hover:shadow-2xl hover:-translate-y-2 transition-all cursor-pointer group text-center"
            >
              <div className="w-20 h-20 bg-primary-green/5 text-primary-green rounded-[2rem] flex items-center justify-center mx-auto mb-6 group-hover:scale-110 transition-transform">
                <FileText size={40} />
              </div>
              <h3 className="text-2xl font-black text-gray-800 mb-2 group-hover:text-primary-green transition-colors">{type.name}</h3>
              <p className="text-gray-400 text-sm font-medium leading-relaxed">{type.description || 'Standard organizational document submission.'}</p>
            </div>
          ))}
        </div>
      ) : (
        /* Step 2: Form & Uploads */
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-10 animate-in slide-in-from-right-8 duration-500">
          
          {/* Main Form Area */}
          <div className="lg:col-span-2 space-y-10">
            {selectedType.name.toLowerCase().includes('activity proposal') ? (
              /* Activity Proposal Details Form */
              <div className="bg-white p-10 rounded-[3rem] shadow-xl border border-gray-50">
                <div className="flex items-center gap-4 mb-10 border-b pb-6">
                  <div className="p-3 bg-blue-50 text-blue-500 rounded-2xl">
                    <Calendar size={28} />
                  </div>
                  <h2 className="text-2xl font-black text-gray-800 uppercase tracking-tight">Activity Proposal Details</h2>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-gray-400 uppercase ml-2 tracking-widest">Organization Name</label>
                    <input 
                      type="text" placeholder="e.g. Computer Science Society"
                      className="w-full px-6 py-4 bg-gray-50 border-2 border-transparent rounded-2xl focus:bg-white focus:border-blue-200 outline-none transition-all font-bold"
                      value={proposalDetails.organization_name} onChange={e => setProposalDetails({...proposalDetails, organization_name: e.target.value})}
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-gray-400 uppercase ml-2 tracking-widest">Adviser Name</label>
                    <input 
                      type="text" placeholder="Full Name"
                      className="w-full px-6 py-4 bg-gray-50 border-2 border-transparent rounded-2xl focus:bg-white focus:border-blue-200 outline-none transition-all font-bold"
                      value={proposalDetails.adviser_name} onChange={e => setProposalDetails({...proposalDetails, adviser_name: e.target.value})}
                    />
                  </div>
                  <div className="space-y-2 md:col-span-2">
                    <label className="text-[10px] font-black text-gray-400 uppercase ml-2 tracking-widest">Activity Title</label>
                    <input 
                      type="text" placeholder="e.g. IT Week 2026: Tech Innovation"
                      className="w-full px-6 py-4 bg-gray-50 border-2 border-transparent rounded-2xl focus:bg-white focus:border-blue-200 outline-none transition-all font-bold"
                      value={proposalDetails.activity_title} onChange={e => setProposalDetails({...proposalDetails, activity_title: e.target.value})}
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-gray-400 uppercase ml-2 tracking-widest">Target Venue</label>
                    <div className="relative">
                      <MapPin className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-300" size={18} />
                      <input 
                        type="text" placeholder="Location"
                        className="w-full pl-12 pr-6 py-4 bg-gray-50 border-2 border-transparent rounded-2xl focus:bg-white focus:border-blue-200 outline-none transition-all font-bold"
                        value={proposalDetails.target_venue} onChange={e => setProposalDetails({...proposalDetails, target_venue: e.target.value})}
                      />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-gray-400 uppercase ml-2 tracking-widest">Target Date</label>
                    <input 
                      type="date"
                      className="w-full px-6 py-4 bg-gray-50 border-2 border-transparent rounded-2xl focus:bg-white focus:border-blue-200 outline-none transition-all font-bold"
                      value={proposalDetails.target_date} onChange={e => setProposalDetails({...proposalDetails, target_date: e.target.value})}
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-gray-400 uppercase ml-2 tracking-widest">Target Time</label>
                    <div className="relative">
                      <Clock className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-300" size={18} />
                      <input 
                        type="text" placeholder="e.g. 8:00 AM - 5:00 PM"
                        className="w-full pl-12 pr-6 py-4 bg-gray-50 border-2 border-transparent rounded-2xl focus:bg-white focus:border-blue-200 outline-none transition-all font-bold"
                        value={proposalDetails.target_time} onChange={e => setProposalDetails({...proposalDetails, target_time: e.target.value})}
                      />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-gray-400 uppercase ml-2 tracking-widest">Est. No. of Participants</label>
                    <div className="relative">
                      <Users className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-300" size={18} />
                      <input 
                        type="number"
                        className="w-full pl-12 pr-6 py-4 bg-gray-50 border-2 border-transparent rounded-2xl focus:bg-white focus:border-blue-200 outline-none transition-all font-bold"
                        value={proposalDetails.number_of_students} onChange={e => setProposalDetails({...proposalDetails, number_of_students: e.target.value})}
                      />
                    </div>
                  </div>
                </div>

                <div className="mt-10 space-y-8">
                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-gray-400 uppercase ml-2 tracking-widest">Objectives</label>
                    <textarea 
                      rows="4" placeholder="What are the goals of this activity?"
                      className="w-full px-8 py-5 bg-gray-50 border-2 border-transparent rounded-[2rem] focus:bg-white focus:border-blue-200 outline-none transition-all font-bold resize-none"
                      value={proposalDetails.objectives} onChange={e => setProposalDetails({...proposalDetails, objectives: e.target.value})}
                    ></textarea>
                  </div>
                </div>
              </div>
            ) : (
              /* Generic Placeholder for non-proposal types */
              <div className="bg-white p-16 rounded-[4rem] shadow-xl border border-gray-50 text-center flex flex-col items-center gap-6">
                <div className="w-24 h-24 bg-gray-50 rounded-full flex items-center justify-center text-gray-300">
                  <FileText size={48} />
                </div>
                <div className="space-y-2">
                  <h3 className="text-3xl font-black text-gray-800 uppercase tracking-tighter">{selectedType.name} Submission</h3>
                  <p className="text-gray-400 font-bold">Please upload all required documents in the checklist to complete this submission.</p>
                </div>
              </div>
            )}
          </div>

          {/* Checklist Area */}
          <div className="space-y-8">
            <div className="bg-gray-800 p-8 rounded-[3rem] text-white shadow-2xl">
              <div className="flex items-center gap-4 mb-8">
                <div className="p-3 bg-white/10 rounded-2xl">
                  <Upload size={24} className="text-primary-green" />
                </div>
                <h2 className="text-xl font-black uppercase tracking-tight">Checklist</h2>
              </div>

              <div className="space-y-6">
                {requirements.map((req) => (
                  <div key={req.id} className="p-5 bg-white/5 rounded-3xl border border-white/5 space-y-4">
                    <div className="flex items-start justify-between gap-4">
                      <div>
                        <h4 className="font-black text-sm mb-1">{req.title}</h4>
                        <p className="text-[10px] text-gray-400 font-bold uppercase tracking-widest">{req.referenceCode || 'GENERIC'}</p>
                      </div>
                      {attachments[req.id] ? (
                        <div className="p-1 bg-primary-green rounded-full text-white">
                          <CheckCircle2 size={16} />
                        </div>
                      ) : (
                        <div className="p-1 bg-white/10 rounded-full text-gray-500">
                          <Clock size={16} />
                        </div>
                      )}
                    </div>

                    {attachments[req.id] ? (
                      <div className="flex items-center justify-between bg-black/20 p-3 rounded-xl border border-white/10">
                        <span className="text-[10px] font-bold text-gray-300 truncate max-w-[120px]">{attachments[req.id].file_name}</span>
                        <button className="text-[10px] font-black text-primary-green uppercase hover:underline">Change</button>
                      </div>
                    ) : (
                      <button 
                        disabled={uploading === req.id}
                        onClick={() => document.getElementById(`file-${req.id}`).click()}
                        className={`w-full py-3 rounded-2xl font-black text-xs uppercase tracking-widest flex items-center justify-center gap-2 transition-all ${
                          uploading === req.id ? 'bg-gray-700 text-gray-500' : 'bg-primary-green text-white hover:scale-105 active:scale-95 shadow-lg shadow-primary-green/20'
                        }`}
                      >
                        {uploading === req.id ? <Loader2 size={16} className="animate-spin" /> : <Upload size={16} />}
                        {uploading === req.id ? 'Uploading...' : 'Upload PDF'}
                        <input 
                          type="file" id={`file-${req.id}`} className="hidden" accept=".pdf"
                          onChange={(e) => handleFileUpload(req.id, e.target.files[0])}
                        />
                      </button>
                    )}
                  </div>
                ))}
              </div>

              <div className="mt-10 pt-8 border-t border-white/10 text-center">
                <div className="flex items-center justify-center gap-4 mb-4">
                  <div className="text-2xl font-black">{Object.keys(attachments).length}</div>
                  <div className="text-gray-500 font-black">/</div>
                  <div className="text-2xl font-black text-gray-400">{requirements.length}</div>
                </div>
                <p className="text-[10px] font-black text-gray-500 uppercase tracking-widest">Requirement Completion</p>
              </div>
            </div>

            <div className="bg-blue-50 p-8 rounded-[3rem] border border-blue-100 flex items-start gap-4">
              <Info className="text-blue-500 shrink-0" size={24} />
              <p className="text-sm text-blue-700 font-bold leading-relaxed">
                Your draft is automatically saved as you upload. You can return to your dashboard and continue later.
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default SubmitDocument;
