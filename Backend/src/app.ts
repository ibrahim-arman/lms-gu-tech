import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import { pinoHttp } from 'pino-http';
import rateLimit from 'express-rate-limit';
import { z } from 'zod';
import { env } from './config/env.js';
import { supabaseAdmin } from './config/supabase.js';
import { authenticate, requireRole } from './middleware/auth.js';
import { errorHandler, notFound } from './middleware/errors.js';

export const app = express();
app.disable('x-powered-by');
app.use(helmet());
app.use(cors({ origin: env.CLIENT_URL, methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'], allowedHeaders: ['Content-Type', 'Authorization'] }));
app.use(express.json({ limit: '1mb' }));
app.use(pinoHttp({ redact: ['req.headers.authorization', 'req.body.password'] }));
app.use('/api', rateLimit({ windowMs: 60_000, limit: 120, standardHeaders: 'draft-7', legacyHeaders: false }));

app.get('/api/health', (_req, res) => res.json({ data: { status: 'ok', timestamp: new Date().toISOString() } }));
app.get('/api/me', authenticate, async (req, res, next) => {
  try {
    const { data, error } = await supabaseAdmin.from('profiles').select('id,full_name,email,role,avatar_url,is_active,created_at').eq('id', req.user!.id).single();
    if (error) throw error;
    return res.json({ data });
  } catch (error) { return next(error); }
});

app.get('/api/courses', authenticate, async (req, res, next) => {
  try {
    let query = supabaseAdmin.from('courses').select('id,code,title,description,teacher_id,is_archived,created_at');
    if (req.user!.role === 'teacher') query = query.eq('teacher_id', req.user!.id);
    if (req.user!.role === 'student') {
      const { data: enrollments, error: enrollmentError } = await supabaseAdmin.from('enrollments').select('course_id').eq('student_id', req.user!.id);
      if (enrollmentError) throw enrollmentError;
      const ids = (enrollments ?? []).map(row => row.course_id);
      if (!ids.length) return res.json({ data: [] });
      query = query.in('id', ids);
    }
    const { data, error } = await query.order('created_at', { ascending: false }).range(0, 99);
    if (error) throw error;
    return res.json({ data: data ?? [] });
  } catch (error) { return next(error); }
});

const profileUpdateSchema = z.object({ full_name: z.string().trim().min(1).max(120) }).strict();
app.patch('/api/me', authenticate, async (req, res, next) => {
  try {
    const input = profileUpdateSchema.parse(req.body);
    const { data, error } = await supabaseAdmin.from('profiles').update({ full_name: input.full_name }).eq('id', req.user!.id)
      .select('id,full_name,email,role,avatar_url,is_active,created_at').single();
    if (error) throw error;
    return res.json({ data });
  } catch (error) { return next(error); }
});

const createUserSchema = z.object({
  email: z.string().trim().email().max(254), full_name: z.string().trim().min(1).max(120),
  role: z.enum(['admin', 'teacher', 'student']), password: z.string().min(8).max(128).regex(/[A-Za-z]/).regex(/\d/),
}).strict();
app.post('/api/users', authenticate, requireRole('admin'), async (req, res, next) => {
  try {
    const input = createUserSchema.parse(req.body);
    const { data: created, error: createError } = await supabaseAdmin.auth.admin.createUser({
      email: input.email, password: input.password, email_confirm: true, user_metadata: { full_name: input.full_name },
    });
    if (createError) throw createError;
    if (!created.user) throw new Error('Supabase did not return the created user.');
    const { data, error } = await supabaseAdmin.from('profiles').update({ full_name: input.full_name, role: input.role }).eq('id', created.user.id)
      .select('id,full_name,email,role,avatar_url,is_active,created_at').single();
    if (error) { await supabaseAdmin.auth.admin.deleteUser(created.user.id); throw error; }
    return res.status(201).json({ data });
  } catch (error) { return next(error); }
});

const adminUserUpdateSchema = z.object({
  full_name: z.string().trim().min(1).max(120).optional(), role: z.enum(['admin', 'teacher', 'student']).optional(),
  is_active: z.boolean().optional(),
}).strict().refine(value => Object.keys(value).length > 0);
app.patch('/api/users/:id', authenticate, requireRole('admin'), async (req, res, next) => {
  try {
    const input = adminUserUpdateSchema.parse(req.body);
    const { data, error } = await supabaseAdmin.from('profiles').update(input).eq('id', req.params.id)
      .select('id,full_name,email,role,avatar_url,is_active,created_at').maybeSingle();
    if (error) throw error;
    if (!data) return res.status(404).json({ error: { code: 'NOT_FOUND', message: 'User not found.' } });
    return res.json({ data });
  } catch (error) { return next(error); }
});

app.delete('/api/users/:id', authenticate, requireRole('admin'), async (req, res, next) => {
  try {
    const { data, error } = await supabaseAdmin.from('profiles').update({ is_active: false }).eq('id', req.params.id).select('id').maybeSingle();
    if (error) throw error;
    if (!data) return res.status(404).json({ error: { code: 'NOT_FOUND', message: 'User not found.' } });
    return res.status(204).end();
  } catch (error) { return next(error); }
});

const listUsersQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
  role: z.enum(['admin', 'teacher', 'student']).optional(),
  search: z.string().trim().max(100).regex(/^[\p{L}\p{N}\s@._+-]*$/u).optional(),
}).strict();
app.get('/api/users', authenticate, requireRole('admin'), async (req, res, next) => {
  try {
    const queryInput = listUsersQuerySchema.parse(req.query);
    let query = supabaseAdmin.from('profiles').select('id,full_name,email,role,avatar_url,is_active,created_at', { count: 'exact' }).order('created_at', { ascending: false });
    if (queryInput.role) query = query.eq('role', queryInput.role);
    if (queryInput.search) {
      const escapedSearch = queryInput.search.replace(/[%_]/g, character => `\\${character}`);
      query = query.or(`full_name.ilike.%${escapedSearch}%,email.ilike.%${escapedSearch}%`);
    }
    const from = (queryInput.page - 1) * queryInput.pageSize;
    const { data, error, count } = await query.range(from, from + queryInput.pageSize - 1);
    if (error) throw error;
    return res.json({ data: data ?? [], meta: { page: queryInput.page, pageSize: queryInput.pageSize, total: count ?? 0 } });
  } catch (error) { return next(error); }
});

app.use(notFound);
app.use(errorHandler);
