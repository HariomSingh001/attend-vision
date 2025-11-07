# Quick Start: Attendance Email Alerts

## ⚡ Fast Setup (5 Minutes)

### Step 1: Configure Email (2 min)

Edit your `.env` file and add:

```bash
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your-email@gmail.com
SMTP_PASS=your-app-password
FROM_NAME=Attendance System
```

**For Gmail**:
1. Go to https://myaccount.google.com/security
2. Enable 2-Factor Authentication
3. Go to App Passwords → Generate new
4. Copy the 16-character password
5. Use it as `SMTP_PASS`

### Step 2: Restart Backend (1 min)

```bash
cd h:\backup_of_project\backend_for_project
uvicorn main:app --reload
```

### Step 3: Test It (2 min)

**Option A: Using Python Script**
```bash
python test_email_alerts.py
```

**Option B: Using API Call**
```bash
curl -X POST http://localhost:8000/attendance/check-alerts
```

**Option C: Using Browser**
Open: http://localhost:8000/docs
Find: `POST /attendance/check-alerts`
Click: "Try it out" → "Execute"

### Step 4: Check Results

1. **Console logs** - See who got alerts:
   ```
   📊 Checking attendance for 50 students (threshold: 75.0%)
   📧 Sending low attendance alert to Hariom Singh
   ✅ Alert email sent successfully to Hariom Singh
   ⚠️ Alert sent to Hariom Singh (68.5%)
   ```

2. **Student's email** - Check inbox for alert email

3. **API response**:
   ```json
   {
     "status": "success",
     "students_checked": 50,
     "alerts_sent": 5,
     "low_attendance_students": [...]
   }
   ```

## 🎯 What It Does

### Automatically:
- ✅ Checks all students' attendance
- ✅ Identifies those below 75%
- ✅ Sends professional HTML email alerts
- ✅ Records alerts in database
- ✅ Prevents duplicate alerts (max 1 per day)

### Email Contains:
- Student's current attendance percentage
- Required minimum (75%)
- Exact shortfall
- Action steps to improve
- Professional formatting

## 📅 Schedule Daily Checks

### Windows (Task Scheduler)
1. Open Task Scheduler
2. Create Basic Task → "Check Attendance Alerts"
3. Trigger: Daily at 8:00 AM
4. Action: Start a program
   - Program: `curl`
   - Arguments: `-X POST http://localhost:8000/attendance/check-alerts`

### Linux/Mac (Crontab)
```bash
crontab -e
# Add this line:
0 8 * * * curl -X POST http://localhost:8000/attendance/check-alerts
```

### Python Scheduler
```bash
pip install schedule requests
python -c "
import schedule, requests, time
def check(): requests.post('http://localhost:8000/attendance/check-alerts')
schedule.every().day.at('08:00').do(check)
while True: schedule.run_pending(); time.sleep(60)
"
```

## 🔍 View Alert History

```bash
# Last 7 days
curl http://localhost:8000/attendance/alerts

# Last 30 days
curl http://localhost:8000/attendance/alerts?days=30
```

Or visit: http://localhost:8000/docs → `GET /attendance/alerts`

## 🎓 Check Specific Student

```bash
curl http://localhost:8000/students/{student_id}/attendance-summary
```

Shows:
- Current attendance percentage
- Total classes, present, absent
- Whether below threshold
- Recent alerts sent
- Recent attendance records

## 🛠️ Troubleshooting

### "Email error: Authentication failed"
→ Use Gmail App Password, not regular password

### "No email found for student"
→ Ensure students have email in `users` table

### "Connection refused"
→ Check SMTP settings, firewall, internet connection

### Emails going to spam
→ Ask students to whitelist sender email

## 📊 API Endpoints

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/attendance/check-alerts` | POST | Check all students & send alerts |
| `/attendance/alerts` | GET | View alert history |
| `/students/{id}/attendance-summary` | GET | Get student details |

## 📚 Full Documentation

See `ATTENDANCE_ALERTS_GUIDE.md` for:
- Detailed setup instructions
- Email template customization
- Advanced scheduling options
- Complete API reference
- Best practices

## ✅ You're Done!

The system is now ready. It will:
1. Check attendance when you call the API
2. Send emails to students below 75%
3. Track all alerts in database
4. Prevent spam (max 1 alert/day per student)

**Test it now**: `curl -X POST http://localhost:8000/attendance/check-alerts`
