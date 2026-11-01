import { useEffect, useState, createContext, useContext, lazy, Suspense } from 'react';
import { Link, Navigate, Outlet, Route, Routes, useLocation, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Activity, ArrowDownRight, ArrowRight, ArrowUpRight, Bell, BookOpen, CalendarDays, Check, ChevronDown, CircleHelp, Clock3, FileText, GraduationCap, LayoutDashboard, LogOut, Menu, MessageCircle, MoreHorizontal, Search, Settings2, ShieldAlert, Sparkles, Users, X } from 'lucide-react';
import { supabase } from './lib/supabase';
import { api } from './lib/api';
const UsersPage = lazy(() => import('./features/users/UsersPage'));
const ForgotPasswordPage = lazy(() => import('./features/auth/PasswordRecoveryPages').then(module => ({ default: module.ForgotPasswordPage })));
const ResetPasswordPage = lazy(() => import('./features/auth/PasswordRecoveryPages').then(module => ({ default: module.ResetPasswordPage })));
const ChangePasswordCard = lazy(() => import('./features/auth/PasswordRecoveryPages').then(module => ({ default: module.ChangePasswordCard })));

type Role = 'admin' | 'teacher' | 'student';
type Profile = { id: string; full_name: string; email: string; role: Role; avatar_url?: string | null; created_at?: string };
const AuthContext = createContext<{ profile: Profile | null; ready: boolean; refresh: () => Promise<void>; updateProfile: (profile: Profile) => void }>({ profile: null, ready: false, refresh: async () => {}, updateProfile: () => {} });
const useAuth = () => useContext(AuthContext);
const destination = (role: Role) => role === 'admin' ? '/admin' : role === 'teacher' ? '/teacher' : '/student';

function AuthProvider({ children }: { children: React.ReactNode }) {
  const [profile, setProfile] = useState<Profile | null>(null);
  const [ready, setReady] = useState(false);
  const refresh = async () => {
    if (!supabase) { setReady(true); return; }
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) { setProfile(null); setReady(true); return; }
    try { setProfile(await api<Profile>('/me')); } catch { setProfile(null); }
    setReady(true);
  };
  useEffect(() => {
    void refresh();
    const subscription = supabase?.auth.onAuthStateChange(() => { window.setTimeout(() => { void refresh(); }, 0); }).data.subscription;
    return () => subscription?.unsubscribe();
  }, []);
  return <AuthContext.Provider value={{ profile, ready, refresh, updateProfile: setProfile }}>{children}</AuthContext.Provider>;
}

function Guard({ roles }: { roles?: Role[] }) {
  const { profile, ready } = useAuth(); const location = useLocation();
  if (!ready) return <div className="boot-screen"><div className="brand-mark">G</div><span className="muted">Preparing your workspace</span></div>;
  if (!profile) return <Navigate to="/login" state={{ from: location.pathname }} replace />;
  if (roles && !roles.includes(profile.role)) return <Navigate to={destination(profile.role)} replace />;
  return <Outlet />;
}

const menuByRole: Record<Role, { label: string; to: string; icon: typeof LayoutDashboard }[]> = {
  student: [{ label: 'Overview', to: '/student', icon: LayoutDashboard }, { label: 'My courses', to: '/courses', icon: BookOpen }, { label: 'Assignments', to: '/assignments', icon: FileText }, { label: 'Grades', to: '/grades', icon: Activity }, { label: 'Messages', to: '/chat', icon: MessageCircle }, { label: 'My complaints', to: '/complaints', icon: ShieldAlert }],
  teacher: [{ label: 'Overview', to: '/teacher', icon: LayoutDashboard }, { label: 'My courses', to: '/courses', icon: BookOpen }, { label: 'Assignments', to: '/assignments', icon: FileText }, { label: 'Gradebook', to: '/grades', icon: Activity }, { label: 'Class chat', to: '/chat', icon: MessageCircle }, { label: 'Complaints', to: '/complaints', icon: ShieldAlert }],
  admin: [{ label: 'Overview', to: '/admin', icon: LayoutDashboard }, { label: 'Courses', to: '/courses', icon: BookOpen }, { label: 'People', to: '/users', icon: Users }, { label: 'Announcements', to: '/announcements', icon: Bell }, { label: 'Complaints', to: '/complaints', icon: ShieldAlert }],
};

function Shell() {
  const { profile } = useAuth(); const location = useLocation(); const [mobileNav, setMobileNav] = useState(false); const [menu, setMenu] = useState(false);
  const nav = menuByRole[profile!.role]; const firstName = profile!.full_name?.split(' ')[0] || 'Learner';
  const signOut = async () => { await supabase?.auth.signOut(); };
  return <div className="app-shell">
    <aside className={`sidebar ${mobileNav ? 'sidebar-open' : ''}`}>
      <Link className="brand" to={destination(profile!.role)}><span className="brand-mark">G</span><span className="brand-copy"><b>gutech</b><small>LEARNING STUDIO</small></span></Link>
      <div className="workspace-label">WORKSPACE <ChevronDown size={13} /></div>
      <div className="workspace-card"><div className="workspace-emblem">G</div><div><b>GUTECH</b><small>Main campus</small></div><MoreHorizontal size={17} className="workspace-more" /></div>
      <div className="nav-caption">MENU</div>
      <nav className="side-nav">{nav.map(item => { const Icon = item.icon; const active = location.pathname === item.to || (item.to !== destination(profile!.role) && location.pathname.startsWith(item.to + '/')); return <Link key={item.label} to={item.to} onClick={() => setMobileNav(false)} className={`nav-link ${active ? 'active' : ''}`}><Icon size={18} strokeWidth={1.8} /><span>{item.label}</span>{item.label === 'Assignments' && <span className="nav-count">3</span>}</Link>; })}</nav>
      <div className="sidebar-spacer" />
      <div className="streak-card"><div className="streak-orbit"><Sparkles size={18} /></div><b>A little progress<br />goes a long way.</b><p>Keep showing up. Your future self is cheering for you.</p><div className="streak-foot"><span>YOUR LEARNING STREAK</span><strong>04 <small>days</small> <span>✳</span></strong></div></div>
      <Link className={`nav-link profile-nav ${location.pathname === '/profile' ? 'active' : ''}`} to="/profile"><Settings2 size={18} /><span>Settings</span></Link>
      <button className="side-user" onClick={() => setMenu(!menu)}><div className="avatar avatar-small">{initials(profile!.full_name)}</div><span className="side-user-copy"><b>{profile!.full_name || 'Your profile'}</b><small>{profile!.role}</small></span><MoreHorizontal size={18} /></button>
      {menu && <div className="profile-pop"><Link to="/profile" onClick={() => setMenu(false)}>View profile</Link><button onClick={signOut}><LogOut size={15} /> Sign out</button></div>}
    </aside>
    {mobileNav && <button aria-label="Close menu" className="scrim" onClick={() => setMobileNav(false)} />}
    <main className="main-area"><header className="topbar"><button className="icon-button mobile-menu" aria-label="Open navigation" onClick={() => setMobileNav(true)}><Menu size={20} /></button><div className="breadcrumbs">Pages <span>/</span> <b>{pageName(location.pathname)}</b></div><div className="top-actions"><label className="searchbox"><Search size={16} /><input placeholder="Search anything..." /><kbd>⌘ K</kbd></label><button className="icon-button notification-button" aria-label="Notifications"><Bell size={18} /><i /></button><button className="top-avatar" onClick={() => location.pathname !== '/profile' && (window.location.href = '/profile')}>{initials(profile!.full_name)}</button></div></header><Outlet /></main>
  </div>;
}

function initials(name = '') { return name.trim().split(/\s+/).slice(0, 2).map(part => part[0]?.toUpperCase()).join('') || 'G'; }
function pageName(path: string) { if (path === '/profile') return 'My profile'; if (path.includes('courses')) return 'My courses'; if (path.includes('assignment')) return 'Assignments'; if (path.includes('grade')) return 'Grades'; if (path.includes('complaint')) return 'Complaints'; if (path.includes('chat')) return 'Class chat'; if (path.includes('users')) return 'People'; if (path.includes('announcement')) return 'Announcements'; return 'Overview'; }
const courses = [{ code: 'CS 204', title: 'Human Computer Interaction', teacher: 'Dr. Amina Rahman', color: 'lavender', icon: '✳', progress: 72, next: 'Design systems workshop', time: 'Today · 11:30 AM' }, { code: 'CS 318', title: 'Data Structures & Algorithms', teacher: 'Prof. Omar Khalid', color: 'mint', icon: '⌘', progress: 48, next: 'Graph traversal lab', time: 'Tomorrow · 9:00 AM' }, { code: 'SE 302', title: 'Software Quality Assurance', teacher: 'Dr. Sara Ahmed', color: 'peach', icon: '◈', progress: 86, next: 'Testing strategies', time: 'Wed · 1:00 PM' }];

function Dashboard() {
  const { profile } = useAuth(); const greeting = new Date().getHours() < 12 ? 'Good morning' : new Date().getHours() < 17 ? 'Good afternoon' : 'Good evening';
  const { data: liveCourses } = useQuery({ queryKey: ['courses'], queryFn: () => api<unknown[]>('/courses'), enabled: Boolean(supabase) });
  const isLearner = profile?.role === 'student';
  return <div className="page-content"><div className="welcome-row"><div><div className="eyebrow"><span className="eyebrow-dot" /> MONDAY, OCTOBER 26, 2026</div><h1>{greeting}, {profile?.full_name?.split(' ')[0] || 'there'} <span className="wave">✳</span></h1><p className="welcome-sub">{isLearner ? 'A new week, a fresh page. Let’s make it count.' : profile?.role === 'teacher' ? 'Your classrooms are ready when you are.' : 'Here’s what’s happening across your learning community.'}</p></div><button className="date-button"><CalendarDays size={16} /> This week <ChevronDown size={14} /></button></div>
    <section className="hero-card"><div className="hero-copy"><span className="hero-chip"><Sparkles size={13} /> YOUR LEARNING SPACE</span><h2>Small steps.<br /><em>Big ideas.</em></h2><p>Every great thing starts with showing up. You’re right where you need to be.</p><Link to="/courses" className="hero-cta">Explore your courses <ArrowRight size={16} /></Link></div><div className="hero-art" aria-hidden="true"><div className="art-sun" /><div className="art-orbit orbit-one" /><div className="art-orbit orbit-two" /><div className="art-book book-back" /><div className="art-book book-front"><span>G</span></div><span className="art-star star-one">✳</span><span className="art-star star-two">✦</span><span className="art-dot dot-one" /><span className="art-dot dot-two" /><div className="art-label">LEARN<br />AT YOUR<br />OWN PACE</div></div><div className="hero-index">01 <span>/ 04</span></div></section>
    <section className="stats-grid"><StatCard label="ACTIVE COURSES" value={liveCourses?.length ? String(liveCourses.length).padStart(2, '0') : '03'} delta="+1 this semester" icon={<BookOpen size={17} />} tone="purple" positive /><StatCard label={isLearner ? 'COMPLETED HOURS' : 'ACTIVE LEARNERS'} value={isLearner ? '24.5' : '128'} delta={isLearner ? '+4.5 this week' : '+12 this month'} icon={<Activity size={17} />} tone="lime" positive /><StatCard label={isLearner ? 'CURRENT GPA' : 'PENDING REVIEWS'} value={isLearner ? '3.82' : '08'} delta={isLearner ? 'Looking good' : 'Due this week'} icon={<GraduationCap size={17} />} tone="orange" positive={false} /></section>
    <div className="section-heading"><div><div className="eyebrow">YOUR SEMESTER</div><h2>In the rhythm <span>↗</span></h2></div><Link className="text-link" to="/courses">All courses <ArrowRight size={15} /></Link></div>
    <section className="course-grid">{courses.map((course, i) => <article key={course.code} className={`course-card ${course.color}`}><div className="course-card-top"><div className="course-symbol">{course.icon}</div><button aria-label={`More options for ${course.title}`} className="more-button"><MoreHorizontal size={18} /></button></div><div className="course-code">{course.code} <span>·</span> FALL 2026</div><h3>{course.title}</h3><div className="course-teacher"><div className={`teacher-dot teacher-${i}`}>{initials(course.teacher)}</div>{course.teacher}</div><div className="course-progress-label"><span>Course progress</span><b>{course.progress}%</b></div><div className="progress-track"><span style={{ width: `${course.progress}%` }} /></div><div className="course-next"><div className="next-icon"><CalendarDays size={15} /></div><div><small>UP NEXT</small><b>{course.next}</b><span>{course.time}</span></div><ArrowUpRight size={16} className="next-arrow" /></div></article>)}</section>
    <section className="lower-grid"><div className="panel schedule-panel"><div className="panel-heading"><div><span className="eyebrow">YOUR WEEK</span><h3>Coming up</h3></div><button className="icon-button"><MoreHorizontal size={19} /></button></div><div className="schedule-row"><div className="schedule-date"><b>26</b><span>MON</span></div><div className="schedule-mark mark-lavender" /><div className="schedule-event"><b>Design systems workshop</b><span>CS 204 · Room A-204</span></div><span className="event-time">11:30 AM</span></div><div className="schedule-row"><div className="schedule-date"><b>27</b><span>TUE</span></div><div className="schedule-mark mark-mint" /><div className="schedule-event"><b>Graph traversal lab</b><span>CS 318 · Innovation Lab</span></div><span className="event-time">9:00 AM</span></div><div className="schedule-row"><div className="schedule-date"><b>28</b><span>WED</span></div><div className="schedule-mark mark-peach" /><div className="schedule-event"><b>Testing strategies</b><span>SE 302 · Room B-110</span></div><span className="event-time">1:00 PM</span></div><div className="schedule-row"><div className="schedule-date"><b>30</b><span>FRI</span></div><div className="schedule-mark mark-yellow" /><div className="schedule-event"><b>Algorithm analysis quiz</b><span>CS 318 · Online</span></div><span className="event-time">2:30 PM</span></div></div>
    <div className="panel tasks-panel"><div className="panel-heading"><div><span className="eyebrow">STAY ON TRACK</span><h3>Up next <span className="count-badge">3</span></h3></div><Link to="/assignments" className="mini-link">View all <ArrowRight size={14} /></Link></div><div className="task-item"><span className="task-check"><Check size={13} /></span><div className="task-copy"><b>HCI research reflection</b><span>CS 204 · Essay</span></div><span className="task-due due-soon">Today</span></div><div className="task-item"><span className="task-check empty" /><div className="task-copy"><b>Binary tree implementation</b><span>CS 318 · Coding task</span></div><span className="task-due">Oct 28</span></div><div className="task-item"><span className="task-check empty" /><div className="task-copy"><b>QA test plan draft</b><span>SE 302 · Document</span></div><span className="task-due">Oct 30</span></div><Link to="/assignments" className="all-tasks">See your assignment list <ArrowRight size={15} /></Link></div></section>
    </div>;
}

function StatCard({ label, value, delta, icon, tone, positive }: { label: string; value: string; delta: string; icon: React.ReactNode; tone: string; positive: boolean }) { return <article className="stat-card"><div className="stat-top"><span>{label}</span><i className={`stat-icon ${tone}`}>{icon}</i></div><div className="stat-value">{value}</div><div className="stat-delta">{positive ? <ArrowUpRight size={14} /> : <Clock3 size={13} />}<span>{delta}</span></div></article>; }

function ProfilePage() {
  const { profile, updateProfile } = useAuth(); const [name, setName] = useState(profile?.full_name || ''); const [saving, setSaving] = useState(false); const [message, setMessage] = useState('');
  useEffect(() => setName(profile?.full_name || ''), [profile?.full_name]);
  const save = async () => { setSaving(true); setMessage(''); try { const updated = await api<Profile>('/me', { method: 'PATCH', body: JSON.stringify({ full_name: name }) }); updateProfile(updated); setMessage('Your name has been updated.'); } catch (error) { setMessage(error instanceof Error ? error.message : 'Could not update your profile.'); } finally { setSaving(false); } };
  return <div className="page-content"><div className="page-title-row"><div><div className="eyebrow">YOUR ACCOUNT</div><h1>My profile</h1><p className="welcome-sub">Your personal details and account preferences.</p></div></div>
    <div className="profile-layout"><section className="panel profile-card"><div className="profile-cover"><div className="cover-orbit" /><div className="profile-avatar">{initials(profile?.full_name)}</div></div><div className="profile-card-body"><div className="profile-name-line"><div><h2>{profile?.full_name || 'Your name'}</h2><span className="role-pill">{profile?.role}</span></div><span className="online-status"><i /> Active</span></div><p className="profile-email">{profile?.email}</p><div className="profile-divider" /><div className="profile-detail"><span>INSTITUTION</span><b>GUTECH · Main campus</b></div><div className="profile-detail"><span>ACCOUNT TYPE</span><b className="capitalize">{profile?.role} account</b></div><div className="profile-detail"><span>MEMBER SINCE</span><b>{profile?.created_at ? new Date(profile.created_at).toLocaleDateString(undefined, { month: 'long', year: 'numeric' }) : 'GUTECH'}</b></div></div></section>
      <section className="panel profile-edit"><div className="panel-heading"><div><span className="eyebrow">PERSONAL INFORMATION</span><h3>Account details</h3></div><span className="edit-badge">Institution managed</span></div><p className="profile-hint">Update your display name here. Your email address and account role are managed by your GUTECH administrator.</p><label className="field-label">FULL NAME<input value={name} maxLength={120} onChange={event => setName(event.target.value)} /></label><label className="field-label">EMAIL ADDRESS<input value={profile?.email || ''} readOnly /></label><label className="field-label">ROLE<input value={profile?.role || ''} readOnly className="capitalize" /></label>{message && <p className="profile-message" role="status">{message}</p>}<button className="primary-button" onClick={() => void save()} disabled={saving || !name.trim() || name.trim() === profile?.full_name}>{saving ? 'Saving…' : <>Save changes <Check size={15} /></>}</button></section></div>
    <Suspense fallback={<RouteLoading />}><ChangePasswordCard /></Suspense>
    <section className="panel security-panel"><div className="security-symbol"><ShieldAlert size={20} /></div><div><b>Account security</b><p>Your account is protected with secure sign-in through GUTECH.</p></div><button className="outline-button" onClick={() => void supabase?.auth.signOut()}><LogOut size={15} /> Sign out</button></section></div>;
}

function SimplePage({ title, eyebrow, description, icon: Icon }: { title: string; eyebrow: string; description: string; icon: typeof BookOpen }) { return <div className="page-content"><div className="page-title-row"><div><div className="eyebrow">{eyebrow}</div><h1>{title}</h1><p className="welcome-sub">{description}</p></div></div><div className="empty-panel"><div className="empty-icon"><Icon size={23} /></div><h2>Your {title.toLowerCase()} workspace</h2><p>Once your GUTECH administrator connects your Supabase project, your course data and activity will appear here.</p><Link to="/profile" className="outline-button">Check your profile <ArrowRight size={15} /></Link></div></div>; }

function Login() {
  const { profile } = useAuth(); const location = useLocation(); const navigate = useNavigate(); const [email, setEmail] = useState(''); const [password, setPassword] = useState(''); const [error, setError] = useState(''); const [pending, setPending] = useState(false); const [showPassword, setShowPassword] = useState(false);
  if (profile) return <Navigate to={destination(profile.role)} replace />;
  const submit = async (event: React.FormEvent) => { event.preventDefault(); setError(''); if (!supabase) { setError('Connect your Supabase project to enable sign in.'); return; } setPending(true); const { error: authError } = await supabase.auth.signInWithPassword({ email, password }); if (authError) { setError('We couldn’t sign you in. Check your details and try again.'); setPending(false); return; } const { data: { session } } = await supabase.auth.getSession(); if (!session) { setPending(false); setError('Your session could not be created. Please try again.'); return; } try { const me = await api<Profile>('/me'); navigate((location.state as { from?: string })?.from || destination(me.role), { replace: true }); } catch { setError('Your account is unavailable. Contact your GUTECH administrator.'); await supabase.auth.signOut(); } finally { setPending(false); } };
  return <div className="login-page"><div className="login-visual"><Link className="brand brand-light" to="/login"><span className="brand-mark">G</span><span className="brand-copy"><b>gutech</b><small>LEARNING STUDIO</small></span></Link><div className="login-visual-center"><div className="login-graphic"><div className="login-ring ring-a" /><div className="login-ring ring-b" /><div className="login-glyph">G<span>✳</span></div><span className="login-float float-a">✦</span><span className="login-float float-b">✳</span><span className="login-float float-c">·</span></div><div className="login-quote">“The beautiful thing about learning is that nobody can take it away from you.”</div><span className="login-author">B.B. KING <i /> A LIFE OF LEARNING</span></div><div className="login-visual-foot"><span>CURIOUS MINDS, BRIGHTER FUTURES.</span><span>GUTECH · 2026</span></div></div><div className="login-form-side"><div className="login-form-wrap"><div className="login-mobile-brand"><span className="brand-mark">G</span><b>gutech</b></div><div className="eyebrow"><span className="eyebrow-dot" /> YOUR NEXT CHAPTER STARTS HERE</div><h1>Welcome<br />back<span className="login-period">.</span></h1><p className="login-sub">Sign in to pick up where your curiosity left off.</p><form onSubmit={submit}><label className="login-label">EMAIL ADDRESS<input type="email" autoComplete="email" required value={email} onChange={e => setEmail(e.target.value)} placeholder="you@gutech.edu" /></label><label className="login-label">PASSWORD<div className="password-wrap"><input type={showPassword ? 'text' : 'password'} autoComplete="current-password" required value={password} onChange={e => setPassword(e.target.value)} placeholder="Enter your password" /><button type="button" onClick={() => setShowPassword(!showPassword)}>{showPassword ? 'Hide' : 'Show'}</button></div></label>{error && <div role="alert" className="form-error">{error}</div>}<div className="login-options"><label className="remember-check"><input type="checkbox" /> <span>Keep me signed in</span></label><Link to="/forgot-password">Forgot password?</Link></div><button className="sign-in-button" disabled={pending}>{pending ? 'Signing you in…' : <>Sign in to your space <ArrowRight size={17} /></>}</button></form><div className="login-help"><CircleHelp size={15} /><span>Need an account? Contact your GUTECH administrator.</span></div><div className="login-legal">By signing in, you agree to GUTECH’s <a href="#">Terms of use</a> and <a href="#">Privacy policy</a>.</div></div><div className="login-copyright">© 2026 GUTECH · LEARNING STUDIO</div></div></div>;
}



export default function App() {
  return <AuthProvider><Routes>
    <Route path="/login" element={<Login />} />
    <Route path="/forgot-password" element={<Suspense fallback={<RouteLoading />}><ForgotPasswordPage /></Suspense>} />
    <Route path="/reset-password" element={<Suspense fallback={<RouteLoading />}><ResetPasswordPage /></Suspense>} />
    <Route element={<Guard />}><Route element={<Shell />}>
      <Route path="/" element={<RoleHome />} />
      <Route path="/student" element={<Guard roles={['student']} />}><Route index element={<Dashboard />} /></Route>
      <Route path="/teacher" element={<Guard roles={['teacher']} />}><Route index element={<Dashboard />} /></Route>
      <Route path="/admin" element={<Guard roles={['admin']} />}><Route index element={<Dashboard />} /></Route>
      <Route path="/profile" element={<ProfilePage />} />
      <Route path="/courses" element={<SimplePage title="Courses" eyebrow="YOUR LEARNING" description="Explore your classes, course materials and learning progress." icon={BookOpen} />} />
      <Route path="/assignments" element={<SimplePage title="Assignments" eyebrow="WHAT?S ON YOUR DESK" description="Keep an eye on what?s due and celebrate what you?ve finished." icon={FileText} />} />
      <Route path="/grades" element={<SimplePage title="Grades" eyebrow="YOUR PROGRESS" description="See your feedback, grades and progress across your courses." icon={Activity} />} />
      <Route path="/chat" element={<SimplePage title="Class chat" eyebrow="LEARN TOGETHER" description="Stay connected with your classmates and teachers." icon={MessageCircle} />} />
      <Route path="/complaints" element={<SimplePage title="Complaints" eyebrow="WE?RE LISTENING" description="Share a concern or follow up on a report you?ve submitted." icon={ShieldAlert} />} />
      <Route path="/users" element={<Guard roles={['admin']} />}><Route index element={<Suspense fallback={<RouteLoading />}><UsersPage /></Suspense>} /></Route>
      <Route path="/announcements" element={<SimplePage title="Announcements" eyebrow="CAMPUS NOTES" description="The latest updates from your courses and campus." icon={Bell} />} />
    </Route></Route>
    <Route path="*" element={<Navigate to="/" replace />} />
  </Routes></AuthProvider>;
}
function RouteLoading() { return <div className="route-loading"><span className="brand-mark">G</span><span>Loading workspace?</span></div>; }
function RoleHome() { const { profile } = useAuth(); return <Navigate to={profile ? destination(profile.role) : '/login'} replace />; }
