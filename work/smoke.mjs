import assert from 'node:assert/strict';
const base='http://localhost:5173';
const cookie='__sites_local_auth=1';
async function call(action,data={},expected=200){const r=await fetch(base+'/api/portal',{method:'POST',headers:{'Content-Type':'application/json',Cookie:cookie,Origin:base},body:JSON.stringify({action,...data})});const body=await r.json();assert.equal(r.status,expected,JSON.stringify(body));return body}
let r=await fetch(base+'/api/portal');assert.equal(r.status,401);console.log('PASS anonymous records rejected');
r=await fetch(base+'/api/portal',{headers:{Cookie:cookie}});let state=await r.json();assert.equal(r.status,200,JSON.stringify(state));console.log('PASS authenticated workspace loads');
const data={direction:'Arrival',transport:'Air',firstName:'Test',lastName:'Applicant',birthDate:'1990-01-01',nationality:'Test nationality',email:'applicant@example.test',phone:'0000000000',passportNumber:'TEST-ONLY',passportCountry:'Test country',passportExpiry:'2030-01-01',travelDate:'2026-10-01',flightNumber:'TEST-001',port:'Test port',origin:'Test origin',destination:'Test destination',street:'Test street',barangay:'Test barangay',city:'Test city',province:'Test province',postalCode:'0000'};
let a=await call('save',{service:'etravel',data:{firstName:'Test'}});assert.ok(a.id);await call('submit',{id:a.id},400);console.log('PASS incomplete submission rejected');
a=await call('save',{id:a.id,version:a.version,service:'etravel',data});await call('save',{id:a.id,version:1,service:'etravel',data},409);console.log('PASS draft persistence and stale update protection');
await call('submit',{id:a.id},400);console.log('PASS required document checked');
const content=Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aApcAAAAASUVORK5CYII=','base64');
r=await fetch(base+'/api/documents?'+new URLSearchParams({application:a.id,kind:'Passport bio page',name:'test-document.png'}),{method:'POST',headers:{Cookie:cookie,Origin:base,'Content-Type':'image/png'},body:content});const doc=await r.json();assert.equal(r.status,200,JSON.stringify(doc));
r=await fetch(base+'/api/documents?id='+doc.id,{headers:{Cookie:cookie}});assert.equal(r.status,200);assert.equal((await r.arrayBuffer()).byteLength,content.length);r=await fetch(base+'/api/documents?id='+doc.id);assert.equal(r.status,401);console.log('PASS document upload, download, and access control');
await call('submit',{id:a.id});await call('save',{id:a.id,version:a.version,service:'etravel',data},409);console.log('PASS submission and edit lock');
await call('review',{id:a.id,status:'Approved',note:'Unauthorized test'},403);r=await fetch(base+'/api/portal?review=1',{headers:{Cookie:cookie}});assert.equal(r.status,403);console.log('PASS applicant denied reviewer actions and records');
r=await fetch(base+'/api/portal',{method:'POST',headers:{Cookie:cookie,Origin:'https://wrong.example','Content-Type':'application/json'},body:JSON.stringify({action:'read'})});assert.ok([400,403].includes(r.status));console.log('PASS cross-origin mutation rejected');
r=await fetch(base+'/api/portal',{headers:{Cookie:cookie}});state=await r.json();assert.equal(state.applications.find(x=>x.id===a.id).status,'Submitted');assert.ok(state.activity.some(x=>x.action==='Application submitted'));console.log('PASS saved status and audit history read-back');
