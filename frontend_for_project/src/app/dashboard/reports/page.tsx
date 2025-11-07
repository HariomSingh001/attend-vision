'use client';

import { useState } from 'react';
import type { Student } from '@/lib/data';
import { studentsData } from '@/lib/data';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from '@/components/ui/button';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { FileDown } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';

export default function ReportsPage() {
  const [students, setStudents] = useState<Student[]>(studentsData);
  const { toast } = useToast();

  const handleDownloadReport = (student: Student) => {
    const reportContent = `
      Student Report
      ----------------
      ID: ${student.id}
      Name: ${student.name}
      Attendance Status: ${student.attendance}
      Overall Attendance: ${student.attendancePercentage}%
      ----------------
      This is a sample report.
    `;

    const blob = new Blob([reportContent], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `report-${student.name.replace(/\s+/g, '-')}.txt`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    
    toast({
      title: "Report Downloaded",
      description: `A report for ${student.name} has been downloaded.`,
    });
  };

  const attendanceBadge = (status: Student['attendance']) => {
    const variants = {
      present: 'bg-green-100 text-green-800 border-green-200 dark:bg-green-900/50 dark:text-green-300 dark:border-green-700',
      absent: 'bg-red-100 text-red-800 border-red-200 dark:bg-red-900/50 dark:text-red-300 dark:border-red-700',
      late: 'bg-yellow-100 text-yellow-800 border-yellow-200 dark:bg-yellow-900/50 dark:text-yellow-300 dark:border-yellow-700',
      pending: 'bg-gray-100 text-gray-800 border-gray-200 dark:bg-gray-700 dark:text-gray-300 dark:border-gray-600',
    };
    return cn('capitalize', variants[status || 'pending']);
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Student Reports</CardTitle>
        <CardDescription>Download individual attendance reports for each student.</CardDescription>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Student ID</TableHead>
              <TableHead>Student Name</TableHead>
              <TableHead>Attendance</TableHead>
              <TableHead className="text-right">Download</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {students.map((student) => (
              <TableRow key={student.id}>
                <TableCell>{student.id}</TableCell>
                <TableCell className="font-medium">{student.name}</TableCell>
                <TableCell>
                  <Badge variant="outline" className={attendanceBadge(student.attendance)}>
                    {student.attendance}
                  </Badge>
                </TableCell>
                <TableCell className="text-right">
                  <Button variant="outline" size="sm" onClick={() => handleDownloadReport(student)}>
                    <FileDown className="mr-2 h-4 w-4" />
                    Report
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}
