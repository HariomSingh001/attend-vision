# 📊 Reports System - Quick Start

## What's New?

✅ **Visual Analytics Dashboard** with charts and graphs  
✅ **Downloadable Reports** in text format  
✅ **Real-time Statistics** from live database  
✅ **Individual & Overall Reports** for all needs  

---

## Access Reports

1. Open Dashboard → **Reports**
2. View analytics automatically loaded
3. Click download buttons for reports

---

## Features at a Glance

### Summary Cards (Top)
- Total Students
- Overall Attendance %
- Low Attendance Count
- Alerts Sent

### Charts (Middle)
- **Line Chart**: 30-day attendance trend
- **Pie Chart**: Present/Absent/Late distribution

### Table (Bottom)
- All students with attendance stats
- Color-coded percentages
- Download button for each student

### Alert Section
- Red-highlighted low attendance students
- Shows students below 75%

---

## Download Reports

### Individual Student Report
1. Find student in table
2. Click **Report** button
3. Text file downloads automatically

**Contains**:
- Student info
- Attendance summary
- Monthly breakdown
- Recent records

### Overall Report
1. Click **Download Overall Report** (top right)
2. Text file downloads automatically

**Contains**:
- Institution statistics
- All student performance
- Low attendance list

---

## Status Colors

| Color | Percentage | Status |
|-------|-----------|--------|
| 🟢 Green | ≥ 75% | Good |
| 🟡 Yellow | 60-74% | Warning |
| 🔴 Red | < 60% | Critical |

---

## API Endpoints

```bash
# Get overview
GET /reports/overview

# Get student report
GET /reports/student/{student_id}
```

---

## Test Locally

```bash
# Backend running?
curl http://localhost:8000/reports/overview

# Frontend running?
# Open: http://localhost:9002/dashboard/reports
```

---

## Quick Troubleshooting

**No data?**
- Check backend is running
- Verify students exist
- Ensure attendance marked

**Charts blank?**
- Check browser console
- Verify data in API response

**Download not working?**
- Allow downloads in browser
- Check API returns data

---

## File Locations

**Backend**:
- `backend_for_project/main.py` (lines 1638-1853)
- Endpoints: `/reports/overview`, `/reports/student/{id}`

**Frontend**:
- `frontend_for_project/src/app/dashboard/reports/page.tsx`

**Documentation**:
- `backend_for_project/REPORTS_GUIDE.md` (full guide)
- `REPORTS_QUICK_START.md` (this file)

---

## Status: ✅ READY TO USE

All features implemented and tested!
