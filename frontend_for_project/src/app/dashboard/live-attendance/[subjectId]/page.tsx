"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

const BACKEND = process.env.NEXT_PUBLIC_BACKEND_URL || "http://127.0.0.1:8000";

export default function LiveAttendanceSubjectPage() {
  const params = useParams();
  const router = useRouter();
  const subjectId = Array.isArray(params.subjectId) ? params.subjectId[0] : params.subjectId;

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const timerRef = useRef<number | undefined>(undefined);
  const shouldStopRef = useRef<boolean>(false);

  const [subjectName, setSubjectName] = useState<string>("Subject");
  const [subjectCode, setSubjectCode] = useState<string | null>(null);
  const [isCameraOn, setIsCameraOn] = useState(false);
  const [isScanning, setIsScanning] = useState(false);
  const [isLivenessConfirmed, setIsLivenessConfirmed] = useState(false);
  const [spoofWarning, setSpoofWarning] = useState<string | null>(null);
  const [logs, setLogs] = useState<{ 
    time: string; 
    message: string;
    type?: 'success' | 'warning' | 'error' | 'info';
    details?: {
      confidence?: number;
      liveness?: number;
      studentName?: string;
      status?: string;
    }
  }[]>([]);
  const [isLoadingSubject, setIsLoadingSubject] = useState(true);

  useEffect(() => {
    const fetchSubject = async () => {
      if (!subjectId) {
        router.push("/dashboard/live-attendance");
        return;
      }
      setIsLoadingSubject(true);
      try {
        const response = await fetch(`${BACKEND}/subjects/${subjectId}`);
        const data = await response.json();
        if (data.status === "success" && data.subject) {
          setSubjectName(data.subject.name || "Subject");
          setSubjectCode(data.subject.code || null);
        } else {
          setSubjectName("Subject");
          setSubjectCode(null);
        }
      } catch (error) {
        console.error("Error fetching subject:", error);
      } finally {
        setIsLoadingSubject(false);
      }
    };

    fetchSubject();
  }, [subjectId, router]);

  const log = (message: string, type?: 'success' | 'warning' | 'error' | 'info', details?: any) => {
    setLogs((prev) => [{ 
      time: new Date().toLocaleTimeString(), 
      message,
      type,
      details 
    }, ...prev].slice(0, 50));
  };

  const startCamera = async () => {
    try {
      shouldStopRef.current = false;
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "user" } });
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      }
      setIsCameraOn(true);
      setIsLivenessConfirmed(false);
      setSpoofWarning(null);
      log("📹 Camera started", 'info');
    } catch (err: any) {
      console.error(err);
      log("❌ Failed to start camera: " + (err?.message || err), 'error');
    }
  };

  const stopCamera = () => {
    try {
      shouldStopRef.current = true;
      if (timerRef.current) {
        clearTimeout(timerRef.current);
        timerRef.current = undefined;
      }

      const tracks = (videoRef.current?.srcObject as MediaStream)?.getTracks() || [];
      tracks.forEach((t) => t.stop());
      if (videoRef.current) videoRef.current.srcObject = null;
    } catch (e) {
      console.warn(e);
    }
    setIsScanning(false);
    setIsCameraOn(false);
    log("⏹️ Camera stopped", 'info');
  };

  const drawFaces = (faces: any[]) => {
    const canvas = canvasRef.current;
    const video = videoRef.current;
    if (!canvas || !video) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    canvas.width = video.videoWidth || 640;
    canvas.height = video.videoHeight || 480;

    ctx.clearRect(0, 0, canvas.width, canvas.height);

    faces.forEach((f) => {
      // Determine color based on liveness status
      const isReal = f.liveness_passed !== false; // Default to true if not specified
      const boxColor = isReal ? "#22c55e" : "#ef4444"; // Green for real, red for spoof
      const textBgColor = isReal ? "#16a34a" : "#dc2626"; // Darker shade for text background
      
      // Draw tight-fitting bounding box
      ctx.strokeStyle = boxColor;
      ctx.lineWidth = 3;
      ctx.strokeRect(f.x, f.y, f.w, f.h);
      
      // Add corner accents for modern look
      const cornerLength = 15;
      ctx.lineWidth = 4;
      
      // Top-left corner
      ctx.beginPath();
      ctx.moveTo(f.x, f.y + cornerLength);
      ctx.lineTo(f.x, f.y);
      ctx.lineTo(f.x + cornerLength, f.y);
      ctx.stroke();
      
      // Top-right corner
      ctx.beginPath();
      ctx.moveTo(f.x + f.w - cornerLength, f.y);
      ctx.lineTo(f.x + f.w, f.y);
      ctx.lineTo(f.x + f.w, f.y + cornerLength);
      ctx.stroke();
      
      // Bottom-left corner
      ctx.beginPath();
      ctx.moveTo(f.x, f.y + f.h - cornerLength);
      ctx.lineTo(f.x, f.y + f.h);
      ctx.lineTo(f.x + cornerLength, f.y + f.h);
      ctx.stroke();
      
      // Bottom-right corner
      ctx.beginPath();
      ctx.moveTo(f.x + f.w - cornerLength, f.y + f.h);
      ctx.lineTo(f.x + f.w, f.y + f.h);
      ctx.lineTo(f.x + f.w, f.y + f.h - cornerLength);
      ctx.stroke();
      
      // Draw name label above the box
      const name = f.name || "Unknown";
      const confidence = f.confidence ? ` (${(f.confidence * 100).toFixed(0)}%)` : "";
      const label = name + confidence;
      
      ctx.font = "bold 16px Arial";
      const textMetrics = ctx.measureText(label);
      const textWidth = textMetrics.width;
      const textHeight = 20;
      const padding = 8;
      
      // Background for text (above the box)
      const labelX = f.x;
      const labelY = f.y - textHeight - padding - 5;
      
      ctx.fillStyle = textBgColor;
      ctx.fillRect(labelX, labelY, textWidth + padding * 2, textHeight + padding);
      
      // Text
      ctx.fillStyle = "#ffffff";
      ctx.fillText(label, labelX + padding, labelY + textHeight);
      
      // Optional: Show liveness score if spoof
      if (!isReal && f.liveness_score !== undefined) {
        const livenessText = `⚠️ Liveness: ${(f.liveness_score * 100).toFixed(0)}%`;
        ctx.font = "12px Arial";
        const livenessMetrics = ctx.measureText(livenessText);
        
        ctx.fillStyle = "rgba(239, 68, 68, 0.9)";
        ctx.fillRect(f.x, f.y + f.h + 5, livenessMetrics.width + padding * 2, 20);
        
        ctx.fillStyle = "#ffffff";
        ctx.fillText(livenessText, f.x + padding, f.y + f.h + 20);
      }
    });
  };

  const captureAndSend = useCallback(async () => {
    if (!videoRef.current || !isCameraOn || !isScanning || shouldStopRef.current) return;
    const video = videoRef.current;
    const canvas = document.createElement("canvas");
    canvas.width = video.videoWidth || 640;
    canvas.height = video.videoHeight || 480;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

    const blob: Blob | null = await new Promise((resolve) => canvas.toBlob(resolve, "image/jpeg", 0.7));
    if (!blob) {
      log("Failed to capture frame");
      return;
    }

    const form = new FormData();
    form.append("frame", blob, "frame.jpg");
    if (subjectId) {
      form.append("subject_id", subjectId);
    }

    try {
      const res = await fetch(`${BACKEND}/recognize_frame`, {
        method: "POST",
        body: form,
      });

      const json = await res.json();

      if (json.status === "recognized" && json.faces) {
        drawFaces(json.faces);
        const passed = json.faces.filter((f: any) => f.liveness_passed);
        const blocked = json.faces.filter((f: any) => !f.liveness_passed);
        if (passed.length > 0) {
          setIsLivenessConfirmed(true);
          setSpoofWarning(null);
          passed.forEach((f: any) => {
            log(
              `✅ Attendance Marked: ${f.name}`,
              'success',
              {
                studentName: f.name,
                confidence: f.confidence,
                liveness: f.liveness_score,
                status: 'Recognized'
              }
            );
          });
        }
        if (blocked.length > 0) {
          setSpoofWarning("Some faces failed liveness. Ensure a real person is in front of the camera.");
          blocked.forEach((f: any) => {
            log(
              `🚫 Spoof Detected: ${f.name || 'Unknown'}`,
              'error',
              {
                studentName: f.name || 'Unknown',
                confidence: f.confidence,
                liveness: f.liveness_score,
                status: 'Blocked'
              }
            );
          });
        }
        if (json.message) {
          log(json.message);
        }
      } else if (json.status === "no_face") {
        drawFaces([]);
        log("⚠️ No face detected in frame", 'warning');
      } else if (json.status === "spoof_detected") {
        drawFaces(json.faces || []);
        setSpoofWarning("Spoof attempt detected. Attendance halted.");
        log(
          "🚨 " + (json.message || "Spoof attempt detected by liveness checks"),
          'error'
        );
        setIsLivenessConfirmed(false);
      } else {
        console.warn("recognize_frame:", json);
        log("❌ Recognition error: " + (json.message || JSON.stringify(json)), 'error');
      }
    } catch (err) {
      console.error("Request error", err);
      if (err instanceof TypeError && err.message.includes("fetch")) {
        log("🔌 Backend server not running or connection failed", 'error');
      } else {
        log("❌ Recognition request failed: " + (err as Error).message, 'error');
      }
    }
  }, [isCameraOn, isScanning, subjectId]);

  useEffect(() => {
    if (isCameraOn && isScanning && !shouldStopRef.current) {
      const loop = async () => {
        if (shouldStopRef.current) return;
        await captureAndSend();
        if (isCameraOn && isScanning && !shouldStopRef.current) {
          timerRef.current = window.setTimeout(loop, 2000);
        }
      };
      loop();
    }
    return () => {
      if (timerRef.current) {
        clearTimeout(timerRef.current);
        timerRef.current = undefined;
      }
    };
  }, [isCameraOn, isScanning, captureAndSend]);

  if (!subjectId) {
    return null;
  }

  return (
    <div className="space-y-6 p-4">
      <Card>
        <CardHeader>
          <CardTitle>{subjectName}</CardTitle>
          <CardDescription>
            {isLoadingSubject
              ? "Loading subject..."
              : subjectCode
              ? `Code: ${subjectCode}`
              : "Start and monitor live attendance for this subject."}
          </CardDescription>
        </CardHeader>
      </Card>

      <div className="relative w-full bg-gray-900 rounded-lg overflow-hidden" style={{ height: "420px" }}>
        {!isCameraOn && <div className="w-full h-full flex items-center justify-center text-gray-400">Camera is off</div>}
        <video ref={videoRef} className="absolute w-full h-full object-contain bg-black" style={{ display: isCameraOn ? "block" : "none" }} />
        <canvas ref={canvasRef} className="absolute w-full h-full pointer-events-none" />
      </div>

      <div className="space-y-3">
        {!isLivenessConfirmed && isCameraOn && (
          <div className="text-sm text-muted-foreground">
            Ensure the student blinks or turns their head slightly so we can confirm liveness.
          </div>
        )}
        {spoofWarning && (
          <div className="text-sm text-red-500">{spoofWarning}</div>
        )}
        <div className="flex gap-3 flex-wrap">
          <Button onClick={startCamera} disabled={isCameraOn}>
            Start Camera
          </Button>
          <Button
            onClick={() => {
              setIsScanning((s) => !s);
              log(isScanning ? "⏸️ Stopped scanning" : "▶️ Started scanning", 'info');
            }}
            disabled={!isCameraOn}
          >
            {isScanning ? "Stop Scanning" : "Scan for Students"}
          </Button>
          <Button onClick={stopCamera} variant="destructive">
            Stop Camera
          </Button>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Activity log</CardTitle>
          <CardDescription>Recognition events and system messages</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="h-64 overflow-auto bg-black/10 p-3 rounded space-y-2">
            {logs.length === 0 && (
              <div className="text-sm text-gray-500 text-center py-8">
                No activity yet. Start the camera to begin.
              </div>
            )}
            {logs.map((l, i) => {
              const bgColor = 
                l.type === 'success' ? 'bg-green-50 dark:bg-green-950/20 border-l-4 border-green-500' :
                l.type === 'error' ? 'bg-red-50 dark:bg-red-950/20 border-l-4 border-red-500' :
                l.type === 'warning' ? 'bg-yellow-50 dark:bg-yellow-950/20 border-l-4 border-yellow-500' :
                'bg-blue-50 dark:bg-blue-950/20 border-l-4 border-blue-500';
              
              const textColor = 
                l.type === 'success' ? 'text-green-700 dark:text-green-400' :
                l.type === 'error' ? 'text-red-700 dark:text-red-400' :
                l.type === 'warning' ? 'text-yellow-700 dark:text-yellow-400' :
                'text-blue-700 dark:text-blue-400';

              return (
                <div key={i} className={`text-sm p-3 rounded ${bgColor}`}>
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-gray-500 dark:text-gray-400 font-mono">
                          {l.time}
                        </span>
                        <span className={`font-medium ${textColor}`}>
                          {l.message}
                        </span>
                      </div>
                      
                      {l.details && (
                        <div className="mt-2 grid grid-cols-2 gap-2 text-xs">
                          {l.details.studentName && (
                            <div className="flex items-center gap-1">
                              <span className="text-gray-600 dark:text-gray-400">Student:</span>
                              <span className="font-semibold">{l.details.studentName}</span>
                            </div>
                          )}
                          {l.details.confidence !== undefined && (
                            <div className="flex items-center gap-1">
                              <span className="text-gray-600 dark:text-gray-400">Confidence:</span>
                              <span className="font-semibold text-blue-600 dark:text-blue-400">
                                {(l.details.confidence * 100).toFixed(1)}%
                              </span>
                            </div>
                          )}
                          {l.details.liveness !== undefined && (
                            <div className="flex items-center gap-1">
                              <span className="text-gray-600 dark:text-gray-400">Liveness:</span>
                              <span className={`font-semibold ${
                                l.details.liveness >= 0.5 
                                  ? 'text-green-600 dark:text-green-400' 
                                  : 'text-red-600 dark:text-red-400'
                              }`}>
                                {(l.details.liveness * 100).toFixed(1)}%
                              </span>
                            </div>
                          )}
                          {l.details.status && (
                            <div className="flex items-center gap-1">
                              <span className="text-gray-600 dark:text-gray-400">Status:</span>
                              <span className={`font-semibold ${
                                l.details.status === 'Recognized' 
                                  ? 'text-green-600 dark:text-green-400' 
                                  : 'text-red-600 dark:text-red-400'
                              }`}>
                                {l.details.status}
                              </span>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
