'use client';
import { useState, useRef, useEffect, useCallback } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Camera, Upload, ScanLine, Barcode, CheckCircle2, AlertCircle, Loader2, X, RefreshCw, FileSearch, Sparkles, Check, ArrowRight } from 'lucide-react';
import { toast } from 'sonner';
import type { Application } from '@/lib/services';

interface PassportScannerModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  applications: Application[];
  onSelectApplication: (app: Application) => void;
  onSearchQuery: (query: string) => void;
}

export function extractPassportFromText(rawText: string): string | null {
  if (!rawText) return null;
  const lines = rawText.split(/[\r\n]+/).map(l => l.trim().replace(/\s+/g, '')).filter(Boolean);

  // 1. TD3 MRZ check (Passports: 2 lines with '<' characters, passport number at start of line 2)
  const mrzLines = lines.filter(l => l.includes('<') && l.length >= 28);
  if (mrzLines.length >= 2) {
    const line2 = mrzLines[1].toUpperCase();
    const p = line2.slice(0, 9).replace(/</g, '');
    if (p.length >= 6) return p;
  }
  for (const l of lines) {
    const clean = l.toUpperCase();
    if (clean.startsWith('P<') || clean.startsWith('PA<')) continue;
    const match = clean.match(/^([A-Z0-9]{8,9})[0-9<]([A-Z]{3})/);
    if (match) return match[1].replace(/</g, '');
  }

  // 2. Labeled passport lines
  const labelMatch = rawText.match(/(?:Passport\s*(?:No|Number|#)|Document\s*(?:No|Number))[:.\s]*([A-Z0-9]{8,10})/i);
  if (labelMatch) return labelMatch[1].toUpperCase();

  // 3. 9-character passport pattern (standard Philippine & international format)
  const matches = rawText.match(/\b([A-Z]{1,2}[0-9]{7,8}|[0-9]{9})\b/gi);
  if (matches && matches.length > 0) return matches[0].toUpperCase();

  // 4. Any clean 9-char token
  const tokens = rawText.split(/\s+/).map(t => t.replace(/[^A-Z0-9]/gi, '').toUpperCase());
  const validToken = tokens.find(t => t.length === 9);
  if (validToken) return validToken;

  return null;
}

export default function PassportScannerModal({
  open,
  onOpenChange,
  applications,
  onSelectApplication,
  onSearchQuery,
}: PassportScannerModalProps) {
  const [tab, setTab] = useState<'camera' | 'upload' | 'scanner'>('camera');
  const [manualInput, setManualInput] = useState('');
  const [processing, setProcessing] = useState(false);
  const [statusMessage, setStatusMessage] = useState('');
  const [cameraActive, setCameraActive] = useState(false);
  const [previewImage, setPreviewImage] = useState<string | null>(null);

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  // Stop camera helper
  const stopCamera = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(t => t.stop());
      streamRef.current = null;
    }
    setCameraActive(false);
  }, []);

  // Start camera helper
  const startCamera = useCallback(() => {
    stopCamera();
    if (typeof navigator !== 'undefined' && navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
      navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: 'environment',
          width: { ideal: 1280 },
          height: { ideal: 720 },
        },
      })
        .then(stream => {
          streamRef.current = stream;
          if (videoRef.current) {
            videoRef.current.srcObject = stream;
            videoRef.current.play().catch(() => {});
          }
          setCameraActive(true);
        })
        .catch(err => {
          console.warn('Camera access unavailable:', err);
          setCameraActive(false);
        });
    }
  }, [stopCamera]);

  useEffect(() => {
    if (open && tab === 'camera') {
      startCamera();
    } else {
      stopCamera();
    }
    return () => {
      stopCamera();
    };
  }, [open, tab, startCamera, stopCamera]);

  // Handle passport lookup & auto-load
  const handlePassportLookup = async (passportNumber: string) => {
    const clean = passportNumber.trim().toUpperCase();
    if (!clean) {
      toast.error('Enter a valid passport number or scan a passport.');
      return;
    }

    setProcessing(true);
    setStatusMessage(`Searching application for passport ${clean}…`);

    // 1. Check local applications list
    const found = applications.find(a => {
      const pass = (a.data?.passportNumber || a.data?.guardianPassport || '').trim().toUpperCase();
      const id = (a.id || '').trim().toUpperCase();
      return pass === clean || id === clean || (clean.length >= 6 && pass.includes(clean));
    });

    if (found) {
      stopCamera();
      toast.success(`Application loaded for passport ${clean}`);
      onSearchQuery(clean);
      onSelectApplication(found);
      onOpenChange(false);
      setProcessing(false);
      return;
    }

    // 2. Query backend if not found in current local list
    try {
      const token = typeof window !== 'undefined' ? localStorage.getItem('bi_token') : null;
      const email = typeof window !== 'undefined' ? localStorage.getItem('bi_user_email') : null;
      const res = await fetch(`/api/portal?review=1&passport=${encodeURIComponent(clean)}`, {
        headers: {
          ...(token ? { 'Authorization': `Bearer ${token}` } : {}),
          ...(email ? { 'x-user-email': email } : {}),
        },
      });

      if (res.ok) {
        const data = await res.json();
        if (data.applications && data.applications.length > 0) {
          const app = data.applications[0];
          stopCamera();
          toast.success(`Loaded application for passport ${clean}`);
          onSearchQuery(clean);
          onSelectApplication(app);
          onOpenChange(false);
          setProcessing(false);
          return;
        }
      }
    } catch (err) {
      console.error('Passport search error:', err);
    }

    // 3. If not found in queue, update search filter and notify
    stopCamera();
    onSearchQuery(clean);
    toast.info(`No active application found for passport ${clean}. Search filter updated.`);
    setProcessing(false);
    onOpenChange(false);
  };

  // OCR Processing
  const performOcr = async (imageSource: string | File | Blob) => {
    setProcessing(true);
    setStatusMessage('Analyzing passport bio-page with OCR…');

    try {
      const { createWorker } = await import('tesseract.js');
      const worker = await createWorker('eng');
      const ret = await worker.recognize(imageSource);
      await worker.terminate();

      const text = ret?.data?.text || '';
      const passport = extractPassportFromText(text);

      if (passport) {
        toast.success(`Passport detected: ${passport}`);
        await handlePassportLookup(passport);
      } else {
        toast.error('Could not detect a passport number. Please enter it manually or check image clarity.');
        setProcessing(false);
      }
    } catch (err: any) {
      console.error('OCR Error:', err);
      toast.error('Scan failed: ' + (err?.message || 'Check image resolution and try again.'));
      setProcessing(false);
    }
  };

  // Capture frame from camera
  const captureFrame = () => {
    if (!videoRef.current) return;
    const video = videoRef.current;
    const canvas = document.createElement('canvas');
    canvas.width = video.videoWidth || 1280;
    canvas.height = video.videoHeight || 720;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

    canvas.toBlob(blob => {
      if (blob) {
        setPreviewImage(URL.createObjectURL(blob));
        performOcr(blob);
      }
    }, 'image/jpeg', 0.95);
  };

  // Handle uploaded file
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setPreviewImage(URL.createObjectURL(file));
    performOcr(file);
    e.target.value = '';
  };

  // Extract recent passports from applications for quick testing
  const recentPassports = applications
    .filter(a => !!(a.data?.passportNumber || a.data?.guardianPassport))
    .slice(0, 8)
    .map(a => ({
      passport: (a.data?.passportNumber || a.data?.guardianPassport) as string,
      name: [a.data?.firstName, a.data?.lastName].filter(Boolean).join(' ') || a.service,
      app: a,
    }));

  return (
    <Dialog open={open} onOpenChange={v => { if (!v) stopCamera(); onOpenChange(v); }}>
      <DialogContent className="sm:max-w-[620px] p-0 overflow-hidden bg-white text-slate-900 border border-slate-200 shadow-2xl rounded-2xl">
        <div className="bg-[#102033] text-white p-5 pb-4 border-b border-[#193452]">
          <DialogHeader>
            <div className="flex items-center gap-2.5">
              <div className="p-2 rounded-xl bg-blue-500/20 text-blue-400 border border-blue-400/30">
                <ScanLine size={22}/>
              </div>
              <div>
                <DialogTitle className="text-lg font-bold text-white tracking-tight">Passport Scanner & Lookup</DialogTitle>
                <DialogDescription className="text-xs text-blue-200/80">
                  Scan via camera, upload a bio-page image, or input a passport number to search and load the application.
                </DialogDescription>
              </div>
            </div>
          </DialogHeader>

          {/* Mode Tabs */}
          <div className="flex items-center gap-1.5 mt-4 p-1 bg-[#172c44] rounded-xl text-xs font-medium">
            <button
              type="button"
              onClick={() => { setTab('camera'); setPreviewImage(null); }}
              className={`flex-1 flex items-center justify-center gap-1.5 py-2 px-3 rounded-lg transition cursor-pointer ${
                tab === 'camera' ? 'bg-[#1e3c60] text-white font-semibold shadow-sm' : 'text-slate-300 hover:text-white'
              }`}
            >
              <Camera size={15}/> Live Camera
            </button>
            <button
              type="button"
              onClick={() => { setTab('upload'); stopCamera(); }}
              className={`flex-1 flex items-center justify-center gap-1.5 py-2 px-3 rounded-lg transition cursor-pointer ${
                tab === 'upload' ? 'bg-[#1e3c60] text-white font-semibold shadow-sm' : 'text-slate-300 hover:text-white'
              }`}
            >
              <Upload size={15}/> Upload Bio Page
            </button>
            <button
              type="button"
              onClick={() => { setTab('scanner'); stopCamera(); }}
              className={`flex-1 flex items-center justify-center gap-1.5 py-2 px-3 rounded-lg transition cursor-pointer ${
                tab === 'scanner' ? 'bg-[#1e3c60] text-white font-semibold shadow-sm' : 'text-slate-300 hover:text-white'
              }`}
            >
              <Barcode size={15}/> Scanner / Input
            </button>
          </div>
        </div>

        <div className="p-6">
          {/* CAMERA TAB */}
          {tab === 'camera' && (
            <div className="flex flex-col items-center">
              <div className="relative w-full aspect-[4/3] max-h-[320px] bg-black rounded-xl overflow-hidden shadow-inner flex items-center justify-center border border-slate-700">
                <video
                  ref={videoRef}
                  className="w-full h-full object-cover"
                  playsInline
                  autoPlay
                  muted
                />

                {/* Viewfinder Target Overlay */}
                <div className="absolute inset-4 border-2 border-dashed border-emerald-400/80 rounded-lg pointer-events-none flex flex-col justify-between p-3">
                  <div className="flex justify-between items-start">
                    <span className="text-[10px] uppercase font-mono tracking-widest bg-black/60 text-emerald-300 px-2 py-0.5 rounded backdrop-blur-sm">
                      PASSPORT PHOTO & DATA
                    </span>
                    <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse"/>
                  </div>
                  <div className="border-t border-dashed border-emerald-400/50 pt-1.5 flex justify-between items-end">
                    <span className="text-[10px] font-mono text-emerald-300/80 bg-black/60 px-1.5 py-0.5 rounded">
                      &lt;&lt;&lt;&lt;&lt;&lt; MRZ ZONE &lt;&lt;&lt;&lt;&lt;&lt;
                    </span>
                  </div>
                </div>

                {/* Animated Laser Scanning Line */}
                <div className="absolute inset-x-0 h-0.5 bg-gradient-to-r from-transparent via-emerald-400 to-transparent animate-pulse top-1/2 pointer-events-none shadow-[0_0_8px_rgba(52,211,153,0.8)]"/>

                {!cameraActive && (
                  <div className="absolute inset-0 bg-slate-900/90 flex flex-col items-center justify-center p-4 text-center">
                    <Camera size={36} className="text-slate-500 mb-2"/>
                    <p className="text-sm font-semibold text-slate-200">Camera preview not active</p>
                    <p className="text-xs text-slate-400 mt-1 max-w-[260px]">
                      Allow camera access in your browser or switch to upload/manual input.
                    </p>
                    <button
                      type="button"
                      onClick={startCamera}
                      className="mt-3 px-3.5 py-1.5 text-xs font-semibold rounded-lg bg-blue-600 text-white hover:bg-blue-700 transition"
                    >
                      Retry Camera
                    </button>
                  </div>
                )}
              </div>

              <div className="w-full flex items-center justify-between mt-4">
                <span className="text-xs text-slate-500">
                  Align passport bio-page within the frame and click capture.
                </span>
                <button
                  type="button"
                  disabled={processing || !cameraActive}
                  onClick={captureFrame}
                  className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold shadow-md transition disabled:opacity-50 cursor-pointer"
                >
                  {processing ? <Loader2 size={16} className="animate-spin"/> : <Sparkles size={16}/>}
                  <span>Capture & Scan</span>
                </button>
              </div>
            </div>
          )}

          {/* UPLOAD TAB */}
          {tab === 'upload' && (
            <div className="flex flex-col items-center">
              <input
                ref={fileInputRef}
                type="file"
                accept="image/png,image/jpeg,image/webp,image/jpg"
                className="hidden"
                onChange={handleFileUpload}
              />
              <div
                onClick={() => fileInputRef.current?.click()}
                className="w-full border-2 border-dashed border-slate-300 hover:border-blue-500 rounded-2xl p-8 flex flex-col items-center justify-center cursor-pointer transition bg-slate-50/50 hover:bg-blue-50/30 group"
              >
                {previewImage ? (
                  <div className="flex flex-col items-center gap-3">
                    <img src={previewImage} alt="Passport preview" className="max-h-48 rounded-lg shadow border border-slate-200 object-contain"/>
                    <p className="text-xs text-blue-600 font-medium">Click to choose another photo</p>
                  </div>
                ) : (
                  <>
                    <div className="p-4 rounded-2xl bg-white shadow-sm border border-slate-200 text-blue-600 group-hover:scale-105 transition">
                      <Upload size={30}/>
                    </div>
                    <p className="mt-3 text-sm font-semibold text-slate-800">
                      Drop passport bio-page scan here, or <span className="text-blue-600 underline">browse</span>
                    </p>
                    <p className="text-xs text-slate-500 mt-1">Supports JPG, PNG, WEBP (up to 10 MB)</p>
                  </>
                )}
              </div>

              <div className="w-full flex items-center justify-between mt-4">
                <span className="text-xs text-slate-500">
                  Image is processed locally via OCR to extract the passport number.
                </span>
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={processing}
                  className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold shadow-sm transition disabled:opacity-50 cursor-pointer"
                >
                  <FileSearch size={15}/> Choose File
                </button>
              </div>
            </div>
          )}

          {/* SCANNER / MANUAL TAB */}
          {tab === 'scanner' && (
            <div className="flex flex-col gap-4">
              <form
                onSubmit={e => {
                  e.preventDefault();
                  handlePassportLookup(manualInput);
                }}
                className="flex flex-col gap-3"
              >
                <label className="text-xs font-semibold text-slate-700">
                  Passport Number or Optical Scanner Code
                </label>
                <div className="flex gap-2">
                  <div className="relative flex-1">
                    <Barcode className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" size={18}/>
                    <input
                      type="text"
                      placeholder="e.g. P12345678 or scan barcode/MRZ…"
                      value={manualInput}
                      onChange={e => setManualInput(e.target.value)}
                      autoFocus
                      className="w-full pl-10 pr-3.5 py-2.5 rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-blue-500 font-mono text-sm uppercase text-slate-800 bg-white"
                    />
                  </div>
                  <button
                    type="submit"
                    disabled={processing || !manualInput.trim()}
                    className="px-5 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold shadow-sm transition disabled:opacity-50 flex items-center gap-1.5 cursor-pointer"
                  >
                    {processing ? <Loader2 size={15} className="animate-spin"/> : <ArrowRight size={15}/>}
                    Search & Load
                  </button>
                </div>
                <p className="text-xs text-slate-500">
                  Compatible with USB handheld passport scanners, 2D barcode readers, and manual keyboard entry.
                </p>
              </form>

              {/* Quick-test pills from current queue */}
              {recentPassports.length > 0 && (
                <div className="mt-2 pt-4 border-t border-slate-200">
                  <p className="text-xs font-semibold text-slate-500 mb-2.5">
                    Quick test from current reviewer queue:
                  </p>
                  <div className="flex flex-wrap gap-1.5">
                    {recentPassports.map(({ passport, name, app }) => (
                      <button
                        key={passport}
                        type="button"
                        onClick={() => {
                          onSearchQuery(passport);
                          onSelectApplication(app);
                          onOpenChange(false);
                          toast.success(`Loaded application for ${name} (${passport})`);
                        }}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs rounded-lg bg-slate-100 hover:bg-blue-50 hover:text-blue-700 text-slate-700 font-mono transition border border-slate-200 cursor-pointer"
                      >
                        <span className="font-bold">🛂 {passport}</span>
                        <span className="font-sans text-[11px] text-slate-500">({name})</span>
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Processing Banner */}
          {processing && (
            <div className="mt-4 p-3 rounded-xl bg-blue-50 border border-blue-200 flex items-center gap-3">
              <Loader2 size={18} className="animate-spin text-blue-600"/>
              <span className="text-xs font-medium text-blue-900">{statusMessage}</span>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
