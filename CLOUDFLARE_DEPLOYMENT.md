# BugTwin & Companion Client — Cloudflare Deployment & Demonstration Guide

This guide explains how to host both **BugTwin (Really Platform)** and the **Companion Target Client (NovaPay Store)** as separate applications on Cloudflare, and provides a step-by-step demonstration walkthrough for live showcases and investor/developer presentations.

---

## 1. Project Essence: What is BugTwin?

> **BugTwin** is an autonomous developer tool that turns hard-to-reproduce software bugs into reliable, automated regression tests. It captures sanitized execution traces from production/staging web apps, recreates failures in an isolated environment, identifies root causes using Google Gemini AI, and drives AI coding agents to implement, verify, and pull-request fixes with proof.

Instead of spending hours or days attempting to reproduce bugs that only occur under specific environments or sequence of clicks, BugTwin provides an end-to-end automated pipeline:
1. **Telemetry SDK**: Intercepts unhandled JS errors, network failures, console logs, and click trails.
2. **AI Bug Intelligence**: Gemini analyzes logs, determines root cause file & line number, explains failure mechanism, and outputs human-readable reproduction steps.
3. **Reproduction Sandbox Engine**: Synthesizes standalone reproduction test scripts that fail (Exit 1) on buggy code and pass (Exit 0) on verified code.
4. **Autonomous PR Lifecycle**: Generates clean code diffs, allows the developer to request a GitHub Pull Request, and merges the fix.
5. **Regression Test Suite**: Permanently stores the generated reproduction test in the regression library so the bug can never recur.

---

## 2. Cloudflare Hosting Architecture

Both the **Target Client Website** and the **BugTwin Platform Server** are decoupled and can be hosted independently on Cloudflare.

```
┌─────────────────────────────────────────┐          ┌─────────────────────────────────────────┐
│         Target Client Website           │          │         BugTwin Platform Server         │
│      (NovaPay Cloud Storefront)         │          │       (Autonomous AI QA Engine)         │
│                                         │          │                                         │
│ Hosted on: Cloudflare Pages             │          │ Hosted on: Cloudflare Workers / Tunnel  │
│ URL: https://novapay-client.pages.dev   │          │ URL: https://bugtwin-api.pages.dev      │
│                                         │          │                                         │
│ • Static Assets: HTML / CSS / JS        │          │ • Express / Node API Engine             │
│ • Client Telemetry Tracker SDK          │  POST    │ • Gemini 3.8 / 3.5 AI Bot Integration   │
│ • Fault Injectors (Checkout/Webhooks)   │─────────>│ • Reproduction Sandbox Runner           │
│ • Dynamic Server Settings (⚙️ Modal)    │/telemetry│ • Atomic JSON State & PR Merger         │
└─────────────────────────────────────────┘          └─────────────────────────────────────────┘
```

---

## 3. How to Deploy on Cloudflare

### Option A: Deploying Target Client to Cloudflare Pages (Free, 2 Minutes)

The client storefront in `test-website/public` is fully static and Cloudflare Pages-ready:
1. Install Wrangler CLI (if not already installed):
   ```bash
   npm install -g wrangler
   ```
2. Deploy the static directory directly to Cloudflare Pages:
   ```bash
   cd test-website
   npx wrangler pages deploy public --project-name=bugtwin-client-store
   ```
3. Cloudflare will give you a live URL, e.g.:
   `https://bugtwin-client-store.pages.dev`

### Option B: Deploying BugTwin Server to Cloudflare

BugTwin runs on Node.js with Gemini AI integration. You can host it using:
1. **Cloudflare Tunnel (Zero-configuration, instant public HTTPS endpoint)**:
   ```bash
   # Expose local port 3000 to Cloudflare worldwide instantly:
   npx cloudflared tunnel --url http://localhost:3000
   ```
   This gives you an instant public HTTPS address (e.g., `https://random-subdomain.trycloudflare.com`).
2. **Cloudflare Workers / Docker / Serverless (Render / Railway / fly.io)**:
   Deploy `server.js` with environment variable:
   ```env
   GEMINI_API_KEY=<your_gemini_api_key>
   PORT=3000
   ```

---

## 4. Connecting the Hosted Client to the Hosted Server

The client test website is designed with **zero hardcoded localhost constraints**:

1. **Via UI (1 Click)**:
   - In NovaPay Store, look at the top header pill: `BugTwin Server: http://localhost:3000`
   - Click the **`⚙️ Change`** button.
   - Enter your hosted Cloudflare URL (e.g. `https://bugtwin-api.your-domain.workers.dev` or `https://xyz.trycloudflare.com`).
   - Click **`🔍 Test Connection`** to test health and measure latency.
   - Click **`Save & Apply`**. It persists in `localStorage` across page refreshes.

2. **Via URL Query Parameter**:
   Share direct links with pre-configured backend endpoints:
   ```
   https://bugtwin-client-store.pages.dev/?bugtwin=https://your-bugtwin-server.com
   ```

---

## 5. Live Demonstration Script (Step-by-Step)

Follow this exact walkthrough during your demo:

### Phase 1: Show the Client Storefront
1. Open the NovaPay Store: `http://localhost:4000` (or `https://bugtwin-client-store.pages.dev`).
2. Show that it's a real e-commerce storefront:
   - Click **`+ Add to Cart`** on "DevTwin Autonomous QA Agent".
   - Notice the cart counter updates and subtotal calculates.
   - Point out the **Pulse indicator** showing live connection to BugTwin.

### Phase 2: Trigger a Hard-to-Reproduce Production Bug
1. Scroll down to the **"Interactive Bug Injection Panel"**.
2. Click **`💥 Trigger Checkout Tax Crash (TypeError)`**:
   - The app attempts to calculate itemized tax on a promotional item missing the multiplier.
   - A runtime exception is triggered (`TypeError: Cannot read properties of undefined (reading 'multiplier')`).
3. The **Client Telemetry Crash Report Modal** instantly slides open.
4. Explain to the audience what BugTwin captured:
   - **Tab 1: JavaScript Exception & Stack Trace**: Exact file, line number, and stack frame.
   - **Tab 2: Network Requests**: Recent HTTP fetch requests, payloads, and response statuses.
   - **Tab 3: Console Logs**: All log statements leading up to the crash.
   - **Tab 4: User Breadcrumbs**: The exact sequence of button clicks the user performed before the crash.

### Phase 3: Transmit Telemetry to BugTwin AI Bot
1. Click the big button: **`🚀 Send to Really Bot Server →`**.
2. Explain what is happening in the background:
   - The Telemetry SDK transmits the sanitized JSON payload to the BugTwin server.
   - BugTwin initializes a new debugging session.
   - **Google Gemini AI (`gemini-3.8-flash`)** parses the stack trace, network payload, and user breadcrumbs.
   - Gemini deduces the root cause, formats step-by-step developer reproduction steps, generates an isolated test case, and drafts a code diff fix.
3. A green notification toast pops up:
   `✓ Telemetry Ingested by Gemini Bot! Session sess_... created.`
4. Click **`View Session & Ask for PR →`** (or open the new tab that was launched).

### Phase 4: Walkthrough the BugTwin Platform
1. In the BugTwin dashboard (`http://localhost:3000/sessions/sess_...`), show the complete debugging twin:
   - **Session Info**: Severity, affected component, and environment details.
   - **Bot Analysis Card**: Powered by Gemini AI. Shows root cause file, function, confidence score, and human-readable reproduction steps:
     ```
     1. Open NovaPay store at http://localhost:4000
     2. Clicked [button] "+ Add to Cart"
     3. Clicked [button] "💥 Trigger Checkout Tax Crash"
     ```
2. Show the **Autonomous Workflow Stepper**:
   - Step 1: Log Ingestion & Trace Sanitization ✓
   - Step 2: Gemini AI Root Cause Identification ✓
   - Step 3: Sandboxed Reproduction (Exit Code 1 - Bug Confirmed) ✓
   - Step 4: Code Diff Fix Synthesis ✓
   - Step 5: Verification Test Suite (Exit Code 0 - Verified with Evidence) ✓

### Phase 5: Request Pull Request & Merge
1. Scroll to the **"Pull Request Lifecycle"** section:
   - Show the proposed code diff with syntax-highlighted additions and removals.
   - Click **`Create Pull Request`**.
   - A PR branch `fix/sess_...` is opened with title, description, and reproduction evidence.
2. Click **`Merge Pull Request`**:
   - The PR merges into `main`.
   - The reproduction script is automatically promoted to the **Regression Test Library** (`/regressions`).
3. Click **"Regression Test Library"** in the top navigation:
   - Show the test case permanently stored to guarantee this bug can never recur in production.

---

## 6. Summary of Key Talking Points

| Feature | Developer Benefit |
| :--- | :--- |
| **Telemetry SDK** | Zero developer effort required to collect logs, network traces, and user click paths. |
| **Gemini AI Bot** | Transforms cryptic production stack traces into clear, actionable steps to reproduce. |
| **Sandbox Reproduction** | Generates verifiable test cases (Exit 1 on bug, Exit 0 on fix) without human trial-and-error. |
| **Automated PR Engine** | Bridges the gap from bug report to merged GitHub fix with regression prevention. |
| **Decoupled Architecture** | Compatible with any client app, whether running locally or deployed on Cloudflare Pages. |
