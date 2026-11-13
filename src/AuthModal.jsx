import { useState } from 'react'
import { ArrowRight, Building2, LockKeyhole, ShieldCheck, UserRound, X } from 'lucide-react'

export function AuthModal({ onClose, onSuccess }) {
  const [intent, setIntent] = useState('login')
  const [role, setRole] = useState('shipper')
  const [data, setData] = useState({ name: '', email: '', password: '', adminSetupKey: '' })
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const submit = async event => {
    event.preventDefault(); setBusy(true); setError('')
    try {
      const response = await fetch(`/api/auth/${intent === 'signup' ? 'register' : 'login'}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, credentials: 'include', body: JSON.stringify({ ...data, role }) })
      const result = await response.json()
      if (!response.ok) throw new Error(result.error || 'Could not sign in.')
      onSuccess(result.user)
      onClose()
    } catch (reason) { setError(reason.message || 'Account service is unavailable. Start the Lantern app server and try again.') }
    finally { setBusy(false) }
  }
  return <div className="modal-backdrop" onMouseDown={event => event.target === event.currentTarget && onClose()}><form onSubmit={submit} className="modal-card auth-card"><div className="flex items-start justify-between"><div><p className="eyebrow">LANTERN SOLUTIONS · ACCOUNT</p><h2 className="font-display text-xl font-extrabold">{intent === 'signup' ? 'Join the freight network' : 'Welcome back'}</h2><p className="mt-1 text-[11px] text-[#7b8898]">Browse the public board anytime. Sign in to manage your account.</p></div><button type="button" className="rounded-lg p-2" onClick={onClose}><X size={16}/></button></div><div className="auth-tabs"><button type="button" onClick={() => { setIntent('login');setError('') }} className={intent === 'login' ? 'active' : ''}>Sign in</button><button type="button" onClick={() => { setIntent('signup');setError('') }} className={intent === 'signup' ? 'active' : ''}>Create account</button></div>{intent === 'signup' && <div className="role-picker"><button type="button" onClick={() => setRole('shipper')} className={role === 'shipper' ? 'active' : ''}><UserRound size={15}/> Shipper / customer</button><button type="button" onClick={() => setRole('carrier')} className={role === 'carrier' ? 'active' : ''}><TruckIcon/> Trucking company</button><button type="button" onClick={() => setRole('admin')} className={role === 'admin' ? 'active' : ''}><ShieldCheck size={15}/> Lantern admin</button></div>}{intent === 'signup' && <label className="form-label">Full name<input required autoComplete="name" className="form-input" value={data.name} onChange={event => setData({ ...data, name: event.target.value })} placeholder="Your name"/></label>}<label className="form-label mt-3">Email address<input required type="email" autoComplete="email" className="form-input" value={data.email} onChange={event => setData({ ...data, email: event.target.value })} placeholder="you@example.com"/></label><label className="form-label mt-3">Password<input required type="password" autoComplete={intent === 'signup' ? 'new-password' : 'current-password'} minLength={intent === 'signup' ? 12 : undefined} className="form-input" value={data.password} onChange={event => setData({ ...data, password: event.target.value })} placeholder={intent === 'signup' ? 'At least 12 characters' : 'Enter your password'}/></label>{intent === 'signup' && role === 'admin' && <label className="form-label mt-3">Server admin setup key<input required type="password" className="form-input" value={data.adminSetupKey} onChange={event => setData({ ...data, adminSetupKey: event.target.value })} placeholder="See data/.lantern-admin-setup-key on the server"/><small className="auth-help">Lantern creates this key automatically when the server starts. Read it from the server’s local data folder.</small></label>}{error && <p className="auth-error" role="alert">{error}</p>}<button disabled={busy} className="primary-btn mt-5 w-full" type="submit">{busy ? 'Please wait…' : intent === 'signup' ? 'Create account' : 'Sign in'} <ArrowRight size={14}/></button><p className="auth-security"><LockKeyhole size={12}/> Passwords are hashed on the server. Public jobs remain visible to everyone.</p></form></div>
}

export function AccountGate({ role, onSuccess, onBack }) {
  const [open, setOpen] = useState(true)
  const title = role === 'admin' ? 'Admin sign-in required' : role === 'carrier' ? 'Carrier account required' : 'Sign in to continue'
  const explanation = role === 'admin' ? 'Admin access is restricted to accounts created with the server setup key.' : role === 'carrier' ? 'Create or sign in to a carrier account to register trucks and send offers.' : 'Sign in to negotiate prices, track shipments, or manage private shipment records.'
  return <div id="app-shell" data-theme={localStorage.getItem('lantern-theme') || 'light'} className="app-shell min-h-screen"><header className="topbar flex min-h-[72px] items-center justify-between border-b px-4 md:px-8"><b className="font-display text-[15px]">Lantern Solutions</b><button onClick={onBack} className="portal-back">Back to dashboard</button></header><main className="account-gate"><span><Building2 size={20}/></span><h1>{title}</h1><p>{explanation}</p><button className="primary-btn" onClick={() => setOpen(true)}>{role === 'admin' ? 'Admin sign in' : 'Sign in or create account'} <ArrowRight size={14}/></button></main>{open && <AuthModal onClose={() => setOpen(false)} onSuccess={onSuccess}/>}</div>
}

function TruckIcon() { return <Building2 size={15}/> }
