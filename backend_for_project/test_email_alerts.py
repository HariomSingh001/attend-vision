"""
Quick test script for attendance email alerts
Run this to test the email alert system
"""

import requests
import json
from datetime import datetime

BACKEND_URL = "http://localhost:8000"

def print_section(title):
    print("\n" + "="*60)
    print(f"  {title}")
    print("="*60)

def test_check_alerts():
    """Test the attendance alert check endpoint"""
    print_section("Testing Attendance Alert Check")
    
    try:
        response = requests.post(f"{BACKEND_URL}/attendance/check-alerts")
        data = response.json()
        
        print(f"\n✅ Status: {data.get('status')}")
        print(f"📊 Students Checked: {data.get('students_checked', 0)}")
        print(f"📧 Alerts Sent: {data.get('alerts_sent', 0)}")
        print(f"🎯 Threshold: {data.get('threshold', 75.0)}%")
        
        if data.get('low_attendance_students'):
            print(f"\n⚠️ Students with Low Attendance:")
            for student in data['low_attendance_students']:
                name = student.get('name', 'Unknown')
                pct = student.get('attendance_percentage', 0)
                print(f"   • {name}: {pct}%")
        else:
            print("\n✅ All students have good attendance!")
        
        return True
        
    except requests.exceptions.ConnectionError:
        print("\n❌ Error: Cannot connect to backend")
        print("   Make sure the backend is running: uvicorn main:app --reload")
        return False
    except Exception as e:
        print(f"\n❌ Error: {e}")
        return False

def test_get_alerts():
    """Test getting alert history"""
    print_section("Testing Alert History")
    
    try:
        response = requests.get(f"{BACKEND_URL}/attendance/alerts?days=30")
        data = response.json()
        
        print(f"\n✅ Status: {data.get('status')}")
        print(f"📋 Total Alerts (last 30 days): {data.get('total', 0)}")
        
        if data.get('alerts'):
            print(f"\nRecent Alerts:")
            for alert in data['alerts'][:5]:  # Show first 5
                name = alert.get('student_name', 'Unknown')
                email = alert.get('student_email', 'No email')
                pct = alert.get('attendance_percentage', 0)
                date = alert.get('alert_date', 'Unknown')
                print(f"   • {date}: {name} ({email}) - {pct}%")
        else:
            print("\n✅ No alerts found")
        
        return True
        
    except Exception as e:
        print(f"\n❌ Error: {e}")
        return False

def test_student_summary(student_id=None):
    """Test getting student attendance summary"""
    print_section("Testing Student Summary")
    
    if not student_id:
        print("\n⚠️ No student_id provided, skipping this test")
        print("   Usage: Provide student_id as argument")
        return False
    
    try:
        response = requests.get(f"{BACKEND_URL}/students/{student_id}/attendance-summary")
        data = response.json()
        
        if data.get('status') == 'error':
            print(f"\n❌ Error: {data.get('message')}")
            return False
        
        student = data.get('student', {})
        attendance = data.get('attendance', {})
        
        print(f"\n👤 Student: {student.get('name', 'Unknown')}")
        print(f"📧 Email: {student.get('email', 'No email')}")
        print(f"\n📊 Attendance Statistics:")
        print(f"   • Percentage: {attendance.get('percentage', 0)}%")
        print(f"   • Total Classes: {attendance.get('total_classes', 0)}")
        print(f"   • Present: {attendance.get('present', 0)}")
        print(f"   • Absent: {attendance.get('absent', 0)}")
        print(f"   • Below Threshold: {'Yes ⚠️' if attendance.get('is_below_threshold') else 'No ✅'}")
        
        recent_alerts = data.get('recent_alerts', [])
        if recent_alerts:
            print(f"\n📧 Recent Alerts:")
            for alert in recent_alerts[:3]:
                date = alert.get('alert_date', 'Unknown')
                pct = alert.get('attendance_percentage', 0)
                print(f"   • {date}: {pct}%")
        
        return True
        
    except Exception as e:
        print(f"\n❌ Error: {e}")
        return False

def main():
    print("\n" + "🔔 ATTENDANCE EMAIL ALERT SYSTEM - TEST SCRIPT 🔔".center(60))
    print(f"Backend URL: {BACKEND_URL}")
    print(f"Time: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
    
    # Test 1: Check alerts
    success1 = test_check_alerts()
    
    # Test 2: Get alert history
    if success1:
        test_get_alerts()
    
    # Test 3: Student summary (optional)
    # Uncomment and add student_id to test:
    # test_student_summary("your-student-uuid-here")
    
    print_section("Test Complete")
    print("\n📝 Next Steps:")
    print("   1. Check your email inbox for alert emails")
    print("   2. Check backend console logs for detailed output")
    print("   3. Set up scheduled job for daily checks")
    print("\n📚 See ATTENDANCE_ALERTS_GUIDE.md for full documentation\n")

if __name__ == "__main__":
    main()
