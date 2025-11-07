'use client';

import { useParams } from 'next/navigation';
import { useState, useEffect } from 'react';
import { studentApi, convertApiStudentToFrontend } from '@/lib/api';
import type { Student } from '@/lib/data';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Mail, Phone, Home, BarChart2 } from 'lucide-react';
import { Progress } from '@/components/ui/progress';

export default function StudentDetailPage() {
  const params = useParams();
  const studentId = Array.isArray(params.id) ? params.id[0] : params.id;
  const [student, setStudent] = useState<Student | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const loadStudent = async () => {
      try {
        setIsLoading(true);
        const apiStudents = await studentApi.getAll();
        const frontendStudents = apiStudents.map(convertApiStudentToFrontend);
        const foundStudent = frontendStudents.find(s => s.id.toString() === studentId);
        setStudent(foundStudent || null);
      } catch (error) {
        console.error('Error loading student:', error);
        setStudent(null);
      } finally {
        setIsLoading(false);
      }
    };

    loadStudent();
  }, [studentId]);

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Loading...</CardTitle>
          <CardDescription>Loading student information...</CardDescription>
        </CardHeader>
      </Card>
    );
  }

  if (!student) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Student Not Found</CardTitle>
          <CardDescription>The student you are looking for does not exist.</CardDescription>
        </CardHeader>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
            <div className='flex items-center space-x-4'>
                <Avatar className="h-24 w-24 border-2 border-primary">
                    <AvatarImage src={student.avatar} alt={student.name} data-ai-hint={student['data-ai-hint']} />
                    <AvatarFallback className="text-4xl">{student.name.charAt(0)}</AvatarFallback>
                </Avatar>
                <div>
                    <CardTitle className="text-4xl">{student.name}</CardTitle>
                    <CardDescription className="text-lg text-muted-foreground">{student.studentId || `ID: ${student.id}`}</CardDescription>
                    <Badge variant={student.status === 'blocked' ? 'destructive' : 'secondary'} className="mt-2">
                        {student.status === 'blocked' ? 'Blocked' : 'Active'}
                    </Badge>
                </div>
            </div>
        </CardHeader>
        <CardContent className="grid gap-6 md:grid-cols-2">
            <div className="space-y-4">
                <h3 className="text-lg font-medium">Contact Information</h3>
                <div className="flex items-center gap-4 text-sm">
                    <Mail className="h-5 w-5 text-muted-foreground" />
                    <span>{student.email || 'No email provided'}</span>
                </div>
                <div className="flex items-center gap-4 text-sm">
                    <Phone className="h-5 w-5 text-muted-foreground" />
                    <span>{student.contact || 'No contact provided'}</span>
                </div>
                <div className="flex items-center gap-4 text-sm">
                    <Home className="h-5 w-5 text-muted-foreground" />
                    <span>{student.address || 'No address provided'}</span>
                </div>
            </div>
            <div className="space-y-4">
                <h3 className="text-lg font-medium">Attendance Statistics</h3>
                <div className="flex items-center gap-4">
                    <BarChart2 className="h-5 w-5 text-muted-foreground" />
                    <div className="w-full">
                        <div className="flex justify-between text-sm">
                           <span>Overall Attendance</span>
                           <span className="font-semibold">{student.attendancePercentage}%</span>
                        </div>
                        <Progress value={student.attendancePercentage} className="h-2 mt-1" />
                    </div>
                </div>
                 <div className="flex items-center gap-4 text-sm">
                    <span className="font-semibold">Today's Status:</span>
                    <Badge variant="outline" className={`capitalize ${
                        student.attendance === 'present' ? 'bg-green-100 text-green-800' :
                        student.attendance === 'absent' ? 'bg-red-100 text-red-800' :
                        student.attendance === 'late' ? 'bg-yellow-100 text-yellow-800' :
                        'bg-gray-100 text-gray-800'
                    }`}>
                        {student.attendance}
                    </Badge>
                </div>
            </div>
        </CardContent>
      </Card>
    </div>
  );
}
