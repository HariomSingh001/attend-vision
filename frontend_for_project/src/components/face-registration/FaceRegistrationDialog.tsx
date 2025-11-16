'use client'

import { useState } from 'react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { 
  Camera, 
  Upload, 
  CheckCircle, 
  AlertCircle,
  User,
  Clock
} from 'lucide-react'
import FaceCapture from './FaceCapture'
import QuickFaceUpload from './QuickFaceUpload'

interface FaceRegistrationDialogProps {
  isOpen: boolean
  onClose: () => void
  student: {
    id: string
    name: string
    email?: string
    studentId?: string
  }
  onSuccess?: (result: any) => void
}

type RegistrationMode = 'select' | 'capture' | 'upload' | 'success'

export default function FaceRegistrationDialog({ 
  isOpen, 
  onClose, 
  student, 
  onSuccess 
}: FaceRegistrationDialogProps) {
  const [mode, setMode] = useState<RegistrationMode>('select')
  const [result, setResult] = useState<any>(null)

  const handleSuccess = (registrationResult: any) => {
    setResult(registrationResult)
    setMode('success')
    onSuccess?.(registrationResult)
  }

  const handleClose = () => {
    setMode('select')
    setResult(null)
    onClose()
  }

  const renderContent = () => {
    switch (mode) {
      case 'select':
        return (
          <div className="space-y-6">
            {/* Student Info */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <User className="h-5 w-5" />
                  Student Information
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  <div className="flex justify-between">
                    <span className="font-medium">Name:</span>
                    <span>{student.name}</span>
                  </div>
                  {student.studentId && (
                    <div className="flex justify-between">
                      <span className="font-medium">Student ID:</span>
                      <span>{student.studentId}</span>
                    </div>
                  )}
                  {student.email && (
                    <div className="flex justify-between">
                      <span className="font-medium">Email:</span>
                      <span className="text-sm">{student.email}</span>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>

            {/* Registration Options */}
            <div className="space-y-4">
              <h3 className="text-lg font-semibold">Choose Registration Method</h3>
              
              {/* Camera Capture Option */}
              <Card className="cursor-pointer hover:bg-accent transition-colors" onClick={() => setMode('capture')}>
                <CardContent className="pt-6">
                  <div className="flex items-center gap-4">
                    <div className="p-3 bg-primary/10 rounded-full">
                      <Camera className="h-6 w-6 text-primary" />
                    </div>
                    <div className="flex-1">
                      <h4 className="font-semibold">Live Camera Capture</h4>
                      <p className="text-sm text-muted-foreground">
                        Use your webcam to capture multiple face samples
                      </p>
                      <div className="flex gap-2 mt-2">
                        <Badge variant="secondary">Recommended</Badge>
                        <Badge variant="outline">8-10 samples</Badge>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* File Upload Option */}
              <Card className="cursor-pointer hover:bg-accent transition-colors" onClick={() => setMode('upload')}>
                <CardContent className="pt-6">
                  <div className="flex items-center gap-4">
                    <div className="p-3 bg-secondary/10 rounded-full">
                      <Upload className="h-6 w-6 text-secondary-foreground" />
                    </div>
                    <div className="flex-1">
                      <h4 className="font-semibold">Upload Photos</h4>
                      <p className="text-sm text-muted-foreground">
                        Upload existing photos of the student
                      </p>
                      <div className="flex gap-2 mt-2">
                        <Badge variant="outline">Quick</Badge>
                        <Badge variant="outline">3-10 photos</Badge>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Tips */}
            <Card className="bg-blue-50 border-blue-200">
              <CardContent className="pt-6">
                <div className="flex items-start gap-3">
                  <AlertCircle className="h-5 w-5 text-blue-600 mt-0.5" />
                  <div>
                    <h4 className="font-semibold text-blue-900">Tips for Best Results</h4>
                    <ul className="text-sm text-blue-800 mt-2 space-y-1">
                      <li>• Ensure good lighting</li>
                      <li>• Face should be clearly visible</li>
                      <li>• Include different angles (front, slight left/right)</li>
                      <li>• Avoid glasses or masks for initial registration</li>
                      <li>• Multiple samples improve accuracy</li>
                    </ul>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        )

      case 'capture':
        return (
          <FaceCapture
            studentId={student.id}
            studentName={student.name}
            onSuccess={handleSuccess}
            onCancel={() => setMode('select')}
          />
        )

      case 'upload':
        return (
          <QuickFaceUpload
            studentId={student.id}
            studentName={student.name}
            onSuccess={handleSuccess}
            onCancel={() => setMode('select')}
          />
        )

      case 'success':
        return (
          <div className="space-y-6 text-center">
            {/* Success Icon */}
            <div className="flex justify-center">
              <div className="p-4 bg-green-100 rounded-full">
                <CheckCircle className="h-12 w-12 text-green-600" />
              </div>
            </div>

            {/* Success Message */}
            <div>
              <h3 className="text-xl font-semibold text-green-900">Face Registration Successful!</h3>
              <p className="text-muted-foreground mt-2">
                {student.name}'s face has been registered successfully
              </p>
            </div>

            {/* Results */}
            {result && (
              <Card>
                <CardContent className="pt-6">
                  <div className="space-y-3">
                    <div className="flex justify-between">
                      <span className="font-medium">Samples Registered:</span>
                      <Badge variant="default">{result.registered}</Badge>
                    </div>
                    {result.rejected > 0 && (
                      <div className="flex justify-between">
                        <span className="font-medium">Samples Rejected:</span>
                        <Badge variant="secondary">{result.rejected}</Badge>
                      </div>
                    )}
                    <div className="flex justify-between">
                      <span className="font-medium">Status:</span>
                      <Badge variant="default" className="bg-green-500">
                        Ready for Recognition
                      </Badge>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Next Steps */}
            <Card className="bg-green-50 border-green-200">
              <CardContent className="pt-6">
                <div className="flex items-start gap-3">
                  <Clock className="h-5 w-5 text-green-600 mt-0.5" />
                  <div className="text-left">
                    <h4 className="font-semibold text-green-900">What's Next?</h4>
                    <ul className="text-sm text-green-800 mt-2 space-y-1">
                      <li>• The student can now use live attendance</li>
                      <li>• Face recognition will work automatically</li>
                      <li>• You can add more samples later if needed</li>
                    </ul>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Action Button */}
            <Button onClick={handleClose} className="w-full">
              Complete Registration
            </Button>
          </div>
        )

      default:
        return null
    }
  }

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {mode === 'select' && 'Register Face'}
            {mode === 'capture' && 'Camera Capture'}
            {mode === 'upload' && 'Upload Photos'}
            {mode === 'success' && 'Registration Complete'}
          </DialogTitle>
          <DialogDescription>
            {mode === 'select' && 'Choose how you want to register the student\'s face for attendance recognition'}
            {mode === 'capture' && 'Use your camera to capture multiple face samples'}
            {mode === 'upload' && 'Upload existing photos of the student'}
            {mode === 'success' && 'Face registration has been completed successfully'}
          </DialogDescription>
        </DialogHeader>

        {renderContent()}
      </DialogContent>
    </Dialog>
  )
}
