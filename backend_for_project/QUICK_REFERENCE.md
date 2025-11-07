# Alert System - Quick Reference Card

## ✅ Everything Works Now!

### Manual Alert (Single Student)

**Frontend**: Students page → Actions (⋮) → Send Alert  
**API**: `POST /students/{student_id}/send-alert`  
**Works**: ✅ Even with no attendance records (uses 0%)

### Automatic Alert (All Students)

**Default** (skip no-records):  
```bash
POST /attendance/check-alerts
```

**Include no-records** (treat as 0%):  
```bash
POST /attendance/check-alerts?include_no_records=true
```

## Quick Test

```powershell
# Test manual alert
Invoke-WebRequest -Uri "http://localhost:8000/students/8282ee28-cbdd-44aa-8749-383724832602/send-alert" -Method POST

# Test automatic (with no-records)
Invoke-WebRequest -Uri "http://localhost:8000/attendance/check-alerts?include_no_records=true" -Method POST
```

## What Was Fixed

1. ✅ Frontend button now calls API (was just showing toast)
2. ✅ Manual alerts work with no attendance records (uses 0%)
3. ✅ Automatic alerts have optional flag for no-records
4. ✅ Database schema fixed (added alert_type)

## When to Use What

| Scenario | Use This |
|----------|----------|
| Test one student | Manual alert button |
| New semester (no data yet) | `include_no_records=true` |
| Ongoing semester | Default (no flag) |
| Daily scheduled check | Default or with flag |

## Status: ✅ PRODUCTION READY
