# DPDP Vault — Local-First Worker (Primary) with Automatic Railway Failover (Backup)

This guide documents the **Local-First, Railway-Second** worker architecture for DPDP Vault.

- **Primary Worker**: Your local Windows PC (`WORKER_ROLE=local-primary`). Handles all new assessment jobs by default whenever online and healthy.
- **Automatic Fallback Worker**: Railway cloud container (`WORKER_ROLE=railway-backup`). Monitors the queue on standby and automatically processes jobs whenever the local worker is offline, stopped, or disconnected.
- **Production Application**: [https://dpdp-gilt.vercel.app](https://dpdp-gilt.vercel.app)

---

## 1. Architecture & Priority Workflow

```
                             ┌──────────────────────────────────────────────┐
                             │    https://dpdp-gilt.vercel.app              │
                             │    (Next.js App Router on Vercel)            │
                             └──────────────────────┬───────────────────────┘
                                                    │
                                      Submits TestRun to Shared Queue
                                                    │
                                                    ▼
                             ┌──────────────────────────────────────────────┐
                             │    MongoDB Atlas Production Database         │
                             │    - Queue: TestRun (status = 'queued')      │
                             │    - Heartbeats: WorkerHeartbeat             │
                             └──────────────┬────────────────┬──────────────┘
                                            │                │
                   Primary Priority         │                │ Standby / Auto-Failover
                   Claims first             │                │ Claims ONLY when Local is offline
                                            ▼                ▼
                   ┌─────────────────────────────┐  ┌─────────────────────────────┐
                   │  Local PC Worker (Primary)  │  │  Railway Worker (Backup)    │
                   │  (Windows PowerShell)       │  │  (Docker Container)         │
                   │  - Refresh Heartbeat (5s)   │  │  - Monitors Local Heartbeat │
                   │  - Immediate Claim          │  │  - Auto-claims if Local >20s│
                   └─────────────────────────────┘  └─────────────────────────────┘
```

### Key Operating Principles

1. **Local-First Priority**: When your Windows PC worker is running, it publishes heartbeats to MongoDB every 5 seconds. The Railway backup worker detects that the local primary is healthy and **yields** all queued jobs to your PC.
2. **Zero-Intervention Failover**: When your PC is powered off, loses Wi-Fi, or the worker process terminates:
   - Graceful shutdown (`Ctrl + C`) immediately marks the local worker `offline` and releases in-flight jobs.
   - Abrupt crashes expire after `LOCAL_WORKER_HEARTBEAT_TIMEOUT_MS` (default: 20 seconds).
   - Railway automatically assumes active processing and claims pending jobs.
3. **Seamless Local Recovery**: When you run `npm run worker:start` on your PC, an active heartbeat is registered instantly. Railway returns to standby for new jobs. Any active job already running on Railway finishes without interruption or duplication.
4. **Race Condition Prevention**: All claims use atomic MongoDB `findOneAndUpdate` queries. Two workers can never claim or execute the same `TestRun`.
5. **Lease Locks & Circuit Breaker**: Active runs hold a 2-minute sliding lease (`leaseExpiresAt`). If a worker crashes mid-test, `reconcileStaleJobs()` safely returns the job to `queued` for the other worker, bounded by `maxRetries: 2` to prevent infinite loops.

---

## 2. Windows Local Worker Setup

### Prerequisites
- **Windows 10 / 11** with PowerShell.
- **Node.js**: Version `20.x` or higher (`node -v`).
- Access to root directory: `c:\Users\omkar\OneDrive\Desktop\DPDP`.

### Step 1: Open PowerShell in Project Directory
```powershell
cd c:\Users\omkar\OneDrive\Desktop\DPDP
```

### Step 2: Configure Environment (`.env.worker`)
The local worker uses `.env.worker` (listed in `.gitignore` to keep credentials secure):
```powershell
# Copy template if not already present
Copy-Item .env.worker.example .env.worker
```

Ensure `.env.worker` contains the production settings:
```env
# Production MongoDB Atlas URI
MONGODB_URI=mongodb+srv://<username>:<password>@cluster0.ek18u.mongodb.net/dpdp_assessment?retryWrites=true&w=majority

# Google Gemini API Key
GEMINI_API_KEY=your_gemini_api_key_here
GEMINI_MODEL=gemini-3.8-flash

# Cloudinary Evidence Storage
CLOUDINARY_CLOUD_NAME=your_cloudinary_cloud_name
CLOUDINARY_API_KEY=your_cloudinary_api_key
CLOUDINARY_API_SECRET=your_cloudinary_api_secret

# JWT Secret
JWT_SECRET=dpdp-assessment-platform-secure-jwt-secret-key-2026

# Local Worker Priority (Defaults to local-primary on Windows)
WORKER_ROLE=local-primary
HEARTBEAT_INTERVAL_MS=5000
POLL_INTERVAL_MS=3000
```

### Step 3: Install Playwright Chromium Browser
```powershell
npx playwright install chromium
```

### Step 4: Run Health & Cluster Status Check
```powershell
npm run worker:check
```

Expected output:
```text
================================================================
 DPDP Vault — Local-First Worker (Primary) Health & Readiness Check
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
  [✓ PASS] Queue metrics fetched: Queued=0, Running=0, Completed=12, Failed=3

--- 3. Dual-Worker Cluster & Failover Status ---
  Primary Local Worker:   ✓ ONLINE & PRIMARY (Preferred Priority Active)
  Backup Railway Worker:  ✓ ONLINE & STANDBY (Ready to failover)

--- 4. Playwright Chromium Browser Availability ---
  [✓ PASS] Chromium browser launched and tested successfully in 1439ms.
           Browser Version: Chromium v156.0.8078.4

================================================================
 [STATUS] ✓ LOCAL-FIRST WORKER (PRIMARY) IS READY.
================================================================
```

---

## 3. Starting the Local Primary Worker

Run the local daemon:
```powershell
npm run worker:start
```
*(or `npm run worker`)*

### Daemon Output Logs:
```text
[WorkerDaemon worker-local-primary-...] Connecting to DPDP Vault database...
[WorkerDaemon worker-local-primary-...] Heartbeat registered (local-primary). Health status: ONLINE.
[WorkerDaemon worker-local-primary-...] Local worker online and PRIMARY. Preferred priority active.
[WorkerDaemon worker-local-primary-...] Local worker recovered: Primary priority restored. New jobs claimed locally.
[WorkerDaemon worker-local-primary-...] Railway fallback active and standing by in cluster.
[WorkerDaemon worker-local-primary-...] Chromium preflight PASSED (Chromium v156.0.8078.4). Browser ready.
[WorkerDaemon worker-local-primary-...] Initial queue metrics: Queued=0, Running=0, Completed=12, Failed=3
```

When an assessment is submitted on **https://dpdp-gilt.vercel.app**:
```text
========================================================
[WorkerDaemon worker-local-primary-...] Claimed TestRun: 6ad8... (Target: www.ekarth.org)
[WorkerDaemon worker-local-primary-...] Job claimed locally (PRIMARY). Processing assessment.
========================================================
[Cloudinary Upload] Stored screenshot for notice_and_consent on Cloudinary...
[Assessment Diagnostics] Finalized Assessment ... | Status: completed | ComplianceScore: 82%
[WorkerDaemon worker-local-primary-...] Completed TestRun in 45.2s.
```

---

## 4. Railway Worker Configuration (Automatic Backup)

The Railway worker runs in a Linux container using the Dockerfile located in the repository.

### Railway Environment Variables

In your [Railway Project Dashboard](https://railway.app/) → Service Settings → **Variables**, set:

| Variable Name | Value | Description |
| :--- | :--- | :--- |
| `WORKER_ROLE` | `railway-backup` | Designates Railway as automatic backup |
| `LOCAL_WORKER_HEARTBEAT_TIMEOUT_MS` | `20000` | Fallback threshold (20s) |
| `HEARTBEAT_INTERVAL_MS` | `5000` | Railway heartbeat reporting interval (5s) |
| `POLL_INTERVAL_MS` | `3000` | Queue polling frequency (3s) |
| `MONGODB_URI` | `mongodb+srv://...` | Shared production database URI |
| `GEMINI_API_KEY` | `your_key` | Gemini AI evaluation API key |
| `GEMINI_MODEL` | `gemini-3.8-flash` | Gemini model |
| `CLOUDINARY_CLOUD_NAME` | `dnnbf7fmx` | Cloudinary storage bucket |
| `CLOUDINARY_API_KEY` | `your_key` | Cloudinary API key |
| `CLOUDINARY_API_SECRET` | `your_secret` | Cloudinary API secret |
| `JWT_SECRET` | `dpdp-...` | JWT verification secret |

### Expected Railway Logs During Standby:
```text
[WorkerDaemon worker-railway-backup-...] Connecting to DPDP Vault database...
[WorkerDaemon worker-railway-backup-...] Heartbeat registered (railway-backup). Health status: ONLINE.
[WorkerDaemon worker-railway-backup-...] Online as BACKUP Railway worker. Standby mode active.
[WorkerDaemon worker-railway-backup-...] Will automatically claim jobs if primary local worker goes offline.
[WorkerDaemon worker-railway-backup-...] Primary local worker is healthy in cluster. Standing by as backup.
[WorkerDaemon worker-railway-backup-...] Local primary worker is active. Standing by as automatic fallback.
```

### Expected Railway Logs During Failover:
```text
[WorkerDaemon worker-railway-backup-...] Primary local worker is OFFLINE. Railway fallback active: processing queue.
========================================================
[WorkerDaemon worker-railway-backup-...] Claimed TestRun: 6ad8... (Target: www.ekarth.org)
[WorkerDaemon worker-railway-backup-...] Job claimed on Railway fallback (BACKUP). Processing assessment.
========================================================
```

---

## 5. Verified Failover Test Scenarios

The test suite in `scripts/test-local-first-failover.mjs` validates the entire lifecycle:

Run the test suite anytime:
```powershell
node scripts/test-local-first-failover.mjs
```

| Scenario | Behavior Verified | Status |
| :--- | :--- | :--- |
| **1. Both Workers Running** | Railway backup yields; Local worker gets priority and claims queued job. | **PASS** |
| **2. Local Worker Offline** | When local heartbeat expires (>20s), Railway automatically claims new jobs. | **PASS** |
| **3. Concurrency Protection** | Simultaneous claims from both workers resolve atomically to exactly one winner. | **PASS** |
| **4. Mid-Run Crash Recovery** | If local worker crashes mid-inspection, expired lease is safely re-queued. | **PASS** |
| **5. Local Reconnection** | Local worker recovers; claims subsequent jobs; does not steal Railway active runs. | **PASS** |
| **6. Terminal Failure Guard** | Runs exceeding max retry limits permanently transition to `failed` without loops. | **PASS** |

---

## 6. Troubleshooting & FAQs

### How can I verify which worker processed an assessment?
Every completed `TestRun` records the `workerRole` and `workerId` in MongoDB:
- `workerRole: "local-primary"` & `workerId: "worker-local-primary-..."` → Processed by your local PC.
- `workerRole: "railway-backup"` & `workerId: "worker-railway-backup-..."` → Processed by Railway fallback.

### What happens if I stop my PC worker with Ctrl + C?
The daemon catches `SIGINT`, immediately sends an `offline` status update to `WorkerHeartbeat`, and releases any in-progress run back to `queued`. Railway will pick up the released job within 3 seconds.

### What happens if my PC suddenly loses power or crashes?
The local heartbeat expires in 20 seconds (`LOCAL_WORKER_HEARTBEAT_TIMEOUT_MS`). The 2-minute lease expires, and Railway's periodic reconcile loop re-queues and executes the job automatically.
