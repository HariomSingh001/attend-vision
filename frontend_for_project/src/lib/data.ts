
export type Student = {
  id: number;
  name: string;
  avatar: string;
  attendance: 'present' | 'absent' | 'late' | 'pending';
  confidence?: number;
  'data-ai-hint'?: string;
  status?: 'active' | 'blocked';
  attendancePercentage?: number;
  firstName?: string;
  lastName?: string;
  studentId?: string;
  email?: string;
  contact?: string;
  address?: string;
  uuid?: string; // UUID from database for API calls
};

export const studentsData: Student[] = [
  { id: 1, name: 'Olivia Martin', avatar: 'https://picsum.photos/id/1011/100/100', attendance: 'pending', 'data-ai-hint': 'woman face', status: 'active', attendancePercentage: 95, studentId: 'S001' },
  { id: 2, name: 'Jackson Lee', avatar: 'https://picsum.photos/id/1012/100/100', attendance: 'pending', 'data-ai-hint': 'man face', status: 'active', attendancePercentage: 92, studentId: 'S002' },
  { id: 3, name: 'Isabella Nguyen', avatar: 'https://picsum.photos/id/1013/100/100', attendance: 'pending', 'data-ai-hint': 'woman face', status: 'active', attendancePercentage: 98, studentId: 'S003' },
  { id: 4, name: 'Aiden Kim', avatar: 'https://picsum.photos/id/1014/100/100', attendance: 'pending', 'data-ai-hint': 'man face', status: 'active', attendancePercentage: 88, studentId: 'S004' },
  { id: 5, name: 'Sophia Patel', avatar: 'https://picsum.photos/id/1015/100/100', attendance: 'present', 'data-ai-hint': 'woman face', status: 'active', attendancePercentage: 100, studentId: 'S005' },
  { id: 6, name: 'Liam Garcia', avatar: 'https://picsum.photos/id/1016/100/100', attendance: 'present', 'data-ai-hint': 'man face', status: 'active', attendancePercentage: 96, studentId: 'S006' },
  { id: 7, name: 'Ava Rodriguez', avatar: 'https://picsum.photos/id/1018/100/100', attendance: 'absent', 'data-ai-hint': 'woman face', status: 'active', attendancePercentage: 75, studentId: 'S007' },
  { id: 8, name: 'Noah Martinez', avatar: 'https://picsum.photos/id/1025/100/100', attendance: 'late', 'data-ai-hint': 'man face', status: 'blocked', attendancePercentage: 85, studentId: 'S008' },
  { id: 9, name: 'Emma Hernandez', avatar: 'https://picsum.photos/id/1027/100/100', attendance: 'present', 'data-ai-hint': 'woman face', status: 'active', attendancePercentage: 91, studentId: 'S009' },
  { id: 10, name: 'Lucas Gonzalez', avatar: 'https://picsum.photos/id/103/100/100', attendance: 'present', 'data-ai-hint': 'man face', status: 'active', attendancePercentage: 93, studentId: 'S010' },
  { id: 11, name: 'Mia Lopez', avatar: 'https://picsum.photos/id/1031/100/100', attendance: 'pending', 'data-ai-hint': 'woman face', status: 'active', attendancePercentage: 90, studentId: 'S011' },
  { id: 12, name: 'Ethan Wilson', avatar: 'https://picsum.photos/id/1032/100/100', attendance: 'pending', 'data-ai-hint': 'man face', status: 'active', attendancePercentage: 89, studentId: 'S012' },
];

export const teacherInfo = {
  name: 'Admin',
  subject: 'Administrator',
  class: 'CS101 - Introduction to Programming',
};

export type Teacher = {
  id: number;
  name: string;
  avatar: string;
  subject: string;
  status: 'active' | 'on-leave';
  'data-ai-hint'?: string;
  email: string;
  phone: string;
  teacherId?: string;
  uuid?: string; // UUID from database for API calls
};

export const teachersData: Teacher[] = [
  { id: 1, name: 'Dr. Evelyn Reed', avatar: 'https://picsum.photos/id/40/100/100', subject: 'Computer Science', status: 'active', 'data-ai-hint': 'woman face', email: 'evelyn.reed@example.com', phone: '123-456-7890', teacherId: 'T001' },
  { id: 2, name: 'Mr. David Chen', avatar: 'https://picsum.photos/id/41/100/100', subject: 'Mathematics', status: 'active', 'data-ai-hint': 'man face', email: 'david.chen@example.com', phone: '123-456-7891', teacherId: 'T002' },
  { id: 3, name: 'Ms. Sarah Johnson', avatar: 'https://picsum.photos/id/42/100/100', subject: 'Physics', status: 'on-leave', 'data-ai-hint': 'woman face', email: 'sarah.j@example.com', phone: '123-456-7892', teacherId: 'T003' },
  { id: 4, name: 'Dr. Michael Brown', avatar: 'https://picsum.photos/id/43/100/100', subject: 'Chemistry', status: 'active', 'data-ai-hint': 'man face', email: 'michael.b@example.com', phone: '123-456-7893', teacherId: 'T004' },
];

export type Subject = {
  name: string;
  slug: string;
  shortName?: string;
  icon?: React.ReactNode;
}

export const subjectsData: Subject[] = [
  { name: "Multimedia & Virtual Reality", slug: "multimedia-virtual-reality", shortName: "MVT" },
  { name: "Python", slug: "python" },
  { name: "Formal Languages & Automata Theory", slug: "flat", shortName: "FLAT" },
  { name: "Computer Network", slug: "computer-network", shortName: "CN" },
  { name: "Microprocessor", slug: "microprocessor", shortName: "MPI" },
  { name: "Project Lab", slug: "project-lab" },
  { name: "Sports", slug: "sports" },
  { name: "Library", slug: "library", shortName: "LIB" },
];

export type TimetableEntry = {
  subject: string;
  faculty: string;
} | 'Lunch' | 'SPORTS' | null;


export type TimetableDay = TimetableEntry[];

export type Timetable = {
  [day: string]: TimetableDay;
};

export const timeSlots = [
  { period: 'I', time: '9:35-10:25' },
  { period: 'II', time: '10:25-11:15' },
  { period: 'III', time: '11:20-12:10' },
  { period: 'IV', time: '12:10-1:00' },
  { period: 'Lunch', time: '1:00-1:45' },
  { period: 'V', time: '1:45-2:30' },
  { period: 'VI', time: '2:30-3:15' },
  { period: 'VII', time: '3:15-4:00' },
];

export const faculty = {
  TV: "MR. TAMRADHWAJ VAISHAV",
  AP: "MR. ANVESH PANDEY",
  VA: "MR. VAIBHAV AWASTHI",
  VKS: "MR. VK SONI",
  AA: "MR. AMIT AWASTHI",
  NN: "NN",
  OJ: "OJ",
  AS: "AS",
};


export const timetableData: Timetable = {
  MON: [
    { subject: "MPI", faculty: "TV" },
    { subject: "FLAT", faculty: "AP" },
    { subject: "PYTHON/MPI LAB", faculty: "AA/TV" },
    null,
    'Lunch',
    { subject: "MVT", faculty: "VA" },
    { subject: "CN", faculty: "VKS" },
    { subject: "PYTHON", faculty: "AA" },
  ],
  TUE: [
    { subject: "MVT", faculty: "VA" },
    { subject: "FLAT", faculty: "AP" },
    { subject: "CN LAB", faculty: "VKS" },
    null,
    'Lunch',
    { subject: "PYTHON", faculty: "AA" },
    { subject: "MPI", faculty: "TV" },
    { subject: "CN", faculty: "VKS" },
  ],
  WED: [
    { subject: "MVT", faculty: "VA" },
    { subject: "PYTHON", faculty: "AA" },
    { subject: "FLAT", faculty: "AP" },
    { subject: "MPI", faculty: "TV" },
    'Lunch',
    { subject: "CN", faculty: "VKS" },
    'SPORTS',
    null,
  ],
  THUR: [
    { subject: "MVT", faculty: "VA" },
    { subject: "FLAT", faculty: "AP" },
    { subject: "PROJECT", faculty: "NN" },
    null,
    'Lunch',
    { subject: "MPI", faculty: "TV" },
    { subject: "CN", faculty: "VKS" },
    { subject: "PYTHON", faculty: "AA" },
  ],
  FRI: [
    { subject: "MVT", faculty: "VA" },
    { subject: "PYTHON", faculty: "AA" },
    { subject: "PYTHON/MPI LAB", faculty: "AA/TV" },
    null,
    'Lunch',
    { subject: "FLAT", faculty: "AP" },
    { subject: "MPI", faculty: "TV" },
    { subject: "LIB", faculty: "AS" },
  ],
  SAT: [
    { subject: "MPI", faculty: "TV" },
    { subject: "CN", faculty: "VKS" },
    { subject: "PYTHON", faculty: "AA" },
    { subject: "FLAT", faculty: "AP" },
    null,
    null,
    null,
    null,
  ],
};
