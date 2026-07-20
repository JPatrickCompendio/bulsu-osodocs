import React, { useEffect, useState, useRef, useMemo } from 'react';
import { X, Printer, Edit3, Image as ImageIcon } from 'lucide-react';
import JoditEditor from 'jodit-react';
import DEFAULT_HEADER_IMG from '../assets/HEADER.png';
import DEFAULT_FOOTER_IMG from '../assets/FOOTER.png';

const AccomplishmentReportPreviewModal = ({
  isOpen,
  onClose,
  submission,
  accomplishmentReport,
  proofImages = [],
  schoolYear = ''
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
      let proofsHtml = '';
      if (proofImages && proofImages.length > 0) {
        const loadedProofs = await Promise.all(
          proofImages.map(async (img) => {
            if (!img.file_url && !img.url) return null;
            const b64 = await getBase64(img.file_url || img.url);
            return b64 ? `<div style="margin-bottom: 20px;"><img src="${b64}" class="default-center-img" style="max-width: 80%; max-height: 400px; object-fit: contain;" /></div>` : '';
          })
        );
        proofsHtml = loadedProofs.filter(Boolean).join('');
      }

      const subtypeName = submission?.document_subtypes?.name || 'MAIN CAMPUS';
      const sy = schoolYear || submission?.school_years?.name || '2025-2026';
      const cleanSy = sy.replace(/S\.Y\.\s*/ig, '').replace(/S\.Y\s*/ig, '').trim();

      const details = Array.isArray(submission?.submission_versions?.[0]?.activity_proposal_details)
        ? submission?.submission_versions[0].activity_proposal_details[0]
        : submission?.submission_versions?.[0]?.activity_proposal_details || {};

      const orgName = details?.organization_name || submission?.users?.org_name || 'Organization Name';

      let actNoDisplay = '';
      if (submission?.tracking_number) {
        actNoDisplay = submission.tracking_number;
      }

      const formatList = (val) => {
        if (!val) return '';
        try {
          const parsed = JSON.parse(val);
          if (Array.isArray(parsed)) return parsed.map(v => `<li>${v}</li>`).join('');
        } catch (e) { }
        if (Array.isArray(val)) return val.map(v => `<li>${v}</li>`).join('');
        return `<ul>` + String(val).split('\n').map(l => {
          const trimmed = l.trim();
          if (!trimmed) return '';
          return `<li>${trimmed.replace(/^[•-]\s*/, '')}</li>`;
        }).filter(Boolean).join('') + `</ul>`;
      };

      let dateStrings = [];
      if (details?.activity_schedules && details.activity_schedules.length > 0) {
        dateStrings = details.activity_schedules.map(sched => {
          const d = new Date(sched.activity_date).toLocaleDateString('en-US', { year: '2-digit', month: '2-digit', day: '2-digit' });
          if (sched.end_date) {
            const e = new Date(sched.end_date).toLocaleDateString('en-US', { year: '2-digit', month: '2-digit', day: '2-digit' });
            return `${d} – ${e}`;
          }
          const t = `${sched.start_time} - ${sched.is_indefinite ? 'Indefinite' : sched.end_time}`;
          return `${d} ${t}`;
        });
      } else if (details?.target_date) {
        const targetDateStr = new Date(details.target_date).toLocaleDateString('en-US', { year: '2-digit', month: '2-digit', day: '2-digit' });
        const targetTime = details?.target_time || '';
        if (targetDateStr) {
          dateStrings.push([targetDateStr, targetTime].filter(Boolean).join(', '));
        }
      }

      const place = 'Bulacan State University - Bustos Campus';
      const dateTimePlace = dateStrings.length > 0 ? dateStrings.join(' | ') + ', ' + place : place;

      const initialHtml = `
        <div style="padding: 30px 40px;">
          <div style="text-align: center; font-family: 'Times New Roman', Times, serif; font-size: 14px; margin-bottom: 20px;">
            <strong>STUDENT ORGANIZATIONS-${subtypeName.toUpperCase()} ACCOMPLISHMENT REPORT</strong><br/>
            FOR S.Y. ${cleanSy}<br/><br/>
            <strong style="text-decoration: underline;">${orgName.toUpperCase()}</strong><br/>
            Name of Organization
          </div>
          
          <table style="width: 100%; border-collapse: collapse; border: 1px solid black; font-family: 'Times New Roman', Times, serif; font-size: 13px;">
            <tbody>
              <tr>
                <td style="border: 1px solid black; padding: 8px; width: 35%; font-weight: bold;">Activity No. ${actNoDisplay}</td>
                <td style="border: 1px solid black; padding: 8px; width: 65%;"></td>
              </tr>
              <tr>
                <td style="border: 1px solid black; padding: 8px; font-weight: bold;">Name of Activity</td>
                <td style="border: 1px solid black; padding: 8px;">${details?.activity_title || submission?.documentType?.name || 'Activity'}</td>
              </tr>
              <tr>
                <td style="border: 1px solid black; padding: 8px; font-weight: bold;">Date/Time/Place</td>
                <td style="border: 1px solid black; padding: 8px;">${dateTimePlace}</td>
              </tr>
              <tr>
                <td style="border: 1px solid black; padding: 8px; font-weight: bold;">Description</td>
                <td style="border: 1px solid black; padding: 8px;">${formatList(details?.nature_of_activity || details?.satisfy_needs)}</td>
              </tr>
              <tr>
                <td style="border: 1px solid black; padding: 8px; font-weight: bold;">Objective/s</td>
                <td style="border: 1px solid black; padding: 8px;">${formatList(details?.objectives || details?.satisfy_goals)}</td>
              </tr>
              <tr>
                <td style="border: 1px solid black; padding: 8px; font-weight: bold;">Participants (College/Unit & Year Level)</td>
                <td style="border: 1px solid black; padding: 8px;">${accomplishmentReport?.participants || ''}</td>
              </tr>
              <tr>
                <td style="border: 1px solid black; padding: 8px; font-weight: bold;">Benefiting Group</td>
                <td style="border: 1px solid black; padding: 8px;">${accomplishmentReport?.benefiting_group || ''}</td>
              </tr>
              <tr>
                <td style="border: 1px solid black; padding: 8px; font-weight: bold;">Resources Used</td>
                <td style="border: 1px solid black; padding: 8px;">${accomplishmentReport?.resources_used || ''}</td>
              </tr>
              <tr>
                <td style="border: 1px solid black; padding: 8px; font-weight: bold;">Co-sponsor (If any)</td>
                <td style="border: 1px solid black; padding: 8px;">${details?.sponsors || 'N/A'}</td>
              </tr>
              <tr>
                <td style="border: 1px solid black; padding: 8px; font-weight: bold;">Problem Encountered</td>
                <td style="border: 1px solid black; padding: 8px;">${accomplishmentReport?.problems_encountered || 'N/A'}</td>
              </tr>
            </tbody>
          </table>
          <br/>
          <div style="text-align: center; font-weight: bold; font-family: 'Times New Roman', Times, serif; font-size: 14px; margin-top: 30px; margin-bottom: 20px;">
            PROOF OF ACTIVITY IMPLEMENTATION
          </div>
          ${proofsHtml}
        </div>
      `;

      setContent(initialHtml);
      setIsInitialized(true);
    };

    buildInitialHtml();
  }, [isOpen, isInitialized, submission, accomplishmentReport, schoolYear, proofImages]);

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
          <title>Accomplishment Report Document</title>
          <style>
            @media print {
              body { margin: 0; padding: 0; background: white; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
              @page { margin: 0; size: auto; }
              thead { display: table-header-group; }
              tfoot { display: table-footer-group; }
              table { width: 100%; border-collapse: collapse; border: none; }
              img { max-width: 100% !important; }
            }
            body { font-family: 'Times New Roman', Times, serif; color: black; background: white; margin: 0; }
            .default-center-img { display: block; margin: 0 auto; }
          </style>
        </head>
        <body>
          <table style="width: 100%; border-collapse: collapse; border: none; background: white;">
            <thead>
              <tr><td style="border: none; padding: 0;">
                <img src="${headerBase64}" style="width: 100%; display: block; max-height: 160px; object-fit: fill;" alt="Header" />
              </td></tr>
            </thead>
            <tbody>
              <tr><td style="border: none; padding: 0;">
                ${content}
              </td></tr>
            </tbody>
            <tfoot>
              <tr><td style="border: none; padding: 0;">
                <img src="${footerBase64}" style="width: 100%; display: block; max-height: 120px; object-fit: fill;" alt="Footer" />
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
    <div
      className="fixed inset-0 bg-slate-900/80 z-[100] flex items-center justify-center p-4 backdrop-blur-sm"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="bg-white rounded-3xl max-w-[1000px] w-full h-[95vh] shadow-2xl border border-gray-100 overflow-hidden flex flex-col" onClick={e => e.stopPropagation()}>

        {/* Header */}
        <div className="flex items-center justify-between border-b border-gray-100 px-6 py-4 flex-none bg-white z-10">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-blue-50 text-blue-600 rounded-xl flex items-center justify-center">
              <Edit3 size={20} />
            </div>
            <div>
              <h3 className="text-lg font-bold text-gray-800">Advanced Document Editor</h3>
              <p className="text-xs font-medium text-gray-500">Hover over Header/Footer to change images</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={handlePrint} className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-5 py-2.5 rounded-xl text-sm font-bold transition-all shadow-sm hover:shadow-md">
              <Printer size={16} />
              Print / Save as PDF
            </button>
            <button onClick={onClose} className="rounded-full p-2 text-gray-400 hover:bg-gray-100 transition-colors ml-2">
              <X size={20} />
            </button>
          </div>
        </div>

        {/* Editor Area Wrapper */}
        <div className="flex-1 w-full bg-gray-200 overflow-y-auto p-4 md:p-8 custom-scrollbar">

          <input type="file" ref={headerInputRef} accept="image/*" className="hidden" onChange={e => handleImageUpload(e, 'header')} />
          <input type="file" ref={footerInputRef} accept="image/*" className="hidden" onChange={e => handleImageUpload(e, 'footer')} />

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
                onClick={() => headerInputRef.current.click()}
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
                    /* Hide the image properties (pencil) button in popups */
                    button[aria-label="Image properties"],
                    button[aria-label="Image"],
                    .jodit-toolbar-button_image,
                    .jodit-toolbar-button_pencil {
                      display: none !important;
                    }
                    /* Class to natively center images but allow Jodit inline overrides */
                    .default-center-img {
                      display: block;
                      margin: 0 auto;
                    }
                  `}</style>
                  <JoditEditor
                    ref={editorRef}
                    value={content}
                    config={config}
                    onBlur={newContent => setContent(newContent)}
                    onChange={() => { }}
                  />
                </>
              )}
            </div>

            {/* Visual Footer */}
            {footerBase64 && (
              <div
                className="relative w-full cursor-pointer group mt-auto"
                onClick={() => footerInputRef.current.click()}
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

export default AccomplishmentReportPreviewModal;
