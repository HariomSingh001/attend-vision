# Add this endpoint to your main.py file

@app.post("/register-face-batch/")
async def register_face_batch(
    student_id: str = Form(...), 
    files: list[UploadFile] = File(...)
):
    """
    Register multiple face samples for a student.
    Recommended: 5-10 samples with different angles/lighting.
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
            # Read image
            contents = await file.read()
            nparr = np.frombuffer(contents, np.uint8)
            img_np = cv2.imdecode(nparr, cv2.IMREAD_COLOR)
            
            if img_np is None:
                rejected_count += 1
                errors.append(f"Image {idx+1}: Invalid file format")
                continue

            # Detect face
            gray = cv2.cvtColor(img_np, cv2.COLOR_BGR2GRAY)
            faces = facedetect.detectMultiScale(gray, 1.3, 5, minSize=(MIN_FACE_SIZE, MIN_FACE_SIZE))
            
            if len(faces) == 0:
                rejected_count += 1
                errors.append(f"Image {idx+1}: No face detected")
                continue

            (x, y, w, h) = faces[0]  # Take the first face
            face_crop = img_np[y:y+h, x:x+w]

            # Quality checks
            if w > MAX_FACE_SIZE or h > MAX_FACE_SIZE:
                rejected_count += 1
                errors.append(f"Image {idx+1}: Face too large ({w}x{h})")
                continue

            # Blur check
            gray_crop = cv2.cvtColor(face_crop, cv2.COLOR_BGR2GRAY)
            laplacian_var = cv2.Laplacian(gray_crop, cv2.CV_64F).var()
            if laplacian_var < BLUR_THRESHOLD:
                rejected_count += 1
                errors.append(f"Image {idx+1}: Image too blurry (score: {laplacian_var:.1f})")
                continue

            # Liveness check
            prediction = liveness_detector.predict(face_crop, LIVENESS_MODEL_PATH)
            real_score = prediction[0][1]

            if real_score < LIVENESS_THRESHOLD:
                rejected_count += 1
                errors.append(f"Image {idx+1}: Spoof detected (liveness: {real_score:.2f})")
                continue

            # Generate embedding
            embedding = DeepFace.represent(
                img_path=face_crop,
                model_name=FACE_MODEL_NAME,
                enforce_detection=False,
                detector_backend='skip'
            )[0]["embedding"]

            # Store in database
            data_to_insert = {
                "student_id": student_id,
                "embedding": embedding,
                "embedding_vector": embedding
            }
            response = supabase.table("faces").insert(data_to_insert).execute()
            
            if response.data:
                registered_count += 1
            else:
                rejected_count += 1
                errors.append(f"Image {idx+1}: Database error")

        except Exception as e:
            rejected_count += 1
            errors.append(f"Image {idx+1}: {str(e)}")
            print(f"Error processing image {idx+1}: {e}")

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
