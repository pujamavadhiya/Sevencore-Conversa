# Deployment & Production Operations Guide: Sevencore Conversa

This document provides a step-by-step guide for deploying **Sevencore Conversa** to production on **Render** (Django REST API & Managed PostgreSQL) and **Vercel** (Next.js App Router Frontend).

---

## Architecture Overview

```
                                      +-------------------------------+
                                      |   Vercel (Next.js Frontend)   |
                                      | https://conversa.sevencore.ai |
                                      +---------------+---------------+
                                                      |
                                                      | HTTPS REST Calls
                                                      v
+-------------------------------+     +---------------+---------------+
| Sarvam Voice Agents Telephony | <-> |    Render Web API (Django)    |
| (Outbound API & Webhooks)     |     |   https://api.sevencore.ai    |
+-------------------------------+     +-------+---------------+-------+
                                              |               |
                                              | SQL           |
                                              v               v
                                      +-------+-------+ +-----+-------+
                                      | Managed       | | Render      |
                                      | PostgreSQL    | | Persistent  |
                                      | Database      | | Background  |
                                      +---------------+ | Worker      |
                                                        +-------------+
```

---

## 1. Sarvam AI Voice Agents Setup

1. **Create an account** on [Sarvam AI Platform](https://apps.sarvam.ai/).
2. **Complete Telephony KYC**:
   - In the Sarvam Console, navigate to **Deploy → Phone Numbers**.
   - Click **Add Connection** and select **Rent from Sarvam** (powered by Vobiz).
   - Submit your entity verification (Individual or Corporate).
3. **Provision Rented Phone Number**:
   - Once approved, open the number catalog and purchase an Indian phone number (e.g. `+91804XXXXXXX`).
   - Copy the following values into your secure production notes:
     - `SARVAM_API_KEY` (Workspace API Key)
     - `SARVAM_ORG_ID` (Organization ID from URL or settings)
     - `SARVAM_WORKSPACE_ID` (Workspace ID)
     - `SARVAM_CONNECTION_ID` (e.g. the Sarvam Vobiz connection ID)
     - `SARVAM_AGENT_PHONE_NUMBER` (your provisioned E.164 phone number)

---

## 2. Deploying Backend to Render

1. **Create Managed PostgreSQL Database**:
   - In the Render Dashboard, click **New + → PostgreSQL**.
   - Name: `sevencore-conversa-postgres`.
   - Region: `Singapore` (optimal lowest latency to India).
   - Plan: Standard (avoids free-tier expiration).
   - Copy the **Internal Database URL**.

2. **Create Web Service for Django**:
   - In Render, click **New + → Web Service**.
   - Connect your GitHub repository.
   - Root Directory: leave as root or set `backend`.
   - Environment: `Python 3`.
   - Build Command:
     ```bash
     cd backend && pip install -r requirements.txt && python manage.py collectstatic --noinput && python manage.py migrate
     ```
   - Start Command:
     ```bash
     cd backend && gunicorn config.wsgi:application --bind 0.0.0.0:$PORT --workers 3
     ```

3. **Configure Render Environment Variables**:
   In the Render Web Service **Environment** tab, set:
   | Variable | Value / Description |
   | :--- | :--- |
   | `DJANGO_SECRET_KEY` | Generate a 64-character random string |
   | `DJANGO_DEBUG` | `False` |
   | `DJANGO_ALLOWED_HOSTS` | `api.yourdomain.com,.onrender.com` |
   | `DATABASE_URL` | Select from database: `sevencore-conversa-postgres` |
   | `FRONTEND_URL` | `https://conversa.sevencore.ai` |
   | `CORS_ALLOWED_ORIGINS` | `https://conversa.sevencore.ai` |
   | `SARVAM_USE_MOCK` | `False` (for live calling) or `True` (for testing) |
   | `SARVAM_API_KEY` | `<your-sarvam-api-key>` |
   | `SARVAM_ORG_ID` | `<your-sarvam-org-id>` |
   | `SARVAM_WORKSPACE_ID` | `<your-sarvam-workspace-id>` |
   | `SARVAM_CONNECTION_ID` | `<your-sarvam-vobiz-connection-id>` |
   | `SARVAM_AGENT_PHONE_NUMBER`| `+91804XXXXXXX` |
   | `SARVAM_DEFAULT_APP_ID` | `<your-sarvam-app-id>` |
   | `SARVAM_WEBHOOK_SECRET` | Generate a random token |
   | `BACKEND_PUBLIC_URL` | `https://api.yourdomain.com` |

---

## 3. Deploying Frontend to Vercel

1. **Import Git Repository** into Vercel.
2. **Framework Preset**: Next.js.
3. **Root Directory**: `frontend`.
4. **Environment Variables**:
   - `NEXT_PUBLIC_API_BASE_URL`: `https://sevencore-conversa-backend.onrender.com/api/v1`
   - `NEXT_PUBLIC_APP_NAME`: `Sevencore Conversa`
5. Click **Deploy**.

---

## 4. Configuring Sarvam Webhooks

Once your backend is live:
- Webhook URL format: `https://<your-backend-domain>/api/v1/webhooks/sarvam/`
- Every campaign call attempt and single test call sends its webhook configuration directly with this callback URL and metadata tags.
- As calls complete, transcripts, call durations, and status updates are received and logged automatically.
