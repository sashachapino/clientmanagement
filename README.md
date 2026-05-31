# Client Check-in Tracker — Gmail Add-on

A Gmail sidebar add-on that scans your sent "session notes" emails and groups clients by how recently you last saw them.

## What it shows

| Group | Meaning |
|---|---|
| ✅ Current clients | Last session within 90 days |
| 🟡 Check in — 3 months | Last session 3–6 months ago |
| 🟠 Check in — 6 months | Last session 6–12 months ago |
| 🔴 Check in — 1 year+ | Last session over a year ago |

Each entry shows the client's name (from the To: field) and the date of the last session notes email you sent them.

## How it works

It searches your Gmail for sent emails matching `from:me subject:"session notes"`, finds the most recent one per recipient, and buckets them by elapsed time.

---

## Setup (one-time, ~5 minutes)

### 1. Create a new Apps Script project

1. Go to [script.google.com](https://script.google.com) and click **New project**
2. Name it `Client Check-in Tracker`

### 2. Copy the files

Replace the contents of the default `Code.gs` with the contents of `Code.gs` in this repo.

In the left panel click **+** next to Files and choose **Script**. Name it whatever you want — the logic all lives in `Code.gs`.

### 3. Replace the manifest

1. In the editor click **Project Settings** (gear icon) → check **Show "appsscript.json" manifest file in editor**
2. Click `appsscript.json` in the left panel
3. Replace its contents with the `appsscript.json` in this repo

> **Timezone note:** The manifest defaults to `America/New_York`. Change `timeZone` in `appsscript.json` if needed.

### 4. Deploy as a Gmail Add-on (for personal use)

1. Click **Deploy → Test deployments**
2. Under **Gmail**, click **Install**
3. Grant the requested permissions (read Gmail, identify you as the sender)

### 5. Open Gmail

Reload Gmail. You'll see a new icon in the right-side add-on panel. Click it — the sidebar loads with your client groups.

Click **Refresh** (top-right menu in the sidebar) to re-scan after sending new session notes.

---

## Customisation

| What | Where |
|---|---|
| Change the search query (e.g. add a label) | `SEARCH_QUERY` constant in `Code.gs` |
| Change the 90/180/365-day thresholds | `DAYS_90`, `DAYS_180`, `DAYS_365` in `Code.gs` |
| Scan more threads (default 500) | `MAX_THREADS` in `Code.gs` |

## Limitations

- Scans up to 500 threads (covers years of weekly sessions with many clients)
- Client identity is keyed by email address — if a client uses multiple addresses they'll appear as separate entries
- Only looks at the **To:** field; CC'd addresses are ignored
