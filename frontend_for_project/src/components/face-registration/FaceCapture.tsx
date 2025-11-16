'use client'

import { useState, useRef, useCallback, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'
import { 
  Camera, 
  CameraOff, 
  RotateCcw, 
  Check, 
  X, 
  Upload,
  AlertTriangle,
  Loader2
} from 'lucide-react'
import { useToast } from '@/hooks/use-toast'

interface FaceCaptureProps {
  studentId: string
  studentName: string
  onSuccess: (result: any) => void
  onCancel: () => void
}

interface CapturedImage {
  id: string
  blob: Blob
  dataUrl: string
  timestamp: number
}

export default function FaceCapture({ studentId, studentName, onSuccess, onCancel }: FaceCaptureProps) {
  const [isStreaming, setIsStreaming] = useState(false)
  const [capturedImages, setCapturedImages] = useState<CapturedImage[]>([])
  const [isUploading, setIsUploading] = useState(false)
  const [uploadProgress, setUploadProgress] = useState(0)
  const [error, setError] = useState<string | null>(null)
  
  const videoRef = useRef<HTMLVideoElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const { toast } = useToast()

  const TARGET_SAMPLES = 8 // Optimal number for DeepFace
  const MAX_SAMPLES = 10

  // Start camera
  const startCamera = useCallback(async () => {
    if (isStreaming) return

    try {
      setError(null)

      if (typeof window !== 'undefined' && !window.isSecureContext && window.location.hostname !== 'localhost') {
        setError('Browser blocked the camera because this page is not served over HTTPS/localhost. Open the site via https:// or http://localhost. ')
        return
      }

      if (!navigator?.mediaDevices?.getUserMedia) {
        setError('Camera API not supported in this browser/device.')
        return
      }

      if (!videoRef.current) {
        console.error('❌ Video ref is null - this should not happen')
        setError('Video element not found. Please refresh the page.')
        return
      }

      console.log('✅ Video element found, requesting camera...')

      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          width: { ideal: 640 },
          height: { ideal: 480 },
          facingMode: 'user'
        }
      })
      
      console.log('✅ Got camera stream:', stream)

      // Set stream and update state
      videoRef.current.srcObject = stream
      streamRef.current = stream
      setIsStreaming(true)
      
      console.log('✅ Set streaming to true, waiting for video to load...')
      
      // Wait for video to be ready
      await new Promise<void>((resolve) => {
        if (!videoRef.current) {
          resolve()
          return
        }
        if (videoRef.current.readyState >= 2) {
          console.log('✅ Video already ready')
          resolve()
        } else {
          videoRef.current.addEventListener('loadedmetadata', () => {
            console.log('✅ Video metadata loaded')
            resolve()
          }, { once: true })
        }
      })

      // Try to play
      try {
        await videoRef.current.play()
        console.log('✅ Video playing successfully!')
      } catch (playError) {
        console.error('❌ Video play error:', playError)
        setError('Camera stream blocked by browser. Click anywhere on the video or check autoplay settings.')
      }
    } catch (err) {
      const fallbackMessage = err instanceof DOMException ? err.message : 'Could not access camera. Please check permissions and ensure no other app is using it.'
      setError(fallbackMessage)
      console.error('Camera error:', err)
    }
  }, [])

  // Stop camera
  const stopCamera = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop())
      streamRef.current = null
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null
    }
    setIsStreaming(false)
  }, [])

  useEffect(() => {
    return () => {
      stopCamera()
    }
  }, [stopCamera])

  // Capture photo
  const capturePhoto = useCallback(() => {
    if (!videoRef.current || !canvasRef.current) return

    const video = videoRef.current
    const canvas = canvasRef.current
    
    // Set canvas size to video size
    canvas.width = video.videoWidth
    canvas.height = video.videoHeight
    
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    // Draw video frame to canvas
    ctx.drawImage(video, 0, 0)
    
    // Convert to blob
    canvas.toBlob((blob) => {
      if (!blob) return

      const id = Date.now().toString()
      const dataUrl = canvas.toDataURL('image/jpeg', 0.8)
      
      const newImage: CapturedImage = {
        id,
        blob,
        dataUrl,
        timestamp: Date.now()
      }

      setCapturedImages(prev => {
        if (prev.length >= MAX_SAMPLES) {
          return [...prev.slice(1), newImage] // Remove oldest, add newest
        }
        return [...prev, newImage]
      })

      toast({
        title: "Photo captured!",
        description: `${capturedImages.length + 1}/${TARGET_SAMPLES} samples captured`,
      })
    }, 'image/jpeg', 0.8)
  }, [capturedImages.length, toast])

  // Remove captured image
  const removeImage = useCallback((id: string) => {
    setCapturedImages(prev => prev.filter(img => img.id !== id))
  }, [])

  // Clear all images
  const clearAllImages = useCallback(() => {
    setCapturedImages([])
  }, [])

  // Upload images to backend
  const uploadImages = useCallback(async () => {
    if (capturedImages.length < 3) {
      toast({
        title: "Not enough samples",
        description: "Please capture at least 3 face samples",
        variant: "destructive"
      })
      return
    }

    setIsUploading(true)
    setUploadProgress(0)

    try {
      const formData = new FormData()
      formData.append('student_id', studentId)
      
      capturedImages.forEach((img, index) => {
        const file = new File([img.blob], `face_${index + 1}.jpg`, { type: 'image/jpeg' })
        formData.append('files', file)
      })

      // Simulate progress
      const progressInterval = setInterval(() => {
        setUploadProgress(prev => {
          if (prev >= 90) {
            clearInterval(progressInterval)
            return prev
          }
          return prev + 10
        })
      }, 200)

      const response = await fetch('http://localhost:8000/register-face-batch/', {
        method: 'POST',
        body: formData
      })

      clearInterval(progressInterval)
      setUploadProgress(100)

      const result = await response.json()

      if (response.ok) {
        toast({
          title: "Success!",
          description: `Registered ${result.registered} face samples for ${studentName}`,
        })
        stopCamera()
        onSuccess(result)
      } else {
        throw new Error(result.detail || 'Registration failed')
      }
    } catch (error) {
      console.error('Upload error:', error)
      toast({
        title: "Upload failed",
        description: error instanceof Error ? error.message : 'Unknown error occurred',
        variant: "destructive"
      })
    } finally {
      setIsUploading(false)
      setUploadProgress(0)
    }
  }, [capturedImages, studentId, studentName, onSuccess, toast])

  // File upload handler
  const handleFileUpload = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files
    if (!files) return

    Array.from(files).forEach((file, index) => {
      if (capturedImages.length + index >= MAX_SAMPLES) return

      const reader = new FileReader()
      reader.onload = (e) => {
        const dataUrl = e.target?.result as string
        if (!dataUrl) return

        const id = `upload_${Date.now()}_${index}`
        const newImage: CapturedImage = {
          id,
          blob: file,
          dataUrl,
          timestamp: Date.now()
        }

        setCapturedImages(prev => [...prev, newImage])
      }
      reader.readAsDataURL(file)
    })

    // Reset input
    event.target.value = ''
  }, [capturedImages.length])

  const handleCancel = useCallback(() => {
    stopCamera()
    setCapturedImages([])
    onCancel()
  }, [onCancel, stopCamera])

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="text-center">
        <h2 className="text-2xl font-bold">Register Face for {studentName}</h2>
        <p className="text-muted-foreground mt-2">
          Capture {TARGET_SAMPLES} clear photos for best accuracy
        </p>
      </div>

      {/* Error Display */}
      {error && (
        <Card className="border-destructive">
          <CardContent className="pt-6">
            <div className="flex items-center gap-2 text-destructive">
              <AlertTriangle className="h-4 w-4" />
              <span>{error}</span>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Camera Section */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Camera className="h-5 w-5" />
            Camera Capture
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Video Stream */}
          <div className="relative bg-gray-100 rounded-lg overflow-hidden">
            {/* Always render video element, just hide it when not streaming */}
            <video
              ref={videoRef}
              autoPlay
              playsInline
              muted
              className={`w-full h-auto ${isStreaming ? 'block' : 'hidden'}`}
            />
            {!isStreaming && (
              <div className="aspect-video flex items-center justify-center">
                <div className="text-center">
                  <CameraOff className="h-12 w-12 mx-auto mb-2 text-muted-foreground" />
                  <p className="text-muted-foreground">Camera not active</p>
                </div>
              </div>
            )}
            <div className="absolute top-2 right-2 text-xs bg-black/60 text-white px-2 py-1 rounded">
              stream: {isStreaming ? 'on' : 'off'} | ready:{videoRef.current?.readyState ?? 0} | ref:{videoRef.current ? 'exists' : 'null'}
            </div>
          </div>

          {/* Camera Controls */}
          <div className="flex gap-2 justify-center">
            {!isStreaming ? (
              <Button onClick={startCamera}>
                <Camera className="mr-2 h-4 w-4" />
                Start Camera
              </Button>
            ) : (
              <>
                <Button onClick={capturePhoto} disabled={capturedImages.length >= MAX_SAMPLES}>
                  <Camera className="mr-2 h-4 w-4" />
                  Capture ({capturedImages.length}/{MAX_SAMPLES})
                </Button>
                <Button variant="outline" onClick={stopCamera}>
                  <CameraOff className="mr-2 h-4 w-4" />
                  Stop Camera
                </Button>
              </>
            )}
          </div>

          {/* File Upload Alternative */}
          <div className="text-center">
            <p className="text-sm text-muted-foreground mb-2">Or upload photos</p>
            <label htmlFor="file-upload" className="cursor-pointer">
              <Button variant="outline" asChild>
                <span>
                  <Upload className="mr-2 h-4 w-4" />
                  Upload Photos
                </span>
              </Button>
            </label>
            <input
              id="file-upload"
              type="file"
              accept="image/*"
              multiple
              onChange={handleFileUpload}
              className="hidden"
            />
          </div>
        </CardContent>
      </Card>

      {/* Captured Images */}
      {capturedImages.length > 0 && (
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="flex items-center gap-2">
                Captured Samples ({capturedImages.length})
                {capturedImages.length >= TARGET_SAMPLES && (
                  <Badge variant="default" className="bg-green-500">
                    <Check className="h-3 w-3 mr-1" />
                    Ready
                  </Badge>
                )}
              </CardTitle>
              <Button variant="outline" size="sm" onClick={clearAllImages}>
                <RotateCcw className="h-4 w-4 mr-1" />
                Clear All
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-4 gap-4 mb-4">
              {capturedImages.map((img) => (
                <div key={img.id} className="relative group">
                  <img
                    src={img.dataUrl}
                    alt="Captured face"
                    className="w-full aspect-square object-cover rounded-lg border"
                  />
                  <Button
                    variant="destructive"
                    size="sm"
                    className="absolute top-1 right-1 opacity-0 group-hover:opacity-100 transition-opacity"
                    onClick={() => removeImage(img.id)}
                  >
                    <X className="h-3 w-3" />
                  </Button>
                </div>
              ))}
            </div>

            {/* Progress Bar */}
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span>Progress</span>
                <span>{capturedImages.length}/{TARGET_SAMPLES} samples</span>
              </div>
              <Progress value={(capturedImages.length / TARGET_SAMPLES) * 100} />
            </div>
          </CardContent>
        </Card>
      )}

      {/* Upload Section */}
      {isUploading && (
        <Card>
          <CardContent className="pt-6">
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <Loader2 className="h-4 w-4 animate-spin" />
                <span>Uploading and processing face samples...</span>
              </div>
              <Progress value={uploadProgress} />
            </div>
          </CardContent>
        </Card>
      )}

      {/* Action Buttons */}
      <div className="flex gap-2 justify-end">
        <Button variant="outline" onClick={handleCancel} disabled={isUploading}>
          Cancel
        </Button>
        <Button 
          onClick={uploadImages} 
          disabled={capturedImages.length < 3 || isUploading}
        >
          {isUploading ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Processing...
            </>
          ) : (
            <>
              <Check className="mr-2 h-4 w-4" />
              Register Face ({capturedImages.length} samples)
            </>
          )}
        </Button>
      </div>

      {/* Hidden canvas for image processing */}
      <canvas ref={canvasRef} className="hidden" />
    </div>
  )
}
