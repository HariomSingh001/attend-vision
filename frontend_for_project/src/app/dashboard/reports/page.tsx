'use client';

import { useState, useEffect } from 'react';
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
import { FileDown, Download, TrendingUp, TrendingDown, Users, Calendar, AlertTriangle, CheckCircle, FileText } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import { generateOverallReportPDF, generateStudentReportPDF } from '@/lib/pdfGenerator';
import {
  LineChart,
  Line,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts';

const API_BASE_URL = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:8000';

interface ReportOverview {
  summary: {
    total_students: number;
    total_records: number;
    overall_percentage: number;
    present_count: number;
    absent_count: number;
    late_count: number;
    total_alerts: number;
  };
  daily_attendance: Array<{
    date: string;
    present: number;
    absent: number;
    late: number;
    total: number;
    percentage: number;
  }>;
  student_statistics: Array<{
    id: string;
    name: string;
    roll_number: string;
    email: string;
    total_classes: number;
    present: number;
    absent: number;
    late: number;
    percentage: number;
    status: 'good' | 'warning' | 'critical';
  }>;
  low_attendance_students: Array<any>;
}

export default function ReportsPage() {
  const [reportData, setReportData] = useState<ReportOverview | null>(null);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();

  useEffect(() => {
    fetchReportData();
  }, []);

  const fetchReportData = async () => {
    try {
      setLoading(true);
      const response = await fetch(`${API_BASE_URL}/reports/overview`);
      const data = await response.json();
      
      if (data.status === 'success') {
        setReportData(data);
      } else {
        toast({
          variant: 'destructive',
          title: 'Error',
          description: 'Failed to load report data',
        });
      }
    } catch (error) {
      console.error('Error fetching report data:', error);
      toast({
        variant: 'destructive',
        title: 'Error',
        description: 'Failed to connect to server',
      });
    } finally {
      setLoading(false);
    }
  };

  const handleDownloadStudentReport = async (studentId: string, studentName: string, format: 'pdf' | 'text' = 'pdf') => {
    try {
      const response = await fetch(`${API_BASE_URL}/reports/student/${studentId}`);
      const data = await response.json();
      
      if (data.status === 'success') {
        if (format === 'pdf') {
          // Generate PDF report
          generateStudentReportPDF(data);
          toast({
            title: "PDF Report Downloaded",
            description: `PDF attendance report for ${studentName} has been downloaded.`,
          });
        } else {
          // Generate text report
          const reportContent = `
ATTENDANCE REPORT
${'='.repeat(60)}

Student Information:
${'-'.repeat(60)}
Name: ${data.student.name}
Roll Number: ${data.student.roll_number}
Email: ${data.student.email}

Attendance Summary:
${'-'.repeat(60)}
Total Classes: ${data.attendance_summary.total_classes}
Present: ${data.attendance_summary.present}
Absent: ${data.attendance_summary.absent}
Late: ${data.attendance_summary.late}
Attendance Percentage: ${data.attendance_summary.percentage}%
Status: ${data.attendance_summary.status.toUpperCase()}

Monthly Breakdown:
${'-'.repeat(60)}
${data.monthly_attendance.map((m: any) => 
  `${m.month}: ${m.percentage}% (${m.present}/${m.total} classes)`
).join('\n')}

Recent Attendance Records:
${'-'.repeat(60)}
${data.recent_records.slice(0, 10).map((r: any) => 
  `${r.date}: ${r.status.toUpperCase()}`
).join('\n')}

${'='.repeat(60)}
Generated: ${new Date().toLocaleString()}
          `;

          const blob = new Blob([reportContent], { type: 'text/plain;charset=utf-8' });
          const url = URL.createObjectURL(blob);
          const link = document.createElement('a');
          link.href = url;
          link.download = `attendance-report-${studentName.replace(/\s+/g, '-')}-${new Date().toISOString().split('T')[0]}.txt`;
          document.body.appendChild(link);
          link.click();
          document.body.removeChild(link);
          URL.revokeObjectURL(url);
          
          toast({
            title: "Text Report Downloaded",
            description: `Text attendance report for ${studentName} has been downloaded.`,
          });
        }
      }
    } catch (error) {
      toast({
        variant: 'destructive',
        title: 'Error',
        description: 'Failed to generate report',
      });
    }
  };

  const handleDownloadOverallReport = (format: 'pdf' | 'text' = 'pdf') => {
    if (!reportData) return;

    if (format === 'pdf') {
      // Generate PDF report
      generateOverallReportPDF(reportData);
      toast({
        title: "PDF Report Downloaded",
        description: "Overall attendance PDF report has been downloaded.",
      });
    } else {
      // Generate text report
      const reportContent = `
OVERALL ATTENDANCE REPORT
${'='.repeat(60)}

Summary Statistics:
${'-'.repeat(60)}
Total Students: ${reportData.summary.total_students}
Total Attendance Records: ${reportData.summary.total_records}
Overall Attendance: ${reportData.summary.overall_percentage}%
Present: ${reportData.summary.present_count}
Absent: ${reportData.summary.absent_count}
Late: ${reportData.summary.late_count}
Total Alerts Sent: ${reportData.summary.total_alerts}

Student Performance:
${'-'.repeat(60)}
${reportData.student_statistics.map(s => 
  `${s.name} (${s.roll_number}): ${s.percentage}% - ${s.status.toUpperCase()}`
).join('\n')}

Low Attendance Students (Below 75%):
${'-'.repeat(60)}
${reportData.low_attendance_students.length > 0 
  ? reportData.low_attendance_students.map(s => 
      `${s.name} (${s.roll_number}): ${s.percentage}% - ${s.present}/${s.total_classes} classes`
    ).join('\n')
  : 'No students with low attendance'}

${'='.repeat(60)}
Generated: ${new Date().toLocaleString()}
      `;

      const blob = new Blob([reportContent], { type: 'text/plain;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `overall-attendance-report-${new Date().toISOString().split('T')[0]}.txt`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
      
      toast({
        title: "Text Report Downloaded",
        description: "Overall attendance text report has been downloaded.",
      });
    }
  };

  const getStatusBadge = (status: string) => {
    const variants = {
      good: 'bg-green-100 text-green-800 border-green-200 dark:bg-green-900/50 dark:text-green-300 dark:border-green-700',
      warning: 'bg-yellow-100 text-yellow-800 border-yellow-200 dark:bg-yellow-900/50 dark:text-yellow-300 dark:border-yellow-700',
      critical: 'bg-red-100 text-red-800 border-red-200 dark:bg-red-900/50 dark:text-red-300 dark:border-red-700',
    };
    return cn('capitalize', variants[status as keyof typeof variants] || variants.good);
  };

  const COLORS = ['#10b981', '#ef4444', '#f59e0b'];

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto"></div>
          <p className="mt-4 text-muted-foreground">Loading reports...</p>
        </div>
      </div>
    );
  }

  if (!reportData) {
    return (
      <Card>
        <CardContent className="py-10">
          <p className="text-center text-muted-foreground">No report data available</p>
        </CardContent>
      </Card>
    );
  }

  const pieData = [
    { name: 'Present', value: reportData.summary.present_count },
    { name: 'Absent', value: reportData.summary.absent_count },
    { name: 'Late', value: reportData.summary.late_count },
  ];

  return (
    <div className="space-y-6">
      {/* Header with Download Buttons */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold">Attendance Reports</h1>
          <p className="text-muted-foreground">Comprehensive attendance analytics and insights</p>
        </div>
        <div className="flex gap-2">
          <Button onClick={() => handleDownloadOverallReport('pdf')} variant="default">
            <Download className="mr-2 h-4 w-4" />
            Download PDF
          </Button>
          <Button onClick={() => handleDownloadOverallReport('text')} variant="outline">
            <FileText className="mr-2 h-4 w-4" />
            Download Text
          </Button>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Students</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{reportData.summary.total_students}</div>
            <p className="text-xs text-muted-foreground">Enrolled students</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Overall Attendance</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{reportData.summary.overall_percentage}%</div>
            <p className="text-xs text-muted-foreground">
              {reportData.summary.present_count} / {reportData.summary.total_records} classes
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Low Attendance</CardTitle>
            <AlertTriangle className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{reportData.low_attendance_students.length}</div>
            <p className="text-xs text-muted-foreground">Students below 75%</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Alerts Sent</CardTitle>
            <Calendar className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{reportData.summary.total_alerts}</div>
            <p className="text-xs text-muted-foreground">Email notifications</p>
          </CardContent>
        </Card>
      </div>

      {/* Charts Row */}
      <div className="grid gap-4 md:grid-cols-2">
        {/* Attendance Trend Chart */}
        <Card>
          <CardHeader>
            <CardTitle>Attendance Trend (Last 30 Days)</CardTitle>
            <CardDescription>Daily attendance percentage over time</CardDescription>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={reportData.daily_attendance}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis 
                  dataKey="date" 
                  tick={{ fontSize: 12 }}
                  angle={-45}
                  textAnchor="end"
                  height={80}
                />
                <YAxis />
                <Tooltip />
                <Legend />
                <Line type="monotone" dataKey="percentage" stroke="#8884d8" name="Attendance %" />
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Attendance Distribution Pie Chart */}
        <Card>
          <CardHeader>
            <CardTitle>Attendance Distribution</CardTitle>
            <CardDescription>Overall attendance status breakdown</CardDescription>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <PieChart>
                <Pie
                  data={pieData}
                  cx="50%"
                  cy="50%"
                  labelLine={false}
                  label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(0)}%`}
                  outerRadius={80}
                  fill="#8884d8"
                  dataKey="value"
                >
                  {pieData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      {/* Student Performance Table */}
      <Card>
        <CardHeader>
          <CardTitle>Student Performance</CardTitle>
          <CardDescription>Individual student attendance statistics</CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Roll Number</TableHead>
                <TableHead>Student Name</TableHead>
                <TableHead>Total Classes</TableHead>
                <TableHead>Present</TableHead>
                <TableHead>Absent</TableHead>
                <TableHead>Attendance %</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Action</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {reportData.student_statistics.map((student) => (
                <TableRow key={student.id}>
                  <TableCell>{student.roll_number}</TableCell>
                  <TableCell className="font-medium">{student.name}</TableCell>
                  <TableCell>{student.total_classes}</TableCell>
                  <TableCell className="text-green-600">{student.present}</TableCell>
                  <TableCell className="text-red-600">{student.absent}</TableCell>
                  <TableCell>
                    <span className={cn(
                      "font-semibold",
                      student.percentage >= 75 ? "text-green-600" : 
                      student.percentage >= 60 ? "text-yellow-600" : "text-red-600"
                    )}>
                      {student.percentage}%
                    </span>
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline" className={getStatusBadge(student.status)}>
                      {student.status}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex gap-2 justify-end">
                      <Button 
                        variant="default" 
                        size="sm" 
                        onClick={() => handleDownloadStudentReport(student.id, student.name, 'pdf')}
                      >
                        <Download className="mr-2 h-4 w-4" />
                        PDF
                      </Button>
                      <Button 
                        variant="outline" 
                        size="sm" 
                        onClick={() => handleDownloadStudentReport(student.id, student.name, 'text')}
                      >
                        <FileText className="mr-2 h-4 w-4" />
                        Text
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Low Attendance Alert */}
      {reportData.low_attendance_students.length > 0 && (
        <Card className="border-red-200 bg-red-50 dark:bg-red-950/20">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-red-700 dark:text-red-400">
              <AlertTriangle className="h-5 w-5" />
              Low Attendance Alert
            </CardTitle>
            <CardDescription>Students requiring immediate attention</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {reportData.low_attendance_students.map((student) => (
                <div key={student.id} className="flex items-center justify-between p-3 bg-white dark:bg-gray-900 rounded-lg">
                  <div>
                    <p className="font-medium">{student.name} ({student.roll_number})</p>
                    <p className="text-sm text-muted-foreground">
                      {student.present}/{student.total_classes} classes attended
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-lg font-bold text-red-600">{student.percentage}%</p>
                    <p className="text-xs text-muted-foreground">Attendance</p>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
