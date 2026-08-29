# Jira Analytics Pro & Auto Logtime Hub

A modern, privacy-first **Jira Analytics & Automation Platform** built with React 19, TypeScript, Vite, Cloudflare Pages Functions, and Node.js.

Designed for developers, tech leads, and project managers to easily track **Billable Hours (`customfield_12200`)**, reconcile actual logged worklogs, monitor active **Working Tasks** with financial efficiency/profit rates, and automate batch worklog logging to Jira Server / Data Center / Cloud.

---

## ✨ Key Features

- 📊 **Smart Billable Analytics**: Live extraction of `customfield_12200` (Billable Hrs), `customfield_13000` (Asigned Bill To), `customfield_13100` (Billed Date), and reconciliation against actual worklogs.
- 🎯 **Monthly KPI & Target Tracking**: Set monthly quota goals (e.g., 80h/160h) and track completion rates in real-time.
- 🚀 **Task Working Dashboard**: Overview of all active assigned issues with profit/loss efficiency metrics (Billable vs Logged time).
- 🔍 **Task Inspector**: Deep-dive into any Jira issue to inspect fields, worklog authors, and export raw JSON.
- 📋 **Rich Clipboard Export**: One-click copy for high-fidelity formatted HTML tables directly into Microsoft Teams, Jira Comments, Slack, Google Docs, Word, or Excel.
- 🔒 **100% Privacy-First & Client-Side**: All tokens and domains are stored strictly in browser `localStorage`. No telemetry or server-side logging.
- ⚡ **Zero-Config Cloudflare Edge Proxy**: Built-in Cloudflare Pages Function proxy (`/api/jira/*`) to bypass CORS seamlessly.
- 🤖 **CLI Automation Tools**: Node.js scripts for bulk Jira worklog logging (`logtime.js`) and issue assignment (`assign.js`).

---

## 🛠️ Tech Stack

- **Frontend**: React 19, TypeScript, Vite, Vanilla CSS Tokens & Glassmorphism Design, Lucide Icons
- **Edge Proxy**: Cloudflare Pages Functions (`web/functions/api/jira/[[path]].ts`)
- **CLI / Backend Scripts**: Node.js REST API clients

---

## 🚀 Getting Started

### 1. Web Application (Recommended)

```bash
cd web
npm install
npm run dev
```

The app will start at `http://localhost:5173`.

#### Authentication:
1. Click the **Key / Profile** icon in the navigation bar.
2. Enter your **Jira Domain URL** (e.g. `https://jira.yourcompany.com`) and your **Personal Access Token (PAT)**.
3. All data will be fetched in real time directly into your browser.

---

### 2. Standalone HTML Dashboard with Local Proxy

```bash
# Copy and configure your credentials
cp auth.example.json auth.json

# Start local server with built-in CORS proxy
node views/server.js
```

Open `http://localhost:3000` in your browser.

---

### 3. CLI Auto Logtime Tool

```bash
# 1. Create your auth file
cp auth.example.json auth.json

# 2. Prepare your worklog plan
cp logtim-plan.example.md logtim-plan.md

# 3. Run preview mode
node logtime.js --dry-run

# 4. Check existing worklogs
node logtime.js --check

# 5. Log worklogs for specific date or days
node logtime.js --days 3
node logtime.js --all
```

---

## 🔐 Security & Privacy

- **No Server Storage**: Personal Access Tokens (PATs) and credentials are never stored on external databases or sent to third-party services.
- **Git Protection**: All credentials (`auth.json`, `auth.txt`), personal logs (`logtim-plan.md`), and local cached responses are strictly excluded in `.gitignore`.

---

## 📄 License

MIT License.
