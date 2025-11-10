# Battery Digital Twin Dashboard

A real-time battery monitoring dashboard that reads data from Google Sheets and displays it with interactive visualizations.

## Prerequisites

- **Node.js** (v14 or higher) - [Download here](https://nodejs.org/)
- **Google Cloud Project** with Sheets API enabled
- **Google Service Account** credentials
- **Google Sheet** with battery data in the "ICR186501" sheet

## Setup Instructions

### 1. Install Dependencies

Open a terminal in the project directory and run:

```bash
npm install
```

### 2. Set Up Google Cloud Service Account

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create a new project or select an existing one
3. Enable the **Google Sheets API**:
   - Navigate to "APIs & Services" > "Library"
   - Search for "Google Sheets API"
   - Click "Enable"

4. Create a Service Account:
   - Go to "APIs & Services" > "Credentials"
   - Click "Create Credentials" > "Service Account"
   - Give it a name (e.g., "battery-monitor")
   - Click "Create and Continue"
   - Skip optional steps and click "Done"

5. Create and Download Key:
   - Click on the created service account
   - Go to "Keys" tab
   - Click "Add Key" > "Create new key"
   - Choose "JSON" format
   - Download the JSON file
   - **Rename it to `creds.json`** and place it in the project root directory

### 3. Share Google Sheet with Service Account

1. Open your Google Sheet (the one with battery data)
2. Click the "Share" button
3. Get the service account email from `creds.json` (look for `"client_email"` field)
4. Share the sheet with that email address
5. Give it "Viewer" permissions (read-only is sufficient)

### 4. Get Your Google Sheet ID

1. Open your Google Sheet
2. Look at the URL: `https://docs.google.com/spreadsheets/d/SHEET_ID_HERE/edit`
3. Copy the `SHEET_ID_HERE` part (the long string between `/d/` and `/edit`)

### 5. Configure Environment Variables

1. Copy the example environment file:
   ```bash
   # On Windows (Command Prompt)
   copy .env.example .env
   
   # On Windows (PowerShell)
   Copy-Item .env.example .env
   
   # On Mac/Linux
   cp .env.example .env
   ```

2. Open `.env` file and update it:
   ```
   SHEET_ID=your_actual_sheet_id_here
   GOOGLE_APPLICATION_CREDENTIALS=./creds.json
   PORT=3000
   ```

   Replace `your_actual_sheet_id_here` with your actual Google Sheet ID.

### 6. Verify Your Google Sheet Structure

Make sure your Google Sheet has a sheet named **"ICR186501"** with the following columns in row 1:

- `Timestamp`
- `SOC_cc (%)`
- `SOC_EKF (%)`
- `SOC_AI (%)`
- `Status`
- `V_meas (V)`
- `V_model (V)`
- `I_meas (A)`
- `Temp (°C)`
- `V_RC_EKF (V)`

## Running the Application

### Start the Server

```bash
npm start
```

Or:

```bash
npm run dev
```

### Access the Dashboard

Open your browser and navigate to:

```
http://localhost:3000
```

The dashboard will automatically poll the Google Sheet every 5 seconds and update the visualizations in real-time.

## Project Structure

```
DigitalTwin/
├── index.html          # Frontend HTML
├── script.js           # Frontend JavaScript (data fetching & visualization)
├── styles.css          # Styling
├── server.js           # Express backend server
├── package.json        # Node.js dependencies
├── .env                # Environment variables (create this)
├── creds.json          # Google service account credentials (add this)
└── README.md           # This file
```

## Troubleshooting

### Error: "Missing SHEET_ID in environment"
- Make sure you created a `.env` file
- Verify `SHEET_ID` is set in the `.env` file

### Error: "Missing service account credentials"
- Ensure `creds.json` exists in the project root
- Check that `GOOGLE_APPLICATION_CREDENTIALS` in `.env` points to the correct path

### Error: "The caller does not have permission"
- Verify the Google Sheet is shared with the service account email
- Check that the service account has at least "Viewer" access

### Error: "Unable to parse range"
- Ensure your sheet is named exactly "ICR186501" (case-sensitive)
- Verify the sheet exists in your Google Spreadsheet

### Dashboard shows "No data"
- Check that your sheet has data rows (not just headers)
- Verify the column headers match exactly (case-insensitive, but format matters)
- Check browser console (F12) for any JavaScript errors

## Features

- **Real-time Updates**: Polls Google Sheet every 5 seconds
- **SOC Gauge**: Visual battery state of charge indicator
- **Voltage Chart**: Displays V_meas, V_model, and V_RC_EKF
- **Current Chart**: Shows I_meas over time
- **Temperature Sparkline**: Mini trend visualization
- **Data Table**: Full spreadsheet data view
- **Status Indicators**: Color-coded charging/discharging/idle states

## Development

The application uses:
- **Backend**: Node.js + Express
- **Frontend**: Vanilla JavaScript (no frameworks)
- **API**: Google Sheets API v4
- **Visualization**: HTML5 Canvas

## License

Private project - All rights reserved

