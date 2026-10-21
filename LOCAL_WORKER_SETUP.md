# DPDP Vault — Local Fallback Worker Setup Guide (Windows)

This guide explains how to run the DPDP Vault Playwright worker locally on your Windows PC as a high-availability fallback. If the Railway worker is stopped, sleeping, or redeploying, your local worker will automatically claim and process assessment test runs submitted through the deployed production website (**https://dpdp-gilt.vercel.app**).

---

## Architecture Overview

```
                      ┌──────────────────────────────────────────────┐
                      │    https://dpdp-gilt.vercel.app              │
                      │    (Next.js App Router on Vercel)            │
                      └──────────────────────┬───────────────────────┘
                                             │
                              Submits TestRun to MongoDB Queue
                                             │
                                             ▼
                      ┌──────────────────────────────────────────────┐
                      │    MongoDB Atlas Production Database         │
                      │    (Queue: TestRun status = 'queued')        │
                      └──────────────┬────────────────┬──────────────┘
                                     │                │
            Atomic FIFO Claim        │                │ Atomic FIFO Claim
            (Only 1 worker claims)   │                │ (Only 1 worker claims)
                                     ▼                ▼
            ┌─────────────────────────────┐  ┌─────────────────────────────┐
            │   Railway Worker (Primary)  │  │ Local PC Worker (Fallback)  │
            │   (Linux Docker Container)  │  │ (Windows PowerShell)         │
            └─────────────────────────────┘  └─────────────────────────────┘
```

### Concurrency & Dual-Worker Safety
- **Atomic Claiming**: Both workers use atomic MongoDB `findOneAndUpdate` queries. A test run can **never** be claimed or executed by both workers simultaneously.
- **Heartbeat & Lease**: The active worker maintains a 2-minute sliding lease with a 10-second heartbeat. If a worker process abruptly crashes or loses internet connectivity, the lease expires and the other worker automatically reclaims the run after 3 minutes.
- **Graceful Release**: When you stop the local worker with `Ctrl + C`, any in-flight job is immediately released back to `queued` state so Railway can process it immediately without timeout delays.

---

## Prerequisites

1. **Windows 10 / 11** with **PowerShell** (Windows Terminal or default PowerShell).
2. **Node.js**: Version `20.x` or higher (`node -v`).
3. Access to the project root directory: `c:\Users\omkar\OneDrive\Desktop\DPDP`.

---

## Quick Setup (4 Steps)

### Step 1: Open PowerShell in Project Directory
Open **Windows PowerShell** and navigate to your DPDP Vault folder:
```powershell
cd c:\Users\omkar\OneDrive\Desktop\DPDP
```

### Step 2: Configure Environment (`.env.worker`)
The worker requires your production MongoDB connection string, Gemini API key, and Cloudinary credentials.

If `.env.worker` does not already exist, copy it from `.env.worker.example`:
```powershell
Copy-Item .env.worker.example .env.worker
```

Verify that `.env.worker` contains the production settings:
```env
# MongoDB Connection String (Points to production MongoDB Atlas)
MONGODB_URI=mongodb+srv://<username>:<password>@cluster0.ek18u.mongodb.net/dpdp_assessment?retryWrites=true&w=majority

# Google Gemini API Key
GEMINI_API_KEY=your_gemini_api_key_here
GEMINI_MODEL=gemini-3.8-flash

# Cloudinary Storage for Evidence Screenshots
CLOUDINARY_CLOUD_NAME=your_cloudinary_cloud_name
CLOUDINARY_API_KEY=your_cloudinary_api_key
CLOUDINARY_API_SECRET=your_cloudinary_api_secret

# JWT Secret
JWT_SECRET=dpdp-assessment-platform-secure-jwt-secret-key-2026
```
> **Note**: `.env.worker` is permanently listed in `.gitignore` and will never be committed to Git.

### Step 3: Install Playwright Chromium Browser
Install the Chromium browser binary on your Windows machine:
```powershell
npx playwright install chromium
```
*(If already installed, this completes in 1-2 seconds).*

### Step 4: Run Health & Readiness Check
Run the built-in diagnostic health check:
```powershell
npm run worker:check
```

You will see:
```text
================================================================
 DPDP Vault — Local Fallback Worker Health & Readiness Check
================================================================

--- 1. Environment Configuration ---
Active config file: .env.worker
  [✓ PASS] MONGODB_URI: mongodb+srv:*****@cluster0.ek18u.mongodb.net/...
  [✓ PASS] GEMINI_API_KEY: AQ.Ab8...
  [✓ PASS] CLOUDINARY_CLOUD_NAME: dnnbf7fmx
  [✓ PASS] CLOUDINARY_API_KEY: 8532...
  [✓ PASS] CLOUDINARY_API_SECRET: IYIm...
  [✓ PASS] JWT_SECRET: dpdp-a...

--- 2. Database & Production Queue Connectivity ---
  [✓ PASS] MongoDB Atlas connected successfully.
  [✓ PASS] Queue metrics fetched: Queued=0, Running=0, Completed=12, Failed=2

--- 3. Playwright Chromium Browser Availability ---
  [✓ PASS] Chromium browser launched and tested successfully.
           Browser Version: Chromium v156.0.8078.4

================================================================
 [STATUS] ✓ LOCAL WORKER IS READY.
================================================================
```

---

## Starting the Local Worker

Start the worker daemon using:
```powershell
npm run worker:start
```
*(or simply `npm run worker`)*

### Expected Startup Output
```text
[WorkerDaemon worker-local-fallback-12345] Connecting to DPDP Vault database...
[WorkerDaemon worker-local-fallback-12345] Online and listening for queued Playwright inspection jobs.
[WorkerDaemon worker-local-fallback-12345] Verifying Playwright Chromium browser environment...
[WorkerDaemon worker-local-fallback-12345] Chromium preflight PASSED (Chromium v156.0.8078.4). Browser ready.
[WorkerDaemon worker-local-fallback-12345] Initial queue metrics: Queued=0, Running=0, Completed=12, Failed=2
```

The worker is now active, continuously listening for jobs every 3 seconds.

---

## Verifying with Live Website (`https://dpdp-gilt.vercel.app`)

1. Keep the PowerShell terminal running `npm run worker:start`.
2. Open your browser and navigate to:
   **https://dpdp-gilt.vercel.app/portal/onboarding** or **https://dpdp-gilt.vercel.app/assessments/new**
3. Select an authorized target (e.g. `https://www.ekarth.org`) and click **"Start Assessment"**.
4. Check your Windows PowerShell terminal. You will see:
   ```text
   ========================================================
   [WorkerDaemon worker-local-fallback-...] Claimed TestRun: 6ad8... (Target: www.ekarth.org)
   ========================================================
   [Cloudinary Upload] Stored screenshot for notice_and_consent on Cloudinary...
   [Cloudinary Upload] Stored screenshot for privacy_notice_compliance on Cloudinary...
   [Assessment Diagnostics] Finalized Assessment ... | Status: completed | ComplianceScore: ...%
   [WorkerDaemon worker-local-fallback-...] Completed TestRun in 48.2s.
   ```
5. Return to the browser at `https://dpdp-gilt.vercel.app`. You will see the live progress bar advance to 100%, screenshots render, and statutory assessment results populate!

---

## Stopping and Restarting

### To Stop the Worker:
Press `Ctrl + C` in the PowerShell window.
- If the worker is idle, it exits immediately.
- If a test is running, it safely releases the job back to `queued` state so Railway or your next session can process it:
  ```text
  [WorkerDaemon worker-local-...] SIGINT received. Shutting down gracefully...
  [WorkerDaemon worker-local-...] Releasing active job 6ad8... back to queue for other workers...
  [WorkerDaemon worker-local-...] Job 6ad8... successfully re-queued.
  ```

### To Restart:
```powershell
npm run worker:start
```

---

## Troubleshooting

### 1. `Executable doesn't exist at C:\Users\...\AppData\Local\ms-playwright\...`
**Cause**: Chromium browser binary is not downloaded.  
**Fix**:
```powershell
npx playwright install chromium
```

### 2. `MongooseServerSelectionError: Could not connect to any servers in your MongoDB Atlas cluster`
**Cause**: Your current IP address is not whitelisted in MongoDB Atlas.  
**Fix**:
1. Log into your [MongoDB Atlas Console](https://cloud.mongodb.com/).
2. Go to **Network Access** under Security.
3. Click **Add IP Address** and select **Add Current IP Address** (or `0.0.0.0/0` for universal dev access).
4. Save and re-run `npm run worker:check`.

### 3. `Warning: Module type of ... is not specified and it doesn't parse as CommonJS`
**Cause**: Harmless Node.js warning about typeless package.json.  
**Fix**: No action needed. Node automatically reparses files as ES modules without breaking Next.js or Tailwind.

### 4. How do I know which worker processed a job?
Open MongoDB Atlas or check the Assessment report in the UI. Each test run stores the worker ID in the database:
- `workerId: "worker-railway-primary-..."` → Processed by Railway
- `workerId: "worker-local-fallback-..."` → Processed by your local PC
