# AttendVision - Complete Deployment Guide

## Overview

Your AttendVision application has two parts that need to be deployed:
1. **Backend** (FastAPI/Python) - Attendance system, face recognition, email alerts
2. **Frontend** (Next.js) - Dashboard, student management UI

## 🚀 Deployment Options

### Option A: Quick Deploy (Recommended)
- **Frontend**: Vercel (free, optimized for Next.js)
- **Backend**: Railway/Render (free tier available)

### Option B: Full Control
- **Frontend**: Netlify
- **Backend**: Your own server/VPS

---

## Part 1: Deploy Backend (FastAPI)

### Option 1: Railway (Recommended - Easy & Free)

1. **Sign up at Railway**
   - Go to https://railway.app
   - Sign up with GitHub

2. **Create New Project**
   - Click "New Project"
   - Select "Deploy from GitHub repo"
   - Connect your GitHub account
   - Select your repository

3. **Configure Backend**
   - Railway will auto-detect Python
   - Add environment variables:
     ```
     SUPABASE_URL=your-supabase-url
     SUPABASE_SERVICE_KEY=your-supabase-key
     SMTP_HOST=smtp.gmail.com
     SMTP_PORT=587
     SMTP_USER=your-email@gmail.com
     SMTP_PASS=your-app-password
     ```

4. **Create Procfile** (if not exists)
   Create `h:/backup_of_project/backend_for_project/Procfile`:
   ```
   web: uvicorn main:app --host 0.0.0.0 --port $PORT
   ```

5. **Create runtime.txt**
   Create `h:/backup_of_project/backend_for_project/runtime.txt`:
   ```
   python-3.11
   ```

6. **Deploy**
   - Railway will automatically deploy
   - You'll get a URL like: `https://your-app.railway.app`

### Option 2: Render (Alternative Free Option)

1. **Sign up at Render**
   - Go to https://render.com
   - Sign up with GitHub

2. **Create Web Service**
   - Click "New +" → "Web Service"
   - Connect your repository
   - Select `backend_for_project` directory

3. **Configure**
   - **Name**: attendvision-backend
   - **Environment**: Python 3
   - **Build Command**: `pip install -r requirements.txt`
   - **Start Command**: `uvicorn main:app --host 0.0.0.0 --port $PORT`

4. **Add Environment Variables**
   Same as Railway above

5. **Deploy**
   - Click "Create Web Service"
   - You'll get a URL like: `https://attendvision-backend.onrender.com`

---

## Part 2: Deploy Frontend (Next.js)

### Option 1: Vercel (Recommended - Best for Next.js)

1. **Sign up at Vercel**
   - Go to https://vercel.com
   - Sign up with GitHub

2. **Import Project**
   - Click "Add New..." → "Project"
   - Import your GitHub repository
   - Select `frontend_for_project` as root directory

3. **Configure**
   - Framework Preset: Next.js (auto-detected)
   - Root Directory: `frontend_for_project`
   - Build Command: `npm run build`
   - Output Directory: `.next`

4. **Environment Variables**
   Add in Vercel dashboard:
   ```
   NEXT_PUBLIC_BACKEND_URL=https://your-backend-url.railway.app
   ```
   (Use your Railway/Render backend URL from Part 1)

5. **Deploy**
   - Click "Deploy"
   - You'll get a URL like: `https://attendvision.vercel.app`

### Option 2: Netlify (Alternative)

1. **Sign up at Netlify**
   - Go to https://netlify.com
   - Sign up with GitHub

2. **Import Project**
   - Click "Add new site" → "Import an existing project"
   - Connect to GitHub
   - Select your repository

3. **Configure**
   - Base directory: `frontend_for_project`
   - Build command: `npm run build`
   - Publish directory: `.next`

4. **Environment Variables**
   ```
   NEXT_PUBLIC_BACKEND_URL=https://your-backend-url.railway.app
   ```

5. **Deploy**
   - Click "Deploy site"
   - You'll get a URL like: `https://attendvision.netlify.app`

---

## Part 3: Post-Deployment Configuration

### 1. Update CORS in Backend

Edit `h:/backup_of_project/backend_for_project/main.py`:

```python
# Update CORS origins
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:3000",
        "http://localhost:9002",
        "https://attendvision.vercel.app",  # Add your Vercel URL
        "https://your-custom-domain.com"     # Add custom domain if any
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
```

### 2. Update Frontend Environment

Create `.env.production` in frontend:
```
NEXT_PUBLIC_BACKEND_URL=https://your-backend-url.railway.app
```

### 3. Test Deployment

1. **Test Backend**
   ```bash
   curl https://your-backend-url.railway.app/
   ```
   Should return: `{"message": "AttendVision API is running"}`

2. **Test Frontend**
   - Visit your Vercel URL
   - Try logging in
   - Check if students page loads
   - Test attendance marking

---

## Required Files for Deployment

### Backend Files

Create these in `h:/backup_of_project/backend_for_project/`:

**1. Procfile**
```
web: uvicorn main:app --host 0.0.0.0 --port $PORT
```

**2. runtime.txt**
```
python-3.11
```

**3. requirements.txt** (already exists, verify it has all dependencies)

### Frontend Files

**1. netlify.toml** (already created)
 
**2. .env.production**
```
NEXT_PUBLIC_BACKEND_URL=https://your-backend-url.railway.app
```

---

## Environment Variables Checklist

### Backend (.env)
- ✅ SUPABASE_URL
- ✅ SUPABASE_SERVICE_KEY
- ✅ SMTP_HOST
- ✅ SMTP_PORT
- ✅ SMTP_USER
- ✅ SMTP_PASS

### Frontend (.env.production)
- ✅ NEXT_PUBLIC_BACKEND_URL

---

## Custom Domain (Optional)

### For Frontend (Vercel)
1. Go to Vercel dashboard → Your project → Settings → Domains
2. Add your custom domain
3. Update DNS records as instructed

### For Backend (Railway)
1. Go to Railway dashboard → Your project → Settings
2. Add custom domain
3. Update DNS records

---

## Troubleshooting

### Backend Issues

**Error: "Module not found"**
- Check `requirements.txt` has all dependencies
- Redeploy

**Error: "Port already in use"**
- Make sure using `$PORT` environment variable
- Check Procfile: `--port $PORT`

**Error: "Database connection failed"**
- Verify SUPABASE_URL and SUPABASE_SERVICE_KEY
- Check environment variables in Railway/Render

### Frontend Issues

**Error: "Failed to fetch"**
- Check NEXT_PUBLIC_BACKEND_URL is correct
- Verify backend is running
- Check CORS settings in backend

**Error: "Build failed"**
- Check Node version (should be 18+)
- Run `npm install` locally first
- Check for TypeScript errors

**Blank page after deployment**
- Check browser console for errors
- Verify environment variables
- Check backend URL is accessible

---

## Cost Estimate

### Free Tier (Recommended for Testing)
- **Railway**: Free tier (500 hours/month)
- **Vercel**: Free tier (unlimited for personal projects)
- **Total**: $0/month

### Paid Tier (For Production)
- **Railway**: $5/month (Hobby plan)
- **Vercel**: Free or $20/month (Pro)
- **Total**: $5-25/month

---

## Security Checklist

Before deploying:

- [ ] Change all default passwords
- [ ] Use environment variables (never hardcode secrets)
- [ ] Enable HTTPS (automatic on Vercel/Railway)
- [ ] Set up proper CORS origins
- [ ] Use strong Gmail app password
- [ ] Enable Supabase RLS (Row Level Security)
- [ ] Set up rate limiting (if needed)

---

## Monitoring & Maintenance

### Backend Monitoring
- Railway/Render provides logs
- Set up error alerts
- Monitor API response times

### Frontend Monitoring
- Vercel provides analytics
- Check build logs
- Monitor page load times

### Database
- Supabase provides dashboard
- Monitor storage usage
- Check query performance

---

## Quick Start Commands

### Deploy Backend to Railway
```bash
# 1. Create Procfile and runtime.txt (see above)
# 2. Push to GitHub
# 3. Connect Railway to GitHub
# 4. Add environment variables
# 5. Deploy automatically
```

### Deploy Frontend to Vercel
```bash
# 1. Push to GitHub
# 2. Import project in Vercel
# 3. Add NEXT_PUBLIC_BACKEND_URL
# 4. Deploy
```

---

## Next Steps After Deployment

1. **Test all features**
   - Student management
   - Face recognition
   - Attendance marking
   - Email alerts

2. **Set up monitoring**
   - Error tracking
   - Performance monitoring
   - Uptime monitoring

3. **Configure backups**
   - Database backups (Supabase handles this)
   - Code backups (GitHub)

4. **Documentation**
   - User guide
   - Admin guide
   - API documentation

---

## Support

If you encounter issues:
1. Check deployment logs
2. Verify environment variables
3. Test backend API directly
4. Check browser console
5. Review CORS settings

---

## Summary

**Easiest Path**:
1. Deploy backend to Railway (5 minutes)
2. Deploy frontend to Vercel (5 minutes)
3. Update environment variables (2 minutes)
4. Test deployment (5 minutes)

**Total Time**: ~20 minutes

**Cost**: Free (with free tiers)

**Result**: Fully deployed AttendVision application accessible from anywhere!
