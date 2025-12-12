# ⚡ AI Outreach Engine  
### Fully Automated, AI-Powered Job Outreach System  
_Generated emails. Smart follow-ups. Auto-tracking. Zero manual work._


![Status](https://img.shields.io/badge/Status-Active-brightgreen)
![AI](https://img.shields.io/badge/AI-Gemini_2.5-blue)
![Google Apps Script](https://img.shields.io/badge/Built_with-Apps_Script-orange)
![Automation](https://img.shields.io/badge/Workflow-Automated-success)
![License](https://img.shields.io/badge/License-MIT-black)

</div>

---

## 🚀 Overview

**AI Outreach Engine** is a fully autonomous job-outreach automation system built using:

- **Google Apps Script**
- **Gemini Generative AI**
- **Google Sheets**
- **Google Docs → PDF export**
- **Gmail API**

It behaves like a personal **SDR (Sales Development Representative)**:

✨ Writes personalized emails  
✨ Sends them with your résumé  
✨ Schedules Day-3 and Day-7 follow-ups  
✨ Tracks replies & bounces  
✨ Stops automatically on response  
✨ Saves 30+ hours/week  

All you manage is a single Google Sheet.  
The system does everything else.

---

## ✨ Key Features

### 🔹 AI-Generated Email Content
Automatically generates:
- CEO outreach email
- HR outreach email
- Day-3 follow-up emails (CEO + HR)
- Day-7 follow-up emails (CEO + HR)

All with:
- Personalized context from your résumé  
- Role-specific tone  
- HTML formatting  
- No “final”, no pushy wording  

---

### 🔹 Smart Automation Workflow  
The system:

1. Reads each row of your Google Sheet  
2. Generates emails (only once)  
3. Sends them with your PDF résumé  
4. Waits the exact number of days  
5. Sends follow-ups  
6. Stops if a reply or bounce is detected  

Think of it as:
> **Job outreach → turned into a fully automated pipeline.**

---

### 🔹 Built-In Safety + Human-Like Behavior
- Randomized delay between emails  
- Max 20 sends per day  
- Weekend skip  
- A/B tested subject lines  
- Multi-email support (`email1 / email2`)  
- Graceful handling of NA, null, or missing values  

---

### 🔹 Reply & Bounce Detection via Gmail  
The script automatically checks:

**Reply:**  
from:<email> newer_than:10d

makefile
Copy code

**Bounce:**  
subject:"Delivery Status Notification" to:<email>

yaml
Copy code

If triggered → outreach stops instantly.

---

## 📁 Google Sheet Structure

Company | Category | Founder(s)/CEO | Founder Email | Founder LinkedIn |
Recruiter/HR | Recruiter Email | Recruiter LinkedIn |
Email content (CEO) | Email content (HR) |
CEO Day3 email content | HR Day3 email content |
CEO Day7 email content | HR Day7 email content |
DAY 1 status CEO | DAY 1 status HR | Day 1 Date |
DAY 3 status HR | DAY 3 status CEO | Day 3 Date |
DAY 7 status HR | DAY 7 status CEO | Day 7 Date |
HR Replied | CEO Replied

yaml
Copy code

Everything is tracked automatically.  
No manual updating needed.

---

## 🧠 Architecture Diagram

Google Sheet → Apps Script Engine → Gemini 2.5 → Gmail → Automated Follow-ups
↓ ↑
Resume PDF Export ← Google Docs

yaml
Copy code

---

## ⚙️ Setup Instructions

### 1️⃣ Insert Your IDs
Update the config section in `Code.gs`:

```js
const GEMINI_API_KEY = "YOUR_KEY";
const RESUME_DOC_ID = "YOUR_GOOGLE_DOC_ID";
const SPREADSHEET_ID = "YOUR_SHEET_ID";
📌 Installation
2️⃣ Paste the Script Into Google Apps Script
Open:
Extensions → Apps Script → Paste full code
🔐 Permissions
3️⃣ Approve Required Permissions
Run this function once:
sendJobApplicationEmails()
Google will ask for:

Gmail access

Google Docs (read + export PDF)

Google Sheets (read/write)

Approve all to enable full automation.

⏰ Automation Scheduling
4️⃣ Activate Daily Auto-Send
Run:
createDailyTrigger()
This creates a daily trigger at 9 AM.
(You can change the time inside the code if needed.)

🧪 Testing Before Real Usage
Before going full automation:

Set:
MAX_EMAILS_PER_DAY = 1
Use your own email as CEO/HR

Verify:

📝 Email generation

📎 PDF résumé attachment

⏳ Follow-up timing (Day-3 / Day-7)

📬 Reply detection

🚫 Bounce detection

🧹 Skip logic for invalid emails

Everything should work end-to-end.

🔒 Security Recommendations
❌ Do NOT upload your API key to GitHub

🔐 Store sensitive keys in Script Properties instead of hardcoding

🔒 Résumé PDF export uses secure OAuth — no Drive permissions required

🛡 Gmail scanning respects your account’s security rules

📁 Project Structure
/README.md       → Documentation  
/Code.gs         → Full generative AI + outreach automation engine  
📜 License
MIT License — free for personal and commercial use.

🙋‍♂️ Author
Rohit Pottavathini
Automation Engineer • Full-Stack Developer • GenAI Systems Builder

⭐ Support
If this project inspires you or saves you time,
please consider giving it a ⭐ star on GitHub — it helps the project grow!
