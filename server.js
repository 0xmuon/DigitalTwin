import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { google } from 'googleapis';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PORT = process.env.PORT || 3000;
const SHEET_ID = process.env.SHEET_ID;
const CREDS_PATH = process.env.GOOGLE_APPLICATION_CREDENTIALS || path.join(__dirname, 'creds.json');

if (!SHEET_ID) {
	console.error('Missing SHEET_ID in environment');
	process.exit(1);
}

if (!fs.existsSync(CREDS_PATH)) {
	console.error(`Missing service account credentials at ${CREDS_PATH}`);
	process.exit(1);
}

async function getAuth() {
	const auth = new google.auth.GoogleAuth({
		keyFile: CREDS_PATH,
		scopes: ['https://www.googleapis.com/auth/spreadsheets.readonly']
	});
	return auth.getClient();
}

async function getValues(range) {
	const authClient = await getAuth();
	const sheets = google.sheets({ version: 'v4', auth: authClient });
	const res = await sheets.spreadsheets.values.get({ spreadsheetId: SHEET_ID, range });
	return res.data.values || [];
}

const app = express();
app.use(cors());
app.use(express.json());

// API endpoint to fetch values securely
app.get('/api/values', async (req, res) => {
	try {
		const range = String(req.query.range || 'Sheet1!A1:D100');
		const values = await getValues(range);
		res.json({ values });
	} catch (err) {
		console.error(err);
		res.status(500).json({ error: String(err.message || err) });
	}
});

// Serve static files (frontend)
app.use(express.static(__dirname));

app.listen(PORT, () => {
	console.log(`Server running on http://localhost:${PORT}`);
});
