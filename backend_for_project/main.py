import os
import time 
from datetime import datetime
from supabase import create_client, Client
import cv2
from sklearn.neighbors import KNeighborsClassifier
from db_utils import check_and_record_low_attendance
from email_utils import send_email
from supabase_client import supabase
# import pickle
from fastapi import FastAPI, File, HTTPException, UploadFile, Form
from pydantic import BaseModel
from typing import Optional, Dict, Any
import uuid
import base64
import numpy as np
from fastapi import FastAPI
from db_utils import (
    get_or_create_student_id,
    save_faces_for_student,
    load_training_data,
    mark_attendance_if_not_exists,
    attendance_percentage,
    check_and_record_low_attendance
)
from fastapi.middleware.cors import CORSMiddleware

app = FastAPI()
origins = [
    "http://localhost:3000",   # Next.js default dev server
    "http://localhost:9002",   # Firebase/other local port you’re running on
    "https://yourdomain.com",  # your production frontend domain (add later when deployed)
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)




# supabase client setup 
SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_KEY = os.getenv("SUPABASE_SERVICE_KEY")  # backend only

supabase: Client = create_client(SUPABASE_URL, SUPABASE_KEY)


LIVENESS_THRESHOLD = float(os.getenv("LIVENESS_THRESHOLD", "0.4"))
LIVENESS_EDGE_DIVISOR = float(os.getenv("LIVENESS_EDGE_DIVISOR", "350.0"))
LIVENESS_CONTRAST_DIVISOR = float(os.getenv("LIVENESS_CONTRAST_DIVISOR", "80.0"))
SPOOF_ALERT_TABLE = os.getenv("SPOOF_ALERT_TABLE", "attendance_alerts")

IDENTITY_DISTANCE_SCALE = float(os.getenv("IDENTITY_DISTANCE_SCALE", "1.6"))
IDENTITY_REQUIRED_SIGHTINGS = int(os.getenv("IDENTITY_REQUIRED_SIGHTINGS", "2"))
IDENTITY_WINDOW_SECONDS = float(os.getenv("IDENTITY_WINDOW_SECONDS", "8"))

# Confidence calculation constants
IDENTITY_CONFIDENCE_THRESHOLD = float(os.getenv("IDENTITY_CONFIDENCE_THRESHOLD", "0.65"))
IDENTITY_CONFIDENCE_DECAY = float(os.getenv("IDENTITY_CONFIDENCE_DECAY", "0.05"))
IDENTITY_CONFIDENCE_MIN = float(os.getenv("IDENTITY_CONFIDENCE_MIN", "0.4"))
# CRITICAL: Face recognition thresholds - tuned for accuracy
MIN_CONFIDENCE = float(os.getenv("FACE_MIN_CONFIDENCE", "0.85"))  # Require VERY high confidence (was 0.70)
MIN_CONFIDENCE_MARGIN = float(os.getenv("FACE_MIN_CONFIDENCE_MARGIN", "0.20"))  # Strong margin between candidates (was 0.10)
MIN_FACE_SIZE = int(os.getenv("MIN_FACE_SIZE", "80"))  # Larger minimum face size for better quality (was 60)
BLUR_THRESHOLD = float(os.getenv("BLUR_THRESHOLD", "100.0"))  # Stricter blur detection (was 50.0)
MAX_FACE_SIZE = int(os.getenv("MAX_FACE_SIZE", "400"))  # Maximum face size to avoid false positives
MIN_SAMPLES_PER_STUDENT = int(os.getenv("MIN_SAMPLES_PER_STUDENT", "10"))  # Minimum training samples required

# Paths
# NAMES_FILE = "data/names.pkl"
# FACES_FILE = "data/faces_data.pkl"
CASCADE_PATH = cv2.data.haarcascades + 'haarcascade_frontalface_default.xml'
facedetect = cv2.CascadeClassifier(CASCADE_PATH)
recent_recognitions: Dict[str, Dict[str, Any]] = {}


def estimate_liveness_score(face_img: np.ndarray) -> float:
    """Estimate a simple liveness score from a cropped face image.
    Uses edge variance and contrast heuristics as lightweight spoof detection."""
    if face_img is None or face_img.size == 0:
        return 0.0

    try:
        resized = cv2.resize(face_img, (128, 128))
    except Exception:
        resized = face_img

    gray = cv2.cvtColor(resized, cv2.COLOR_BGR2GRAY)

    # Edge density via Laplacian variance
    laplacian_var = cv2.Laplacian(gray, cv2.CV_64F).var()
    edge_score = min(laplacian_var / max(LIVENESS_EDGE_DIVISOR, 1.0), 1.0)

    # Contrast / texture via standard deviation
    contrast_score = min(gray.std() / max(LIVENESS_CONTRAST_DIVISOR, 1.0), 1.0)
    # Combine scores (weighted)
    combined = (edge_score * 0.6) + (contrast_score * 0.4)
    return float(max(0.0, min(combined, 1.0)))


def recognize_frame(frame_data: str, subject_id: Optional[str] = None, subject_code: Optional[str] = None):
    """
    Recognize faces in a base64-encoded image frame
    """
    def record_spoof_alert(
        student_id: Optional[str],
        student_name: Optional[str],
        liveness_score: float,
        reason: str,
    ) -> None:
        """Persist spoof attempts for auditing without interrupting the main flow."""
        payload = {
            "subject_id": subject_id,
            "subject_code": subject_code,
            "student_id": student_id,
            "student_name": student_name,
            "liveness_score": liveness_score,
            "reason": reason,
            "created_at": datetime.utcnow().isoformat()
        }

        try:
            supabase.table(SPOOF_ALERT_TABLE).insert(payload).execute()
        except Exception as alert_error:
            # Log but do not raise ‒ attendance flow should continue
            print(f"Warning: failed to record spoof alert: {alert_error}")


def should_confirm_identity(student_id: Optional[str], subject_id: Optional[str], confidence: float) -> bool:
    """Require consistent, high-confidence sightings before marking attendance."""
    if not student_id:
        return False

    key_subject = subject_id or "global"
    key = f"{student_id}:{key_subject}"
    now = time.time()

    # Drop stale entries
    entry = recent_recognitions.get(key)
    if entry and now - entry.get("first_seen", now) > IDENTITY_WINDOW_SECONDS:
        recent_recognitions.pop(key, None)
        entry = None

    if confidence < IDENTITY_CONFIDENCE_THRESHOLD:
        if key in recent_recognitions:
            recent_recognitions.pop(key, None)
        return False

    if not entry:
        recent_recognitions[key] = {"count": 1, "first_seen": now}
        print(f"Identity buffer started for {student_id} (confidence={confidence:.3f})")
        return False

    entry["count"] = entry.get("count", 0) + 1
    entry["first_seen"] = entry.get("first_seen", now)
    recent_recognitions[key] = entry

    confirmed = entry["count"] >= IDENTITY_REQUIRED_SIGHTINGS
    if confirmed:
        recent_recognitions.pop(key, None)
        print(f"Identity confirmed for {student_id} after {entry['count']} sightings")
    else:
        print(f"Identity buffer for {student_id}: {entry['count']} / {IDENTITY_REQUIRED_SIGHTINGS}")
    return confirmed

# Helper function to upload image to Supabase Storage
def upload_profile_image(image_data: str, user_id: str, user_type: str = "student") -> str:
    """
    Upload base64 image data to Supabase Storage
    Returns the public URL of the uploaded image
    """
    try:
        print(f"Attempting to upload image for {user_type} {user_id}")
        
        # Remove data URL prefix if present
        if image_data.startswith('data:image/'):
            image_data = image_data.split(',')[1]
        
        # Decode base64 image
        image_bytes = base64.b64decode(image_data)
        print(f"Decoded image size: {len(image_bytes)} bytes")
        
        # Generate unique filename
        file_extension = "jpg"  # Default to jpg
        filename = f"{user_type}s/{user_id}/{uuid.uuid4()}.{file_extension}"
        print(f"Upload filename: {filename}")
        
        # Upload to Supabase Storage
        result = supabase.storage.from_("profile-pictures").upload(filename, image_bytes)
        print(f"Upload result: {result}")
        
        if result:
            # Get public URL
            public_url = supabase.storage.from_("profile-pictures").get_public_url(filename)
            print(f"Generated public URL: {public_url}")
            return public_url
        else:
            print("Upload failed, using placeholder")
            # Fallback to placeholder if upload fails
            return f"https://picsum.photos/seed/{user_id}/100/100"
            
    except Exception as e:
        print(f"Error uploading image: {e}")
        print(f"Exception type: {type(e)}")
        # Fallback to placeholder if upload fails
        return f"https://picsum.photos/seed/{user_id}/100/100"


@app.get("/")
def home():
    return {"message": "FastAPI backend running!"}





@app.get("/debug/full_database")
def debug_full_database():
    """Comprehensive debug endpoint for entire database"""
    try:
        debug_info = {
            "timestamp": str(np.datetime64("now")),
            "tables": {}
        }
        
        # Get all table names first
        tables_to_check = ["students", "faces", "attendance", "users"]
        
        for table_name in tables_to_check:
            try:
                # Get table structure and data
                table_resp = supabase.table(table_name).select("*").limit(10).execute()
                table_data = table_resp.data or []
                
                debug_info["tables"][table_name] = {
                    "count": len(table_data),
                    "sample_data": table_data[:3],  # First 3 records
                    "columns": list(table_data[0].keys()) if table_data else [],
                    "status": "success"
                }
                
                # Special analysis for specific tables
                if table_name == "students":
                    null_names = sum(1 for row in table_data if row.get("name") is None)
                    debug_info["tables"][table_name]["null_names"] = null_names
                    
                elif table_name == "faces":
                    null_student_ids = sum(1 for row in table_data if row.get("student_id") is None)
                    debug_info["tables"][table_name]["null_student_ids"] = null_student_ids
                    
            except Exception as table_error:
                debug_info["tables"][table_name] = {
                    "status": "error",
                    "error": str(table_error)
                }
        
        # Cross-reference analysis
        try:
            faces_resp = supabase.table("faces").select("student_id").execute()
            students_resp = supabase.table("students").select("id, name").execute()
            
            faces_data = faces_resp.data or []
            students_data = students_resp.data or []
            
            student_ids = {s["id"] for s in students_data}
            face_student_ids = {f["student_id"] for f in faces_data if f.get("student_id")}
            
            debug_info["cross_reference"] = {
                "student_ids_in_faces": len(face_student_ids),
                "student_ids_in_students": len(student_ids),
                "matching_ids": len(student_ids.intersection(face_student_ids)),
                "orphaned_faces": len(face_student_ids - student_ids),
                "students_without_faces": len(student_ids - face_student_ids)
            }
            
        except Exception as cross_error:
            debug_info["cross_reference"] = {"error": str(cross_error)}
        
        return debug_info
        
    except Exception as e:
        return {"error": str(e), "timestamp": str(np.datetime64("now"))}

@app.get("/debug/table/{table_name}")
def debug_specific_table(table_name: str):
    """Debug specific table with all data"""
    try:
        # Get all data from specific table
        table_resp = supabase.table(table_name).select("*").execute()
        table_data = table_resp.data or []
        
        return {
            "table_name": table_name,
            "total_records": len(table_data),
            "data": table_data,
            "columns": list(table_data[0].keys()) if table_data else []
        }
    except Exception as e:
        return {"error": str(e), "table_name": table_name}


# -------------------------
# Endpoint: Capture Faces (headless, with error handling)
# -------------------------
# @app.post("/capture_faces")
# def capture_faces(name: str):
#     try:
#         # Ensure data folder exists
#         if not os.path.exists("data"):
#             os.makedirs("data")

#         # Load face detector
#         if not os.path.exists(CASCADE_PATH):
#             raise FileNotFoundError(f"Haarcascade file not found at {CASCADE_PATH}")
#         facedetect = cv2.CascadeClassifier(CASCADE_PATH)

#         video = cv2.VideoCapture(0)
#         if not video.isOpened():
#             raise RuntimeError("Could not open webcam. Is it already in use?")

#         faces_data = []
#         i = 0

#         while True:
#             ret, frame = video.read()
#             if not ret:
#                 raise RuntimeError("Failed to capture frame from webcam.")

#             gray = cv2.cvtColor(frame, cv2.COLOR_BGR2GRAY)
#             faces = facedetect.detectMultiScale(gray, 1.3, 5)
#             for (x, y, w, h) in faces:
#                 crop_img = frame[y:y+h, x:x+w, :]
#                 resized_img = cv2.resize(crop_img, (50, 50))
#                 if len(faces_data) < 100 and i % 10 == 0:
#                     faces_data.append(resized_img)
#                 i += 1

#             if len(faces_data) >= 100:
#                 break

#         video.release()

#         faces_np = np.asarray(faces_data)

#         # Get or create student in Supabase
#         student_id = get_or_create_student_id(name, email=None)

#         # Save faces to Supabase
#         save_faces_for_student(student_id, faces_np)


#         return {"status": "success", "message": f"Faces captured for {name}"}

#     except Exception as e:
#         import traceback
#         traceback.print_exc()  # Print full error in terminal
#         return {"status": "error", "message": str(e)}


@app.post("/capture_faces")
def capture_faces(roll_number: str, name: str, email: str | None = None):
    try:
        video = cv2.VideoCapture(0)
        if not video.isOpened():
            raise RuntimeError("Could not open webcam. Is it already in use?")

        faces_data = []
        i = 0
        quality_rejected = 0

        print(f"Starting face capture for {name} (roll: {roll_number})")

        while True:
            ret, frame = video.read()
            if not ret:
                raise RuntimeError("Failed to capture frame from webcam.")

            gray = cv2.cvtColor(frame, cv2.COLOR_BGR2GRAY)
            faces = facedetect.detectMultiScale(gray, 1.3, 5)
            
            for (x, y, w, h) in faces:
                # Only process every 10th frame
                if i % 10 != 0:
                    i += 1
                    continue
                
                # Check face size
                if w < MIN_FACE_SIZE or h < MIN_FACE_SIZE:
                    quality_rejected += 1
                    i += 1
                    continue
                
                crop_img = frame[y:y + h, x:x + w, :]
                
                # Check blur
                gray_crop = cv2.cvtColor(crop_img, cv2.COLOR_BGR2GRAY)
                laplacian_var = cv2.Laplacian(gray_crop, cv2.CV_64F).var()
                if laplacian_var < BLUR_THRESHOLD:
                    quality_rejected += 1
                    i += 1
                    continue
                
                # CRITICAL: Use SAME preprocessing as recognition for consistency
                resized_img = cv2.resize(crop_img, (50, 50))
                
                # Apply histogram equalization (same as recognition)
                resized_gray = cv2.cvtColor(resized_img, cv2.COLOR_BGR2GRAY)
                equalized = cv2.equalizeHist(resized_gray)
                resized_img_eq = cv2.cvtColor(equalized, cv2.COLOR_GRAY2BGR)
                
                # Normalize to 0-1 range
                normalized_img = resized_img_eq.astype(np.float32) / 255.0
                
                # Apply Gaussian blur to reduce noise (same as recognition)
                normalized_img = cv2.GaussianBlur(normalized_img, (3, 3), 0)

                if len(faces_data) < 100:
                    faces_data.append(normalized_img.flatten().tolist())
                    print(f"Captured {len(faces_data)}/100 quality faces (rejected: {quality_rejected})")
                
                i += 1

            if len(faces_data) >= 100:
                break

        video.release()

        # ✅ Ensure user+student exists
        student_id = get_or_create_student_id(roll_number, name, email)
        print(f"Captured face for student_id: {student_id}, name: {name}")

        # ✅ Save embeddings into faces table
        for vector in faces_data:
            print(f"Saving face {i+1}/{len(faces_data)} for student {student_id}")
            supabase.table("faces").insert({
                "student_id": student_id,
                "vector": vector
            }).execute()

        return {
            "status": "success",
            "message": f"Faces captured for {roll_number} - {name}, linked to student {student_id}"
        }

    except Exception as e:
        import traceback
        traceback.print_exc()
        return {"status": "error", "message": str(e)}


# -------------------------
# Endpoint: Recognize Faces
# -------------------------
@app.post("/recognize_faces")
def recognize_faces():
    from sklearn.neighbors import KNeighborsClassifier

    video = cv2.VideoCapture(0)
    facedetect = cv2.CascadeClassifier(CASCADE_PATH)

    # Load data
    X, y, id2name = load_training_data()
    if X is None or y is None:
        raise HTTPException(status_code=400, detail="No training data found in Supabase")

    # normalize if values look like pixels (0–255)
    if X.max() > 1.0:
        X = X / 255.0

    knn = KNeighborsClassifier(n_neighbors=5)
    knn.fit(X, y)


    while True:
        ret, frame = video.read()
        gray = cv2.cvtColor(frame, cv2.COLOR_BGR2GRAY)
        faces = facedetect.detectMultiScale(gray, 1.3, 5)
        for (x, y, w, h) in faces:
            crop_img = frame[y:y + h, x:x + w, :]
            resized_img = cv2.resize(crop_img, (50, 50)).flatten().reshape(1, -1)
            # output = knn.predict(resized_img)
            cv2.rectangle(frame, (x, y), (x + w, y + h), (0, 0, 255), 1)
            cv2.rectangle(frame, (x, y), (x + w, y + h), (50, 50, 255), 2)
            cv2.rectangle(frame, (x, y - 40), (x + w, y), (50, 50, 255), -1)
            # cv2.putText(frame, str(output[0]), (x, y - 15),
            #             cv2.FONT_HERSHEY_COMPLEX, 1, (255, 255, 255), 1)
            pred_id = knn.predict(resized_img)[0]  # student_id from Supabase
            display_name = id2name.get(pred_id, pred_id)

            # Mark attendance in Supabase
            mark_attendance_if_not_exists(pred_id)

            cv2.putText(frame, display_name, (x, y - 15),
                        cv2.FONT_HERSHEY_COMPLEX, 1, (255, 255, 255), 1)


        cv2.imshow("Frame", frame)
        k = cv2.waitKey(1)
        if k == ord('q'):
            break

    video.release()
    cv2.destroyAllWindows()

    return {"status": "success", "message": "Recognition session ended"}

# -------------------------
# Endpoint: Check Low Attendance and Send Email
# -------------------------

@app.post("/check_low_attendance")
def check_low_attendance(student_id: str, threshold: float = 75.0):
    """
    Check if a student's attendance is below threshold.
    If yes, send them an email alert.
    """
    sent, pct = check_and_record_low_attendance(student_id, threshold)
    if pct is None:
        return {"status": "error", "message": "No attendance records found"}
    
    if sent:
        # get student email
        row = supabase.table("users").select("email, full_name").eq("id", student_id).execute()
        if row.data and row.data[0].get("email"):
            email = row.data[0]["email"]
            name = row.data[0]["full_name"]
            subject = "Low Attendance Alert"
            body = f"Hello {name},\n\nYour attendance is {pct:.2f}% which is below {threshold}%. Please attend more classes."
            send_email(email, subject, body)
        return {"status": "alert_sent", "percentage": pct}
    else:
        return {"status": "ok", "percentage": pct}

# -------------------------
# Get Attendance Percentage
# -------------------------
@app.get("/attendance/percentage/{student_id}")
def get_attendance_percentage(student_id: str):
    pct = attendance_percentage(student_id)
    if pct is None:
        return {"status": "error", "message": "No attendance records"}
    return {"status": "ok", "percentage": pct}

#-------------------------
# Recognize Frames
#-------------------------
@app.post("/recognize_frame")
async def recognize_frame(frame: UploadFile = File(...), subject_id: str = Form(None)):
    try:
        print(f"Received file: {frame.filename}, content_type: {frame.content_type}")
        print(f"Subject ID: {subject_id}")
        subject_code = None
        if subject_id:
            try:
                subject_resp = supabase.table("subjects").select("code").eq("id", subject_id).execute()
                if subject_resp.data:
                    subject_code = subject_resp.data[0].get("code")
                print(f"Resolved subject code: {subject_code}")
            except Exception as subject_fetch_error:
                print(f"Error fetching subject code for {subject_id}: {subject_fetch_error}")

        # --- Read uploaded frame ---
        contents = await frame.read()
        print(f"File size: {len(contents)} bytes")
        
        npimg = np.frombuffer(contents, np.uint8)
        img = cv2.imdecode(npimg, cv2.IMREAD_COLOR)

        if img is None:
            return {"status": "error", "message": "Invalid image data"}

        # --- Load training data from Supabase ---
        print("Loading training data from Supabase...")
        faces_resp = supabase.table("faces").select("student_id, vector").execute()
        students_resp = supabase.table("students").select("id, name").execute()

        print(f"Faces data: {len(faces_resp.data) if faces_resp.data else 0} records")
        print(f"Students data: {len(students_resp.data) if students_resp.data else 0} records")
        
        # Debug: Print the actual data
        if faces_resp.data:
            print("Sample faces data:", faces_resp.data[:2])  # Show first 2 records
        if students_resp.data:
            print("Sample students data:", students_resp.data[:2])  # Show first 2 records

        faces_data = []
        labels = []
        student_map = {s["id"]: s.get("name") or s.get("full_name") or s["id"] for s in (students_resp.data or [])}
        print(f"Student map: {student_map}")

        # Only include faces that have valid student names
        valid_faces = 0
        invalid_faces = 0
        for row in (faces_resp.data or []):
            student_id = row.get("student_id")
            student_name = student_map.get(student_id)
            if student_id and student_name:  # Only add if we have a valid student and name
                faces_data.append(np.array(row["vector"]))
                labels.append(student_id)
                valid_faces += 1
            else:
                invalid_faces += 1
                print(f"Invalid face: student_id {row.get('student_id')} not found in student_map")
        
        print(f"Valid faces: {valid_faces}, Invalid faces: {invalid_faces}")

        if not faces_data:
            return {"status": "error", "message": "No training data available - no valid student faces found"}

        # Check if we have enough data for training
        unique_labels = set(labels)
        if len(unique_labels) < 2:
            return {"status": "error", "message": f"Not enough students for training. Found {len(unique_labels)} student(s), need at least 2"}

        X = np.array(faces_data)
        y = np.array(labels)
        
        # Normalize training data to match test data normalization
        if X.max() > 1.0:
            print("Normalizing training data (0-1 range)")
            X = X.astype(np.float32) / 255.0
        
        print(f"Training KNN with {len(faces_data)} face samples for {len(unique_labels)} students")

        # IMPROVED: Use optimized KNN with better parameters
        # Calculate optimal k: sqrt(n) but ensure it's odd and at least 5
        optimal_k = max(5, min(int(np.sqrt(len(faces_data))), 15))
        if optimal_k % 2 == 0:
            optimal_k += 1  # Make it odd to avoid ties
        
        # Ensure k doesn't exceed number of samples
        k_neighbors = min(optimal_k, len(faces_data) - 1)
        
        print(f"Using k={k_neighbors} neighbors (optimal for {len(faces_data)} samples)")
        
        knn = KNeighborsClassifier(
            n_neighbors=k_neighbors,
            weights='distance',  # Weight by inverse distance for better accuracy
            metric='euclidean',
            algorithm='ball_tree',  # Faster for high-dimensional data
            leaf_size=30
        )
        knn.fit(X, y)
        readable_labels = [student_map.get(label, label) for label in unique_labels]
        print(f"KNN trained successfully with {len(unique_labels)} unique labels: {readable_labels}")

        # --- Detect faces ---
        print("Detecting faces...")
        gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)
        faces = facedetect.detectMultiScale(gray, 1.3, 5)
        print(f"Detected {len(faces)} faces")

        results = []
        live_face_count = 0
        accepted_faces = 0
        rejection_stats = {"small": 0, "blurry": 0, "low_confidence": 0, "ambiguous": 0}
        
        for (x, y, w, h) in faces:
            try:
                # Check face size - reject small OR too large faces
                if w < MIN_FACE_SIZE or h < MIN_FACE_SIZE:
                    rejection_stats["small"] += 1
                    print(f"Skipping small face: {w}x{h} (minimum {MIN_FACE_SIZE}x{MIN_FACE_SIZE})")
                    continue
                
                if w > MAX_FACE_SIZE or h > MAX_FACE_SIZE:
                    rejection_stats["small"] += 1
                    print(f"Skipping too large face: {w}x{h} (maximum {MAX_FACE_SIZE}x{MAX_FACE_SIZE})")
                    continue
                
                crop_img = img[y:y+h, x:x+w, :]
                
                # Check if face is too blurry
                gray_crop = cv2.cvtColor(crop_img, cv2.COLOR_BGR2GRAY)
                laplacian_var = cv2.Laplacian(gray_crop, cv2.CV_64F).var()
                if laplacian_var < BLUR_THRESHOLD:
                    rejection_stats["blurry"] += 1
                    print(f"Skipping blurry face: blur score {laplacian_var:.2f} (threshold {BLUR_THRESHOLD})")
                    continue
                
                # IMPROVED: Enhanced preprocessing with histogram equalization
                resized_img = cv2.resize(crop_img, (50, 50))
                
                # Apply histogram equalization for better lighting normalization
                resized_gray = cv2.cvtColor(resized_img, cv2.COLOR_BGR2GRAY)
                equalized = cv2.equalizeHist(resized_gray)
                
                # Convert back to BGR for consistency with training data
                resized_img_eq = cv2.cvtColor(equalized, cv2.COLOR_GRAY2BGR)
                
                # Normalize pixel values to 0-1 range
                normalized_img = resized_img_eq.astype(np.float32) / 255.0
                
                # Apply Gaussian blur to reduce noise
                normalized_img = cv2.GaussianBlur(normalized_img, (3, 3), 0)
                
                flattened_img = normalized_img.flatten().reshape(1, -1)

                # IMPROVED: Multi-stage confidence validation
                probabilities = knn.predict_proba(flattened_img)
                sorted_probs = np.sort(probabilities[0])[::-1]  # Sort descending
                max_prob = float(sorted_probs[0])
                second_prob = float(sorted_probs[1]) if len(sorted_probs) > 1 else 0.0
                third_prob = float(sorted_probs[2]) if len(sorted_probs) > 2 else 0.0
                
                # Stage 1: Absolute confidence threshold (STRICT)
                if max_prob < MIN_CONFIDENCE:
                    rejection_stats["low_confidence"] += 1
                    print(
                        f"❌ Stage 1 FAIL: Low confidence {max_prob:.3f} < {MIN_CONFIDENCE:.3f}"
                    )
                    continue
                
                # Stage 2: Margin between top 2 predictions (avoid ambiguous matches)
                confidence_margin = max_prob - second_prob
                if confidence_margin < MIN_CONFIDENCE_MARGIN:
                    rejection_stats["ambiguous"] += 1
                    print(
                        f"❌ Stage 2 FAIL: Ambiguous margin {confidence_margin:.3f} < {MIN_CONFIDENCE_MARGIN:.3f} "
                        f"(top2: {max_prob:.3f} vs {second_prob:.3f})"
                    )
                    continue
                
                # Stage 3: Ensure top prediction is significantly better than 3rd
                if len(sorted_probs) > 2:
                    third_margin = max_prob - third_prob
                    if third_margin < MIN_CONFIDENCE_MARGIN * 1.5:
                        rejection_stats["ambiguous"] += 1
                        print(
                            f"❌ Stage 3 FAIL: Top prediction not dominant enough "
                            f"(margin to 3rd: {third_margin:.3f})"
                        )
                        continue
                
                # Stage 4: Check if prediction is consistent (distance-based validation)
                distances, indices = knn.kneighbors(flattened_img)
                avg_distance = float(np.mean(distances[0]))
                max_acceptable_distance = 0.3  # Tune based on your data
                
                if avg_distance > max_acceptable_distance:
                    rejection_stats["low_confidence"] += 1
                    print(
                        f"❌ Stage 4 FAIL: Average distance too high {avg_distance:.3f} > {max_acceptable_distance:.3f}"
                    )
                    continue
                
                print(f"✅ ALL STAGES PASSED: confidence={max_prob:.3f}, margin={confidence_margin:.3f}, avg_dist={avg_distance:.3f}")

                prediction = knn.predict(flattened_img)[0]
                student_id = prediction
                student_name = student_map.get(student_id, student_id)
                print(
                    f"Predicted: {student_name} (student_id={student_id}) "
                    f"confidence={max_prob:.2f}, margin={confidence_margin:.2f}"
                )

                liveness_score = estimate_liveness_score(crop_img)
                is_live = liveness_score >= LIVENESS_THRESHOLD

                results.append({
                    "x": int(x),
                    "y": int(y),
                    "w": int(w),
                    "h": int(h),
                    "name": student_name,
                    "confidence": round(max_prob, 3),
                    "student_id": student_id,
                    "liveness_score": round(liveness_score, 3),
                    "liveness_passed": is_live
                })

                if not is_live:
                    print(f"Liveness check failed for {student_name} (score={liveness_score:.3f})")
                    record_spoof_alert(
                        subject_id=subject_id,
                        subject_code=subject_code,
                        student_id=student_id,
                        student_name=student_name,
                        liveness_score=float(round(liveness_score, 3)),
                        reason="low_liveness_score"
                    )
                    continue

                live_face_count += 1

                # Mark attendance
                if student_id:
                    accepted_faces += 1
                    print(f"Marking attendance for student {student_id}")
                    attendance_data = {
                        "student_id": student_id,
                        "date": str(np.datetime64("today")),
                        "status": "present",
                        "marked_at": datetime.utcnow().isoformat()
                    }
                    if subject_id:
                        attendance_data["subject_id"] = subject_id
                    if subject_code:
                        attendance_data["subject_code"] = subject_code

                    try:
                        supabase.table("attendance").insert(attendance_data).execute()
                    except Exception as insert_error:
                        # Fallbacks for older schemas
                        if "subject_code" in str(insert_error):
                            attendance_data.pop("subject_code", None)
                            supabase.table("attendance").insert(attendance_data).execute()
                        elif "marked_at" in str(insert_error):
                            attendance_data.pop("marked_at", None)
                            supabase.table("attendance").insert(attendance_data).execute()
                        else:
                            raise insert_error
                else:
                    print(f"Warning: No student_id found for prediction '{student_name}'")
            except Exception as e:
                print(f"Error processing face at ({x}, {y}): {e}")
                continue

        if not results:
            print(f"No faces recognized. Rejection stats: {rejection_stats}")
            return {
                "status": "no_face",
                "faces": [],
                "rejection_stats": rejection_stats,
                "message": f"Detected {len(faces)} faces but none passed validation"
            }

        if live_face_count == 0:
            return {
                "status": "spoof_detected",
                "faces": results,
                "message": "Potential spoof attempt detected; attendance blocked."
            }

        response = {"status": "recognized", "faces": results}
        if live_face_count < len(results):
            response["message"] = "Some faces were blocked by liveness detection."
        return response

    except Exception as e:
        return {"status": "error", "message": str(e)}

# -------------------------
# Student Management Endpoints
# -------------------------
@app.get("/students")
def get_all_students():
    """Get all students with their details"""
    try:
        # Get students with user details
        students_resp = supabase.table("students").select("""
            id,
            student_roll_number,
            roll_number,
            name,
            email,
            address,
            status,
            avatar_url,
            created_at,
            users!inner(full_name, email, phone)
        """).execute()
        
        students = []
        for student in (students_resp.data or []):
            # Combine student and user data
            user_data = student.get("users", {})
            
            # Calculate real-time attendance percentage
            student_id = student["id"]
            
            # Get total attendance records for this student
            attendance_resp = supabase.table("attendance").select("status").eq("student_id", student_id).execute()
            attendance_records = attendance_resp.data or []
            
            total_records = len(attendance_records)
            present_records = len([r for r in attendance_records if r.get("status") == "present"])
            
            # Calculate attendance percentage - if no records, show 0%
            if total_records == 0:
                attendance_percentage = 0
            else:
                attendance_percentage = round((present_records / total_records) * 100)
            
            print(f"Student {student.get('name')}: {present_records}/{total_records} = {attendance_percentage}%")
            
            # Determine current attendance status (latest record)
            latest_attendance = "pending"
            if attendance_records:
                # Get the most recent attendance record
                latest_resp = supabase.table("attendance").select("status").eq("student_id", student_id).order("created_at", desc=True).limit(1).execute()
                if latest_resp.data:
                    latest_attendance = latest_resp.data[0].get("status", "pending")
            
            students.append({
                "id": student["id"],
                "name": student.get("name") or user_data.get("full_name", ""),
                "studentId": student.get("student_roll_number") or student.get("roll_number", ""),
                "email": student.get("email") or user_data.get("email", ""),
                "contact": user_data.get("phone", ""),
                "address": student.get("address", ""),
                "status": student.get("status", "active"),
                "avatar": student.get("avatar_url") or f"https://picsum.photos/seed/{student['id']}/100/100",
                "attendance": latest_attendance,
                "attendancePercentage": attendance_percentage,
                "created_at": student.get("created_at")
            })
        
        return {"status": "success", "students": students}
    except Exception as e:
        return {"status": "error", "message": str(e)}

@app.post("/students")
def create_student(
    firstName: str = Form(...),
    lastName: str = Form(...),
    studentId: str = Form(...),
    email: str = Form(...),
    contact: str = Form(None),
    address: str = Form(None),
    avatar: str = Form(None)
):
    """Create a new student"""
    try:
        full_name = f"{firstName} {lastName}".strip()
        student_id = get_or_create_student_id(studentId, full_name, email)

        existing_user_resp = (
            supabase.table("users")
            .select("full_name, email, phone, role")
            .eq("id", student_id)
            .limit(1)
            .execute()
        )
        existing_user = (existing_user_resp.data or [None])[0]

        existing_student_resp = (
            supabase.table("students")
            .select("id, avatar_url, address, status")
            .eq("id", student_id)
            .limit(1)
            .execute()
        )
        existing_student = (existing_student_resp.data or [None])[0]

        avatar_url = (
            existing_student.get("avatar_url")
            if existing_student and existing_student.get("avatar_url")
            else f"https://picsum.photos/seed/{student_id}/100/100"
        )
        if avatar and avatar.strip():
            try:
                avatar_url = upload_profile_image(avatar, student_id, "student")
            except Exception as upload_error:
                print(f"Avatar upload failed: {upload_error}")

        user_payload = {
            "full_name": full_name,
            "email": email,
            "role": "student"
        }
        if contact:
            user_payload["phone"] = contact
        elif existing_user and existing_user.get("phone"):
            user_payload["phone"] = existing_user.get("phone")

        supabase.table("users").update(user_payload).eq("id", student_id).execute()

        student_payload = {
            "student_roll_number": studentId,
            "roll_number": studentId,
            "name": full_name,
            "email": email,
            "address": address or (existing_student.get("address", "") if existing_student else ""),
            "status": existing_student.get("status", "active") if existing_student else "active",
            "avatar_url": avatar_url
        }

        if existing_student:
            supabase.table("students").update(student_payload).eq("id", student_id).execute()
        else:
            supabase.table("students").insert({"id": student_id, **student_payload}).execute()

        return {
            "status": "success",
            "message": f"Student {full_name} created/updated successfully",
            "student": {
                "id": student_id,
                "name": full_name,
                "studentId": studentId,
                "email": email,
                "contact": contact or (existing_user.get("phone") if existing_user else ""),
                "address": student_payload["address"],
                "status": student_payload["status"],
                "avatar": avatar_url
            }
        }
    except Exception as e:
        return {"status": "error", "message": str(e)}

@app.put("/students/{student_id}")
def update_student(
    student_id: str,
    firstName: str = Form(...),
    lastName: str = Form(...),
    studentId: str = Form(...),
    email: str = Form(...),
    contact: str = Form(None),
    address: str = Form(None),
    avatar: str = Form(None)
):
    """Update an existing student"""
    try:
        print(f"=== STUDENT UPDATE START ===")
        print(f"Student ID: {student_id}")
        print(f"First Name: {firstName}")
        print(f"Last Name: {lastName}")
        print(f"Student ID: {studentId}")
        print(f"Email: {email}")
        print(f"Contact: {contact}")
        print(f"Address: {address}")
        print(f"Avatar provided: {bool(avatar and avatar.strip())}")
        if avatar:
            print(f"Avatar length: {len(avatar)}")
            print(f"Avatar starts with: {avatar[:50]}...")
        print(f"=== STUDENT UPDATE START ===")
        
        full_name = f"{firstName} {lastName}".strip()
        
        # Update user record
        user_payload = {
            "full_name": full_name,
            "email": email
        }
        if contact:
            user_payload["phone"] = contact
            
        supabase.table("users").update(user_payload).eq("id", student_id).execute()
        
        # Handle avatar upload if provided
        avatar_url = None
        if avatar and avatar.strip():
            try:
                print(f"Processing avatar update for student {student_id}")
                avatar_url = upload_profile_image(avatar, student_id, "student")
                print(f"Avatar upload completed, URL: {avatar_url}")
            except Exception as e:
                print(f"Avatar upload failed during update: {e}")
                print(f"Avatar data length: {len(avatar) if avatar else 0}")
                # Continue without updating avatar if upload fails
        
        # Update student record
        student_payload = {
            "student_roll_number": studentId,
            "roll_number": studentId,
            "name": full_name,
            "email": email,
            "address": address or "",
            "status": "active"
        }
        
        # Add avatar URL to payload if it was uploaded
        if avatar_url:
            student_payload["avatar_url"] = avatar_url
        
        supabase.table("students").update(student_payload).eq("id", student_id).execute()
        
        print(f"=== STUDENT UPDATE SUCCESS ===")
        return {
            "status": "success", 
            "message": f"Student {full_name} updated successfully"
        }
    except Exception as e:
        print(f"=== STUDENT UPDATE ERROR ===")
        print(f"Error type: {type(e)}")
        print(f"Error message: {str(e)}")
        print(f"=== STUDENT UPDATE ERROR ===")
        return {"status": "error", "message": str(e)}

@app.delete("/students/{student_id}")
def delete_student(student_id: str):
    """Delete a student"""
    try:
        # Delete from students table (user will be cascade deleted due to foreign key)
        supabase.table("students").delete().eq("id", student_id).execute()
        return {"status": "success", "message": "Student deleted successfully"}
    except Exception as e:
        return {"status": "error", "message": str(e)}

@app.delete("/attendance/{attendance_id}")
def delete_attendance_record(attendance_id: str):
    """Delete an attendance record"""
    try:
        supabase.table("attendance").delete().eq("id", attendance_id).execute()
        return {"status": "success", "message": "Attendance record deleted successfully"}
    except Exception as e:
        return {"status": "error", "message": str(e)}

# -------------------------
# Subject Management Endpoints
# -------------------------
class SubjectCreate(BaseModel):
    name: str
    code: str
    description: Optional[str] = None


class SubjectUpdate(BaseModel):
    name: Optional[str] = None
    code: Optional[str] = None
    description: Optional[str] = None

@app.post("/subjects")
def create_subject(subject: SubjectCreate):
    """Create a new subject"""
    try:
        new_subject = {
            "name": subject.name,
            "code": subject.code,
            "description": subject.description
        }
        response = supabase.table("subjects").insert(new_subject).execute()
        return {"status": "success", "subject": response.data[0] if response.data else None}
    except Exception as e:
        return {"status": "error", "message": str(e)}

@app.get("/subjects")
def get_all_subjects():
    """Get all subjects"""
    try:
        response = supabase.table("subjects").select("*").execute()
        return {"status": "success", "subjects": response.data}
    except Exception as e:
        return {"status": "error", "message": str(e)}

@app.get("/subjects/{subject_id}")
def get_subject(subject_id: str):
    """Get a single subject"""
    try:
        response = supabase.table("subjects").select("*").eq("id", subject_id).execute()
        subject = response.data[0] if response.data else None
        if not subject:
            raise HTTPException(status_code=404, detail="Subject not found")
        return {"status": "success", "subject": subject}
    except HTTPException:
        raise
    except Exception as e:
        return {"status": "error", "message": str(e)}

@app.put("/subjects/{subject_id}")
def update_subject(subject_id: str, subject: SubjectUpdate):
    """Update a subject"""
    try:
        update_data = {}
        if subject.name:
            update_data["name"] = subject.name
        if subject.code:
            update_data["code"] = subject.code
        if subject.description:
            update_data["description"] = subject.description
        
        response = supabase.table("subjects").update(update_data).eq("id", subject_id).execute()
        return {"status": "success", "subject": response.data[0] if response.data else None}
    except Exception as e:
        return {"status": "error", "message": str(e)}

@app.delete("/subjects/{subject_id}")
def delete_subject(subject_id: str):
    """Delete a subject"""
    try:
        supabase.table("subjects").delete().eq("id", subject_id).execute()
        return {"status": "success", "message": "Subject deleted successfully"}
    except Exception as e:
        return {"status": "error", "message": str(e)}

@app.get("/subjects/{subject_id}/attendance")
def get_subject_attendance(subject_id: str):
    """Get attendance records and summary for a subject"""
    try:
        attendance_resp = (
            supabase.table("attendance")
            .select(
                """
                id,
                student_id,
                status,
                date,
                marked_at,
                subject_id,
                subject_code,
                liveness_score,
                liveness_passed,
                students:student_id (id, name, email)
                """
            )
            .eq("subject_id", subject_id)
            .order("marked_at", desc=True)
            .execute()
        )

        attendance_data = attendance_resp.data or []

        distinct_students = set()
        present_count = 0
        absent_count = 0

        enriched_records = []
        for row in attendance_data:
            student_info = row.get("students") or {}
            student_id = row.get("student_id") or student_info.get("id")
            if student_id:
                distinct_students.add(student_id)

            status_value = (row.get("status") or "").lower()
            if status_value == "present":
                present_count += 1
            elif status_value == "absent":
                absent_count += 1

            enriched_records.append(
                {
                    "id": row.get("id"),
                    "student_id": student_id,
                    "status": row.get("status"),
                    "date": row.get("date"),
                    "marked_at": row.get("marked_at"),
                    "subject_id": row.get("subject_id"),
                    "subject_code": row.get("subject_code"),
                    "liveness_score": row.get("liveness_score"),
                    "liveness_passed": row.get("liveness_passed"),
                    "student": {
                        "id": student_info.get("id"),
                        "name": student_info.get("name"),
                        "email": student_info.get("email"),
                    },
                }
            )

        summary = {
            "total_records": len(enriched_records),
            "distinct_students": len(distinct_students),
            "present": present_count,
            "absent": absent_count,
            "latest_marked_at": enriched_records[0]["marked_at"] if enriched_records else None,
        }

        return {
            "status": "success",
            "summary": summary,
            "records": enriched_records,
        }
    except Exception as e:
        return {"status": "error", "message": str(e)}

# -------------------------
# Teacher Management Endpoints
# -------------------------
@app.get("/teachers")
def get_all_teachers():
    """Get all teachers with their details"""
    try:
        # Get teachers with user details
        teachers_resp = supabase.table("teachers").select("""
            id,
            teacher_code,
            department,
            avatar_url,
            created_at,
            users!inner(full_name, email, phone)
        """).execute()
        
        teachers = []
        for teacher in (teachers_resp.data or []):
            # Combine teacher and user data
            user_data = teacher.get("users", {})
            teachers.append({
                "id": teacher["id"],
                "name": user_data.get("full_name", ""),
                "teacherId": teacher.get("teacher_code", ""),
                "email": user_data.get("email", ""),
                "phone": user_data.get("phone", ""),
                "subject": teacher.get("department", ""),
                "status": "active",  # Default status
                "avatar": teacher.get("avatar_url") or f"https://picsum.photos/seed/{teacher['id']}/100/100",
                "created_at": teacher.get("created_at")
            })
        
        return {"status": "success", "teachers": teachers}
    except Exception as e:
        return {"status": "error", "message": str(e)}

@app.post("/teachers")
def create_teacher(
    name: str = Form(...),
    teacherId: str = Form(...),
    email: str = Form(...),
    subject: str = Form(...),
    phone: str = Form(None),
    avatar: str = Form(None)
):
    """Create a new teacher"""
    try:
        # Create user first
        user_payload = {
            "full_name": name,
            "email": email,
            "role": "teacher"
        }
        if phone:
            user_payload["phone"] = phone
            
        user_resp = supabase.table("users").insert(user_payload).execute()
        if not user_resp.data:
            raise RuntimeError("Failed to create user")
        
        user_id = user_resp.data[0]["id"]
        
        # Handle avatar upload if provided
        avatar_url = f"https://picsum.photos/seed/{user_id}/100/100"  # Default placeholder
        if avatar and avatar.strip():
            try:
                avatar_url = upload_profile_image(avatar, user_id, "teacher")
            except Exception as e:
                print(f"Avatar upload failed: {e}")
                # Continue with placeholder if upload fails
        
        # Create teacher record
        teacher_payload = {
            "id": user_id,
            "teacher_code": teacherId,
            "department": subject,
            "avatar_url": avatar_url
        }
        
        teacher_resp = supabase.table("teachers").insert(teacher_payload).execute()
        if not teacher_resp.data:
            raise RuntimeError("Failed to create teacher")
        
        return {
            "status": "success", 
            "message": f"Teacher {name} created successfully",
            "teacher": {
                "id": user_id,
                "name": name,
                "teacherId": teacherId,
                "email": email,
                "phone": phone or "",
                "subject": subject,
                "status": "active",
                "avatar": avatar_url
            }
        }
    except Exception as e:
        return {"status": "error", "message": str(e)}

@app.put("/teachers/{teacher_id}")
def update_teacher(
    teacher_id: str,
    name: str = Form(...),
    teacherId: str = Form(...),
    email: str = Form(...),
    subject: str = Form(...),
    phone: str = Form(None),
    avatar: str = Form(None)
):
    """Update an existing teacher"""
    try:
        print(f"=== TEACHER UPDATE START ===")
        print(f"Teacher ID: {teacher_id}")
        print(f"Name: {name}")
        print(f"Teacher Code: {teacherId}")
        print(f"Email: {email}")
        print(f"Subject: {subject}")
        print(f"Phone: {phone}")
        print(f"Avatar provided: {bool(avatar and avatar.strip())}")
        if avatar:
            print(f"Avatar length: {len(avatar)}")
            print(f"Avatar starts with: {avatar[:50]}...")
        print(f"=== TEACHER UPDATE START ===")
        
        # Update user record
        user_payload = {
            "full_name": name,
            "email": email
        }
        if phone:
            user_payload["phone"] = phone
            
        supabase.table("users").update(user_payload).eq("id", teacher_id).execute()
        
        # Handle avatar upload if provided
        avatar_url = None
        if avatar and avatar.strip():
            try:
                print(f"Processing avatar update for teacher {teacher_id}")
                avatar_url = upload_profile_image(avatar, teacher_id, "teacher")
                print(f"Avatar upload completed, URL: {avatar_url}")
            except Exception as e:
                print(f"Avatar upload failed during update: {e}")
                print(f"Avatar data length: {len(avatar) if avatar else 0}")
                # Continue without updating avatar if upload fails
        
        # Update teacher record
        teacher_payload = {
            "teacher_code": teacherId,
            "department": subject
        }
        
        # Add avatar URL to payload if it was uploaded
        if avatar_url:
            teacher_payload["avatar_url"] = avatar_url
        
        supabase.table("teachers").update(teacher_payload).eq("id", teacher_id).execute()
        
        print(f"=== TEACHER UPDATE SUCCESS ===")
        return {
            "status": "success", 
            "message": f"Teacher {name} updated successfully"
        }
    except Exception as e:
        print(f"=== TEACHER UPDATE ERROR ===")
        print(f"Error type: {type(e)}")
        print(f"Error message: {str(e)}")
        print(f"=== TEACHER UPDATE ERROR ===")
        return {"status": "error", "message": str(e)}

@app.delete("/teachers/{teacher_id}")
def delete_teacher(teacher_id: str):
    """Delete a teacher"""
    try:
        # Delete from teachers table (user will be cascade deleted due to foreign key)
        supabase.table("teachers").delete().eq("id", teacher_id).execute()
        return {"status": "success", "message": "Teacher deleted successfully"}
    except Exception as e:
        return {"status": "error", "message": str(e)}


# -------------------------
# Attendance Alert Endpoints
# -------------------------
@app.post("/attendance/check-alerts")
def check_attendance_alerts(threshold: float = 75.0, include_no_records: bool = False):
    """
    Check all students' attendance and send email alerts to those below threshold.
    This can be called manually or scheduled to run daily.
    
    Args:
        threshold: Attendance percentage threshold (default 75.0)
        include_no_records: If True, include students with no attendance records (treated as 0%)
    """
    try:
        # Get all students
        students_resp = supabase.table("students").select("id, name, email").execute()
        students = students_resp.data or []
        
        if not students:
            return {
                "status": "success",
                "message": "No students found",
                "alerts_sent": 0
            }
        
        alerts_sent = 0
        students_checked = 0
        low_attendance_students = []
        
        print(f"📊 Checking attendance for {len(students)} students (threshold: {threshold}%)")
        
        for student in students:
            student_id = student.get("id")
            student_name = student.get("name", "Unknown")
            
            try:
                # Check and send alert if needed
                alert_sent, pct = check_and_record_low_attendance(
                    student_id=student_id,
                    threshold=threshold,
                    send_email_alert=True,
                    include_no_records=include_no_records
                )
                
                students_checked += 1
                
                if alert_sent:
                    alerts_sent += 1
                    low_attendance_students.append({
                        "student_id": student_id,
                        "name": student_name,
                        "attendance_percentage": round(pct, 2) if pct else None
                    })
                    print(f"⚠️ Alert sent to {student_name} ({pct:.1f}%)")
                elif pct is not None and pct < threshold:
                    print(f"ℹ️ {student_name} has low attendance ({pct:.1f}%) but alert already sent today")
                
            except Exception as e:
                print(f"❌ Error checking student {student_name}: {e}")
                continue
        
        return {
            "status": "success",
            "message": f"Checked {students_checked} students, sent {alerts_sent} new alerts",
            "students_checked": students_checked,
            "alerts_sent": alerts_sent,
            "low_attendance_students": low_attendance_students,
            "threshold": threshold
        }
        
    except Exception as e:
        print(f"❌ Error in check_attendance_alerts: {e}")
        return {"status": "error", "message": str(e)}


@app.get("/attendance/alerts")
def get_attendance_alerts(days: int = 7):
    """Get attendance alerts from the last N days"""
    try:
        from datetime import datetime, timedelta
        
        # Calculate date N days ago
        start_date = (datetime.now() - timedelta(days=days)).date().isoformat()
        
        # Get alerts with student details
        alerts_resp = (
            supabase.table("attendance_alerts")
            .select("""
                id,
                student_id,
                alert_date,
                students:student_id (id, name, email)
            """)
            .gte("alert_date", start_date)
            .order("alert_date", desc=True)
            .execute()
        )
        
        alerts = []
        for row in (alerts_resp.data or []):
            student_info = row.get("students") or {}
            
            alerts.append({
                "id": row.get("id"),
                "student_id": row.get("student_id"),
                "student_name": student_info.get("name"),
                "student_email": student_info.get("email"),
                "alert_date": row.get("alert_date")
            })
        
        return {
            "status": "success",
            "alerts": alerts,
            "total": len(alerts),
            "days": days
        }
        
    except Exception as e:
        print(f"❌ Error getting alerts: {e}")
        return {"status": "error", "message": str(e)}


@app.post("/students/{student_id}/send-alert")
def send_alert_to_student(student_id: str):
    """Manually send low attendance alert to a specific student"""
    try:
        # Get student details
        student_resp = supabase.table("students").select("id, name, email").eq("id", student_id).execute()
        
        if not student_resp.data:
            return {"status": "error", "message": "Student not found"}
        
        student = student_resp.data[0]
        student_name = student.get("name", "Student")
        student_email = student.get("email")
        
        if not student_email:
            return {"status": "error", "message": f"No email found for student {student_name}"}
        
        # Calculate attendance percentage
        pct = attendance_percentage(student_id)
        
        # If no attendance records, use 0% for the alert
        if pct is None:
            pct = 0.0
            print(f"⚠️ No attendance records for {student_name}, using 0% for alert")
        
        # Send email regardless of threshold (manual override)
        from email_utils import send_low_attendance_alert
        
        print(f"📧 Manually sending alert to {student_name} ({student_email}) - Attendance: {pct:.1f}%")
        
        email_sent = send_low_attendance_alert(
            student_email=student_email,
            student_name=student_name,
            attendance_percentage=pct
        )
        
        if email_sent:
            # Record alert
            from datetime import date
            today = date.today().isoformat()
            
            # Check if alert already sent today
            existing = supabase.table("attendance_alerts").select("id")\
                .eq("student_id", student_id)\
                .eq("alert_date", today)\
                .eq("alert_type", "low_attendance_email").execute()
            
            if not existing.data:
                supabase.table("attendance_alerts").insert({
                    "student_id": student_id,
                    "alert_date": today,
                    "alert_type": "low_attendance_email"
                }).execute()
            
            return {
                "status": "success",
                "message": f"Alert email sent to {student_name}",
                "student_name": student_name,
                "student_email": student_email,
                "attendance_percentage": round(pct, 2)
            }
        else:
            return {
                "status": "error",
                "message": f"Failed to send email to {student_name}",
                "student_email": student_email
            }
        
    except Exception as e:
        print(f"❌ Error sending manual alert: {e}")
        import traceback
        traceback.print_exc()
        return {"status": "error", "message": str(e)}


@app.get("/students/{student_id}/attendance-summary")
def get_student_attendance_summary(student_id: str):
    """Get detailed attendance summary for a specific student"""
    try:
        # Get student details
        student_resp = supabase.table("students").select("id, name, email").eq("id", student_id).execute()
        
        if not student_resp.data:
            return {"status": "error", "message": "Student not found"}
        
        student = student_resp.data[0]
        
        # Calculate attendance percentage
        pct = attendance_percentage(student_id)
        
        # Get attendance records
        attendance_resp = (
            supabase.table("attendance")
            .select("id, date, status, subject_id")
            .eq("student_id", student_id)
            .order("date", desc=True)
            .execute()
        )
        
        records = attendance_resp.data or []
        total_classes = len(records)
        present_count = sum(1 for r in records if r.get("status") == "present")
        absent_count = sum(1 for r in records if r.get("status") == "absent")
        
        # Check if below threshold
        is_below_threshold = pct is not None and pct < 75.0
        
        # Get recent alerts
        alerts_resp = (
            supabase.table("attendance_alerts")
            .select("alert_date")
            .eq("student_id", student_id)
            .order("alert_date", desc=True)
            .limit(5)
            .execute()
        )
        
        return {
            "status": "success",
            "student": {
                "id": student.get("id"),
                "name": student.get("name"),
                "email": student.get("email")
            },
            "attendance": {
                "percentage": round(pct, 2) if pct else 0,
                "total_classes": total_classes,
                "present": present_count,
                "absent": absent_count,
                "is_below_threshold": is_below_threshold,
                "threshold": 75.0
            },
            "recent_alerts": alerts_resp.data or [],
            "recent_records": records[:10]  # Last 10 records
        }
        
    except Exception as e:
        print(f"❌ Error getting student summary: {e}")
        return {"status": "error", "message": str(e)}


# -------------------------
# Reports Endpoints
# -------------------------
@app.get("/reports/overview")
def get_reports_overview():
    """Get comprehensive overview for reports dashboard"""
    try:
        from datetime import datetime, timedelta
        
        # Get all students with attendance data
        students_resp = supabase.table("students").select("id, name, email, student_roll_number").execute()
        students = students_resp.data or []
        
        # Get all attendance records
        attendance_resp = supabase.table("attendance").select("*").execute()
        attendance_records = attendance_resp.data or []
        
        # Calculate statistics
        total_students = len(students)
        total_attendance_records = len(attendance_records)
        
        # Calculate present/absent counts
        present_count = sum(1 for r in attendance_records if r.get("status") == "present")
        absent_count = sum(1 for r in attendance_records if r.get("status") == "absent")
        late_count = sum(1 for r in attendance_records if r.get("status") == "late")
        
        # Calculate overall attendance percentage
        overall_percentage = (present_count / total_attendance_records * 100) if total_attendance_records > 0 else 0
        
        # Get attendance by date (last 30 days)
        today = datetime.now().date()
        thirty_days_ago = today - timedelta(days=30)
        
        daily_attendance = {}
        for record in attendance_records:
            record_date = record.get("date")
            if record_date:
                if record_date not in daily_attendance:
                    daily_attendance[record_date] = {"present": 0, "absent": 0, "late": 0, "total": 0}
                
                status = record.get("status", "").lower()
                daily_attendance[record_date]["total"] += 1
                if status == "present":
                    daily_attendance[record_date]["present"] += 1
                elif status == "absent":
                    daily_attendance[record_date]["absent"] += 1
                elif status == "late":
                    daily_attendance[record_date]["late"] += 1
        
        # Sort by date
        daily_stats = [
            {
                "date": date,
                "present": stats["present"],
                "absent": stats["absent"],
                "late": stats["late"],
                "total": stats["total"],
                "percentage": round((stats["present"] / stats["total"] * 100) if stats["total"] > 0 else 0, 2)
            }
            for date, stats in sorted(daily_attendance.items())
        ]
        
        # Calculate per-student statistics
        student_stats = []
        for student in students:
            student_id = student.get("id")
            student_records = [r for r in attendance_records if r.get("student_id") == student_id]
            
            total = len(student_records)
            present = sum(1 for r in student_records if r.get("status") == "present")
            absent = sum(1 for r in student_records if r.get("status") == "absent")
            late = sum(1 for r in student_records if r.get("status") == "late")
            
            percentage = (present / total * 100) if total > 0 else 0
            
            student_stats.append({
                "id": student_id,
                "name": student.get("name", "Unknown"),
                "roll_number": student.get("student_roll_number", "N/A"),
                "email": student.get("email", ""),
                "total_classes": total,
                "present": present,
                "absent": absent,
                "late": late,
                "percentage": round(percentage, 2),
                "status": "good" if percentage >= 75 else "warning" if percentage >= 60 else "critical"
            })
        
        # Sort by percentage (lowest first for attention)
        student_stats.sort(key=lambda x: x["percentage"])
        
        # Get alerts summary
        alerts_resp = supabase.table("attendance_alerts").select("*").execute()
        alerts = alerts_resp.data or []
        
        # Count alerts by date
        alerts_by_date = {}
        for alert in alerts:
            alert_date = alert.get("alert_date")
            if alert_date:
                alerts_by_date[alert_date] = alerts_by_date.get(alert_date, 0) + 1
        
        return {
            "status": "success",
            "summary": {
                "total_students": total_students,
                "total_records": total_attendance_records,
                "overall_percentage": round(overall_percentage, 2),
                "present_count": present_count,
                "absent_count": absent_count,
                "late_count": late_count,
                "total_alerts": len(alerts)
            },
            "daily_attendance": daily_stats[-30:],  # Last 30 days
            "student_statistics": student_stats,
            "low_attendance_students": [s for s in student_stats if s["percentage"] < 75],
            "alerts_summary": [
                {"date": date, "count": count}
                for date, count in sorted(alerts_by_date.items())
            ]
        }
        
    except Exception as e:
        print(f"❌ Error generating reports overview: {e}")
        import traceback
        traceback.print_exc()
        return {"status": "error", "message": str(e)}


@app.get("/reports/student/{student_id}")
def get_student_report(student_id: str):
    """Get detailed report for a specific student"""
    try:
        # Get student details
        student_resp = supabase.table("students").select("id, name, email, student_roll_number, address, avatar_url").eq("id", student_id).execute()
        
        if not student_resp.data:
            return {"status": "error", "message": "Student not found"}
        
        student = student_resp.data[0]
        
        # Get all attendance records for this student
        attendance_resp = supabase.table("attendance").select("*").eq("student_id", student_id).order("date", desc=True).execute()
        records = attendance_resp.data or []
        
        # Calculate statistics
        total = len(records)
        present = sum(1 for r in records if r.get("status") == "present")
        absent = sum(1 for r in records if r.get("status") == "absent")
        late = sum(1 for r in records if r.get("status") == "late")
        
        percentage = (present / total * 100) if total > 0 else 0
        
        # Get attendance by month
        monthly_stats = {}
        for record in records:
            date_str = record.get("date")
            if date_str:
                # Extract year-month
                month_key = date_str[:7]  # YYYY-MM
                if month_key not in monthly_stats:
                    monthly_stats[month_key] = {"present": 0, "absent": 0, "late": 0, "total": 0}
                
                monthly_stats[month_key]["total"] += 1
                status = record.get("status", "").lower()
                if status == "present":
                    monthly_stats[month_key]["present"] += 1
                elif status == "absent":
                    monthly_stats[month_key]["absent"] += 1
                elif status == "late":
                    monthly_stats[month_key]["late"] += 1
        
        monthly_data = [
            {
                "month": month,
                "present": stats["present"],
                "absent": stats["absent"],
                "late": stats["late"],
                "total": stats["total"],
                "percentage": round((stats["present"] / stats["total"] * 100) if stats["total"] > 0 else 0, 2)
            }
            for month, stats in sorted(monthly_stats.items())
        ]
        
        # Get alerts for this student
        alerts_resp = supabase.table("attendance_alerts").select("*").eq("student_id", student_id).order("alert_date", desc=True).execute()
        alerts = alerts_resp.data or []
        
        return {
            "status": "success",
            "student": {
                "id": student.get("id"),
                "name": student.get("name"),
                "roll_number": student.get("student_roll_number"),
                "email": student.get("email"),
                "address": student.get("address"),
                "avatar_url": student.get("avatar_url")
            },
            "attendance_summary": {
                "total_classes": total,
                "present": present,
                "absent": absent,
                "late": late,
                "percentage": round(percentage, 2),
                "status": "good" if percentage >= 75 else "warning" if percentage >= 60 else "critical"
            },
            "monthly_attendance": monthly_data,
            "recent_records": records[:20],  # Last 20 records
            "alerts": alerts
        }
        
    except Exception as e:
        print(f"❌ Error generating student report: {e}")
        import traceback
        traceback.print_exc()
        return {"status": "error", "message": str(e)}