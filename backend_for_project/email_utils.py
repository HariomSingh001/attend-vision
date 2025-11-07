import smtplib
import os
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
from dotenv import load_dotenv

load_dotenv()

SMTP_HOST = os.getenv("SMTP_HOST")
SMTP_PORT = int(os.getenv("SMTP_PORT", 587))
SMTP_USER = os.getenv("SMTP_USER")
SMTP_PASS = os.getenv("SMTP_PASS")
FROM_NAME = os.getenv("FROM_NAME", "Attendance System")

def send_email(to_email: str, subject: str, body: str, html_body: str = None):
    """Send email with optional HTML body"""
    if html_body:
        msg = MIMEMultipart("alternative")
        msg.attach(MIMEText(body, "plain"))
        msg.attach(MIMEText(html_body, "html"))
    else:
        msg = MIMEText(body)
    
    msg["Subject"] = subject
    msg["From"] = f"{FROM_NAME} <{SMTP_USER}>"
    msg["To"] = to_email

    try:
        with smtplib.SMTP(SMTP_HOST, SMTP_PORT) as server:
            server.starttls()
            server.login(SMTP_USER, SMTP_PASS)
            server.sendmail(SMTP_USER, [to_email], msg.as_string())
        print(f"✅ Email sent successfully to {to_email}")
        return True
    except Exception as e:
        print(f"❌ Email error for {to_email}: {e}")
        return False


def send_low_attendance_alert(student_email: str, student_name: str, attendance_percentage: float, subject_name: str = None):
    """Send low attendance alert email to student"""
    subject = "⚠️ Low Attendance Alert - Action Required"
    
    # Plain text version
    body = f"""Dear {student_name},

This is an automated alert from the Attendance Management System.

Your current attendance is {attendance_percentage:.1f}%, which is below the required 75% threshold.

IMPORTANT: You need to improve your attendance to meet the minimum requirement of 75%.

Current Status:
- Your Attendance: {attendance_percentage:.1f}%
- Required Minimum: 75.0%
- Shortfall: {75.0 - attendance_percentage:.1f}%

{f'Subject: {subject_name}' if subject_name else 'Overall Attendance'}

Please make sure to attend all upcoming classes regularly to improve your attendance percentage.

If you have any concerns or valid reasons for your absences, please contact your class coordinator immediately.

Best regards,
Attendance Management System

---
This is an automated email. Please do not reply to this email.
"""

    # HTML version (better formatting)
    html_body = f"""
<!DOCTYPE html>
<html>
<head>
    <style>
        body {{ font-family: Arial, sans-serif; line-height: 1.6; color: #333; }}
        .container {{ max-width: 600px; margin: 0 auto; padding: 20px; }}
        .header {{ background-color: #dc2626; color: white; padding: 20px; border-radius: 5px 5px 0 0; }}
        .content {{ background-color: #f9fafb; padding: 30px; border: 1px solid #e5e7eb; }}
        .alert-box {{ background-color: #fef2f2; border-left: 4px solid #dc2626; padding: 15px; margin: 20px 0; }}
        .stats {{ background-color: white; padding: 20px; border-radius: 5px; margin: 20px 0; }}
        .stat-row {{ display: flex; justify-content: space-between; padding: 10px 0; border-bottom: 1px solid #e5e7eb; }}
        .stat-label {{ font-weight: bold; }}
        .stat-value {{ color: #dc2626; font-weight: bold; }}
        .footer {{ background-color: #f3f4f6; padding: 15px; text-align: center; font-size: 12px; color: #6b7280; border-radius: 0 0 5px 5px; }}
        .action-required {{ color: #dc2626; font-weight: bold; font-size: 18px; }}
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h2 style="margin: 0;">⚠️ Low Attendance Alert</h2>
        </div>
        <div class="content">
            <p>Dear <strong>{student_name}</strong>,</p>
            
            <div class="alert-box">
                <p class="action-required">ACTION REQUIRED</p>
                <p>Your current attendance is <strong>{attendance_percentage:.1f}%</strong>, which is below the required <strong>75%</strong> threshold.</p>
            </div>

            <div class="stats">
                <h3 style="margin-top: 0;">Attendance Summary</h3>
                <div class="stat-row">
                    <span class="stat-label">Your Attendance:</span>
                    <span class="stat-value">{attendance_percentage:.1f}%</span>
                </div>
                <div class="stat-row">
                    <span class="stat-label">Required Minimum:</span>
                    <span class="stat-value">75.0%</span>
                </div>
                <div class="stat-row">
                    <span class="stat-label">Shortfall:</span>
                    <span class="stat-value">{75.0 - attendance_percentage:.1f}%</span>
                </div>
                {f'<div class="stat-row"><span class="stat-label">Subject:</span><span>{subject_name}</span></div>' if subject_name else ''}
            </div>

            <h3>What You Need to Do:</h3>
            <ul>
                <li>Attend all upcoming classes regularly</li>
                <li>Contact your class coordinator if you have valid reasons for absences</li>
                <li>Monitor your attendance regularly through the student portal</li>
            </ul>

            <p><strong>Note:</strong> Maintaining minimum 75% attendance is mandatory. Failure to meet this requirement may affect your academic standing.</p>
        </div>
        <div class="footer">
            <p>This is an automated email from the Attendance Management System.</p>
            <p>Please do not reply to this email.</p>
        </div>
    </div>
</body>
</html>
"""

    return send_email(student_email, subject, body, html_body)
