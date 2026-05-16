import React, { useState, useEffect, useRef } from 'react';
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
  Search,
  ChevronRight,
  RefreshCcw,
  X,
  FileCheck,
  Download,
  Eye,
  Trash2,
  File as FileIcon,
  Eraser,
  Check
} from 'lucide-react';

const SubmitNewDocument = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  
  // Navigation & State
  const [view, setView] = useState('dashboard'); // 'dashboard' or 'form'
  const [loading, setLoading] = useState(true);
  const [docTypes, setDocTypes] = useState([]);
  const [selectedType, setSelectedType] = useState(null);
  const [subType, setSubType] = useState('');
  const [requirements, setRequirements] = useState([]);
  const [submission, setSubmission] = useState(null);
  const [version, setVersion] = useState(null);
  
  // UI States
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [uploading, setUploading] = useState(null);
  const [isSaving, setIsSaving] = useState(false);
  const [toast, setToast] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');

  // Form Data
  const [proposalDetails, setProposalDetails] = useState({
    activity_number: '',
    organization_name: '',
    adviser_name: '',
    activity_title: '',
    person_in_charge: '',
    student_id_no: '',
    contact_number: '',
    target_venue: '',
    target_date: '',
    target_time: '',
    duration: '',
    number_of_students: '',
    // New fields from Image
    target_audience: [], // members, bulsuans, public
    nature_of_activity: '', // co-curricular, extra-curricular
    objectives: [], // leadership, membership, etc.
    others_objective: '',
    satisfaction_goal_1: '',
    satisfaction_goal_2: '',
    satisfaction_goal_3: '',
    partners: '',
    sponsors: ''
  });

  const [attachments, setAttachments] = useState({});

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
    } catch (err) {
      showToast('Failed to load categories', 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleSelectType = async (type, subName = '') => {
    setLoading(true);
    try {
      // 1. Create a draft submission and v1 version
      const { submission: sub, version: ver } = await subService.startNewSubmission(user.id, type.id, type.name);
      
      // 2. Load requirements for this specific type AND subcategory (In-Campus/Off-Campus)
      const isProposal = type.name.toLowerCase().includes('activity proposal');
      const reqs = await subService.getRequirementsForType(type.id, isProposal ? subName : null);
      
      setSubmission(sub);
      setVersion(ver);
      setRequirements(reqs || []);
      setSelectedType(type);
      setSubType(subName);
      
      // Auto-generate Activity Number
      const dateStr = new Date().getFullYear() + '-' + (new Date().getMonth() + 1).toString().padStart(2, '0');
      setProposalDetails(prev => ({ ...prev, activity_number: `AP-${dateStr}-001` }));
      
      setView('form');
    } catch (err) {
      console.error('Failed to initialize submission:', err);
      showToast('Could not initialize submission', 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleFileUpload = async (reqId, file) => {
    if (!file) return;
    setUploading(reqId);
    try {
      // Include subType (In-Campus/Off-Campus) in the upload path
      const path = await subService.uploadSubmissionFile(file, selectedType.name, submission.id, version.version_number, subType);
      const record = await subService.saveAttachmentRecord(version.id, reqId, file.name, path);
      setAttachments(prev => ({ ...prev, [reqId]: record }));
    } catch (err) {
      console.error('Upload error details:', err);
      showToast(err.message || 'Upload failed', 'error');
    } finally {
      setUploading(null);
    }
  };

  const handleRegisterDocument = async () => {
    if (isSaving) return;
    
    setIsSaving(true);
    try {
      if (selectedType.name.toLowerCase().includes('activity proposal')) {
        // Pass subType (In-Campus/Off-Campus) as the mandatory proposal_type
        await subService.saveProposalDetails(version.id, proposalDetails, subType);
      }
      await subService.submitForReview(submission.id, version.id, user.id);
      
      showToast('Document Registered Successfully!');
      setTimeout(() => navigate('/my-submissions'), 2000);
    } catch (err) {
      console.error('Registration error:', err);
      showToast('Registration failed: ' + (err.message || ''), 'error');
    } finally {
      setIsSaving(false);
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

  return (
    <div className="min-h-screen bg-[#F8F9FA] text-gray-700 font-sans pb-20">
      {/* Toast */}
      {toast && (
        <div className={`fixed top-10 right-10 z-[200] flex items-center gap-4 px-8 py-5 rounded-2xl shadow-2xl animate-in slide-in-from-right-full ${
          toast.type === 'error' ? 'bg-red-600 text-white' : 'bg-primary-green text-white'
        }`}>
          {toast.type === 'error' ? <AlertCircle size={24} /> : <CheckCircle2 size={24} />}
          <span className="font-bold">{toast.message}</span>
        </div>
      )}

      {/* DASHBOARD VIEW */}
      {view === 'dashboard' && (
        <div className="p-10 max-w-[1400px] mx-auto animate-in fade-in duration-500">
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-16 gap-6">
            <div className="flex items-center gap-5">
              <div className="p-4 bg-primary-green rounded-2xl shadow-xl shadow-primary-green/20">
                <FileCheck className="text-white" size={36} />
              </div>
              <div>
                <h1 className="text-4xl font-bold text-gray-800 tracking-tight">Submit New Document</h1>
                <p className="text-gray-400 font-medium text-lg">List of Required Documents and Information</p>
              </div>
            </div>
            <div className="relative w-full max-w-md">
              <input 
                type="text" placeholder="Search"
                className="w-full pl-6 pr-14 py-4 bg-white border border-gray-200 rounded-xl focus:border-primary-green outline-none transition-all shadow-sm font-medium"
                value={searchQuery} onChange={e => setSearchQuery(e.target.value)}
              />
              <Search className="absolute right-6 top-1/2 -translate-y-1/2 text-gray-400" size={20} />
            </div>
          </div>

          <h2 className="text-2xl font-bold text-gray-800 mb-10 tracking-tight">Document Categories</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-10 mb-20">
            {/* Activity Proposal */}
            <div className="bg-white rounded-3xl border border-gray-100 shadow-sm overflow-hidden flex flex-col group">
              <div className="p-10 flex items-start gap-6">
                <div className="w-16 h-16 bg-blue-50 text-blue-500 rounded-2xl flex items-center justify-center shadow-inner shrink-0">
                  <FileText size={32} />
                </div>
                <div>
                  <h3 className="text-2xl font-black text-gray-800 mb-2 uppercase tracking-tighter">Activity Proposal</h3>
                  <p className="text-gray-400 text-sm font-bold leading-relaxed">Requirements for student organization activity proposals</p>
                </div>
              </div>
              <div className="mt-auto border-t border-gray-50 bg-gray-50/30">
                {['In Campus', 'Off Campus'].map((sub, i) => (
                  <button 
                    key={sub}
                    onClick={() => handleSelectType(docTypes.find(t => t.name.toLowerCase().includes('activity proposal')), sub)}
                    className={`w-full px-10 py-6 flex items-center justify-between hover:bg-white transition-all group/btn ${i === 0 ? 'border-b border-gray-100' : ''}`}
                  >
                    <div className="flex items-center gap-10">
                      <span className="text-lg font-bold text-gray-500 group-hover/btn:text-primary-green transition-colors">{sub}</span>
                      <span className="text-xs font-black text-gray-300 uppercase tracking-widest">• 10 Requirements</span>
                    </div>
                    <ChevronRight size={24} className="text-gray-300 group-hover/btn:text-primary-green transition-all" />
                  </button>
                ))}
              </div>
            </div>

            {/* Year End Report */}
            <div className="bg-white rounded-3xl border border-gray-100 shadow-sm overflow-hidden flex flex-col">
              <div className="p-10 flex items-start gap-6">
                <div className="w-16 h-16 bg-orange-50 text-orange-500 rounded-2xl flex items-center justify-center shadow-inner shrink-0">
                  <Calendar size={32} />
                </div>
                <div>
                  <h3 className="text-2xl font-black text-gray-800 mb-2 uppercase tracking-tighter">Year End Report</h3>
                  <p className="text-gray-400 text-sm font-bold leading-relaxed">Annual organizational reports and summaries</p>
                </div>
              </div>
              <div className="mt-auto border-t border-gray-50 bg-gray-50/30">
                {['Mid-Year Report', 'Year-End Report'].map((sub, i) => (
                  <button 
                    key={sub}
                    onClick={() => handleSelectType(docTypes.find(t => t.name.toLowerCase().includes(sub.toLowerCase())), sub)}
                    className={`w-full px-10 py-6 flex items-center justify-between hover:bg-white transition-all group/btn ${i === 0 ? 'border-b border-gray-100' : ''}`}
                  >
                    <div className="flex items-center gap-10">
                      <span className="text-lg font-bold text-gray-500 group-hover/btn:text-primary-green transition-colors">{sub}</span>
                      <span className="text-xs font-black text-gray-300 uppercase tracking-widest">• 10 Requirements</span>
                    </div>
                    <ChevronRight size={24} className="text-gray-300 group-hover/btn:text-primary-green transition-all" />
                  </button>
                ))}
              </div>
            </div>

            {/* Renewal */}
            <div className="bg-white rounded-3xl border border-gray-100 shadow-sm overflow-hidden flex flex-col group">
              <div className="p-10 flex items-start gap-6">
                <div className="w-16 h-16 bg-amber-50 text-amber-500 rounded-2xl flex items-center justify-center shadow-inner shrink-0">
                  <RefreshCcw size={32} />
                </div>
                <div>
                  <h3 className="text-2xl font-black text-gray-800 mb-2 uppercase tracking-tighter">Renewal Document</h3>
                  <p className="text-gray-400 text-sm font-bold leading-relaxed">Annual organizational reports and summaries</p>
                </div>
              </div>
              <div className="mt-auto border-t border-gray-50 bg-gray-50/30 h-full flex items-center justify-between px-10 py-10 group cursor-pointer hover:bg-white transition-all"
                onClick={() => handleSelectType(docTypes.find(t => t.name.toLowerCase().includes('renewal')), 'Renewal Document')}
              >
                <span className="text-xs font-black text-gray-400 uppercase tracking-widest">10 Requirements</span>
                <ChevronRight size={32} className="text-gray-300 group-hover:text-primary-green transition-all" />
              </div>
            </div>
          </div>

          <div className="bg-[#FEF9E7] p-12 rounded-[3rem] border border-[#F9E79F] relative animate-in slide-in-from-bottom-10 delay-300">
            <div className="flex items-start gap-8">
              <div className="w-14 h-14 bg-white rounded-2xl flex items-center justify-center text-amber-500 shadow-sm shrink-0 border border-[#F9E79F]">
                <AlertCircle size={32} />
              </div>
              <div>
                <h4 className="text-2xl font-black text-amber-900 mb-4 uppercase tracking-tighter">Common Mistakes to Avoid</h4>
                <p className="text-amber-700/70 font-bold text-lg mb-12">Please review these frequent issues to ensure your document is processed without delays:</p>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-x-24 gap-y-8">
                  <div className="flex items-center gap-4 text-amber-700 font-bold">
                    <div className="w-2 h-2 bg-amber-500 rounded-full" />
                    Missing required documents or attachments
                  </div>
                  <div className="flex items-center gap-4 text-amber-700 font-bold">
                    <div className="w-2 h-2 bg-amber-500 rounded-full" />
                    Incomplete information in form fields
                  </div>
                  <div className="flex items-center gap-4 text-amber-700 font-bold">
                    <div className="w-2 h-2 bg-amber-500 rounded-full" />
                    Incorrect file format (must be PDF or Word document)
                  </div>
                  <div className="flex items-center gap-4 text-amber-700 font-bold">
                    <div className="w-2 h-2 bg-amber-500 rounded-full" />
                    Invalid, corrupted, or unclear attachments
                  </div>
                  <div className="flex items-center gap-4 text-amber-700 font-bold">
                    <div className="w-2 h-2 bg-amber-500 rounded-full" />
                    Submitting without reviewing the required checklist
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* FORM VIEW */}
      {view === 'form' && (
        <div className="min-h-screen flex flex-col animate-in fade-in duration-500">
          <div className="p-8 border-b border-gray-100 bg-white flex items-center justify-between sticky top-0 z-50 shadow-sm">
            <div className="flex items-center gap-8">
              <button onClick={() => setView('dashboard')} className="p-4 hover:bg-gray-50 rounded-2xl transition-all">
                <ArrowLeft size={36} className="text-gray-400" />
              </button>
              <div className="flex items-center gap-6">
                <div className="p-4 bg-primary-green rounded-2xl shadow-lg">
                  <FileText className="text-white" size={36} />
                </div>
                <div>
                  <h1 className="text-3xl font-black text-gray-800 uppercase tracking-tighter">{selectedType.name} Form</h1>
                  <p className="text-gray-400 font-black text-xs uppercase tracking-[0.3em]">{subType}</p>
                </div>
              </div>
            </div>
          </div>

          <div className="flex-1 p-12 bg-gray-50/50">
            <div className="max-w-6xl mx-auto bg-white p-16 rounded-[4rem] shadow-xl border border-gray-50 space-y-16">
              
              {/* Form Grid */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-12">
                <div className="space-y-4">
                  <label className="text-xs font-black text-gray-400 uppercase tracking-widest ml-1">Activity Number</label>
                  <input type="text" className="w-full px-8 py-5 bg-gray-50 border border-transparent rounded-2xl font-black outline-none focus:bg-white focus:border-primary-green transition-all" value={proposalDetails.activity_number} readOnly />
                </div>
                <div className="space-y-4">
                  <label className="text-xs font-black text-gray-400 uppercase tracking-widest ml-1">Oganization</label>
                  <input type="text" className="w-full px-8 py-5 bg-gray-50 border border-transparent rounded-2xl font-black outline-none focus:bg-white focus:border-primary-green transition-all" placeholder="ASICS" value={proposalDetails.organization_name} onChange={e => setProposalDetails({...proposalDetails, organization_name: e.target.value})} />
                </div>
                <div className="space-y-4">
                  <label className="text-xs font-black text-gray-400 uppercase tracking-widest ml-1">Adviser</label>
                  <input type="text" className="w-full px-8 py-5 bg-gray-50 border border-transparent rounded-2xl font-black outline-none focus:bg-white focus:border-primary-green transition-all" placeholder="Robin Esteban" value={proposalDetails.adviser_name} onChange={e => setProposalDetails({...proposalDetails, adviser_name: e.target.value})} />
                </div>

                <div className="md:col-span-3 space-y-4">
                  <label className="text-xs font-black text-gray-400 uppercase tracking-widest ml-1">Document Title</label>
                  <input type="text" className="w-full px-8 py-5 bg-gray-50 border border-transparent rounded-2xl font-black outline-none focus:bg-white focus:border-primary-green transition-all italic placeholder:text-gray-300" placeholder="e.g., Annual Budget Proposal 2024" value={proposalDetails.activity_title} onChange={e => setProposalDetails({...proposalDetails, activity_title: e.target.value})} />
                </div>

                <div className="md:col-span-2 space-y-4">
                  <label className="text-xs font-black text-gray-400 uppercase tracking-widest ml-1">Person In-Charge</label>
                  <input type="text" className="w-full px-8 py-5 bg-gray-50 border border-transparent rounded-2xl font-black outline-none focus:bg-white focus:border-primary-green transition-all" placeholder="Lance Amiel Samaniego" value={proposalDetails.person_in_charge} onChange={e => setProposalDetails({...proposalDetails, person_in_charge: e.target.value})} />
                </div>
                <div className="space-y-4">
                  <label className="text-xs font-black text-gray-400 uppercase tracking-widest ml-1">Student ID No.:</label>
                  <input type="text" className="w-full px-8 py-5 bg-gray-50 border border-transparent rounded-2xl font-black outline-none focus:bg-white focus:border-primary-green transition-all" placeholder="2023200438" value={proposalDetails.student_id_no} onChange={e => setProposalDetails({...proposalDetails, student_id_no: e.target.value})} />
                </div>

                <div className="md:col-span-2 space-y-4">
                  <label className="text-xs font-black text-gray-400 uppercase tracking-widest ml-1">Contact Number of Person-in-Charge:</label>
                  <input type="text" className="w-full px-8 py-5 bg-gray-50 border border-transparent rounded-2xl font-black outline-none focus:bg-white focus:border-primary-green transition-all" placeholder="0987654321" value={proposalDetails.contact_number} onChange={e => setProposalDetails({...proposalDetails, contact_number: e.target.value})} />
                </div>
                <div className="space-y-4">
                  <label className="text-xs font-black text-gray-400 uppercase tracking-widest ml-1">Target Date:</label>
                  <div className="relative">
                    <Calendar className="absolute left-6 top-1/2 -translate-y-1/2 text-gray-300 pointer-events-none" size={20} />
                    <input 
                      type="date" 
                      className="w-full pl-16 pr-8 py-5 bg-gray-50 border border-transparent rounded-2xl font-black outline-none focus:bg-white focus:border-primary-green transition-all appearance-none" 
                      value={proposalDetails.target_date} 
                      onChange={e => setProposalDetails({...proposalDetails, target_date: e.target.value})} 
                    />
                  </div>
                </div>
                <div className="space-y-4">
                  <label className="text-xs font-black text-gray-400 uppercase tracking-widest ml-1">Target Time:</label>
                  <div className="relative">
                    <Clock className="absolute left-6 top-1/2 -translate-y-1/2 text-gray-300 pointer-events-none" size={20} />
                    <input 
                      type="time" 
                      className="w-full pl-16 pr-8 py-5 bg-gray-50 border border-transparent rounded-2xl font-black outline-none focus:bg-white focus:border-primary-green transition-all appearance-none" 
                      value={proposalDetails.target_time} 
                      onChange={e => setProposalDetails({...proposalDetails, target_time: e.target.value})} 
                    />
                  </div>
                </div>

                <div className="md:col-span-2 space-y-4">
                  <label className="text-xs font-black text-gray-400 uppercase tracking-widest ml-1">Duration</label>
                  <input type="text" className="w-full px-8 py-5 bg-gray-50 border border-transparent rounded-2xl font-black outline-none focus:bg-white focus:border-primary-green transition-all" placeholder="4 Hours" value={proposalDetails.duration} onChange={e => setProposalDetails({...proposalDetails, duration: e.target.value})} />
                </div>
                <div className="space-y-4">
                  <label className="text-xs font-black text-gray-400 uppercase tracking-widest ml-1">Number of Student Involved:</label>
                  <input type="text" className="w-full px-8 py-5 bg-gray-50 border border-transparent rounded-2xl font-black outline-none focus:bg-white focus:border-primary-green transition-all" placeholder="67" value={proposalDetails.number_of_students} onChange={e => setProposalDetails({...proposalDetails, number_of_students: e.target.value})} />
                </div>
              </div>

              {/* Checkboxes Section */}
              <div className="space-y-16 pt-10 border-t border-gray-100">
                
                {/* Target Audience */}
                <div className="space-y-8">
                  <h3 className="text-2xl font-black text-gray-800 uppercase tracking-tighter">Target Audience/Participants:</h3>
                  <div className="flex flex-wrap gap-12">
                    {['Members only', 'BulSUans only', 'Open to the public'].map(opt => (
                      <button 
                        key={opt}
                        onClick={() => toggleArrayField('target_audience', opt)}
                        className="flex items-center gap-4 group cursor-pointer"
                      >
                        <div className={`w-8 h-8 rounded-lg border-2 flex items-center justify-center transition-all ${proposalDetails.target_audience.includes(opt) ? 'bg-primary-green border-primary-green' : 'border-gray-200 group-hover:border-primary-green/30'}`}>
                          {proposalDetails.target_audience.includes(opt) && <Check size={18} className="text-white" />}
                        </div>
                        <span className={`font-bold text-lg ${proposalDetails.target_audience.includes(opt) ? 'text-gray-800' : 'text-gray-400'}`}>{opt}</span>
                      </button>
                    ))}
                  </div>
                </div>

                {/* Nature of Activity */}
                <div className="space-y-8">
                  <h3 className="text-2xl font-black text-gray-800 uppercase tracking-tighter">Nature of Activity:</h3>
                  <div className="flex flex-wrap gap-12">
                    {['Co-Curricular', 'Extra-Curricular'].map(opt => (
                      <button 
                        key={opt}
                        onClick={() => setProposalDetails({...proposalDetails, nature_of_activity: opt})}
                        className="flex items-center gap-4 group cursor-pointer"
                      >
                        <div className={`w-8 h-8 rounded-full border-2 flex items-center justify-center transition-all ${proposalDetails.nature_of_activity === opt ? 'bg-primary-green border-primary-green' : 'border-gray-200 group-hover:border-primary-green/30'}`}>
                          {proposalDetails.nature_of_activity === opt && <div className="w-3 h-3 bg-white rounded-full" />}
                        </div>
                        <span className={`font-bold text-lg ${proposalDetails.nature_of_activity === opt ? 'text-gray-800' : 'text-gray-400'}`}>{opt}</span>
                      </button>
                    ))}
                  </div>
                </div>

                {/* Objectives */}
                <div className="space-y-8">
                  <h3 className="text-2xl font-black text-gray-800 uppercase tracking-tighter">Objectives of the Activity:</h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                    {[
                      'Leadership Development and Formation',
                      'Membership Development and Formation',
                      'Organizational Program Management',
                      'Values Enrichment',
                      'Skills Enhancement',
                      'Others:'
                    ].map(opt => (
                      <div key={opt} className="flex items-start gap-4">
                        <button 
                          onClick={() => toggleArrayField('objectives', opt)}
                          className={`w-8 h-8 mt-1 rounded-lg border-2 flex items-center justify-center transition-all shrink-0 ${proposalDetails.objectives.includes(opt) ? 'bg-primary-green border-primary-green' : 'border-gray-200'}`}
                        >
                          {proposalDetails.objectives.includes(opt) && <Check size={18} className="text-white" />}
                        </button>
                        <div className="flex-1">
                          <span className={`font-bold text-lg ${proposalDetails.objectives.includes(opt) ? 'text-gray-800' : 'text-gray-400'}`}>{opt}</span>
                          {opt === 'Others:' && (
                            <input 
                              type="text" 
                              className="w-full mt-4 border-b-2 border-gray-100 outline-none focus:border-primary-green font-bold py-2 italic text-gray-500"
                              placeholder="Please specify..."
                              value={proposalDetails.others_objective}
                              onChange={e => setProposalDetails({...proposalDetails, others_objective: e.target.value})}
                            />
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Satisfaction Goals */}
                <div className="space-y-12">
                  <p className="text-gray-400 font-bold text-lg italic leading-relaxed">
                    Describe how this activity will satisfy the needs of the organization and how it will help the organization achieve its goals:
                  </p>
                  <div className="space-y-8 pl-6">
                    {[1, 2, 3].map(num => (
                      <div key={num} className="flex items-center gap-6">
                        <span className="text-2xl font-black text-gray-300">{num}.</span>
                        <input 
                          type="text"
                          className="flex-1 border-b-2 border-gray-100 py-3 outline-none focus:border-primary-green font-bold text-lg"
                          value={proposalDetails[`satisfaction_goal_${num}`]}
                          onChange={e => setProposalDetails({...proposalDetails, [`satisfaction_goal_${num}`]: e.target.value})}
                        />
                      </div>
                    ))}
                  </div>
                </div>

                {/* Partners & Sponsors */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-12 pt-10">
                  <div className="space-y-4">
                    <label className="text-xs font-black text-gray-400 uppercase tracking-widest ml-1">Name of Partners (if any):</label>
                    <input type="text" className="w-full border-b-2 border-gray-100 py-3 outline-none focus:border-primary-green font-bold text-lg" value={proposalDetails.partners} onChange={e => setProposalDetails({...proposalDetails, partners: e.target.value})} />
                  </div>
                  <div className="space-y-4">
                    <label className="text-xs font-black text-gray-400 uppercase tracking-widest ml-1">Name of Sponsors (if any):</label>
                    <input type="text" className="w-full border-b-2 border-gray-100 py-3 outline-none focus:border-primary-green font-bold text-lg" value={proposalDetails.sponsors} onChange={e => setProposalDetails({...proposalDetails, sponsors: e.target.value})} />
                  </div>
                </div>

              </div>
            </div>
          </div>

          {/* Form Footer Action Bar */}
          <div className="p-8 border-t border-gray-100 bg-white flex items-center justify-between sticky bottom-0 z-50 shadow-[0_-10px_30px_rgba(0,0,0,0.03)] px-12">
            <button 
              onClick={() => {
                setProposalDetails({
                  activity_number: proposalDetails.activity_number,
                  organization_name: '', adviser_name: '', activity_title: '',
                  person_in_charge: '', student_id_no: '', contact_number: '',
                  target_venue: '', target_date: '', target_time: '',
                  duration: '', number_of_students: '',
                  target_audience: [], nature_of_activity: '', objectives: [],
                  others_objective: '', satisfaction_goal_1: '', satisfaction_goal_2: '',
                  satisfaction_goal_3: '', partners: '', sponsors: ''
                });
                showToast('Form Cleared', 'info');
              }}
              className="px-10 py-4 bg-white border-2 border-gray-100 text-gray-500 font-black rounded-2xl hover:bg-gray-50 transition-all flex items-center gap-3 uppercase tracking-widest text-sm"
            >
              <Eraser size={20} />
              Clear Form
            </button>
            
            <div className="flex items-center gap-5">
              <button 
                onClick={() => setIsModalOpen(true)}
                className={`px-12 py-5 rounded-2xl font-black flex items-center gap-4 transition-all shadow-xl uppercase tracking-widest text-sm ${
                  Object.keys(attachments).length === requirements.length
                    ? 'bg-green-100 text-green-700 border-2 border-green-200' 
                    : 'bg-[#F9B916] text-white shadow-amber-500/20'
                }`}
              >
                <Upload size={22} />
                {Object.keys(attachments).length === requirements.length 
                  ? 'All Files Attached' 
                  : `Upload Requirements (${Object.keys(attachments).length}/${requirements.length})`
                }
              </button>

              <button 
                onClick={() => showToast('Progress Saved as Draft!', 'success')}
                className="px-10 py-5 bg-white border-2 border-[#F9B916] text-[#F9B916] font-black rounded-2xl hover:bg-[#F9B916]/5 transition-all flex items-center gap-3 uppercase tracking-widest text-sm"
              >
                <Save size={20} />
                Save As Draft
              </button>
              
              <button 
                onClick={handleRegisterDocument}
                disabled={isSaving}
                className="px-14 py-5 bg-primary-green text-white font-black rounded-2xl hover:scale-105 active:scale-95 transition-all shadow-2xl shadow-primary-green/30 flex items-center gap-4 uppercase tracking-widest text-sm disabled:opacity-50"
              >
                {isSaving ? <Loader2 className="animate-spin" size={22} /> : <CheckCircle2 size={22} />}
                Register Document
              </button>
            </div>
          </div>
        </div>
      )}

      {/* UPLOAD MODAL */}
      {isModalOpen && (
        <div className="fixed inset-0 z-[150] flex items-center justify-center p-10 bg-black/50 backdrop-blur-md animate-in fade-in duration-300">
          <div className="bg-white w-full max-w-4xl rounded-[3.5rem] shadow-2xl overflow-hidden animate-in zoom-in-95 duration-300">
            <div className="p-12 border-b border-gray-50 flex items-center justify-between bg-gray-50/30">
              <div className="flex items-center gap-8">
                <div className="w-16 h-16 bg-blue-50 text-blue-500 rounded-2xl flex items-center justify-center shadow-inner">
                  <FileText size={32} />
                </div>
                <div>
                  <h3 className="text-3xl font-black text-gray-800 tracking-tighter uppercase">Upload {selectedType.name} Requirements</h3>
                  <p className="text-gray-400 font-bold text-sm tracking-widest uppercase">Version 1.0 • Secure Attachment Module</p>
                </div>
              </div>
              <button onClick={() => setIsModalOpen(false)} className="p-6 hover:bg-gray-100 rounded-full transition-colors group">
                <X size={40} className="text-gray-300 group-hover:text-gray-800" />
              </button>
            </div>

            <div className="p-12 max-h-[55vh] overflow-y-auto space-y-8 bg-white">
              {requirements.map((req, i) => (
                <div key={req.id} className="flex items-center gap-10 p-10 bg-gray-50/50 rounded-[2.5rem] border-2 border-transparent hover:border-amber-100 transition-all group">
                  <div className="w-16 h-16 bg-green-100 text-green-700 font-black text-3xl flex items-center justify-center rounded-2xl shrink-0">
                    {i + 1}
                  </div>
                  <div className="flex-1">
                    <h4 className="text-2xl font-black text-gray-800 mb-2">{req.title}</h4>
                    <p className="text-base font-bold text-gray-400 mb-2 leading-relaxed line-clamp-1">{req.description || 'Official document from authorized signatory'}</p>
                    <span className="text-xs font-black text-gray-300 uppercase tracking-widest">{req.referenceCode}</span>
                  </div>
                  
                  {attachments[req.id] ? (
                    <div className="flex flex-col items-end gap-3 animate-in slide-in-from-right-4">
                      <div className="px-6 py-2 bg-green-500 text-white text-xs font-black rounded-full shadow-lg shadow-green-500/20">UPLOADED</div>
                      <button onClick={() => setAttachments(prev => {
                        const next = {...prev};
                        delete next[req.id];
                        return next;
                      })} className="text-xs font-black text-red-400 hover:text-red-600 transition-colors uppercase tracking-widest flex items-center gap-2">
                        <Trash2 size={16} /> Remove
                      </button>
                    </div>
                  ) : (
                    <button 
                      disabled={uploading === req.id}
                      onClick={() => document.getElementById(`modal-up-${req.id}`).click()}
                      className={`px-10 py-5 rounded-2xl font-black flex items-center gap-3 shadow-xl transition-all uppercase tracking-widest text-xs ${
                        uploading === req.id ? 'bg-gray-200 text-gray-400' : 'bg-[#F9B916] text-white shadow-amber-500/20 hover:scale-105'
                      }`}
                    >
                      {uploading === req.id ? <Loader2 size={18} className="animate-spin" /> : <Save size={18} />}
                      {uploading === req.id ? 'Attaching...' : 'Attach File'}
                      <input 
                        type="file" id={`modal-up-${req.id}`} className="hidden" accept=".pdf"
                        onChange={(e) => handleFileUpload(req.id, e.target.files[0])}
                      />
                    </button>
                  )}
                </div>
              ))}
            </div>

            <div className="p-12 bg-gray-50/50 border-t border-gray-50">
              <button 
                onClick={() => setIsModalOpen(false)}
                className="w-full py-8 bg-[#F9B916] text-white font-black rounded-[2.5rem] shadow-[0_20px_50px_rgba(249,185,22,0.3)] hover:translate-y-[-4px] active:translate-y-[2px] transition-all text-2xl uppercase tracking-[0.2em]"
              >
                Back to Form
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default SubmitNewDocument;
