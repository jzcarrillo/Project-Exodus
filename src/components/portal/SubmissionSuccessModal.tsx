'use client';
import { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription
} from '@/components/ui/dialog';
import {
  CheckCircle2,
  Copy,
  Check,
  Download,
  Calendar,
  User,
  FileText,
  MapPin,
  Plane,
  ShieldCheck,
  FolderOpen,
  Plus,
  ArrowRight,
  CreditCard
} from 'lucide-react';
import { toast } from 'sonner';
import type { Application } from '@/lib/services';
import { services, SERVICE_FEES } from '@/lib/services';
import { formatDate, formatDateTime } from '@/lib/date-utils';

interface SubmissionSuccessModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  application: Application | null;
  service: typeof services[number] | null;
  documents?: { id: string; name: string; kind: string; size?: number }[];
  qrCode?: string;
  onViewOverview: () => void;
  onViewApplications: () => void;
  onViewPayments?: () => void;
  onStartNew: () => void;
}

export default function SubmissionSuccessModal({
  open,
  onOpenChange,
  application,
  service,
  documents = [],
  qrCode,
  onViewOverview,
  onViewApplications,
  onViewPayments,
  onStartNew,
}: SubmissionSuccessModalProps) {
  const [copied, setCopied] = useState(false);

  if (!application) return null;

  const appData = application.data || {};
  const currentService = service || services.find(s => s.id === application.service);
  const fullName = [appData.firstName, appData.middleName, appData.lastName].filter(Boolean).join(' ') || appData.fullName || '—';
  const passport = appData.passportNumber || appData.guardianPassport;
  const refId = application.id;
  const isForPayment = application.status.toLowerCase() === 'for payment';
  const fee = SERVICE_FEES[application.service];

  const copyReference = () => {
    navigator.clipboard.writeText(refId);
    setCopied(true);
    toast.success('Reference number copied to clipboard!');
    setTimeout(() => setCopied(false), 2000);
  };

  const downloadConfirmationSlip = () => {
    const lines = [
      '========================================================================',
      '               REPUBLIC OF THE PHILIPPINES',
      '                 BUREAU OF IMMIGRATION',
      '           ONLINE APPLICATION SUBMISSION CONFIRMATION',
      '========================================================================',
      '',
      `Reference Number: ${application.id}`,
      `Service:          ${currentService?.name || application.service}`,
      `Category:         ${currentService?.category || 'Immigration'}`,
      `Status:           ${application.status.toUpperCase()}`,
      `Date Submitted:   ${formatDateTime(new Date())}`,
      '',
      '------------------------------------------------------------------------',
      'APPLICANT INFORMATION',
      '------------------------------------------------------------------------',
      `Full Name:        ${fullName}`,
      `Passport Number:  ${passport || '—'}`,
      `Nationality:      ${appData.nationality || '—'}`,
      `Date of Birth:    ${formatDate(appData.birthDate)}`,
      `Gender:           ${appData.gender || '—'}`,
      `Email Address:    ${appData.email || '—'}`,
      `Mobile Number:    ${appData.mobileNumber || appData.phone || '—'}`,
      '',
      '------------------------------------------------------------------------',
      'PHILIPPINE RESIDENTIAL ADDRESS',
      '------------------------------------------------------------------------',
      `Street Address:   ${appData.street || '—'}`,
      `Barangay:         ${appData.barangay || '—'}`,
      `City / Mun:       ${appData.city || '—'}`,
      `Province:         ${appData.province || '—'}`,
      `Postal Code:      ${appData.postalCode || '—'}`,
      '',
      '------------------------------------------------------------------------',
      'SERVICE DETAILS',
      '------------------------------------------------------------------------',
    ];

    // Add module-specific details
    if (application.service === 'etravel') {
      lines.push(`Travel Direction: ${appData.direction || '—'}`);
      lines.push(`Mode of Travel:   ${appData.transport || '—'}`);
      lines.push(`Travel Date:      ${formatDate(appData.travelDate)}`);
      lines.push(`Flight / Vessel:  ${appData.flightNumber || '—'}`);
      lines.push(`Port of Entry:    ${appData.port || '—'}`);
      lines.push(`Country of Origin:      ${appData.origin || '—'}`);
      lines.push(`Country of Destination: ${appData.destination || '—'}`);
    } else if (application.service === 'annual-report') {
      lines.push(`ACR I-Card Number: ${appData.acrNumber || '—'}`);
      lines.push(`ACR Expiry Date:   ${formatDate(appData.acrExpiry)}`);
      lines.push(`Reporting Year:    ${appData.reportYear || '—'}`);
    } else if (application.service === 'student-visa' || application.service === 'study-permit') {
      lines.push(`School Name:      ${appData.schoolName || '—'}`);
      lines.push(`Course / Program: ${appData.course || '—'}`);
      lines.push(`Student Number:   ${appData.studentNumber || '—'}`);
      lines.push(`Academic Year:    ${appData.schoolYear || '—'}`);
      lines.push(`Enrollment Date:  ${formatDate(appData.enrollmentDate)}`);
    } else if (application.service === 'cruise-waiver') {
      lines.push(`Vessel Name:      ${appData.vesselName || '—'}`);
      lines.push(`IMO Number:       ${appData.imoNumber || '—'}`);
      lines.push(`Voyage Number:    ${appData.voyageNumber || '—'}`);
      lines.push(`Company:          ${appData.company || '—'}`);
    } else if (application.service === 'weg') {
      lines.push(`Companion Name:   ${appData.companionName || '—'}`);
      lines.push(`Relationship:     ${appData.companionRelationship || '—'}`);
      lines.push(`Legal Guardian:   ${appData.guardianName || '—'}`);
      lines.push(`Guardian Passport: ${appData.guardianPassport || '—'}`);
      if (appData.guardianPassportExpiry) lines.push(`Guardian Passport Expiry: ${formatDate(appData.guardianPassportExpiry)}`);
    } else {
      if (appData.purpose) lines.push(`Purpose:          ${appData.purpose}`);
      if (appData.travelDate) lines.push(`Travel Date:      ${formatDate(appData.travelDate)}`);
      if (appData.port) lines.push(`Port:             ${appData.port}`);
      if (appData.remarks) lines.push(`Remarks:          ${appData.remarks}`);
    }

    if (documents.length > 0) {
      lines.push('');
      lines.push('------------------------------------------------------------------------');
      lines.push('SUBMITTED DOCUMENTS');
      lines.push('------------------------------------------------------------------------');
      documents.forEach(d => {
        lines.push(`• [Uploaded] ${d.kind}: ${d.name}`);
      });
    }

    lines.push('');
    lines.push('========================================================================');
    lines.push('IMPORTANT NOTICE');
    lines.push('This confirmation serves as proof of online submission in the Bureau of');
    lines.push('Immigration eServices Portal. Your application is currently queued for');
    lines.push('officer evaluation. Please keep your reference number for status tracking.');
    lines.push('========================================================================');

    const content = lines.join('\n');
    const url = URL.createObjectURL(new Blob([content], { type: 'text/plain;charset=utf-8' }));
    const a = document.createElement('a');
    a.href = url;
    a.download = `BI-Confirmation-${application.id}.txt`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    toast.success('Confirmation slip downloaded!');
  };

  const appDocs = documents.filter(d => d.id || d.name);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[760px]! max-h-[92vh] overflow-y-auto p-6! sm:p-8! bg-white! rounded-xl">
        <DialogHeader className="text-center sm:text-left">
          <div className="flex flex-col sm:flex-row items-center sm:items-start gap-4 pb-4 border-b border-[#e2eaf4]">
            <div className="w-14 h-14 rounded-full bg-emerald-50 border-2 border-emerald-500 flex items-center justify-center text-emerald-600 flex-shrink-0 shadow-sm animate-in zoom-in-50 duration-300">
              <CheckCircle2 size={32} className="stroke-[2.5]" />
            </div>
            <div className="flex-1 text-center sm:text-left">
              <span className="inline-flex items-center gap-1 text-[11px] font-bold uppercase tracking-wider px-2.5 py-0.5 rounded-full bg-emerald-100 text-emerald-800 mb-1.5">
                <Check size={13} className="stroke-[3]" /> Submitted Successfully
              </span>
              <DialogTitle className="text-2xl font-bold text-[#0f2d59] leading-tight">
                Application Submitted Successfully!
              </DialogTitle>
              <DialogDescription className="text-sm text-[#5d738f] mt-1">
                Your application for <strong className="text-[#173b69]">{currentService?.name}</strong> has been received and registered.
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        {/* Reference & Service Header Card */}
        <div className="bg-[#f4f7fb] border border-[#d6e3f2] rounded-xl p-4 sm:p-5 my-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <span className="text-xs uppercase font-semibold tracking-wider text-[#637d9c]">Official Reference Number</span>
            <div className="flex items-center gap-2 mt-1">
              <span className="font-mono text-lg font-bold text-[#102d54]">{refId}</span>
              <button
                type="button"
                onClick={copyReference}
                className="inline-flex items-center gap-1 text-xs font-semibold px-2 py-1 rounded bg-white hover:bg-slate-100 text-[#173b69] border border-[#cbd8e8] transition-colors"
                title="Copy Reference"
              >
                {copied ? <Check size={13} className="text-emerald-600" /> : <Copy size={13} />}
                {copied ? 'Copied' : 'Copy'}
              </button>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <span className={`text-xs px-3 py-1 rounded-md font-semibold ${isForPayment ? 'bg-amber-100 text-amber-900 border border-amber-300' : 'bg-emerald-100 text-emerald-800 border border-emerald-200'}`}>
              ● Status: {application.status}
            </span>
            <span className="text-xs px-2.5 py-1 rounded-md font-medium bg-white text-[#456182] border border-[#d6e3f2] flex items-center gap-1">
              <Calendar size={13} />
              {formatDate(new Date())}
            </span>
          </div>
        </div>

        {/* Main Information Grid */}
        <div className="space-y-5">
          {/* Section 1: Applicant Information */}
          <div className="border border-[#e1eaf3] rounded-lg p-4 bg-white">
            <h4 className="text-xs font-bold uppercase tracking-wider text-[#173b69] flex items-center gap-2 pb-2 mb-3 border-b border-[#edf3f9]">
              <User size={15} className="text-[#c99736]" /> Applicant Information
            </h4>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-y-3 gap-x-4 text-sm">
              <div>
                <span className="text-xs text-[#6e85a0] block">Full Name</span>
                <strong className="text-[#102947] font-semibold">{fullName}</strong>
              </div>
              <div>
                <span className="text-xs text-[#6e85a0] block">Passport / Travel Document</span>
                {passport ? (
                  <span className="inline-flex items-center gap-1 font-mono font-bold text-xs px-2 py-0.5 rounded bg-blue-50 text-blue-900 border border-blue-200">
                    🛂 {passport}
                  </span>
                ) : (
                  <span className="text-[#889cb2]">—</span>
                )}
              </div>
              {appData.nationality && (
                <div>
                  <span className="text-xs text-[#6e85a0] block">Nationality</span>
                  <span className="text-[#102947]">{appData.nationality}</span>
                </div>
              )}
              {appData.birthDate && (
                <div>
                  <span className="text-xs text-[#6e85a0] block">Date of Birth</span>
                  <span className="text-[#102947] font-mono">{formatDate(appData.birthDate)}</span>
                </div>
              )}
              {appData.email && (
                <div>
                  <span className="text-xs text-[#6e85a0] block">Email Address</span>
                  <span className="text-[#102947] break-all">{appData.email}</span>
                </div>
              )}
              {(appData.mobileNumber || appData.phone) && (
                <div>
                  <span className="text-xs text-[#6e85a0] block">Contact Number</span>
                  <span className="text-[#102947]">{appData.mobileNumber || appData.phone}</span>
                </div>
              )}
            </div>
          </div>

          {/* Section 2: Address Information */}
          {(appData.street || appData.city || appData.province) && (
            <div className="border border-[#e1eaf3] rounded-lg p-4 bg-white">
              <h4 className="text-xs font-bold uppercase tracking-wider text-[#173b69] flex items-center gap-2 pb-2 mb-3 border-b border-[#edf3f9]">
                <MapPin size={15} className="text-[#c99736]" /> Philippine Residential Address
              </h4>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-y-3 gap-x-4 text-sm">
                <div className="sm:col-span-2">
                  <span className="text-xs text-[#6e85a0] block">Street / Unit / Building</span>
                  <span className="text-[#102947]">{appData.street || '—'}</span>
                </div>
                <div>
                  <span className="text-xs text-[#6e85a0] block">Barangay</span>
                  <span className="text-[#102947]">{appData.barangay || '—'}</span>
                </div>
                <div>
                  <span className="text-xs text-[#6e85a0] block">City / Municipality</span>
                  <span className="text-[#102947]">{appData.city || '—'}</span>
                </div>
                <div>
                  <span className="text-xs text-[#6e85a0] block">Province</span>
                  <span className="text-[#102947]">{appData.province || '—'}</span>
                </div>
                <div>
                  <span className="text-xs text-[#6e85a0] block">Postal Code</span>
                  <span className="font-mono font-semibold text-[#102947]">{appData.postalCode || '—'}</span>
                </div>
              </div>
            </div>
          )}

          {/* Section 3: Service-Specific Details */}
          <div className="border border-[#e1eaf3] rounded-lg p-4 bg-white">
            <h4 className="text-xs font-bold uppercase tracking-wider text-[#173b69] flex items-center gap-2 pb-2 mb-3 border-b border-[#edf3f9]">
              <Plane size={15} className="text-[#c99736]" /> {currentService?.name} Details
            </h4>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-y-3 gap-x-4 text-sm">
              {application.service === 'etravel' && (
                <>
                  <div>
                    <span className="text-xs text-[#6e85a0] block">Travel Direction</span>
                    <strong className="text-[#102947]">{appData.direction || '—'}</strong>
                  </div>
                  <div>
                    <span className="text-xs text-[#6e85a0] block">Mode of Travel</span>
                    <span className="text-[#102947]">{appData.transport || 'Air'}</span>
                  </div>
                  <div>
                    <span className="text-xs text-[#6e85a0] block">Travel Date</span>
                    <span className="text-[#102947]">{formatDate(appData.travelDate)}</span>
                  </div>
                  <div>
                    <span className="text-xs text-[#6e85a0] block">Flight / Vessel Number</span>
                    <span className="font-mono font-bold text-[#102947]">{appData.flightNumber || '—'}</span>
                  </div>
                  <div>
                    <span className="text-xs text-[#6e85a0] block">Port of Entry / Exit</span>
                    <span className="text-[#102947]">{appData.port || '—'}</span>
                  </div>
                  <div>
                    <span className="text-xs text-[#6e85a0] block">Origin / Destination</span>
                    <span className="text-[#102947]">{appData.origin || appData.destination || '—'}</span>
                  </div>
                </>
              )}

              {application.service === 'annual-report' && (
                <>
                  <div>
                    <span className="text-xs text-[#6e85a0] block">ACR I-Card Number</span>
                    <span className="font-mono font-bold text-[#102947]">{appData.acrNumber || '—'}</span>
                  </div>
                  <div>
                    <span className="text-xs text-[#6e85a0] block">Reporting Year</span>
                    <strong className="text-[#102947]">{appData.reportYear || '—'}</strong>
                  </div>
                  <div>
                    <span className="text-xs text-[#6e85a0] block">ACR Expiry Date</span>
                    <span className="text-[#102947]">{formatDate(appData.acrExpiry)}</span>
                  </div>
                </>
              )}

              {(application.service === 'student-visa' || application.service === 'study-permit') && (
                <>
                  <div className="sm:col-span-2">
                    <span className="text-xs text-[#6e85a0] block">School / Institution</span>
                    <strong className="text-[#102947]">{appData.schoolName || '—'}</strong>
                  </div>
                  <div>
                    <span className="text-xs text-[#6e85a0] block">Course / Program</span>
                    <span className="text-[#102947]">{appData.course || '—'}</span>
                  </div>
                  <div>
                    <span className="text-xs text-[#6e85a0] block">Academic Year</span>
                    <span className="text-[#102947]">{appData.schoolYear || '—'}</span>
                  </div>
                  <div>
                    <span className="text-xs text-[#6e85a0] block">Student Number</span>
                    <span className="font-mono text-[#102947]">{appData.studentNumber || '—'}</span>
                  </div>
                  <div>
                    <span className="text-xs text-[#6e85a0] block">Enrollment Date</span>
                    <span className="text-[#102947]">{formatDate(appData.enrollmentDate)}</span>
                  </div>
                </>
              )}

              {application.service === 'cruise-waiver' && (
                <>
                  <div>
                    <span className="text-xs text-[#6e85a0] block">Vessel Name</span>
                    <strong className="text-[#102947]">{appData.vesselName || '—'}</strong>
                  </div>
                  <div>
                    <span className="text-xs text-[#6e85a0] block">IMO Number</span>
                    <span className="font-mono text-[#102947]">{appData.imoNumber || '—'}</span>
                  </div>
                  <div>
                    <span className="text-xs text-[#6e85a0] block">Voyage Number</span>
                    <span className="font-mono text-[#102947]">{appData.voyageNumber || '—'}</span>
                  </div>
                  <div>
                    <span className="text-xs text-[#6e85a0] block">Operating Company</span>
                    <span className="text-[#102947]">{appData.company || '—'}</span>
                  </div>
                </>
              )}

              {application.service === 'weg' && (
                <>
                  <div>
                    <span className="text-xs text-[#6e85a0] block">Companion's Name</span>
                    <strong className="text-[#102947]">{appData.companionName || '—'}</strong>
                  </div>
                  <div>
                    <span className="text-xs text-[#6e85a0] block">Relationship to Traveler</span>
                    <span className="text-[#102947]">{appData.companionRelationship || '—'}</span>
                  </div>
                  <div>
                    <span className="text-xs text-[#6e85a0] block">Legal Guardian</span>
                    <span className="text-[#102947]">{appData.guardianName || '—'}</span>
                  </div>
                  <div>
                    <span className="text-xs text-[#6e85a0] block">Guardian Passport</span>
                    <span className="font-mono text-[#102947]">{appData.guardianPassport || '—'}</span>
                  </div>
                  {appData.guardianPassportExpiry && (
                    <div>
                      <span className="text-xs text-[#6e85a0] block">Guardian Passport Expiry</span>
                      <span className="text-[#102947]">{formatDate(appData.guardianPassportExpiry)}</span>
                    </div>
                  )}
                </>
              )}

              {/* General fallbacks if standard keys are present */}
              {application.service !== 'etravel' && application.service !== 'annual-report' && application.service !== 'student-visa' && application.service !== 'study-permit' && application.service !== 'cruise-waiver' && application.service !== 'weg' && (
                <>
                  {appData.purpose && (
                    <div className="sm:col-span-2">
                      <span className="text-xs text-[#6e85a0] block">Purpose</span>
                      <span className="text-[#102947]">{appData.purpose}</span>
                    </div>
                  )}
                  {appData.travelDate && (
                    <div>
                      <span className="text-xs text-[#6e85a0] block">Travel Date</span>
                      <span className="text-[#102947]">{formatDate(appData.travelDate)}</span>
                    </div>
                  )}
                  {appData.port && (
                    <div>
                      <span className="text-xs text-[#6e85a0] block">Port</span>
                      <span className="text-[#102947]">{appData.port}</span>
                    </div>
                  )}
                  {appData.company && (
                    <div>
                      <span className="text-xs text-[#6e85a0] block">Company / Organization</span>
                      <span className="text-[#102947]">{appData.company}</span>
                    </div>
                  )}
                  {appData.registrationNumber && (
                    <div>
                      <span className="text-xs text-[#6e85a0] block">Registration Number</span>
                      <span className="font-mono text-[#102947]">{appData.registrationNumber}</span>
                    </div>
                  )}
                </>
              )}
            </div>
          </div>

          {/* Section 4: Uploaded Documents */}
          {appDocs.length > 0 && (
            <div className="border border-[#e1eaf3] rounded-lg p-4 bg-white">
              <h4 className="text-xs font-bold uppercase tracking-wider text-[#173b69] flex items-center gap-2 pb-2 mb-3 border-b border-[#edf3f9]">
                <FileText size={15} className="text-[#c99736]" /> Uploaded Documents ({appDocs.length})
              </h4>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {appDocs.map((doc, idx) => (
                  <div key={doc.id || idx} className="flex items-center gap-2.5 p-2 rounded-md bg-[#f8fafc] border border-[#e2eaf2] text-xs">
                    <CheckCircle2 size={15} className="text-emerald-600 flex-shrink-0" />
                    <div className="truncate">
                      <strong className="block text-[#173b69] truncate">{doc.name || doc.kind}</strong>
                      <span className="text-[11px] text-[#6d849e]">{doc.kind}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Section 5: QR Code / Digital Reference */}
          {qrCode && (
            <div className="border border-[#e1eaf3] rounded-lg p-4 bg-white flex flex-col sm:flex-row items-center gap-5">
              <img src={qrCode} alt="Application Submission QR" width={140} height={140} className="border border-[#cbd8e6] rounded-lg p-1 bg-white shadow-sm flex-shrink-0" />
              <div>
                <span className="text-xs uppercase font-bold tracking-wider text-[#173b69] block">Digital Travel Reference QR</span>
                <p className="text-xs text-[#5f7590] mt-1 leading-relaxed">
                  Present this QR code or reference number upon arrival, departure, or when requested by an Immigration Officer.
                </p>
                <a
                  href={qrCode}
                  download={`BI-QR-${application.id}.png`}
                  className="inline-flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-md bg-[#173b69] text-white hover:bg-[#0f2847] transition-colors mt-3"
                >
                  <Download size={14} /> Download QR Image
                </a>
              </div>
            </div>
          )}

          {/* Guidance Note */}
          {isForPayment ? (
            <div className="p-4 rounded-lg bg-amber-50 border border-amber-300 text-amber-950 text-xs flex items-start gap-3 leading-relaxed shadow-xs">
              <CreditCard size={20} className="text-amber-700 flex-shrink-0 mt-0.5" />
              <div>
                <strong className="text-sm text-amber-900 block mb-0.5">Government Fee Assessment Issued</strong>
                This application requires payment of official government fees: <strong>₱{fee?.amount ? fee.amount.toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : '0.00'}</strong>. Please proceed to the Payments tab to complete payment via Land Bank of the Philippines or Maya.
              </div>
            </div>
          ) : (
            <div className="p-3.5 rounded-lg bg-amber-50/70 border border-amber-200/80 text-amber-900 text-xs flex items-start gap-2.5 leading-relaxed">
              <ShieldCheck size={17} className="text-amber-700 flex-shrink-0 mt-0.5" />
              <div>
                <strong>Next Steps:</strong> Your application has been logged in the Bureau of Immigration workspace. You can track evaluation updates anytime under <strong>My Applications</strong>.
              </div>
            </div>
          )}
        </div>

        {/* Footer Actions */}
        <div className="mt-6 pt-4 border-t border-[#e2eaf4] flex flex-wrap items-center justify-between gap-3">
          <button
            type="button"
            onClick={downloadConfirmationSlip}
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-lg text-xs sm:text-sm font-semibold bg-white border border-[#cad7e6] text-[#173b69] hover:bg-[#f3f7fb] transition-colors shadow-xs cursor-pointer"
          >
            <Download size={15} /> Download Confirmation Slip (.txt)
          </button>

          <div className="flex flex-wrap items-center gap-2 ml-auto">
            {isForPayment && onViewPayments && (
              <button
                type="button"
                onClick={() => {
                  onOpenChange(false);
                  onViewPayments();
                }}
                className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-lg text-xs sm:text-sm font-semibold bg-[#dfaa2c] text-[#102033] hover:bg-[#c99723] transition-colors shadow-sm cursor-pointer"
              >
                <CreditCard size={15} /> Proceed to Payment <ArrowRight size={14} />
              </button>
            )}
            <button
              type="button"
              onClick={() => {
                onOpenChange(false);
                onViewApplications();
              }}
              className="inline-flex items-center gap-1.5 px-3.5 py-2.5 rounded-lg text-xs sm:text-sm font-medium bg-[#f0f4f9] text-[#1e4470] hover:bg-[#e4ecf5] transition-colors cursor-pointer"
            >
              <FolderOpen size={15} /> My Applications
            </button>
            <button
              type="button"
              onClick={() => {
                onOpenChange(false);
                onViewOverview();
              }}
              className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-lg text-xs sm:text-sm font-semibold bg-[#173b69] text-white hover:bg-[#102a4b] transition-colors shadow-sm cursor-pointer"
            >
              Overview <ArrowRight size={15} />
            </button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
