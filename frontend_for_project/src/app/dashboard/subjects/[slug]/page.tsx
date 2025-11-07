'use client';

import { useState, useEffect, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Users, UserCheck, UserX, BarChart2 } from 'lucide-react';
import { ScrollArea } from '@/components/ui/scroll-area';
import { cn } from '@/lib/utils';
import { useParams } from 'next/navigation';

type Subject = {
  id: string;
  name: string;
  code?: string | null;
  description?: string | null;
};

type AttendanceRecord = {
  id: string;
  student_id: string;
  status: string;
  date?: string | null;
  marked_at?: string | null;
  subject_code?: string | null;
  student?: {
    id?: string;
    name?: string;
    email?: string;
  } | null;
};

type AggregatedStudent = {
  id: string;
  name: string;
  email?: string;
  lastStatus: 'present' | 'absent' | 'late' | 'pending';
  totalSessions: number;
  presentCount: number;
  attendancePercentage: number;
  latestMarkedAt?: string | null;
};

const BACKEND = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://127.0.0.1:8000';

export default function SubjectDetailPage() {
  const params = useParams();
  const subjectId = Array.isArray(params.slug) ? params.slug[0] : params.slug;
  const [subject, setSubject] = useState<Subject | null>(null);
  const [attendanceRecords, setAttendanceRecords] = useState<AttendanceRecord[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isLoadingDetails, setIsLoadingDetails] = useState(true);

  useEffect(() => {
    if (!subjectId) return;

    const loadSubjectDetails = async () => {
      try {
        setIsLoading(true);
        setIsLoadingDetails(true);

        const [subjectRes, attendanceRes] = await Promise.all([
          fetch(`${BACKEND}/subjects/${subjectId}`),
          fetch(`${BACKEND}/subjects/${subjectId}/attendance`),
        ]);

        const subjectJson = await subjectRes.json();
        if (subjectJson.status === 'success') {
          setSubject(subjectJson.subject);
        }

        const attendanceJson = await attendanceRes.json();
        if (attendanceJson.status === 'success') {
          setAttendanceRecords(attendanceJson.records || []);
        } else {
          setAttendanceRecords([]);
        }
      } catch (error) {
        console.error('Error loading subject data:', error);
        setSubject(null);
        setAttendanceRecords([]);
      } finally {
        setIsLoading(false);
        setIsLoadingDetails(false);
      }
    };

    loadSubjectDetails();
  }, [subjectId]);

  const aggregatedStudents = useMemo<AggregatedStudent[]>(() => {
    const map = new Map<string, AggregatedStudent>();

    attendanceRecords.forEach((record) => {
      const studentId = record.student?.id || record.student_id;
      if (!studentId) return;

      const studentName = record.student?.name || 'Unknown Student';
      const prev = map.get(studentId) || {
        id: studentId,
        name: studentName,
        email: record.student?.email,
        lastStatus: 'pending' as const,
        totalSessions: 0,
        presentCount: 0,
        attendancePercentage: 0,
        latestMarkedAt: null,
      };

      const updated: AggregatedStudent = {
        ...prev,
        name: studentName,
        email: record.student?.email,
        totalSessions: prev.totalSessions + 1,
        presentCount: prev.presentCount + (record.status === 'present' ? 1 : 0),
        lastStatus: prev.lastStatus,
        attendancePercentage: prev.attendancePercentage,
        latestMarkedAt: prev.latestMarkedAt,
      };

      const hasRecordTimestamp = Boolean(record.marked_at);
      const shouldUpdateStatus =
        updated.latestMarkedAt == null ||
        (!hasRecordTimestamp && updated.latestMarkedAt == null) ||
        (record.marked_at && (!updated.latestMarkedAt || new Date(record.marked_at) >= new Date(updated.latestMarkedAt)));

      if (shouldUpdateStatus) {
        updated.lastStatus = (record.status as AggregatedStudent['lastStatus']) || 'pending';
        updated.latestMarkedAt = record.marked_at ?? updated.latestMarkedAt;
      } else if (!updated.latestMarkedAt && record.marked_at) {
        updated.latestMarkedAt = record.marked_at;
      }

      updated.attendancePercentage = updated.totalSessions
        ? Math.round((updated.presentCount / updated.totalSessions) * 100)
        : 0;

      map.set(studentId, updated);
    });

    return Array.from(map.values());
  }, [attendanceRecords]);

  const totalStudents = aggregatedStudents.length;
  const presentCount = aggregatedStudents.filter((student) => student.lastStatus === 'present').length;
  const absentCount = aggregatedStudents.filter((student) => student.lastStatus === 'absent').length;
  const attendancePercentage = totalStudents > 0 ? (presentCount / totalStudents) * 100 : 0;

  const subjectName = subject?.name || 'Unknown Subject';
  const subjectCode = subject?.code || (attendanceRecords[0]?.subject_code ?? null);
  const subjectDescription = subject?.description;

  const attendanceBadge = (status: AggregatedStudent['lastStatus']) => {
    const variants = {
      present: 'bg-green-100 text-green-800 border-green-200 dark:bg-green-900/50 dark:text-green-300 dark:border-green-700',
      absent: 'bg-red-100 text-red-800 border-red-200 dark:bg-red-900/50 dark:text-red-300 dark:border-red-700',
      late: 'bg-yellow-100 text-yellow-800 border-yellow-200 dark:bg-yellow-900/50 dark:text-yellow-300 dark:border-yellow-700',
      pending: 'bg-gray-100 text-gray-800 border-gray-200 dark:bg-gray-700 dark:text-gray-300 dark:border-gray-600',
    };
    return cn('capitalize', variants[status]);
  };

  return (
    <div className="space-y-6">
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Students</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{isLoading ? '—' : totalStudents}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Present</CardTitle>
            <UserCheck className="h-4 w-4 text-green-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{isLoading ? '—' : presentCount}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Absent</CardTitle>
            <UserX className="h-4 w-4 text-red-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{isLoading ? '—' : absentCount}</div>
          </CardContent>
        </Card>
        <Card className="col-span-full md:col-span-1">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Overall Attendance</CardTitle>
            <BarChart2 className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <Progress value={isLoading ? 0 : attendancePercentage} className="h-2" />
            <p className="mt-2 text-center text-sm text-muted-foreground">
              {isLoading ? '—' : `${attendancePercentage.toFixed(0)}%`}
            </p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>{subjectName}</CardTitle>
          <CardDescription>
            {subjectCode ? `Code: ${subjectCode}` : ''}
            {subjectDescription ? (
              <span className={subjectCode ? 'block mt-1' : ''}>{subjectDescription}</span>
            ) : (
              !subjectCode && 'Attendance status for students in this subject.'
            )}
            {subjectDescription && !subjectCode && null}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ScrollArea className="h-[400px]">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Student</TableHead>
                  <TableHead className="text-center">Latest Status</TableHead>
                  <TableHead className="w-[200px]">Subject Attendance</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoadingDetails ? (
                  <TableRow>
                    <TableCell colSpan={3} className="text-center">Loading attendance...</TableCell>
                  </TableRow>
                ) : aggregatedStudents.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={3} className="text-center">No attendance records yet for this subject.</TableCell>
                  </TableRow>
                ) : (
                  aggregatedStudents.map((student) => (
                    <TableRow key={student.id}>
                      <TableCell className="font-medium">
                        <div className="flex items-center gap-3">
                          <Avatar>
                            <AvatarImage src="" alt={student.name} />
                            <AvatarFallback>{student.name.charAt(0)}</AvatarFallback>
                          </Avatar>
                          <div>
                            <span>{student.name}</span>
                            {student.email && (
                              <p className="text-xs text-muted-foreground">{student.email}</p>
                            )}
                          </div>
                        </div>
                      </TableCell>
                      <TableCell className="text-center">
                        <Badge variant="outline" className={attendanceBadge(student.lastStatus)}>
                          {student.lastStatus}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <Progress value={student.attendancePercentage} className="h-2" />
                          <span className="text-xs text-muted-foreground">
                            {student.attendancePercentage}% ({student.presentCount}/{student.totalSessions})
                          </span>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </ScrollArea>
        </CardContent>
      </Card>
    </div>
  );
}
