import { extractTextFromPdf } from '../services/pdfExtractor';
import React, { useState, useMemo } from 'react';
import { useMedication } from '../context/MedicationContext';
import type { MedDocument } from '../context/MedicationContext';
import { useSettings } from '../context/SettingsContext';
import { useActivePatient } from '../context/RoleContext';
import {
  FileText,
  Calendar,
  User,
  Building,
  Eye,
  Trash2,
  X,
  Search,
  UploadCloud,
} from 'lucide-react';

type DocType = 'prescription' | 'report' | 'summary' | 'all';

export const Documents: React.FC = () => {
  const { documents, addDocument, deleteDocument } = useMedication();
  const { t, language } = useSettings();
  const { isOwnData, isCaregiverViewing } = useActivePatient();
  const canMutate = isOwnData;

  const [isUploading, setIsUploading] = useState(false);
  const [docName, setDocName] = useState('');
  const [doctor, setDoctor] = useState('');
  const [hospital, setHospital] = useState('');
  const [type, setType] = useState<'prescription' | 'report' | 'summary'>('prescription');

  const [previewDoc, setPreviewDoc] = useState<MedDocument | null>(null);

  // Filter / search
  const [searchQuery, setSearchQuery] = useState('');
  const [typeFilter, setTypeFilter] = useState<DocType>('all');

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    console.log('FILE SELECTED:', file);
    if (!file) return;

    setIsUploading(true);
    const reader = new FileReader();

    reader.onload = async (event) => {
      const base64 = event.target?.result as string;
      let extractedText = '';

      if (file.type === 'application/pdf') {
        try {
          extractedText = await extractTextFromPdf(file);
          console.log('PDF TEXT EXTRACTED:', extractedText.substring(0, 500));
        } catch (err) {
          console.error('PDF EXTRACTION FAILED:', err);
        }
      }

      try {
        await addDocument({
          name: docName || file.name.split('.')[0] || 'Medical Document',
          type,
          date: new Date().toISOString().split('T')[0],
          doctor: doctor || 'Dr. Amit Sharma',
          hospital: hospital || 'City Health Clinic',
          medicines: ['Aspirin', 'Paracetamol'],
          fileUrl: base64,
          extractedText,
        });

        setDocName('');
        setDoctor('');
        setHospital('');
      } catch (err) {
        console.error('UPLOAD ERROR:', err);
      } finally {
        setIsUploading(false);
      }
    };

    reader.readAsDataURL(file);
  };

  const filteredDocs = useMemo(() => {
    return documents.filter(d => {
      if (typeFilter !== 'all' && d.type !== typeFilter) return false;
      if (!searchQuery.trim()) return true;
      const q = searchQuery.toLowerCase();
      return (
        d.name.toLowerCase().includes(q) ||
        d.doctor.toLowerCase().includes(q) ||
        d.hospital.toLowerCase().includes(q) ||
        d.medicines.some(m => m.toLowerCase().includes(q))
      );
    });
  }, [documents, searchQuery, typeFilter]);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h2 className="text-xl sm:text-2xl font-bold text-white">
            {language === 'hi' ? 'पर्चे और रिपोर्ट्स' : t.docTitle}
          </h2>
          <p className="text-sm text-navy-700 mt-0.5">
            {language === 'hi'
              ? 'प्रिस्क्रिप्शन और लैब रिपोर्ट्स अपलोड और प्रबंधित करें'
              : 'Upload and manage prescriptions, lab reports, and discharge summaries'}
          </p>
        </div>
      </div>

      {isCaregiverViewing && (
        <div className="card-navy bg-success/[0.04] border-success/25 flex items-start gap-2 py-3">
          <span className="text-[10px] font-bold uppercase tracking-widest text-success mt-0.5">
            Read-only
          </span>
          <span className="text-xs text-navy-100">
            {language === 'hi'
              ? 'आप मरीज़ के दस्तावेज़ देख रहे हैं। केवल मरीज़ ही अपलोड कर सकता है।'
              : "You are viewing a linked patient's documents. Only the patient can upload new files."}
          </span>
        </div>
      )}

      {/* Two-column responsive layout */}
      <div className={`grid grid-cols-1 ${canMutate ? 'lg:grid-cols-5' : ''} gap-5`}>
        {/* ===== LEFT — Upload form (only when the user owns the data) ===== */}
        {canMutate && (
        <div className="lg:col-span-2">
          <div className="card-navy space-y-4 sticky top-20">
            <div>
              <h3 className="text-sm font-bold text-white">
                {language === 'hi' ? 'नया दस्तावेज़ अपलोड करें' : t.uploadDoc}
              </h3>
              <p className="text-[11px] text-navy-700 mt-0.5">
                {language === 'hi'
                  ? 'दस्तावेज़ का विवरण भरें और फ़ाइल चुनें'
                  : 'Fill the details below and pick a file to upload'}
              </p>
            </div>

            <div>
              <label className="block text-[10px] font-bold text-navy-100 mb-1.5 uppercase tracking-widest">
                {language === 'hi' ? 'दस्तावेज़ शीर्षक' : 'Document Label'}
              </label>
              <input
                type="text"
                value={docName}
                onChange={(e) => setDocName(e.target.value)}
                placeholder="e.g. AIIMS Cardiology Prescription"
                className="w-full bg-navy-950 border border-navy-800 rounded-card py-2.5 px-3 text-sm text-white outline-none focus:border-accent"
              />
            </div>

            <div>
              <label className="block text-[10px] font-bold text-navy-100 mb-1.5 uppercase tracking-widest">
                {language === 'hi' ? 'प्रकार' : 'Type'}
              </label>
              <select
                value={type}
                onChange={(e) => setType(e.target.value as any)}
                className="w-full bg-navy-950 border border-navy-800 rounded-card py-2.5 px-3 text-sm text-white outline-none focus:border-accent cursor-pointer"
              >
                <option value="prescription">Prescription पर्चा</option>
                <option value="report">Lab Report लैब रिपोर्ट</option>
                <option value="summary">Discharge Summary डिस्चार्ज</option>
              </select>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-[10px] font-bold text-navy-100 mb-1.5 uppercase tracking-widest">
                  {language === 'hi' ? 'डॉक्टर का नाम' : 'Doctor Name'}
                </label>
                <input
                  type="text"
                  value={doctor}
                  onChange={(e) => setDoctor(e.target.value)}
                  placeholder="Dr. Amit Sharma"
                  className="w-full bg-navy-950 border border-navy-800 rounded-card py-2.5 px-3 text-sm text-white outline-none focus:border-accent"
                />
              </div>
              <div>
                <label className="block text-[10px] font-bold text-navy-100 mb-1.5 uppercase tracking-widest">
                  {language === 'hi' ? 'अस्पताल / लैब' : 'Hospital / Lab'}
                </label>
                <input
                  type="text"
                  value={hospital}
                  onChange={(e) => setHospital(e.target.value)}
                  placeholder="City Health Clinic"
                  className="w-full bg-navy-950 border border-navy-800 rounded-card py-2.5 px-3 text-sm text-white outline-none focus:border-accent"
                />
              </div>
            </div>

            {/* File drop zone */}
            <label className="w-full flex flex-col items-center justify-center border-2 border-dashed border-navy-800 bg-navy-950 py-7 rounded-card cursor-pointer hover:border-accent/50 hover:bg-navy-900 transition-all text-sm text-navy-100 tactile-btn">
              {isUploading ? (
                <>
                  <div className="w-7 h-7 border-2 border-accent border-t-transparent rounded-full animate-spin mb-2"></div>
                  <span className="font-bold text-white">Uploading…</span>
                </>
              ) : (
                <>
                  <UploadCloud size={28} className="text-accent mb-2" />
                  <span className="font-bold text-white">
                    {language === 'hi' ? 'फ़ाइल चुनें या ड्रैग करें' : 'Click or drop file here'}
                  </span>
                  <span className="text-[11px] text-navy-700 mt-1">PDF, JPG, PNG</span>
                </>
              )}
              <input
                type="file"
                accept="image/*,application/pdf"
                onChange={handleUpload}
                className="hidden"
              />
            </label>

            <div className="bg-accent/5 border border-accent/15 rounded-card p-3 flex items-start gap-2">
              <FileText size={14} className="text-accent mt-0.5 shrink-0" />
              <p className="text-[11px] text-navy-100 leading-relaxed">
                {language === 'hi'
                  ? 'अपलोड किए गए दस्तावेज़ को आप AI सहायक से किसी भी समय पूछ सकते हैं।'
                  : 'You can ask the AI Assistant about any uploaded document at any time.'}
              </p>
            </div>
          </div>
        </div>
        )}

        {/* ===== RIGHT — Filter + list ===== */}
        <div className={`${canMutate ? 'lg:col-span-3' : ''} space-y-4`}>
          {/* Filter bar */}
          <div className="card-navy flex flex-col sm:flex-row gap-3">
            <div className="relative flex-1">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-navy-700" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder={
                  language === 'hi'
                    ? 'नाम, डॉक्टर, अस्पताल खोजें…'
                    : 'Search by name, doctor, hospital…'
                }
                className="w-full bg-navy-950 border border-navy-800 rounded-card py-2.5 pl-9 pr-3 text-sm text-white outline-none focus:border-accent"
              />
            </div>
            <select
              value={typeFilter}
              onChange={(e) => setTypeFilter(e.target.value as DocType)}
              className="bg-navy-950 border border-navy-800 rounded-card py-2.5 px-3 text-sm text-white outline-none focus:border-accent cursor-pointer min-w-[140px]"
            >
              <option value="all">{language === 'hi' ? 'सभी' : 'All Types'}</option>
              <option value="prescription">{language === 'hi' ? 'प्रिस्क्रिप्शन' : 'Prescription'}</option>
              <option value="report">{language === 'hi' ? 'लैब रिपोर्ट' : 'Lab Report'}</option>
              <option value="summary">{language === 'hi' ? 'डिस्चार्ज' : 'Discharge'}</option>
            </select>
          </div>

          {/* Documents list */}
          {filteredDocs.length === 0 ? (
            <div className="card-navy text-center py-16">
              <FileText size={48} className="mx-auto mb-3 text-navy-750 opacity-40" />
              <p className="text-base font-bold text-navy-100">
                {documents.length === 0
                  ? language === 'hi'
                    ? 'कोई दस्तावेज़ नहीं'
                    : 'No documents stored'
                  : language === 'hi'
                  ? 'कोई परिणाम नहीं'
                  : 'No documents match your filters'}
              </p>
              <p className="text-xs text-navy-700 mt-2 leading-relaxed max-w-md mx-auto">
                {language === 'hi'
                  ? 'अपने पर्चे और रिपोर्ट यहाँ अपलोड करें — वे सुरक्षित रूप से संग्रहीत होते हैं।'
                  : 'Upload your prescriptions and reports here — they are securely stored.'}
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {filteredDocs.map(doc => (
                <div
                  key={doc.id}
                  className="card-navy hover:border-navy-750 transition-all flex flex-col gap-3"
                >
                  <div className="flex items-start gap-3">
                    <div className="w-11 h-11 rounded-card bg-accent/10 border border-accent/20 flex items-center justify-center text-accent shrink-0">
                      <FileText size={20} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <span className="bg-navy-950 border border-navy-800 px-1.5 py-0.5 rounded text-[9px] font-bold text-navy-100 uppercase tracking-widest">
                        {doc.type}
                      </span>
                      <h3 className="text-sm font-extrabold text-white mt-1 leading-tight truncate">
                        {doc.name}
                      </h3>
                    </div>

                    <div className="flex flex-col gap-1.5 shrink-0">
                      <button
                        onClick={() => setPreviewDoc(doc)}
                        className="p-2 text-accent hover:text-white bg-navy-950 rounded-card border border-navy-800 hover:border-accent/40 tactile-btn"
                        title={t.viewInline}
                      >
                        <Eye size={14} />
                      </button>
                      {canMutate && (
                        <button
                          onClick={() => {
                            if (confirm(`Delete ${doc.name}?`)) deleteDocument(doc.id);
                          }}
                          className="p-2 text-navy-700 hover:text-rose-400 bg-navy-950 hover:bg-rose-500/10 border border-navy-800 hover:border-rose-500/30 rounded-card tactile-btn"
                        >
                          <Trash2 size={14} />
                        </button>
                      )}
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-x-3 gap-y-1.5 text-[11px] font-semibold text-navy-100">
                    <div className="flex items-center gap-1.5">
                      <User size={12} className="text-navy-700" />
                      <span className="truncate">{doc.doctor}</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <Calendar size={12} className="text-navy-700" />
                      <span>{doc.date}</span>
                    </div>
                    <div className="flex items-center gap-1.5 col-span-2">
                      <Building size={12} className="text-navy-700" />
                      <span className="truncate">{doc.hospital}</span>
                    </div>
                  </div>

                  {doc.medicines && doc.medicines.length > 0 && (
                    <div className="flex flex-wrap gap-1.5 pt-2 border-t border-navy-800">
                      {doc.medicines.map((m, i) => (
                        <span
                          key={i}
                          className="bg-accent/10 border border-accent/20 px-2 py-0.5 rounded-md text-[10px] font-bold text-accent"
                        >
                          {m}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Preview modal */}
      {previewDoc && (
        <div
          className="fixed inset-0 bg-black/80 z-50 flex items-center justify-center p-4 animate-fade-in"
          onClick={() => setPreviewDoc(null)}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="bg-navy-900 border border-navy-800 rounded-card w-full max-w-3xl h-[90vh] flex flex-col shadow-2xl animate-slide-up"
          >
            <div className="p-4 border-b border-navy-800 flex items-center justify-between">
              <div className="min-w-0">
                <h3 className="font-bold text-white truncate">{previewDoc.name}</h3>
                <p className="text-[11px] text-navy-700">
                  {previewDoc.doctor} • {previewDoc.hospital} • {previewDoc.date}
                </p>
              </div>
              <button
                onClick={() => setPreviewDoc(null)}
                className="p-2 text-navy-100 bg-navy-850 border border-navy-800 rounded-card tactile-btn shrink-0"
              >
                <X size={16} />
              </button>
            </div>

            <div className="flex-1 overflow-auto p-5 flex items-center justify-center bg-navy-950">
              {previewDoc.fileUrl.startsWith('data:image/') || previewDoc.fileUrl.startsWith('http') ? (
                <img
                  src={previewDoc.fileUrl}
                  alt={previewDoc.name}
                  className="max-w-full max-h-full object-contain rounded-card shadow-lg"
                />
              ) : previewDoc.fileUrl.startsWith('data:application/pdf') ? (
                <iframe
                  src={previewDoc.fileUrl}
                  title={previewDoc.name}
                  className="w-full h-full rounded-card border border-navy-800 bg-white"
                />
              ) : (
                <div className="text-center p-6 text-navy-700">
                  <FileText size={48} className="mx-auto mb-2 opacity-40" />
                  <p className="font-bold">PDF / Complex Format Document</p>
                  <p className="text-xs text-navy-700/70 mt-1">
                    Natively stored base64 structures are active.
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Documents;
