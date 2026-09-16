'use client';
import { useState, useEffect, useCallback, useRef } from 'react';
import { LayoutDashboard, Files, Grid2X2, CreditCard, FolderOpen, Bell, UserRound, ShieldCheck, ArrowUpRight, ArrowRight, ArrowLeft, Plane, GraduationCap, BookOpen, Globe2, Plus, CircleHelp, ChevronRight, Search, Ship, Building2, CalendarDays, Flag, Users, School, Download, Upload, Check, Save, CheckCircle2, LockKeyhole, RefreshCw, LogOut, ClipboardCheck, FileText, Loader2, X, UserPlus, LogIn } from 'lucide-react';
import { Sidebar, SidebarProvider, SidebarHeader, SidebarContent, SidebarFooter, SidebarMenu, SidebarMenuItem, SidebarMenuButton, SidebarTrigger, useSidebar } from '@/components/ui/sidebar';
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/select';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Checkbox } from '@/components/ui/checkbox';
import { Progress } from '@/components/ui/progress';
import { Toaster } from '@/components/ui/sonner';
import { toast } from 'sonner';
import { services, validateApplication, type Application, type Field } from '@/lib/services';
import Overview from './overview';
import ResidentialAddress from './residential-address';
import AuthModal from './auth-modal';

const navigation = [[LayoutDashboard,'Overview'],[Grid2X2,'All services'],[Files,'My applications'],[CreditCard,'Payments'],[FolderOpen,'My documents'],[Bell,'Notifications']] as const;
const icons:Record<string,any>={plane:Plane,globe:Globe2,graduation:GraduationCap,book:BookOpen,ship:Ship,building:Building2,calendar:CalendarDays,school:School,flag:Flag,users:Users};
const serviceName=(id:string)=>services.find(s=>s.id===id)?.name||id;
const date=(s:string)=>new Date(s).toLocaleDateString('en-PH',{month:'short',day:'numeric',year:'numeric'});
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
    headers: getAuthHeaders({'Content-Type':'application/json'}),
    body:JSON.stringify({action,...data})
  });
  const value:any=await r.json();
  if(!r.ok)throw new Error(value.error||'Unable to save. Try again.');
  return value;
}

function download(content:string,name:string,type='text/plain'){const url=URL.createObjectURL(new Blob([content],{type}));const a=document.createElement('a');a.href=url;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000)}
export function ApplicationList({applications,onOpen}:{applications:Application[];onOpen:(a:Application)=>void}){return <Table><TableHeader><TableRow><TableHead>Application</TableHead><TableHead>Status</TableHead><TableHead>Last updated</TableHead><TableHead><span className="sr-only">Action</span></TableHead></TableRow></TableHeader><TableBody>{applications.map(a=><TableRow key={a.id}><TableCell><strong>{serviceName(a.service)}</strong><small className="reference">{shortId(a.id)}</small></TableCell><TableCell><span className={'status status-'+a.status.toLowerCase().replaceAll(' ','-')}>{a.status}</span></TableCell><TableCell>{date(a.updated)}</TableCell><TableCell><button className="text-button" aria-label={'Open '+serviceName(a.service)+' '+shortId(a.id)} onClick={()=>onOpen(a)}>{['Draft','For correction'].includes(a.status)?'Continue':'View'}<ChevronRight size={16}/></button></TableCell></TableRow>)}</TableBody></Table>}
function SidebarNav({view,onNavigate,unread}:{view:string;onNavigate:(v:string)=>void;unread:number}){const {setOpenMobile}=useSidebar();return <SidebarMenu>{navigation.map(([Icon,label])=><SidebarMenuItem key={label}><SidebarMenuButton isActive={view===label} onClick={()=>{onNavigate(label);setOpenMobile(false)}}><Icon/><span>{label}</span>{label==='Notifications'&&unread>0&&<b className="nav-count">{unread}</b>}</SidebarMenuButton></SidebarMenuItem>)}</SidebarMenu>}

export default function Portal(){
  const [view,setView]=useState('Overview'),[applications,setApplications]=useState<Application[]>([]),[documents,setDocuments]=useState<any[]>([]),[activity,setActivity]=useState<any[]>([]),[profile,setProfile]=useState<Record<string,string>>({}),[user,setUser]=useState<any>(null),[loading,setLoading]=useState(true),[error,setError]=useState(''),[filter,setFilter]=useState('All'),[query,setQuery]=useState(''),[selected,setSelected]=useState<Application|null>(null),[service,setService]=useState<typeof services[number]|null>(null),[data,setData]=useState<Record<string,string>>({}),[step,setStep]=useState(0),[busy,setBusy]=useState(false),[consent,setConsent]=useState(false),[detail,setDetail]=useState<Application|null>(null),[qr,setQr]=useState(''),[reviewApps,setReviewApps]=useState<Application[]>([]),[reviewNote,setReviewNote]=useState(''),[detailDocs,setDetailDocs]=useState<any[]>([]),[detailActivity,setDetailActivity]=useState<any[]>([]);
  const [authOpen, setAuthOpen] = useState(false);
  const [authTab, setAuthTab] = useState<'login' | 'signup'>('login');
  const saveLock=useRef(false);

  const refresh=useCallback(async()=>{
    try{
      const r=await fetch('/api/portal', { headers: getAuthHeaders() });
      const d:any=await r.json();
      if(!r.ok){
        if(r.status===401){setUser(null);setError('');return;}
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
      await fetch('/api/auth/logout', { method: 'POST' });
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
    refresh();
  };

  const openAuth = (tab: 'login' | 'signup' = 'login') => {
    setAuthTab(tab);
    setAuthOpen(true);
  };

  const navigate=useCallback((v:string)=>{setView(v);setQuery('');setFilter('All');setService(null);setDetail(null);window.scrollTo({top:0,behavior:'smooth'})},[]);
  const start=useCallback((name:string)=>{const s=services.find(s=>s.name===name||s.id===name);if(!s)return;setService(s);setSelected(null);setData({...profile,email:user?.email||''});setStep(0);setConsent(false);setView('New application');window.scrollTo({top:0})},[profile,user]);

  useEffect(()=>{const context=(document as any).modelContext;if(!context?.registerTool)return;const controller=new AbortController();try{Promise.resolve(context.registerTool({name:'start_immigration_application',description:'Open the guided application form for a service. Does not save or submit.',inputSchema:{type:'object',properties:{service:{type:'string',enum:services.map(s=>s.id)}},required:['service'],additionalProperties:false},annotations:{readOnlyHint:false},execute:(input:any)=>{if(!input||Object.keys(input).length!==1||!services.some(s=>s.id===input.service))throw new Error('Choose a supported service ID.');start(input.service);return {opened:input.service,submitted:false}}},{signal:controller.signal})).catch(()=>{})}catch{}return()=>controller.abort()},[start]);

  useEffect(()=>{setDetailDocs([]);setDetailActivity([]);if(!detail)return;let active=true;fetch('/api/portal?application='+encodeURIComponent(detail.id), { headers: getAuthHeaders() }).then(r=>r.json()).then((d:any)=>{if(!active)return;if(d.error){toast.error(d.error);return;}setDetailDocs(d.documents);setDetailActivity(d.activity)}).catch(()=>toast.error('Could not load application history.'));return()=>{active=false}},[detail]);

  useEffect(()=>{setQr('');if(detail?.service==='etravel'&&detail.status!=='Draft'){let cancelled=false;import('qrcode').then(q=>q.toDataURL(JSON.stringify({type:'BI_PREVIEW_ONLY',reference:detail.id}),{width:220,margin:2})).then(url=>{if(!cancelled)setQr(url)});return()=>{cancelled=true}}},[detail]);

  useEffect(()=>{if(view==='Back office'&&user?.role==='reviewer'){fetch('/api/portal?review=1', { headers: getAuthHeaders() }).then(r=>r.json()).then((d:any)=>{if(d.error)toast.error(d.error);else setReviewApps(d.applications)})}},[view,user]);

  const open=(a:Application)=>{if(['Draft','For correction'].includes(a.status)){setSelected(a);setService(services.find(s=>s.id===a.service)!);setData(a.data);setStep(0);setConsent(false);setView('Continue application');}else setDetail(a)};

  async function save(){if(!service)throw new Error('Choose a service.');if(saveLock.current)throw new Error('A save is already in progress.');saveLock.current=true;try{const result=await api('save',{service:service.id,data,id:selected?.id,version:selected?.version});const next={id:result.id,service:service.id,status:selected?.status||'Draft',data,created:selected?.created||new Date().toISOString(),updated:new Date().toISOString(),version:result.version};setSelected(next);await refresh();return next;}finally{saveLock.current=false}}

  async function saveDraft(){setBusy(true);try{await save();toast.success('Draft saved. You can return to it anytime.')}catch(e){toast.error((e as Error).message)}finally{setBusy(false)}}

  async function uploadFiles(files:FileList|null,kind:string){if(!files?.length)return;setBusy(true);try{const a=await save();if(!a)return;for(const file of Array.from(files)){const max=kind.includes('.xlsx')?101*1024*1024:10*1024*1024;if(file.size>max)throw new Error(file.name+' exceeds the size limit.');const params=new URLSearchParams({application:a.id,kind,name:file.name});const res=await fetch('/api/documents?'+params,{method:'POST',headers:getAuthHeaders({'Content-Type':file.type||'application/octet-stream'}),body:file});const result:any=await res.json();if(!res.ok)throw new Error(result.error)}await refresh();toast.success('Documents uploaded.')}catch(e){toast.error((e as Error).message)}finally{setBusy(false)}}

  async function submit(){setBusy(true);try{if(!consent)throw new Error('Confirm the review statement first.');const a=await save();await api('submit',{id:a!.id});await refresh();navigate('My applications');toast.success('Application submitted to this preview workspace.')}catch(e){toast.error((e as Error).message)}finally{setBusy(false)}}

  async function template(){const x=await import('xlsx');const wb=x.utils.book_new();x.utils.book_append_sheet(wb,x.utils.aoa_to_sheet([['Given name','Last name','Date of birth (YYYY-MM-DD)','Nationality','Passport number','Passport expiry (YYYY-MM-DD)','Vessel name','Voyage number','Travel date (YYYY-MM-DD)']]),'Passengers');x.writeFile(wb,'BI-cruise-passenger-template.xlsx')}

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
          {view==='My applications'&&<><div className="filter-toolbar"><label className="search-box"><Search size={18}/><input placeholder="Search by service or reference…" aria-label="Search applications" value={query} onChange={e=>setQuery(e.target.value)}/></label><Choice value={filter} onChange={setFilter} options={['All','Draft','Submitted','Under review','For correction','Approved','Disapproved','Endorsed']} label="Filter application status"/><button className="icon-button" aria-label="Refresh applications" onClick={refresh}><RefreshCw size={17}/></button></div><section className="panel">{loading?<Empty title="Loading your applications…"/>:filtered.length?<ApplicationList applications={filtered} onOpen={open}/>:<Empty title={applications.length?'No matching applications':'Your next chapter starts here'} description={applications.length?'Try another search or status.':'Choose a service to start your first application.'} action={()=>navigate('All services')} actionLabel="Explore services"/>}</section></>}
          {service&&<div className="application-layout"><aside className="steps-panel"><p className="eyebrow">YOUR APPLICATION</p>{[...service.sections.map(s=>s.title),'Documents','Review & submit'].map((label,i)=><button key={label} className={'step '+(i===step?'current':'')} onClick={()=>setStep(i)}><span>{i<step?<Check size={14}/>:i+1}</span>{label}</button>)}<div className="draft-note"><Save size={17}/><p>{selected?'Draft '+shortId(selected.id):'Your draft will appear in My applications once saved.'}</p></div></aside><section className="panel application-form"><div className="form-top"><span>STEP {step+1} OF {service.sections.length+2}</span><Progress value={(step+1)/(service.sections.length+2)*100}/></div>{!user&&!loading&&<div className="signin-notice"><LockKeyhole size={20}/><div><strong>Sign in to save your application</strong><p>Sign in with your email or register a new account to keep your application saved.</p><button type="button" onClick={()=>openAuth('login')} className="text-button">Sign in to workspace <ArrowRight size={15}/></button></div></div>}{step<service.sections.length?<form onSubmit={e=>{e.preventDefault();const missing=service.sections[step].fields.filter(f=>f.required&&!data[f.key]?.trim());if(missing.length){toast.error('Complete '+missing.map(f=>f.label).join(', '));return;}const invalidPassport=service.sections[step].fields.filter(f=>(f.key==='passportNumber'||f.key==='guardianPassport')&&data[f.key]?.trim()&&data[f.key]?.trim().length!==9);if(invalidPassport.length){toast.error(invalidPassport.map(f=>f.label).join(', ')+' must be exactly 9 characters');return;}setStep(step+1)}}><h2>{service.sections[step].title}</h2><p className="form-hint">Fields marked with * are required.</p>{service.sections[step].title==='Philippine residential address'?<ResidentialAddress data={data} onChange={setData}/>:<div className="fields-grid">{service.sections[step].fields.map(f=><FieldInput key={f.key} field={f} value={data[f.key]||''} onChange={v=>setData({...data,[f.key]:v})}/>)}</div>}<FormActions step={step} busy={busy} back={()=>setStep(Math.max(0,step-1))} save={saveDraft}/></form>:step===service.sections.length?<><h2>Upload your documents</h2><p className="form-hint">Use PDF, JPG, or PNG, up to 10 MB per file. Upload sample documents in this preview.</p>{service.id==='cruise-waiver'&&<div className="info-box"><FileText size={20}/><div><strong>Passenger manifest</strong><p>Download the XLSX template, complete it, and upload one or more files, up to 101 MB each.</p><button className="text-button" onClick={template}><Download size={15}/> Download XLSX template</button></div></div>}<div className="upload-list">{service.documents.map(kind=><div className="upload-card" key={kind}><div><span className="soft-icon"><FileText/></span><div><strong>{kind} *</strong>{documents.filter(d=>d.application===selected?.id&&d.kind===kind).map(d=><a key={d.id} className="uploaded-file" href={'/api/documents?id='+d.id}><CheckCircle2 size={14}/>{d.name}<Download size={13}/></a>)}</div></div><label className={'secondary upload-button '+(busy?'disabled':'')}><Upload size={15}/>{busy?'Please wait':'Upload'}<input disabled={busy} type="file" aria-label={'Upload '+kind} accept={kind.includes('.xlsx')?'.xlsx':kind==='Facial image'?'.jpg,.jpeg,.png':'.pdf,.jpg,.jpeg,.png'} multiple={kind.includes('.xlsx')} onChange={e=>{uploadFiles(e.target.files,kind);e.target.value=''}}/></label></div>)}</div><FormActions step={step} busy={busy} back={()=>setStep(step-1)} save={saveDraft} next={()=>setStep(step+1)}/></>:<><h2>Review your application</h2><p className="form-hint">Make sure the details and documents are correct before submitting.</p>{service.sections.map((s,i)=><div className="review-section" key={s.title}><div className="section-heading"><h3>{s.title}</h3><button className="text-button" onClick={()=>setStep(i)}>Edit</button></div><dl>{s.fields.map(f=><div key={f.key}><dt>{f.label}</dt><dd>{data[f.key]||<span className="missing">{f.required?'Not provided':'—'}</span>}</dd></div>)}</dl></div>)}<div className="review-section"><h3>Documents</h3>{service.documents.map(kind=><p className="document-check" key={kind}>{documents.some(d=>d.application===selected?.id&&d.kind===kind)?<CheckCircle2 size={16}/>:<CircleHelp size={16}/>} {kind} — {documents.some(d=>d.application===selected?.id&&d.kind===kind)?'Uploaded':'Not uploaded'}</p>)}</div><label className="consent"><Checkbox checked={consent} onCheckedChange={v=>setConsent(v===true)}/><span>I have reviewed the information. I understand this submission is saved in a preview workspace and is not an official BI application.</span></label><div className="form-actions"><button className="secondary" onClick={()=>setStep(step-1)}>Back</button><button className="secondary" disabled={busy} onClick={saveDraft}><Save size={16}/> Save draft</button><button className="primary" disabled={busy||!consent||!user} onClick={submit}>{busy?<Loader2 className="spin" size={16}/>:<Check size={16}/>}Submit application</button></div></>}</section></div>}
          {view==='My documents'&&<section className="panel">{documents.length?<Table><TableHeader><TableRow><TableHead>Document</TableHead><TableHead>Application</TableHead><TableHead>Uploaded</TableHead><TableHead>Download</TableHead></TableRow></TableHeader><TableBody>{documents.map(d=><TableRow key={d.id}><TableCell><strong>{d.name}</strong><small className="reference">{d.kind} · {(d.size/1024/1024).toFixed(2)} MB</small></TableCell><TableCell>{shortId(d.application)}</TableCell><TableCell>{date(d.created)}</TableCell><TableCell><a className="text-button" href={'/api/documents?id='+d.id} aria-label={'Download '+d.name}><Download size={17}/>Download</a></TableCell></TableRow>)}</TableBody></Table>:<Empty icon={FolderOpen} title="Your documents, all together" description="Upload supporting documents from an application. They will appear here." action={()=>navigate('My applications')} actionLabel="Go to applications"/>}</section>}
          {view==='Payments'&&<><div className="stats payment-stats">{[['Awaiting payment','0'],['Paid transactions','0'],['Receipts available','0']].map(([label,value])=><div className="stat" key={label}><span>{label}</span><strong>{value}</strong></div>)}</div><section className="panel"><Empty icon={CreditCard} title="No payment assessments yet" description="Your assessments and receipts will appear here when an authorized payment provider is connected."/></section><h2 className="spaced-heading">Payment channels</h2><div className="integration-grid">{['Land Bank of the Philippines','Maya'].map(name=><div className="integration-card" key={name}><CreditCard size={22}/><h3>{name}</h3><span className="status">Not connected</span><p>Live collections require the provider’s authorized integration.</p></div>)}</div></>}
          {view==='Notifications'&&<section className="panel"><div className="section-heading"><h2>Recent activity</h2><button className="text-button" onClick={async()=>{try{await api('read');await refresh();toast.success('Notifications marked as read')}catch(e){toast.error((e as Error).message)}}} disabled={!activity.some(a=>!a.seen)}>Mark all as read <Check size={16}/></button></div>{activity.length?<div className="activity-list">{activity.map(a=><div className={'activity-item '+(!a.seen?'unread':'')} key={a.id}><span className="soft-icon"><Bell/></span><div><strong>{a.action}</strong><p>{a.note||'Your workspace has been updated.'}</p><small>{date(a.created)}{a.application?' · '+shortId(a.application):''}</small></div></div>)}</div>:<Empty icon={Bell} title="You’re all caught up" description="Your application updates will appear here."/>}</section>}
          {view==='My profile'&&<div className="profile-layout"><section className="panel profile-form"><h2>Personal details</h2><p className="form-hint">Saved information helps you complete future applications.</p><form onSubmit={async e=>{e.preventDefault();setBusy(true);try{await api('profile',{data:profile});await refresh();toast.success('Profile updated')}catch(e){toast.error((e as Error).message)}finally{setBusy(false)}}}><div className="fields-grid">{services[0].sections.find(s=>s.title==='Personal information')!.fields.filter(f=>f.key!=='email').map(f=><FieldInput key={f.key} field={{...f,required:false}} value={profile[f.key]||''} onChange={v=>setProfile({...profile,[f.key]:v})}/>)}</div><h2 className="spaced-heading">Philippine residential address</h2><ResidentialAddress data={profile} onChange={setProfile} required={false}/><button className="primary" disabled={busy||!user}>Save profile</button></form></section><aside><section className="panel account-card"><LockKeyhole/><h2>Account & security</h2><p className="font-medium text-[#173b69]">{user?.displayName || user?.email || 'You are not signed in.'}</p><small className="text-[#657c96] block mb-3">{user ? `Email: ${user.email} (${user.role === 'reviewer' ? 'Officer' : 'Applicant'})` : 'Sign in to sync applications across devices.'}</small>{user?<button onClick={handleLogout} className="text-button cursor-pointer"><LogOut size={16}/> Sign out</button>:<div className="flex flex-col gap-2"><button onClick={()=>openAuth('login')} className="text-button cursor-pointer font-semibold"><LogIn size={15}/> Sign in to workspace</button><button onClick={()=>openAuth('signup')} className="text-button cursor-pointer text-[#173b69]"><UserPlus size={15}/> Create new account</button></div>}<hr/><p>Registered accounts are persisted in DynamoDB / S3 storage. You can register multiple applicant and reviewer accounts.</p></section></aside></div>}
          {view==='Back office'&&(user?.role==='reviewer'?<section className="panel"><div className="section-heading"><h2>Processing queue</h2><button className="text-button" onClick={()=>download(JSON.stringify(reviewApps,null,2),'BI-application-report.json','application/json')}><Download size={16}/> Export report</button></div>{reviewApps.length?<ApplicationList applications={reviewApps} onOpen={a=>setDetail(a)}/>:<Empty title="No applications in the queue"/>}</section>:<section className="panel"><Empty icon={LockKeyhole} title="Officer access required" description="This workspace is reserved for authorized reviewers. Sign in with an Immigration Officer account (e.g. officer@bi.gov.ph) to review live applications."/><div className="integration-status"><button onClick={()=>{setAuthTab('login');setAuthOpen(true)}} className="primary mt-3"><LogIn size={15}/> Sign in as Officer</button></div></section>)}
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
              <dl>{Object.entries(detail.data).map(([key,value])=><div key={key}><dt>{services.find(s=>s.id===detail.service)?.sections.flatMap(s=>s.fields).find(f=>f.key===key)?.label||key}</dt><dd>{value||'—'}</dd></div>)}</dl>
            </div>
            <h3>Submitted documents</h3>
            <div className="detail-documents">{detailDocs.map(d=><a className="uploaded-file" key={d.id} href={'/api/documents?id='+d.id}><FileText size={16}/>{d.name}<Download size={15}/></a>)}</div>
            <h3>Processing history</h3>
            <div className="timeline">{[...detailActivity].reverse().map(a=><div key={a.id}><strong>{a.action}</strong><p>{a.note}</p><small>{date(a.created)}</small></div>)}</div>
            <button className="secondary" onClick={()=>download('BUREAU OF IMMIGRATION — PREVIEW CONFIRMATION\nNot valid for immigration clearance or payment.\n\nReference: '+detail.id+'\nService: '+serviceName(detail.service)+'\nStatus: '+detail.status+'\nSaved: '+detail.created+'\n','preview-confirmation-'+shortId(detail.id)+'.txt')}><Download size={16}/> Download confirmation</button>
            {user?.role==='reviewer'&&<div className="reviewer-actions">
              <label htmlFor="review-note">Processing note</label>
              <textarea id="review-note" value={reviewNote} onChange={e=>setReviewNote(e.target.value)} placeholder="Explain the processing decision"/>
              <div>{['Under review','For correction','Approved','Disapproved','Endorsed'].map(status=><button className="secondary" key={status} disabled={busy||!reviewNote.trim()} onClick={async()=>{setBusy(true);try{await api('review',{id:detail.id,status,note:reviewNote});setDetail(null);await refresh();navigate('Back office');toast.success('Processing action recorded')}catch(e){toast.error((e as Error).message)}finally{setBusy(false)}}}>{status}</button>)}</div>
            </div>}
          </>}
        </DialogContent>
      </Dialog>
    </SidebarProvider>
  );
}
function Choice({value,onChange,options,label}:{value:string;onChange:(v:string)=>void;options:string[];label:string}){const [query,setQuery]=useState('');const filtered=options.length>10&&query.trim()?options.filter(o=>o.toLowerCase().includes(query.toLowerCase())):options;return <Select value={value} onValueChange={v=>{onChange(v);setQuery('');}}><SelectTrigger aria-label={label}><SelectValue placeholder={label?`Select ${label.toLowerCase()}…`:'Select an option'}/></SelectTrigger><SelectContent position="popper" className="max-h-72 min-w-[220px] overflow-y-auto">{options.length>10&&<div className="p-1.5 sticky top-0 bg-white border-b border-border z-10"><input type="text" placeholder={`Search ${label.toLowerCase()}…`} value={query} onChange={e=>setQuery(e.target.value)} onKeyDown={e=>e.stopPropagation()} className="w-full text-xs px-2.5 py-1.5 border rounded border-input outline-none focus:border-primary"/></div>}{filtered.length?filtered.map(o=><SelectItem key={o} value={o}>{o}</SelectItem>):<div className="p-3 text-xs text-muted-foreground text-center">No matching options</div>}</SelectContent></Select>}
function FieldInput({field:f,value,onChange}:{field:Field;value:string;onChange:(v:string)=>void}){const isPassport=f.key==='passportNumber'||f.key==='guardianPassport';return <div className={'field '+(f.type==='textarea'?'full-width':'')}><label htmlFor={f.key}>{f.label}{f.required&&<span> *</span>}{isPassport&&<span style={{fontSize:'0.75rem',color:'#657c96',marginLeft:'0.4rem',fontWeight:'normal'}}>(9 characters)</span>}</label>{f.type==='select'?<Choice value={value} onChange={onChange} options={f.options||[]} label={f.label}/>:f.type==='textarea'?<textarea id={f.key} required={f.required} value={value} onChange={e=>onChange(e.target.value)} maxLength={5000}/>:<input id={f.key} type={f.type||'text'} required={f.required} value={value} onChange={e=>{if(isPassport){onChange(e.target.value.toUpperCase().slice(0,9))}else{onChange(e.target.value)}}} maxLength={isPassport?9:500} placeholder={isPassport?'e.g. P1234567A':undefined} max={f.key==='birthDate'?new Date().toISOString().slice(0,10):undefined} autoComplete={f.key==='firstName'?'given-name':f.key==='lastName'?'family-name':f.key==='email'?'email':'off'}/>}</div>}
function Empty({title,description,action,actionLabel,icon:Icon=Files}:{title:string;description?:string;action?:()=>void;actionLabel?:string;icon?:any}){return <div className="empty-app"><span className="soft-icon"><Icon/></span><h3>{title}</h3>{description&&<p>{description}</p>}{action&&<button className="secondary" onClick={action}>{actionLabel}<ArrowRight size={16}/></button>}</div>}
function FormActions({step,busy,back,save,next}:{step:number;busy:boolean;back:()=>void;save:()=>void;next?:()=>void}){return <div className="form-actions"><button type="button" className="secondary" onClick={back} disabled={step===0||busy}><ArrowLeft size={16}/>Back</button><button type="button" className="secondary" disabled={busy} onClick={save}><Save size={16}/>{busy?'Saving…':'Save draft'}</button><button type={next?'button':'submit'} className="primary" disabled={busy} onClick={next}>Continue <ArrowRight size={16}/></button></div>}
