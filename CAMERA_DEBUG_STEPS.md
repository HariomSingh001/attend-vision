# 🔍 Camera Debug Steps - PLEASE FOLLOW EXACTLY

## Step 1: Open Browser Console

1. Open your browser (Chrome/Edge recommended)
2. Go to `http://localhost:3000/dashboard/students`
3. Press `F12` or `Ctrl+Shift+I` to open DevTools
4. Click the **Console** tab

## Step 2: Check What URL You're Using

Look at the address bar. It MUST be one of these:
- ✅ `http://localhost:3000/...`
- ✅ `https://...` (any HTTPS URL)
- ❌ `http://127.0.0.1:3000/...` (WILL NOT WORK)
- ❌ `http://192.168.x.x:3000/...` (WILL NOT WORK)

**If you're using 127.0.0.1 or an IP address, change it to `localhost`**

## Step 3: Clear Everything and Start Fresh

In the Console tab, type these commands one by one:

```javascript
// Check if camera API exists
console.log('Camera API available:', !!navigator.mediaDevices)

// Check secure context
console.log('Secure context:', window.isSecureContext)

// Check hostname
console.log('Hostname:', window.location.hostname)

// Try to get camera directly
navigator.mediaDevices.getUserMedia({ video: true })
  .then(stream => {
    console.log('✅ Camera access SUCCESS:', stream)
    stream.getTracks().forEach(track => track.stop())
  })
  .catch(err => {
    console.error('❌ Camera access FAILED:', err.name, err.message)
  })
```

## Step 4: Take a Screenshot

After running those commands, take a screenshot of the Console tab showing:
1. The results of all 4 commands above
2. Any red error messages

## Step 5: Check Camera Permissions

### Chrome/Edge:
1. Click the padlock icon (or info icon) in the address bar
2. Look for "Camera" permission
3. Make sure it says "Allow" (not "Block" or "Ask")
4. If it says "Block", change it to "Allow" and refresh

### Firefox:
1. Click the padlock icon
2. Click "Connection secure" → "More information"
3. Go to "Permissions" tab
4. Find "Use the Camera" and set to "Allow"

## Step 6: Check if Camera is Already in Use

### Windows:
1. Press `Win + I` to open Settings
2. Go to Privacy & Security → Camera
3. Make sure "Camera access" is ON
4. Close any other apps that might be using the camera (Zoom, Teams, Camera app, etc.)

### Check in Task Manager:
1. Press `Ctrl+Shift+Esc`
2. Look for these processes and close them:
   - Camera
   - Zoom
   - Microsoft Teams
   - Skype
   - Any video conferencing apps

## Step 7: Test with a Simple HTML File

Create this file: `test-camera.html`

```html
<!DOCTYPE html>
<html>
<head>
    <title>Camera Test</title>
</head>
<body>
    <h1>Camera Test</h1>
    <video id="video" autoplay playsinline style="width: 640px; height: 480px; border: 2px solid black;"></video>
    <br>
    <button onclick="startCamera()">Start Camera</button>
    <p id="status"></p>

    <script>
        async function startCamera() {
            const video = document.getElementById('video');
            const status = document.getElementById('status');
            
            try {
                status.textContent = 'Requesting camera...';
                const stream = await navigator.mediaDevices.getUserMedia({ 
                    video: { width: 640, height: 480 } 
                });
                
                video.srcObject = stream;
                status.textContent = '✅ Camera working!';
                console.log('Stream:', stream);
            } catch (err) {
                status.textContent = '❌ Error: ' + err.name + ' - ' + err.message;
                console.error('Camera error:', err);
            }
        }
    </script>
</body>
</html>
```

Open this file in your browser and click "Start Camera". Does it work?

## Step 8: Send Me This Information

Please send me:

1. **Screenshot of Console** (from Step 3)
2. **What URL you're using** (from Step 2)
3. **Camera permission status** (from Step 5)
4. **Does the test HTML work?** (from Step 7)
5. **What browser and version?** (e.g., Chrome 120, Firefox 121)
6. **Operating system?** (Windows 10/11, Mac, Linux)

---

## Common Issues & Solutions

### Issue: "Camera API available: false"
**Solution:** Your browser doesn't support camera access. Update to latest Chrome/Edge/Firefox.

### Issue: "Secure context: false"
**Solution:** You're not using localhost or HTTPS. Change URL to `http://localhost:3000`

### Issue: "NotAllowedError: Permission denied"
**Solution:** You blocked camera permission. Follow Step 5 to allow it.

### Issue: "NotFoundError: Requested device not found"
**Solution:** No camera detected. Check if your camera is connected and enabled in Device Manager.

### Issue: "NotReadableError: Could not start video source"
**Solution:** Camera is being used by another application. Close all other apps and restart browser.

### Issue: "OverconstrainedError"
**Solution:** Your camera doesn't support the requested resolution. The code will automatically fall back.

---

## If NOTHING Works

Try this minimal test:

1. Close ALL browsers completely
2. Restart your computer
3. Open ONLY Chrome
4. Go to `chrome://settings/content/camera`
5. Make sure camera is not blocked
6. Go to `http://localhost:3000`
7. Try again

If it still doesn't work after ALL these steps, there's likely a system-level camera block (antivirus, privacy software, etc.).
