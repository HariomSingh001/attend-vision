
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
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { MoreVertical, UserPlus, Edit, Trash2, Repeat, Search } from 'lucide-react';
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
import type { Teacher } from '@/lib/data';
import { teacherApi, convertApiTeacherToFrontend } from '@/lib/api';
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
import { useToast } from '@/hooks/use-toast';

const teacherFormSchema = z.object({
    id: z.number().optional(),
    name: z.string().min(1, { message: "Name is required." }),
    teacherId: z.string().min(1, { message: "Teacher ID is required." }),
    email: z.string().email({ message: "Invalid email address." }).min(1, { message: "Email is required." }),
    subject: z.string().min(1, { message: "Subject is required." }),
    phone: z.string().min(1, { message: "Phone number is required." }),
    avatar: z.string().optional(),
});

type TeacherFormData = z.infer<typeof teacherFormSchema>;

export default function TeachersPage() {
  const [teachers, setTeachers] = useState<Teacher[]>([]);
  const [filteredTeachers, setFilteredTeachers] = useState<Teacher[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [isAddEditDialogOpen, setAddEditDialogOpen] = useState(false);
  const [isDeleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [selectedTeacher, setSelectedTeacher] = useState<Teacher | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const { toast } = useToast();

  // Load teachers from API on component mount
  useEffect(() => {
    loadTeachers();
  }, []);

  const loadTeachers = async () => {
    try {
      setIsLoading(true);
      const apiTeachers = await teacherApi.getAll();
      const frontendTeachers = apiTeachers.map(convertApiTeacherToFrontend);
      setTeachers(frontendTeachers);
    } catch (error) {
      toast({
        variant: 'destructive',
        title: 'Error Loading Teachers',
        description: 'Failed to load teachers from the database.',
      });
    } finally {
      setIsLoading(false);
    }
  };

  const form = useForm<TeacherFormData>({
    resolver: zodResolver(teacherFormSchema),
    defaultValues: {
      name: '',
      teacherId: '',
      email: '',
      subject: '',
      phone: '',
      avatar: '',
    },
  });
  
  useEffect(() => {
    const lowercasedQuery = searchQuery.toLowerCase();
    const filtered = teachers.filter((teacher) => {
      const nameMatch = teacher.name.toLowerCase().includes(lowercasedQuery);
      const emailMatch = teacher.email.toLowerCase().includes(lowercasedQuery);
      const idMatch = teacher.teacherId?.toLowerCase().includes(lowercasedQuery);
      return nameMatch || emailMatch || idMatch;
    });
    setFilteredTeachers(filtered);
  }, [searchQuery, teachers]);

  const onSubmit = async (data: TeacherFormData) => {
    try {
      if (data.id) {
        // Update existing teacher
        const existingTeacher = teachers.find(t => t.id === data.id);
        if (existingTeacher?.uuid) {
          await teacherApi.update({
            id: existingTeacher.uuid,
            name: data.name,
            teacherId: data.teacherId,
            email: data.email,
            subject: data.subject,
            phone: data.phone,
            avatar: data.avatar,
          });
          toast({
            title: "Teacher Updated",
            description: `The details for ${data.name} have been updated.`,
          });
        }
      } else {
        // Create new teacher
        await teacherApi.create({
          name: data.name,
          teacherId: data.teacherId,
          email: data.email,
          subject: data.subject,
          phone: data.phone,
          avatar: data.avatar,
        });
        toast({
          title: "Teacher Added",
          description: `${data.name} has been successfully added.`,
        });
      }
      
      // Reload teachers from database
      await loadTeachers();
      setAddEditDialogOpen(false);
      form.reset();
    } catch (error) {
      toast({
        variant: 'destructive',
        title: data.id ? "Update Failed" : "Creation Failed",
        description: `Failed to ${data.id ? 'update' : 'create'} teacher. Please try again.`,
      });
    }
  };

  const openAddDialog = () => {
    form.reset();
    setAddEditDialogOpen(true);
  };
  
  const openEditDialog = (teacher: Teacher) => {
    form.reset(teacher);
    setAddEditDialogOpen(true);
  };

  const openDeleteDialog = (teacher: Teacher) => {
    setSelectedTeacher(teacher);
    setDeleteDialogOpen(true);
  };

  const handleDeleteTeacher = async () => {
    if (selectedTeacher?.uuid) {
      try {
        await teacherApi.delete(selectedTeacher.uuid);
        toast({
          variant: 'destructive',
          title: 'Teacher Removed',
          description: `${selectedTeacher.name} has been removed.`,
        });
        // Reload teachers from database
        await loadTeachers();
      } catch (error) {
        toast({
          variant: 'destructive',
          title: 'Delete Failed',
          description: 'Failed to delete teacher. Please try again.',
        });
      }
    }
    setDeleteDialogOpen(false);
    setSelectedTeacher(null);
  };

  const toggleTeacherStatus = (teacherId: number) => {
    setTeachers(teachers.map(t => {
      if (t.id === teacherId) {
        const newStatus = t.status === 'active' ? 'on-leave' : 'active';
        toast({
            title: 'Status Updated',
            description: `${t.name}'s status is now ${newStatus === 'on-leave' ? 'On Leave' : 'Active'}.`
        });
        return { ...t, status: newStatus };
      }
      return t;
    }));
  };

  const avatar = form.watch('avatar');

  return (
    <div>
      <Card>
        <CardHeader>
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
              <div>
                <CardTitle>Teachers</CardTitle>
                <CardDescription>Manage teacher profiles and permissions.</CardDescription>
              </div>
              <div className="flex w-full sm:w-auto gap-2">
                <div className="relative flex-1 sm:flex-initial">
                  <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                  <Input
                    type="search"
                    placeholder="Search by name, email, or ID..."
                    className="pl-8 sm:w-64"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                  />
                </div>
                <Dialog open={isAddEditDialogOpen} onOpenChange={(isOpen) => {
                  if (!isOpen) form.reset();
                  setAddEditDialogOpen(isOpen);
                }}>
                    <DialogTrigger asChild>
                        <Button onClick={openAddDialog}>
                          <UserPlus className="mr-2" /> Add Teacher
                        </Button>
                    </DialogTrigger>
                    <DialogContent>
                        <DialogHeader>
                            <DialogTitle>{form.getValues('id') ? 'Edit Teacher' : 'Add New Teacher'}</DialogTitle>
                            <DialogDescription>
                              {form.getValues('id') ? 'Update the details of the teacher.' : 'Enter the details for the new teacher.'}
                            </DialogDescription>
                        </DialogHeader>
                        <Form {...form}>
                            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                                <FormField
                                    control={form.control}
                                    name="name"
                                    render={({ field }) => (
                                        <FormItem>
                                            <FormLabel>Name</FormLabel>
                                            <FormControl>
                                                <Input placeholder="Dr. Evelyn Reed" {...field} />
                                            </FormControl>
                                            <FormMessage />
                                        </FormItem>
                                    )}
                                />
                                <FormField
                                    control={form.control}
                                    name="teacherId"
                                    render={({ field }) => (
                                        <FormItem>
                                            <FormLabel>Teacher ID</FormLabel>
                                            <FormControl>
                                                <Input placeholder="T001" {...field} />
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
                                            <FormLabel>Email</FormLabel>
                                            <FormControl>
                                                <Input type="email" placeholder="teacher@school.com" {...field} />
                                            </FormControl>
                                            <FormMessage />
                                        </FormItem>
                                    )}
                                />
                                <FormField
                                    control={form.control}
                                    name="subject"
                                    render={({ field }) => (
                                        <FormItem>
                                            <FormLabel>Subject</FormLabel>
                                            <FormControl>
                                                <Input placeholder="Computer Science" {...field} />
                                            </FormControl>
                                            <FormMessage />
                                        </FormItem>
                                    )}
                                />
                                <FormField
                                    control={form.control}
                                    name="phone"
                                    render={({ field }) => (
                                        <FormItem>
                                            <FormLabel>Phone</FormLabel>
                                            <FormControl>
                                                <Input placeholder="+91 12345 67890" {...field} />
                                            </FormControl>
                                            <FormMessage />
                                        </FormItem>
                                    )}
                                />
                                <FormField
                                    control={form.control}
                                    name="avatar"
                                    render={({ field: { onChange, value, ...rest } }) => (
                                        <FormItem>
                                            <FormLabel>Picture</FormLabel>
                                            <div className="flex items-center gap-4">
                                                <FormControl>
                                                    <Input type="file" className="flex-1" {...rest} onChange={(e) => {
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
                                <DialogFooter>
                                    <DialogClose asChild>
                                        <Button type="button" variant="outline">Cancel</Button>
                                    </DialogClose>
                                    <Button type="submit">{form.getValues('id') ? 'Save Changes' : 'Add Teacher'}</Button>
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
                <TableHead>Teacher</TableHead>
                <TableHead className="hidden md:table-cell">Subject</TableHead>
                <TableHead className="hidden sm:table-cell">Status</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow>
                  <TableCell colSpan={3} className="h-24 text-center">
                    Loading teachers...
                  </TableCell>
                </TableRow>
              ) : filteredTeachers.length > 0 ? (
                filteredTeachers.map((teacher) => (
                <TableRow key={teacher.id}>
                  <TableCell className="font-medium">
                    <div className="flex items-center gap-3">
                      <Avatar>
                        <AvatarImage src={teacher.avatar} alt={teacher.name} data-ai-hint={teacher['data-ai-hint']} />
                        <AvatarFallback>{teacher.name.charAt(0)}</AvatarFallback>
                      </Avatar>
                      <div>
                        <div>{teacher.name}</div>
                        <div className="text-sm text-muted-foreground">{teacher.teacherId}</div>
                      </div>
                    </div>
                  </TableCell>
                  <TableCell className="hidden md:table-cell">{teacher.subject}</TableCell>
                  <TableCell className="hidden sm:table-cell">
                    <button onClick={() => toggleTeacherStatus(teacher.id)} className="p-0 bg-transparent border-none">
                        <Badge variant={teacher.status === 'on-leave' ? 'secondary' : 'default'} className="cursor-pointer">
                          {teacher.status === 'on-leave' ? 'On Leave' : 'Active'}
                        </Badge>
                    </button>
                  </TableCell>
                  <TableCell className="text-right">
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon">
                          <MoreVertical className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={() => openEditDialog(teacher)}>
                          <Edit className="mr-2 h-4 w-4" />
                          Edit
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => toggleTeacherStatus(teacher.id)}>
                            <Repeat className="mr-2 h-4 w-4" />
                            Change Status
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem className="text-red-500" onClick={() => openDeleteDialog(teacher)}>
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
                    No teachers found.
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
              This action cannot be undone. This will permanently remove {selectedTeacher?.name} from your records.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={handleDeleteTeacher}
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
