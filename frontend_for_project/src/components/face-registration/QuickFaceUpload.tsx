'use client'

import { useState, useCallback } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'
import { 
  Upload, 
  X, 
  Check, 
  AlertTriangle,
  Loader2,
  ImageIcon,
  FileImage
} from 'lucide-react'
import { useToast } from '@/hooks/use-toast'

interface QuickFaceUploadProps {
  studentId: string
  studentName: string
  onSuccess: (result: any) => void
  onCancel: () => void
}

interface UploadedImage {
  id: string
  file: File
  dataUrl: string
  size: string
  status: 'ready' | 'uploading' | 'success' | 'error'
}

export default function QuickFaceUpload({ studentId, studentName, onSuccess, onCancel }: QuickFaceUploadProps) {
  const [uploadedImages, setUploadedImages] = useState<UploadedImage[]>([])
  const [isUploading, setIsUploading] = useState(false)
  const [uploadProgress, setUploadProgress] = useState(0)
  const [dragActive, setDragActive] = useState(false)
  const { toast } = useToast()

  const TARGET_SAMPLES = 8
  const MAX_SAMPLES = 10
  const MAX_FILE_SIZE = 10 * 1024 * 1024 // 10MB

  // Format file size
  const formatFileSize = (bytes: number): string => {
    if (bytes === 0) return '0 Bytes'
    const k = 1024
    const sizes = ['Bytes', 'KB', 'MB', 'GB']
    const i = Math.floor(Math.log(bytes) / Math.log(k))
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i]
  }

  // Process uploaded files
  const processFiles = useCallback((files: FileList | File[]) => {
    const fileArray = Array.from(files)
    
    fileArray.forEach((file, index) => {
      // Check file type
      if (!file.type.startsWith('image/')) {
        toast({
          title: "Invalid file type",
          description: `${file.name} is not an image file`,
          variant: "destructive"
        })
        return
      }

      // Check file size
      if (file.size > MAX_FILE_SIZE) {
        toast({
          title: "File too large",
          description: `${file.name} is too large. Maximum size is 10MB`,
          variant: "destructive"
        })
        return
      }

      // Check if we have space
      if (uploadedImages.length + index >= MAX_SAMPLES) {
        toast({
          title: "Too many files",
          description: `Maximum ${MAX_SAMPLES} samples allowed`,
          variant: "destructive"
        })
        return
      }

      // Create preview
      const reader = new FileReader()
      reader.onload = (e) => {
        const dataUrl = e.target?.result as string
        if (!dataUrl) return

        const newImage: UploadedImage = {
          id: `${Date.now()}_${index}`,
          file,
          dataUrl,
          size: formatFileSize(file.size),
          status: 'ready'
        }

        setUploadedImages(prev => [...prev, newImage])
      }
      reader.readAsDataURL(file)
    })
  }, [uploadedImages.length, toast])

  // Handle file input change
  const handleFileChange = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files
    if (!files) return
    
    processFiles(files)
    event.target.value = '' // Reset input
  }, [processFiles])

  // Handle drag and drop
  const handleDrag = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setDragActive(true)
    } else if (e.type === 'dragleave') {
      setDragActive(false)
    }
  }, [])

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setDragActive(false)
    
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      processFiles(e.dataTransfer.files)
    }
  }, [processFiles])

  // Remove image
  const removeImage = useCallback((id: string) => {
    setUploadedImages(prev => prev.filter(img => img.id !== id))
  }, [])

  // Clear all images
  const clearAllImages = useCallback(() => {
    setUploadedImages([])
  }, [])

  // Upload images to backend
  const uploadImages = useCallback(async () => {
    if (uploadedImages.length < 3) {
      toast({
        title: "Not enough samples",
        description: "Please upload at least 3 face photos",
        variant: "destructive"
      })
      return
    }

    setIsUploading(true)
    setUploadProgress(0)

    try {
      const formData = new FormData()
      formData.append('student_id', studentId)
      
      uploadedImages.forEach((img, index) => {
        formData.append('files', img.file)
      })

      // Update image status
      setUploadedImages(prev => 
        prev.map(img => ({ ...img, status: 'uploading' as const }))
      )

      // Simulate progress
      const progressInterval = setInterval(() => {
        setUploadProgress(prev => {
          if (prev >= 90) {
            clearInterval(progressInterval)
            return prev
          }
          return prev + 10
        })
      }, 300)

      const response = await fetch('http://localhost:8000/register-face-batch/', {
        method: 'POST',
        body: formData
      })

      clearInterval(progressInterval)
      setUploadProgress(100)

      const result = await response.json()

      if (response.ok) {
        // Update image status to success
        setUploadedImages(prev => 
          prev.map(img => ({ ...img, status: 'success' as const }))
        )

        toast({
          title: "Success!",
          description: `Registered ${result.registered} face samples for ${studentName}`,
        })
        
        setTimeout(() => onSuccess(result), 1000)
      } else {
        // Update image status to error
        setUploadedImages(prev => 
          prev.map(img => ({ ...img, status: 'error' as const }))
        )
        throw new Error(result.detail || 'Registration failed')
      }
    } catch (error) {
      console.error('Upload error:', error)
      setUploadedImages(prev => 
        prev.map(img => ({ ...img, status: 'error' as const }))
      )
      toast({
        title: "Upload failed",
        description: error instanceof Error ? error.message : 'Unknown error occurred',
        variant: "destructive"
      })
    } finally {
      setIsUploading(false)
      setUploadProgress(0)
    }
  }, [uploadedImages, studentId, studentName, onSuccess, toast])

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="text-center">
        <h2 className="text-2xl font-bold">Upload Photos for {studentName}</h2>
        <p className="text-muted-foreground mt-2">
          Upload {TARGET_SAMPLES} clear face photos for best accuracy
        </p>
      </div>

      {/* Upload Area */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Upload className="h-5 w-5" />
            Upload Face Photos
          </CardTitle>
        </CardHeader>
        <CardContent>
          {/* Drag and Drop Zone */}
          <div
            className={`border-2 border-dashed rounded-lg p-8 text-center transition-colors ${
              dragActive 
                ? 'border-primary bg-primary/5' 
                : 'border-muted-foreground/25 hover:border-primary/50'
            }`}
            onDragEnter={handleDrag}
            onDragLeave={handleDrag}
            onDragOver={handleDrag}
            onDrop={handleDrop}
          >
            <div className="space-y-4">
              <div className="flex justify-center">
                <div className="p-4 bg-primary/10 rounded-full">
                  <ImageIcon className="h-8 w-8 text-primary" />
                </div>
              </div>
              
              <div>
                <h3 className="text-lg font-semibold">Drop photos here</h3>
                <p className="text-muted-foreground">
                  or click to browse files
                </p>
              </div>

              <label htmlFor="file-upload" className="cursor-pointer">
                <Button variant="outline" asChild>
                  <span>
                    <FileImage className="mr-2 h-4 w-4" />
                    Choose Files
                  </span>
                </Button>
              </label>

              <input
                id="file-upload"
                type="file"
                accept="image/*"
                multiple
                onChange={handleFileChange}
                className="hidden"
              />

              <p className="text-xs text-muted-foreground">
                Supported: JPG, PNG, GIF • Max size: 10MB each • Max {MAX_SAMPLES} files
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Uploaded Images */}
      {uploadedImages.length > 0 && (
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="flex items-center gap-2">
                Uploaded Photos ({uploadedImages.length})
                {uploadedImages.length >= TARGET_SAMPLES && (
                  <Badge variant="default" className="bg-green-500">
                    <Check className="h-3 w-3 mr-1" />
                    Ready
                  </Badge>
                )}
              </CardTitle>
              <Button variant="outline" size="sm" onClick={clearAllImages} disabled={isUploading}>
                Clear All
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            {/* Image Grid */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
              {uploadedImages.map((img) => (
                <div key={img.id} className="relative group">
                  <div className="relative">
                    <img
                      src={img.dataUrl}
                      alt="Uploaded face"
                      className="w-full aspect-square object-cover rounded-lg border"
                    />
                    
                    {/* Status Overlay */}
                    {img.status === 'uploading' && (
                      <div className="absolute inset-0 bg-black/50 rounded-lg flex items-center justify-center">
                        <Loader2 className="h-6 w-6 text-white animate-spin" />
                      </div>
                    )}
                    
                    {img.status === 'success' && (
                      <div className="absolute inset-0 bg-green-500/20 rounded-lg flex items-center justify-center">
                        <Check className="h-6 w-6 text-green-600" />
                      </div>
                    )}
                    
                    {img.status === 'error' && (
                      <div className="absolute inset-0 bg-red-500/20 rounded-lg flex items-center justify-center">
                        <AlertTriangle className="h-6 w-6 text-red-600" />
                      </div>
                    )}
                  </div>

                  {/* Remove Button */}
                  {img.status === 'ready' && (
                    <Button
                      variant="destructive"
                      size="sm"
                      className="absolute -top-2 -right-2 opacity-0 group-hover:opacity-100 transition-opacity"
                      onClick={() => removeImage(img.id)}
                    >
                      <X className="h-3 w-3" />
                    </Button>
                  )}

                  {/* File Info */}
                  <div className="mt-2 text-xs text-center">
                    <p className="truncate">{img.file.name}</p>
                    <p className="text-muted-foreground">{img.size}</p>
                  </div>
                </div>
              ))}
            </div>

            {/* Progress Bar */}
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span>Progress</span>
                <span>{uploadedImages.length}/{TARGET_SAMPLES} photos</span>
              </div>
              <Progress value={(uploadedImages.length / TARGET_SAMPLES) * 100} />
            </div>
          </CardContent>
        </Card>
      )}

      {/* Upload Progress */}
      {isUploading && (
        <Card>
          <CardContent className="pt-6">
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <Loader2 className="h-4 w-4 animate-spin" />
                <span>Processing face samples...</span>
              </div>
              <Progress value={uploadProgress} />
            </div>
          </CardContent>
        </Card>
      )}

      {/* Action Buttons */}
      <div className="flex gap-2 justify-end">
        <Button variant="outline" onClick={onCancel} disabled={isUploading}>
          Cancel
        </Button>
        <Button 
          onClick={uploadImages} 
          disabled={uploadedImages.length < 3 || isUploading}
        >
          {isUploading ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Processing...
            </>
          ) : (
            <>
              <Check className="mr-2 h-4 w-4" />
              Register Face ({uploadedImages.length} photos)
            </>
          )}
        </Button>
      </div>
    </div>
  )
}
