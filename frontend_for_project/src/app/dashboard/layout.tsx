'use client';

import {
  SidebarProvider,
  Sidebar,
  SidebarHeader,
  SidebarContent,
  SidebarMenu,
  SidebarMenuItem,
  SidebarMenuButton,
  SidebarFooter,
  SidebarInset,
  SidebarTrigger,
  SidebarRail,
  useSidebar,
} from '@/components/ui/sidebar';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  DropdownMenuSub,
  DropdownMenuSubTrigger,
  DropdownMenuPortal,
  DropdownMenuSubContent,
} from '@/components/ui/dropdown-menu';
import { Button } from '@/components/ui/button';
import { Video, Settings, LogOut, PanelLeft, Sun, Moon, Monitor, Library, Calendar } from 'lucide-react';
import { TbReport } from "react-icons/tb";
import { PiStudentFill } from "react-icons/pi";
import { GiTeacher } from "react-icons/gi";
import { ImBooks, ImHome } from "react-icons/im";
import { AttendVisionLogo } from '@/components/icons';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { teacherInfo } from '@/lib/data';
import { useTheme } from 'next-themes';
import { cn } from '@/lib/utils';
import { logout } from '@/lib/auth';

function Brand() {
    const { open } = useSidebar();
    return (
        <Link href="/dashboard" className="flex items-center gap-2">
            <AttendVisionLogo className="h-8 w-8 text-primary" />
            {open && <span className='text-lg font-semibold'>AttendVision</span>}
        </Link>
    )
}

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const { setTheme, theme } = useTheme();
  const pathname = usePathname();

  const menuItems = [
    { href: '/dashboard', label: 'Dashboard', icon: <ImHome /> },
    { href: '/dashboard/live-attendance', label: 'Live Attendance', icon: <Video /> },
    { href: '/dashboard/reports', label: 'Reports', icon: <TbReport /> },
    { href: '/dashboard/students', label: 'Students', icon: <PiStudentFill /> },
    { href: '/dashboard/teachers', label: 'Teachers', icon: <GiTeacher /> },
    { href: '/dashboard/subjects', label: 'Subjects', icon: <ImBooks /> },
    { href: '/dashboard/timetable', label: 'Time Table', icon: <Calendar /> },
    { href: '/dashboard/settings', label: 'Settings', icon: <Settings /> },
  ];

  const getPageTitle = () => {
    if (pathname.startsWith('/dashboard/subjects/')) {
      const slug = pathname.split('/').pop() || '';
      return slug.replace(/-/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
    }
    if (pathname.startsWith('/dashboard/students/')) {
      return 'Student Details';
    }
    if (pathname === '/dashboard/attendance/present') {
      return 'Present Students';
    }
    if (pathname === '/dashboard/attendance/absent') {
      return 'Absent Students';
    }
    const currentItem = menuItems.find((item) => pathname === item.href || (item.href !== '/dashboard' && pathname.startsWith(item.href)));
    return currentItem?.label || 'Dashboard';
  };

  return (
    <SidebarProvider>
      <Sidebar collapsible="icon">
      <SidebarRail />
        <SidebarHeader className="p-4">
            <Brand />
        </SidebarHeader>
        <SidebarContent>
          <SidebarMenu>
            {menuItems.map((item) => (
              <SidebarMenuItem key={item.href}>
                <SidebarMenuButton asChild tooltip={item.label} isActive={pathname === item.href}>
                  <Link href={item.href}>
                    {item.icon}
                    <span className="group-data-[collapsible=icon]:hidden">
                      {item.label}
                    </span>
                  </Link>
                </SidebarMenuButton>
              </SidebarMenuItem>
            ))}
          </SidebarMenu>
        </SidebarContent>
        <SidebarFooter className="p-4">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" className="h-auto w-full justify-start p-2 text-left">
                <Avatar className="mr-2 h-8 w-8">
                  <AvatarImage src="https://picsum.photos/id/40/100/100" data-ai-hint="woman face" />
                  <AvatarFallback>ER</AvatarFallback>
                </Avatar>
                <div className="flex flex-col items-start group-data-[collapsible=icon]:hidden">
                  <span className="text-sm font-medium">{teacherInfo.name}</span>
                  <span className="text-xs text-muted-foreground">{teacherInfo.subject}</span>
                </div>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent side="right" align="start" className="w-56">
              <DropdownMenuLabel>{teacherInfo.name}</DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem>Profile</DropdownMenuItem>
              <DropdownMenuItem>Billing</DropdownMenuItem>
              <DropdownMenuItem>Settings</DropdownMenuItem>
              <DropdownMenuSub>
                <DropdownMenuSubTrigger>
                  <Sun className="mr-2 h-4 w-4 rotate-0 scale-100 transition-all dark:-rotate-90 dark:scale-0" />
                  <Moon className="absolute mr-2 h-4 w-4 rotate-90 scale-0 transition-all dark:rotate-0 dark:scale-100" />
                  <span>Toggle theme</span>
                </DropdownMenuSubTrigger>
                <DropdownMenuPortal>
                  <DropdownMenuSubContent>
                    <DropdownMenuItem onClick={() => setTheme('light')}>
                      <Sun className="mr-2 h-4 w-4" />
                      Light
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => setTheme('dark')}>
                      <Moon className="mr-2 h-4 w-4" />
                      Dark
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => setTheme('system')}>
                      <Monitor className="mr-2 h-4 w-4" />
                      System
                    </DropdownMenuItem>
                  </DropdownMenuSubContent>
                </DropdownMenuPortal>
              </DropdownMenuSub>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={() => {
                // Clear all cookies
                document.cookie.split(";").forEach((c) => {
                  document.cookie = c.replace(/^ +/, "").replace(/=.*/, `=;expires=${new Date().toUTCString()};path=/`);
                });
                // Redirect to login
                window.location.href = '/login';
              }}>
                <LogOut className="mr-2 h-4 w-4" />
                <span>Log out</span>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </SidebarFooter>
      </Sidebar>
      <SidebarInset>
        <header className="flex h-14 items-center gap-4 border-b bg-card px-4 lg:h-[60px] lg:px-6">
          <SidebarTrigger>
            <PanelLeft />
            <span className="sr-only">Toggle sidebar</span>
          </SidebarTrigger>
          <div className="flex-1">
            <h1 className="text-lg font-semibold">{getPageTitle()}</h1>
          </div>
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setTheme(theme === 'light' ? 'dark' : 'light')}
          >
            <Sun className="h-5 w-5 rotate-0 scale-100 transition-all dark:-rotate-90 dark:scale-0" />
            <Moon className="absolute h-5 w-5 rotate-90 scale-0 transition-all dark:rotate-0 dark:scale-100" />
            <span className="sr-only">Toggle theme</span>
          </Button>
        </header>
        <main className="flex-1 p-4 lg:p-6">{children}</main>
      </SidebarInset>
    </SidebarProvider>
  );
}
