import React, { useEffect, useState } from 'react';
import { X, Printer, Download } from 'lucide-react';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import HEADER_IMG from '../assets/HEADER.png';
import FOOTER_IMG from '../assets/FOOTER.png';

const AccomplishmentReportPreviewModal = ({
  isOpen,
  onClose,
  submission,
  accomplishmentReport,
  proofImages = [],
  schoolYear = ''
}) => {
  const [headerBase64, setHeaderBase64] = useState(null);
  const [footerBase64, setFooterBase64] = useState(null);
  const [preloadedImages, setPreloadedImages] = useState([]);
  const [pdfUrl, setPdfUrl] = useState(null);

  // Convert Header/Footer and proofs to Base64
  useEffect(() => {
    if (!isOpen) return;

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

    const initImages = async () => {
      const hBase64 = await getBase64(HEADER_IMG);
      const fBase64 = await getBase64(FOOTER_IMG);
      setHeaderBase64(hBase64);
      setFooterBase64(fBase64);

      if (proofImages && proofImages.length > 0) {
        const loaded = await Promise.all(
          proofImages.map(async (img) => {
            if (!img.file_url && !img.url) return null;
            const b64 = await getBase64(img.file_url || img.url);
            return { base64: b64, name: img.file_name || img.name || 'Proof Image' };
          })
        );
        setPreloadedImages(loaded.filter(Boolean));
      } else {
        setPreloadedImages([]);
      }
    };
    initImages();
  }, [isOpen, proofImages]);

  useEffect(() => {
    if (isOpen && headerBase64 && footerBase64) {
      generatePDF(true); // render for preview
    }
  }, [isOpen, headerBase64, footerBase64, preloadedImages]);

  if (!isOpen) return null;

  const generatePDF = (isPreview = false) => {
    const doc = new jsPDF({
      orientation: 'portrait',
      unit: 'mm',
      format: 'a4'
    });

    const pageWidth = doc.internal.pageSize.width;
    const pageHeight = doc.internal.pageSize.height;

    // Approximate header/footer sizes based on typical A4
    const headerW = pageWidth;
    const headerH = headerW * 0.17; // approx aspect ratio
    const footerW = pageWidth;
    const footerH = footerW * 0.11; 

    const drawHeaderFooter = () => {
      if (headerBase64) doc.addImage(headerBase64, 'PNG', 0, 0, headerW, headerH);
      if (footerBase64) doc.addImage(footerBase64, 'PNG', 0, pageHeight - footerH, footerW, footerH);
    };

    drawHeaderFooter();

    let currentY = headerH + 10;

    doc.setFont('times', 'bold');
    doc.setFontSize(10);
    doc.setTextColor(0, 0, 0);
    doc.text('STUDENT ORGANIZATIONS-EXTERNAL CAMPUS ACCOMPLISHMENT REPORT', pageWidth / 2, currentY, { align: 'center' });
    currentY += 5;
    
    const sy = schoolYear || submission?.school_years?.name || '2025-2026';
    doc.text(`FOR S.Y. ${sy}`, pageWidth / 2, currentY, { align: 'center' });
    currentY += 12;

    const details = Array.isArray(submission?.submission_versions?.[0]?.activity_proposal_details)
      ? submission?.submission_versions[0].activity_proposal_details[0]
      : submission?.submission_versions?.[0]?.activity_proposal_details || {};
      
    const orgName = details?.organization_name || submission?.users?.org_name || 'Organization Name';
    
    doc.setFont('times', 'bold');
    doc.text(orgName.toUpperCase(), pageWidth / 2, currentY, { align: 'center' });
    const orgWidth = doc.getTextWidth(orgName.toUpperCase());
    doc.setLineWidth(0.3);
    // Underline perfectly centered
    doc.line((pageWidth - orgWidth) / 2, currentY + 1, (pageWidth + orgWidth) / 2, currentY + 1);
    
    currentY += 6;
    doc.setFont('times', 'normal');
    doc.text('Name of Organization', pageWidth / 2, currentY, { align: 'center' });
    currentY += 10;

    const formatList = (val) => {
      if (!val) return '';
      try {
        const parsed = JSON.parse(val);
        if (Array.isArray(parsed)) return parsed.map(v => `• ${v}`).join('\n');
      } catch(e) {}
      if (Array.isArray(val)) return val.map(v => `• ${v}`).join('\n');
      return String(val).split('\n').map(l => {
        const trimmed = l.trim();
        if (!trimmed) return '';
        return trimmed.startsWith('•') || trimmed.startsWith('-') ? trimmed : `• ${trimmed}`;
      }).filter(Boolean).join('\n');
    };

    const targetDateStr = details?.target_date ? new Date(details.target_date).toLocaleDateString('en-US', { year: '2-digit', month: '2-digit', day: '2-digit' }) : '';
    const targetTime = details?.target_time || '';
    const place = 'Bulacan State University - Bustos Campus';
    const dateTimePlace = [targetDateStr, targetTime, place].filter(Boolean).join(', ');

    let actNoDisplay = '';
    if (details?.activity_number) {
      let lastTwo = String(details.activity_number).slice(-2);
      if (lastTwo.length === 2 && lastTwo.startsWith('0')) {
        lastTwo = lastTwo.substring(1);
      }
      actNoDisplay = lastTwo;
    }

    const tableData = [
      [`Activity No. ${actNoDisplay}`.trim(), ''],
      ['Name of Activity', details?.activity_title || submission?.documentType?.name || 'Activity'],
      ['Date/Time/Place', dateTimePlace],
      ['Description', formatList(details?.nature_of_activity || details?.satisfy_needs)],
      ['Objective/s', formatList(details?.objectives || details?.satisfy_goals)],
      ['Participants (College/Unit & Year Level)', accomplishmentReport?.participants || ''],
      ['Benefiting Group', accomplishmentReport?.benefiting_group || ''],
      ['Resources Used', accomplishmentReport?.resources_used || ''],
      ['Co-sponsor (If any)', details?.sponsors || 'N/A'],
      ['Problem Encountered', accomplishmentReport?.problems_encountered || 'N/A']
    ];

    autoTable(doc, {
      startY: currentY,
      body: tableData,
      theme: 'grid',
      styles: {
        font: 'times',
        fontSize: 10,
        textColor: [0, 0, 0],
        lineColor: [0, 0, 0],
        lineWidth: 0.3,
        valign: 'middle'
      },
      columnStyles: {
        0: { fontStyle: 'bold', cellWidth: 50 },
        1: { cellWidth: 'auto' }
      },
      margin: { left: 15, right: 15, bottom: footerH + 10 },
      didDrawPage: (data) => {
        if (data.pageNumber > 1) {
          drawHeaderFooter();
        }
      }
    });

    currentY = doc.lastAutoTable.finalY + 15;

    // Render Proof Images
    if (preloadedImages && preloadedImages.length > 0) {
      preloadedImages.forEach((imgObj, idx) => {
        const imgWidth = 140; 
        const imgHeight = 90;
        
        if (currentY + imgHeight > pageHeight - footerH) {
          doc.addPage();
          drawHeaderFooter();
          currentY = headerH + 10;
        }

        if (imgObj && imgObj.base64) {
          doc.addImage(imgObj.base64, 'JPEG', (pageWidth - imgWidth) / 2, currentY, imgWidth, imgHeight);
          currentY += imgHeight + 10;
        }
      });
    }

    if (isPreview) {
      const pdfBlobUrl = doc.output('bloburl');
      setPdfUrl(pdfBlobUrl);
    } else {
      const filename = `Accomplishment_Report_${submission?.id || 'doc'}.pdf`;
      doc.save(filename);
    }
  };

  return (
    <div className="fixed inset-0 bg-slate-900/80 z-[100] flex items-center justify-center p-4 backdrop-blur-sm" onClick={onClose}>
      <div className="bg-white rounded-3xl max-w-5xl w-full h-[90vh] shadow-2xl border border-gray-100 overflow-hidden flex flex-col" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between border-b border-gray-100 px-6 py-4 flex-none">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-blue-50 text-blue-600 rounded-xl flex items-center justify-center">
              <Printer size={20} />
            </div>
            <div>
              <h3 className="text-lg font-bold text-gray-800">Accomplishment Report Preview</h3>
              <p className="text-xs font-medium text-gray-500">Official Format</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={() => generatePDF(false)} className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-xl text-sm font-bold transition-all">
              <Download size={16} />
              Download PDF
            </button>
            <button onClick={onClose} className="rounded-full p-2 text-gray-400 hover:bg-gray-100 transition-colors">
              <X size={20} />
            </button>
          </div>
        </div>
        <div className="p-6 bg-gray-50 flex-1 w-full relative">
          {pdfUrl ? (
            <div className="absolute inset-6">
              <iframe src={pdfUrl} title="PDF Preview" className="w-full h-full rounded-xl shadow-sm border border-gray-200 bg-white" />
            </div>
          ) : (
            <div className="text-gray-400 text-sm h-full flex items-center justify-center">Generating Preview...</div>
          )}
        </div>
      </div>
    </div>
  );
};

export default AccomplishmentReportPreviewModal;
