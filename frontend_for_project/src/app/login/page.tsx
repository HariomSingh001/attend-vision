"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";

export default function LoginPage() {
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const router = useRouter();
  
  const handleLogin = () => {
    // Simple password check - change this to your preferred password
    if (password === "attendvision2025") {
      // Set authentication cookie
      document.cookie = "authenticated=true; path=/; max-age=86400"; // 24 hours
      document.cookie = "userRole=tester; path=/; max-age=86400"; // Default role
      router.push("/dashboard");
    } else if (password === "admin@attendvision") {
      // Admin access
      document.cookie = "authenticated=true; path=/; max-age=86400";
      document.cookie = "userRole=admin; path=/; max-age=86400";
      router.push("/dashboard");
    } else {
      setError("Invalid access code. Please try again.");
    }
  };
  
  return (
    <div className="flex items-center justify-center min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100">
      <div className="p-8 bg-white rounded-lg shadow-xl max-w-md w-full">
        <div className="text-center mb-6">
          <h1 className="text-3xl font-bold text-gray-800 mb-2">AttendVision</h1>
          <p className="text-gray-600">Face Recognition Attendance System</p>
        </div>
        
        <div className="mb-6">
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Access Code
          </label>
          <input
            type="password"
            value={password}
            onChange={(e) => {
              setPassword(e.target.value);
              setError("");
            }}
            onKeyPress={(e) => e.key === "Enter" && handleLogin()}
            className="border border-gray-300 p-3 w-full rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            placeholder="Enter your access code"
          />
          {error && (
            <p className="text-red-500 text-sm mt-2">{error}</p>
          )}
        </div>
        
        <button
          onClick={handleLogin}
          className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-3 rounded-lg w-full font-medium transition-colors"
        >
          Access System
        </button>
        
        <div className="mt-6 p-4 bg-gray-50 rounded-lg">
          <p className="text-xs text-gray-600 text-center">
            For testing purposes only. Contact admin for access code.
          </p>
        </div>
      </div>
    </div>
  );
}
