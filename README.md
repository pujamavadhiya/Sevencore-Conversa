# Sevencore Conversa: India-Focused AI Voice Calling Automation Platform

> **Product Name:** Sevencore Conversa  
> **Brand Positioning:** An AI-powered calling automation platform that helps Indian businesses manage voice agents, customer conversations, outbound campaigns, and call analytics from one dashboard.  
> **Primary Voice & Telephony Provider:** Sarvam AI Voice Agents (`apps.sarvam.ai`) & Sarvam-Rented Indian Phone Numbers. *(Twilio and ElevenLabs are strictly excluded).*

---

## 1. System Architecture

```
sevencore-conversa/
├── frontend/                     # Next.js 14 App Router, TypeScript, Vanilla CSS
│   ├── src/
│   │   ├── app/                  # App routes: Dashboard, Agents, Contacts, Campaigns, Calls, Transcripts, Analytics, Meetings, Settings
│   │   ├── components/           # Sidebar, Header, TestCallModal, layout elements
│   │   ├── lib/                  # branding.ts (centralized brand config), api.ts (REST client)
│   │   └── types/                # TypeScript interface definitions
│   └── package.json
│
├── backend/                      # Django 5.1 & Django REST Framework
│   ├── config/                   # settings.py, urls.py, branding.py (central backend brand config)
│   ├── apps/
│   │   ├── accounts/             # User authentication, roles (Admin, Manager, Agent)
│   │   ├── organizations/        # Multi-tenant isolation, compliance guardrails
│   │   ├── agents/               # VoiceAgent configurations, Bulbul voice synthesis
│   │   ├── knowledge_base/       # PDF/TXT/CSV document ingestion & parsing
│   │   ├── contacts/             # Indian E.164 normalization, DND/NDNC suppression registry, spreadsheet parser
│   │   ├── campaigns/            # Pacing engine (CPS), TRAI 09:00-20:00 window, mandatory confirmation guard
│   │   ├── calls/                # CallAttempt tracking, idempotency, cost calculations, Sarvam webhook receiver
│   │   ├── analytics/            # Real-time conversion metrics, daily trends, duration distributions
│   │   └── meetings/             # Follow-up meetings and lead disposition tracker
│   ├── integrations/
│   │   └── sarvam/               # Sarvam Live & Mock provider clients, compliance validator
│   ├── tests/                    # Automated unit & integration tests
│   └── manage.py
│
├── deployment/                   # Render blueprint (render.yaml) & Vercel deployment instructions
├── .gitignore
└── README.md
```

---

## 2. Key Features

- **Sarvam AI Voice Integration**: Built on Sarvam's official Voice Agents Outbound and Transcripts API with Bulbul v4 synthesis and 11+ Indian languages (Hindi, English, Marathi, Gujarati, Tamil, Telugu, Kannada, Bengali, Punjabi).
- **Indian Telecom Compliance (TRAI)**: Commercial calling window enforcement (09:00 AM – 08:00 PM IST), Indian E.164 phone normalization (+91), and automated Do Not Disturb (NDNC) suppression registry.
- **Accurate Cost Calculation**: Pro-rated call duration billing at published Sarvam rates (₹3.50/min for Pay-as-you-go).
- **Zero-Secret Client Architecture**: All API keys, connection IDs, and rented phone configurations are stored exclusively in backend environment variables.
- **Mock Simulation Engine**: Transparent dev mode (`SARVAM_USE_MOCK=True`) enabling zero-cost local testing and simulated Indian-language conversation transcripts without dialing real telephony lines.
- **Safety Guards**: Spreadsheet imports *never* trigger calls automatically. All campaigns require explicit user confirmation before launch.

---

## 3. Local Development Setup

### Prerequisites
- **macOS or Linux**
- **Python 3.11+** (Python 3.13 tested)
- **Node.js v18+** (Node v20 tested) and `npm`
- **PostgreSQL** (optional for local development; Django automatically uses SQLite fallback if `DATABASE_URL` is empty)

---

### Step 1: Clone and Set Up Backend

```bash
# Navigate to project root
cd "AI Autocalling Platform"

# Create Python virtual environment
python3 -m venv backend/venv

# Activate virtual environment
# macOS / Linux:
source backend/venv/bin/activate

# Upgrade pip and install backend dependencies
pip install --upgrade pip
pip install -r backend/requirements.txt
```

### Step 2: Configure Backend Environment

Copy the example environment configuration:
```bash
cp backend/.env.example backend/.env
```

The default `.env` includes:
```ini
SARVAM_USE_MOCK=True
DJANGO_DEBUG=True
DATABASE_URL=
CALLING_WINDOW_START_HOUR=9
CALLING_WINDOW_END_HOUR=20
MAX_CALLS_PER_SECOND=2
```
*Note: In local development, `SARVAM_USE_MOCK=True` allows you to test full campaign lifecycles and transcripts without needing Sarvam credentials.*

### Step 3: Run Migrations and Seed Initial Data

```bash
# Run database migrations
backend/venv/bin/python backend/manage.py migrate

# Seed sample Indian business agents, sample contacts, and default admin user
backend/venv/bin/python backend/seed_data.py
```
*Default login credentials created:*
- **Username:** `admin`
- **Password:** `admin123`

### Step 4: Run Backend Tests

```bash
backend/venv/bin/python backend/manage.py test tests
```

### Step 5: Start Backend Server

```bash
backend/venv/bin/python backend/manage.py runserver 8000
```
Backend API will be live at `http://localhost:8000/api/v1/`.

---

### Step 6: Set Up and Start Frontend

Open a new terminal window:
```bash
cd "AI Autocalling Platform/frontend"

# Copy frontend environment file
cp .env.example .env.local

# Install frontend dependencies
npm install

# Start Next.js development server
npm run dev
```
Frontend application will be accessible at **`http://localhost:3000`**.

---

## 4. How to Configure Live Sarvam AI Credentials

When you are ready to switch from Mock mode to live telephony:

1. Obtain your **Workspace API Key**, **Organization ID**, and **Workspace ID** from [Sarvam Console](https://apps.sarvam.ai/).
2. In the Sarvam Console, go to **Deploy → Phone Numbers**, complete **KYC**, and select **Rent from Sarvam**.
3. Copy your provisioned **Connection ID** and **Rented Phone Number** (e.g. `+918040001234`).
4. Update `backend/.env`:
   ```ini
   SARVAM_USE_MOCK=False
   SARVAM_API_KEY=your_actual_sarvam_api_key
   SARVAM_ORG_ID=your_org_id
   SARVAM_WORKSPACE_ID=your_workspace_id
   SARVAM_CONNECTION_ID=your_connection_id
   SARVAM_AGENT_PHONE_NUMBER=+918040001234
   ```
5. Restart the backend server. The UI will instantly display **LIVE VOBIZ RENTED LINE**.

---

## 5. How to Test a Single Call Safely

1. Open the dashboard at `http://localhost:3000`.
2. Click the **Quick Test Call** button in the top navigation bar.
3. Select your desired Voice Agent (e.g., *Priya - B2B Sales & Lead Qualification*).
4. Enter a test Indian phone number (e.g., `+91 98765 43210`).
5. Click **Initiate Call**.
6. The modal will display the live call progress, execution time, and turn-by-turn conversation transcript.

---

## 6. How to Run a Calling Campaign

1. **Import Audience**: Go to **Contacts & Import** and upload a `.csv` or `.xlsx` spreadsheet (or click *Download Sample Template*).
2. **Review Validation**: Inspect the preview table. Valid Indian 10-digit mobile numbers are accepted; numbers on the DND suppression list are flagged. Confirm import.
3. **Launch Wizard**: Navigate to **Calling Campaigns** and click **New Calling Campaign**.
4. Follow the 7-step wizard:
   - Step 1: Enter Name & Description.
   - Step 2: Choose Voice Agent.
   - Step 3: Select Audience Contacts.
   - Step 4: Configure Pacing & TRAI Window (09:00 - 20:00 IST).
   - Step 5: Verify Indian Telecom Compliance checklist.
   - Step 6: Review Estimated Cost in INR.
   - Step 7: Check the **Mandatory Confirmation checkbox** and click **Authorize & Launch Campaign**.

---

## 7. Centralized Brand Configuration

The platform name is configured centrally:
- **Backend:** `backend/config/branding.py`
- **Frontend:** `frontend/src/lib/branding.ts`

To customize or adjust the brand name `Sevencore Conversa`, modify only those two files.

---

## 8. Deployment to Production

Refer to [`deployment/instructions.md`](deployment/instructions.md) for full deployment instructions:
- **Frontend:** Deploy to [Vercel](https://vercel.com) using the `frontend/` directory with `NEXT_PUBLIC_API_BASE_URL`.
- **Backend & Database:** Deploy to [Render](https://render.com) using `deployment/render.yaml` with persistent Managed PostgreSQL.
