# Environment Setup Guide

## Backend Environment Variables

Create a `.env` file in the `backend_for_project` directory with the following variables:

```env
# Supabase Configuration
SUPABASE_URL=your_supabase_url_here
SUPABASE_SERVICE_KEY=your_supabase_service_key_here

# Email Configuration (for notifications)
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your_email@gmail.com
SMTP_PASS=your_app_password_here
```

## Frontend Environment Variables

Create a `.env.local` file in the `forntend_for_project` directory with the following variables:

```env
# Supabase Configuration
NEXT_PUBLIC_SUPABASE_URL=your_supabase_url_here
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key_here

# Backend API URL
NEXT_PUBLIC_BACKEND_URL=http://localhost:8000
```

## How to Get Supabase Credentials

1. Go to [supabase.com](https://supabase.com)
2. Create a new project or select existing project
3. Go to Settings > API
4. Copy the following:
   - Project URL (for SUPABASE_URL)
   - service_role key (for SUPABASE_SERVICE_KEY)
   - anon key (for NEXT_PUBLIC_SUPABASE_ANON_KEY)

## Database Schema

Make sure your Supabase database has the following tables:

### users table
- id (uuid, primary key)
- full_name (text)
- email (text)
- role (text)

### students table
- id (uuid, primary key, references users.id)
- name (text)
- roll_number (text)

### faces table
- id (uuid, primary key)
- student_id (uuid, references students.id)
- vector (jsonb) - stores face embeddings

### attendance table
- id (uuid, primary key)
- student_id (uuid, references students.id)
- date (date)
- status (text) - 'present', 'absent', 'late'

### attendance_alerts table
- id (uuid, primary key)
- student_id (uuid, references students.id)
- alert_date (date)
