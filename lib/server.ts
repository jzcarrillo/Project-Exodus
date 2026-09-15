import {env} from 'cloudflare:workers';
import {getChatGPTUser} from '@/app/chatgpt-auth';
export const db=()=>{if(!env.DB)throw new Error('Application storage is unavailable. Please try again.');return env.DB};
export const bucket=()=>{if(!env.BUCKET)throw new Error('Document storage is unavailable. Please try again.');return env.BUCKET};
export async function identity(){const u=await getChatGPTUser();if(!u)throw new Error('Sign in to save and manage your applications.');const config=env as unknown as Record<string,string>;const reviewers=(config.BI_REVIEWER_EMAILS||'').split(',').map(x=>x.trim().toLowerCase());return {...u,role:reviewers.includes(u.email.toLowerCase())?'reviewer':'applicant'};}
export function writeGuard(req:Request){const origin=req.headers.get('origin');if(origin&&origin!==new URL(req.url).origin)throw new Error('Request origin is not allowed.');}
export const log=(owner:string,application:string,action:string,note='')=>db().prepare('INSERT INTO activity (id,owner,application,action,note,created,seen) VALUES (?,?,?,?,?,?,0)').bind(crypto.randomUUID(),owner,application,action,note,new Date().toISOString());
export const response=(value:unknown,status=200)=>Response.json(value,{status,headers:{'Cache-Control':'no-store','X-Content-Type-Options':'nosniff'}});
export const failure=(e:unknown)=>{const message=e instanceof Error?e.message:'Please try again.';console.error(message);return response({error:message},message.startsWith('Sign in')?401:400)};
