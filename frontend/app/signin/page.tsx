'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';

export default function SignIn() {
  const [email, setEmail] = useState('');
  const [name, setName] = useState('');
  const router = useRouter();

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    await fetch('/api/auth/signin', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, name }),
    });
    const params = new URLSearchParams(window.location.search);
    const returnTo = params.get('return_to');
    router.push(returnTo && returnTo.startsWith('/') ? returnTo : '/');
  }

  return (
    <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '100vh' }}>
      <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 12, width: 320 }}>
        <h2>Sign in to Workspace</h2>
        <input required placeholder="Email" type="email" value={email} onChange={e => setEmail(e.target.value)} style={{ padding: 8, borderRadius: 4, border: '1px solid #ccc' }} />
        <input required placeholder="Display name" value={name} onChange={e => setName(e.target.value)} style={{ padding: 8, borderRadius: 4, border: '1px solid #ccc' }} />
        <button type="submit" style={{ padding: 8, background: '#1a3a5c', color: '#fff', border: 'none', borderRadius: 4, cursor: 'pointer' }}>Sign in</button>
        <p style={{ fontSize: 12, color: '#888' }}>POC only — not for production use.</p>
      </form>
    </div>
  );
}
