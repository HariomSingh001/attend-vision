'use client';

import { useState, useEffect } from 'react';
import { studentApi, convertApiStudentToFrontend } from '@/lib/api';
import type { Student } from '@/lib/data';
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
import { cn } from '@/lib/utils';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Progress } from '@/components/ui/progress';

export default function AbsentStudentsPage() {
  const [students, setStudents] = useState<Student[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const loadStudents = async () => {
      try {
        setIsLoading(true);
        const apiStudents = await studentApi.getAll();
        const frontendStudents = apiStudents.map(convertApiStudentToFrontend);
        const absentStudents = frontendStudents.filter(s => s.attendance === 'absent' || s.attendance === 'late');
        setStudents(absentStudents);
      } catch (error) {
        console.error('Error loading students:', error);
        setStudents([]);
      } finally {
        setIsLoading(false);
      }
    };

    loadStudents();
  }, []);

  const attendanceBadge = (status: Student['attendance']) => {
    const variants = {
      present: 'bg-green-100 text-green-800 border-green-200 dark:bg-green-900/50 dark:text-green-300 dark:border-green-700',
      absent: 'bg-red-100 text-red-800 border-red-200 dark:bg-red-900/50 dark:text-red-300 dark:border-red-700',
      late: 'bg-yellow-100 text-yellow-800 border-yellow-200 dark:bg-yellow-900/50 dark:text-yellow-300 dark:border-yellow-700',
      pending: 'bg-gray-100 text-gray-800 border-gray-200 dark:bg-gray-700 dark:text-gray-300 dark:border-gray-600',
    };
    return cn('capitalize', variants[status]);
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Absent & Late Students</CardTitle>
        <CardDescription>A list of all students marked as absent or late today.</CardDescription>
      </CardHeader>
      <CardContent>
        <ScrollArea className="h-[calc(100vh-20rem)]">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Student</TableHead>
                <TableHead className="text-center">Status</TableHead>
                <TableHead>Overall Attendance</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {students.length > 0 ? (
                students.map((student) => (
                  <TableRow key={student.id}>
                    <TableCell className="font-medium">
                      <div className="flex items-center gap-3">
                        <Avatar>
                          <AvatarImage src={student.avatar} alt={student.name} data-ai-hint={student['data-ai-hint']} />
                          <AvatarFallback>{student.name.charAt(0)}</AvatarFallback>
                        </Avatar>
                        <span>{student.name}</span>
                      </div>
                    </TableCell>
                    <TableCell className="text-center">
                      <Badge variant="outline" className={attendanceBadge(student.attendance)}>
                        {student.attendance}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <Progress value={student.attendancePercentage} className="h-2 w-[150px]" />
                        <span className="text-xs text-muted-foreground">{student.attendancePercentage}%</span>
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              ) : (
                <TableRow>
                  <TableCell colSpan={3} className="h-24 text-center">
                    No students are marked as absent or late.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </ScrollArea>
      </CardContent>
    </Card>
  );
}
