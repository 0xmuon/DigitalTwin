# Live Google Sheets Viewer

A lightweight static webpage that reads a Google Sheet via the public Sheets API and refreshes automatically. No server required.

## Requirements
- A Google Cloud "API key" (Browser key) with the Google Sheets API enabled
- The spreadsheet must be accessible to "Anyone with the link (Viewer)" or the used API key must have access via OAuth (this page uses only API key, so prefer public read access)

## Get your API key
1. Open Google Cloud Console → APIs & Services → Credentials
2. Create credentials → API key
3. Restrict the key to HTTP referrers (optional for local use) and enable the "Google Sheets API" in Library

## Find your Spreadsheet ID
- From a URL like `https://docs.google.com/spreadsheets/d/1abcDEFghIJKLmnoPQRstuVWXYZ1234567890/edit#gid=0`, the Spreadsheet ID is the long string after `/d/` and before `/edit`

## Make the sheet readable
- In Google Sheets: Share → General access → "Anyone with the link" → Viewer
- Alternatively, keep it private but then you cannot use this static page with API key only

## Configure and run
1. Open `index.html` in your browser (double-click is fine)
2. Enter your API Key, Spreadsheet ID, and Range (e.g. `Sheet1!A1:E50`)
3. Click Save. The page will fetch and render your data and auto-refresh on the interval

## URL parameters
Instead of using the inputs, you can pre-configure via query parameters:

```
index.html?apiKey=YOUR_KEY&sheetId=YOUR_SHEET_ID&range=Sheet1!A1:E50&interval=10
```

- `apiKey`: Your Google API key
- `sheetId`: Spreadsheet ID
- `range`: A1 notation range (include the sheet/tab name). Example: `Sheet1!A1:E50`
- `interval`: Refresh interval in seconds (minimum 3)

## Notes
- This uses `GET https://sheets.googleapis.com/v4/spreadsheets/{sheetId}/values/{range}?key={API_KEY}`
- The first row is treated as headers
- Data is cached in memory only; the page re-renders only when the returned data changes
- Settings are stored in `localStorage` under `gs_config`

---

# Secure backend mode (private Sheet, no keys in browser)
If you want to keep your API key and Sheet ID private, run the Node server with a Google service account and call `/api/values` from the frontend.

## Setup
1. Create a Service Account in Google Cloud → download JSON key as `creds.json` (keep private!)
2. Share your Spreadsheet with the service account email (Viewer)
3. Copy `ENV.sample` to `.env` and set:
   - `SHEET_ID=<your-private-spreadsheet-id>`
   - Optionally `GOOGLE_APPLICATION_CREDENTIALS=/absolute/path/to/creds.json` (defaults to `./creds.json`)
4. Place `creds.json` in the project root (or the path above)
5. Install deps and run server:

```
npm install
npm run dev
```

Server runs at `http://localhost:3000`. Frontend files are served from project root.

## API
`GET /api/values?range=Sheet1!A1:D1000`
- Response: `{ values: string[][] }`
- The server authenticates with the service account.

## Frontend changes
- In secure mode, the browser will NOT send API key or Sheet ID. The page will call `/api/values` with the configured range at your chosen interval.
