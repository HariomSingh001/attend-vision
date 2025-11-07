// API utility functions for AttendVision
const API_BASE_URL = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:8000';

export interface ApiStudent {
  id: string;
  name: string;
  studentId: string;
  email: string;
  contact: string;
  address: string;
  status: 'active' | 'blocked';
  avatar: string;
  attendance: 'present' | 'absent' | 'late' | 'pending';
  attendancePercentage: number;
  created_at?: string;
}

export interface CreateStudentData {
  firstName: string;
  lastName: string;
  studentId: string;
  email: string;
  contact?: string;
  address?: string;
  avatar?: string;
}

export interface UpdateStudentData extends CreateStudentData {
  id: string;
}

// Student API functions
export const studentApi = {
  // Get all students
  async getAll(): Promise<ApiStudent[]> {
    try {
      const response = await fetch(`${API_BASE_URL}/students`);
      const data = await response.json();
      
      if (data.status === 'success') {
        return data.students;
      } else {
        throw new Error(data.message || 'Failed to fetch students');
      }
    } catch (error) {
      console.error('Error fetching students:', error);
      throw error;
    }
  },

  // Create a new student
  async create(studentData: CreateStudentData): Promise<ApiStudent> {
    try {
      const formData = new URLSearchParams();
      formData.append('firstName', studentData.firstName);
      formData.append('lastName', studentData.lastName);
      formData.append('studentId', studentData.studentId);
      formData.append('email', studentData.email);
      if (studentData.contact) formData.append('contact', studentData.contact);
      if (studentData.address) formData.append('address', studentData.address);
      if (studentData.avatar) formData.append('avatar', studentData.avatar);

      const response = await fetch(`${API_BASE_URL}/students`, {
        method: 'POST',
        body: formData,
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
      });
      
      const data = await response.json();
      
      if (data.status === 'success') {
        return data.student;
      } else {
        // Handle specific database errors
        let errorMessage = data.message || 'Failed to create student';
        if (typeof data.message === 'object' && data.message.code === '23505') {
          if (data.message.message.includes('users_email_key')) {
            errorMessage = 'This email address is already registered. Please use a different email.';
          }
        } else if (typeof data.message === 'string' && data.message.includes('users_email_key')) {
          errorMessage = 'This email address is already registered. Please use a different email.';
        }
        throw new Error(errorMessage);
      }
    } catch (error) {
      console.error('Error creating student:', error);
      throw error;
    }
  },

  // Update an existing student
  async update(studentData: UpdateStudentData): Promise<void> {
    try {
      const formData = new URLSearchParams();
      formData.append('firstName', studentData.firstName);
      formData.append('lastName', studentData.lastName);
      formData.append('studentId', studentData.studentId);
      formData.append('email', studentData.email);
      if (studentData.contact) formData.append('contact', studentData.contact);
      if (studentData.address) formData.append('address', studentData.address);
      if (studentData.avatar) formData.append('avatar', studentData.avatar);

      const response = await fetch(`${API_BASE_URL}/students/${studentData.id}`, {
        method: 'PUT',
        body: formData,
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
      });
      
      const data = await response.json();
      
      if (data.status !== 'success') {
        throw new Error(data.message || 'Failed to update student');
      }
    } catch (error) {
      console.error('Error updating student:', error);
      throw error;
    }
  },

  // Delete a student
  async delete(studentId: string): Promise<void> {
    try {
      const response = await fetch(`${API_BASE_URL}/students/${studentId}`, {
        method: 'DELETE',
      });
      
      const data = await response.json();
      
      if (data.status !== 'success') {
        throw new Error(data.message || 'Failed to delete student');
      }
    } catch (error) {
      console.error('Error deleting student:', error);
      throw error;
    }
  },

  // Send alert to a student
  async sendAlert(studentId: string): Promise<{ status: string; message: string; student_name?: string; student_email?: string; attendance_percentage?: number }> {
    try {
      const response = await fetch(`${API_BASE_URL}/students/${studentId}/send-alert`, {
        method: 'POST',
      });
      
      const data = await response.json();
      return data;
    } catch (error) {
      console.error('Error sending alert:', error);
      throw error;
    }
  },
};

// Teacher API interfaces
export interface ApiTeacher {
  id: string;
  name: string;
  teacherId: string;
  email: string;
  phone: string;
  subject: string;
  status: 'active' | 'on-leave';
  avatar: string;
  created_at?: string;
}

export interface CreateTeacherData {
  name: string;
  teacherId: string;
  email: string;
  subject: string;
  phone?: string;
  avatar?: string;
}

export interface UpdateTeacherData extends CreateTeacherData {
  id: string;
  avatar?: string;
}

// Teacher API functions
export const teacherApi = {
  // Get all teachers
  async getAll(): Promise<ApiTeacher[]> {
    try {
      const response = await fetch(`${API_BASE_URL}/teachers`);
      const data = await response.json();
      
      if (data.status === 'success') {
        return data.teachers;
      } else {
        throw new Error(data.message || 'Failed to fetch teachers');
      }
    } catch (error) {
      console.error('Error fetching teachers:', error);
      throw error;
    }
  },

  // Create a new teacher
  async create(teacherData: CreateTeacherData): Promise<ApiTeacher> {
    try {
      const formData = new URLSearchParams();
      formData.append('name', teacherData.name);
      formData.append('teacherId', teacherData.teacherId);
      formData.append('email', teacherData.email);
      formData.append('subject', teacherData.subject);
      if (teacherData.phone) formData.append('phone', teacherData.phone);
      if (teacherData.avatar) formData.append('avatar', teacherData.avatar);

      const response = await fetch(`${API_BASE_URL}/teachers`, {
        method: 'POST',
        body: formData,
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
      });
      
      const data = await response.json();
      
      if (data.status === 'success') {
        return data.teacher;
      } else {
        // Handle specific database errors
        let errorMessage = data.message || 'Failed to create teacher';
        if (typeof data.message === 'object' && data.message.code === '23505') {
          if (data.message.message.includes('users_email_key')) {
            errorMessage = 'This email address is already registered. Please use a different email.';
          }
        } else if (typeof data.message === 'string' && data.message.includes('users_email_key')) {
          errorMessage = 'This email address is already registered. Please use a different email.';
        }
        throw new Error(errorMessage);
      }
    } catch (error) {
      console.error('Error creating teacher:', error);
      throw error;
    }
  },

  // Update an existing teacher
  async update(teacherData: UpdateTeacherData): Promise<void> {
    try {
      console.log('=== FRONTEND TEACHER UPDATE ===');
      console.log('Teacher Data:', teacherData);
      console.log('API URL:', `${API_BASE_URL}/teachers/${teacherData.id}`);
      
      const formData = new URLSearchParams();
      formData.append('name', teacherData.name);
      formData.append('teacherId', teacherData.teacherId);
      formData.append('email', teacherData.email);
      formData.append('subject', teacherData.subject);
      if (teacherData.phone) formData.append('phone', teacherData.phone);
      if (teacherData.avatar) formData.append('avatar', teacherData.avatar);

      console.log('FormData entries:');
      for (let [key, value] of formData.entries()) {
        console.log(`${key}:`, typeof value === 'string' ? value.substring(0, 100) : value);
      }

      const response = await fetch(`${API_BASE_URL}/teachers/${teacherData.id}`, {
        method: 'PUT',
        body: formData,
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
      });
      
      console.log('Response status:', response.status);
      console.log('Response ok:', response.ok);
      
      const data = await response.json();
      console.log('Response data:', data);
      
      if (data.status !== 'success') {
        throw new Error(data.message || 'Failed to update teacher');
      }
    } catch (error) {
      console.error('Error updating teacher:', error);
      throw error;
    }
  },

  // Delete a teacher
  async delete(teacherId: string): Promise<void> {
    try {
      const response = await fetch(`${API_BASE_URL}/teachers/${teacherId}`, {
        method: 'DELETE',
      });
      
      const data = await response.json();
      
      if (data.status !== 'success') {
        throw new Error(data.message || 'Failed to delete teacher');
      }
    } catch (error) {
      console.error('Error deleting teacher:', error);
      throw error;
    }
  },
};

// Helper function to convert ApiStudent to frontend Student type
export function convertApiStudentToFrontend(apiStudent: ApiStudent): any {
  const nameParts = apiStudent.name.split(' ');
  return {
    id: parseInt(apiStudent.id.slice(-8), 16), // Convert UUID to number for frontend compatibility
    name: apiStudent.name,
    avatar: apiStudent.avatar,
    attendance: apiStudent.attendance,
    'data-ai-hint': 'face',
    status: apiStudent.status,
    attendancePercentage: apiStudent.attendancePercentage,
    firstName: nameParts[0] || '',
    lastName: nameParts.slice(1).join(' ') || '',
    studentId: apiStudent.studentId,
    email: apiStudent.email,
    contact: apiStudent.contact,
    address: apiStudent.address,
    uuid: apiStudent.id, // Keep the original UUID for API calls
  };
}

// Helper function to convert ApiTeacher to frontend Teacher type
export function convertApiTeacherToFrontend(apiTeacher: ApiTeacher): any {
  return {
    id: parseInt(apiTeacher.id.slice(-8), 16), // Convert UUID to number for frontend compatibility
    name: apiTeacher.name,
    avatar: apiTeacher.avatar,
    subject: apiTeacher.subject,
    status: apiTeacher.status,
    'data-ai-hint': 'face',
    email: apiTeacher.email,
    phone: apiTeacher.phone,
    teacherId: apiTeacher.teacherId,
    uuid: apiTeacher.id, // Keep the original UUID for API calls
  };
}
