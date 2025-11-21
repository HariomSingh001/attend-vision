#!/bin/bash

# Google Cloud Run Deployment Script
# For AttendVision Face Recognition Backend

# Configuration
PROJECT_ID="your-gcp-project-id"
SERVICE_NAME="attendvision-backend"
REGION="asia-south1"  # Change to your preferred region
IMAGE_NAME="gcr.io/${PROJECT_ID}/${SERVICE_NAME}"

echo "🚀 Deploying AttendVision Backend to Google Cloud Run"
echo "=================================================="

# Step 1: Build Docker image
echo "📦 Building Docker image..."
gcloud builds submit --tag ${IMAGE_NAME}

# Step 2: Deploy to Cloud Run
echo "🌐 Deploying to Cloud Run..."
gcloud run deploy ${SERVICE_NAME} \
  --image ${IMAGE_NAME} \
  --platform managed \
  --region ${REGION} \
  --memory 2Gi \
  --cpu 2 \
  --timeout 300 \
  --max-instances 5 \
  --min-instances 0 \
  --concurrency 10 \
  --allow-unauthenticated \
  --set-env-vars "BLUR_THRESHOLD=30.0,LIVENESS_THRESHOLD=0.5,SIMILARITY_THRESHOLD=0.5"

# Step 3: Get service URL
echo "✅ Deployment complete!"
echo "=================================================="
gcloud run services describe ${SERVICE_NAME} --region ${REGION} --format 'value(status.url)'
