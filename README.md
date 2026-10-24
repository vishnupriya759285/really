# BugTwin — Autonomous Bug Reproduction, AI Coding Twin & Regression Prevention

> **BugTwin** is a developer tool that turns hard-to-reproduce software bugs into reliable, automated regression tests. It captures sanitized execution traces, recreates failures in an isolated environment, identifies likely root causes, and uses AI coding agents like Devin to implement and verify fixes. Instead of spending hours debugging issues that only occur in certain environments or under specific conditions, developers can reproduce, fix, and prevent the same bugs from returning through one streamlined workflow.

---

## 🌟 Key Capabilities

1. **Standalone Multi-Port Architecture**:
   - **Target Client Web App (Port 4000)**: Complete e-commerce SaaS storefront with real-time telemetry capture (uncaught JS exceptions, fetch network traces, console logs, and click breadcrumbs).
   - **Really Platform & Gemini Bot (Port 3000)**: Dedicated backend, persistent database, Gemini AI diagnostic engine, and QA verification suite.
2. **Gemini AI Debugging Bot**:
   - Ingests complex telemetry crash dumps directly from client applications.
   - Synthesizes clear, step-by-step **Developer Reproduction Guides**.
   - Pinpoints root cause mechanisms and provides architectural recommendations.
   - Generates minimal, defensive **Unified Code Diffs**.
3. **Pull Request (PR) Lifecycle Engine**:
   - Developer reviews bot diagnosis and requests PR generation (`bot/fix-...` branch).
   - Developer reviews PR changes, checklist, and test verification badges.
   - 1-click PR merge into `main` branch with live merge commit tracking.
4. **Transparent Verification & Integrity**:
   - Simulated sandbox executions are explicitly labeled with `[SIMULATED]` badges.
   - Fixes are never marked verified without supporting automated test runner execution output (Exit code 0).
   - Verified fixes automatically populate the **Regression Test Library**.

---

## 🏗️ Architecture

```
┌──────────────────────────────────────────────┐          ┌─────────────────────────────────────────────┐
│  Client Website (NovaPay Storefront)         │          │  Really QA Platform & Gemini Bot Server     │
│  Port: http://localhost:4000                 │          │  Port: http://localhost:3000                │
├──────────────────────────────────────────────┤          ├─────────────────────────────────────────────┤
│ • Full E-commerce & Cloud SaaS store         │          │ • Gemini AI Debugging Engine                │
│ • Telemetry SDK: Intercepts JS runtime       │          │ • Developer Reproduction Guide Synthesizer  │
│   exceptions, fetch failures, console logs,  │ ───────► │ • Root cause & architectural suggestions    │
│   and user click breadcrumbs                 │   POST   │ • Unified Code Patch Diff Generator         │
│ • "🚨 Send Telemetry Bug Report" Button      │/telemetry│ • Pull Request (PR) generator               │
│ • 4 Live Crash Trigger Scenarios             │          │ • Pull Request (PR) review & merge controls │
└──────────────────────────────────────────────┘          └─────────────────────────────────────────────┘
```

---

## 🚀 Quick Start

### 1. Prerequisites
- **Node.js** v18+ or v20+

### 2. Environment Setup
Copy the example environment template:
```bash
cp .env.example .env
```
Add your Gemini API key to `.env`:
```env
GEMINI_API_KEY=your_gemini_api_key_here
PORT=3000
TEST_PORT=4000
```
*(Note: `.env` is strictly gitignored to keep credentials secure).*

### 3. Run Applications

**Start both servers concurrently:**
```bash
npm run dev:all
```

Or start them individually:
```bash
# Terminal 1: Really Platform & Gemini Bot
npm start
# -> Running on http://localhost:3000

# Terminal 2: Standalone Client Test Website
npm run start:test-site
# -> Running on http://localhost:4000
```

---

## 🧪 Automated QA Test Suite

Run the full automated test suite covering endpoints, the 10-step user journey, integrity rules, and the multi-port Gemini Bot PR lifecycle:

```bash
npm test
```

Individual test suites:
```bash
npm run test:api         # Backend REST API & database persistence
npm run test:journey     # 10-Step E2E user journey audit
npm run test:integrity   # Simulation labeling & verified-by-test validation
npm run test:client-bot  # Multi-port telemetry ingestion, Gemini bot & PR merge
```

---

## 📂 Repository Structure

```
really/
├── server.js                      # Express backend for Really (Port 3000)
├── backend/
│   ├── gemini_bot.js              # Gemini AI Bot analyzer (gemini-3.8-flash)
│   └── workflow.js                # Reproduction sandbox & verification engine
├── db/
│   └── db.js                      # Persistent database layer (ACID-safe)
├── public/
│   ├── index.html                 # Really SPA frontend
│   ├── styles.css                 # Dark mode glassmorphic styling
│   └── app.js                     # SPA routing, stepper, and PR review interface
├── test-website/                  # Standalone Target Client Application (Port 4000)
│   ├── server.js                  # Client app backend with intentional fault endpoints
│   └── public/
│       ├── index.html             # NovaPay Storefront HTML
│       ├── styles.css             # Storefront styles
│       ├── telemetry.js           # Client error, network, console & breadcrumb tracker
│       └── app.js                 # Cart and bug trigger handlers
├── tests/
│   ├── test_api_endpoints.js      # API integration tests
│   ├── test_user_journey_e2e.js   # 10-step user journey audit
│   ├── test_integrity_rules.js    # Simulation & verification integrity tests
│   └── test_client_to_server_flow.js # Multi-port client-to-bot PR workflow tests
├── .env.example                   # Sanitized environment template
├── .gitignore                     # Strict exclusion of .env and credentials
└── package.json                   # Dependencies & npm scripts
```

---

## 🛡️ Security & Privacy Notice
All `.env` files and API keys are strictly excluded from version control via `.gitignore`. The Gemini AI Bot dynamically reads credentials from runtime environment variables.
