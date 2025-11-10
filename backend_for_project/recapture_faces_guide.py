"""
Face Recapture Guide Script
This script helps you recapture faces for all students with the improved preprocessing
"""

import requests
from supabase_client import supabase

BACKEND_URL = "http://localhost:8000"

def get_all_students():
    """Get all students from database"""
    try:
        response = supabase.table("students").select("id, name, student_roll_number, email").execute()
        return response.data or []
    except Exception as e:
        print(f"Error fetching students: {e}")
        return []

def delete_old_faces(student_id):
    """Delete old face data for a student"""
    try:
        supabase.table("faces").delete().eq("student_id", student_id).execute()
        print(f"✅ Deleted old face data for student {student_id}")
        return True
    except Exception as e:
        print(f"❌ Error deleting faces for {student_id}: {e}")
        return False

def main():
    print("=" * 60)
    print("FACE RECAPTURE GUIDE")
    print("=" * 60)
    print()
    
    students = get_all_students()
    
    if not students:
        print("❌ No students found in database!")
        return
    
    print(f"Found {len(students)} students in database:")
    print()
    
    for i, student in enumerate(students, 1):
        name = student.get("name", "Unknown")
        roll = student.get("student_roll_number", "N/A")
        email = student.get("email", "N/A")
        student_id = student.get("id")
        
        print(f"{i}. {name} (Roll: {roll})")
        print(f"   Email: {email}")
        print(f"   ID: {student_id}")
        print()
    
    print("=" * 60)
    print("RECAPTURE INSTRUCTIONS")
    print("=" * 60)
    print()
    print("⚠️  IMPORTANT: You must recapture faces for ALL students!")
    print()
    print("Why? The new system uses improved preprocessing that's")
    print("incompatible with old training data.")
    print()
    print("=" * 60)
    print("OPTION 1: Manual Recapture (Recommended)")
    print("=" * 60)
    print()
    print("For each student above:")
    print("1. Open: http://localhost:9002/dashboard/students")
    print("2. Click 'Edit' on the student")
    print("3. Click 'Capture Faces' button")
    print("4. Follow on-screen instructions")
    print("5. Ensure good lighting and face camera directly")
    print("6. Wait for 100 samples to be captured")
    print()
    print("=" * 60)
    print("OPTION 2: API Recapture")
    print("=" * 60)
    print()
    print("Use curl or Postman to call:")
    print()
    for student in students:
        name = student.get("name", "Unknown")
        roll = student.get("student_roll_number", "N/A")
        email = student.get("email", "")
        
        print(f'curl -X POST "{BACKEND_URL}/capture_faces" \\')
        print(f'  -F "roll_number={roll}" \\')
        print(f'  -F "name={name}" \\')
        if email:
            print(f'  -F "email={email}"')
        print()
    
    print("=" * 60)
    print("OPTION 3: Delete Old Data (Clean Start)")
    print("=" * 60)
    print()
    
    choice = input("Do you want to delete ALL old face data? (yes/no): ").strip().lower()
    
    if choice == "yes":
        print()
        print("Deleting old face data...")
        print()
        
        success_count = 0
        for student in students:
            student_id = student.get("id")
            name = student.get("name", "Unknown")
            
            if delete_old_faces(student_id):
                success_count += 1
                print(f"✅ Cleared: {name}")
            else:
                print(f"❌ Failed: {name}")
        
        print()
        print(f"Deleted face data for {success_count}/{len(students)} students")
        print()
        print("⚠️  Now you MUST recapture faces for all students!")
        print("   Use Option 1 or Option 2 above.")
    else:
        print()
        print("Skipped deletion. Old face data remains.")
        print("⚠️  For best results, still recapture all faces!")
    
    print()
    print("=" * 60)
    print("QUALITY TIPS")
    print("=" * 60)
    print()
    print("✅ Good lighting (even, natural)")
    print("✅ Face camera directly (no extreme angles)")
    print("✅ 1-2 feet from camera")
    print("✅ Remove glasses if possible")
    print("✅ Neutral expression")
    print("✅ Stay still during capture")
    print("✅ Ensure camera is in focus")
    print()
    print("=" * 60)
    print("VERIFICATION")
    print("=" * 60)
    print()
    print("After recapturing, test recognition:")
    print("1. Go to: http://localhost:9002/dashboard/live-attendance")
    print("2. Select a subject")
    print("3. Start recognition")
    print("4. Check backend logs for:")
    print("   ✅ ALL STAGES PASSED: confidence=0.92, margin=0.35")
    print()
    print("If you see '❌ Stage X FAIL', recapture that student's faces.")
    print()
    print("=" * 60)
    print("Done! Follow the instructions above to recapture faces.")
    print("=" * 60)

if __name__ == "__main__":
    main()
