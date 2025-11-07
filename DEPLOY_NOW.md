# 🚀 Deploy AttendVision in 3 Steps (20 Minutes)

## Step 1: Deploy Backend (10 min)

### Go to Railway
👉 https://railway.app

### Click "New Project" → "Deploy from GitHub"

### Add These Environment Variables:
```
SUPABASE_URL=https://tpaqnhfcylumhixvavdh.supabase.co
SUPABASE_SERVICE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InRwYXFuaGZjeWx1bWhpeHZhdmRoIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1NzcwMDgxMiwiZXhwIjoyMDczMjc2ODEyfQ.KFSE3Q7YMmi6hKHLWm2XCWimeMmQPjCtNhjcsYbq8Js
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=lucario70733@gmail.com
SMTP_PASS=xhqiitvwjbdlkjjf
```

### ✅ Copy Your Railway URL
Example: `https://attendvision-backend.railway.app`

---

## Step 2: Deploy Frontend (10 min)

### Go to Vercel
👉 https://vercel.com

### Click "Add New..." → "Project" → Import from GitHub

### Set Root Directory:
```
frontend_for_project
```

### Add This Environment Variable:
```
NEXT_PUBLIC_BACKEND_URL=https://your-railway-url.railway.app
```
(Use the URL you copied from Step 1)

### ✅ Copy Your Vercel URL
Example: `https://attendvision.vercel.app`

---

## Step 3: Update CORS (5 min)

### Edit `backend_for_project/main.py`

Find line 29-33 and update:

```python
origins = [
    "http://localhost:3000",
    "http://localhost:9002",
    "https://your-vercel-url.vercel.app",  # Add this line
]
```

### Commit and Push to GitHub

Railway will automatically redeploy!

---

## ✅ Test Your Deployment

1. Visit your Vercel URL
2. Check students page loads
3. Try sending an alert
4. Test face recognition

---

## 🎉 Done!

Your AttendVision is now live at:
- **Frontend**: `https://your-app.vercel.app`
- **Backend**: `https://your-app.railway.app`

**Cost**: $0/month (Free tier)

---

## Need Help?

See detailed guides:
- `DEPLOYMENT_GUIDE.md` - Complete guide
- `DEPLOY_CHECKLIST.md` - Step-by-step checklist
- `DEPLOYMENT_SUMMARY.md` - Overview and options
