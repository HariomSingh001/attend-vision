# db_utils.py
import numpy as np
from datetime import date
from supabase_client import supabase

# ---------- Students / Faces ----------
def find_user_by_email(email: str):
    """Return user row (dict) or None."""
    resp = supabase.table("users").select("*").eq("email", email).execute()
    return (resp.data or [None])[0]

def find_user_by_name(full_name: str):
    resp = supabase.table("users").select("*").ilike("full_name", full_name).limit(1).execute()
    return (resp.data or [None])[0]

def create_user_and_student(full_name: str, email: str = None):
    """
    Creates a row in users and a matching students row (student profile).
    Returns created user's id (uuid string).
    """
    user_payload = {"full_name": full_name, "role": "student"}
    if email:
        user_payload["email"] = email

    ins = supabase.table("users").insert(user_payload).execute()
    if not ins.data:
        raise RuntimeError(f"Failed to create user: {ins}")
    user = ins.data[0]
    user_id = user["id"]

    # create students row linked to same id
    supabase.table("students").insert({"id": user_id, "student_code": None}).execute()
    return user_id

# def get_or_create_student_id(full_name: str, email: str = None):
#     """Find or create a user+student entry. Returns student_id (UUID)."""

#     # Try by email
#     if email:
#         u = find_user_by_email(email)
#         if u:
#             return u["id"]

#     # Try by name
#     u = find_user_by_name(full_name)
#     if u:
#         # ensure also exists in students
#         sid = u["id"]
#         chk = supabase.table("students").select("*").eq("id", sid).execute()
#         if not chk.data:
#             supabase.table("students").insert({"id": sid}).execute()
#         return sid

#     # Otherwise create new user
#     user_payload = {"full_name": full_name, "role": "student"}
#     if email:
#         user_payload["email"] = email

#     ins = supabase.table("users").insert(user_payload).execute()
#     if not ins.data:
#         raise RuntimeError(f"Failed to create user: {ins}")
#     user = ins.data[0]
#     user_id = user["id"]

#     # Critical: also insert into students table
#     supabase.table("students").insert({"id": user_id}).execute()

#     return user_id
# def get_or_create_student_id(full_name: str, email: str = None):
#     """Find or create a user+student entry. Returns student_id (UUID)."""

#     # Try by email
#     if email:
#         u = find_user_by_email(email)
#         if u:
#             return u["id"]

#     # Try by name (lookup in students, since users doesn’t have a name column)
#     stu = supabase.table("students").select("*").eq("name", full_name).execute()
#     if stu.data and len(stu.data) > 0:
#         return stu.data[0]["id"]

#     # Otherwise create new user in students
#     student_payload = {"name": full_name}
#     if email:
#         student_payload["email"] = email
#     else:
#         # fallback dummy email
#         student_payload["email"] = f"{full_name.replace(' ', '').lower()}@example.com"
#     ins = supabase.table("students").insert(student_payload).execute()
#     if not ins.data:

#     return ins.data[0]["id"]
def get_or_create_student_id(roll_number: str | None, name: str, email: str | None = None) -> str:
    """Ensure a student exists in both users + students tables. Returns student_id (UUID)."""

    normalized_name = (name or "").strip()
    normalized_roll = roll_number.strip() if roll_number else None
    normalized_email = email.strip().lower() if email else None

    # 1. Prefer existing student records by roll number
    if normalized_roll:
        existing_student = (
            supabase.table("students")
            .select("id")
            .or_(f"roll_number.eq.{normalized_roll},student_roll_number.eq.{normalized_roll}")
            .limit(1)
            .execute()
        )
        if existing_student.data:
            return existing_student.data[0]["id"]

    # 2. Fall back to user lookup by email
    if normalized_email:
        existing_user = (
            supabase.table("users")
            .select("id")
            .eq("email", normalized_email)
            .limit(1)
            .execute()
        )
        if existing_user.data:
            user_id = existing_user.data[0]["id"]

            # Ensure matching student row exists
            student_row = (
                supabase.table("students")
                .select("id")
                .eq("id", user_id)
                .limit(1)
                .execute()
            )
            if not student_row.data:
                payload = {"id": user_id}
                if normalized_roll:
                    payload["roll_number"] = normalized_roll
                    payload["student_roll_number"] = normalized_roll
                supabase.table("students").insert(payload).execute()

            return user_id

    # 3. Create a new user (and student) if none exist
    derived_email = normalized_email
    if not derived_email:
        slug_source = normalized_roll or normalized_name.replace(" ", "") or "student"
        derived_email = f"{slug_source}@example.com"

    user_insert = supabase.table("users").insert({
        "full_name": normalized_name or name,
        "email": derived_email,
        "role": "student"
    }).execute()
    if not user_insert.data:
        raise RuntimeError(f"Failed to create user: {user_insert}")

    user_id = user_insert.data[0]["id"]

    payload = {"id": user_id}
    if normalized_roll:
        payload["roll_number"] = normalized_roll
        payload["student_roll_number"] = normalized_roll
    supabase.table("students").insert(payload).execute()

    return user_id

#     """
#     # Ensure shape is (N, features)
#         faces_flat = [f.flatten().tolist() for f in faces_array]
#     else:
#         faces_flat = [f.tolist() for f in faces_array]

#     # Bulk insert in chunks (Supabase prefers small batches)
#     records = [{"student_id": student_id, "vector": vec} for vec in faces_flat]
#     # Insert in one go (if many records, you could chunk)
#     res = supabase.table("faces").insert(records).execute()
#     return res
def save_faces_for_student(student_id: str, faces_np: np.ndarray):
    """
    Save face embeddings into the faces table, linked to student_id.
    Each 50x50 image is flattened into a 1D embedding.
    """

    if faces_np is None or len(faces_np) == 0:
        raise ValueError("No face data provided")

    rows = []
    total_faces = len(faces_np)
    for idx, face in enumerate(faces_np, start=1):
        embedding = face.flatten().tolist()  # convert numpy array -> Python list
        print(
            f"Preparing face {idx}/{total_faces} for student {student_id} "
            f"with embedding length {len(embedding)}"
        )
        rows.append({
            "student_id": student_id,
            "embedding": embedding
        })

    res = supabase.table("faces").insert(rows).execute()
    if not res.data:
        raise RuntimeError(f"Failed to save faces: {res}")

    print(f"Successfully saved {len(res.data)} faces for student {student_id}")
    return res.data



def load_training_data():
    """
    Returns (X, y, id2name) where:
      - X is np.array shape (N, feature_len)
      - y is list of labels (student_id strings)
      - id2name is dict mapping student_id -> name
    """
    faces_resp = supabase.table("faces").select("student_id, vector").execute()
    rows = faces_resp.data or []
    if not rows:
        return None, None, {}

    X = []
    y = []
    student_ids = set(r["student_id"] for r in rows)
    # get names for all student_ids
    id2name = {}
    if student_ids:
        students_resp = supabase.table("students").select("id, name").in_("id", list(student_ids)).execute()
        for s in (students_resp.data or []):
            id2name[s["id"]] = s.get("name")

    for r in rows:
        vec = r["vector"]
        X.append(np.array(vec, dtype=np.float32))
        y.append(r["student_id"])  # label is student_id
    X = np.vstack(X) if X else None
    return X, y, id2name

# ---------- Attendance ----------
def mark_attendance_if_not_exists(student_id: str, class_id: str = None, conf: float = None):
    """Insert attendance for today only if not already present."""
    today = date.today().isoformat()
    q = supabase.table("attendance").select("*")\
        .eq("student_id", student_id).eq("date", today)
    if class_id:
        q = q.eq("class_id", class_id)
    chk = q.execute()
    if chk.data and len(chk.data) > 0:
        return {"status": "exists"}
    payload = {"student_id": student_id, "date": today, "status": "present"}
    if class_id:
        payload["class_id"] = class_id
    if conf is not None:
        payload["confidence"] = float(conf)
    res = supabase.table("attendance").insert(payload).execute()
    return res

def attendance_percentage(student_id: str, class_id: str = None):
    """Calculate attendance percentage for a student."""
    q = supabase.table("attendance").select("*").eq("student_id", student_id)
    if class_id:
        q = q.eq("class_id", class_id)
    rows = q.execute().data or []
    if not rows:
        return None
    total = len(rows)
    present = sum(1 for r in rows if r.get("status") == "present")
    return (present / total) * 100.0

def check_and_record_low_attendance(student_id: str, threshold: float = 75.0, send_email_alert: bool = False, include_no_records: bool = False) -> tuple[bool, float | None]:
    """
    Check if student's attendance is below threshold and record alert if needed.
    Returns (alert_sent, attendance_percentage)
    
    Args:
        student_id: Student UUID
        threshold: Attendance percentage threshold (default 75.0)
        send_email_alert: Whether to send email alert
        include_no_records: If True, treat students with no records as 0% (below threshold)
    """
    from email_utils import send_low_attendance_alert
    
    pct = attendance_percentage(student_id)
    
    # Handle students with no attendance records
    if pct is None:
        if include_no_records:
            pct = 0.0  # Treat as 0% attendance
        else:
            return False, None  # Skip students with no records
    
    if pct < threshold:
        today = date.today().isoformat()
        
        # Check if alert already sent today
        chk = supabase.table("attendance_alerts").select("*")\
            .eq("student_id", student_id)\
            .eq("alert_date", today)\
            .eq("alert_type", "low_attendance_email").execute()
        
        if not chk.data:
            # Record alert in database
            supabase.table("attendance_alerts").insert({
                "student_id": student_id,
                "alert_date": today,
                "alert_type": "low_attendance_email"
            }).execute()
            
            # Send email if enabled
            if send_email_alert:
                try:
                    # Get student details (email is directly in students table)
                    student_resp = supabase.table("students").select("id, name, email").eq("id", student_id).execute()
                    if student_resp.data and len(student_resp.data) > 0:
                        student = student_resp.data[0]
                        student_name = student.get("name", "Student")
                        student_email = student.get("email")
                        
                        if student_email:
                            print(f"📧 Sending low attendance alert to {student_name} ({student_email})")
                            email_sent = send_low_attendance_alert(
                                student_email=student_email,
                                student_name=student_name,
                                attendance_percentage=pct
                            )
                            
                            if email_sent:
                                print(f"✅ Alert email sent successfully to {student_name}")
                            else:
                                print(f"❌ Failed to send alert email to {student_name}")
                        else:
                            print(f"⚠️ No email found for student {student_name}")
                    else:
                        print(f"⚠️ Student {student_id} not found in database")
                except Exception as e:
                    print(f"❌ Error sending email alert: {e}")
                    import traceback
                    traceback.print_exc()
            
            return True, pct
    
    return False, pct