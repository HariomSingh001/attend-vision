import os
import time
import sys
import tempfile
import torch
from deepface import DeepFace
from datetime import datetime
from supabase import create_client, Client
import cv2
# from sklearn.neighbors import KNeighborsClassifier
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


# LIVENESS_THRESHOLD = float(os.getenv("LIVENESS_THRESHOLD", "0.4"))
# LIVENESS_EDGE_DIVISOR = float(os.getenv("LIVENESS_EDGE_DIVISOR", "350.0"))
# LIVENESS_CONTRAST_DIVISOR = float(os.getenv("LIVENESS_CONTRAST_DIVISOR", "80.0"))
# SPOOF_ALERT_TABLE = os.getenv("SPOOF_ALERT_TABLE", "attendance_alerts")

# IDENTITY_DISTANCE_SCALE = float(os.getenv("IDENTITY_DISTANCE_SCALE", "1.6"))
# IDENTITY_REQUIRED_SIGHTINGS = int(os.getenv("IDENTITY_REQUIRED_SIGHTINGS", "2"))
# IDENTITY_WINDOW_SECONDS = float(os.getenv("IDENTITY_WINDOW_SECONDS", "8"))

# --- 2. SETUP LIVENESS MODEL (SilentFace) ---
LIVENESS_REPO_PATH = 'anti_spoofing'
sys.path.append(LIVENESS_REPO_PATH)
try:
    from anti_spoofing.src.anti_spoof_predict import AntiSpoofPredict
except ImportError:
    print(f"Error: Could not import AntiSpoofPredict. Check path: {LIVENESS_REPO_PATH}")
    sys.exit(1)

print("Loading models, please wait...")

# # Confidence calculation constants
# IDENTITY_CONFIDENCE_THRESHOLD = float(os.getenv("IDENTITY_CONFIDENCE_THRESHOLD", "0.65"))
# IDENTITY_CONFIDENCE_DECAY = float(os.getenv("IDENTITY_CONFIDENCE_DECAY", "0.05"))
# IDENTITY_CONFIDENCE_MIN = float(os.getenv("IDENTITY_CONFIDENCE_MIN", "0.4"))
# # CRITICAL: Face recognition thresholds - tuned for accuracy
# MIN_CONFIDENCE = float(os.getenv("FACE_MIN_CONFIDENCE", "0.85"))  # Require VERY high confidence (was 0.70)
# MIN_CONFIDENCE_MARGIN = float(os.getenv("FACE_MIN_CONFIDENCE_MARGIN", "0.20"))  # Strong margin between candidates (was 0.10)
MIN_FACE_SIZE = int(os.getenv("MIN_FACE_SIZE", "80"))  # Larger minimum face size for better quality (was 60)
BLUR_THRESHOLD = float(os.getenv("BLUR_THRESHOLD", "30.0"))  # More lenient blur detection for webcam (was 100.0)
MAX_FACE_SIZE = int(os.getenv("MAX_FACE_SIZE", "1200"))  # Allow much larger faces for smartphone photos (was 400)
# MIN_SAMPLES_PER_STUDENT = int(os.getenv("MIN_SAMPLES_PER_STUDENT", "10"))  # Minimum training samples required

# --- 4. DEFINE GLOBAL CONSTANTS ---
# AI Constants
FACE_MODEL_NAME = "ArcFace"
RECOGNITION_THRESHOLD = 0.50  # 50% similarity - Lowered to debug matching issues
LIVENESS_THRESHOLD = 0.5      # 50% - Balanced threshold for real webcam feeds (real faces typically score 0.5-0.7)

SPOOF_ALERT_TABLE = os.getenv("SPOOF_ALERT_TABLE", "attendance_alerts")

# --- 3. HELPER FUNCTIONS ---
def expand_bbox(x, y, w, h, scale=1.3, img_w=0, img_h=0):
    """Expand bounding box by scale factor for better liveness detection"""
    new_w = int(w * scale)
    new_h = int(h * scale)
    new_x = max(x - (new_w - w) // 2, 0)
    new_y = max(y - (new_h - h) // 2, 0)
    new_w = min(new_w, img_w - new_x)
    new_h = min(new_h, img_h - new_y)
    return new_x, new_y, new_w, new_h

# --- 4. INITIALIZE MODELS ---
# Load face detector (Haar Cascade)
CASCADE_PATH = cv2.data.haarcascades + 'haarcascade_frontalface_default.xml'
facedetect = cv2.CascadeClassifier(CASCADE_PATH)
# recent_recognitions: Dict[str, Dict[str, Any]] = {}

# Auto-detect GPU (for Colab) or CPU (for local)
DEVICE_ID = 0 if torch.cuda.is_available() else 'cpu'
print(f"Using device: {DEVICE_ID}")


# Load Liveness Model
try:
    LIVENESS_MODEL_PATH = os.path.join(LIVENESS_REPO_PATH, 'resources', 'anti_spoof_models', '2.7_80x80_MiniFASNetV2.pth')
    
    if not os.path.exists(LIVENESS_MODEL_PATH):
        print(f"FATAL: Liveness model not found at {LIVENESS_MODEL_PATH}")
        liveness_detector = None
    else:
        liveness_detector = AntiSpoofPredict(device_id=DEVICE_ID)
        print("✅ Liveness Detector loaded.")
except Exception as e:
    print(f"❌ Failed to load Liveness Detector: {e}")
    liveness_detector = None


def record_spoof_alert(
    student_id: Optional[str],
    student_name: Optional[str],
    liveness_score: float,
    reason: str,
    subject_id: Optional[str] = None,
    subject_code: Optional[str] = None
) -> None:
    """Persist spoof attempts for auditing."""
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
        print(f"Logged spoof alert: {reason}")
    except Exception as alert_error:
        print(f"Warning: failed to record spoof alert: {alert_error}")


# def should_confirm_identity(student_id: Optional[str], subject_id: Optional[str], confidence: float) -> bool:
#     """Require consistent, high-confidence sightings before marking attendance."""
#     if not student_id:
#         return False

#     key_subject = subject_id or "global"
#     key = f"{student_id}:{key_subject}"
#     now = time.time()

#     # Drop stale entries
#     entry = recent_recognitions.get(key)
#     if entry and now - entry.get("first_seen", now) > IDENTITY_WINDOW_SECONDS:
#         recent_recognitions.pop(key, None)
#         entry = None

#     if confidence < IDENTITY_CONFIDENCE_THRESHOLD:
#         if key in recent_recognitions:
#             recent_recognitions.pop(key, None)
#         return False

#     if not entry:
#         recent_recognitions[key] = {"count": 1, "first_seen": now}
#         print(f"Identity buffer started for {student_id} (confidence={confidence:.3f})")
#         return False

#     entry["count"] = entry.get("count", 0) + 1
#     entry["first_seen"] = entry.get("first_seen", now)
#     recent_recognitions[key] = entry

#     confirmed = entry["count"] >= IDENTITY_REQUIRED_SIGHTINGS
#     if confirmed:
#         recent_recognitions.pop(key, None)
#         print(f"Identity confirmed for {student_id} after {entry['count']} sightings")
#     else:
#         print(f"Identity buffer for {student_id}: {entry['count']} / {IDENTITY_REQUIRED_SIGHTINGS}")
#     return confirmed

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

@app.post("/register-face/")
async def register_face(
    student_id: str = Form(...), 
    file: UploadFile = File(...),
    skip_liveness: bool = Form(True)  # Skip liveness for registration by default
):
    """
    Receives ONE image of a student, optionally verifies it's real (liveness),
    generates a DeepFace/ArcFace embedding, and stores it in Supabase pgvector.
    
    Args:
        skip_liveness: If True, skips liveness detection (recommended for uploaded photos).
                      Set to False only if registering from live camera feed.
    """
    if liveness_detector is None:
        raise HTTPException(status_code=500, detail="Liveness detector is not loaded.")

    contents = await file.read()
    nparr = np.frombuffer(contents, np.uint8)
    img_np = cv2.imdecode(nparr, cv2.IMREAD_COLOR)
    if img_np is None:
        raise HTTPException(status_code=400, detail="Invalid image file.")

    try:
        # Pre-filtering
        gray = cv2.cvtColor(img_np, cv2.COLOR_BGR2GRAY)
        faces = facedetect.detectMultiScale(gray, 1.3, 5, minSize=(MIN_FACE_SIZE, MIN_FACE_SIZE))
        if len(faces) == 0:
            raise HTTPException(status_code=400, detail="No face detected in image.")

        (x, y, w, h) = faces[0] # Take the first and best face
        
        # Expand bbox and crop for liveness detection
        img_h, img_w = img_np.shape[:2]
        x2, y2, w2, h2 = expand_bbox(x, y, w, h, scale=1.35, img_w=img_w, img_h=img_h)
        face_crop_expanded = img_np[y2:y2+h2, x2:x2+w2, :]
        face_crop_resized = cv2.resize(face_crop_expanded, (80, 80))

        # Liveness Check (optional for registration)
        if not skip_liveness:
            prediction = liveness_detector.predict(face_crop_resized, LIVENESS_MODEL_PATH)
            real_score = prediction[0][1] # Probability of "Real"

            if real_score < LIVENESS_THRESHOLD:
                raise HTTPException(status_code=400, detail=f"Spoof detected. Liveness check failed (Score: {real_score:.2f}). Please use a live, well-lit photo.")
            print(f"✅ Liveness passed (score: {real_score:.2f})")
        else:
            print(f"⏭️ Liveness check skipped (registration mode)")

        # Liveness passed, generate embedding
        face_crop = img_np[y:y+h, x:x+w]
        embedding = DeepFace.represent(
            img_path=face_crop, 
            model_name=FACE_MODEL_NAME, 
            enforce_detection=False, # We already found the face
            detector_backend='skip'
        )[0]["embedding"]

        # Store in Supabase
        data_to_insert = {"student_id": student_id, "embedding": embedding}
        response = supabase.table("faces").insert(data_to_insert).execute()

        if response.data:
            return {"status": "success", "message": f"Face for student {student_id} registered."}
        else:
            raise HTTPException(status_code=500, detail=f"Supabase error: {str(response.error)}")

    except Exception as e:
        return HTTPException(status_code=500, detail=f"An error occurred: {str(e)}")
    
@app.post("/recognize_frame")
async def recognize_frame(frame: UploadFile = File(...), subject_id: str = Form(None)):
    """
    This is the new SOTA pipeline.
    1. Detects faces
    2. Runs Liveness Check on each face
    3. If real, runs ArcFace Recognition
    4. Matches against `pgvector` database ("match_face" RPC)
    5. Marks attendance
    """
    print(f"\n{'='*60}")
    print(f"🎥 RECOGNIZE_FRAME ENDPOINT CALLED")
    print(f"   Frame: {frame.filename if frame else 'None'}")
    print(f"   Subject ID: {subject_id}")
    print(f"{'='*60}\n")
    
    if liveness_detector is None:
        print("❌ ERROR: Liveness detector is not loaded!")
        raise HTTPException(status_code=500, detail="Liveness detector is not loaded.")

    subject_code = None
    if subject_id:
        try:
            subject_resp = supabase.table("subjects").select("code").eq("id", subject_id).execute()
            if subject_resp.data:
                subject_code = subject_resp.data[0].get("code")
        except Exception as e:
            print(f"Warn: Could not fetch subject code: {e}")

    contents = await frame.read()
    print(f"📥 Received frame: {len(contents)} bytes")
    
    npimg = np.frombuffer(contents, np.uint8)
    img = cv2.imdecode(npimg, cv2.IMREAD_COLOR)
    
    if img is None:
        print("❌ Failed to decode image")
        raise HTTPException(status_code=400, detail="Invalid image data")
    
    print(f"✅ Image decoded: {img.shape[1]}x{img.shape[0]} pixels")

    gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)
    faces_detected = facedetect.detectMultiScale(gray, 1.3, 5, minSize=(MIN_FACE_SIZE, MIN_FACE_SIZE))

    print(f"🔍 Face detection result: {len(faces_detected)} faces detected (minSize={MIN_FACE_SIZE})")
    
    if len(faces_detected) == 0:
        print("❌ No faces detected - trying with more lenient parameters...")
        # Try again with more lenient parameters
        faces_detected = facedetect.detectMultiScale(gray, 1.1, 3, minSize=(60, 60))
        print(f"🔍 Second attempt: {len(faces_detected)} faces detected")
        
        if len(faces_detected) == 0:
            return {"status": "no_face", "faces": [], "message": "No faces detected."}

    results = []

    for (x, y, w, h) in faces_detected:
        try:
            # Extract face crop first
            face_crop = img[y:y+h, x:x+w, :]
            
            # --- STAGE 2: PRE-FILTERING (Blur/Size) ---
            if w > MAX_FACE_SIZE or h > MAX_FACE_SIZE:
                print(f"Skipping too large face: {w}x{h}")
                continue
            
            # --- STAGE 1: LIVENESS GATEKEEPER (FIXED) ---
            # Expand bounding box for better liveness detection (SilentFace requirement)
            img_h, img_w = img.shape[:2]
            x2, y2, w2, h2 = expand_bbox(x, y, w, h, scale=1.35, img_w=img_w, img_h=img_h)
            
            print(f"🔍 Original bbox: [{x}, {y}, {w}, {h}] → Expanded: [{x2}, {y2}, {w2}, {h2}]")
            
            # Crop the expanded region for liveness detection
            face_crop_expanded = img[y2:y2+h2, x2:x2+w2, :]
            
            # Resize to 80x80 for MiniFASNet model
            face_crop_resized = cv2.resize(face_crop_expanded, (80, 80))
            
            # Run liveness detection
            prediction = liveness_detector.predict(face_crop_resized, LIVENESS_MODEL_PATH)
            real_score = prediction[0][1]  # Probability of "Real" (index 1)
            
            print(f"🔍 Liveness score: {real_score:.3f} (threshold: {LIVENESS_THRESHOLD})")

            if real_score < LIVENESS_THRESHOLD:
                print(f"⛔ SPOOF DETECTED at [{x}, {y}]. Score: {real_score:.3f} < {LIVENESS_THRESHOLD}. Skipping.")
                results.append({
                    "name": "SPOOF", 
                    "liveness_passed": False, 
                    "x": int(x), "y": int(y), "w": int(w), "h": int(h),
                    "liveness_score": float(real_score)
                })
                record_spoof_alert(
                    student_id=None, student_name="Unknown (Spoof Attempt)", 
                    liveness_score=float(real_score), reason="low_liveness_score", 
                    subject_id=subject_id, subject_code=subject_code
                )
                continue
            
            print(f"✅ Liveness PASSED at [{x}, {y}]. Score: {real_score:.3f}")
            
            gray_crop = cv2.cvtColor(face_crop, cv2.COLOR_BGR2GRAY)
            laplacian_var = cv2.Laplacian(gray_crop, cv2.CV_64F).var()
            if laplacian_var < BLUR_THRESHOLD:
                print(f"Skipping blurry face: {laplacian_var:.2f}")
                continue

            # --- STAGE 3: RECOGNITION (ArcFace) ---
            print(f"🔍 Starting face recognition...")
            
            # Save face crop to temporary file for DeepFace (it requires file path)
            with tempfile.NamedTemporaryFile(suffix='.jpg', delete=False) as tmp_file:
                cv2.imwrite(tmp_file.name, face_crop)
                temp_path = tmp_file.name
            
            try:
                embedding = DeepFace.represent(
                    img_path=temp_path, model_name=FACE_MODEL_NAME, 
                    enforce_detection=False, detector_backend='skip'
                )[0]["embedding"]
                print(f"✅ Embedding generated (length: {len(embedding)})")
            finally:
                # Clean up temp file
                if os.path.exists(temp_path):
                    os.remove(temp_path)

            # --- STAGE 4: DATABASE MATCH (pgvector) ---
            print(f"🔍 Searching database for match (threshold: {RECOGNITION_THRESHOLD})...")
            
            # Try RPC function first
            try:
                match_params = {
                    "query_embedding": embedding,
                    "match_threshold": RECOGNITION_THRESHOLD, 
                    "match_count": 5  # Get top 5 matches for debugging
                }
                match_response = supabase.rpc("match_face", match_params).execute()
                
                print(f"📊 RPC returned {len(match_response.data) if match_response.data else 0} matches")
                if match_response.data:
                    for i, match in enumerate(match_response.data[:3]):
                        print(f"   Match {i+1}: {match.get('student_name', 'Unknown')} - Similarity: {match.get('similarity', 0):.3f}")
            except Exception as rpc_error:
                print(f"⚠️ RPC function failed: {rpc_error}")
                print(f"🔄 Falling back to direct query...")
                
                # Fallback: Get all faces and compute similarity manually
                faces_response = supabase.table("faces").select("id, student_id, embedding").execute()
                students_response = supabase.table("students").select("id, name").execute()
                
                student_map = {s["id"]: s.get("name", "Unknown") for s in (students_response.data or [])}
                
                # Compute cosine similarity manually
                from numpy.linalg import norm
                matches = []
                for face in (faces_response.data or []):
                    db_embedding = np.array(face["embedding"])
                    query_embedding = np.array(embedding)
                    
                    # Cosine similarity
                    similarity = np.dot(query_embedding, db_embedding) / (norm(query_embedding) * norm(db_embedding))
                    
                    if similarity >= RECOGNITION_THRESHOLD:
                        matches.append({
                            "student_id": face["student_id"],
                            "student_name": student_map.get(face["student_id"], "Unknown"),
                            "similarity": float(similarity)
                        })
                
                matches.sort(key=lambda x: x["similarity"], reverse=True)
                match_response.data = matches[:5]
                
                print(f"📊 Manual search returned {len(matches)} matches")
                if matches:
                    for i, match in enumerate(matches[:3]):
                        print(f"   Match {i+1}: {match['student_name']} - Similarity: {match['similarity']:.3f}")

            if not match_response.data:
                print(f"❌ No match found above threshold {RECOGNITION_THRESHOLD}")
                results.append({"name": "Unknown", "liveness_passed": True, "x": int(x), "y": int(y), "w": int(w), "h": int(h)})
                continue

            # --- STAGE 5: SUCCESS ---
            match = match_response.data[0]
            student_id = match["student_id"]
            student_name = match["student_name"]
            similarity = match["similarity"]

            results.append({
                "name": student_name, "student_id": student_id, "confidence": round(similarity, 3),
                "x": int(x), "y": int(y), "w": int(w), "h": int(h),
                "liveness_passed": True
            })
            
            # --- STAGE 6: MARK ATTENDANCE ---
            print(f"📝 Marking attendance for {student_name} (ID: {student_id})...")
            result = mark_attendance_if_not_exists(student_id, subject_id=subject_id, conf=similarity)
            if result.get("status") == "exists":
                print(f"ℹ️ Attendance already marked for today")
            else:
                print(f"✅ Attendance marked successfully!")

        except Exception as e:
            print(f"❌ Error processing face at [{x}, {y}]: {e}")
            import traceback
            traceback.print_exc()
            continue

    return {"status": "recognized", "faces": results}


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

@app.post("/register-face-batch/")
async def register_face_batch(
    student_id: str = Form(...), 
    files: list[UploadFile] = File(...),
    skip_liveness: bool = Form(True)  # Skip liveness for registration by default
):
    """
    Register multiple face samples for a student.
    Recommended: 5-10 samples with different angles/lighting.
    
    Args:
        skip_liveness: If True, skips liveness detection (recommended for registration).
                      Set to False only if registering from live camera feed.
    """
    if liveness_detector is None:
        raise HTTPException(status_code=500, detail="Liveness detector not loaded")

    if len(files) < 3:
        raise HTTPException(status_code=400, detail="Please upload at least 3 face images")

    if len(files) > 15:
        raise HTTPException(status_code=400, detail="Maximum 15 images allowed")

    registered_count = 0
    rejected_count = 0
    errors = []

    for idx, file in enumerate(files):
        try:
            print(f"\n🔍 Processing image {idx+1}: {file.filename}")
            
            # Read image
            contents = await file.read()
            nparr = np.frombuffer(contents, np.uint8)
            img_np = cv2.imdecode(nparr, cv2.IMREAD_COLOR)
            
            if img_np is None:
                rejected_count += 1
                errors.append(f"Image {idx+1}: Invalid file format")
                print(f"❌ Image {idx+1}: Invalid file format")
                continue

            print(f"✅ Image {idx+1}: Loaded successfully ({img_np.shape})")

            # Detect face
            gray = cv2.cvtColor(img_np, cv2.COLOR_BGR2GRAY)
            faces = facedetect.detectMultiScale(gray, 1.3, 5, minSize=(MIN_FACE_SIZE, MIN_FACE_SIZE))
            
            if len(faces) == 0:
                rejected_count += 1
                errors.append(f"Image {idx+1}: No face detected")
                print(f"❌ Image {idx+1}: No face detected")
                continue

            (x, y, w, h) = faces[0]  # Take the first face
            face_crop = img_np[y:y+h, x:x+w]
            print(f"✅ Image {idx+1}: Face detected ({w}x{h})")

            # Quality checks
            if w > MAX_FACE_SIZE or h > MAX_FACE_SIZE:
                rejected_count += 1
                errors.append(f"Image {idx+1}: Face too large ({w}x{h})")
                print(f"❌ Image {idx+1}: Face too large ({w}x{h})")
                continue

            # Blur check
            gray_crop = cv2.cvtColor(face_crop, cv2.COLOR_BGR2GRAY)
            laplacian_var = cv2.Laplacian(gray_crop, cv2.CV_64F).var()
            if laplacian_var < BLUR_THRESHOLD:
                rejected_count += 1
                errors.append(f"Image {idx+1}: Image too blurry (score: {laplacian_var:.1f})")
                print(f"❌ Image {idx+1}: Too blurry (score: {laplacian_var:.1f}, threshold: {BLUR_THRESHOLD})")
                continue

            print(f"✅ Image {idx+1}: Quality checks passed (blur: {laplacian_var:.1f})")

            # Liveness check - OPTIONAL for registration (static photos)
            if not skip_liveness:
                print(f"🔍 Image {idx+1}: Running liveness detection...")
                # Resize face crop to 80x80 (required by MiniFASNet)
                face_crop_resized = cv2.resize(face_crop, (80, 80))
                prediction = liveness_detector.predict(face_crop_resized, LIVENESS_MODEL_PATH)
                real_score = prediction[0][1]

                if real_score < LIVENESS_THRESHOLD:
                    rejected_count += 1
                    errors.append(f"Image {idx+1}: Spoof detected (liveness: {real_score:.2f})")
                    print(f"❌ Image {idx+1}: Liveness failed (score: {real_score:.2f}, threshold: {LIVENESS_THRESHOLD})")
                    continue

                print(f"✅ Image {idx+1}: Liveness passed (score: {real_score:.2f})")
            else:
                print(f"⏭️ Image {idx+1}: Liveness check skipped (registration mode)")

            # Generate embedding
            print(f"🔍 Image {idx+1}: Generating DeepFace embedding...")
            embedding = DeepFace.represent(
                img_path=face_crop,
                model_name=FACE_MODEL_NAME,
                enforce_detection=False,
                detector_backend='skip'
            )[0]["embedding"]

            print(f"✅ Image {idx+1}: Embedding generated (length: {len(embedding)})")

            # Store in database
            data_to_insert = {
                "student_id": student_id,
                "embedding": embedding
            }
            response = supabase.table("faces").insert(data_to_insert).execute()
            
            if response.data:
                registered_count += 1
                print(f"✅ Image {idx+1}: Successfully stored in database")
            else:
                rejected_count += 1
                errors.append(f"Image {idx+1}: Database error")
                print(f"❌ Image {idx+1}: Database insertion failed")

        except Exception as e:
            rejected_count += 1
            errors.append(f"Image {idx+1}: {str(e)}")
            print(f"❌ Error processing image {idx+1}: {e}")
            import traceback
            traceback.print_exc()

    # Determine success status
    success = registered_count > 0
    
    return {
        "status": "success" if success else "error",
        "message": f"Registered {registered_count}/{len(files)} face samples",
        "registered": registered_count,
        "rejected": rejected_count,
        "total_uploaded": len(files),
        "errors": errors if errors else None,
        "student_id": student_id
    }