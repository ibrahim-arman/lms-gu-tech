import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { z } from 'zod';
import { ArrowRight, Check, Eye, EyeOff, KeyRound, Mail, ShieldCheck } from 'lucide-react';
import { supabase } from '../../lib/supabase';

const emailSchema = z.string().trim().email();
const passwordSchema = z.string().min(8).max(128).regex(/[A-Za-z]/).regex(/\d/);
function AuthBrand() { return <Link className="brand" to="/login"><span className="brand-mark">G</span><span className="brand-copy"><b>gutech</b><small>LEARNING STUDIO</small></span></Link>; }

export function ForgotPasswordPage() {
  const [email, setEmail] = useState(''); const [pending, setPending] = useState(false); const [sent, setSent] = useState(false); const [error, setError] = useState('');
  const submit = async (event: React.FormEvent) => {
    event.preventDefault(); setError('');
    if (!emailSchema.safeParse(email).success) { setError('Enter a valid email address.'); return; }
    if (!supabase) { setError('Password recovery is unavailable until Supabase is configured.'); return; }
    setPending(true);
    const { error: requestError } = await supabase.auth.resetPasswordForEmail(email.trim(), { redirectTo: `${window.location.origin}/reset-password` });
    setPending(false);
    if (requestError) { setError('We could not send the reset email. Please try again.'); return; }
    setSent(true);
  };
  return <div className="auth-simple"><AuthBrand /><div className="auth-simple-card"><div className="auth-card-icon"><Mail size={20} /></div><div className="eyebrow">ACCOUNT RECOVERY</div><h1>{sent ? 'Check your inbox.' : 'Forgot your password?'}</h1><p>{sent ? 'If an account exists for that email, we’ve sent instructions to reset your password.' : 'Enter your GUTECH email and we’ll send you a link to reset your password.'}</p>{!sent && <form onSubmit={event => void submit(event)}><label className="login-label">EMAIL ADDRESS<input type="email" autoComplete="email" required value={email} onChange={event => setEmail(event.target.value)} placeholder="you@gutech.edu" /></label>{error && <div role="alert" className="form-error">{error}</div>}<button className="sign-in-button" disabled={pending}>{pending ? 'Sending…' : <>Send reset link <ArrowRight size={16} /></>}</button></form>}{sent && <div className="reset-sent-note"><Check size={15} /> The message may take a few minutes to arrive.</div>}<Link className="back-link" to="/login">← Back to sign in</Link></div></div>;
}

export function ResetPasswordPage() {
  const navigate = useNavigate(); const [password, setPassword] = useState(''); const [confirmPassword, setConfirmPassword] = useState(''); const [hasSession, setHasSession] = useState(false); const [checking, setChecking] = useState(true); const [pending, setPending] = useState(false); const [message, setMessage] = useState(''); const [complete, setComplete] = useState(false); const [showPassword, setShowPassword] = useState(false);
  useEffect(() => {
    if (!supabase) { setChecking(false); return; }
    let alive = true;
    void supabase.auth.getSession().then(({ data }) => { if (alive) { setHasSession(Boolean(data.session)); setChecking(false); } });
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => { window.setTimeout(() => { if (alive) { setHasSession(Boolean(session)); setChecking(false); } }, 0); });
    return () => { alive = false; subscription.unsubscribe(); };
  }, []);
  const strength = password.length === 0 ? 0 : Number(password.length >= 8) + Number(/[A-Za-z]/.test(password)) + Number(/\d/.test(password)) + Number(password.length >= 12 || /[^A-Za-z0-9]/.test(password));
  const strengthLabels = ['', 'Weak', 'Fair', 'Good', 'Strong'];
  const submit = async (event: React.FormEvent) => {
    event.preventDefault(); setMessage('');
    if (!passwordSchema.safeParse(password).success) { setMessage('Use at least 8 characters, including one letter and one number.'); return; }
    if (password !== confirmPassword) { setMessage('The passwords do not match.'); return; }
    if (!supabase || !hasSession) { setMessage('This recovery link is invalid or expired. Request a new one to continue.'); return; }
    setPending(true);
    const { error } = await supabase.auth.updateUser({ password });
    setPending(false);
    if (error) { setMessage('This recovery link is invalid or expired. Request a new one to continue.'); setHasSession(false); return; }
    setComplete(true); setMessage('Your password has been updated. Sign in with your new password.');
    await supabase.auth.signOut();
    window.setTimeout(() => navigate('/login', { replace: true }), 2200);
  };
  return <div className="auth-simple"><AuthBrand /><div className="auth-simple-card"><div className="auth-card-icon"><KeyRound size={20} /></div><div className="eyebrow">ACCOUNT RECOVERY</div><h1>{complete ? 'You’re all set.' : 'Choose a new password.'}</h1><p>{complete ? 'Your new password is ready. Taking you back to sign in…' : 'Choose a strong password you haven’t used before.'}</p>{checking ? <div className="reset-checking">Checking your recovery link…</div> : !hasSession && !complete ? <div className="recovery-expired"><ShieldCheck size={19} /><div><b>This link can’t be used</b><span>It may have expired or already been used. Request a fresh reset link to continue.</span></div><Link className="sign-in-button" to="/forgot-password">Request a new link <ArrowRight size={15} /></Link></div> : !complete && <form onSubmit={event => void submit(event)}><label className="login-label">NEW PASSWORD<div className="password-wrap"><input type={showPassword ? 'text' : 'password'} autoComplete="new-password" required value={password} onChange={event => setPassword(event.target.value)} placeholder="At least 8 characters" /><button type="button" aria-label={showPassword ? 'Hide password' : 'Show password'} onClick={() => setShowPassword(!showPassword)}>{showPassword ? <EyeOff size={15} /> : <Eye size={15} />}</button></div></label><div className="strength-wrap" aria-live="polite"><div className="strength-bars">{[1, 2, 3, 4].map(level => <i key={level} className={strength >= level ? `strength-${strength}` : ''} />)}</div><span>Password strength <b>{strengthLabels[strength]}</b></span></div><label className="login-label">CONFIRM NEW PASSWORD<input type="password" autoComplete="new-password" required value={confirmPassword} onChange={event => setConfirmPassword(event.target.value)} placeholder="Enter your password again" /></label>{message && <div role="alert" className="form-error">{message}</div>}<button className="sign-in-button" disabled={pending}>{pending ? 'Updating…' : <>Update password <ArrowRight size={16} /></>}</button></form>}{complete && <div className="reset-sent-note"><Check size={15} /> Password updated successfully</div>}<Link className="back-link" to="/login">← Back to sign in</Link></div></div>;
}

export function ChangePasswordCard() {
  const [currentPassword, setCurrentPassword] = useState(''); const [password, setPassword] = useState(''); const [confirm, setConfirm] = useState(''); const [pending, setPending] = useState(false); const [message, setMessage] = useState(''); const [error, setError] = useState(false);
  const submit = async (event: React.FormEvent) => {
    event.preventDefault(); setError(false); setMessage('');
    if (!passwordSchema.safeParse(password).success) { setError(true); setMessage('Use at least 8 characters, including one letter and one number.'); return; }
    if (password !== confirm) { setError(true); setMessage('The new passwords do not match.'); return; }
    if (!supabase) { setError(true); setMessage('Password updates are unavailable until Supabase is configured.'); return; }
    setPending(true);
    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError || !user?.email) { setPending(false); setError(true); setMessage('Your session could not be verified. Sign in again and retry.'); return; }
    const { error: authError } = await supabase.auth.signInWithPassword({ email: user.email, password: currentPassword });
    if (authError) { setPending(false); setError(true); setMessage('Your current password is incorrect.'); return; }
    const { error: updateError } = await supabase.auth.updateUser({ password });
    setPending(false);
    if (updateError) { setError(true); setMessage('We could not update your password. Please try again.'); return; }
    setCurrentPassword(''); setPassword(''); setConfirm(''); setMessage('Password updated successfully.');
  };
  return <section className="panel change-password-card"><div className="panel-heading"><div><span className="eyebrow">SIGN-IN SECURITY</span><h3>Change password</h3></div><div className="security-symbol"><KeyRound size={18} /></div></div><p className="profile-hint">Confirm your current password before choosing a new one.</p><form onSubmit={event => void submit(event)}><label className="field-label">CURRENT PASSWORD<input type="password" autoComplete="current-password" required value={currentPassword} onChange={event => setCurrentPassword(event.target.value)} /></label><div className="change-password-grid"><label className="field-label">NEW PASSWORD<input type="password" autoComplete="new-password" minLength={8} required value={password} onChange={event => setPassword(event.target.value)} /></label><label className="field-label">CONFIRM NEW PASSWORD<input type="password" autoComplete="new-password" minLength={8} required value={confirm} onChange={event => setConfirm(event.target.value)} /></label></div>{message && <p className={error ? 'profile-form-error' : 'profile-message'} role={error ? 'alert' : 'status'}>{message}</p>}<button className="primary-button" disabled={pending || !currentPassword || !password || !confirm}>{pending ? 'Updating…' : <>Update password <ArrowRight size={14} /></>}</button></form></section>;
}
