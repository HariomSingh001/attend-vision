'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Plus, Trash, Edit, Book } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { useToast } from '@/hooks/use-toast';
import { formatSubjectsForDisplay, SubjectDisplay, ApiSubject } from '@/lib/subjects';

const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:8000';

export default function SubjectsPage() {
  const [subjects, setSubjects] = useState<SubjectDisplay[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [currentSubject, setCurrentSubject] = useState<Partial<ApiSubject>>({});
  const [isEditing, setIsEditing] = useState(false);
  const { toast } = useToast();

  // Fetch subjects from backend
  const fetchSubjects = async () => {
    setIsLoading(true);
    try {
      const response = await fetch(`${BACKEND_URL}/subjects`);
      const data = await response.json();
      if (data.status === 'success') {
        setSubjects(formatSubjectsForDisplay(data.subjects || []));
      }
    } catch (error) {
      console.error('Error fetching subjects:', error);
      toast({
        title: 'Error',
        description: 'Failed to load subjects',
        variant: 'destructive'
      });
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchSubjects();
  }, []);

  const handleAddSubject = () => {
    setCurrentSubject({ name: '', code: '', description: '' });
    setIsEditing(false);
    setIsDialogOpen(true);
  };

  const handleEditSubject = (subject: SubjectDisplay) => {
    setCurrentSubject({
      id: subject.id,
      name: subject.name,
      code: subject.code,
      description: subject.description ?? ''
    });
    setIsEditing(true);
    setIsDialogOpen(true);
  };

  const handleDeleteSubject = async (id: string) => {
    if (confirm('Are you sure you want to delete this subject?')) {
      try {
        const response = await fetch(`${BACKEND_URL}/subjects/${id}`, { method: 'DELETE' });
        const data = await response.json();
        if (data.status === 'success') {
          toast({
            title: 'Success',
            description: 'Subject deleted successfully'
          });
          fetchSubjects();
        }
      } catch (error) {
        console.error('Error deleting subject:', error);
        toast({
          title: 'Error',
          description: 'Failed to delete subject',
          variant: 'destructive'
        });
      }
    }
  };

  const handleSubmit = async () => {
    if (!currentSubject.name) {
      toast({
        title: 'Error',
        description: 'Subject name is required',
        variant: 'destructive'
      });
      return;
    }

    if (!currentSubject.code) {
      toast({
        title: 'Error',
        description: 'Subject code is required',
        variant: 'destructive'
      });
      return;
    }

    const url = isEditing 
      ? `${BACKEND_URL}/subjects/${currentSubject.id}` 
      : `${BACKEND_URL}/subjects`;
      
    const method = isEditing ? 'PUT' : 'POST';
    
    try {
      const response = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: currentSubject.name,
          code: currentSubject.code,
          description: currentSubject.description
        })
      });
      
      const data = await response.json();
      if (data.status === 'success') {
        toast({
          title: 'Success',
          description: isEditing ? 'Subject updated successfully' : 'Subject added successfully'
        });
        setIsDialogOpen(false);
        fetchSubjects();
      }
    } catch (error) {
      console.error('Error saving subject:', error);
      toast({
        title: 'Error',
        description: 'Failed to save subject',
        variant: 'destructive'
      });
    }
  };

  return (
    <div>
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle>Subjects</CardTitle>
            <CardDescription>Manage your academic subjects</CardDescription>
          </div>
          <Button onClick={handleAddSubject}>
            <Plus className="mr-2 h-4 w-4" /> Add Subject
          </Button>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <p>Loading subjects...</p>
          ) : subjects.length === 0 ? (
            <div className="text-center py-8">
              <Book className="mx-auto h-12 w-12 text-muted-foreground mb-4" />
              <p className="text-muted-foreground">No subjects found. Add your first subject!</p>
            </div>
          ) : (
            <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
              {subjects.map((subject) => (
                <Link href={`/dashboard/subjects/${subject.id}`} key={subject.id}>
                  <Card className="hover:bg-accent transition-colors">
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                      <CardTitle className="text-base font-medium">
                        {subject.displayName}
                      </CardTitle>
                      {subject.icon}
                    </CardHeader>
                    <CardContent>
                      <p className="text-sm text-muted-foreground">View attendance details</p>
                      {subject.code && (
                        <p className="mt-2 text-xs text-muted-foreground">Code: {subject.code}</p>
                      )}
                      <div className="mt-4 flex justify-end gap-2">
                        <Button 
                          variant="outline" 
                          size="icon"
                          onClick={(e) => {
                            e.preventDefault();
                            handleEditSubject(subject);
                          }}
                        >
                          <Edit className="h-4 w-4" />
                        </Button>
                        <Button 
                          variant="outline" 
                          size="icon"
                          onClick={(e) => {
                            e.preventDefault();
                            handleDeleteSubject(subject.id);
                          }}
                        >
                          <Trash className="h-4 w-4 text-red-500" />
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                </Link>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Add/Edit Subject Dialog */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{isEditing ? 'Edit Subject' : 'Add New Subject'}</DialogTitle>
            <DialogDescription>
              {isEditing ? 'Update subject details' : 'Enter details for the new subject'}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <label className="block mb-1 text-sm font-medium">Subject Name</label>
              <Input 
                value={currentSubject.name || ''}
                onChange={(e) => setCurrentSubject({...currentSubject, name: e.target.value})}
                placeholder="Mathematics"
              />
            </div>
            <div>
              <label className="block mb-1 text-sm font-medium">Subject Code</label>
              <Input 
                value={currentSubject.code || ''}
                onChange={(e) => setCurrentSubject({...currentSubject, code: e.target.value.toUpperCase()})}
                placeholder="MATH101"
              />
            </div>
            <div>
              <label className="block mb-1 text-sm font-medium">Description</label>
              <Input 
                value={currentSubject.description || ''}
                onChange={(e) => setCurrentSubject({...currentSubject, description: e.target.value})}
                placeholder="Algebra, Geometry, Calculus"
              />
            </div>
            <Button onClick={handleSubmit} className="w-full">
              {isEditing ? 'Update Subject' : 'Add Subject'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
