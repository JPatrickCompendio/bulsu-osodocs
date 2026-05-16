import React, { useState, useEffect, useRef } from 'react';
import { useAuth } from '../context/AuthContext';
import * as reqService from '../services/requirementService';
import { 
  Plus, 
  Search, 
  ChevronRight, 
  Edit2, 
  Trash2, 
  FileText, 
  RefreshCcw, 
  Calendar,
  X,
  Loader2,
  FileCode,
  Info,
  ArrowLeft,
  FileCheck,
  Eye,
  Download,
  Upload,
  File as FileIcon,
  AlertCircle,
  CheckCircle2,
  LayoutGrid,
  Settings2
} from 'lucide-react';

const ListOfRequirements = () => {
  const { user } = useAuth();
  const isAdmin = user?.role === 'admin';
  
  // State
  const [documentTypes, setDocumentTypes] = useState([]);
  const [requirements, setRequirements] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedType, setSelectedType] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  
  // Modal states
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isTypeModalOpen, setIsTypeModalOpen] = useState(false);
  const [isPreviewOpen, setIsPreviewOpen] = useState(false);
  const [editingRequirement, setEditingRequirement] = useState(null);
  const [editingType, setEditingType] = useState(null);
  const [subType, setSubType] = useState('In-Campus'); // NEW: Subcategory state
  const [previewUrl, setPreviewUrl] = useState('');
  const [isPreviewLoading, setIsPreviewLoading] = useState(false);
  
  // Form state
  const [formData, setFormData] = useState({
    title: '',
    referenceCode: '',
    description: '',
    file: null,
    file_url: ''
  });

  const [typeFormData, setTypeFormData] = useState({
    name: '',
    description: ''
  });

  const [isSaving, setIsSaving] = useState(false);
  const [toast, setToast] = useState(null);
  const fileInputRef = useRef(null);

  // Initial fetch
  useEffect(() => {
    loadDocumentTypes();
  }, []);

  // Fetch requirements when type or subType changes
  useEffect(() => {
    if (selectedType) {
      const isProposal = selectedType.name.toLowerCase().includes('activity proposal');
      loadRequirements(selectedType.id, isProposal ? subType : null);
    }
  }, [selectedType, subType]);

  const showToast = (message, type = 'success') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3000);
  };

  const loadDocumentTypes = async () => {
    setLoading(true);
    try {
      const data = await reqService.fetchDocumentTypes();
      setDocumentTypes(data || []);
    } catch (error) {
      showToast('Failed to load categories', 'error');
    } finally {
      setLoading(false);
    }
  };

  const loadRequirements = async (typeId, proposalType = null) => {
    setLoading(true);
    try {
      const data = await reqService.fetchRequirements(typeId, proposalType);
      setRequirements(data || []);
    } catch (error) {
      showToast('Failed to load requirements', 'error');
    } finally {
      setLoading(false);
    }
  };

  // Icon mapper based on keywords
  const getIconForType = (name) => {
    const n = name.toLowerCase();
    if (n.includes('renewal')) return <RefreshCcw className="text-green-500" />;
    if (n.includes('activity') || n.includes('proposal')) return <FileText className="text-blue-500" />;
    if (n.includes('report') || n.includes('year')) return <Calendar className="text-orange-500" />;
    if (n.includes('finance') || n.includes('budget')) return <FileCode className="text-purple-500" />;
    return <FileCheck className="text-gray-500" />;
  };

  const getBgForType = (name) => {
    const n = name.toLowerCase();
    if (n.includes('renewal')) return 'bg-green-50';
    if (n.includes('activity') || n.includes('proposal')) return 'bg-blue-50';
    if (n.includes('report') || n.includes('year')) return 'bg-orange-50';
    if (n.includes('finance') || n.includes('budget')) return 'bg-purple-50';
    return 'bg-gray-50';
  };

  // Requirement CRUD
  const handleOpenReqModal = (req = null) => {
    if (req) {
      setEditingRequirement(req);
      setFormData({
        title: req.title,
        referenceCode: req.referenceCode || '',
        description: req.description || '',
        file: null,
        file_url: req.file_url || ''
      });
    } else {
      setEditingRequirement(null);
      setFormData({ title: '', referenceCode: '', description: '', file: null, file_url: '' });
    }
    setIsModalOpen(true);
  };

  const handleFileChange = (e) => {
    if (e.target.files[0]) {
      setFormData({ ...formData, file: e.target.files[0] });
    }
  };

   const handleSaveRequirement = async (e) => {
    e.preventDefault();
    setIsSaving(true);
    try {
      const isProposal = selectedType.name.toLowerCase().includes('activity proposal');
      const currentProposalType = isProposal ? subType : null;

      let finalFilePath = formData.file_url;
      if (formData.file) {
        if (editingRequirement && editingRequirement.file_url) {
          await reqService.deleteStorageFile(editingRequirement.file_url).catch(() => {});
        }
        // Pass currentProposalType to ensure correct folder structure in storage
        finalFilePath = await reqService.uploadTemplate(formData.file, selectedType.name, currentProposalType);
      }

      const payload = {
        title: formData.title,
        referenceCode: formData.referenceCode,
        description: formData.description,
        file_url: finalFilePath,
        proposal_type: currentProposalType ? currentProposalType.toLowerCase().replace(' ', '-') : null,
        updatedAt: new Date().toISOString()
      };

      if (editingRequirement) {
        await reqService.updateRequirement(editingRequirement.id, payload);
        showToast('Requirement updated');
      } else {
        await reqService.createRequirement({ ...payload, documentTypeID: selectedType.id });
        showToast('Requirement created');
      }
      setIsModalOpen(false);
      loadRequirements(selectedType.id, currentProposalType);
    } catch (error) {
      showToast(error.message, 'error');
    } finally {
      setIsSaving(false);
    }
  };

  // Document Type CRUD
  const handleOpenTypeModal = (type = null) => {
    if (type) {
      setEditingType(type);
      setTypeFormData({ name: type.name, description: type.description || '' });
    } else {
      setEditingType(null);
      setTypeFormData({ name: '', description: '' });
    }
    setIsTypeModalOpen(true);
  };

  const handleSaveType = async (e) => {
    e.preventDefault();
    setIsSaving(true);
    try {
      if (editingType) {
        await reqService.updateDocumentType(editingType.id, typeFormData);
        showToast('Category updated');
      } else {
        await reqService.createDocumentType(typeFormData);
        showToast('Category created');
      }
      setIsTypeModalOpen(false);
      loadDocumentTypes();
    } catch (error) {
      showToast(error.message, 'error');
    } finally {
      setIsSaving(false);
    }
  };

  const handleDeleteType = async (id, e) => {
    e.stopPropagation();
    if (!window.confirm('Deleting this category will NOT delete the requirements inside it automatically. Are you sure?')) return;
    try {
      await reqService.deleteDocumentType(id);
      showToast('Category deleted');
      loadDocumentTypes();
    } catch (error) {
      showToast('Cannot delete category with active requirements', 'error');
    }
  };

  // Preview & Download
  const handlePreview = async (filePath) => {
    setIsPreviewLoading(true);
    setIsPreviewOpen(true);
    try {
      const url = await reqService.generateSignedUrl(filePath);
      setPreviewUrl(url);
    } catch (error) {
      showToast('Preview failed', 'error');
      setIsPreviewOpen(false);
    } finally {
      setIsPreviewLoading(false);
    }
  };

  const handleDownload = async (filePath, fileName) => {
    try {
      const url = await reqService.generateSignedUrl(filePath);
      const link = document.createElement('a');
      link.href = url;
      link.download = fileName;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } catch (error) {
      showToast('Download failed', 'error');
    }
  };

  if (loading && documentTypes.length === 0) {
    return (
      <div className="flex h-screen items-center justify-center bg-gray-50/20">
        <div className="flex flex-col items-center gap-6">
          <div className="relative w-24 h-24">
            <div className="absolute inset-0 rounded-full border-4 border-primary-green/10 border-t-primary-green animate-spin" />
            <div className="absolute inset-4 rounded-full border-4 border-secondary-gold/10 border-b-secondary-gold animate-spin-reverse" />
          </div>
          <span className="text-gray-400 font-black uppercase tracking-[0.2em] text-[10px]">Synchronizing Cloud Data</span>
        </div>
      </div>
    );
  }

  return (
    <div className="p-8 max-w-[1500px] mx-auto min-h-screen animate-in fade-in duration-500">
      {/* Toast */}
      {toast && (
        <div className={`fixed top-10 right-10 z-[200] flex items-center gap-4 px-8 py-5 rounded-[2rem] shadow-2xl animate-in slide-in-from-right-full duration-500 ${
          toast.type === 'error' ? 'bg-red-600 text-white' : 'bg-primary-green text-white'
        }`}>
          {toast.type === 'error' ? <AlertCircle size={24} /> : <CheckCircle2 size={24} />}
          <span className="font-black text-sm uppercase tracking-wider">{toast.message}</span>
        </div>
      )}

      {/* Header */}
      <div className="mb-16 flex flex-col xl:flex-row xl:items-center justify-between gap-10">
        <div className="flex items-center gap-6">
          <div className="p-5 bg-primary-green rounded-[2rem] shadow-2xl shadow-primary-green/30 ring-8 ring-primary-green/5">
            <LayoutGrid className="text-white" size={40} />
          </div>
          <div>
            <h1 className="text-5xl font-black text-gray-800 uppercase tracking-tighter mb-2">Requirements</h1>
            <div className="flex items-center gap-3 text-gray-400 font-bold uppercase tracking-widest text-[10px]">
              <span className="text-primary-green">Document Management</span>
              <ChevronRight size={14} />
              <span>{selectedType ? selectedType.name : 'All Categories'}</span>
            </div>
          </div>
        </div>
        
        <div className="flex flex-col md:flex-row items-center gap-6 w-full xl:max-w-3xl">
          <div className="relative flex-1 w-full group">
            <Search className="absolute left-6 top-1/2 -translate-y-1/2 text-gray-400 group-focus-within:text-primary-green transition-all" size={24} />
            <input 
              type="text" 
              placeholder="Search by title, code, or content..."
              className="w-full pl-16 pr-8 py-5 bg-white border-2 border-gray-100 rounded-[2.5rem] focus:border-primary-green focus:ring-0 outline-none transition-all shadow-xl shadow-gray-200/40 font-bold text-gray-700"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
          {isAdmin && !selectedType && (
            <button 
              onClick={() => handleOpenTypeModal()}
              className="bg-gray-800 text-white px-8 py-5 rounded-[2rem] font-black flex items-center gap-3 hover:bg-black transition-all shadow-xl shadow-gray-900/20 whitespace-nowrap"
            >
              <Settings2 size={24} />
              New Category
            </button>
          )}
        </div>
      </div>

      {!selectedType ? (
        /* Dynamic Grid */
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-10 animate-in slide-in-from-bottom-10 duration-700">
          {documentTypes.map((type) => (
            <div 
              key={type.id}
              onClick={() => setSelectedType(type)}
              className="bg-white p-12 rounded-[3.5rem] border border-gray-100 shadow-[0_30px_70px_-20px_rgba(0,0,0,0.06)] hover:shadow-[0_50px_100px_-30px_rgba(16,82,32,0.15)] hover:-translate-y-3 transition-all duration-500 cursor-pointer group relative overflow-hidden"
            >
              <div className={`${getBgForType(type.name)} w-24 h-24 rounded-[2.5rem] flex items-center justify-center mb-10 group-hover:scale-110 transition-transform duration-500 shadow-inner`}>
                {React.cloneElement(getIconForType(type.name), { size: 48 })}
              </div>
              <h3 className="text-4xl font-black text-gray-800 mb-6 group-hover:text-primary-green transition-colors leading-tight">{type.name}</h3>
              <p className="text-gray-400 font-bold leading-relaxed mb-12 text-lg line-clamp-2">{type.description || 'View and download requirements for this document category.'}</p>
              
              <div className="pt-10 border-t-2 border-gray-50 flex items-center justify-between mt-auto">
                {isAdmin && (
                  <div className="flex gap-2" onClick={(e) => e.stopPropagation()}>
                    <button onClick={() => handleOpenTypeModal(type)} className="p-3 text-gray-300 hover:text-blue-500 hover:bg-blue-50 rounded-2xl transition-all"><Edit2 size={20} /></button>
                    <button onClick={(e) => handleDeleteType(type.id, e)} className="p-3 text-gray-300 hover:text-red-500 hover:bg-red-50 rounded-2xl transition-all"><Trash2 size={20} /></button>
                  </div>
                )}
                <div className="flex items-center gap-3 ml-auto">
                  <span className="text-[10px] font-black text-gray-300 uppercase tracking-widest">Explore List</span>
                  <div className="w-12 h-12 rounded-full bg-gray-50 flex items-center justify-center text-gray-300 group-hover:bg-primary-green group-hover:text-white group-hover:rotate-45 transition-all duration-500">
                    <ChevronRight size={24} />
                  </div>
                </div>
              </div>
            </div>
          ))}
          {documentTypes.length === 0 && (
            <div className="col-span-full py-32 text-center bg-white rounded-[4rem] border-4 border-dashed border-gray-50 flex flex-col items-center gap-6">
              <Info size={80} className="text-gray-200" />
              <div className="space-y-2">
                <p className="text-3xl font-black text-gray-300 uppercase tracking-widest">No Categories Defined</p>
                <p className="text-gray-400 font-bold">Admins can create new document types to start grouping requirements.</p>
              </div>
            </div>
          )}
        </div>
      ) : (
        /* Requirements Table */
        <div className="animate-in slide-in-from-right-10 duration-500">
          <div className="flex flex-col md:flex-row md:items-center justify-between mb-12 gap-8">
            <button 
              onClick={() => setSelectedType(null)}
              className="flex items-center gap-4 text-gray-400 hover:text-primary-green transition-all group px-8 py-4 bg-white border-2 border-gray-100 rounded-3xl w-fit shadow-xl shadow-gray-200/20"
            >
              <ArrowLeft size={24} className="group-hover:-translate-x-3 transition-transform duration-300" />
              <span className="font-black uppercase tracking-widest text-xs">Return to Dashboard</span>
            </button>

            <div className="flex items-center gap-6">
              <div className="hidden lg:flex bg-gray-100 p-2 rounded-[2rem] shadow-inner max-w-xl overflow-x-auto no-scrollbar">
                {documentTypes.slice(0, 3).map(type => (
                  <button
                    key={type.id}
                    onClick={() => setSelectedType(type)}
                    className={`px-8 py-3 rounded-2xl text-xs font-black transition-all duration-300 whitespace-nowrap ${
                      selectedType.id === type.id 
                        ? 'bg-white text-primary-green shadow-xl' 
                        : 'text-gray-400 hover:text-gray-600'
                    }`}
                  >
                    {type.name}
                  </button>
                ))}
              </div>
              {isAdmin && (
                <button 
                  onClick={() => handleOpenReqModal()}
                  className="bg-primary-green text-white px-10 py-5 rounded-[2rem] font-black flex items-center gap-4 hover:scale-105 active:scale-95 transition-all shadow-2xl shadow-primary-green/30"
                >
                  <Plus size={28} />
                  Add Document
                </button>
              )}
            </div>
          </div>

          <div className="bg-white rounded-[4rem] border-2 border-gray-50 shadow-[0_40px_100px_-30px_rgba(0,0,0,0.08)] overflow-hidden">
            <div className="p-12 border-b-2 border-gray-50 bg-gray-50/20 flex flex-col md:flex-row items-center justify-between gap-10">
              <div className="flex items-center gap-8">
                <div className={`${getBgForType(selectedType.name)} w-20 h-20 rounded-[2rem] shadow-xl flex items-center justify-center ring-8 ring-white`}>
                  {React.cloneElement(getIconForType(selectedType.name), { size: 32 })}
                </div>
                <div>
                  <h2 className="text-4xl font-black text-gray-800 tracking-tight leading-none mb-3">{selectedType.name}</h2>
                  <p className="text-gray-400 font-bold text-lg">{selectedType.description || 'System-authorized requirements and templates.'}</p>
                </div>
              </div>

              {/* NEW: Subcategory Toggle for Activity Proposal */}
              {selectedType.name.toLowerCase().includes('activity proposal') && (
                <div className="flex bg-white p-2 rounded-[2.5rem] shadow-xl border-2 border-gray-50 ring-8 ring-gray-50/30">
                  {['In-Campus', 'Off-Campus'].map((type) => (
                    <button
                      key={type}
                      onClick={() => setSubType(type)}
                      className={`px-12 py-5 rounded-[1.8rem] text-sm font-black transition-all duration-500 uppercase tracking-widest ${
                        subType === type 
                          ? 'bg-primary-green text-white shadow-2xl shadow-primary-green/40 scale-105' 
                          : 'text-gray-400 hover:bg-gray-50'
                      }`}
                    >
                      {type}
                    </button>
                  ))}
                </div>
              )}
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left">
                <thead>
                  <tr className="bg-gray-50/30 text-gray-400 border-b-2 border-gray-50">
                    <th className="px-12 py-8 font-black text-[10px] uppercase tracking-[0.2em] w-1/2">Requirement Title & Info</th>
                    <th className="px-12 py-8 font-black text-[10px] uppercase tracking-[0.2em]">Code</th>
                    <th className="px-12 py-8 font-black text-[10px] uppercase tracking-[0.2em] text-center">Status</th>
                    <th className="px-12 py-8 font-black text-[10px] uppercase tracking-[0.2em] text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y-2 divide-gray-50">
                  {requirements.filter(req => req.title.toLowerCase().includes(searchQuery.toLowerCase())).length > 0 ? (
                    requirements.filter(req => req.title.toLowerCase().includes(searchQuery.toLowerCase())).map((req) => (
                      <tr key={req.id} className="hover:bg-gray-50/20 transition-all group">
                        <td className="px-12 py-10">
                          <div className="flex items-start gap-6">
                            <div className="w-14 h-14 rounded-2xl bg-white shadow-lg flex items-center justify-center text-primary-green border border-gray-50 group-hover:rotate-3 transition-transform">
                              <FileText size={28} />
                            </div>
                            <div>
                              <div className="font-black text-2xl text-gray-800 mb-2">{req.title}</div>
                              <p className="text-gray-400 font-bold text-sm leading-relaxed max-w-xl line-clamp-1">{req.description || 'No special instructions provided.'}</p>
                            </div>
                          </div>
                        </td>
                        <td className="px-12 py-10">
                          <span className="px-6 py-2.5 bg-gray-100 text-gray-500 rounded-2xl text-[10px] font-black tracking-widest border border-gray-200/50">
                            {req.referenceCode || 'GENERAL'}
                          </span>
                        </td>
                        <td className="px-12 py-10">
                          <div className="flex justify-center">
                            {req.file_url ? (
                              <div className="flex items-center gap-3 px-6 py-2.5 bg-green-50 text-green-600 rounded-full border border-green-100/50">
                                <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
                                <span className="font-black text-[10px] uppercase tracking-widest">Available</span>
                              </div>
                            ) : (
                              <div className="flex items-center gap-3 px-6 py-2.5 bg-gray-50 text-gray-400 rounded-full border border-gray-100/50">
                                <span className="font-black text-[10px] uppercase tracking-widest">No Template</span>
                              </div>
                            )}
                          </div>
                        </td>
                        <td className="px-12 py-10">
                          <div className="flex items-center justify-end gap-3">
                            {req.file_url && (
                              <>
                                {!req.file_url.toLowerCase().endsWith('.docx') && (
                                  <button onClick={() => handlePreview(req.file_url)} className="p-4 text-gray-400 hover:text-primary-green hover:bg-primary-green/10 rounded-2xl transition-all" title="Preview"><Eye size={24} /></button>
                                )}
                                <button onClick={() => handleDownload(req.file_url, `${req.title}${req.file_url.toLowerCase().endsWith('.docx') ? '.docx' : '.pdf'}`)} className="p-4 text-gray-400 hover:text-primary-green hover:bg-primary-green/10 rounded-2xl transition-all" title="Download"><Download size={24} /></button>
                              </>
                            )}
                            {isAdmin && (
                              <>
                                <div className="w-[2px] h-10 bg-gray-100 mx-2" />
                                <button onClick={() => handleOpenReqModal(req)} className="p-4 text-gray-300 hover:text-blue-500 hover:bg-blue-50 rounded-2xl transition-all"><Edit2 size={22} /></button>
                                <button onClick={(e) => { e.stopPropagation(); reqService.deleteRequirement(req.id, req.file_url).then(() => loadRequirements(selectedType.id)); }} className="p-4 text-gray-300 hover:text-red-500 hover:bg-red-50 rounded-2xl transition-all"><Trash2 size={22} /></button>
                              </>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={4} className="px-12 py-32 text-center opacity-40">
                        <div className="flex flex-col items-center gap-8">
                          <Info size={100} className="text-gray-200" />
                          <div className="space-y-2">
                            <p className="text-3xl font-black text-gray-400 uppercase tracking-widest">Category Empty</p>
                            <p className="text-gray-400 font-bold">No requirements have been listed for this document type yet.</p>
                          </div>
                        </div>
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* Requirement Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-[110] flex items-center justify-center p-6 bg-gray-950/40 backdrop-blur-md animate-in fade-in duration-300">
          <div className="bg-white w-full max-w-3xl rounded-[4rem] shadow-2xl overflow-hidden animate-in zoom-in-95 duration-300">
            <div className="p-12 border-b-2 border-gray-50 flex items-center justify-between bg-gray-50/20">
              <div className="flex items-center gap-6">
                <div className="w-14 h-14 bg-primary-green rounded-[1.5rem] flex items-center justify-center text-white shadow-xl shadow-primary-green/20">
                  <Plus size={32} />
                </div>
                <h3 className="text-3xl font-black text-gray-800 uppercase tracking-tighter">
                  {editingRequirement ? 'Update Document' : 'List Requirement'}
                </h3>
              </div>
              <button onClick={() => setIsModalOpen(false)} className="p-4 hover:bg-gray-100 rounded-full transition-colors text-gray-400"><X size={32} /></button>
            </div>
            
            <form onSubmit={handleSaveRequirement} className="p-12 space-y-10">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-10">
                <div className="md:col-span-2 space-y-3">
                  <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1">Requirement Title</label>
                  <input 
                    type="text" required placeholder="e.g. Organizational Bylaws"
                    className="w-full px-8 py-5 bg-gray-50 border-4 border-transparent rounded-[2rem] focus:bg-white focus:border-primary-green/20 outline-none transition-all font-black text-gray-700 text-lg shadow-inner"
                    value={formData.title} onChange={(e) => setFormData({...formData, title: e.target.value})}
                  />
                </div>
                
                <div className="space-y-3">
                  <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1">Reference Code</label>
                  <input 
                    type="text" placeholder="e.g. BY-2026"
                    className="w-full px-8 py-5 bg-gray-50 border-4 border-transparent rounded-[2rem] focus:bg-white focus:border-primary-green/20 outline-none transition-all font-black text-gray-700 text-lg shadow-inner"
                    value={formData.referenceCode} onChange={(e) => setFormData({...formData, referenceCode: e.target.value})}
                  />
                </div>
              </div>
              
              <div className="space-y-3">
                <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1">Detailed Instructions</label>
                <textarea 
                  rows="4" placeholder="How should organizations prepare this document?"
                  className="w-full px-8 py-5 bg-gray-50 border-4 border-transparent rounded-[2rem] focus:bg-white focus:border-primary-green/20 outline-none transition-all resize-none font-bold text-gray-700 text-lg shadow-inner"
                  value={formData.description} onChange={(e) => setFormData({...formData, description: e.target.value})}
                ></textarea>
              </div>

              <div className="space-y-3">
                <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1">Template PDF</label>
                <div 
                  onClick={() => fileInputRef.current.click()}
                  className="border-4 border-dashed border-gray-100 rounded-[3rem] p-12 text-center hover:border-primary-green/30 hover:bg-primary-green/5 transition-all cursor-pointer group shadow-inner"
                >
                  <Upload className="mx-auto text-gray-200 mb-6 group-hover:text-primary-green group-hover:scale-110 transition-all" size={60} />
                  <p className="text-xl font-black text-gray-400 group-hover:text-primary-green transition-colors">
                    {formData.file ? formData.file.name : formData.file_url ? 'Template Uploaded' : 'Upload Template (PDF or DOCX)'}
                  </p>
                  <input type="file" ref={fileInputRef} className="hidden" accept=".pdf,.docx" onChange={handleFileChange} />
                </div>
              </div>

              <div className="pt-8 flex gap-8">
                <button type="button" onClick={() => setIsModalOpen(false)} className="flex-1 px-10 py-6 border-4 border-gray-50 text-gray-400 font-black rounded-3xl hover:bg-gray-50 transition-all uppercase tracking-widest">Cancel</button>
                <button type="submit" disabled={isSaving} className="flex-2 px-10 py-6 bg-primary-green text-white font-black rounded-3xl hover:scale-[1.02] active:scale-[0.98] transition-all shadow-2xl shadow-primary-green/30 flex items-center justify-center gap-4 uppercase tracking-widest">
                  {isSaving ? <Loader2 size={28} className="animate-spin" /> : editingRequirement ? 'Apply Changes' : 'Publish Requirement'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Category Modal */}
      {isTypeModalOpen && (
        <div className="fixed inset-0 z-[120] flex items-center justify-center p-6 bg-gray-950/40 backdrop-blur-md animate-in fade-in duration-300">
          <div className="bg-white w-full max-w-xl rounded-[4rem] shadow-2xl overflow-hidden animate-in zoom-in-95 duration-300">
            <div className="p-12 border-b-2 border-gray-50 flex items-center justify-between">
              <h3 className="text-3xl font-black text-gray-800 uppercase tracking-tighter">
                {editingType ? 'Modify Category' : 'New Category'}
              </h3>
              <button onClick={() => setIsTypeModalOpen(false)} className="p-4 text-gray-300"><X size={32} /></button>
            </div>
            <form onSubmit={handleSaveType} className="p-12 space-y-10">
              <div className="space-y-3">
                <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1">Category Name</label>
                <input 
                  type="text" required placeholder="e.g. Mid-Year Reports"
                  className="w-full px-8 py-5 bg-gray-50 border-4 border-transparent rounded-[2rem] focus:bg-white focus:border-primary-green/20 outline-none transition-all font-black text-gray-700 text-lg shadow-inner"
                  value={typeFormData.name} onChange={(e) => setTypeFormData({...typeFormData, name: e.target.value})}
                />
              </div>
              <div className="space-y-3">
                <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1">Short Description</label>
                <textarea 
                  rows="3" placeholder="What documents are grouped here?"
                  className="w-full px-8 py-5 bg-gray-50 border-4 border-transparent rounded-[2rem] focus:bg-white focus:border-primary-green/20 outline-none transition-all resize-none font-bold text-gray-700 text-lg shadow-inner"
                  value={typeFormData.description} onChange={(e) => setTypeFormData({...typeFormData, description: e.target.value})}
                ></textarea>
              </div>
              <div className="flex gap-8">
                <button type="submit" disabled={isSaving} className="w-full py-6 bg-gray-800 text-white font-black rounded-3xl shadow-2xl shadow-gray-900/20 uppercase tracking-widest">
                  {isSaving ? <Loader2 size={24} className="animate-spin mx-auto" /> : editingType ? 'Update Category' : 'Create Category'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Preview */}
      {isPreviewOpen && (
        <div className="fixed inset-0 z-[200] flex flex-col bg-gray-950/98 animate-in fade-in duration-500">
          <div className="flex items-center justify-between p-10 bg-black/20 backdrop-blur-xl">
            <h3 className="text-white font-black tracking-tighter text-3xl">Document Template</h3>
            <button onClick={() => { setIsPreviewOpen(false); setPreviewUrl(''); }} className="text-white p-4 hover:rotate-90 transition-all duration-300"><X size={48} /></button>
          </div>
          <div className="flex-1 p-10">
            <div className="bg-white mx-auto w-full max-w-7xl h-full rounded-[4rem] shadow-2xl overflow-hidden">
              {isPreviewLoading ? (
                <div className="w-full h-full flex items-center justify-center"><Loader2 className="h-20 w-20 animate-spin text-primary-green" /></div>
              ) : (
                <iframe src={`${previewUrl}#toolbar=0`} className="w-full h-full border-none" title="PDF" />
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ListOfRequirements;
