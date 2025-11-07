# AttendVision Database Schema Reference

_Last updated: 2025-11-07_

This document captures the current working knowledge of the Supabase (PostgreSQL) schema that powers the AttendVision platform. It is based on the tables referenced throughout the FastAPI backend and supporting scripts. Use it as a living reference and update it whenever the schema changes.

> **Important:** Several tables share the same UUID (`id`) across records (for example, a student is stored in both `users` and `students` with the same UUID). Observe those relationships carefully when writing queries or migrations.

---

## High-Level Entity Relationships

```
users (id) ─┬─< students (id)
            └─< teachers (id)

students (id) ─┬─< faces (student_id)
               ├─< attendance (student_id)
               └─< attendance_alerts (student_id)

subjects (id) ─┬─< attendance (subject_id)
               └─< teachers_subjects (planned)
```

- `users` is the canonical identity table (name, email, phone, role).
- `students` and `teachers` extend `users` with role-specific fields and reuse the same UUID primary key.
- `faces` stores facial embeddings linked back to `students`.
- `attendance` records individual attendance events, optionally tied to a subject.
- `attendance_alerts` tracks low-attendance email notifications (one per student per day per alert type).
- `subjects` stores course/class metadata and is referenced by attendance.
- `profile-pictures` is a Supabase Storage bucket used for avatar assets (not a SQL table).
- `spoof_alerts` (optional) can log failed liveness checks if `SPOOF_ALERT_TABLE` is configured; otherwise these records fall back to `attendance_alerts`.

---

## Table-by-Table Details

### 1. `users`
| Column | Type | Notes |
| --- | --- | --- |
| `id` | `uuid` PK | Primary key; reused as FK in `students` and `teachers` |
| `full_name` | `text` | Display name used across the app |
| `email` | `text` UNIQUE | Required for authentication and mailing |
| `phone` | `text` | Optional contact number |
| `role` | `text` | Examples: `student`, `teacher`, `admin` |
| `created_at` | `timestamp` (default now) | Auto-managed by Supabase |

**Usage Highlights**
- New students/teachers start with a `users` row before inserting into their role table.
- When updating students/teachers, the backend first updates `users` (name, email, phone, role).

---

### 2. `students`
| Column | Type | Notes |
| --- | --- | --- |
| `id` | `uuid` PK / FK → `users.id` | One-to-one with `users`
| `name` | `text` | Preferred display name (falls back to `users.full_name`)
| `email` | `text` | Usually mirrors `users.email`
| `student_roll_number` | `text` | Primary roll number (new column)
| `roll_number` | `text` | Legacy roll number field; kept for compatibility
| `student_code` | `text` | Optional legacy column (set to `NULL` on create)
| `address` | `text` | Optional mailing address
| `status` | `text` | Defaults to `active`; used for blocklist toggles
| `avatar_url` | `text` | Public URL in Supabase Storage
| `created_at` | `timestamp` | Auto-managed

**Usage Highlights**
- `get_or_create_student_id()` checks both `roll_number` and `student_roll_number`.
- Students are the primary linkage for attendance, faces, and alerts.
- When uploading avatars, the file goes to the `profile-pictures` storage bucket and `avatar_url` is updated.

---

### 3. `teachers`
| Column | Type | Notes |
| --- | --- | --- |
| `id` | `uuid` PK / FK → `users.id` | One-to-one with `users`
| `teacher_code` | `text` | Teacher identifier shown in UI
| `department` | `text` | Tracks subject/department association
| `avatar_url` | `text` | Optional avatar (same storage bucket as students)
| `created_at` | `timestamp` | Auto-managed

**Usage Highlights**
- Creation flow mirrors students: create in `users`, then insert into `teachers` with the same UUID.
- The frontend expects `teacher_code`, `email`, `phone`, `subject`, `avatar`, `status`.

---

### 4. `faces`
| Column | Type | Notes |
| --- | --- | --- |
| `id` | `uuid` PK | Auto-generated (optional if using Supabase defaults)
| `student_id` | `uuid` FK → `students.id` | Embedding owner
| `vector` | `jsonb` | Legacy flattened 50×50 pixel vector (list of floats)
| `embedding` | `jsonb` | Newer name for the same payload (list of floats)
| `created_at` | `timestamp` | Auto-managed

**Usage Highlights**
- Historical code inserted into `vector`; newer helpers use `embedding`. Both columns exist in production. Maintain both until migration finishes.
- `load_training_data()` still selects `vector`, so keeping it populated ensures recognition continues to work.
- Each face capture session stores ~100 embeddings per student.

**Recommendation:** Migrate toward a single column name (prefer `embedding`) and update all queries once ready.

---

### 5. `attendance`
| Column | Type | Notes |
| --- | --- | --- |
| `id` | `uuid` PK | Auto-generated attendance record ID
| `student_id` | `uuid` FK → `students.id` | Required
| `date` | `date` | Attendance day; deduplicated per student/day
| `status` | `text` | Values: `present`, `absent`, `late`, `pending`
| `class_id` | `uuid` (nullable) | Future support for class sections
| `confidence` | `numeric` (nullable) | Recognition confidence score
| `subject_id` | `uuid` (nullable) FK → `subjects.id` | Populated when attendance is tied to a subject
| `subject_code` | `text` (nullable) | Convenience copy of subject code (legacy)
| `marked_at` | `timestamp` (nullable) | Custom timestamp (falls back to default if column missing)
| `liveness_score` | `numeric` (nullable) | Result of liveness detection
| `liveness_passed` | `boolean` (nullable) | Outcome of liveness check
| `created_at` | `timestamp` | Auto-managed

**Usage Highlights**
- Attendance is inserted both during real-time recognition (`/recognize_frame`) and manual scripts.
- Insert code includes fallbacks: if `subject_code` or `marked_at` columns are missing the row is retried without them.
- Attendance summaries and alert calculations rely on `status` values (present vs. absent).

---

### 6. `attendance_alerts`
| Column | Type | Notes |
| --- | --- | --- |
| `id` | `uuid` PK | Auto-generated alert record
| `student_id` | `uuid` FK → `students.id` | Alert recipient
| `alert_date` | `date` | Day the alert was triggered
| `alert_type` | `text` | Default: `low_attendance_email` (part of unique constraint)
| `attendance_percentage` | `numeric` (nullable) | Optional snapshot of attendance at send time
| `threshold` | `numeric` (nullable) | Optional threshold used when alert fired
| `created_at` | `timestamp` | Auto-managed

**Constraints**
- Unique constraint on `(student_id, alert_date, alert_type)` prevents duplicate alerts per day.

**Usage Highlights**
- Automatic and manual alerts both insert records with `alert_type = "low_attendance_email"`.
- The frontend surfaces alert history via `/attendance/alerts` endpoint (joining to student info).
- When students have no attendance records the alert system treats attendance as `0%` (configurable).

---

### 7. `subjects`
| Column | Type | Notes |
| --- | --- | --- |
| `id` | `uuid` PK | Auto-generated course ID
| `name` | `text` | Human readable name
| `code` | `text` | Short code (used in attendance rows)
| `description` | `text` (nullable) | Optional details
| `created_at` | `timestamp` | Auto-managed

**Usage Highlights**
- `/subjects` CRUD endpoints manage this table.
- `attendance.subject_id` links to subjects, allowing per-class dashboards.
- Some legacy data relies on `subject_code`; keep that column until full migration to `subject_id` completes.

---

### 8. `spoof_alerts` (optional)
| Column | Type | Notes |
| --- | --- | --- |
| `id` | `uuid` PK | Auto-generated
| `subject_id` | `uuid` (nullable) | Copied from recognition request
| `subject_code` | `text` (nullable) | Copied for backward compatibility
| `student_id` | `uuid` (nullable) | Student associated with spoof event, if known
| `student_name` | `text` (nullable) | Cached name for debugging
| `liveness_score` | `numeric` (nullable) | Score that triggered the spoof alert
| `reason` | `text` | Description of why attendance was blocked
| `created_at` | `timestamp` | ISO timestamp stored as text by the backend

**Usage Highlights**
- Controlled by `SPOOF_ALERT_TABLE` environment variable (defaults to `attendance_alerts`).
- Recommended to create a dedicated `spoof_alerts` table and set `SPOOF_ALERT_TABLE=spoof_alerts` to avoid mixing with attendance alerts.

**Suggested SQL**
```sql
CREATE TABLE spoof_alerts (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    subject_id UUID,
    subject_code TEXT,
    student_id UUID,
    student_name TEXT,
    liveness_score NUMERIC,
    reason TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);
```

---

### 9. Auxiliary / Legacy Tables

Although not actively used in the current codebase, earlier iterations referenced additional structures:

| Table | Notes |
| --- | --- |
| `teachers_subjects` | Planned join table to map teachers ↔ subjects. Not implemented yet. |
| `classes` / `class_schedules` | Mentioned in early documentation but no live references. |

Keep these in mind if you discover leftover tables in Supabase; remove or document them separately.

---

## Storage Buckets

- **`profile-pictures`** – Stores base64-uploaded avatars for students and teachers. Public URLs are written to `students.avatar_url` / `teachers.avatar_url`.
- **Face Data** – Currently stored directly in SQL (`faces.vector` / `faces.embedding`). If you migrate to file-based storage, document the new bucket here.

---

## Scripts & Endpoints Touching the Database

- `create_test_attendance.py` – Generates synthetic attendance for testing alert flows.
- `test_attendance_check.py` – Calls `/attendance/check-alerts` and inspects alert history.
- `test_email_alerts.py` – Smoke tests email endpoints.
- `/debug/full_database` – Returns sample rows for key tables (students, faces, attendance, users) to help inspect schema remotely.
- `/debug/table/{table_name}` – Generic inspector for any Supabase table.

Use these utilities when validating schema changes or debugging data issues.

---

## Recommended Next Steps

1. **Keep This Document Updated** – Every schema or column change should be mirrored here.
2. **Align Column Names in `faces`** – Standardize on either `vector` or `embedding` and update all queries accordingly.
3. **Add Database Migrations** – Consider using Supabase migration scripts or Alembic to track schema changes formally.
4. **Enable Row Level Security (RLS)** – If not already, configure RLS policies in Supabase to protect sensitive tables like `attendance` and `faces`.
5. **Monitor Constraints** – Ensure foreign keys (`students.id`, `teachers.id`) stay in sync with `users.id`. Supabase can enforce cascading deletes.

---

## Contact & Maintenance

- **Backend Owner:** _Update with responsible engineer_
- **Database Admin:** _Update with DBA contact_
- **Supabase Project:** `tpaqnhfcylumhixvavdh`

Please edit this file whenever new tables are added, columns change meaning, or constraints are updated.
