alter table public.feedback_entries
  add column if not exists review_status text not null default 'pending',
  add column if not exists archetype_key text not null default '',
  add column if not exists reviewed_at timestamptz;

alter table public.feedback_entries
  drop constraint if exists feedback_entries_review_status_check;

alter table public.feedback_entries
  add constraint feedback_entries_review_status_check
  check (review_status in ('pending', 'approved', 'rejected'));

create index if not exists feedback_entries_review_status_created_at_idx
  on public.feedback_entries (review_status, created_at desc);
