"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Book } from "lucide-react";
import { formatSubjectsForDisplay, SubjectDisplay } from "@/lib/subjects";
import { LoadingScreen } from "@/components/ui/loading-screen";

const BACKEND = process.env.NEXT_PUBLIC_BACKEND_URL || "http://127.0.0.1:8000";

export default function LiveAttendancePage() {
  const [subjects, setSubjects] = useState<SubjectDisplay[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchSubjects = async () => {
      setIsLoading(true);
      try {
        const response = await fetch(`${BACKEND}/subjects`);
        const data = await response.json();
        if (data.status === "success") {
          setSubjects(formatSubjectsForDisplay(data.subjects || []));
        }
      } catch (error) {
        console.error("Error fetching subjects:", error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchSubjects();
  }, []);

  if (isLoading) {
    return <LoadingScreen message="Loading subjects..." />;
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Live Attendance</CardTitle>
          <CardDescription>Select a subject to start a live attendance session.</CardDescription>
        </CardHeader>
        <CardContent>
          {subjects.length === 0 ? (
            <div className="text-center py-8">
              <Book className="mx-auto h-12 w-12 text-muted-foreground mb-4" />
              <p className="text-muted-foreground">No subjects found. Add a subject to begin.</p>
            </div>
          ) : (
            <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
              {subjects.map((subject) => (
                <Link href={`/dashboard/live-attendance/${subject.id}`} key={subject.id}>
                  <Card className="hover:bg-accent transition-colors">
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                      <CardTitle className="text-base font-medium">{subject.displayName}</CardTitle>
                      {subject.icon}
                    </CardHeader>
                    <CardContent>
                      <p className="text-sm text-muted-foreground">Start live attendance</p>
                    </CardContent>
                  </Card>
                </Link>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
