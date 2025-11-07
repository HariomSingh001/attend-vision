# Automatic Attendance Alert System - Complete Guide

## Overview
Automatically sends email alerts to students whose attendance falls below 75%.

## Features

### ✅ Automatic Email Alerts
- Beautiful HTML email templates
- Personalized with student name and attendance percentage
- Shows exact shortfall and required improvement
- Includes actionable steps for students

### ✅ Smart Alert Management
- Only sends one alert per student per day (no spam)
- Tracks all alerts in database
- Configurable threshold (default 75%)
- Detailed logging for monitoring

### ✅ Multiple Trigger Options
1. **Manual API Call** - Trigger checks on demand
2. **Scheduled Job** - Set up daily/weekly checks
3. **After Attendance Marking** - Real-time checks (optional)

## Setup

### 1. Configure Email Settings

Add these to your `.env` file:

```bash
# Email Configuration (Required)
SMTP_HOST=smtp.gmail.com          # Your SMTP server
SMTP_PORT=587                      # Usually 587 for TLS
SMTP_USER=your-email@gmail.com    # Your email address
SMTP_PASS=your-app-password       # App password (not regular password)
FROM_NAME=Attendance System        # Display name in emails

# Optional: Attendance threshold
ATTENDANCE_THRESHOLD=75.0          # Default is 75%
```

### 2. Gmail Setup (if using Gmail)

**Important**: Don't use your regular Gmail password!

1. Go to Google Account Settings
2. Enable 2-Factor Authentication
3. Generate an "App Password":
   - Go to Security → 2-Step Verification → App Passwords
   - Select "Mail" and "Other (Custom name)"
   - Copy the 16-character password
   - Use this as `SMTP_PASS`

### 3. Database Table

The `attendance_alerts` table should have these columns:
```sql
CREATE TABLE attendance_alerts (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    student_id UUID REFERENCES students(id),
    alert_date DATE NOT NULL,
    attendance_percentage DECIMAL,
    threshold DECIMAL DEFAULT 75.0,
    created_at TIMESTAMP DEFAULT NOW()
);
```

## Usage

### Option 1: Manual Check (Recommended for Testing)

**Endpoint**: `POST /attendance/check-alerts`

```bash
# Check all students with default 75% threshold
curl -X POST http://localhost:8000/attendance/check-alerts

# Check with custom threshold (e.g., 80%)
curl -X POST http://localhost:8000/attendance/check-alerts?threshold=80.0
```

**Response**:
```json
{
  "status": "success",
  "message": "Checked 50 students, sent 5 new alerts",
  "students_checked": 50,
  "alerts_sent": 5,
  "low_attendance_students": [
    {
      "student_id": "uuid-here",
      "name": "Hariom Singh",
      "attendance_percentage": 68.5
    }
  ],
  "threshold": 75.0
}
```

### Option 2: View Alert History

**Endpoint**: `GET /attendance/alerts`

```bash
# Get alerts from last 7 days (default)
curl http://localhost:8000/attendance/alerts

# Get alerts from last 30 days
curl http://localhost:8000/attendance/alerts?days=30
```

**Response**:
```json
{
  "status": "success",
  "alerts": [
    {
      "id": "alert-uuid",
      "student_id": "student-uuid",
      "student_name": "Hariom Singh",
      "student_email": "hariom@example.com",
      "alert_date": "2025-11-06",
      "attendance_percentage": 68.5,
      "threshold": 75.0
    }
  ],
  "total": 5,
  "days": 7
}
```

### Option 3: Student Attendance Summary

**Endpoint**: `GET /students/{student_id}/attendance-summary`

```bash
curl http://localhost:8000/students/{student_id}/attendance-summary
```

**Response**:
```json
{
  "status": "success",
  "student": {
    "id": "uuid",
    "name": "Hariom Singh",
    "email": "hariom@example.com"
  },
  "attendance": {
    "percentage": 68.5,
    "total_classes": 40,
    "present": 27,
    "absent": 13,
    "is_below_threshold": true,
    "threshold": 75.0
  },
  "recent_alerts": [
    {
      "alert_date": "2025-11-06",
      "attendance_percentage": 68.5
    }
  ],
  "recent_records": [...]
}
```

## Email Template Preview

Students receive a professional HTML email like this:

```
⚠️ Low Attendance Alert

Dear Hariom Singh,

ACTION REQUIRED
Your current attendance is 68.5%, which is below the required 75% threshold.

Attendance Summary
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Your Attendance:      68.5%
Required Minimum:     75.0%
Shortfall:            6.5%

What You Need to Do:
• Attend all upcoming classes regularly
• Contact your class coordinator if you have valid reasons
• Monitor your attendance through the student portal

Note: Maintaining minimum 75% attendance is mandatory.
```

## Automation Options

### Option A: Daily Scheduled Check (Recommended)

Use a cron job or task scheduler to run daily at 8 AM:

**Linux/Mac (crontab)**:
```bash
0 8 * * * curl -X POST http://localhost:8000/attendance/check-alerts
```

**Windows (Task Scheduler)**:
1. Open Task Scheduler
2. Create Basic Task
3. Trigger: Daily at 8:00 AM
4. Action: Start a program
5. Program: `curl`
6. Arguments: `-X POST http://localhost:8000/attendance/check-alerts`

### Option B: Python Scheduler (Advanced)

Create `scheduler.py`:
```python
import schedule
import time
import requests

def check_alerts():
    print("Running attendance check...")
    response = requests.post("http://localhost:8000/attendance/check-alerts")
    print(response.json())

# Run every day at 8:00 AM
schedule.every().day.at("08:00").do(check_alerts)

print("Scheduler started. Press Ctrl+C to stop.")
while True:
    schedule.run_pending()
    time.sleep(60)
```

Run it:
```bash
pip install schedule requests
python scheduler.py
```

### Option C: Real-time Check (After Each Attendance)

Modify the `recognize_frame` endpoint to check after marking attendance:

```python
# After marking attendance successfully
check_and_record_low_attendance(
    student_id=student_id,
    threshold=75.0,
    send_email_alert=True
)
```

**Note**: This sends emails immediately but may be too frequent.

## Testing

### 1. Test Email Configuration

```bash
# Manually trigger check
curl -X POST http://localhost:8000/attendance/check-alerts
```

Check console logs:
```
📊 Checking attendance for 50 students (threshold: 75.0%)
📧 Sending low attendance alert to Hariom Singh (hariom@example.com)
✅ Alert email sent successfully to Hariom Singh
⚠️ Alert sent to Hariom Singh (68.5%)
```

### 2. Verify Email Received

- Check student's inbox
- Look for "⚠️ Low Attendance Alert - Action Required"
- Verify HTML formatting looks good

### 3. Test Alert Deduplication

Run the same check twice in one day:
```bash
curl -X POST http://localhost:8000/attendance/check-alerts
# Wait a few seconds
curl -X POST http://localhost:8000/attendance/check-alerts
```

Second run should show:
```
ℹ️ Hariom Singh has low attendance (68.5%) but alert already sent today
```

## Monitoring

### Check Logs

The backend console shows detailed logs:

**Success**:
```
📊 Checking attendance for 50 students (threshold: 75.0%)
📧 Sending low attendance alert to Hariom Singh (hariom@example.com)
✅ Alert email sent successfully to Hariom Singh
⚠️ Alert sent to Hariom Singh (68.5%)
```

**Errors**:
```
❌ Email error for hariom@example.com: [Errno 111] Connection refused
⚠️ No email found for student Amit Singh
```

### View Alert History

```bash
# See all alerts from last 30 days
curl http://localhost:8000/attendance/alerts?days=30
```

## Troubleshooting

### Issue: "Email error: Authentication failed"
**Solution**:
- Verify `SMTP_USER` and `SMTP_PASS` in `.env`
- For Gmail, use App Password (not regular password)
- Enable "Less secure app access" if using regular SMTP

### Issue: "No email found for student"
**Solution**:
- Ensure students have email addresses in the `users` table
- Check `user_id` is correctly linked in `students` table

### Issue: "Connection refused"
**Solution**:
- Check `SMTP_HOST` and `SMTP_PORT` are correct
- Verify firewall allows outbound SMTP connections
- Try `telnet smtp.gmail.com 587` to test connectivity

### Issue: Emails going to spam
**Solution**:
- Add SPF/DKIM records to your domain
- Use a professional email service (SendGrid, Mailgun)
- Ask students to whitelist the sender email

### Issue: Too many emails sent
**Solution**:
- System already prevents duplicate alerts per day
- If still too many, increase threshold or check less frequently
- Review logs to see which students are getting alerts

## Best Practices

### 1. **Schedule Daily Checks**
Run once per day (e.g., 8 AM) to avoid spam

### 2. **Monitor Logs**
Check console logs regularly for email delivery issues

### 3. **Test Before Production**
Send test emails to yourself first

### 4. **Use Professional Email Service**
For production, consider:
- SendGrid (free tier: 100 emails/day)
- Mailgun (free tier: 5,000 emails/month)
- AWS SES (very cheap, reliable)

### 5. **Inform Students**
Let students know they'll receive automated alerts

### 6. **Backup Email List**
Keep a CSV of all low-attendance students as backup

## API Reference

### POST /attendance/check-alerts
Check all students and send alerts

**Parameters**:
- `threshold` (float, optional): Attendance percentage threshold (default: 75.0)

**Returns**:
- `students_checked`: Total students checked
- `alerts_sent`: New alerts sent today
- `low_attendance_students`: List of students below threshold

### GET /attendance/alerts
Get alert history

**Parameters**:
- `days` (int, optional): Number of days to look back (default: 7)

**Returns**:
- `alerts`: List of alerts with student details
- `total`: Total number of alerts

### GET /students/{student_id}/attendance-summary
Get detailed summary for one student

**Returns**:
- `student`: Student details
- `attendance`: Attendance statistics
- `recent_alerts`: Recent alerts sent
- `recent_records`: Recent attendance records

## Configuration Options

### Environment Variables

```bash
# Required
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your-email@gmail.com
SMTP_PASS=your-app-password

# Optional
FROM_NAME=Attendance System
ATTENDANCE_THRESHOLD=75.0
```

### Customize Email Template

Edit `email_utils.py` → `send_low_attendance_alert()` function to customize:
- Subject line
- Email body text
- HTML styling
- Additional information

## Support

For issues:
1. Check console logs for detailed error messages
2. Verify email configuration in `.env`
3. Test with manual API call first
4. Check student email addresses in database

---

**System is ready to use!** Just configure your email settings and call the API endpoint.
