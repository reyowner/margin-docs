import { useEffect, useState } from 'react';
import { ArrowRight, Check, Eye, EyeOff, FileText, LockKeyhole, Sparkles } from 'lucide-react';
import { Button } from './ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card';
import { Input } from './ui/input';
import { Label } from './ui/label';

async function loadDemoUsers() {
  const response = await fetch('/api/auth/demo-users');
  if (!response.ok) throw new Error('Could not load the local demo accounts.');
  return response.json();
}

export function LoginPage({ onLogin }) {
  const [accounts, setAccounts] = useState([]);
  const [email, setEmail] = useState('domasigreoner@gmail.com');
  const [password, setPassword] = useState('margin2026!');
  const [visible, setVisible] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => { loadDemoUsers().then(setAccounts).catch((err) => setError(err.message)); }, []);

  async function submit(event) {
    event.preventDefault();
    setError('');
    setBusy(true);
    try {
      const response = await fetch('/api/auth/login', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, credentials: 'same-origin',
        body: JSON.stringify({ email, password }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Sign in failed.');
      onLogin(data);
    } catch (err) { setError(err.message); }
    finally { setBusy(false); }
  }

  return <main className="login-page">
    <section className="login-story">
      <a className="brand-lockup" href="#home" aria-label="Margin home"><span className="brand-icon"><FileText size={17} /></span><span>margin</span></a>
      <div className="story-copy">
        <span className="story-marker"><Sparkles size={14} /> A calm place for shared work</span>
        <h1>Good ideas get<br /><em>better in company.</em></h1>
        <p>Write, refine, and keep your team’s thinking in one clear place.</p>
      </div>
      <div className="story-proof"><span><Check size={14} /> Live writing</span><span><Check size={14} /> Private by default</span><span><Check size={14} /> Saved as you go</span></div>
      <div className="login-illustration" aria-hidden="true"><div className="orbit orbit-one" /><div className="orbit orbit-two" /><div className="orbit-dot dot-one" /><div className="orbit-dot dot-two" /><div className="paper-stack"><span /><span /><span /><i /><b /></div><div className="cursor-line" /></div>
      <p className="story-foot">A little margin makes room for the work.</p>
    </section>

    <section className="login-panel">
      <Card className="login-card">
        <CardHeader className="login-card-head">
          <div className="mobile-brand"><span className="brand-icon"><FileText size={16} /></span><span>margin</span></div>
          <span className="login-kicker"><LockKeyhole size={13} /> YOUR WRITING ROOM</span>
          <CardTitle>Welcome back</CardTitle>
          <CardDescription>Sign in to pick up where your team left off.</CardDescription>
        </CardHeader>
        <CardContent>
          <form className="login-form" onSubmit={submit}>
            <div className="field-stack"><Label htmlFor="login-email">Email address</Label><Input id="login-email" type="email" autoComplete="username" value={email} onChange={(event) => setEmail(event.target.value)} placeholder="you@team.com" required /></div>
            <div className="field-stack"><div className="field-heading"><Label htmlFor="login-password">Password</Label><span className="local-note">Local demo</span></div><div className="password-wrap"><Input id="login-password" type={visible ? 'text' : 'password'} autoComplete="current-password" value={password} onChange={(event) => setPassword(event.target.value)} required /><button className="password-toggle" type="button" aria-label={visible ? 'Hide password' : 'Show password'} onClick={() => setVisible((value) => !value)}>{visible ? <EyeOff size={16} /> : <Eye size={16} />}</button></div></div>
            {error && <p role="alert" className="form-error">{error}</p>}
            <Button className="login-submit" type="submit" size="lg" disabled={busy}>{busy ? 'Signing in…' : <>Sign in <ArrowRight size={16} /></>}</Button>
          </form>
          <div className="demo-divider"><span /> <span>LOCAL DEMO ACCOUNTS</span> <span /></div>
          <div className="demo-account-list">{accounts.map((account) => <button type="button" className="demo-account" key={account.id} onClick={() => { setEmail(account.email); setPassword(account.demoPassword); setError(''); }}><span className="demo-avatar" style={{ '--avatar-color': account.color }}>{account.name[0]}</span><span className="demo-account-copy"><strong>{account.name}</strong><small>{account.email}</small></span><span className="demo-use">Use</span></button>)}</div>
          <p className="login-security">These seeded accounts are for this local demo. This is not production authentication.</p>
        </CardContent>
      </Card>
      <div className="login-footer"><span>© 2026 Margin</span><span>Built for work in progress</span></div>
    </section>
  </main>;
}
