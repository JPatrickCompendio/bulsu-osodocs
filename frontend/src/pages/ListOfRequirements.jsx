import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import * as reqService from '../services/requirementService';
import * as subtypeService from '../services/subtypeService';
import { supabase } from '../supabaseClient';
import {
  Search,
  ChevronRight,
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
  AlertCircle,
  CheckCircle2,
  LayoutGrid,
  Settings,
  Paperclip,
  MoreHorizontal,
  Plus,
  ListChecks,
} from 'lucide-react';
import PageHeader from '../components/PageHeader';

const getStoragePath = (filePath) => {
  let path = String(filePath || '').trim();
  if (path.startsWith('http')) {
    const bucketMarker = '/documents/';
    const index = path.indexOf(bucketMarker);
    if (index !== -1) {
      path = path.substring(index + bucketMarker.length);
    }
  }
  const queryIndex = path.indexOf('?');
  if (queryIndex !== -1) {
    path = path.substring(0, queryIndex);
  }
  if (path.startsWith('documents/')) {
    path = path.substring('documents/'.length);
  }
  return path;
};

const ListOfRequirements = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const isAdmin = user?.role === 'admin';

  // State
  const [documentTypes, setDocumentTypes] = useState([]);
  const [allRequirements, setAllRequirements] = useState([]);
  const [requirements, setRequirements] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedType, setSelectedType] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [showSearchResults, setShowSearchResults] = useState(false);

  const [isPreviewOpen, setIsPreviewOpen] = useState(false);
  const [highlightReqId, setHighlightReqId] = useState(null);
  const [docSubtypes, setDocSubtypes] = useState({}); // Mapping from docTypeId -> active subtypes
  const [subTypeObj, setSubTypeObj] = useState(null); // The selected subtype object
  const [subType, setSubType] = useState(''); // Keep subType string for compatibility
  const [previewUrl, setPreviewUrl] = useState('');
  const [isPreviewLoading, setIsPreviewLoading] = useState(false);
  const [activeDropdown, setActiveDropdown] = useState(null);
  const [previewFile, setPreviewFile] = useState(null);
  const [filePreviewUrl, setFilePreviewUrl] = useState('');
  const [toast, setToast] = useState(null);

  // Initial fetch
  useEffect(() => {
    loadDocumentTypes();
    reqService.fetchAllRequirements().then(setAllRequirements).catch(() => {});
  }, []);

  useEffect(() => {
    const fetchUrl = async () => {
      if (!previewFile) {
        setFilePreviewUrl('');
        return;
      }
      const finalPath = getStoragePath(previewFile.url);

      try {
        const { data } = await supabase.storage
          .from('documents')
          .createSignedUrl(finalPath, 3600);

        if (data?.signedUrl) {
          setFilePreviewUrl(data.signedUrl);
          return;
        }
      } catch (e) {
        console.error('Failed to get signed URL:', e);
      }

      // Fallback
      const { data } = supabase.storage
        .from('documents')
        .getPublicUrl(finalPath);

      setFilePreviewUrl(data?.publicUrl || '');
    };
    fetchUrl();
  }, [previewFile]);

  // Fetch requirements when type or subType changes
  useEffect(() => {
    if (selectedType) {
      const isProposal = selectedType.name.toLowerCase().includes('activity proposal');
      loadRequirements(selectedType.id, isProposal ? (subTypeObj?.id || null) : null, isProposal ? (subTypeObj?.name || subType || null) : null);
    }
  }, [selectedType, subTypeObj, subType]);

  const showToast = (message, type = 'success') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3000);
  };

  const loadDocumentTypes = async () => {
    setLoading(true);
    try {
      const data = await reqService.fetchDocumentTypes();
      setDocumentTypes(data || []);

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
    } catch (error) {
      showToast('Failed to load categories', 'error');
    } finally {
      setLoading(false);
    }
  };

  const loadRequirements = async (typeId, subtypeId = null, proposalType = null) => {
    setLoading(true);
    try {
      const data = await reqService.fetchRequirements(typeId, subtypeId, proposalType);
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

  const globalSearchResults = searchQuery.trim().length >= 2
    ? allRequirements.filter((req) => {
        const q = searchQuery.toLowerCase();
        return (
          (req.title || '').toLowerCase().includes(q) ||
          (req.referenceCode || '').toLowerCase().includes(q) ||
          (req.description || '').toLowerCase().includes(q)
        );
      }).slice(0, 8)
    : [];

  const filteredRequirements = requirements.filter((req) => {
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase();
    return (
      (req.title || '').toLowerCase().includes(q) ||
      (req.referenceCode || '').toLowerCase().includes(q) ||
      (req.description || '').toLowerCase().includes(q)
    );
  });

  const handleSearchResultClick = (req) => {
    const type = documentTypes.find((t) => t.id === req.documentTypeID) ||
      documentTypes.find((t) => t.id === req.documentType?.id);
    if (!type) return;
    setSelectedType(type);
    setSearchQuery('');
    setShowSearchResults(false);
    setHighlightReqId(req.id);
    if (req.subtype_id || req.proposal_type) {
      const subtypes = docSubtypes[type.id] || [];
      const match = subtypes.find(st => st.id === req.subtype_id || st.name === req.proposal_type);
      if (match) {
        setSubTypeObj(match);
        setSubType(match.name);
      }
    } else {
      setSubTypeObj(null);
      setSubType('');
    }
    setTimeout(() => {
      const el = document.getElementById(`requirement-row-${req.id}`);
      el?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      setTimeout(() => setHighlightReqId(null), 3000);
    }, 400);
  };

  // Preview & Download
  const handlePreview = async (filePath) => {
    setIsPreviewLoading(true);
    setIsPreviewOpen(true);
    try {
      const finalPath = getStoragePath(filePath);
      const url = await reqService.generateSignedUrl(finalPath);
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
      const finalPath = getStoragePath(filePath);
      const url = await reqService.generateSignedUrl(finalPath);
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
    <div className="w-full min-h-screen animate-in fade-in duration-500">
      {/* Toast */}
      {toast && (
        <div className={`fixed top-10 right-10 z-[200] flex items-center gap-4 px-8 py-5 rounded-[2rem] shadow-2xl animate-in slide-in-from-right-full duration-500 ${toast.type === 'error' ? 'bg-red-600 text-white' : 'bg-primary-green text-white'
          }`}>
          {toast.type === 'error' ? <AlertCircle size={24} /> : <CheckCircle2 size={24} />}
          <span className="font-black text-sm uppercase tracking-wider">{toast.message}</span>
        </div>
      )}

      {/* Header */}
      <div className="mb-16 flex flex-col xl:flex-row xl:items-center justify-between gap-10">
        <PageHeader 
          title="Requirements" 
          subtitle={selectedType ? `Document Management / ${selectedType.name}` : 'Document Management / All Categories'} 
          icon={ListChecks} 
          iconColor="green" 
        />

        <div className="flex flex-col md:flex-row items-center gap-6 w-full xl:max-w-xl">
          <div className="relative flex-1 w-full group">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 group-focus-within:text-primary-green transition-all" size={20} />
            <input
              type="text"
              placeholder="Search by code or title across all categories..."
              className="w-full pl-10 pr-4 py-2.5 bg-white border border-gray-200 rounded-xl focus:border-primary-green focus:ring-0 outline-none transition-all shadow-sm font-bold text-gray-700 text-sm"
              value={searchQuery}
              onChange={(e) => {
                setSearchQuery(e.target.value);
                setShowSearchResults(true);
              }}
              onFocus={() => setShowSearchResults(true)}
              onBlur={() => setTimeout(() => setShowSearchResults(false), 200)}
            />
            {showSearchResults && globalSearchResults.length > 0 && (
              <div className="absolute top-full left-0 right-0 mt-2 bg-white border border-gray-100 rounded-xl shadow-xl z-50 overflow-hidden">
                {globalSearchResults.map((req) => (
                  <button
                    key={req.id}
                    type="button"
                    onMouseDown={() => handleSearchResultClick(req)}
                    className="w-full text-left px-4 py-3 hover:bg-gray-50 border-b border-gray-50 last:border-0"
                  >
                    <p className="font-bold text-sm text-gray-800">{req.title}</p>
                    <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mt-1">
                      {req.referenceCode || 'GENERAL'} • {req.documentType?.name || 'Category'}
                    </p>
                  </button>
                ))}
              </div>
            )}
          </div>
          {isAdmin && !selectedType && (
            <button
              onClick={() => navigate('/requirements/settings/new')}
              className="bg-gray-800 text-white px-6 py-3.5 rounded-xl text-sm font-black flex items-center gap-2 hover:bg-black transition-all shadow-md whitespace-nowrap"
            >
              <Plus size={18} />
              New Category
            </button>
          )}
        </div>
      </div>

      {!selectedType ? (
        /* Dynamic Grid */
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-10 animate-in slide-in-from-bottom-10 duration-700">
          {documentTypes.map((type) => {
            const hasSubtypes = docSubtypes[type.id] && docSubtypes[type.id].length > 0;
            return (
            <div
              key={type.id}
              onClick={() => {
                setSelectedType(type);
                if (hasSubtypes) {
                   setSubTypeObj(docSubtypes[type.id][0]);
                   setSubType(docSubtypes[type.id][0].name);
                } else {
                   setSubTypeObj(null);
                   setSubType('');
                }
              }}
              className="bg-white p-8 rounded-2xl border border-gray-100 shadow-sm hover:shadow-md hover:-translate-y-1 transition-all duration-300 cursor-pointer group relative overflow-hidden"
            >
              {isAdmin && (
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    navigate(`/requirements/settings/${type.id}`);
                  }}
                  className="absolute top-4 right-4 p-2.5 text-gray-400 hover:text-primary-green hover:bg-green-50 rounded-xl transition-all z-10"
                  title="Category settings"
                >
                  <Settings size={20} />
                </button>
              )}
              <div className={`${getBgForType(type.name)} w-16 h-16 rounded-xl flex items-center justify-center mb-6 group-hover:scale-105 transition-transform duration-300`}>
                {React.cloneElement(getIconForType(type.name), { size: 32 })}
              </div>
              <h3 className="text-xl font-black text-gray-800 mb-3 group-hover:text-primary-green transition-colors leading-tight">{type.name}</h3>
              <p className="text-gray-500 font-medium leading-relaxed mb-8 text-sm line-clamp-2">{type.description || 'View and download requirements for this document category.'}</p>

              <div className="pt-6 border-t border-gray-50 flex items-center justify-between mt-auto">

                <div className="flex items-center gap-3 ml-auto">
                  <span className="text-[10px] font-black text-gray-300 uppercase tracking-widest">Explore List</span>
                  <div className="w-8 h-8 rounded-full bg-gray-50 flex items-center justify-center text-gray-400 group-hover:bg-primary-green group-hover:text-white transition-all duration-300">
                    <ChevronRight size={16} />
                  </div>
                </div>
              </div>
            </div>
            );
          })}
          {documentTypes.length === 0 && (
            <div className="col-span-full py-20 text-center bg-white rounded-3xl border-2 border-dashed border-gray-100 flex flex-col items-center gap-4">
              <Info size={48} className="text-gray-300" />
              <div className="space-y-1">
                <p className="text-xl font-black text-gray-400 uppercase tracking-widest">No Categories Defined</p>
                <p className="text-gray-500 text-sm">Admins can create new document types to start grouping requirements.</p>
              </div>
            </div>
          )}
        </div>
      ) : (
        /* Requirements Table */
        <div className="animate-in slide-in-from-right-10 duration-500">
          <div className="flex items-center justify-between mb-8">
            <button
              onClick={() => setSelectedType(null)}
              className="flex items-center gap-3 text-gray-500 hover:text-primary-green hover:bg-gray-50 transition-all p-3 rounded-xl"
            >
              <ArrowLeft size={24} />
              <span className="font-bold text-sm">Back</span>
            </button>

            {isAdmin && (
              <div className="flex items-center gap-3">
                <button
                  onClick={() => navigate(`/admin/academic-settings`)}
                  className="flex items-center gap-2 px-5 py-3 bg-blue-50 text-blue-700 border border-blue-200 rounded-xl font-black text-xs uppercase tracking-widest hover:bg-blue-100 transition-all"
                >
                  <Calendar size={18} />
                  Submission Window
                </button>
                <button
                  onClick={() => navigate(`/requirements/settings/${selectedType.id}`)}
                  className="flex items-center gap-2 px-5 py-3 bg-gray-100 text-gray-700 rounded-xl font-black text-xs uppercase tracking-widest hover:bg-gray-200 transition-all"
                >
                  <Settings size={18} />
                  Category Settings
                </button>
              </div>
            )}
          </div>

          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
            <div className="p-8 border-b border-gray-100 bg-gray-50/30 flex flex-col md:flex-row items-center justify-between gap-6">
              <div className="flex items-center gap-5">
                <div className={`${getBgForType(selectedType.name)} w-14 h-14 rounded-xl shadow-sm flex items-center justify-center`}>
                  {React.cloneElement(getIconForType(selectedType.name), { size: 24 })}
                </div>
                <div>
                  <h2 className="text-2xl font-black text-gray-800 tracking-tight leading-none mb-1.5">{selectedType.name}</h2>
                  <p className="text-gray-500 text-sm">{selectedType.description || 'System-authorized requirements and templates.'}</p>
                </div>
              </div>

              <div className="flex items-center gap-4">
                {/* NEW: Dynamic Subcategory Toggle */}
                {selectedType && docSubtypes[selectedType.id] && docSubtypes[selectedType.id].length > 0 && (
                  <div className="flex bg-white p-1.5 rounded-xl shadow-sm border border-gray-100">
                    {docSubtypes[selectedType.id].map((st) => (
                      <button
                        key={st.id}
                        onClick={() => {
                          setSubTypeObj(st);
                          setSubType(st.name);
                        }}
                        className={`px-6 py-2.5 rounded-lg text-xs font-black transition-all duration-300 uppercase tracking-widest ${subTypeObj?.id === st.id
                          ? 'bg-primary-green text-white shadow-md'
                          : 'text-gray-500 hover:bg-gray-50'
                          }`}
                      >
                        {st.name}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>

            <div className="overflow-x-auto pb-48">
              <table className="w-full text-left">
                <thead>
                  <tr className="bg-gray-50/30 text-gray-400 border-b-2 border-gray-50">
                    <th className="px-6 py-4 font-black text-[10px] uppercase tracking-[0.2em] w-1/4">Title of Requirement</th>
                    <th className="px-6 py-4 font-black text-[10px] uppercase tracking-[0.2em]">Code</th>
                    <th className="px-6 py-4 font-black text-[10px] uppercase tracking-[0.2em] w-1/3">Description</th>
                    <th className="px-6 py-4 font-black text-[10px] uppercase tracking-[0.2em]">Attachment</th>
                    <th className="px-6 py-4 font-black text-[10px] uppercase tracking-[0.2em] text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y-2 divide-gray-50">
                  {filteredRequirements.length > 0 ? (
                    filteredRequirements.map((req) => (
                      <tr
                        key={req.id}
                        id={`requirement-row-${req.id}`}
                        className={`hover:bg-gray-50/20 transition-all group ${highlightReqId === req.id ? 'bg-primary-green/10 ring-2 ring-primary-green/30 ring-inset' : ''}`}
                      >
                        <td className="px-6 py-4">
                          <div className="font-black text-lg text-gray-800">{req.title}</div>
                        </td>
                        <td className="px-6 py-4">
                          <span className="px-3 py-1.5 bg-gray-100 text-gray-500 rounded-lg text-[10px] font-black tracking-widest border border-gray-200/50">
                            {req.referenceCode || 'GENERAL'}
                          </span>
                        </td>
                        <td className="px-6 py-4">
                          <p className="text-gray-400 font-bold text-xs leading-relaxed line-clamp-2">{req.description || 'No special instructions provided.'}</p>
                        </td>
                        <td className="px-6 py-4">
                          {req.file_url ? (
                            <div className="flex items-center gap-3">
                              <div className="flex items-center gap-2 text-primary-green">
                                <FileText size={16} />
                                <span className="font-black text-xs truncate max-w-[150px]">
                                  {req.file_url.split('/').pop()}
                                </span>
                              </div>
                            </div>
                          ) : (
                            <span className="font-black text-xs text-gray-400 uppercase">None</span>
                          )}
                        </td>
                        <td className="px-6 py-4 relative">
                          <div className="flex justify-end relative">
                            {/* Direct Preview Button */}
                            <button
                              onClick={() => setPreviewFile({ title: req.title, url: req.file_url })}
                              className="p-2 text-blue-500 hover:text-blue-700 hover:bg-blue-50 rounded-lg transition-all mr-2"
                            >
                              <Eye size={20} />
                            </button>
                            <button
                              onClick={() => setActiveDropdown(activeDropdown === req.id ? null : req.id)}
                              className="p-2 text-gray-400 hover:text-primary-green hover:bg-gray-100 rounded-lg transition-all"
                            >
                              <MoreHorizontal size={20} />
                            </button>

                            {activeDropdown === req.id && (
                              <div className="absolute right-0 top-10 mt-2 w-48 bg-white rounded-xl shadow-xl border border-gray-100 z-50 overflow-hidden animate-in fade-in zoom-in-95 duration-200">
                                {req.file_url && (
                                  <>
                                    <button onClick={() => { setPreviewFile({ title: req.title, url: req.file_url }); setActiveDropdown(null); }} className="w-full text-left px-4 py-3 text-sm font-bold text-gray-600 hover:bg-gray-50 hover:text-primary-green flex items-center gap-3">
                                      <Eye size={16} /> Preview
                                    </button>
                                    <button onClick={() => { handleDownload(req.file_url, `${req.title}${req.file_url.toLowerCase().endsWith('.docx') ? '.docx' : '.pdf'}`); setActiveDropdown(null); }} className="w-full text-left px-4 py-3 text-sm font-bold text-gray-600 hover:bg-gray-50 hover:text-primary-green flex items-center gap-3">
                                      <Download size={16} /> Download
                                    </button>
                                  </>
                                )}
                              </div>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={5} className="px-6 py-20 text-center opacity-40">
                        <div className="flex flex-col items-center gap-4">
                          <Info size={64} className="text-gray-200" />
                          <div className="space-y-1">
                            <p className="text-xl font-black text-gray-400 uppercase tracking-widest">Category Empty</p>
                            <p className="text-gray-400 font-bold text-sm">No requirements have been listed yet.</p>
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
                <div className="w-full h-[60vh] flex flex-col items-center justify-center gap-4">
                  <div className="w-10 h-10 border-4 border-primary-green border-t-transparent rounded-full animate-spin"></div>
                  <span className="text-primary-green font-bold tracking-[0.2em] text-xs uppercase animate-pulse">Loading Document Preview...</span>
                </div>
              ) : previewUrl?.toLowerCase().includes('.docx') ? (
                <iframe src={`https://view.officeapps.live.com/op/embed.aspx?src=${encodeURIComponent(previewUrl)}`} className="w-full h-full border-none" title="Word Preview" />
              ) : (
                <iframe src={`${previewUrl}#toolbar=0`} className="w-full h-full border-none" title="PDF" />
              )}
            </div>
          </div>
        </div>
      )}

      {/* PDF Preview Modal Overlay */}
      {previewFile && (
        <div className="fixed inset-0 bg-slate-900/80 backdrop-blur-md z-[120] flex items-center justify-center p-4 animate-in fade-in duration-300">
          <div className="bg-white rounded-3xl w-full max-w-5xl h-[85vh] flex flex-col overflow-hidden shadow-2xl border border-gray-100 animate-in zoom-in-95 duration-300">
            {/* Header */}
            <div className="bg-gray-50 border-b border-gray-100 px-8 py-5 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-indigo-50 rounded-xl flex items-center justify-center text-indigo-600">
                  <Paperclip size={20} />
                </div>
                <div>
                  <h3 className="font-bold text-gray-800 text-lg">{previewFile.title}</h3>
                  <p className="text-gray-400 text-xs font-medium max-w-sm truncate" title={previewFile.url.split('/').pop()}>File: {previewFile.url.split('/').pop()}</p>
                </div>
              </div>
              <button
                onClick={() => setPreviewFile(null)}
                className="p-2.5 hover:bg-gray-200 rounded-full transition-colors text-gray-400 hover:text-gray-800"
              >
                <X size={20} />
              </button>
            </div>

            {/* Body */}
            <div className="flex-1 flex flex-col overflow-hidden bg-gray-100 p-6">
              <div className="flex-1 bg-white rounded-2xl overflow-hidden shadow-sm border border-gray-200/50 relative">
                {previewFile.url?.toLowerCase().includes('.pdf') ? (
                  <iframe
                    src={filePreviewUrl ? `${filePreviewUrl}#toolbar=1&navpanes=0&view=Fit` : null}
                    className="w-full h-full border-0 rounded-2xl"
                    title="PDF Preview"
                  />
                ) : previewFile.url?.toLowerCase().includes('.docx') ? (
                  <iframe
                    src={filePreviewUrl ? `https://view.officeapps.live.com/op/embed.aspx?src=${encodeURIComponent(filePreviewUrl)}` : null}
                    className="w-full h-full border-0 rounded-2xl"
                    title="Word Preview"
                  />
                ) : (
                  <div className="absolute inset-0 flex flex-col items-center justify-center p-6 text-center">
                    <FileText size={48} className="text-gray-300 mb-4 animate-bounce" />
                    <h4 className="font-bold text-gray-700 mb-1">Preview is not supported for this file type</h4>
                    <p className="text-gray-400 text-xs max-w-xs mb-4">You can download it to view locally on your device.</p>
                    <button
                      onClick={() => handleDownload(previewFile.url, `${previewFile.title}${previewFile.url.toLowerCase().endsWith('.docx') ? '.docx' : '.pdf'}`)}
                      className="bg-indigo-600 text-white px-6 py-2.5 rounded-xl text-xs font-bold hover:bg-indigo-700 transition-all shadow-md inline-flex items-center gap-2"
                    >
                      <Download size={16} /> Download Template
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};

export default ListOfRequirements;

