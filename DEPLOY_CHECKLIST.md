# 🚀 AttendVision Deployment Checklist

## Pre-Deployment Checklist

### ✅ Files Created
- [x] `backend_for_project/Procfile` - Railway/Render startup command
- [x] `backend_for_project/runtime.txt` - Python version
- [x] `frontend_for_project/netlify.toml` - Netlify configuration
- [x] `frontend_for_project/env.production.template` - Environment template

### ✅ Code Ready
- [x] Backend API working locally
- [x] Frontend working locally
- [x] Database (Supabase) configured
- [x] Email alerts working
- [x] Face recognition working

---

## Step-by-Step Deployment

### Step 1: Deploy Backend (Choose One)

#### Option A: Railway (Recommended)

1. **Sign up**: https://railway.app
2. **Create Project**: "New Project" → "Deploy from GitHub"
3. **Select**: `backup_of_project/backend_for_project`
4. **Add Environment Variables**:
   ```
   SUPABASE_URL=https://tpaqnhfcylumhixvavdh.supabase.co
   SUPABASE_SERVICE_KEY=your-key-here
   SMTP_HOST=smtp.gmail.com
   SMTP_PORT=587
   SMTP_USER=lucario70733@gmail.com
   SMTP_PASS=xhqiitvwjbdlkjjf
   ```
5. **Deploy**: Railway auto-deploys
6. **Copy URL**: Save your Railway URL (e.g., `https://xxx.railway.app`)

#### Option B: Render

1. **Sign up**: https://render.com
2. **New Web Service**: Connect GitHub repo
3. **Configure**:
   - Root Directory: `backend_for_project`
   - Build Command: `pip install -r requirements.txt`
   - Start Command: `uvicorn main:app --host 0.0.0.0 --port $PORT`
4. **Add Environment Variables** (same as above)
5. **Deploy**
6. **Copy URL**: Save your Render URL

---

### Step 2: Deploy Frontend (Choose One)

#### Option A: Vercel (Recommended for Next.js)

1. **Sign up**: https://vercel.com
2. **Import Project**: Connect GitHub
3. **Configure**:
   - Root Directory: `frontend_for_project`
   - Framework: Next.js (auto-detected)
4. **Add Environment Variable**:
   ```
   NEXT_PUBLIC_BACKEND_URL=https://your-railway-url.railway.app
   ```
   (Use URL from Step 1)
5. **Deploy**
6. **Copy URL**: Save your Vercel URL

#### Option B: Netlify

1. **Sign up**: https://netlify.com
2. **Import Project**: Connect GitHub
3. **Configure**:
   - Base Directory: `frontend_for_project`
   - Build Command: `npm run build`
   - Publish Directory: `.next`
4. **Add Environment Variable**:
   ```
   NEXT_PUBLIC_BACKEND_URL=https://your-railway-url.railway.app
   ```
5. **Deploy**

---

### Step 3: Update Backend CORS

1. **Edit** `backend_for_project/main.py`
2. **Find** CORS middleware section
3. **Add** your Vercel/Netlify URL:
   ```python
   allow_origins=[
       "http://localhost:3000",
       "http://localhost:9002",
       "https://your-app.vercel.app",  # Add this
   ]
   ```
4. **Commit & Push** to GitHub
5. **Railway/Render** will auto-redeploy

---

### Step 4: Test Deployment

#### Backend Tests
```bash
# Test API is running
curl https://your-backend-url.railway.app/

# Test students endpoint
curl https://your-backend-url.railway.app/students

# Expected: JSON response with students
```

#### Frontend Tests
1. Visit your Vercel URL
2. Test login (if applicable)
3. Check Students page loads
4. Test "Send Alert" button
5. Verify face recognition works

---

## Quick Commands

### Test Backend Locally
```bash
cd h:/backup_of_project/backend_for_project
uvicorn main:app --reload
```

### Test Frontend Locally
```bash
cd h:/backup_of_project/frontend_for_project
npm run dev
```

### Check Deployment Status
- **Railway**: https://railway.app/dashboard
- **Vercel**: https://vercel.com/dashboard
- **Netlify**: https://app.netlify.com

---

## Environment Variables Reference

### Backend (Railway/Render)
```env
SUPABASE_URL=https://tpaqnhfcylumhixvavdh.supabase.co
SUPABASE_SERVICE_KEY=your-service-key
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=lucario70733@gmail.com
SMTP_PASS=xhqiitvwjbdlkjjf
```

### Frontend (Vercel/Netlify)
```env
NEXT_PUBLIC_BACKEND_URL=https://your-backend.railway.app
```

---

## Troubleshooting

### Backend Won't Start
- ✅ Check Railway/Render logs
- ✅ Verify all environment variables set
- ✅ Check `requirements.txt` is complete
- ✅ Verify Procfile exists

### Frontend Build Fails
- ✅ Check Vercel/Netlify build logs
- ✅ Run `npm run build` locally first
- ✅ Fix any TypeScript errors
- ✅ Verify `NEXT_PUBLIC_BACKEND_URL` is set

### "Failed to Fetch" Errors
- ✅ Check backend URL is correct
- ✅ Verify CORS settings in backend
- ✅ Test backend URL directly in browser
- ✅ Check browser console for errors

### Face Recognition Not Working
- ✅ Camera permissions in browser
- ✅ HTTPS required for camera access
- ✅ Check backend logs for errors

---

## Post-Deployment Tasks

### Immediate
- [ ] Test all features
- [ ] Verify email alerts work
- [ ] Test face recognition
- [ ] Check student management
- [ ] Test attendance marking

### Within 24 Hours
- [ ] Set up monitoring
- [ ] Configure custom domain (optional)
- [ ] Set up database backups
- [ ] Document admin credentials
- [ ] Create user guide

### Within 1 Week
- [ ] Load test the application
- [ ] Set up error tracking
- [ ] Configure uptime monitoring
- [ ] Plan scaling strategy
- [ ] Train users

---

## Deployment URLs

After deployment, save these:

**Backend**: `https://_________________.railway.app`  
**Frontend**: `https://_________________.vercel.app`  
**Database**: `https://tpaqnhfcylumhixvavdh.supabase.co`

---

## Cost Summary

### Free Tier (Recommended for Start)
- Railway: Free (500 hours/month)
- Vercel: Free (unlimited)
- Supabase: Free (500MB database)
- **Total**: $0/month

### Paid Tier (For Production)
- Railway: $5/month
- Vercel: Free or $20/month
- Supabase: $25/month (Pro)
- **Total**: $5-50/month

---

## Support Resources

- **Railway Docs**: https://docs.railway.app
- **Vercel Docs**: https://vercel.com/docs
- **Next.js Docs**: https://nextjs.org/docs
- **FastAPI Docs**: https://fastapi.tiangolo.com

---

## Success Criteria

✅ Backend API accessible at public URL  
✅ Frontend accessible at public URL  
✅ Students page loads correctly  
✅ Face recognition works  
✅ Email alerts send successfully  
✅ Attendance marking works  
✅ All features functional  

---

## Ready to Deploy?

1. ✅ All files created
2. ✅ Code tested locally
3. ✅ Environment variables ready
4. ✅ GitHub repository ready

**Let's deploy!** Start with Step 1 above.

**Estimated Time**: 20-30 minutes  
**Difficulty**: Easy (mostly clicking buttons)  
**Cost**: Free (with free tiers)
