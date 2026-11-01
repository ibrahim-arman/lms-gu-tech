create type public.user_role as enum ('admin', 'teacher', 'student');
create type public.complaint_status as enum ('open', 'in_review', 'resolved', 'rejected');

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text not null,
  email text not null unique,
  role public.user_role not null default 'student',
  avatar_url text,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);
create table public.courses (
  id uuid primary key default gen_random_uuid(), code text not null unique,
  title text not null, description text, teacher_id uuid not null references public.profiles(id),
  is_archived boolean not null default false, created_at timestamptz not null default now()
);
create table public.enrollments (
  id uuid primary key default gen_random_uuid(), course_id uuid not null references public.courses(id) on delete cascade,
  student_id uuid not null references public.profiles(id) on delete cascade,
  assigned_by uuid references public.profiles(id), created_at timestamptz not null default now(),
  unique (course_id, student_id)
);
create table public.resources (
  id uuid primary key default gen_random_uuid(), course_id uuid not null references public.courses(id) on delete cascade,
  uploaded_by uuid not null references public.profiles(id), title text not null, description text,
  file_path text, file_name text, mime_type text, file_size bigint, external_url text,
  created_at timestamptz not null default now(), check (file_path is not null or external_url is not null)
);
create table public.resource_views (
  id uuid primary key default gen_random_uuid(), resource_id uuid not null references public.resources(id) on delete cascade,
  student_id uuid not null references public.profiles(id) on delete cascade,
  first_seen_at timestamptz not null default now(), unique (resource_id, student_id)
);
create table public.assignments (
  id uuid primary key default gen_random_uuid(), course_id uuid not null references public.courses(id) on delete cascade,
  created_by uuid not null references public.profiles(id), title text not null, instructions text,
  attachment_path text, max_points numeric(6,2) not null default 100 check (max_points > 0),
  due_at timestamptz not null, allow_late boolean not null default false, created_at timestamptz not null default now()
);
create table public.submissions (
  id uuid primary key default gen_random_uuid(), assignment_id uuid not null references public.assignments(id) on delete cascade,
  student_id uuid not null references public.profiles(id) on delete cascade, text_answer text, file_path text, file_name text,
  submitted_at timestamptz not null default now(), is_late boolean not null default false,
  points numeric(6,2), feedback text, graded_by uuid references public.profiles(id), graded_at timestamptz,
  unique (assignment_id, student_id), check (points is null or points >= 0)
);
create table public.quizzes (
  id uuid primary key default gen_random_uuid(), course_id uuid not null references public.courses(id) on delete cascade,
  created_by uuid not null references public.profiles(id), title text not null, description text,
  time_limit_minutes int check (time_limit_minutes is null or time_limit_minutes > 0),
  max_attempts int not null default 1 check (max_attempts > 0), opens_at timestamptz, closes_at timestamptz,
  is_published boolean not null default false, show_answers_after_close boolean not null default false,
  created_at timestamptz not null default now(), check (closes_at is null or opens_at is null or closes_at > opens_at)
);
create table public.quiz_questions (
  id uuid primary key default gen_random_uuid(), quiz_id uuid not null references public.quizzes(id) on delete cascade,
  position int not null check (position >= 0), type text not null check (type in ('mcq_single','mcq_multi','true_false','short_text')),
  prompt text not null, options jsonb, correct_answer jsonb not null, points numeric(5,2) not null default 1 check (points > 0),
  unique (quiz_id, position)
);
create table public.quiz_attempts (
  id uuid primary key default gen_random_uuid(), quiz_id uuid not null references public.quizzes(id) on delete cascade,
  student_id uuid not null references public.profiles(id) on delete cascade, started_at timestamptz not null default now(),
  submitted_at timestamptz, answers jsonb not null default '{}', score numeric(6,2), max_score numeric(6,2)
);
create table public.announcements (
  id uuid primary key default gen_random_uuid(), course_id uuid references public.courses(id) on delete cascade,
  author_id uuid not null references public.profiles(id), title text not null, body text not null,
  is_pinned boolean not null default false, created_at timestamptz not null default now()
);
create table public.announcement_reads (
  announcement_id uuid not null references public.announcements(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  read_at timestamptz not null default now(), primary key (announcement_id, user_id)
);
create table public.grade_items (
  id uuid primary key default gen_random_uuid(), course_id uuid not null references public.courses(id) on delete cascade,
  title text not null, max_points numeric(6,2) not null check (max_points > 0),
  weight numeric(5,2) not null default 0 check (weight >= 0), created_at timestamptz not null default now()
);
create table public.manual_grades (
  id uuid primary key default gen_random_uuid(), grade_item_id uuid not null references public.grade_items(id) on delete cascade,
  student_id uuid not null references public.profiles(id) on delete cascade,
  points numeric(6,2) check (points is null or points >= 0), feedback text, unique (grade_item_id, student_id)
);
create table public.chat_messages (
  id uuid primary key default gen_random_uuid(), course_id uuid not null references public.courses(id) on delete cascade,
  sender_id uuid not null references public.profiles(id), body text not null check (char_length(body) between 1 and 2000),
  is_deleted boolean not null default false, created_at timestamptz not null default now()
);
create table public.complaints (
  id uuid primary key default gen_random_uuid(), submitted_by uuid not null references public.profiles(id),
  course_id uuid references public.courses(id), category text not null check (category in ('academic','technical','teacher','student','other')),
  subject text not null, description text not null, attachment_path text,
  status public.complaint_status not null default 'open', admin_response text,
  resolved_by uuid references public.profiles(id), resolved_at timestamptz, created_at timestamptz not null default now(),
  check (status not in ('resolved','rejected') or nullif(trim(admin_response), '') is not null)
);

create index enrollments_student_id_idx on public.enrollments(student_id);
create index enrollments_course_id_idx on public.enrollments(course_id);
create index courses_teacher_id_idx on public.courses(teacher_id);
create index resources_course_id_idx on public.resources(course_id);
create index assignments_course_id_idx on public.assignments(course_id);
create index submissions_assignment_id_idx on public.submissions(assignment_id);
create index submissions_student_id_idx on public.submissions(student_id);
create index quizzes_course_id_idx on public.quizzes(course_id);
create index quiz_questions_quiz_id_idx on public.quiz_questions(quiz_id);
create index quiz_attempts_quiz_student_idx on public.quiz_attempts(quiz_id, student_id);
create index announcements_course_id_idx on public.announcements(course_id);
create index grade_items_course_id_idx on public.grade_items(course_id);
create index manual_grades_student_id_idx on public.manual_grades(student_id);
create index chat_messages_course_created_idx on public.chat_messages(course_id, created_at desc);
create index complaints_submitter_created_idx on public.complaints(submitted_by, created_at desc);

create or replace function public.is_admin() returns boolean language sql stable security definer set search_path = public
as $$ select exists (select 1 from public.profiles where id = auth.uid() and role = 'admin' and is_active) $$;
create or replace function public.is_course_teacher(target_course_id uuid) returns boolean language sql stable security definer set search_path = public
as $$ select exists (select 1 from public.courses where id = target_course_id and teacher_id = auth.uid()) $$;
create or replace function public.is_enrolled(target_course_id uuid) returns boolean language sql stable security definer set search_path = public
as $$ select exists (select 1 from public.enrollments where course_id = target_course_id and student_id = auth.uid()) $$;

create or replace function public.create_profile_for_new_user() returns trigger language plpgsql security definer set search_path = public
as $$ begin
  insert into public.profiles (id, full_name, email)
  values (new.id, coalesce(new.raw_user_meta_data->>'full_name', split_part(new.email, '@', 1)), new.email);
  return new;
end $$;
create trigger on_auth_user_created after insert on auth.users for each row execute procedure public.create_profile_for_new_user();

create or replace function public.get_visible_courses(viewer_id uuid, viewer_role public.user_role)
returns setof public.courses language sql stable security invoker set search_path = public
as $$
  select c.* from public.courses c
  where (viewer_role = 'admin' and public.is_admin())
     or (viewer_role = 'teacher' and c.teacher_id = auth.uid() and viewer_id = auth.uid())
     or (viewer_role = 'student' and viewer_id = auth.uid() and public.is_enrolled(c.id))
  order by c.created_at desc
$$;

alter table public.profiles enable row level security;
alter table public.courses enable row level security;
alter table public.enrollments enable row level security;
alter table public.resources enable row level security;
alter table public.resource_views enable row level security;
alter table public.assignments enable row level security;
alter table public.submissions enable row level security;
alter table public.quizzes enable row level security;
alter table public.quiz_questions enable row level security;
alter table public.quiz_attempts enable row level security;
alter table public.announcements enable row level security;
alter table public.announcement_reads enable row level security;
alter table public.grade_items enable row level security;
alter table public.manual_grades enable row level security;
alter table public.chat_messages enable row level security;
alter table public.complaints enable row level security;

create policy profiles_select on public.profiles for select using (
  id = auth.uid() or public.is_admin() or (role = 'student' and exists (
    select 1 from public.enrollments e join public.courses c on c.id = e.course_id
    where e.student_id = profiles.id and c.teacher_id = auth.uid()
  ))
);
create policy profiles_admin_all on public.profiles for all using (public.is_admin()) with check (public.is_admin());
create policy courses_select on public.courses for select using (public.is_admin() or teacher_id = auth.uid() or public.is_enrolled(id));
create policy courses_teacher_update on public.courses for update using (teacher_id = auth.uid()) with check (teacher_id = auth.uid());
create policy courses_admin_all on public.courses for all using (public.is_admin()) with check (public.is_admin());
create policy enrollments_select on public.enrollments for select using (public.is_admin() or student_id = auth.uid() or public.is_course_teacher(course_id));
create policy enrollments_admin_write on public.enrollments for all using (public.is_admin()) with check (public.is_admin());
create policy resources_select on public.resources for select using (public.is_admin() or public.is_course_teacher(course_id) or public.is_enrolled(course_id));
create policy resources_teacher_write on public.resources for all using (public.is_admin() or public.is_course_teacher(course_id)) with check (public.is_admin() or public.is_course_teacher(course_id));
create policy resource_views_select on public.resource_views for select using (student_id = auth.uid() or public.is_admin() or exists (select 1 from public.resources r where r.id = resource_id and public.is_course_teacher(r.course_id)));
create policy resource_views_insert on public.resource_views for insert with check (student_id = auth.uid() and exists (select 1 from public.resources r where r.id = resource_id and public.is_enrolled(r.course_id)));
create policy assignments_select on public.assignments for select using (public.is_admin() or public.is_course_teacher(course_id) or public.is_enrolled(course_id));
create policy assignments_teacher_write on public.assignments for all using (public.is_admin() or public.is_course_teacher(course_id)) with check (public.is_admin() or public.is_course_teacher(course_id));
create policy submissions_select on public.submissions for select using (student_id = auth.uid() or public.is_admin() or exists (select 1 from public.assignments a where a.id = assignment_id and public.is_course_teacher(a.course_id)));
create policy submissions_student_insert on public.submissions for insert with check (student_id = auth.uid() and exists (select 1 from public.assignments a where a.id = assignment_id and public.is_enrolled(a.course_id)));
create policy submissions_student_update on public.submissions for update using (student_id = auth.uid() and graded_at is null) with check (student_id = auth.uid() and graded_at is null);
create policy submissions_teacher_grade on public.submissions for update using (public.is_admin() or exists (select 1 from public.assignments a where a.id = assignment_id and public.is_course_teacher(a.course_id))) with check (public.is_admin() or exists (select 1 from public.assignments a where a.id = assignment_id and public.is_course_teacher(a.course_id)));
create policy quizzes_select on public.quizzes for select using (public.is_admin() or public.is_course_teacher(course_id) or (public.is_enrolled(course_id) and is_published));
create policy quizzes_teacher_write on public.quizzes for all using (public.is_admin() or public.is_course_teacher(course_id)) with check (public.is_admin() or public.is_course_teacher(course_id));
create policy quiz_questions_teacher_access on public.quiz_questions for all using (exists (select 1 from public.quizzes q where q.id = quiz_id and (public.is_admin() or public.is_course_teacher(q.course_id)))) with check (exists (select 1 from public.quizzes q where q.id = quiz_id and (public.is_admin() or public.is_course_teacher(q.course_id))));
create policy quiz_attempts_select on public.quiz_attempts for select using (student_id = auth.uid() or public.is_admin() or exists (select 1 from public.quizzes q where q.id = quiz_id and public.is_course_teacher(q.course_id)));
create policy quiz_attempts_student_write on public.quiz_attempts for insert with check (student_id = auth.uid() and exists (select 1 from public.quizzes q where q.id = quiz_id and q.is_published and public.is_enrolled(q.course_id)));
create policy quiz_attempts_student_update on public.quiz_attempts for update using (student_id = auth.uid()) with check (student_id = auth.uid());
create policy announcements_select on public.announcements for select using (public.is_admin() or (course_id is null) or public.is_course_teacher(course_id) or public.is_enrolled(course_id));
create policy announcements_write on public.announcements for all using (public.is_admin() or author_id = auth.uid()) with check (public.is_admin() or (author_id = auth.uid() and course_id is not null and public.is_course_teacher(course_id)));
create policy announcement_reads_self on public.announcement_reads for all using (user_id = auth.uid() or public.is_admin()) with check (user_id = auth.uid() or public.is_admin());
create policy grade_items_select on public.grade_items for select using (public.is_admin() or public.is_course_teacher(course_id) or public.is_enrolled(course_id));
create policy grade_items_teacher_write on public.grade_items for all using (public.is_admin() or public.is_course_teacher(course_id)) with check (public.is_admin() or public.is_course_teacher(course_id));
create policy manual_grades_select on public.manual_grades for select using (student_id = auth.uid() or public.is_admin() or exists (select 1 from public.grade_items g where g.id = grade_item_id and public.is_course_teacher(g.course_id)));
create policy manual_grades_teacher_write on public.manual_grades for all using (public.is_admin() or exists (select 1 from public.grade_items g where g.id = grade_item_id and public.is_course_teacher(g.course_id))) with check (public.is_admin() or exists (select 1 from public.grade_items g where g.id = grade_item_id and public.is_course_teacher(g.course_id)));
create policy chat_messages_read on public.chat_messages for select using (public.is_admin() or public.is_course_teacher(course_id) or public.is_enrolled(course_id));
create policy chat_messages_insert on public.chat_messages for insert with check (sender_id = auth.uid() and (public.is_course_teacher(course_id) or public.is_enrolled(course_id)));
create policy chat_messages_delete on public.chat_messages for update using (sender_id = auth.uid() or public.is_admin() or public.is_course_teacher(course_id)) with check (sender_id = auth.uid() or public.is_admin() or public.is_course_teacher(course_id));
create policy complaints_select on public.complaints for select using (submitted_by = auth.uid() or public.is_admin());
create policy complaints_insert on public.complaints for insert with check (submitted_by = auth.uid());
create policy complaints_admin_update on public.complaints for update using (public.is_admin()) with check (public.is_admin());

insert into storage.buckets (id, name, public, file_size_limit) values
  ('resources','resources',false,104857600), ('assignment-files','assignment-files',false,26214400),
  ('submissions','submissions',false,26214400), ('complaint-attachments','complaint-attachments',false,5242880),
  ('avatars','avatars',false,5242880)
on conflict (id) do update set public = false;
