'use client';
import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { LayoutDashboard, Files, Grid2X2, CreditCard, FolderOpen, Bell, UserRound, ShieldCheck, ArrowUpRight, ArrowRight, ArrowLeft, Plane, GraduationCap, BookOpen, Globe2, Plus, CircleHelp, ChevronRight, Search, Ship, Building2, CalendarDays, Flag, Users, School, Download, Upload, Check, Save, CheckCircle2, LockKeyhole, RefreshCw, LogOut, ClipboardCheck, FileText, Loader2, X, UserPlus, LogIn, ScanLine, FileSpreadsheet } from 'lucide-react';
import { Sidebar, SidebarProvider, SidebarHeader, SidebarContent, SidebarFooter, SidebarMenu, SidebarMenuItem, SidebarMenuButton, SidebarTrigger, useSidebar } from '@/components/ui/sidebar';
import { Combobox, ComboboxInput, ComboboxContent, ComboboxList, ComboboxItem, ComboboxEmpty } from '@/components/ui/combobox';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Popover, PopoverTrigger, PopoverContent } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { Checkbox } from '@/components/ui/checkbox';
import { Progress } from '@/components/ui/progress';
import { Toaster } from '@/components/ui/sonner';
import { toast } from 'sonner';
import { services, validateApplication, type Application, type Field, PAYMENT_REQUIRED_SERVICES, SERVICE_FEES } from '@/lib/services';
import { formatDate, formatDateTime, toMMDDYYYY, toYYYYMMDD } from '@/lib/date-utils';
import Overview from './overview';
import ResidentialAddress from './residential-address';
import AuthModal from './auth-modal';
import PassportScannerModal from './passport-scanner-modal';
import SubmissionSuccessModal from './submission-success-modal';

const navigation = [[LayoutDashboard,'Overview'],[Grid2X2,'All services'],[Files,'My applications'],[CreditCard,'Payments'],[FolderOpen,'My documents'],[Bell,'Notifications']] as const;
const icons:Record<string,any>={plane:Plane,globe:Globe2,graduation:GraduationCap,book:BookOpen,ship:Ship,building:Building2,calendar:CalendarDays,school:School,flag:Flag,users:Users};
const serviceName=(id:string)=>services.find(s=>s.id===id)?.name||id;
const date=(s:string)=>formatDate(s);
const shortId=(id:string)=>id.slice(0,11).toUpperCase();

function getAuthHeaders(extraHeaders: Record<string, string> = {}) {
  const token = typeof window !== 'undefined' ? localStorage.getItem('bi_token') : null;
  const email = typeof window !== 'undefined' ? localStorage.getItem('bi_user_email') : null;
  return {
    ...extraHeaders,
    ...(token ? { 'Authorization': `Bearer ${token}` } : {}),
    ...(email ? { 'x-user-email': email } : {}),
  };
}

async function api(action:string,data:object={}){
  const r=await fetch('/api/portal',{
    method:'POST',
    headers:getAuthHeaders({ 'Content-Type': 'application/json' }),
    body:JSON.stringify({action,...data})
  });
  const d:any=await r.json();
  if(!r.ok)throw new Error(d.error||d.message||'Request failed');
  return d;
}

function valueDisplay(value: unknown): string {
  if (value === null || value === undefined) return '';
  if (typeof value === 'string') return value;
  if (typeof value === 'object') {
    try {
      return JSON.stringify(value);
    } catch {
      return String(value);
    }
  }
  return String(value);
}

function displayForField(field: Field, value: string): string {
  if (field.type === 'date' && value) return formatDate(value);
  return value;
}

function download(content:string,name:string,type='text/plain'){const url=URL.createObjectURL(new Blob([content],{type}));const a=document.createElement('a');a.href=url;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000)}
export function ApplicationList({applications,onOpen}:{applications:Application[];onOpen:(a:Application)=>void}){return <Table><TableHeader><TableRow><TableHead>Application</TableHead><TableHead>Status</TableHead><TableHead>Last updated</TableHead><TableHead><span className="sr-only">Action</span></TableHead></TableRow></TableHeader><TableBody>{applications.map(a=>{const name=[a.data?.firstName,a.data?.lastName].filter(Boolean).join(' ');const pass=a.data?.passportNumber||a.data?.guardianPassport;return <TableRow key={a.id}><TableCell><div><strong>{serviceName(a.service)}{name&&<span style={{fontWeight:'normal',color:'#4b617a',marginLeft:'0.4rem'}}>— {name}</span>}</strong></div><div className="flex items-center gap-2 mt-0.5"><small className="reference">{shortId(a.id)}</small>{pass&&<span className="inline-flex items-center gap-1 text-[11px] font-mono px-2 py-0.5 rounded-md bg-blue-50 text-blue-800 border border-blue-200">🛂 {pass}</span>}</div></TableCell><TableCell><span className={'status status-'+a.status.toLowerCase().replaceAll(' ','-')}>{a.status}</span></TableCell><TableCell>{date(a.updated)}</TableCell><TableCell><button className="text-button" aria-label={'Open '+serviceName(a.service)+' '+shortId(a.id)} onClick={()=>onOpen(a)}>{['Draft','For correction'].includes(a.status)?'Continue':a.status==='For payment'?'Pay / View':'Review'}<ChevronRight size={16}/></button></TableCell></TableRow>})}</TableBody></Table>}
function SidebarNav({view,onNavigate,unread}:{view:string;onNavigate:(v:string)=>void;unread:number}){const {setOpenMobile}=useSidebar();return <SidebarMenu>{navigation.map(([Icon,label])=><SidebarMenuItem key={label}><SidebarMenuButton isActive={view===label} onClick={()=>{onNavigate(label);setOpenMobile(false)}}><Icon/><span>{label}</span>{label==='Notifications'&&unread>0&&<b className="nav-count">{unread}</b>}</SidebarMenuButton></SidebarMenuItem>)}</SidebarMenu>}

export default function Portal(){
  const [view,setView]=useState('Overview'),[applications,setApplications]=useState<Application[]>([]),[documents,setDocuments]=useState<any[]>([]),[activity,setActivity]=useState<any[]>([]),[profile,setProfile]=useState<Record<string,string>>({}),[user,setUser]=useState<any>(null),[loading,setLoading]=useState(true),[error,setError]=useState(''),[filter,setFilter]=useState('All'),[query,setQuery]=useState(''),[selected,setSelected]=useState<Application|null>(null),[service,setService]=useState<typeof services[number]|null>(null),[data,setData]=useState<Record<string,string>>({}),[step,setStep]=useState(0),[busy,setBusy]=useState(false),[consent,setConsent]=useState(false),[detail,setDetail]=useState<Application|null>(null),[qr,setQr]=useState(''),[reviewApps,setReviewApps]=useState<Application[]>([]),[reviewNote,setReviewNote]=useState(''),[detailDocs,setDetailDocs]=useState<any[]>([]),[detailActivity,setDetailActivity]=useState<any[]>([]);
  const [backOfficeQuery, setBackOfficeQuery] = useState('');
  const [backOfficeStatus, setBackOfficeStatus] = useState('All');
  const [scannerOpen, setScannerOpen] = useState(false);
  const [authOpen, setAuthOpen] = useState(false);
  const [authTab, setAuthTab] = useState<'login' | 'signup'>('login');
  const [submittedApp, setSubmittedApp] = useState<{
    application: Application;
    service: typeof services[number];
    documents: any[];
    qr?: string;
  } | null>(null);
  const [successModalOpen, setSuccessModalOpen] = useState(false);
  const [paymentModalApp, setPaymentModalApp] = useState<Application | null>(null);
  const [selectedChannel, setSelectedChannel] = useState<string>('Land Bank of the Philippines');
  const [paying, setPaying] = useState(false);
  const saveLock=useRef(false);

  const refresh=useCallback(async()=>{
    try{
      const token = typeof window !== 'undefined' ? localStorage.getItem('bi_token') : null;
      const email = typeof window !== 'undefined' ? localStorage.getItem('bi_user_email') : null;
      if (!token && !email) {
        setUser(null);
        setApplications([]);
        setDocuments([]);
        setActivity([]);
        setProfile({});
        setError('');
        setLoading(false);
        return;
      }
      const r=await fetch('/api/portal', { headers: getAuthHeaders() });
      const d:any=await r.json();
      if(!r.ok){
        if(r.status===401){
          setUser(null);
          setApplications([]);
          setDocuments([]);
          setActivity([]);
          setProfile({});
          setError('');
          return;
        }
        throw new Error(d.error)
      }
      setUser(d.user);
      setApplications(d.applications || []);
      setDocuments(d.documents || []);
      setActivity(d.activity || []);
      setProfile(d.profile || {});
      setError('');
    }catch(e){
      setError(e instanceof Error?e.message:'Could not load your workspace.')
    }finally{
      setLoading(false);
    }
  },[]);

  useEffect(()=>{refresh();const timer=setInterval(refresh,30000);return()=>clearInterval(timer)},[refresh]);

  const handleLogout = async () => {
    try {
      await fetch('/api/auth/logout', { method: 'POST', headers: getAuthHeaders() });
    } catch {}
    if (typeof window !== 'undefined') {
      localStorage.removeItem('bi_token');
      localStorage.removeItem('bi_user_email');
      document.cookie = 'bi_auth_token=; path=/; max-age=0';
    }
    setUser(null);
    setApplications([]);
    setDocuments([]);
    setActivity([]);
    setProfile({});
    toast.success('Signed out successfully.');
    navigate('Overview');
  };

  const openAuth = (tab: 'login' | 'signup' = 'login') => {
    setAuthTab(tab);
    setAuthOpen(true);
  };

  const navigate=useCallback((v:string)=>{setView(v);setQuery('');setFilter('All');setService(null);setSelected(null);setDetail(null);setStep(0);window.scrollTo({top:0,behavior:'smooth'})},[]);
  const start=useCallback((name:string)=>{const s=services.find(s=>s.name===name||s.id===name);if(!s)return;setService(s);setSelected(null);setData({...profile,email:user?.email||''});setStep(0);setConsent(false);setView('New application');window.scrollTo({top:0})},[profile,user]);

  useEffect(()=>{const context=(document as any).modelContext;if(!context?.registerTool)return;const controller=new AbortController();try{Promise.resolve(context.registerTool({name:'start_immigration_application',description:'Open the guided application form for a service. Does not save or submit.',inputSchema:{type:'object',properties:{service:{type:'string',enum:services.map(s=>s.id)}},required:['service'],additionalProperties:false},annotations:{readOnlyHint:false},execute:(input:any)=>{if(!input||Object.keys(input).length!==1||!services.some(s=>s.id===input.service))throw new Error('Choose a supported service ID.');start(input.service);return {opened:input.service,submitted:false}}},{signal:controller.signal})).catch(()=>{})}catch{}return()=>controller.abort()},[start]);

  useEffect(()=>{setDetailDocs([]);setDetailActivity([]);if(!detail)return;let active=true;fetch('/api/portal?application='+encodeURIComponent(detail.id), { headers: getAuthHeaders() }).then(r=>r.json()).then((d:any)=>{if(!active)return;if(d.error){toast.error(d.error);return;}setDetailDocs(d.documents);setDetailActivity(d.activity)}).catch(()=>toast.error('Could not load application history.'));return()=>{active=false}},[detail]);

  useEffect(()=>{setQr('');if(detail?.service==='etravel'&&detail.status!=='Draft'){let cancelled=false;import('qrcode').then(q=>q.toDataURL(JSON.stringify({type:'BI_PREVIEW_ONLY',reference:detail.id}),{width:220,margin:2})).then(url=>{if(!cancelled)setQr(url)});return()=>{cancelled=true}}},[detail]);

  const refreshBackOffice = useCallback(async (queryOverride?: string) => {
    if (user?.role !== 'reviewer') return;
    try {
      const qVal = queryOverride !== undefined ? queryOverride : backOfficeQuery;
      const q = qVal ? `&passport=${encodeURIComponent(qVal.trim())}` : '';
      const r = await fetch('/api/portal?review=1' + q, { headers: getAuthHeaders() });
      const d = await r.json();
      if (d.error) toast.error(d.error);
      else setReviewApps(d.applications);
    } catch {
      toast.error('Could not load reviewer queue.');
    }
  }, [user, backOfficeQuery]);

  useEffect(()=>{
    if(view==='Back office'&&user?.role==='reviewer'){
      refreshBackOffice();
    }
  },[view,user,refreshBackOffice]);

  const filteredReviewApps = reviewApps.filter(a => {
    const matchesStatus = backOfficeStatus === 'All' || a.status === backOfficeStatus;
    if (!matchesStatus) return false;
    if (!backOfficeQuery.trim()) return true;
    const q = backOfficeQuery.trim().toLowerCase();
    const pass = (a.data?.passportNumber || a.data?.guardianPassport || '').toLowerCase();
    const name = `${a.data?.firstName || ''} ${a.data?.lastName || ''}`.toLowerCase();
    const id = (a.id || '').toLowerCase();
    const service = serviceName(a.service).toLowerCase();
    return pass.includes(q) || name.includes(q) || id.includes(q) || service.includes(q);
  });

  const open=(a:Application)=>{if(['Draft','For correction'].includes(a.status)){setSelected(a);setService(services.find(s=>s.id===a.service)!);setData(a.data);setStep(0);setConsent(false);setView('Continue application');}else setDetail(a)};

  async function save(){if(!service)throw new Error('Choose a service.');if(saveLock.current)throw new Error('A save is already in progress.');saveLock.current=true;try{const result=await api('save',{service:service.id,data,id:selected?.id,version:selected?.version});const next={id:result.id,service:service.id,status:selected?.status||'Draft',data,created:selected?.created||new Date().toISOString(),updated:new Date().toISOString(),version:result.version};setSelected(next);await refresh();return next;}finally{saveLock.current=false}}

  async function saveDraft(){setBusy(true);try{await save();toast.success('Draft saved. You can return to it anytime.')}catch(e){toast.error((e as Error).message)}finally{setBusy(false)}}

  async function uploadFiles(files:FileList|null,kind:string){if(!files?.length)return;setBusy(true);try{let a=selected;if(!a||!a.id){a=await save();}if(!a?.id)throw new Error('Save application draft before uploading documents.');const uploadedList:any[]=[];for(const file of Array.from(files)){const max=kind.includes('.xlsx')?101*1024*1024:10*1024*1024;if(file.size>max)throw new Error(file.name+' exceeds the size limit.');const formData=new FormData();formData.append('file',file);formData.append('application',a.id);formData.append('kind',kind);const params=new URLSearchParams({application:a.id,kind,name:file.name});const res=await fetch('/api/documents?'+params,{method:'POST',headers:getAuthHeaders(),body:formData});const result:any=await res.json();if(!res.ok)throw new Error(result.error||'Failed to upload file.');uploadedList.push({id:result.id,application:a.id,name:file.name,kind,size:file.size,created:new Date().toISOString()});}setDocuments(prev=>{const filtered=kind.includes('.xlsx')?prev:prev.filter(d=>!(d.application===a.id&&d.kind===kind));return[...uploadedList,...filtered];});setSelected(prev=>(prev&&prev.id===a.id?prev:a));await refresh();toast.success(`${kind} uploaded successfully.`);}catch(e){toast.error((e as Error).message);}finally{setBusy(false);}}

  async function submit(){
    setBusy(true);
    try{
      if(!consent)throw new Error('Confirm the review statement first.');
      const a=await save();
      const subRes: any = await api('submit',{id:a!.id});
      await refresh();

      let qrUrl = '';
      try {
        const qrcode = await import('qrcode');
        qrUrl = await qrcode.toDataURL(JSON.stringify({
          type: 'BI_APPLICATION_SUBMISSION',
          reference: a!.id,
          service: service?.name,
          applicant: `${data.firstName || ''} ${data.lastName || ''}`.trim(),
          submittedAt: new Date().toISOString()
        }), { width: 220, margin: 2 });
      } catch {}

      const nextStatus = subRes?.status || (PAYMENT_REQUIRED_SERVICES.has(service!.id) ? 'For payment' : 'Submitted');
      const submittedRecord: Application = {
        id: a!.id,
        service: service!.id,
        status: nextStatus,
        data: { ...data },
        created: a!.created || new Date().toISOString(),
        updated: new Date().toISOString(),
        version: (a!.version || 1) + 1
      };

      const appDocs = documents.filter(d => d.application === a!.id);

      setSubmittedApp({
        application: submittedRecord,
        service: service!,
        documents: appDocs,
        qr: qrUrl
      });
      setSuccessModalOpen(true);

      setService(null);
      setSelected(null);
      setData({});
      setStep(0);
      setConsent(false);
      setView('Overview');
      toast.success(nextStatus === 'For payment' ? 'Application saved! Assessment fee is awaiting payment.' : 'Application submitted successfully!');
    }catch(e){
      toast.error((e as Error).message)
    }finally{
      setBusy(false);
    }
  }

  async function handlePayAssessment(app: Application) {
    setPaying(true);
    try {
      const res = await api('pay', { id: app.id, channel: selectedChannel });
      toast.success(`Payment confirmed! Official Receipt ${res.receiptNo} generated.`);

      const fee = SERVICE_FEES[app.service]?.amount || 0;
      const applicantName = [app.data?.firstName, app.data?.lastName].filter(Boolean).join(' ') || 'Applicant';
      const orContent = [
        '========================================================================',
        '               REPUBLIC OF THE PHILIPPINES',
        '                 BUREAU OF IMMIGRATION',
        '                   OFFICIAL RECEIPT',
        '========================================================================',
        '',
        `Receipt No:       ${res.receiptNo}`,
        `Payment Channel:  ${res.paymentChannel || selectedChannel}`,
        `Transaction Date: ${formatDateTime(res.paidAt || new Date())}`,
        `Reference No:     ${app.id}`,
        `Service:          ${serviceName(app.service)}`,
        `Applicant:        ${applicantName}`,
        `Passport No:      ${app.data?.passportNumber || app.data?.guardianPassport || '—'}`,
        '',
        '------------------------------------------------------------------------',
        'ASSESSMENT & PAYMENT BREAKDOWN',
        '------------------------------------------------------------------------',
        ...(SERVICE_FEES[app.service]?.breakdown.map(b => `${b.item.padEnd(45, ' ')} ₱${b.amount.toLocaleString('en-PH', { minimumFractionDigits: 2 })}`) || []),
        '------------------------------------------------------------------------',
        `TOTAL AMOUNT PAID:                           ₱${fee.toLocaleString('en-PH', { minimumFractionDigits: 2 })}`,
        '------------------------------------------------------------------------',
        '',
        'STATUS: PAID & VALIDATED',
        'Application has been advanced to Bureau Review and Processing.',
        'Keep this receipt for your records.',
        '========================================================================',
      ].join('\n');

      download(orContent, `${res.receiptNo}-${shortId(app.id)}.txt`);
      setPaymentModalApp(null);
      await refresh();
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setPaying(false);
    }
  }

  function downloadReceipt(app: Application) {
    const receiptNo = app.data?.receiptNo || 'OR-2026-UNKNOWN';
    const channel = app.data?.paymentChannel || 'Land Bank of the Philippines';
    const fee = SERVICE_FEES[app.service]?.amount || Number(app.data?.feeAmount) || 0;
    const applicantName = [app.data?.firstName, app.data?.lastName].filter(Boolean).join(' ') || 'Applicant';
    const orContent = [
      '========================================================================',
      '               REPUBLIC OF THE PHILIPPINES',
      '                 BUREAU OF IMMIGRATION',
      '                   OFFICIAL RECEIPT',
      '========================================================================',
      '',
      `Receipt No:       ${receiptNo}`,
      `Payment Channel:  ${channel}`,
      `Transaction Date: ${formatDateTime(app.data?.paidAt || app.updated)}`,
      `Reference No:     ${app.id}`,
      `Service:          ${serviceName(app.service)}`,
      `Applicant:        ${applicantName}`,
      `Passport No:      ${app.data?.passportNumber || app.data?.guardianPassport || '—'}`,
      '',
      '------------------------------------------------------------------------',
      'ASSESSMENT & PAYMENT BREAKDOWN',
      '------------------------------------------------------------------------',
      ...(SERVICE_FEES[app.service]?.breakdown.map(b => `${b.item.padEnd(45, ' ')} ₱${b.amount.toLocaleString('en-PH', { minimumFractionDigits: 2 })}`) || []),
      '------------------------------------------------------------------------',
      `TOTAL AMOUNT PAID:                           ₱${fee.toLocaleString('en-PH', { minimumFractionDigits: 2 })}`,
      '------------------------------------------------------------------------',
      '',
      'STATUS: PAID & VALIDATED',
      'Application has been advanced to Bureau Review and Processing.',
      'Keep this receipt for your records.',
      '========================================================================',
    ].join('\n');
    download(orContent, `${receiptNo}-${shortId(app.id)}.txt`);
  }

  async function template(){const x=await import('xlsx');const wb=x.utils.book_new();x.utils.book_append_sheet(wb,x.utils.aoa_to_sheet([['Given name','Last name','Date of birth (YYYY-MM-DD)','Nationality','Passport number','Passport expiry (YYYY-MM-DD)','Vessel name','Voyage number','Travel date (YYYY-MM-DD)']]),'Passengers');x.writeFile(wb,'BI-cruise-passenger-template.xlsx')}

  async function exportToExcel(apps: Application[]){
    if(!apps.length){
      toast.error('No applications to export.');
      return;
    }
    try{
      const x=await import('xlsx');
      const rows=apps.map(a=>{
        const fullName=[a.data?.firstName,a.data?.middleName,a.data?.lastName].filter(Boolean).join(' ')||'—';
        const passport=a.data?.passportNumber||a.data?.guardianPassport||'—';
        const travel=[a.data?.direction,a.data?.flightNumber||a.data?.vesselName,a.data?.travelDate?formatDate(a.data.travelDate):''].filter(Boolean).join(' · ')||'—';
        const port=a.data?.port||a.data?.portOfArrival||a.data?.portOfDeparture||'—';
        return {
          'Reference No.':a.id,
          'Service':serviceName(a.service),
          'Status':a.status,
          'Passport No.':passport,
          'Applicant Name':fullName,
          'Nationality':a.data?.nationality||a.data?.passportCountry||'—',
          'Date of Birth':a.data?.birthDate?formatDate(a.data.birthDate):'—',
          'Gender':a.data?.sex||a.data?.gender||'—',
          'Email':a.data?.email||'—',
          'Mobile Number':a.data?.mobileNumber||a.data?.contactNumber||'—',
          'Travel Details':travel,
          'Port':port,
          'Date Submitted':a.created?formatDateTime(a.created):'—',
          'Last Updated':a.updated?formatDateTime(a.updated):'—',
        };
      });
      const ws=x.utils.json_to_sheet(rows);
      ws['!cols']=[
        {wch:38},
        {wch:22},
        {wch:14},
        {wch:14},
        {wch:28},
        {wch:16},
        {wch:14},
        {wch:10},
        {wch:26},
        {wch:16},
        {wch:26},
        {wch:22},
        {wch:22},
        {wch:22},
      ];
      const wb=x.utils.book_new();
      x.utils.book_append_sheet(wb,ws,'Queue Applications');
      const dateStr=new Date().toISOString().slice(0,10);
      x.writeFile(wb,`BI-application-report-${dateStr}.xlsx`);
      toast.success('Application report exported to Excel (.xlsx).');
    }catch(e:any){
      toast.error('Could not export to Excel: '+(e?.message||'Unknown error'));
    }
  }

  const title=service?service.name:view==='Overview'?'Welcome to your eServices.':view;
  const subtitle:Record<string,string>={'All services':'Find the right service for your next step.','My applications':'Manage drafts and follow the progress of your applications.','Payments':'View assessments, payment status, and receipts.','My documents':'Your uploaded documents, organized by application.','Notifications':'Application updates and activity in one place.','My profile':'Keep your details ready for your next application.','Back office':'Review, evaluate, and manage submitted applications.','Help center':'A little guidance for every step.'};
  const filtered=applications.filter(a=>(filter==='All'||a.status===filter)&&(serviceName(a.service)+' '+a.id).toLowerCase().includes(query.toLowerCase()));

  return (
    <SidebarProvider>
      <Toaster position="top-right"/>
      <AuthModal
        open={authOpen}
        onOpenChange={setAuthOpen}
        defaultTab={authTab}
        onSuccess={(newUser) => {
          setUser(newUser);
          refresh();
        }}
      />
      <Sidebar>
        <SidebarHeader>
          <div className="brand">
            <img src="/bi-seal.jpg" alt="Bureau of Immigration Official Seal" className="brand-logo"/>
            <div>
              <small>REPUBLIC OF THE PHILIPPINES</small>
              <strong>Bureau of<br/>Immigration</strong>
            </div>
          </div>
          <div className="portal-label">eSERVICES PORTAL</div>
        </SidebarHeader>
        <SidebarContent>
          <SidebarNav view={view} onNavigate={navigate} unread={activity.filter(a=>!a.seen).length}/>
          <div className="side-help">
            <CircleHelp/>
            <strong>A little guidance?</strong>
            <p>Find help with your next application.</p>
            <button onClick={()=>navigate('Help center')}>Visit help center <ArrowUpRight size={16}/></button>
          </div>
        </SidebarContent>
        <SidebarFooter>
          <SidebarMenuButton onClick={()=>navigate('Back office')}><ClipboardCheck/>Officer workspace</SidebarMenuButton>
          <SidebarMenuButton onClick={()=>navigate('My profile')}><UserRound/>My profile</SidebarMenuButton>
          <div className="side-bottom"><ShieldCheck size={15}/> Personal, secure workspace</div>
        </SidebarFooter>
      </Sidebar>
      <main className="workspace">
        <a className="skip-link" href="#main-content">Skip to content</a>
        <header className="topbar">
          <div>
            <SidebarTrigger/>
            <span>Personal workspace</span>
            <ChevronRight size={14}/>
            <strong>{view}</strong>
          </div>
          <div className="flex items-center gap-3">
            {user ? (
              <>
                <button className="icon-button" aria-label="Notifications" onClick={()=>navigate('Notifications')}>
                  <Bell size={20}/>
                </button>
                <div className="flex items-center gap-2 px-2 py-1 rounded-full bg-[#edf3fb] border border-[#d6e2f0]">
                  <button className="avatar" aria-label="My profile" onClick={()=>navigate('My profile')}>
                    {(profile.firstName?.[0]||user.displayName?.[0]||user.name?.[0]||'U').toUpperCase()}
                    {(profile.lastName?.[0]||user.displayName?.split(' ')?.[1]?.[0]||'').toUpperCase()}
                  </button>
                  <div className="hidden sm:block text-left pr-1">
                    <span className="block text-xs font-semibold text-[#173b69] leading-tight">
                      {user.displayName || user.name || user.email}
                    </span>
                    <span className="block text-[10px] text-[#6b829c] capitalize">
                      {user.role === 'reviewer' ? '👮 Officer' : '👤 Applicant'}
                    </span>
                  </div>
                </div>
                <button
                  onClick={handleLogout}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-[#cfdae7] text-xs font-semibold text-[#375270] hover:bg-[#eef4fb] transition cursor-pointer"
                  title="Sign out of account"
                >
                  <LogOut size={14}/>
                  <span className="hidden md:inline">Sign out</span>
                </button>
              </>
            ) : (
              <div className="flex items-center gap-2">
                <button
                  onClick={() => openAuth('login')}
                  className="flex items-center gap-1.5 px-3 py-2 rounded-lg border border-[#cfdae7] text-xs font-semibold text-[#173b69] hover:bg-[#edf3fb] transition cursor-pointer"
                >
                  <LogIn size={15}/>
                  <span>Sign In</span>
                </button>
                <button
                  onClick={() => openAuth('signup')}
                  className="flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-[#173b69] text-white text-xs font-semibold hover:bg-[#102746] shadow-sm transition cursor-pointer"
                >
                  <UserPlus size={15}/>
                  <span>Sign Up</span>
                </button>
              </div>
            )}
          </div>
        </header>
        <div className="page-content" id="main-content">
          <div className="page-heading">
            <div>
              <p className="eyebrow">YOUR IMMIGRATION JOURNEY</p>
              <h1>{title}</h1>
              <p>{service?'Complete each step. Save a draft whenever you need a break.':view==='Overview'?'Everything you need for your next step, in one place.':subtitle[view]}</p>
            </div>
            {!service&&<button className="primary" onClick={()=>navigate('All services')}><Plus size={18}/> New application</button>}
          </div>
          <div className="preview-note">
            <ShieldCheck size={17}/> Preview environment · Applications here are stored securely in your local DynamoDB & S3 workspace.
          </div>
          {error&&<div role="alert" className="error-box">{error}<button onClick={refresh}>Try again</button></div>}

          {view==='Overview'&&<Overview applications={applications} setView={navigate} onOpen={open} onStart={start}/>}
          {view==='All services'&&<><div className="filter-toolbar"><label className="search-box"><Search size={18}/><input placeholder="Search immigration services…" aria-label="Search services" value={query} onChange={e=>setQuery(e.target.value)}/></label><span className="muted">{services.length} services available</span></div><Tabs value={filter} onValueChange={setFilter}><TabsList className="category-tabs">{['All','Travel','Stay','Study','Citizenship','Organization'].map(c=><TabsTrigger key={c} value={c}>{c}</TabsTrigger>)}</TabsList></Tabs><div className="catalog">{services.filter(s=>(filter==='All'||s.category===filter)&&(s.name+' '+s.description).toLowerCase().includes(query.toLowerCase())).map(s=>{const Icon=icons[s.icon];return <button className="service-card" key={s.id} onClick={()=>start(s.id)}><span className="soft-icon"><Icon/></span><span className="category-label">{s.category}</span><h3>{s.name}</h3><p>{s.description}</p><span className="start-link">Start application <ArrowRight size={15}/></span></button>})}</div>{!services.some(s=>(filter==='All'||s.category===filter)&&(s.name+' '+s.description).toLowerCase().includes(query.toLowerCase()))&&<Empty title="No matching services" description="Try another search or choose a different category."/>}</>}
          {view==='My applications'&&<><div className="filter-toolbar"><label className="search-box"><Search size={18}/><input placeholder="Search by service or reference…" aria-label="Search applications" value={query} onChange={e=>setQuery(e.target.value)}/></label><Choice value={filter} onChange={setFilter} options={['All','Draft','For payment','Submitted','Under review','For correction','Approved','Disapproved','Endorsed']} label="Filter application status"/><button className="icon-button" aria-label="Refresh applications" onClick={refresh}><RefreshCw size={17}/></button></div><section className="panel">{loading?<Empty title="Loading your applications…"/>:filtered.length?<ApplicationList applications={filtered} onOpen={open}/>:<Empty title={applications.length?'No matching applications':'Your next chapter starts here'} description={applications.length?'Try another search or status.':'Choose a service to start your first application.'} action={()=>navigate('All services')} actionLabel="Explore services"/>}</section></>}
          {service&&<div className="application-layout"><aside className="steps-panel"><p className="eyebrow">YOUR APPLICATION</p>{[...service.sections.map(s=>s.title),'Documents','Review & submit'].map((label,i)=><button key={label} className={'step '+(i===step?'current':'')} onClick={()=>setStep(i)}><span>{i<step?<Check size={14}/>:i+1}</span>{label}</button>)}<div className="draft-note"><Save size={17}/><p>{selected?'Draft '+shortId(selected.id):'Your draft will appear in My applications once saved.'}</p></div></aside><section className="panel application-form"><div className="form-top"><span>STEP {step+1} OF {service.sections.length+2}</span><Progress value={(step+1)/(service.sections.length+2)*100}/></div>{!user&&!loading&&<div className="signin-notice"><LockKeyhole size={20}/><div><strong>Sign in to save your application</strong><p>Sign in with your email or register a new account to keep your application saved.</p><button type="button" onClick={()=>openAuth('login')} className="text-button">Sign in to workspace <ArrowRight size={15}/></button></div></div>}{step<service.sections.length?<form onKeyDown={handleFormKeyDown} onSubmit={e=>{e.preventDefault();const missing=service.sections[step].fields.filter(f=>f.required&&!data[f.key]?.trim());if(missing.length){toast.error('Complete '+missing.map(f=>f.label).join(', '));return;}const invalidPassport=service.sections[step].fields.filter(f=>(f.key==='passportNumber'||f.key==='guardianPassport')&&data[f.key]?.trim()&&data[f.key]?.trim().length!==9);if(invalidPassport.length){toast.error(invalidPassport.map(f=>f.label).join(', ')+' must be exactly 9 characters');return;}setStep(step+1)}}><h2>{service.sections[step].title}</h2><p className="form-hint">Fields marked with * are required.</p>{service.sections[step].title==='Philippine residential address'?<ResidentialAddress data={data} onChange={setData}/>:<div className="fields-grid">{service.sections[step].fields.map(f=><FieldInput key={f.key} field={f} value={data[f.key]||''} onChange={v=>setData({...data,[f.key]:v})}/>)}</div>}<FormActions step={step} busy={busy} back={()=>setStep(Math.max(0,step-1))} save={saveDraft}/></form>:step===service.sections.length?<><h2>Upload your documents</h2><p className="form-hint">Use PDF, JPG, or PNG, up to 10 MB per file. Upload sample documents in this preview.</p>{service.id==='cruise-waiver'&&<div className="info-box"><FileText size={20}/><div><strong>Passenger manifest</strong><p>Download the XLSX template, complete it, and upload one or more files, up to 101 MB each.</p><button className="text-button" onClick={template}><Download size={15}/> Download XLSX template</button></div></div>}<div className="upload-list">{service.documents.map(kind=>{const matchingDocs=documents.filter(d=>(selected?.id?d.application===selected.id:false)&&d.kind===kind);const isUploaded=matchingDocs.length>0;return <div className={'upload-card '+(isUploaded?'uploaded':'')} key={kind}><div><span className={'soft-icon '+(isUploaded?'soft-icon-success':'')}>{isUploaded?<CheckCircle2 size={20}/>:<FileText size={20}/>}</span><div style={{minWidth:0,flex:1}}><div style={{display:'flex',alignItems:'center',gap:'8px',flexWrap:'wrap'}}><strong>{kind} *</strong>{isUploaded?<span className="status status-approved" style={{fontSize:'11px',padding:'2px 8px'}}><Check size={12}/> Uploaded</span>:<span className="status" style={{fontSize:'11px',padding:'2px 8px'}}>Required</span>}</div>{matchingDocs.length>0?<div style={{marginTop:'6px',display:'flex',flexDirection:'column',gap:'4px'}}>{matchingDocs.map(d=><div key={d.id} style={{display:'flex',alignItems:'center',gap:'8px',flexWrap:'wrap'}}><a className="uploaded-file" href={'/api/documents?id='+d.id} title={'Download '+d.name}><CheckCircle2 size={14}/><span>{d.name}</span>{d.size?<span className="file-size">({(d.size/1024).toFixed(1)} KB)</span>:null}<Download size={13}/></a></div>)}</div>:<p style={{margin:'4px 0 0',fontSize:'12.5px',color:'#7f90a2'}}>No file uploaded yet</p>}</div></div><label className={'secondary upload-button '+(busy?'disabled':'')+(isUploaded?' is-replace':'')}>{isUploaded?<RefreshCw size={14}/>:<Upload size={14}/>}{busy?'Please wait':isUploaded?'Replace file':'Upload'}<input disabled={busy} type="file" aria-label={(isUploaded?'Replace ':'Upload ')+kind} accept={kind.includes('.xlsx')?'.xlsx':kind==='Facial image'?'.jpg,.jpeg,.png':'.pdf,.jpg,.jpeg,.png'} multiple={kind.includes('.xlsx')} onChange={e=>{uploadFiles(e.target.files,kind);e.target.value=''}}/></label></div>})}</div><FormActions step={step} busy={busy} back={()=>setStep(step-1)} save={saveDraft} next={()=>setStep(step+1)}/></>:<div className="review-step-container" onKeyDown={handleReviewKeyDown}><h2>Review your application</h2><p className="form-hint">Make sure the details and documents are correct before submitting.</p>{service.sections.map((s,i)=><div className="review-section" key={s.title}><div className="section-heading"><h3>{s.title}</h3><button className="text-button" onClick={()=>setStep(i)}>Edit</button></div><dl>{s.fields.map(f=>{const val=data[f.key];const display=f.type==='date'&&val?formatDate(val):val;return <div key={f.key}><dt>{f.label}</dt><dd>{display||<span className="missing">{f.required?'Not provided':'—'}</span>}</dd></div>;})}</dl></div>)}<div className="review-section"><h3>Documents</h3>{service.documents.map(kind=><p className="document-check" key={kind}>{documents.some(d=>d.application===selected?.id&&d.kind===kind)?<CheckCircle2 size={16}/>:<CircleHelp size={16}/>} {kind} — {documents.some(d=>d.application===selected?.id&&d.kind===kind)?'Uploaded':'Not uploaded'}</p>)}</div><label className="consent"><Checkbox checked={consent} onCheckedChange={v=>setConsent(v===true)}/><span>I have reviewed the information. I understand this submission is saved in a preview workspace and is not an official BI application.</span></label><FormActions step={step} busy={busy} back={()=>setStep(step-1)} save={saveDraft} submit={submit} canSubmit={consent&&!!user}/></div>}</section></div>}
          {view==='My documents'&&<section className="panel">{documents.length?<Table><TableHeader><TableRow><TableHead>Document</TableHead><TableHead>Application</TableHead><TableHead>Uploaded</TableHead><TableHead>Download</TableHead></TableRow></TableHeader><TableBody>{documents.map(d=><TableRow key={d.id}><TableCell><strong>{d.name}</strong><small className="reference">{d.kind} · {(d.size/1024/1024).toFixed(2)} MB</small></TableCell><TableCell>{shortId(d.application)}</TableCell><TableCell>{date(d.created)}</TableCell><TableCell><a className="text-button" href={'/api/documents?id='+d.id} aria-label={'Download '+d.name}><Download size={17}/>Download</a></TableCell></TableRow>)}</TableBody></Table>:<Empty icon={FolderOpen} title="Your documents, all together" description="Upload supporting documents from an application. They will appear here." action={()=>navigate('My applications')} actionLabel="Go to applications"/>}</section>}
          {view==='Payments'&&(()=>{
            const awaitingPaymentApps = applications.filter(a => a.status.toLowerCase() === 'for payment');
            const paidApps = applications.filter(a => a.data?.paidAt || a.data?.receiptNo);
            const totalAwaitingAmount = awaitingPaymentApps.reduce((acc, a) => acc + (SERVICE_FEES[a.service]?.amount || 0), 0);
            const totalPaidAmount = paidApps.reduce((acc, a) => acc + (SERVICE_FEES[a.service]?.amount || Number(a.data?.feeAmount) || 0), 0);

            return (
              <>
                <div className="stats payment-stats">
                  <div className="stat">
                    <span>Awaiting payment</span>
                    <strong>{awaitingPaymentApps.length}</strong>
                    <small>{totalAwaitingAmount > 0 ? `₱${totalAwaitingAmount.toLocaleString('en-PH', { minimumFractionDigits: 2 })} assessed` : 'No pending assessments'}</small>
                  </div>
                  <div className="stat">
                    <span>Paid transactions</span>
                    <strong>{paidApps.length}</strong>
                    <small>{totalPaidAmount > 0 ? `₱${totalPaidAmount.toLocaleString('en-PH', { minimumFractionDigits: 2 })} settled` : 'No payments yet'}</small>
                  </div>
                  <div className="stat">
                    <span>Receipts available</span>
                    <strong>{paidApps.filter(a => a.data?.receiptNo).length}</strong>
                    <small>Official Bureau receipts</small>
                  </div>
                </div>

                <div className="section-heading mt-6 mb-3">
                  <div>
                    <h2 className="text-base font-bold text-[#10243e] flex items-center gap-2">
                      <CreditCard size={18} className="text-[#dfaa2c]" /> Assessments Awaiting Payment
                    </h2>
                    <p className="text-xs text-[#6e85a0] mt-0.5">Government fees must be settled to advance your application to officer evaluation.</p>
                  </div>
                  {awaitingPaymentApps.length > 0 && (
                    <span className="status status-for-payment text-xs px-2.5 py-1 font-semibold">
                      {awaitingPaymentApps.length} pending
                    </span>
                  )}
                </div>

                <section className="panel mb-8">
                  {awaitingPaymentApps.length ? (
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Application & Service</TableHead>
                          <TableHead>Applicant</TableHead>
                          <TableHead>Fee Assessment</TableHead>
                          <TableHead>Date Filed</TableHead>
                          <TableHead className="text-right">Action</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {awaitingPaymentApps.map(a => {
                          const s = services.find(srv => srv.id === a.service);
                          const fee = SERVICE_FEES[a.service];
                          const applicantName = [a.data?.firstName, a.data?.lastName].filter(Boolean).join(' ') || 'Applicant';
                          const pass = a.data?.passportNumber || a.data?.guardianPassport;
                          return (
                            <TableRow key={a.id}>
                              <TableCell>
                                <div><strong>{s?.name || a.service}</strong></div>
                                <div className="flex items-center gap-2 mt-0.5">
                                  <small className="reference font-mono">{shortId(a.id)}</small>
                                  <span className="status status-for-payment text-[11px] px-2 py-0.5">For payment</span>
                                </div>
                              </TableCell>
                              <TableCell>
                                <div className="font-medium text-sm text-[#18304c]">{applicantName}</div>
                                {pass && <small className="text-xs text-[#677e9b] font-mono">🛂 {pass}</small>}
                              </TableCell>
                              <TableCell>
                                <div className="text-base font-bold text-[#15345d]">
                                  ₱{fee ? fee.amount.toLocaleString('en-PH', { minimumFractionDigits: 2 }) : '0.00'}
                                </div>
                                <small className="text-[11px] text-[#7187a2]">Prescribed BI Fee</small>
                              </TableCell>
                              <TableCell className="text-sm text-[#5d738f]">{date(a.updated)}</TableCell>
                              <TableCell className="text-right">
                                <button
                                  className="primary text-xs py-2 px-3.5 inline-flex items-center gap-1.5 cursor-pointer bg-[#dfaa2c] text-[#0f2035] hover:bg-[#c99723] border-0 font-bold"
                                  onClick={() => setPaymentModalApp(a)}
                                >
                                  <CreditCard size={14} /> Pay assessment
                                </button>
                              </TableCell>
                            </TableRow>
                          );
                        })}
                      </TableBody>
                    </Table>
                  ) : (
                    <Empty
                      icon={CreditCard}
                      title="No assessments awaiting payment"
                      description="When you file applications requiring prescribed fees (Student Visa, Special Study Permit, Annual Report, Cruise Waiver, Dual Citizenship, or WEG), your payment assessments will appear here."
                    />
                  )}
                </section>

                <div className="section-heading mt-8 mb-3">
                  <div>
                    <h2 className="text-base font-bold text-[#10243e] flex items-center gap-2">
                      <ClipboardCheck size={18} className="text-emerald-700" /> Settled Transactions & Receipts
                    </h2>
                    <p className="text-xs text-[#6e85a0] mt-0.5">Electronic official receipts (OR) issued for confirmed government collections.</p>
                  </div>
                  {paidApps.length > 0 && (
                    <span className="status status-approved text-xs px-2.5 py-1 font-semibold">
                      {paidApps.length} settled
                    </span>
                  )}
                </div>

                <section className="panel mb-8">
                  {paidApps.length ? (
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Official Receipt #</TableHead>
                          <TableHead>Application</TableHead>
                          <TableHead>Amount & Channel</TableHead>
                          <TableHead>Payment Date</TableHead>
                          <TableHead className="text-right">Official Receipt</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {paidApps.map(a => {
                          const s = services.find(srv => srv.id === a.service);
                          const fee = SERVICE_FEES[a.service]?.amount || Number(a.data?.feeAmount) || 0;
                          return (
                            <TableRow key={a.id}>
                              <TableCell>
                                <div className="font-mono font-bold text-emerald-800 text-sm">{a.data?.receiptNo || 'OR-2026-PENDING'}</div>
                                <small className="reference">{shortId(a.id)}</small>
                              </TableCell>
                              <TableCell>
                                <strong>{s?.name || a.service}</strong>
                                <span className="block text-xs text-[#677e9b]">{[a.data?.firstName, a.data?.lastName].filter(Boolean).join(' ') || '—'}</span>
                              </TableCell>
                              <TableCell>
                                <strong className="text-sm">₱{fee.toLocaleString('en-PH', { minimumFractionDigits: 2 })}</strong>
                                <span className="block text-xs text-[#526f91]">{a.data?.paymentChannel || 'Land Bank of the Philippines'}</span>
                              </TableCell>
                              <TableCell className="text-sm text-[#5d738f]">{formatDateTime(a.data?.paidAt || a.updated)}</TableCell>
                              <TableCell className="text-right">
                                <button
                                  className="secondary text-xs py-1.5 px-3 inline-flex items-center gap-1.5 cursor-pointer"
                                  onClick={() => downloadReceipt(a)}
                                >
                                  <Download size={13} /> Download OR
                                </button>
                              </TableCell>
                            </TableRow>
                          );
                        })}
                      </TableBody>
                    </Table>
                  ) : (
                    <Empty
                      icon={FileText}
                      title="No payment receipts yet"
                      description="Official Receipts will be generated here upon completing assessment payments."
                    />
                  )}
                </section>

                <h2 className="spaced-heading">Authorized Payment Channels</h2>
                <div className="integration-grid">
                  <div className="integration-card">
                    <CreditCard size={22} className="text-[#1e487a]" />
                    <h3>Land Bank of the Philippines</h3>
                    <span className="status status-approved font-semibold" style={{ background: '#e6f4ed', color: '#286b4a' }}>
                      ● Operational (ePayment Portal / Link.Biz)
                    </span>
                    <p>Official government depository bank. Accepts BancNet ATM, LandBank ATM/Pay, and over-the-counter payments.</p>
                  </div>
                  <div className="integration-card">
                    <CreditCard size={22} className="text-emerald-600" />
                    <h3>Maya</h3>
                    <span className="status status-approved font-semibold" style={{ background: '#e6f4ed', color: '#286b4a' }}>
                      ● Operational (Maya Checkout / QR Ph)
                    </span>
                    <p>BSP-licensed digital payments and QR Ph partner. Settle instantly via Maya wallet or Visa/Mastercard.</p>
                  </div>
                </div>
              </>
            );
          })()}
          {view==='Notifications'&&<section className="panel"><div className="section-heading"><h2>Recent activity</h2><button className="text-button" onClick={async()=>{try{await api('read');await refresh();toast.success('Notifications marked as read')}catch(e){toast.error((e as Error).message)}}} disabled={!activity.some(a=>!a.seen)}>Mark all as read <Check size={16}/></button></div>{activity.length?<div className="activity-list">{activity.map(a=><div className={'activity-item '+(!a.seen?'unread':'')} key={a.id}><span className="soft-icon"><Bell/></span><div><strong>{a.action}</strong><p>{a.note||'Your workspace has been updated.'}</p><small>{date(a.created)}{a.application?' · '+shortId(a.application):''}</small></div></div>)}</div>:<Empty icon={Bell} title="You’re all caught up" description="Your application updates will appear here."/>}</section>}
          {view==='My profile'&&<div className="profile-layout"><section className="panel profile-form"><h2>Personal details</h2><p className="form-hint">Saved information helps you complete future applications.</p><form onSubmit={async e=>{e.preventDefault();setBusy(true);try{await api('profile',{data:profile});await refresh();toast.success('Profile updated')}catch(e){toast.error((e as Error).message)}finally{setBusy(false)}}}><div className="fields-grid">{services[0].sections.find(s=>s.title==='Personal information')!.fields.filter(f=>f.key!=='email').map(f=><FieldInput key={f.key} field={{...f,required:false}} value={profile[f.key]||''} onChange={v=>setProfile({...profile,[f.key]:v})}/>)}</div><h2 className="spaced-heading">Philippine residential address</h2><ResidentialAddress data={profile} onChange={setProfile} required={false}/><button className="primary" disabled={busy||!user}>Save profile</button></form></section><aside><section className="panel account-card"><LockKeyhole/><h2>Account & security</h2><p className="font-medium text-[#173b69]">{user?.displayName || user?.email || 'You are not signed in.'}</p><small className="text-[#657c96] block mb-3">{user ? `Email: ${user.email} (${user.role === 'reviewer' ? 'Officer' : 'Applicant'})` : 'Sign in to sync applications across devices.'}</small>{user?<button onClick={handleLogout} className="text-button cursor-pointer"><LogOut size={16}/> Sign out</button>:<div className="flex flex-col gap-2"><button onClick={()=>openAuth('login')} className="text-button cursor-pointer font-semibold"><LogIn size={15}/> Sign in to workspace</button><button onClick={()=>openAuth('signup')} className="text-button cursor-pointer text-[#173b69]"><UserPlus size={15}/> Create new account</button></div>}<hr/><p>Registered accounts are persisted in DynamoDB / S3 storage. You can register multiple applicant and reviewer accounts.</p></section></aside></div>}
          {view==='Back office'&&(user?.role==='reviewer'?<>
            <div className="filter-toolbar flex flex-wrap items-center justify-between gap-3">
              <div className="flex flex-1 items-center gap-3 min-w-[280px]">
                <label className="search-box flex-1">
                  <Search size={18}/>
                  <input
                    placeholder="Search by passport number, applicant name, or reference…"
                    aria-label="Search applications in queue"
                    value={backOfficeQuery}
                    onChange={e=>setBackOfficeQuery(e.target.value)}
                  />
                  {backOfficeQuery&&<button type="button" className="icon-button" onClick={()=>setBackOfficeQuery('')} aria-label="Clear search"><X size={15}/></button>}
                </label>
                <Choice
                  value={backOfficeStatus}
                  onChange={setBackOfficeStatus}
                  options={['All','For payment','Submitted','Under review','For correction','Approved','Disapproved','Endorsed']}
                  label="Filter application status"
                />
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={()=>setScannerOpen(true)}
                  className="primary flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-semibold shadow-sm cursor-pointer"
                >
                  <ScanLine size={16}/>
                  <span>Scan Passport</span>
                </button>
                <button
                  type="button"
                  className="icon-button"
                  aria-label="Refresh processing queue"
                  onClick={()=>refreshBackOffice()}
                >
                  <RefreshCw size={17}/>
                </button>
                <button
                  type="button"
                  className="text-button flex items-center gap-1.5 cursor-pointer"
                  onClick={()=>exportToExcel(filteredReviewApps)}
                >
                  <FileSpreadsheet size={16}/> Export Excel
                </button>
              </div>
            </div>

            <section className="panel">
              <div className="section-heading mb-3 flex items-center justify-between">
                <div>
                  <h2>Processing queue</h2>
                  <small className="text-slate-500">
                    {filteredReviewApps.length} of {reviewApps.length} applications
                    {backOfficeQuery?` matching "${backOfficeQuery}"`:''}
                  </small>
                </div>
              </div>
              {filteredReviewApps.length?<ApplicationList applications={filteredReviewApps} onOpen={a=>setDetail(a)}/>:<Empty
                title={reviewApps.length?"No matching applications":"No applications in the queue"}
                description={reviewApps.length?"Try searching for a different passport number, applicant name, or clear the search filter.":"Submitted applications will appear here for officer evaluation."}
                action={backOfficeQuery||backOfficeStatus!=='All'?()=>{setBackOfficeQuery('');setBackOfficeStatus('All');}:undefined}
                actionLabel="Clear filters"
              />}
            </section>
          </>:<section className="panel"><Empty icon={LockKeyhole} title="Officer access required" description="This workspace is reserved for authorized reviewers. Sign in with an Immigration Officer account (e.g. officer@bi.gov.ph) to review live applications."/><div className="integration-status"><button onClick={()=>{setAuthTab('login');setAuthOpen(true)}} className="primary mt-3"><LogIn size={15}/> Sign in as Officer</button></div></section>)}
          {view==='Help center'&&<><div className="help-layout"><section className="panel faq-list"><h2>How can we help?</h2>{[['How do I create an account?','Click Sign Up in the top right or within the profile view to register your personal applicant account with email, name, and contact details.'],['How do I start an application?','Open All services, select a service, and complete each step. Your profile information can be reused in new applications.'],['Can I finish my application later?','Yes. Select Save draft at any step. You can continue from My applications after signing in to your account.'],['How do I upload a document?','Open your application and choose the Documents step. Upload a PDF, JPG, or PNG file up to 10 MB. Cruise passenger manifests accept XLSX files up to 101 MB, with multiple uploads.'],['How do I track an application?','Open My applications to see the current status and processing history. Status updates refresh every 30 seconds while the workspace is open.'],['Can I review applications as an officer?','Yes! Sign in with the demo officer account (officer@bi.gov.ph / Officer@1234) or register an Immigration Officer role to review, evaluate, approve, or request corrections on submitted applications.']].map(([q,a])=><details key={q}><summary>{q}</summary><p>{a}</p></details>)}</section><aside className="journey-card"><CircleHelp/><h2>One step<br/>at a time.</h2><p>You can save a draft at any stage and return when you have everything you need.</p><button onClick={()=>navigate('All services')}>Explore services <ArrowRight size={17}/></button></aside></div><h2 className="spaced-heading">Connected services</h2><div className="integration-grid">{['eGovPH SSO','PhilSys','BIIS Portal','Visitor appointments (VAMS)','Email & SMS notifications'].map(s=><div className="integration-card" key={s}><h3>{s}</h3><span className="status">{s.includes('VAMS')?'Future integration':'Not connected'}</span></div>)}</div></>}
          <footer>© 2026 Bureau of Immigration <span>eServices application preview</span></footer>
        </div>
      </main>
      <Dialog open={!!detail} onOpenChange={v=>{if(!v){setDetail(null);setReviewNote('')}}}>
        <DialogContent className="detail-dialog">
          <DialogHeader>
            <DialogTitle>{detail&&serviceName(detail.service)}</DialogTitle>
            <DialogDescription>{detail?.id}</DialogDescription>
          </DialogHeader>
          {detail&&<>
            <span className={'status status-'+detail.status.toLowerCase().replaceAll(' ','-')}>{detail.status}</span>
            {detail.status === 'For payment' && (
              <div className="bg-amber-50 border border-amber-300 rounded-xl p-4 my-3 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 shadow-xs">
                <div>
                  <strong className="text-sm text-amber-950 block">Government Fee Assessment Issued</strong>
                  <span className="text-xs text-amber-900 block mt-0.5">
                    Prescribed fee: <strong>₱{SERVICE_FEES[detail.service]?.amount ? SERVICE_FEES[detail.service].amount.toLocaleString('en-PH', { minimumFractionDigits: 2 }) : '0.00'}</strong>. Awaiting payment before officer evaluation.
                  </span>
                </div>
                <button
                  type="button"
                  className="primary text-xs py-2 px-3.5 bg-[#dfaa2c] text-[#0e2137] hover:bg-[#c99723] border-0 font-bold flex items-center gap-1.5 cursor-pointer whitespace-nowrap"
                  onClick={() => {
                    setDetail(null);
                    setPaymentModalApp(detail);
                  }}
                >
                  <CreditCard size={14} /> Pay assessment now
                </button>
              </div>
            )}
            {detail.data?.receiptNo && (
              <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-3.5 my-3 flex items-center justify-between gap-3 text-xs text-emerald-950 shadow-xs">
                <div className="flex items-center gap-2">
                  <CheckCircle2 size={16} className="text-emerald-600 flex-shrink-0" />
                  <div>
                    <span>Official Receipt: <strong className="font-mono">{detail.data.receiptNo}</strong></span>
                    <span className="block text-[11px] text-[#55708f]">Paid via {detail.data.paymentChannel || 'Land Bank'} · {formatDateTime(detail.data.paidAt || detail.updated)}</span>
                  </div>
                </div>
                <button
                  type="button"
                  className="secondary text-xs py-1.5 px-3 inline-flex items-center gap-1 cursor-pointer"
                  onClick={() => downloadReceipt(detail)}
                >
                  <Download size={13} /> Receipt
                </button>
              </div>
            )}
            <div className="info-box">
              <ShieldCheck size={20}/>
              <p>Preview record only. This is not an official immigration confirmation.</p>
            </div>
            {qr&&<div className="qr-card">
              <img src={qr} width={180} height={180} alt="Preview travel reference QR code"/>
              <div>
                <h3>Travel reference</h3>
                <p>This QR identifies a preview record. It is not valid for immigration clearance.</p>
                <a className="text-button" href={qr} download={'preview-'+detail.id+'.png'}><Download size={16}/> Download preview QR</a>
              </div>
            </div>}
            <div className="review-section">
              <h3>Application details</h3>
              <dl>{Object.entries(detail.data).map(([key,value])=>{const fieldDef=services.find(s=>s.id===detail.service)?.sections.flatMap(s=>s.fields).find(f=>f.key===key);const isDateField=fieldDef?.type==='date'||key.toLowerCase().includes('date')||key.toLowerCase().includes('expiry');const displayVal=isDateField&&value?formatDate(value as string):(value as string);return <div key={key}><dt>{fieldDef?.label||key}</dt><dd>{displayVal||'—'}</dd></div>;})}</dl>
            </div>
            <h3>Submitted documents</h3>
            <div className="detail-documents">{detailDocs.map(d=><a className="uploaded-file" key={d.id} href={'/api/documents?id='+d.id}><FileText size={16}/>{d.name}<Download size={15}/></a>)}</div>
            <h3>Processing history</h3>
            <div className="timeline">{[...detailActivity].reverse().map(a=><div key={a.id}><strong>{a.action}</strong><p>{a.note}</p><small>{date(a.created)}</small></div>)}</div>
            <button className="secondary" onClick={()=>download('BUREAU OF IMMIGRATION — PREVIEW CONFIRMATION\nNot valid for immigration clearance or payment.\n\nReference: '+detail.id+'\nService: '+serviceName(detail.service)+'\nStatus: '+detail.status+'\nSaved: '+formatDateTime(detail.created)+'\n','preview-confirmation-'+shortId(detail.id)+'.txt')}><Download size={16}/> Download confirmation</button>
            {user?.role==='reviewer'&&<div className="reviewer-actions">
              <label htmlFor="review-note">Processing note</label>
              <textarea id="review-note" value={reviewNote} onChange={e=>setReviewNote(e.target.value)} placeholder="Explain the processing decision"/>
              <div>{['Under review','For correction','Approved','Disapproved','Endorsed'].map(status=><button className="secondary" key={status} disabled={busy||!reviewNote.trim()} onClick={async()=>{setBusy(true);try{await api('review',{id:detail.id,status,note:reviewNote});setDetail(null);await refresh();navigate('Back office');toast.success('Processing action recorded')}catch(e){toast.error((e as Error).message)}finally{setBusy(false)}}}>{status}</button>)}</div>
            </div>}
          </>}
        </DialogContent>
      </Dialog>
      <PassportScannerModal
        open={scannerOpen}
        onOpenChange={setScannerOpen}
        applications={reviewApps}
        onSelectApplication={a => setDetail(a)}
        onSearchQuery={q => setBackOfficeQuery(q)}
      />
      <SubmissionSuccessModal
        open={successModalOpen}
        onOpenChange={setSuccessModalOpen}
        application={submittedApp?.application || null}
        service={submittedApp?.service || null}
        documents={submittedApp?.documents || []}
        qrCode={submittedApp?.qr}
        onViewOverview={() => {
          setSuccessModalOpen(false);
          navigate('Overview');
        }}
        onViewApplications={() => {
          setSuccessModalOpen(false);
          navigate('My applications');
        }}
        onViewPayments={() => {
          setSuccessModalOpen(false);
          navigate('Payments');
        }}
        onStartNew={() => {
          setSuccessModalOpen(false);
          navigate('All services');
        }}
      />
      <Dialog open={!!paymentModalApp} onOpenChange={v => { if (!v) setPaymentModalApp(null); }}>
        <DialogContent className="detail-dialog max-w-[620px]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-xl text-[#112948]">
              <CreditCard className="text-[#dfaa2c]" size={24} /> Government Fee Assessment
            </DialogTitle>
            <DialogDescription>
              Bureau of Immigration Assessment & Payment Settlement
            </DialogDescription>
          </DialogHeader>

          {paymentModalApp && (() => {
            const s = services.find(srv => srv.id === paymentModalApp.service);
            const fee = SERVICE_FEES[paymentModalApp.service];
            const applicantName = [paymentModalApp.data?.firstName, paymentModalApp.data?.lastName].filter(Boolean).join(' ') || 'Applicant';
            const pass = paymentModalApp.data?.passportNumber || paymentModalApp.data?.guardianPassport;

            return (
              <div className="space-y-4">
                <div className="bg-[#f2f6fa] border border-[#d6e2ef] rounded-xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div>
                    <span className="text-[11px] uppercase font-bold tracking-wider text-[#637d9c] block">Application</span>
                    <strong className="text-base text-[#102947] block">{s?.name || paymentModalApp.service}</strong>
                    <span className="text-xs text-[#526f91] font-mono">{paymentModalApp.id}</span>
                  </div>
                  <div className="text-left sm:text-right">
                    <span className="text-[11px] uppercase font-bold tracking-wider text-[#637d9c] block">Applicant</span>
                    <span className="text-sm font-semibold text-[#18304c] block">{applicantName}</span>
                    {pass && <span className="text-xs font-mono text-[#5b738e]">Passport: {pass}</span>}
                  </div>
                </div>

                <div className="border border-[#dce5f0] rounded-xl p-4 bg-white">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-[#173b69] border-b border-[#edf3f9] pb-2 mb-3 flex items-center justify-between">
                    <span>Assessment Item</span>
                    <span>Amount (PHP)</span>
                  </h4>
                  <div className="space-y-2 text-sm">
                    {fee?.breakdown.map((item, idx) => (
                      <div key={idx} className="flex justify-between items-center text-[#2b4462]">
                        <span>{item.item}</span>
                        <span className="font-mono font-medium">₱{item.amount.toLocaleString('en-PH', { minimumFractionDigits: 2 })}</span>
                      </div>
                    ))}
                    <div className="pt-3 border-t border-[#e2eaf3] flex justify-between items-center text-base font-bold text-[#10243e]">
                      <span>Total Government Assessment:</span>
                      <span className="text-lg font-mono text-[#0e3b6f]">₱{fee ? fee.amount.toLocaleString('en-PH', { minimumFractionDigits: 2 }) : '0.00'}</span>
                    </div>
                  </div>
                </div>

                <div>
                  <label className="text-xs font-bold uppercase tracking-wider text-[#173b69] block mb-2">
                    Select Authorized Payment Channel
                  </label>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <button
                      type="button"
                      onClick={() => setSelectedChannel('Land Bank of the Philippines')}
                      className={`p-3 rounded-xl border text-left flex items-start gap-3 transition-all cursor-pointer ${
                        selectedChannel === 'Land Bank of the Philippines'
                          ? 'border-[#173b69] bg-[#eef4fb] ring-2 ring-[#173b69]/20'
                          : 'border-[#d6e1ed] bg-white hover:bg-[#f9fbfd]'
                      }`}
                    >
                      <div className="p-2 rounded-lg bg-white border border-[#d2dfef] text-[#173b69]">
                        <CreditCard size={20} />
                      </div>
                      <div>
                        <strong className="text-xs text-[#102947] block font-bold">Land Bank of the Philippines</strong>
                        <span className="text-[11px] text-[#5c728c] leading-tight block mt-0.5">Link.BizPortal / BancNet ATM</span>
                      </div>
                    </button>

                    <button
                      type="button"
                      onClick={() => setSelectedChannel('Maya')}
                      className={`p-3 rounded-xl border text-left flex items-start gap-3 transition-all cursor-pointer ${
                        selectedChannel === 'Maya'
                          ? 'border-emerald-600 bg-emerald-50/60 ring-2 ring-emerald-600/20'
                          : 'border-[#d6e1ed] bg-white hover:bg-[#f9fbfd]'
                      }`}
                    >
                      <div className="p-2 rounded-lg bg-white border border-[#d2dfef] text-emerald-600">
                        <CreditCard size={20} />
                      </div>
                      <div>
                        <strong className="text-xs text-[#102947] block font-bold">Maya (Maya Checkout)</strong>
                        <span className="text-[11px] text-[#5c728c] leading-tight block mt-0.5">QR Ph / Maya Wallet / Cards</span>
                      </div>
                    </button>
                  </div>
                </div>

                <div className="p-3 bg-blue-50/70 border border-blue-200/80 rounded-lg text-xs text-[#19406b] flex items-start gap-2">
                  <ShieldCheck size={16} className="text-[#19406b] flex-shrink-0 mt-0.5" />
                  <span>
                    Upon settlement, an Official Receipt (OR) will be issued. Your application will automatically advance to <strong>Submitted</strong> status for officer evaluation.
                  </span>
                </div>

                <div className="pt-3 border-t border-[#e2eaf3] flex items-center justify-end gap-3">
                  <button
                    type="button"
                    disabled={paying}
                    onClick={() => setPaymentModalApp(null)}
                    className="secondary text-xs px-4 py-2.5 cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    disabled={paying}
                    onClick={() => handlePayAssessment(paymentModalApp)}
                    className="primary text-xs px-5 py-2.5 bg-[#dfaa2c] text-[#0d1f33] hover:bg-[#c99723] font-bold border-0 cursor-pointer inline-flex items-center gap-2"
                  >
                    {paying ? <Loader2 size={15} className="animate-spin" /> : <CreditCard size={15} />}
                    {paying ? 'Processing payment…' : `Confirm & Pay ₱${fee ? fee.amount.toLocaleString('en-PH', { minimumFractionDigits: 2 }) : '0.00'}`}
                  </button>
                </div>
              </div>
            );
          })()}
        </DialogContent>
      </Dialog>
    </SidebarProvider>
  );
}
function handleFormKeyDown(e: React.KeyboardEvent<HTMLFormElement>) {
  if (e.key !== 'Tab') return;

  const form = e.currentTarget;
  const tabbables = Array.from(
    form.querySelectorAll<HTMLElement>(
      'input:not([type="hidden"]):not([disabled]):not([tabindex="-1"]), textarea:not([disabled]):not([tabindex="-1"]), select:not([disabled]):not([tabindex="-1"]), .form-actions button:not([disabled]):not([tabindex="-1"])'
    )
  ).filter(el => el.offsetWidth > 0 || el.offsetHeight > 0 || el.getClientRects().length > 0);

  if (!tabbables.length) return;

  const active = document.activeElement as HTMLElement | null;
  const actionButtons = tabbables.filter(el => el.closest('.form-actions'));
  const firstActionButton = actionButtons[0];
  const fieldElements = tabbables.filter(el => !el.closest('.form-actions'));

  if (!e.shiftKey) {
    if (active && !active.closest('.form-actions')) {
      const isLastField = active === fieldElements[fieldElements.length - 1] ||
                          fieldElements[fieldElements.length - 1]?.contains(active);
      if (isLastField && firstActionButton) {
        e.preventDefault();
        firstActionButton.focus();
      }
    }
  } else {
    if (active && active.closest('.form-actions')) {
      const btnIndex = actionButtons.indexOf(active as HTMLButtonElement);
      if (btnIndex === 0 && fieldElements.length > 0) {
        e.preventDefault();
        fieldElements[fieldElements.length - 1].focus();
      }
    }
  }
}
<<<<<<< HEAD

function handleReviewKeyDown(e: React.KeyboardEvent<HTMLDivElement>) {
  if (e.key !== 'Tab') return;
  const container = e.currentTarget;
  const checkbox = container.querySelector<HTMLElement>('button[role="checkbox"], [data-slot="checkbox"], input[type="checkbox"]');
  const actionButtons = Array.from(container.querySelectorAll<HTMLButtonElement>('.form-actions button:not([disabled])'));
  const active = document.activeElement as HTMLElement | null;
  if (!e.shiftKey) {
    if (active && checkbox && (active === checkbox || checkbox.contains(active))) {
      if (actionButtons.length) {
        e.preventDefault();
        actionButtons[0].focus();
      }
    }
  } else {
    if (active && actionButtons[0] === active && checkbox) {
      e.preventDefault();
      checkbox.focus();
    }
  }
}

function Choice({value,onChange,options,label,id}:{value:string;onChange:(v:string)=>void;options:string[];label:string;id?:string}){const selected=options.includes(value)?value:(value||null);return <div className="choice-picker"><Combobox items={options} value={selected} onValueChange={(v:string|null)=>onChange(v||'')} itemToStringLabel={(item:string)=>item||''} isItemEqualToValue={(item:string,sel:string)=>item===sel}><ComboboxInput id={id} aria-label={label} placeholder={label?`Select or search ${label.toLowerCase()}…`:'Select an option'} showClear={!!value} autoComplete="off"/><ComboboxContent className="choice-options"><ComboboxEmpty>No matching options</ComboboxEmpty><ComboboxList>{(item:string)=><ComboboxItem key={item} value={item}>{item}</ComboboxItem>}</ComboboxList></ComboboxContent></Combobox></div>;}

function DateFieldInput({field:f,value,onChange}:{field:Field;value:string;onChange:(v:string)=>void}){
  const [open,setOpen]=useState(false);
  const displayVal=toMMDDYYYY(value);
  
  const parsedDate=useMemo(()=>{
    if(!displayVal) return undefined;
    const match=displayVal.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
    if(!match) return undefined;
    const [,m,d,y]=match;
    const dateObj=new Date(Number(y),Number(m)-1,Number(d));
    return isNaN(dateObj.getTime())?undefined:dateObj;
  },[displayVal]);

  const handleTextChange=(e:React.ChangeEvent<HTMLInputElement>)=>{
    let input=e.target.value.replace(/[^\d/]/g,'');
    const digits=input.replace(/\D/g,'');
    if(digits.length<=2){input=digits;}
    else if(digits.length<=4){input=`${digits.slice(0,2)}/${digits.slice(2)}`;}
    else{input=`${digits.slice(0,2)}/${digits.slice(2,4)}/${digits.slice(4,8)}`;}
    onChange(input);
  };

  const handleSelectDate=(date:Date|undefined)=>{
    if(date){
      const mm=String(date.getMonth()+1).padStart(2,'0');
      const dd=String(date.getDate()).padStart(2,'0');
      const yyyy=date.getFullYear();
      onChange(`${mm}/${dd}/${yyyy}`);
      setOpen(false);
    }
  };

  const isBirth = f.key === 'birthDate';

  return (
    <div style={{position:'relative',display:'flex',alignItems:'center',width:'100%'}}>
=======
const title=service?service.name:view==='Overview'?'Welcome to your eServices.':view;
const subtitle:Record<string,string>={'All services':'Find the right service for your next step.','My applications':'Manage drafts and follow the progress of your applications.','Payments':'View assessments, payment status, and receipts.','My documents':'Your uploaded documents, organized by application.','Notifications':'Application updates and activity in one place.','My profile':'Keep your details ready for your next application.','Back office':'Review, evaluate, and manage submitted applications.','Help center':'A little guidance for every step.'};
const filtered=applications.filter(a=>(filter==='All'||a.status===filter)&&(serviceName(a.service)+' '+a.id).toLowerCase().includes(query.toLowerCase()));
return <SidebarProvider><Toaster position="top-right"/><Sidebar><SidebarHeader><div className="brand"><span className="brand-mark"><img src="/bi-logo.svg" alt="Bureau of Immigration" width={36} height={36}/></span><div><small>REPUBLIC OF THE PHILIPPINES</small><strong>Bureau of<br/>Immigration</strong></div></div><div className="portal-label">eSERVICES PORTAL</div></SidebarHeader><SidebarContent><SidebarNav view={view} onNavigate={navigate} unread={activity.filter(a=>!a.seen).length}/><div className="side-help"><CircleHelp/><strong>A little guidance?</strong><p>Find help with your next application.</p><button onClick={()=>navigate('Help center')}>Visit help center <ArrowUpRight size={16}/></button></div></SidebarContent><SidebarFooter><SidebarMenuButton onClick={()=>navigate('Back office')}><ClipboardCheck/>Officer workspace</SidebarMenuButton><SidebarMenuButton onClick={()=>navigate('My profile')}><UserRound/>My profile</SidebarMenuButton><div className="side-bottom"><ShieldCheck size={15}/> Personal, secure workspace</div></SidebarFooter></Sidebar><main className="workspace"><a className="skip-link" href="#main-content">Skip to content</a><header className="topbar"><div><SidebarTrigger/><span>Personal workspace</span><ChevronRight size={14}/><strong>{view}</strong></div><div>{user?<><button className="icon-button" aria-label="Notifications" onClick={()=>navigate('Notifications')}><Bell size={20}/></button><button className="avatar" aria-label="My profile" onClick={()=>navigate('My profile')}>{(profile.firstName?.[0]||user.name?.[0]||'U').toUpperCase()}{(profile.lastName?.[0]||'').toUpperCase()}</button></>:<a className="text-button" href="/signin?return_to=/" target="_top"><LockKeyhole size={15}/> Sign in to workspace</a>}</div></header><div className="page-content" id="main-content">{!service?(<div className="page-heading"><div><p className="eyebrow">YOUR IMMIGRATION JOURNEY</p><h1>{title}</h1><p>{view==='Overview'?'Everything you need for your next step, in one place.':subtitle[view]}</p></div><button className="primary" onClick={()=>navigate('All services')}><Plus size={18}/> New application</button></div>):(<div className="flex items-center justify-between gap-4 mb-4"><button type="button" onClick={()=>navigate('All services')} className="inline-flex items-center gap-2 text-xs sm:text-sm font-semibold text-[#004de6] hover:text-[#003ecb] transition-colors cursor-pointer py-1"><ArrowLeft size={16}/> Back to All services</button><div className="text-xs text-slate-500 font-medium">{selected?`Editing draft ${shortId(selected.id)}`:'New application journey'}</div></div>)}<div className="preview-note"><ShieldCheck size={17}/> Preview environment · Applications here are not submitted to the Bureau of Immigration.</div>{error&&<div role="alert" className="error-box">{error}<button onClick={refresh}>Try again</button></div>}
{view==='Overview'&&<Overview applications={applications} setView={navigate} onOpen={open} onStart={start}/>}
{view==='All services'&&<><div className="filter-toolbar"><label className="search-box"><Search size={18}/><input placeholder="Search immigration services…" aria-label="Search services" value={query} onChange={e=>setQuery(e.target.value)}/></label><span className="muted">{services.length} services available</span></div><Tabs value={filter} onValueChange={setFilter}><TabsList className="category-tabs">{['All','Travel','Stay','Study','Citizenship','Organization'].map(c=><TabsTrigger key={c} value={c}>{c}</TabsTrigger>)}</TabsList></Tabs><div className="catalog">{services.filter(s=>(filter==='All'||s.category===filter)&&(s.name+' '+s.description).toLowerCase().includes(query.toLowerCase())).map(s=>{const Icon=icons[s.icon];return <button className="service-card" key={s.id} onClick={()=>start(s.id)}><span className="soft-icon"><Icon/></span><span className="category-label">{s.category}</span><h3>{s.name}</h3><p>{s.description}</p><span className="start-link">Start application <ArrowRight size={15}/></span></button>})}</div>{!services.some(s=>(filter==='All'||s.category===filter)&&(s.name+' '+s.description).toLowerCase().includes(query.toLowerCase()))&&<Empty title="No matching services" description="Try another search or choose a different category."/>}</>}
{view==='My applications'&&<><div className="filter-toolbar"><label className="search-box"><Search size={18}/><input placeholder="Search by service or reference…" aria-label="Search applications" value={query} onChange={e=>setQuery(e.target.value)}/></label><Choice value={filter} onChange={setFilter} options={['All','Draft','Submitted','Under review','For correction','Approved','Disapproved','Endorsed']} label="Filter application status"/><button className="icon-button" aria-label="Refresh applications" onClick={refresh}><RefreshCw size={17}/></button></div><section className="panel">{loading?<Empty title="Loading your applications…"/>:filtered.length?<ApplicationList applications={filtered} onOpen={open}/>:<Empty title={applications.length?'No matching applications':'Your next chapter starts here'} description={applications.length?'Try another search or status.':'Choose a service to start your first application.'} action={()=>navigate('All services')} actionLabel="Explore services"/>}</section></>}
{service&&<div className="mb-6"><div className="journey-hero-banner"><div className="journey-hero-inner"><div className="journey-hero-pill"><span>🇵🇭</span><span>REPUBLIC OF THE PHILIPPINES</span></div><h2>{service.id==='etravel'?'Philippine Travel Information System':`${service.name} System`}</h2><p>Bureau of Immigration · Official Online Application Journey</p></div></div><div className="application-layout"><aside className="steps-panel"><p className="eyebrow">YOUR APPLICATION</p>{[...service.sections.map(s=>s.title),'Documents','Review & submit'].map((label,i)=><button key={label} className={'step '+(i===step?'current':'')} onClick={()=>setStep(i)}><span>{i<step?<Check size={14}/>:i+1}</span>{label}</button>)}<div className="draft-note"><Save size={17}/><p>{selected?'Draft '+shortId(selected.id):'Your draft will appear in My applications once saved.'}</p></div></aside><section className="panel application-form"><div className="form-top"><span>STEP {step+1} OF {service.sections.length+2}</span><Progress value={(step+1)/(service.sections.length+2)*100}/></div><h1 className="journey-title">{service.id==='etravel'?'New Travel Declaration':`New ${service.name}`}</h1><p className="journey-subtitle">Fill up your {service.name.toLowerCase()} information, let’s get started!</p>{!user&&!loading&&<div className="signin-notice"><LockKeyhole size={20}/><div><strong>Sign in to save your application</strong><p>This private preview uses your workspace account. eGovPH sign-in is not connected.</p><a className="text-button" href="/signin?return_to=/" target="_top">Sign in to workspace <ArrowRight size={15}/></a></div></div>}{step<service.sections.length?<form onSubmit={e=>{e.preventDefault();const missing=service.sections[step].fields.filter(f=>f.required&&!data[f.key]?.trim());if(missing.length){toast.error('Complete '+missing.map(f=>f.label).join(', '));return;}setStep(step+1)}}><h2 className="journey-section-title">{service.id==='etravel'&&service.sections[step].title==='Travel information'?`Travel Details - Philippine ${data.direction||'Arrival'} (via ${data.transport?data.transport.toUpperCase():'AIR'})`:service.sections[step].title}</h2><p className="form-hint">Fields marked with * are required.</p>{service.sections[step].title==='Philippine residential address'?<ResidentialAddress data={data} onChange={setData}/>:<div className="fields-grid">{service.sections[step].fields.map(f=><FieldInput key={f.key} field={f} value={data[f.key]||''} onChange={v=>setData({...data,[f.key]:v})}/>)}</div>}<FormActions step={step} busy={busy} back={()=>setStep(Math.max(0,step-1))} save={saveDraft}/></form>:step===service.sections.length?<><h2 className="journey-section-title">Upload your documents</h2><p className="form-hint">Use PDF, JPG, or PNG, up to 10 MB per file. Upload sample documents in this preview.</p>{service.id==='cruise-waiver'&&<div className="info-box"><FileText size={20}/><div><strong>Passenger manifest</strong><p>Download the XLSX template, complete it, and upload one or more files, up to 101 MB each.</p><button className="text-button" onClick={template}><Download size={15}/> Download XLSX template</button></div></div>}<div className="upload-list">{service.documents.map(kind=><div className="upload-card" key={kind}><div><span className="soft-icon"><FileText/></span><div><strong>{kind} *</strong>{documents.filter(d=>d.application===selected?.id&&d.kind===kind).map(d=><a key={d.id} className="uploaded-file" href={'/api/documents?id='+d.id}><CheckCircle2 size={14}/>{d.name}<Download size={13}/></a>)}</div></div><label className={'secondary upload-button '+(busy?'disabled':'')}><Upload size={15}/>{busy?'Please wait':'Upload'}<input disabled={busy} type="file" aria-label={'Upload '+kind} accept={kind.includes('.xlsx')?'.xlsx':kind==='Facial image'?'.jpg,.jpeg,.png':'.pdf,.jpg,.jpeg,.png'} multiple={kind.includes('.xlsx')} onChange={e=>{uploadFiles(e.target.files,kind);e.target.value=''}}/></label></div>)}</div><FormActions step={step} busy={busy} back={()=>setStep(step-1)} save={saveDraft} next={()=>setStep(step+1)}/></>:<><h2 className="journey-section-title">Review your application</h2><p className="form-hint">Make sure the details and documents are correct before submitting.</p>{service.sections.map((s,i)=><div className="review-section" key={s.title}><div className="section-heading"><h3>{s.title}</h3><button className="text-button" onClick={()=>setStep(i)}>Edit</button></div><dl>{s.fields.map(f=><div key={f.key}><dt>{f.label}</dt><dd>{data[f.key]||<span className="missing">{f.required?'Not provided':'—'}</span>}</dd></div>)}</dl></div>)}<div className="review-section"><h3>Documents</h3>{service.documents.map(kind=><p className="document-check" key={kind}>{documents.some(d=>d.application===selected?.id&&d.kind===kind)?<CheckCircle2 size={16}/>:<CircleHelp size={16}/>} {kind} — {documents.some(d=>d.application===selected?.id&&d.kind===kind)?'Uploaded':'Not uploaded'}</p>)}</div><label className="consent"><Checkbox checked={consent} onCheckedChange={v=>setConsent(v===true)}/><span>I have reviewed the information. I understand this submission is saved in a preview workspace and is not an official BI application.</span></label><div className="form-actions"><button className="secondary" onClick={()=>setStep(step-1)}>Back</button><button className="secondary" disabled={busy} onClick={saveDraft}><Save size={16}/> Save draft</button><button className="primary" disabled={busy||!consent||!user} onClick={submit}>{busy?<Loader2 className="spin" size={16}/>:<Check size={16}/>}Submit application</button></div></>}</section></div></div>}
{view==='My documents'&&<section className="panel">{documents.length?<Table><TableHeader><TableRow><TableHead>Document</TableHead><TableHead>Application</TableHead><TableHead>Uploaded</TableHead><TableHead>Download</TableHead></TableRow></TableHeader><TableBody>{documents.map(d=><TableRow key={d.id}><TableCell><strong>{d.name}</strong><small className="reference">{d.kind} · {(d.size/1024/1024).toFixed(2)} MB</small></TableCell><TableCell>{shortId(d.application)}</TableCell><TableCell>{date(d.created)}</TableCell><TableCell><a className="text-button" href={'/api/documents?id='+d.id} aria-label={'Download '+d.name}><Download size={17}/>Download</a></TableCell></TableRow>)}</TableBody></Table>:<Empty icon={FolderOpen} title="Your documents, all together" description="Upload supporting documents from an application. They will appear here." action={()=>navigate('My applications')} actionLabel="Go to applications"/>}</section>}
{view==='Payments'&&<><div className="stats payment-stats">{[['Awaiting payment','0'],['Paid transactions','0'],['Receipts available','0']].map(([label,value])=><div className="stat" key={label}><span>{label}</span><strong>{value}</strong></div>)}</div><section className="panel"><Empty icon={CreditCard} title="No payment assessments yet" description="Your assessments and receipts will appear here when an authorized payment provider is connected."/></section><h2 className="spaced-heading">Payment channels</h2><div className="integration-grid">{['Land Bank of the Philippines','Maya'].map(name=><div className="integration-card" key={name}><CreditCard size={22}/><h3>{name}</h3><span className="status">Not connected</span><p>Live collections require the provider’s authorized integration.</p></div>)}</div></>}
{view==='Notifications'&&<section className="panel"><div className="section-heading"><h2>Recent activity</h2><button className="text-button" onClick={async()=>{try{await api('read');await refresh();toast.success('Notifications marked as read')}catch(e){toast.error((e as Error).message)}}} disabled={!activity.some(a=>!a.seen)}>Mark all as read <Check size={16}/></button></div>{activity.length?<div className="activity-list">{activity.map(a=><div className={'activity-item '+(!a.seen?'unread':'')} key={a.id}><span className="soft-icon"><Bell/></span><div><strong>{a.action}</strong><p>{a.note||'Your workspace has been updated.'}</p><small>{date(a.created)}{a.application?' · '+shortId(a.application):''}</small></div></div>)}</div>:<Empty icon={Bell} title="You’re all caught up" description="Your application updates will appear here."/>}</section>}
{view==='My profile'&&<div className="profile-layout"><section className="panel profile-form"><h2>Personal details</h2><p className="form-hint">Saved information helps you complete future applications.</p><form onSubmit={async e=>{e.preventDefault();setBusy(true);try{await api('profile',{data:profile});await refresh();toast.success('Profile updated')}catch(e){toast.error((e as Error).message)}finally{setBusy(false)}}}><div className="fields-grid">{services[0].sections.find(s=>s.title==='Personal information')!.fields.filter(f=>f.key!=='email').map(f=><FieldInput key={f.key} field={{...f,required:false}} value={profile[f.key]||''} onChange={v=>setProfile({...profile,[f.key]:v})}/>)}</div><h2 className="spaced-heading">Philippine residential address</h2><ResidentialAddress data={profile} onChange={setProfile} required={false}/><button className="primary" disabled={busy||!user}>Save profile</button></form></section><aside><section className="panel account-card"><LockKeyhole/><h2>Account & security</h2><p>{user?.email||'You are not signed in.'}</p>{user?<a href="/signout?return_to=/" target="_top" className="text-button"><LogOut size={16}/> Sign out</a>:<a href="/signin?return_to=/" target="_top" className="text-button">Sign in to workspace</a>}<hr/><p>Preview access uses workspace sign-in. Public registration, email verification, MFA, eGovPH, and PhilSys require government identity integration.</p></section></aside></div>}
{view==='Back office'&&(user?.role==='reviewer'?<>
<div className="filter-toolbar flex flex-wrap items-center justify-between gap-3">
  <div className="flex flex-1 items-center gap-3 min-w-[280px]">
    <label className="search-box flex-1">
      <Search size={18}/>
>>>>>>> 003ca93f492b1f0e2c6f26423e8dad181cb1d984
      <input
        id={f.key}
        type="text"
        inputMode="numeric"
        required={f.required}
        value={displayVal}
        onChange={handleTextChange}
        placeholder="MM/DD/YYYY"
        maxLength={10}
        autoComplete="off"
        style={{width:'100%',paddingRight:'2.5rem'}}
      />
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <button
            type="button"
            tabIndex={-1}
            aria-label={`Open calendar for ${f.label}`}
            style={{
              position:'absolute',
              right:'0.65rem',
              background:'transparent',
              border:'none',
              padding:'0.2rem',
              color:'#657c96',
              cursor:'pointer',
              display:'inline-flex',
              alignItems:'center',
              justifyContent:'center'
            }}
          >
            <CalendarDays size={18}/>
          </button>
        </PopoverTrigger>
        <PopoverContent className="w-auto p-0 z-50 bg-white border border-border shadow-xl rounded-xl" align="end">
          <Calendar
            mode="single"
            selected={parsedDate}
            onSelect={handleSelectDate}
            captionLayout="dropdown"
            startMonth={isBirth?new Date(1900,0):new Date(1950,0)}
            endMonth={isBirth?new Date():new Date(2050,11)}
            defaultMonth={parsedDate||(isBirth?new Date(1995,0,1):new Date())}
            disabled={isBirth?(date)=>date>new Date():undefined}
          />
        </PopoverContent>
      </Popover>
    </div>
  );
}

function FieldInput({field:f,value,onChange}:{field:Field;value:string;onChange:(v:string)=>void}){const isPassport=f.key==='passportNumber'||f.key==='guardianPassport';const isDate=f.type==='date';return <div className={'field '+(f.type==='textarea'?'full-width':'')}><label htmlFor={f.key}>{f.label}{f.required&&<span> *</span>}{isPassport&&<span style={{fontSize:'0.75rem',color:'#657c96',marginLeft:'0.4rem',fontWeight:'normal'}}>(9 characters)</span>}{isDate&&<span style={{fontSize:'0.75rem',color:'#657c96',marginLeft:'0.4rem',fontWeight:'normal'}}>(MM/DD/YYYY)</span>}</label>{f.type==='select'?<Choice id={f.key} value={value} onChange={onChange} options={f.options||[]} label={f.label}/>:f.type==='textarea'?<textarea id={f.key} required={f.required} value={value} onChange={e=>onChange(e.target.value)} maxLength={5000}/>:f.type==='date'?<DateFieldInput field={f} value={value} onChange={onChange}/>:<input id={f.key} type={f.type||'text'} required={f.required} value={value} onChange={e=>{if(isPassport){onChange(e.target.value.toUpperCase().slice(0,9))}else{onChange(e.target.value)}}} maxLength={isPassport?9:500} placeholder={isPassport?'e.g. P1234567A':undefined} autoComplete={f.key==='firstName'?'given-name':f.key==='lastName'?'family-name':f.key==='email'?'email':'off'}/>}</div>;}

function Empty({title,description,action,actionLabel,icon:Icon=Files}:{title:string;description?:string;action?:()=>void;actionLabel?:string;icon?:any}){return <div className="empty-app"><span className="soft-icon"><Icon/></span><h3>{title}</h3>{description&&<p>{description}</p>}{action&&<button className="secondary" onClick={action}>{actionLabel}<ArrowRight size={16}/></button>}</div>;}

function FormActions({step,busy,back,save,next,submit,canSubmit=true}:{step:number;busy:boolean;back:()=>void;save:()=>void;next?:()=>void;submit?:()=>void;canSubmit?:boolean}){
  const handleKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    if (e.key !== 'Tab') return;
    const buttons = Array.from(e.currentTarget.querySelectorAll<HTMLButtonElement>('button:not([disabled])'));
    const active = document.activeElement as HTMLButtonElement | null;
    const idx = active ? buttons.indexOf(active) : -1;
    if (idx === -1) return;
    if (!e.shiftKey && idx < buttons.length - 1) {
      e.preventDefault();
      buttons[idx + 1].focus();
    } else if (e.shiftKey && idx > 0) {
      e.preventDefault();
      buttons[idx - 1].focus();
    }
  };

  return <div className="form-actions" onKeyDown={handleKeyDown}>
    <button type="button" tabIndex={step===0||busy?-1:0} className="secondary" onClick={back} disabled={step===0||busy}><ArrowLeft size={16}/>Back</button>
    <button type="button" tabIndex={busy?-1:0} className="secondary" disabled={busy} onClick={save}><Save size={16}/>{busy?'Saving…':'Save draft'}</button>
    {submit ? (
      <button type="button" tabIndex={busy||!canSubmit?-1:0} className="primary" disabled={busy||!canSubmit} onClick={submit}>{busy?<Loader2 className="spin" size={16}/>:<Check size={16}/>}Submit application</button>
    ) : (
      <button type={next?'button':'submit'} tabIndex={busy?-1:0} className="primary" disabled={busy} onClick={next}>Continue <ArrowRight size={16}/></button>
    )}
  </div>;
}
