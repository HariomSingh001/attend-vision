'use client';

import { useState, useEffect } from 'react';
import type { Student } from '@/lib/data';
import { studentApi, convertApiStudentToFrontend } from '@/lib/api';
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
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from '@/components/ui/dropdown-menu';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogTrigger,
  DialogClose,
} from '@/components/ui/dialog';
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
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { MoreVertical, UserPlus, Edit, Trash2, Ban, Search, MailWarning } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useToast } from '@/hooks/use-toast';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';

const studentFormSchema = z.object({
  id: z.number().optional(),
  firstName: z.string().min(1, { message: "First name is required." }),
  lastName: z.string().min(1, { message: "Last name is required." }),
  studentId: z.string().min(1, { message: "Student ID is required." }),
  email: z.string().email({ message: "Invalid email address." }),
  contact: z.string().min(1, { message: "Contact is required." }),
  address: z.string().min(1, { message: "Address is required." }),
  avatar: z.string().optional(),
});

type StudentFormData = z.infer<typeof studentFormSchema>;

export default function StudentsPage() {
  const [students, setStudents] = useState<Student[]>([]);
  const [filteredStudents, setFilteredStudents] = useState<Student[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [isAddEditDialogOpen, setAddEditDialogOpen] = useState(false);
  const [isDeleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [selectedStudent, setSelectedStudent] = useState<Student | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const router = useRouter();
  const { toast } = useToast();

  const form = useForm<StudentFormData>({
    resolver: zodResolver(studentFormSchema),
    defaultValues: {
      firstName: '',
      lastName: '',
      studentId: '',
      email: '',
      contact: '',
      address: '',
      avatar: '',
    },
  });

  // Load students from API on component mount
  useEffect(() => {
    loadStudents();
  }, []);

  // Filter students based on search query
  useEffect(() => {
    const lowercasedQuery = searchQuery.toLowerCase();
    const filtered = students.filter((student) => {
      const nameMatch = student.name.toLowerCase().includes(lowercasedQuery);
      const idMatch = student.studentId?.toLowerCase().includes(lowercasedQuery);
      return nameMatch || idMatch;
    });
    setFilteredStudents(filtered);
  }, [searchQuery, students]);

  const loadStudents = async () => {
    try {
      setIsLoading(true);
      const apiStudents = await studentApi.getAll();
      const frontendStudents = apiStudents.map(convertApiStudentToFrontend);
      setStudents(frontendStudents);
    } catch (error) {
      toast({
        variant: 'destructive',
        title: 'Error Loading Students',
        description: 'Failed to load students from the database.',
      });
    } finally {
      setIsLoading(false);
    }
  };

  const onSubmit = async (data: StudentFormData) => {
    const studentName = `${data.firstName} ${data.lastName}`.trim();
    try {
      if (data.id) {
        // Update existing student
        const existingStudent = students.find(s => s.id === data.id);
        if (existingStudent?.uuid) {
          await studentApi.update({
            id: existingStudent.uuid,
            firstName: data.firstName,
            lastName: data.lastName,
            studentId: data.studentId,
            email: data.email,
            contact: data.contact,
            address: data.address,
            avatar: data.avatar,
          });
          toast({
            title: "Student Updated",
            description: `The details for ${studentName} have been updated.`,
          });
        }
      } else {
        // Create new student
        await studentApi.create({
          firstName: data.firstName,
          lastName: data.lastName,
          studentId: data.studentId,
          email: data.email,
          contact: data.contact,
          address: data.address,
          avatar: data.avatar,
        });
        toast({
          title: "Student Added",
          description: `${studentName} has been successfully added to the roster.`,
        });
      }
      
      // Reload students from database
      await loadStudents();
      setAddEditDialogOpen(false);
      form.reset();
    } catch (error) {
      toast({
        variant: 'destructive',
        title: data.id ? "Update Failed" : "Creation Failed",
        description: `Failed to ${data.id ? 'update' : 'create'} student. Please try again.`,
      });
    }
  };

  const openAddDialog = () => {
    setSelectedStudent(null);
    form.reset();
    setAddEditDialogOpen(true);
  };

  const openEditDialog = (student: Student) => {
    const nameParts = student.name.split(' ');
    setSelectedStudent(student);
    form.reset({
        id: student.id,
        firstName: nameParts[0] || '',
        lastName: nameParts.slice(1).join(' ') || '',
        studentId: student.studentId || '',
        email: student.email || '',
        contact: student.contact || '',
        address: student.address || '',
        avatar: student.avatar || '',
    });
    setAddEditDialogOpen(true);
  };

  const openDeleteDialog = (student: Student) => {
    setSelectedStudent(student);
    setDeleteDialogOpen(true);
  };

  const handleDeleteStudent = async () => {
    if (selectedStudent?.uuid) {
      try {
        await studentApi.delete(selectedStudent.uuid);
        toast({
          variant: 'destructive',
          title: 'Student Removed',
          description: `${selectedStudent.name} has been removed from the roster.`,
        });
        // Reload students from database
        await loadStudents();
      } catch (error) {
        toast({
          variant: 'destructive',
          title: 'Delete Failed',
          description: 'Failed to delete student. Please try again.',
        });
      }
    }
    setDeleteDialogOpen(false);
    setSelectedStudent(null);
  };

  const handleSendAlert = async (student: Student) => {
    if (!student.uuid) {
      toast({
        variant: 'destructive',
        title: 'Error',
        description: 'Student ID not found.',
      });
      return;
    }

    try {
      const result = await studentApi.sendAlert(student.uuid);
      
      if (result.status === 'success') {
        toast({
          title: 'Alert Sent',
          description: result.message || `Low attendance alert has been sent to ${student.name}.`,
        });
      } else {
        toast({
          variant: 'destructive',
          title: 'Failed to Send Alert',
          description: result.message || 'Unable to send alert. Please try again.',
        });
      }
    } catch (error) {
      toast({
        variant: 'destructive',
        title: 'Error',
        description: 'Failed to send alert. Please check your connection.',
      });
    }
  };

  const toggleBlockStudent = async (studentId: number) => {
    const student = students.find(s => s.id === studentId);
    if (student?.uuid) {
      try {
        const isBlocked = student.status === 'blocked';
        const newStatus = isBlocked ? 'active' : 'blocked';
        
        // Update locally first for immediate feedback
        setStudents(students.map(s => 
          s.id === studentId ? { ...s, status: newStatus } : s
        ));
        
        // Note: You may need to add a status update endpoint to the backend
        // For now, this will just update the local state
        toast({
          title: isBlocked ? 'Student Unblocked' : 'Student Blocked',
          description: `${student.name} has been ${isBlocked ? 'unblocked' : 'blocked'}.`,
        });
      } catch (error) {
        // Revert the change if API call fails
        await loadStudents();
        toast({
          variant: 'destructive',
          title: 'Update Failed',
          description: 'Failed to update student status.',
        });
      }
    }
  };
  
  const handleRowClick = (studentId: number) => {
    router.push(`/dashboard/students/${studentId}`);
  };

  const avatar = form.watch('avatar');

  return (
    <div>
      <Card>
        <CardHeader>
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div>
              <CardTitle>Students</CardTitle>
              <CardDescription>Manage your student roster.</CardDescription>
            </div>
            <div className="flex w-full sm:w-auto gap-2">
              <div className="relative flex-1 sm:flex-initial">
                <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  type="search"
                  placeholder="Search by name or ID..."
                  className="pl-8 sm:w-64"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                />
              </div>
              <Dialog open={isAddEditDialogOpen} onOpenChange={(isOpen) => {
                setAddEditDialogOpen(isOpen);
                if (!isOpen) {
                  form.reset();
                }
              }}>
                <DialogTrigger asChild>
                  <Button onClick={openAddDialog}>
                    <UserPlus className="mr-2" /> Add Student
                  </Button>
                </DialogTrigger>
                <DialogContent className="sm:max-w-2xl">
                  <DialogHeader>
                    <DialogTitle>{form.getValues('id') ? 'Edit Student' : 'Add New Student'}</DialogTitle>
                    <DialogDescription>
                      {form.getValues('id') ? 'Update the details of the student.' : 'Enter the details for the new student.'}
                    </DialogDescription>
                  </DialogHeader>
                  <Form {...form}>
                    <form onSubmit={form.handleSubmit(onSubmit)}>
                      <div className="space-y-4 py-4">
                        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                           <FormField
                            control={form.control}
                            name="firstName"
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel>First Name</FormLabel>
                                <FormControl>
                                  <Input placeholder="First name" {...field} />
                                </FormControl>
                                <FormMessage />
                              </FormItem>
                            )}
                          />
                           <FormField
                            control={form.control}
                            name="lastName"
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel>Last Name</FormLabel>
                                <FormControl>
                                  <Input placeholder="Last Name" {...field} />
                                </FormControl>
                                <FormMessage />
                              </FormItem>
                            )}
                          />
                        </div>
                         <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                           <FormField
                            control={form.control}
                            name="studentId"
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel>Student ID</FormLabel>
                                <FormControl>
                                  <Input placeholder="Student ID" {...field} />
                                </FormControl>
                                <FormMessage />
                              </FormItem>
                            )}
                          />
                           <FormField
                            control={form.control}
                            name="email"
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel>Email Address</FormLabel>
                                <FormControl>
                                  <Input type="email" placeholder="student@school.com" {...field} />
                                </FormControl>
                                <FormMessage />
                              </FormItem>
                            )}
                          />
                        </div>
                         <FormField
                            control={form.control}
                            name="contact"
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel>Student Contact</FormLabel>
                                <FormControl>
                                  <Input placeholder="+91 12345 67890" {...field} />
                                </FormControl>
                                <FormMessage />
                              </FormItem>
                            )}
                          />
                         <FormField
                            control={form.control}
                            name="address"
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel>Student Address</FormLabel>
                                <FormControl>
                                  <Input placeholder="Student Address" {...field} />
                                </FormControl>
                                <FormMessage />
                              </FormItem>
                            )}
                          />
                         <FormField
                            control={form.control}
                            name="avatar"
                            render={({ field: { onChange, value, ...rest }}) => (
                              <FormItem>
                                <FormLabel>Picture</FormLabel>
                                 <div className="flex items-center gap-4">
                                    <FormControl>
                                        <Input id="picture" type="file" className="flex-1" {...rest} onChange={(e) => {
                                            if (e.target.files && e.target.files[0]) {
                                                const file = e.target.files[0];
                                                const reader = new FileReader();
                                                reader.onloadend = () => {
                                                    onChange(reader.result as string);
                                                };
                                                reader.readAsDataURL(file);
                                            }
                                        }} />
                                    </FormControl>
                                    {avatar && <Avatar><AvatarImage src={avatar} /></Avatar>}
                                </div>
                                <FormMessage />
                              </FormItem>
                            )}
                          />
                      </div>
                      <DialogFooter>
                        <DialogClose asChild>
                          <Button variant="outline" type="button">Cancel</Button>
                        </DialogClose>
                        <Button type="submit">
                          {form.getValues('id') ? 'Save Changes' : 'Add Student'}
                        </Button>
                      </DialogFooter>
                    </form>
                  </Form>
                </DialogContent>
              </Dialog>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Student</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Attendance</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow>
                  <TableCell colSpan={4} className="h-24 text-center">
                    Loading students...
                  </TableCell>
                </TableRow>
              ) : filteredStudents.length > 0 ? (
                filteredStudents.map((student) => (
                  <TableRow key={student.id} className={`${student.status === 'blocked' ? 'opacity-50' : ''} cursor-pointer hover:bg-muted/50`} onClick={() => handleRowClick(student.id)}>
                    <TableCell className="font-medium">
                      <div className="flex items-center gap-3">
                        <Avatar>
                          <AvatarImage src={student.avatar} alt={student.name} data-ai-hint={student['data-ai-hint']} />
                          <AvatarFallback>{student.name.charAt(0)}</AvatarFallback>
                        </Avatar>
                        <div>
                          <div>{student.name}</div>
                          {student.studentId && <div className="text-xs text-muted-foreground">{student.studentId}</div>}
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant={student.status === 'blocked' ? 'destructive' : 'secondary'}>
                        {student.status === 'blocked' ? 'Blocked' : 'Active'}
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
                        <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
                          <Button variant="ghost" size="icon">
                            <MoreVertical className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={(e) => { e.stopPropagation(); openEditDialog(student); }}>
                            <Edit className="mr-2 h-4 w-4" />
                            Edit
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={(e) => { e.stopPropagation(); toggleBlockStudent(student.id)}}>
                            <Ban className="mr-2 h-4 w-4" />
                            {student.status === 'blocked' ? 'Unblock' : 'Block'}
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={(e) => { e.stopPropagation(); handleSendAlert(student); }}>
                            <MailWarning className="mr-2 h-4 w-4 text-yellow-500" />
                            Send Alert
                          </DropdownMenuItem>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem className="text-red-500" onClick={(e) => { e.stopPropagation(); openDeleteDialog(student)}}>
                            <Trash2 className="mr-2 h-4 w-4" />
                            Remove
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
        </CardContent>
      </Card>
      
      <AlertDialog open={isDeleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Are you sure?</AlertDialogTitle>
            <AlertDialogDescription>
              This action cannot be undone. This will permanently remove {selectedStudent?.name} from your roster.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={handleDeleteStudent}
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
