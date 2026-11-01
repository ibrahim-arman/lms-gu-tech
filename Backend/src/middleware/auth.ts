import type { NextFunction, Request, Response } from 'express';
import { supabaseAdmin } from '../config/supabase.js';

export async function authenticate(req: Request, res: Response, next: NextFunction) {
  const token = req.headers.authorization?.match(/^Bearer\s+(.+)$/i)?.[1];
  if (!token) return res.status(401).json({ error: { code: 'UNAUTHENTICATED', message: 'Sign in to continue.' } });
  const { data: { user }, error } = await supabaseAdmin.auth.getUser(token);
  if (error || !user) return res.status(401).json({ error: { code: 'UNAUTHENTICATED', message: 'Your session is invalid or expired.' } });
  const { data: profile, error: profileError } = await supabaseAdmin.from('profiles').select('id,email,role,is_active').eq('id', user.id).maybeSingle();
  if (profileError || !profile || !profile.is_active) return res.status(403).json({ error: { code: 'ACCOUNT_UNAVAILABLE', message: 'This account is unavailable.' } });
  req.user = { id: profile.id, email: profile.email, role: profile.role };
  next();
}

export function requireRole(...roles: Array<'admin' | 'teacher' | 'student'>) {
  return (req: Request, res: Response, next: NextFunction) => req.user && roles.includes(req.user.role)
    ? next()
    : res.status(403).json({ error: { code: 'FORBIDDEN', message: 'You do not have permission to do that.' } });
}
