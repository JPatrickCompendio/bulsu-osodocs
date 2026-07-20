import React, { useEffect, useState, useRef, useMemo } from 'react';
import { X, Printer, Edit3, Image as ImageIcon } from 'lucide-react';
import JoditEditor from 'jodit-react';
import DEFAULT_HEADER_IMG from '../assets/HEADER.png';
import DEFAULT_FOOTER_IMG from '../assets/FOOTER.png';

const ActivityProposalPreviewModal = ({
  isOpen,
  onClose,
  proposalDetails,
  user
}) => {
  const [content, setContent] = useState('');
  const [isInitialized, setIsInitialized] = useState(false);
  const [headerBase64, setHeaderBase64] = useState('');
  const [footerBase64, setFooterBase64] = useState('');
  
  const editorRef = useRef(null);
  const headerInputRef = useRef(null);
  const footerInputRef = useRef(null);

  const config = useMemo(() => ({
    readonly: false,
    height: 'auto',
    width: '100%',
    toolbarAdaptive: false,
    buttons: [
      'bold', 'italic', 'underline', 'strikethrough', '|',
      'font', 'fontsize', 'brush', 'paragraph', '|',
      'image', 'table', 'link', '|',
      'align', 'undo', 'redo', 'hr', 'eraser'
    ],
    uploader: { insertImageAsBase64URI: true }
  }), []);

  const getBase64 = (src) => new Promise((resolve) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.src = src;
    img.onload = () => {
      const canvas = document.createElement('canvas');
      canvas.width = img.naturalWidth;
      canvas.height = img.naturalHeight;
      const ctx = canvas.getContext('2d');
      ctx.drawImage(img, 0, 0);
      resolve(canvas.toDataURL('image/png'));
    };
    img.onerror = () => resolve(null);
  });

  useEffect(() => {
    const loadDefaultImages = async () => {
      if (!headerBase64) setHeaderBase64(await getBase64(DEFAULT_HEADER_IMG));
      if (!footerBase64) setFooterBase64(await getBase64(DEFAULT_FOOTER_IMG));
    };
    if (isOpen) loadDefaultImages();
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) {
      setIsInitialized(false);
      setContent('');
      return;
    }
    if (isInitialized) return;

    const buildInitialHtml = async () => {
      const renderCheckbox = (label, isChecked) => `
        <div style="display: flex; align-items: center; margin-right: 30px; font-size: 13px; font-weight: bold; margin-bottom: 8px;">
          <div style="display: flex; justify-content: center; align-items: center; width: 14px; height: 14px; border: 1.5px solid black; margin-right: 8px; font-size: 14px; flex-shrink: 0;">
            ${isChecked ? '✓' : ''}
          </div>
          ${label}
        </div>
      `;

      const getObjectiveChecked = (val) => proposalDetails.objectives?.includes(val);

      const formatTime = (t) => {
        if (!t || t === 'TBD') return 'TBD';
        try {
          const [h, m] = t.split(':');
          let hours = parseInt(h, 10);
          const suffix = hours >= 12 ? 'PM' : 'AM';
          hours = hours % 12 || 12;
          return `${hours}:${m} ${suffix}`;
        } catch (e) { return t; }
      };

      const formatDuration = (mins) => {
        if (!mins) return '—';
        const h = Math.floor(mins / 60);
        const m = mins % 60;
        let res = [];
        if (h > 0) res.push(`${h} hour${h > 1 ? 's' : ''}`);
        if (m > 0) res.push(`${m} minute${m > 1 ? 's' : ''}`);
        return res.join(' and ') || '—';
      };

      const initialHtml = `
        <style>
          .form-row { display: flex; align-items: flex-end; margin-bottom: 18px; }
          .form-label { font-weight: bold; font-size: 13px; margin-right: 5px; white-space: nowrap; }
          .form-line { flex-grow: 1; border-bottom: 2px solid black; min-height: 16px; font-size: 13px; font-weight: bold; padding-bottom: 2px; text-align: center; }
          .section-title { font-weight: bold; font-size: 13px; margin-top: 20px; margin-bottom: 12px; }
        </style>
        <div style="padding: 30px 50px; font-family: Arial, Helvetica, sans-serif; color: black; background: white; font-size: 13px;">
          <div style="text-align: center; font-size: 16px; font-weight: bold; margin-bottom: 35px;">Activity Proposal Form</div>
          
          <div class="form-row">
            <div class="form-label">Name of Student Organization:</div>
            <div class="form-line">${proposalDetails.organization_name || ''}</div>
          </div>
          <div class="form-row">
            <div class="form-label">Name of Adviser:</div>
            <div class="form-line">${proposalDetails.adviser_name || ''}</div>
          </div>
          <div class="form-row">
            <div class="form-label">Activity Number:</div>
            <div class="form-line">${proposalDetails.activity_number || proposalDetails.tracking_number || ''}</div>
          </div>
          <div class="form-row">
            <div class="form-label">Activity Title:</div>
            <div class="form-line">${proposalDetails.activity_title || ''}</div>
          </div>
          <div class="form-row">
            <div class="form-label">Name of Person-in-Charge:</div>
            <div class="form-line" style="flex-grow: 0.6; margin-right: 15px;">${proposalDetails.person_in_charge || ''}</div>
            <div class="form-label">Student ID No.:</div>
            <div class="form-line">${proposalDetails.student_id_no || ''}</div>
          </div>
          <div class="form-row">
            <div class="form-label">Contact Number of Person-in-Charge:</div>
            <div class="form-line">${proposalDetails.contact_number || ''}</div>
          </div>
          <div class="form-row">
            <div class="form-label">Target Venue:</div>
            <div class="form-line">${proposalDetails.target_venue || ''}</div>
          </div>
          <div class="form-row">
            <div class="form-label">Target Date and Time:</div>
            <div class="form-line">
              ${(proposalDetails.schedules && proposalDetails.schedules.length > 0) ? proposalDetails.schedules.map(sched => {
                const startStr = sched.activity_date ? new Date(sched.activity_date).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' }) : 'TBD';
                if (sched.end_date) {
                  const endStr = new Date(sched.end_date).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
                  return `${startStr} – ${endStr}`;
                }
                return `${startStr} — ${formatTime(sched.start_time)} – ${sched.is_indefinite ? 'INDEFINITE' : formatTime(sched.end_time)}`;
              }).join(' | ') : '—'}
            </div>
          </div>

          <div class="form-row">
            <div class="form-label">Number of Student Involved:</div>
            <div class="form-line">${proposalDetails.number_of_students || ''}</div>
          </div>

          <div class="section-title">Target Audience/Participants:</div>
          <div style="margin-left: 20px; margin-bottom: 20px; display: flex;">
            ${renderCheckbox('Members only', proposalDetails.target_audience === 'Members only')}
            ${renderCheckbox('BulSUans only', proposalDetails.target_audience === 'BulSUans only')}
            ${renderCheckbox('Open to the public', proposalDetails.target_audience === 'Open to the public')}
          </div>

          <div class="section-title">Nature of Activity:</div>
          <div style="margin-left: 20px; margin-bottom: 20px; display: flex;">
            ${renderCheckbox('Co-Curricular', proposalDetails.nature_of_activity === 'Co-Curricular')}
            ${renderCheckbox('Extra-Curricular', proposalDetails.nature_of_activity === 'Extra-Curricular')}
          </div>

          <div class="section-title">Objectives of the Activity:</div>
          <div style="margin-left: 20px; margin-bottom: 25px; display: flex; flex-direction: column;">
            ${renderCheckbox('Leadership Development and Formation', getObjectiveChecked('Leadership Development and Formation'))}
            ${renderCheckbox('Membership Development and Formation', getObjectiveChecked('Membership Development and Formation'))}
            ${renderCheckbox('Organizational Program Management', getObjectiveChecked('Organizational Program Management'))}
            ${renderCheckbox('Values Enrichment', getObjectiveChecked('Values Enrichment'))}
            ${renderCheckbox('Skills Enhancement', getObjectiveChecked('Skills Enhancement'))}
            <div class="form-row" style="margin-top: 5px; margin-bottom: 0;">
              ${renderCheckbox('Others:', getObjectiveChecked('Others'))}
              <div class="form-line" style="margin-left: -20px; text-align: left;">${proposalDetails.others_objective || ''}</div>
            </div>
          </div>

          <div style="font-size: 12px; margin-left: 40px; margin-top: 35px; margin-bottom: 25px;">
            Describe how this activity will satisfy the needs of the organization and how it will help the<br/>organization achieve its goals:
          </div>
          <div class="form-row" style="margin-left: 40px;"><div class="form-label">1.</div><div class="form-line" style="text-align: left;">${proposalDetails.satisfaction_goal_1 || ''}</div></div>
          <div class="form-row" style="margin-left: 40px;"><div class="form-label">2.</div><div class="form-line" style="text-align: left;">${proposalDetails.satisfaction_goal_2 || ''}</div></div>
          <div class="form-row" style="margin-left: 40px;"><div class="form-label">3.</div><div class="form-line" style="text-align: left;">${proposalDetails.satisfaction_goal_3 || ''}</div></div>

          <div style="margin-top: 50px; border-top: 1px solid #ccc; padding-top: 30px;">
            <div class="form-row">
              <div class="form-label">Name of Partners (if any):</div>
              <div class="form-line" style="text-align: left;">${proposalDetails.partners || ''}</div>
            </div>
            <div class="form-row">
              <div class="form-label">Name of Sponsors (if any):</div>
              <div class="form-line" style="text-align: left;">${proposalDetails.sponsors || ''}</div>
            </div>
          </div>

          <div style="display: flex; justify-content: space-between; margin-top: 60px;">
            <div style="width: 40%; text-align: center;">
              <div style="border-bottom: 1.5px solid black; height: 20px; font-size: 13px; font-weight: bold; margin-bottom: 5px; text-transform: uppercase;">
                ${proposalDetails.person_in_charge || user?.full_name || ''}
              </div>
              <div style="font-size: 10px; font-style: italic;">(Signature over printed name)</div>
              <div style="font-size: 12px; margin-top: 5px;">President, ${proposalDetails.organization_name || 'Student Organization'}</div>
            </div>
            <div style="width: 40%; text-align: center;">
              <div style="border-bottom: 1.5px solid black; height: 20px; font-size: 13px; font-weight: bold; margin-bottom: 5px; text-transform: uppercase;">
                ${proposalDetails.adviser_name || ''}
              </div>
              <div style="font-size: 10px; font-style: italic;">(Signature over printed name)</div>
              <div style="font-size: 12px; margin-top: 5px;">Adviser, ${proposalDetails.organization_name || 'Student Organization'}</div>
            </div>
          </div>

        </div>
      `;

      setContent(initialHtml);
      setIsInitialized(true);
    };

    buildInitialHtml();
  }, [isOpen, isInitialized, proposalDetails, user]);

  if (!isOpen) return null;

  const handleImageUpload = (e, type) => {
    const file = e.target.files[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        if (type === 'header') setHeaderBase64(reader.result);
        if (type === 'footer') setFooterBase64(reader.result);
      };
      reader.readAsDataURL(file);
    }
  };

  const handlePrint = () => {
    const printIframe = document.createElement('iframe');
    printIframe.style.position = 'absolute';
    printIframe.style.width = '0px';
    printIframe.style.height = '0px';
    printIframe.style.border = 'none';
    document.body.appendChild(printIframe);

    const doc = printIframe.contentWindow.document;
    doc.open();
    doc.write(`
      <html>
        <head>
          <title>Activity Proposal Form</title>
          <style>
            @media print {
              body { margin: 0; padding: 0; background: white; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
              @page { margin: 0; size: auto; }
              thead { display: table-header-group; }
              tfoot { display: table-footer-group; }
              table { width: 100%; border-collapse: collapse; border: none; }
              img { max-width: 100% !important; }
              .fixed-header { position: fixed; top: 0; left: 0; width: 100%; z-index: 1000; }
              .fixed-footer { position: fixed; bottom: 0; left: 0; width: 100%; z-index: 1000; }
            }
            body { font-family: Arial, Helvetica, sans-serif; color: black; background: white; margin: 0; font-size: 13px; }
            .form-row { display: flex; align-items: flex-end; margin-bottom: 18px; }
            .form-label { font-weight: bold; font-size: 13px; margin-right: 5px; white-space: nowrap; }
            .form-line { flex-grow: 1; border-bottom: 2px solid black; min-height: 16px; font-size: 13px; font-weight: bold; padding-bottom: 2px; text-align: center; }
            .section-title { font-weight: bold; font-size: 13px; margin-top: 20px; margin-bottom: 12px; }
          </style>
        </head>
        <body>
          <div class="fixed-header">
            <img src="${headerBase64}" style="width: 100%; display: block; max-height: 160px; object-fit: fill;" alt="Header" />
          </div>
          <div class="fixed-footer">
            <img src="${footerBase64}" style="width: 100%; display: block; max-height: 120px; object-fit: fill;" alt="Footer" />
          </div>
          <table style="width: 100%; border-collapse: collapse; border: none; background: transparent;">
            <thead>
              <tr><td style="border: none; padding: 0;">
                <div style="height: 160px;"></div>
              </td></tr>
            </thead>
            <tbody>
              <tr><td style="border: none; padding: 0;">
                ${content}
              </td></tr>
            </tbody>
            <tfoot>
              <tr><td style="border: none; padding: 0;">
                <div style="height: 120px;"></div>
              </td></tr>
            </tfoot>
          </table>
        </body>
      </html>
    `);
    doc.close();

    printIframe.contentWindow.focus();
    setTimeout(() => {
      printIframe.contentWindow.print();
      setTimeout(() => {
        document.body.removeChild(printIframe);
      }, 2000);
    }, 500);
  };

  return (
    <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[100] flex items-center justify-center p-4 md:p-6 animate-in fade-in duration-300">
      <div className="bg-white rounded-3xl w-full max-w-5xl h-[90vh] flex flex-col shadow-2xl overflow-hidden shadow-black/20">
        
        {/* Header */}
        <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between bg-white shrink-0 relative z-10">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-blue-50 flex items-center justify-center text-blue-600">
              <Edit3 size={20} />
            </div>
            <div>
              <h2 className="text-lg font-extrabold text-gray-900 tracking-tight">Advanced Document Editor</h2>
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-widest mt-0.5">Edit Layout & Content</p>
            </div>
          </div>
          <button 
            onClick={onClose}
            className="w-10 h-10 rounded-full flex items-center justify-center text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors"
          >
            <X size={20} />
          </button>
        </div>

        {/* Toolbar */}
        <div className="px-6 py-3 border-b border-gray-100 bg-gray-50/50 flex flex-wrap items-center gap-4 shrink-0 relative z-10">
          <div className="hidden">
            <input 
              type="file" 
              ref={headerInputRef} 
              className="hidden" 
              accept="image/*"
              onChange={(e) => handleImageUpload(e, 'header')}
            />
            <input 
              type="file" 
              ref={footerInputRef} 
              className="hidden" 
              accept="image/*"
              onChange={(e) => handleImageUpload(e, 'footer')}
            />
          </div>
          <div className="flex-1"></div>
          
          <button 
            onClick={handlePrint}
            className="flex items-center gap-2 px-5 py-2 bg-primary-green hover:bg-green-700 text-white rounded-xl text-sm font-bold shadow-md shadow-green-600/20 transition-all active:scale-95"
          >
            <Printer size={16} />
            Print / Save as PDF
          </button>
        </div>

        {/* Editor Area Wrapper */}
        <div className="flex-1 w-full bg-gray-200 overflow-y-auto p-4 md:p-8 custom-scrollbar">
          
          {/* Paper Container */}
          <div 
            className="max-w-[794px] mx-auto min-h-[1123px] flex flex-col relative bg-white"
            style={{
              boxShadow: '0 0 20px rgba(0,0,0,0.15)'
            }}
          >
            
            {/* Visual Header */}
            {headerBase64 && (
              <div 
                className="relative w-full cursor-pointer group"
                onClick={() => headerInputRef.current?.click()}
              >
                <img src={headerBase64} alt="Header" className="w-full max-h-[160px] object-fill block" />
                <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 flex flex-col items-center justify-center transition-opacity text-white">
                  <ImageIcon size={24} className="mb-2" />
                  <span className="font-bold text-sm tracking-wider uppercase">Change Header</span>
                </div>
              </div>
            )}

            {/* Jodit Content (Body) */}
            <div className="flex-1 jodit-seamless-wrapper relative">
              {!isInitialized ? (
                <div className="absolute inset-0 flex items-center justify-center">
                  <div className="w-8 h-8 border-4 border-gray-200 border-t-blue-500 rounded-full animate-spin"></div>
                </div>
              ) : (
                <>
                  <style>{`
                    .jodit-seamless-wrapper .jodit-container {
                      border: none !important;
                    }
                    .jodit-seamless-wrapper .jodit-toolbar__box {
                      position: sticky;
                      top: 0;
                      z-index: 50;
                      box-shadow: 0 2px 10px rgba(0,0,0,0.1);
                    }
                    .jodit-seamless-wrapper .jodit-workplace {
                      background: transparent !important;
                    }
                    .jodit-seamless-wrapper .jodit-wysiwyg {
                      background: transparent !important;
                      padding: 0 !important;
                    }
                  `}</style>
                  <JoditEditor
                    ref={editorRef}
                    value={content}
                    config={config}
                    onBlur={newContent => setContent(newContent)}
                    onChange={() => {}} 
                  />
                </>
              )}
            </div>

            {/* Visual Footer */}
            {footerBase64 && (
              <div 
                className="relative w-full cursor-pointer group mt-auto"
                onClick={() => footerInputRef.current?.click()}
              >
                <img src={footerBase64} alt="Footer" className="w-full max-h-[120px] object-fill block" />
                <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 flex flex-col items-center justify-center transition-opacity text-white">
                  <ImageIcon size={24} className="mb-2" />
                  <span className="font-bold text-sm tracking-wider uppercase">Change Footer</span>
                </div>
              </div>
            )}

          </div>
        </div>

      </div>
    </div>
  );
};

export default ActivityProposalPreviewModal;
