"use client";

import Link from 'next/link';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';

export default function SignupPage() {
  const [accessCode, setAccessCode] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  const handleSignUp = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    // Check access code
    if (accessCode === "attendvision2025") {
      // Tester access
      document.cookie = "authenticated=true; path=/; max-age=86400";
      document.cookie = "userRole=tester; path=/; max-age=86400";
      router.push("/dashboard");
    } else if (accessCode === "admin@attendvision") {
      // Admin access
      document.cookie = "authenticated=true; path=/; max-age=86400";
      document.cookie = "userRole=admin; path=/; max-age=86400";
      router.push("/dashboard");
    } else {
      setError("Invalid access code. Please try again.");
    }
  };

  return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100 p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <CardTitle className="text-3xl font-bold">AttendVision</CardTitle>
          <CardDescription>Create Account or Sign Up</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSignUp} className="space-y-4">
            {error && (
              <Alert variant="destructive">
                <AlertTitle>Error</AlertTitle>
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}
            <div className="space-y-2">
              <Label htmlFor="code">Access Code</Label>
              <Input 
                id="code" 
                type="password" 
                placeholder="Enter your access code" 
                required 
                value={accessCode}
                onChange={(e) => setAccessCode(e.target.value)}
                onKeyPress={(e) => e.key === "Enter" && handleSignUp(e as any)}
              />
            </div>
            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? 'Signing Up...' : 'Sign Up'}
            </Button>
          </form>
          <div className="mt-4 text-center text-sm">
            Already have an account?{' '}
            <Link href="/login" className="text-blue-600 underline hover:text-blue-800">
              Log in
            </Link>
          </div>
        </CardContent>
      </Card>
      <p className="mt-6 text-center text-sm text-muted-foreground">
        Secure, Simple, and Smart Attendance System
      </p>
    </main>
  );
}
