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
  const [logs, setLogs] = useState<{ time: string; message: string }[]>([]);
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

  const log = (message: string) => {
    setLogs((prev) => [{ time: new Date().toLocaleTimeString(), message }, ...prev].slice(0, 50));
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
      log("Camera started");
    } catch (err: any) {
      console.error(err);
      log("Failed to start camera: " + (err?.message || err));
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
    log("Camera stopped");
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
      ctx.strokeStyle = "red";
      ctx.lineWidth = 2;
      ctx.strokeRect(f.x, f.y, f.w, f.h);

      ctx.fillStyle = "red";
      ctx.font = "16px Arial";
      ctx.fillText(f.name || "Unknown", f.x, f.y - 5);
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
          log(`Recognized (live): ${passed.map((f: any) => f.name).join(", ")}`);
        }
        if (blocked.length > 0) {
          setSpoofWarning("Some faces failed liveness. Ensure a real person is in front of the camera.");
          log(`Blocked by liveness: ${blocked.map((f: any) => f.name || "Unknown").join(", ")}`);
        }
        if (json.message) {
          log(json.message);
        }
      } else if (json.status === "no_face") {
        drawFaces([]);
        log("No face detected");
      } else if (json.status === "spoof_detected") {
        drawFaces(json.faces || []);
        setSpoofWarning("Spoof attempt detected. Attendance halted.");
        log(json.message || "Spoof attempt detected by liveness checks");
        setIsLivenessConfirmed(false);
      } else {
        console.warn("recognize_frame:", json);
        log("Recognition error: " + (json.message || JSON.stringify(json)));
      }
    } catch (err) {
      console.error("Request error", err);
      if (err instanceof TypeError && err.message.includes("fetch")) {
        log("Backend server not running or connection failed");
      } else {
        log("Recognition request failed: " + (err as Error).message);
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
              log(isScanning ? "Stopped scanning" : "Started scanning");
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
          <div className="h-64 overflow-auto bg-black/10 p-2 rounded">
            {logs.map((l, i) => (
              <div key={i} className="text-sm">
                <span className="text-gray-500 mr-2">{l.time}</span>
                {l.message}
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
