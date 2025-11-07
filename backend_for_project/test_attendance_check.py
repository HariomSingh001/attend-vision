"""Test attendance checking and email alerts"""

from db_utils import attendance_percentage, check_and_record_low_attendance
from supabase_client import supabase

print("="*60)
print("TESTING ATTENDANCE ALERT SYSTEM")
print("="*60)

# Get all students
students_resp = supabase.table("students").select("id, name, email").execute()
students = students_resp.data or []

print(f"\nFound {len(students)} students\n")

low_attendance_count = 0
for student in students:
    student_id = student.get("id")
    student_name = student.get("name", "Unknown")
    student_email = student.get("email", "No email")
    
    # Calculate attendance
    pct = attendance_percentage(student_id)
    
    if pct is None:
        print(f"❌ {student_name}: No attendance records")
    elif pct < 75.0:
        low_attendance_count += 1
        print(f"⚠️  {student_name}: {pct:.1f}% (BELOW 75%) - {student_email}")
        
        # Try to send alert
        print(f"   Attempting to send alert...")
        alert_sent, _ = check_and_record_low_attendance(
            student_id=student_id,
            threshold=75.0,
            send_email_alert=True
        )
        if alert_sent:
            print(f"   ✅ Alert sent successfully!")
        else:
            print(f"   ℹ️  Alert already sent today or not needed")
    else:
        print(f"✅ {student_name}: {pct:.1f}% (Good)")

print(f"\n{'='*60}")
print(f"Summary:")
print(f"  Total Students: {len(students)}")
print(f"  Low Attendance (<75%): {low_attendance_count}")
print(f"{'='*60}")

# Test with lower threshold to see more results
print(f"\n\nTesting with 90% threshold:")
print(f"{'='*60}")
for student in students[:5]:  # Test first 5
    student_id = student.get("id")
    student_name = student.get("name", "Unknown")
    pct = attendance_percentage(student_id)
    
    if pct is not None and pct < 90.0:
        print(f"⚠️  {student_name}: {pct:.1f}% (BELOW 90%)")
