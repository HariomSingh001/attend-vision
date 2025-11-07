# AttendVision - Complete Installation Guide

## ✅ Installation Complete!

All dependencies have been successfully installed for your AttendVision face recognition attendance system.

## 📦 What's Installed

### Backend Dependencies (Python)
- ✅ **FastAPI** - Web framework for building APIs
- ✅ **Uvicorn** - ASGI server for running FastAPI
- ✅ **OpenCV** - Computer vision library for face detection
- ✅ **scikit-learn** - Machine learning library for face recognition
- ✅ **NumPy** - Numerical computing library
- ✅ **Supabase** - Database client for PostgreSQL
- ✅ **python-dotenv** - Environment variable management
- ✅ **python-multipart** - File upload support
- ✅ **httpx** - HTTP client library

### Frontend Dependencies (Node.js)
- ✅ **Next.js 15.3.3** - React framework
- ✅ **React 18.3.1** - UI library
- ✅ **TypeScript** - Type safety
- ✅ **Tailwind CSS** - Styling framework
- ✅ **Radix UI** - Component library
- ✅ **Supabase Client** - Database client
- ✅ **Google Genkit** - AI integration
- ✅ **Lucide React** - Icons
- ✅ **Recharts** - Charts and graphs

## 🚀 How to Run the Application

### 1. Backend Server
```bash
cd backend_for_project
python -m uvicorn main:app --reload --host 0.0.0.0 --port 8000
```
The backend will be available at: http://localhost:8000

### 2. Frontend Server
```bash
cd frontend_for_project
npm run dev
```
The frontend will be available at: http://localhost:9002

## ⚙️ Environment Setup Required

### Backend (.env file)
Create `backend_for_project/.env`:
```env
SUPABASE_URL=your_supabase_url_here
SUPABASE_SERVICE_KEY=your_supabase_service_key_here
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your_email@gmail.com
SMTP_PASS=your_app_password_here
```

### Frontend (.env.local file)
Create `forntend_for_project/.env.local`:
```env
NEXT_PUBLIC_SUPABASE_URL=your_supabase_url_here
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key_here
NEXT_PUBLIC_BACKEND_URL=http://localhost:8000
GOOGLE_AI_API_KEY=your_google_ai_api_key_here
```

## 🗄️ Database Setup

Make sure your Supabase database has these tables:
- `users` - User authentication
- `students` - Student information with `name` field
- `faces` - Face embeddings for recognition
- `attendance` - Daily attendance records
- `attendance_alerts` - Alert tracking

## 🔧 Features Available

### Face Recognition System
- Real-time face detection and recognition
- Student enrollment with face capture
- Live attendance tracking

### Dashboard Features
- Student management (CRUD operations)
- Attendance tracking and reporting
- AI-powered report generation
- Email notifications for low attendance

### AI Integration
- Google Gemini for intelligent analysis
- Automated report generation
- Smart attendance insights

## 🐛 Troubleshooting

### Common Issues
1. **Backend not starting**: Check if port 8000 is available
2. **Frontend not starting**: Check if port 9002 is available
3. **Database connection**: Verify Supabase credentials
4. **Face recognition not working**: Ensure students have face data enrolled

### Getting Help
- Check the console logs for detailed error messages
- Verify all environment variables are set correctly
- Ensure all dependencies are installed properly

## 📝 Next Steps

1. Set up your Supabase project and get credentials
2. Configure environment variables
3. Start both servers
4. Enroll students with face data
5. Test the live attendance system

Your AttendVision system is now ready to use! 🎉
