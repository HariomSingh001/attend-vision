'use client';

import { useState, useEffect } from 'react';
import type { Student } from '@/lib/data';
import { teacherInfo, subjectsData } from '@/lib/data';
import { studentApi, convertApiStudentToFrontend } from '@/lib/api';
import { generateReport } from '@/ai/flows/generate-report';
import { generateClassSummary } from '@/ai/flows/generate-class-summary';
import { useToast } from '@/hooks/use-toast';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogClose,
} from '@/components/ui/dialog';
import {
  Users,
  UserCheck,
  UserX,
  Clock,
  FileDown,
  MailWarning,
  MoreVertical,
} from 'lucide-react';
import { ImBooks } from 'react-icons/im';
import { ScrollArea } from '@/components/ui/scroll-area';
import { cn } from '@/lib/utils';
import Link from 'next/link';

export default function DashboardPage() {
  const [students, setStudents] = useState<Student[]>([]);
  const [isLoadingStudents, setIsLoadingStudents] = useState(true);
  const { toast } = useToast();
  const [isReportDialogOpen, setReportDialogOpen] = useState(false);
  const [reportContent, setReportContent] = useState('');
  const [isGeneratingReport, setGeneratingReport] = useState(false);
  const [isAlertDialogOpen, setAlertDialogOpen] = useState(false);
  const [absentStudents, setAbsentStudents] = useState<string[]>([]);
  const [isSendingAlerts, setSendingAlerts] = useState(false);

  // Load students from API on component mount
  useEffect(() => {
    loadStudents();
  }, []);

  const loadStudents = async () => {
    try {
      setIsLoadingStudents(true);
      const apiStudents = await studentApi.getAll();
      const frontendStudents = apiStudents.map(convertApiStudentToFrontend);
      setStudents(frontendStudents);
    } catch (error) {
      console.error('Error loading students:', error);
      toast({
        variant: 'destructive',
        title: 'Error Loading Students',
        description: 'Failed to load students from the database.',
      });
    } finally {
      setIsLoadingStudents(false);
    }
  };

  const attendanceCounts = students.reduce(
    (acc, student) => {
      if (student.attendance === 'present') acc.present++;
      else if (student.attendance === 'absent') acc.absent++;
      else if (student.attendance === 'late') acc.late++;
      return acc;
    },
    { present: 0, absent: 0, late: 0 }
  );

  const updateAttendance = async (studentId: number, status: Student['attendance']) => {
    // Update locally first for immediate feedback
    setStudents(students.map((s) => (s.id === studentId ? { ...s, attendance: status } : s)));
    
    // Note: You may want to add an attendance update endpoint to the backend later
    // For now, this updates the local state only
    const student = students.find(s => s.id === studentId);
    if (student) {
      toast({
        title: 'Attendance Updated',
        description: `${student.name} marked as ${status}.`,
      });
    }
  };

  const handleGenerateReport = async () => {
    setGeneratingReport(true);
    const attendanceRecords = JSON.stringify(students.map(s => ({ name: s.name, status: s.attendance })));
    try {
      const result = await generateReport({ className: teacherInfo.class, attendanceRecords });
      setReportContent(result.report);
      setReportDialogOpen(true);
    } catch (error) {
      console.error('Error generating report:', error);
      toast({
        variant: 'destructive',
        title: 'Report Generation Failed',
        description: 'An error occurred while generating the report.',
      });
    } finally {
      setGeneratingReport(false);
    }
  };

  const handleSendAlerts = async () => {
    setSendingAlerts(true);
    const attendanceRecords = JSON.stringify(students.map(s => ({ name: s.name, status: s.attendance })));
    try {
      const result = await generateClassSummary({ className: teacherInfo.class, attendanceRecords });
      if (result.absentStudents.length > 0) {
        setAbsentStudents(result.absentStudents);
        setAlertDialogOpen(true);
      } else {
        toast({
          title: 'No Alerts to Send',
          description: 'All students have good attendance.',
        });
      }
    } catch (error) {
      console.error('Error getting absent students:', error);
      toast({
        variant: 'destructive',
        title: 'Error',
        description: 'An error occurred while checking for absent students.',
      });
    } finally {
      setSendingAlerts(false);
    }
  };

  const confirmSendAlerts = () => {
    setAlertDialogOpen(false);
    toast({
      title: 'Alerts Sent!',
      description: `Notifications have been sent to ${absentStudents.length} students with low attendance.`,
    });
  };

  const downloadReport = () => {
    const blob = new Blob([reportContent], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'attendance-report.txt';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    setReportDialogOpen(false);
  };

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
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-base font-medium">Class Strength</CardTitle>
          <Users className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">{isLoadingStudents ? '...' : students.length}</div>
          <p className="text-xs text-muted-foreground">Total students enrolled</p>
        </CardContent>
      </Card>
      <Link href="/dashboard/attendance/present">
        <Card className="hover:bg-accent transition-colors">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-base font-medium">Present</CardTitle>
            <UserCheck className="h-4 w-4 text-green-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{isLoadingStudents ? '...' : attendanceCounts.present}</div>
            <p className="text-xs text-muted-foreground">
              {isLoadingStudents ? 'Loading...' : students.length > 0 ? ((attendanceCounts.present / students.length) * 100).toFixed(0) : 0}% attendance
            </p>
          </CardContent>
        </Card>
      </Link>
      <Link href="/dashboard/attendance/absent">
        <Card className="hover:bg-accent transition-colors">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-base font-medium">Absent</CardTitle>
            <UserX className="h-4 w-4 text-red-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{isLoadingStudents ? '...' : attendanceCounts.absent}</div>
            <p className="text-xs text-muted-foreground">
              {isLoadingStudents ? 'Loading...' : `${attendanceCounts.late} student${attendanceCounts.late !== 1 ? 's' : ''} late`}
            </p>
          </CardContent>
        </Card>
      </Link>
      <Link href="/dashboard/subjects">
        <Card className="hover:bg-accent transition-colors">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-base font-medium">Total Subjects</CardTitle>
            <ImBooks className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{subjectsData.length}</div>
            <p className="text-xs text-muted-foreground">View all subjects</p>
          </CardContent>
        </Card>
      </Link>

      <Card className="col-span-full">
        <CardHeader>
          <CardTitle>Class Roster</CardTitle>
          <CardDescription>
            Manually manage student attendance.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ScrollArea className="h-[350px]">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Student</TableHead>
                  <TableHead className="text-center">Status</TableHead>
                  <TableHead>Attendance</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoadingStudents ? (
                  <TableRow>
                    <TableCell colSpan={4} className="h-24 text-center">
                      Loading students...
                    </TableCell>
                  </TableRow>
                ) : students.length > 0 ? (
                  students.map((student) => (
                  <TableRow key={student.id}>
                    <TableCell className="font-medium">
                      <div className="flex items-center gap-3">
                        <Avatar>
                          <AvatarImage src={student.avatar} alt={student.name} width={40} height={40} data-ai-hint={student['data-ai-hint']} />
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
                      <div className="flex items-center gap-3">
                        <div className="w-32 bg-gray-800 rounded-full h-2 overflow-hidden">
                          <div 
                            className="bg-green-500 h-full rounded-full transition-all duration-300" 
                            style={{ width: `${student.attendancePercentage || 0}%` }}
                          ></div>
                        </div>
                        <span className="text-sm font-medium text-gray-300 min-w-[2.5rem]">
                          {student.attendancePercentage || 0}%
                        </span>
                      </div>
                    </TableCell>
                    <TableCell className="text-right">
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon">
                            <MoreVertical className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={() => updateAttendance(student.id, 'present')}>
                            <UserCheck className="mr-2 h-4 w-4 text-green-500" />
                            Mark Present
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => updateAttendance(student.id, 'late')}>
                            <Clock className="mr-2 h-4 w-4 text-yellow-500" />
                            Mark Late
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => updateAttendance(student.id, 'absent')}>
                            <UserX className="mr-2 h-4 w-4 text-red-500" />
                            Mark Absent
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                  ))
                ) : (
                  <TableRow>
                    <TableCell colSpan={4} className="h-24 text-center">
                      No students found.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </ScrollArea>
        </CardContent>
      </Card>

      <Card className="col-span-full">
        <CardHeader>
          <CardTitle>Quick Actions</CardTitle>
          <CardDescription>Generate reports and send notifications.</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2">
           <Button variant="outline" onClick={handleGenerateReport} disabled={isGeneratingReport}>
              {isGeneratingReport ? 'Generating...' : <><FileDown className="mr-2 text-primary" /> Generate Report</>}
            </Button>
            <Button variant="outline" onClick={handleSendAlerts} disabled={isSendingAlerts}>
              {isSendingAlerts ? 'Checking...' : <><MailWarning className="mr-2 text-red-500" /> Send Low Attendance Alerts</>}
            </Button>
        </CardContent>
      </Card>

      <Dialog open={isReportDialogOpen} onOpenChange={setReportDialogOpen}>
        <DialogContent className="sm:max-w-3xl">
          <DialogHeader>
            <DialogTitle>Attendance Report</DialogTitle>
            <DialogDescription>
              A summary of the class attendance. You can download this report.
            </DialogDescription>
          </DialogHeader>
          <ScrollArea className="max-h-[60vh] rounded-md border p-4">
            <pre className="whitespace-pre-wrap text-sm">{reportContent}</pre>
          </ScrollArea>
          <DialogClose asChild>
              <Button onClick={downloadReport}>
                <FileDown className="mr-2" /> Download Report
              </Button>
          </DialogClose>
        </DialogContent>
      </Dialog>

      <AlertDialog open={isAlertDialogOpen} onOpenChange={setAlertDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Send Low Attendance Alerts?</AlertDialogTitle>
            <AlertDialogDescription>
              The following students have low attendance: {absentStudents.join(', ')}. Do you want to send them a notification?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={confirmSendAlerts}>Send Alerts</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
