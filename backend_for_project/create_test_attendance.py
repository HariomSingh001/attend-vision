"""Create test attendance data with some low attendance students"""

from supabase_client import supabase
from datetime import date, timedelta
import random

print("="*60)
print("CREATING TEST ATTENDANCE DATA")
print("="*60)

# Get students without attendance
students_resp = supabase.table("students").select("id, name, email").execute()
students = students_resp.data or []

# Filter students with no attendance
students_no_attendance = []
for student in students:
    attendance_resp = supabase.table("attendance").select("id").eq("student_id", student["id"]).limit(1).execute()
    if not attendance_resp.data:
        students_no_attendance.append(student)

print(f"\nFound {len(students_no_attendance)} students without attendance records:")
for s in students_no_attendance:
    print(f"  - {s['name']} ({s['email']})")

if not students_no_attendance:
    print("\n✅ All students already have attendance records")
    print("   No test data needed")
    exit(0)

print(f"\n📝 Creating attendance records...")

# Create attendance for last 20 days
end_date = date.today()
start_date = end_date - timedelta(days=19)

attendance_records = []

for student in students_no_attendance[:3]:  # First 3 students
    student_id = student["id"]
    student_name = student["name"]
    
    # Randomly decide if this student should have low attendance
    is_low_attendance = random.choice([True, False])
    
    if is_low_attendance:
        # 60-70% attendance (low)
        attendance_rate = random.uniform(0.60, 0.70)
        print(f"\n⚠️  {student_name}: Creating LOW attendance (~{attendance_rate*100:.0f}%)")
    else:
        # 80-95% attendance (good)
        attendance_rate = random.uniform(0.80, 0.95)
        print(f"\n✅ {student_name}: Creating GOOD attendance (~{attendance_rate*100:.0f}%)")
    
    # Create records for last 20 days
    current_date = start_date
    present_count = 0
    absent_count = 0
    
    while current_date <= end_date:
        # Randomly mark present/absent based on attendance rate
        is_present = random.random() < attendance_rate
        
        record = {
            "student_id": student_id,
            "date": current_date.isoformat(),
            "status": "present" if is_present else "absent"
        }
        
        attendance_records.append(record)
        
        if is_present:
            present_count += 1
        else:
            absent_count += 1
        
        current_date += timedelta(days=1)
    
    actual_percentage = (present_count / (present_count + absent_count)) * 100
    print(f"   Created: {present_count} present, {absent_count} absent = {actual_percentage:.1f}%")

# Insert all records
if attendance_records:
    print(f"\n💾 Inserting {len(attendance_records)} attendance records...")
    supabase.table("attendance").insert(attendance_records).execute()
    print(f"✅ Done!")
    
    print(f"\n{'='*60}")
    print("Test data created successfully!")
    print(f"{'='*60}")
    print("\nNow you can test the alert system:")
    print("  1. Run: python test_attendance_check.py")
    print("  2. Or call: POST /attendance/check-alerts")
    print("  3. Check student emails for alerts")
else:
    print("\n⚠️  No records to insert")
