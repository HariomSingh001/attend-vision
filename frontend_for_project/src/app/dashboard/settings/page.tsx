
'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from "@/components/ui/card";
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { useToast } from '@/hooks/use-toast';
import { teacherInfo } from '@/lib/data';
import { Upload, KeyRound, ChevronDown, LogOut, Info } from 'lucide-react';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import Link from 'next/link';

export default function SettingsPage() {
  const { toast } = useToast();
  
  const [profile, setProfile] = useState({
    name: teacherInfo.name,
    email: 'dr.evelyn.reed@school.edu', // Placeholder
  });

  const handleProfileSave = (e: React.FormEvent) => {
    e.preventDefault();
    toast({
      title: 'Profile Updated',
      description: 'Your profile information has been successfully updated.',
    });
  };

  const handlePasswordChange = (e: React.FormEvent) => {
    e.preventDefault();
    toast({
      title: 'Password Updated',
      description: 'Your password has been changed successfully.',
    });
    // Reset form
    (e.target as HTMLFormElement).reset();
  };

  return (
    <div className="space-y-4">
      <Accordion type="single" collapsible className="w-full space-y-4">
        <AccordionItem value="item-1">
          <Card>
            <AccordionTrigger className="p-6 text-left hover:no-underline">
              <div className="flex-1">
                <CardTitle>Profile</CardTitle>
                <CardDescription className="mt-2">Manage your public profile and personal information.</CardDescription>
              </div>
              <ChevronDown className="h-4 w-4 shrink-0 transition-transform duration-200" />
            </AccordionTrigger>
            <AccordionContent>
              <CardContent>
                <form onSubmit={handleProfileSave} className="space-y-4">
                  <div className="flex items-center space-x-4">
                    <Avatar className="h-20 w-20">
                      <AvatarImage src="https://picsum.photos/id/40/200/200" data-ai-hint="woman face" />
                      <AvatarFallback>ER</AvatarFallback>
                    </Avatar>
                    <Button type="button" variant="outline">
                      <Upload className="mr-2 h-4 w-4" />
                      Change Avatar
                    </Button>
                  </div>
                  <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                    <div className="space-y-2">
                      <Label htmlFor="name">Name</Label>
                      <Input id="name" value={profile.name} onChange={(e) => setProfile({ ...profile, name: e.target.value })} />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="email">Email</Label>
                      <Input id="email" type="email" value={profile.email} onChange={(e) => setProfile({ ...profile, email: e.target.value })} />
                    </div>
                  </div>
                  <div className="flex justify-end">
                    <Button type="submit">Save Changes</Button>
                  </div>
                </form>
              </CardContent>
            </AccordionContent>
          </Card>
        </AccordionItem>

        <AccordionItem value="item-2">
          <Card>
            <AccordionTrigger className="p-6 text-left hover:no-underline">
              <div className="flex-1">
                <CardTitle>Security</CardTitle>
                <CardDescription className="mt-2">Change your password and manage account security.</CardDescription>
              </div>
              <ChevronDown className="h-4 w-4 shrink-0 transition-transform duration-200" />
            </AccordionTrigger>
            <AccordionContent>
              <CardContent>
                <form onSubmit={handlePasswordChange} className="space-y-4 max-w-md">
                  <div className="space-y-2">
                    <Label htmlFor="current-password">Current Password</Label>
                    <Input id="current-password" type="password" />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="new-password">New Password</Label>
                    <Input id="new-password" type="password" />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="confirm-password">Confirm New Password</Label>
                    <Input id="confirm-password" type="password" />
                  </div>
                  <div className="flex justify-end">
                    <Button type="submit">
                      <KeyRound className="mr-2" />
                      Change Password
                    </Button>
                  </div>
                </form>
              </CardContent>
            </AccordionContent>
          </Card>
        </AccordionItem>
        
        <AccordionItem value="item-3">
          <Card>
            <AccordionTrigger className="p-6 text-left hover:no-underline">
              <div className="flex-1">
                <CardTitle>About</CardTitle>
                <CardDescription className="mt-2">Information about the application.</CardDescription>
              </div>
              <ChevronDown className="h-4 w-4 shrink-0 transition-transform duration-200" />
            </AccordionTrigger>
            <AccordionContent>
              <CardContent className="space-y-4">
                <div className="flex items-center space-x-4">
                  <Info className="h-6 w-6 text-primary" />
                  <h3 className="text-lg font-semibold">AttendVision</h3>
                </div>
                <p className="text-sm text-muted-foreground">
                  Version 1.0.0
                </p>
                <p className="text-sm">
                  AttendVision is a comprehensive full-stack web application designed to streamline attendance tracking using face recognition technology. It provides a secure, simple, and smart solution for managing class rosters, monitoring attendance, and generating insightful reports.
                </p>
                 <p className="text-sm text-muted-foreground">
                  © 2025 AttendVision. All rights reserved.
                </p>
              </CardContent>
            </AccordionContent>
          </Card>
        </AccordionItem>
      </Accordion>

      <Card>
        <CardHeader>
          <CardTitle>Log Out</CardTitle>
          <CardDescription>Securely log out of your account.</CardDescription>
        </CardHeader>
        <CardFooter className="border-t pt-6">
          <Button asChild variant="destructive" className="w-full sm:w-auto">
             <Link href="/">
                <LogOut className="mr-2" />
                Log Out
             </Link>
          </Button>
        </CardFooter>
      </Card>
    </div>
  );
}
