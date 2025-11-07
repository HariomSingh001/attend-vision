# Frontend Integration - Manual Alert Button

## Add Manual Alert Button to Student Page

### Option 1: Simple Alert Button

Add this to your student details page:

```typescript
// In your student page component
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Mail, AlertTriangle } from "lucide-react";

const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL || "http://127.0.0.1:8000";

export function SendAlertButton({ studentId, studentName }: { studentId: string, studentName: string }) {
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");

  const sendAlert = async () => {
    if (!confirm(`Send low attendance alert to ${studentName}?`)) {
      return;
    }

    setLoading(true);
    setMessage("");

    try {
      const response = await fetch(
        `${BACKEND_URL}/students/${studentId}/send-alert`,
        { method: 'POST' }
      );
      
      const data = await response.json();
      
      if (data.status === 'success') {
        setMessage(`✅ Alert sent to ${data.student_name} (${data.student_email})`);
      } else {
        setMessage(`❌ Error: ${data.message}`);
      }
    } catch (error) {
      setMessage(`❌ Failed to send alert: ${error}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div>
      <Button 
        onClick={sendAlert} 
        disabled={loading}
        variant="outline"
        className="gap-2"
      >
        <Mail className="h-4 w-4" />
        {loading ? "Sending..." : "Send Attendance Alert"}
      </Button>
      {message && (
        <p className="mt-2 text-sm">{message}</p>
      )}
    </div>
  );
}
```

### Option 2: Alert Button with Attendance Check

```typescript
import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Mail, AlertTriangle, CheckCircle } from "lucide-react";

const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL || "http://127.0.0.1:8000";

export function AttendanceAlertCard({ studentId }: { studentId: string }) {
  const [loading, setLoading] = useState(false);
  const [summary, setSummary] = useState<any>(null);
  const [alertMessage, setAlertMessage] = useState("");

  // Fetch attendance summary
  useEffect(() => {
    fetchSummary();
  }, [studentId]);

  const fetchSummary = async () => {
    try {
      const response = await fetch(
        `${BACKEND_URL}/students/${studentId}/attendance-summary`
      );
      const data = await response.json();
      if (data.status === 'success') {
        setSummary(data);
      }
    } catch (error) {
      console.error('Failed to fetch summary:', error);
    }
  };

  const sendAlert = async () => {
    if (!confirm('Send low attendance alert to this student?')) {
      return;
    }

    setLoading(true);
    setAlertMessage("");

    try {
      const response = await fetch(
        `${BACKEND_URL}/students/${studentId}/send-alert`,
        { method: 'POST' }
      );
      
      const data = await response.json();
      
      if (data.status === 'success') {
        setAlertMessage(`✅ Alert sent successfully to ${data.student_email}`);
        // Refresh summary to show new alert
        setTimeout(fetchSummary, 1000);
      } else {
        setAlertMessage(`❌ ${data.message}`);
      }
    } catch (error) {
      setAlertMessage(`❌ Failed to send alert`);
    } finally {
      setLoading(false);
    }
  };

  if (!summary) return <div>Loading...</div>;

  const { student, attendance } = summary;
  const isLowAttendance = attendance.is_below_threshold;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          {isLowAttendance ? (
            <AlertTriangle className="h-5 w-5 text-red-500" />
          ) : (
            <CheckCircle className="h-5 w-5 text-green-500" />
          )}
          Attendance Alert
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Attendance Stats */}
        <div className="grid grid-cols-2 gap-4">
          <div>
            <p className="text-sm text-muted-foreground">Attendance</p>
            <p className={`text-2xl font-bold ${
              isLowAttendance ? 'text-red-500' : 'text-green-500'
            }`}>
              {attendance.percentage}%
            </p>
          </div>
          <div>
            <p className="text-sm text-muted-foreground">Status</p>
            <p className={`text-lg font-semibold ${
              isLowAttendance ? 'text-red-500' : 'text-green-500'
            }`}>
              {isLowAttendance ? 'Below Threshold' : 'Good'}
            </p>
          </div>
        </div>

        {/* Alert Info */}
        {isLowAttendance && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-3">
            <p className="text-sm text-red-800">
              ⚠️ Attendance is below 75% threshold
            </p>
            <p className="text-xs text-red-600 mt-1">
              Shortfall: {(75 - attendance.percentage).toFixed(1)}%
            </p>
          </div>
        )}

        {/* Recent Alerts */}
        {summary.recent_alerts && summary.recent_alerts.length > 0 && (
          <div>
            <p className="text-sm font-medium mb-2">Recent Alerts Sent:</p>
            <ul className="text-xs space-y-1">
              {summary.recent_alerts.map((alert: any, idx: number) => (
                <li key={idx} className="text-muted-foreground">
                  📧 {alert.alert_date}
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* Send Alert Button */}
        <Button 
          onClick={sendAlert} 
          disabled={loading}
          variant={isLowAttendance ? "destructive" : "outline"}
          className="w-full gap-2"
        >
          <Mail className="h-4 w-4" />
          {loading ? "Sending..." : "Send Email Alert"}
        </Button>

        {/* Alert Message */}
        {alertMessage && (
          <p className="text-sm text-center">{alertMessage}</p>
        )}
      </CardContent>
    </Card>
  );
}
```

### Option 3: Bulk Alert Button (All Low Attendance Students)

```typescript
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Mail } from "lucide-react";

const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL || "http://127.0.0.1:8000";

export function BulkAlertButton() {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<any>(null);

  const sendBulkAlerts = async () => {
    if (!confirm('Send alerts to all students with low attendance?')) {
      return;
    }

    setLoading(true);
    setResult(null);

    try {
      const response = await fetch(
        `${BACKEND_URL}/attendance/check-alerts`,
        { method: 'POST' }
      );
      
      const data = await response.json();
      setResult(data);
    } catch (error) {
      setResult({ status: 'error', message: 'Failed to send alerts' });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-4">
      <Button 
        onClick={sendBulkAlerts} 
        disabled={loading}
        className="gap-2"
      >
        <Mail className="h-4 w-4" />
        {loading ? "Checking..." : "Send Alerts to All Low Attendance Students"}
      </Button>

      {result && (
        <div className={`p-4 rounded-lg ${
          result.status === 'success' ? 'bg-green-50 border-green-200' : 'bg-red-50 border-red-200'
        } border`}>
          <p className="font-medium">
            {result.status === 'success' ? '✅ Success' : '❌ Error'}
          </p>
          <p className="text-sm mt-1">{result.message}</p>
          
          {result.status === 'success' && (
            <div className="mt-3 text-sm space-y-1">
              <p>Students Checked: {result.students_checked}</p>
              <p>Alerts Sent: {result.alerts_sent}</p>
              
              {result.low_attendance_students && result.low_attendance_students.length > 0 && (
                <div className="mt-2">
                  <p className="font-medium">Students Alerted:</p>
                  <ul className="list-disc list-inside">
                    {result.low_attendance_students.map((s: any) => (
                      <li key={s.student_id}>
                        {s.name} - {s.attendance_percentage}%
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
```

## Usage in Your Pages

### In Student Details Page

```tsx
// src/app/dashboard/students/[id]/page.tsx
import { AttendanceAlertCard } from "@/components/attendance-alert-card";

export default function StudentDetailsPage({ params }: { params: { id: string } }) {
  return (
    <div className="space-y-6">
      {/* Other student details */}
      
      {/* Add Alert Card */}
      <AttendanceAlertCard studentId={params.id} />
    </div>
  );
}
```

### In Students List Page

```tsx
// src/app/dashboard/students/page.tsx
import { BulkAlertButton } from "@/components/bulk-alert-button";

export default function StudentsPage() {
  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h1>Students</h1>
        <BulkAlertButton />
      </div>
      
      {/* Students table/list */}
    </div>
  );
}
```

### Quick Action in Student Row

```tsx
// In your student table row
<Button
  size="sm"
  variant="ghost"
  onClick={() => sendAlert(student.id, student.name)}
>
  <Mail className="h-4 w-4" />
</Button>
```

## API Endpoints Used

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/students/{id}/send-alert` | POST | Send alert to one student |
| `/students/{id}/attendance-summary` | GET | Get attendance details |
| `/attendance/check-alerts` | POST | Send alerts to all low attendance students |
| `/attendance/alerts` | GET | View alert history |

## Testing

1. **Test Manual Alert**:
   - Click "Send Alert" button on student page
   - Check console logs
   - Verify email received

2. **Test Bulk Alerts**:
   - Click "Send Alerts to All" button
   - Check result summary
   - Verify emails sent to low attendance students

3. **Test Attendance Display**:
   - View student details
   - Check attendance percentage
   - Verify low attendance warning shows

## Styling

All components use shadcn/ui components:
- `Button` - For actions
- `Card` - For containers
- `lucide-react` icons - For visual indicators

Colors:
- Red (`text-red-500`) - Low attendance
- Green (`text-green-500`) - Good attendance
- Muted - Secondary info

## Error Handling

All components include:
- ✅ Loading states
- ✅ Error messages
- ✅ Success confirmations
- ✅ User confirmations before sending

## Summary

Choose the integration that fits your needs:

1. **Simple Button** - Quick integration, minimal code
2. **Alert Card** - Full featured, shows stats and history
3. **Bulk Button** - Admin feature, send to all at once

All options are production-ready and follow your existing UI design patterns!
