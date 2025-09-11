(function(){
	const rangeInput = document.getElementById('range');
	const intervalInput = document.getElementById('intervalSec');
	const saveBtn = document.getElementById('saveConfig');
	const refreshBtn = document.getElementById('refreshNow');
	const statusEl = document.getElementById('status');
	const lastUpdatedEl = document.getElementById('lastUpdated');
	const tableHead = document.getElementById('tableHead');
	const tableBody = document.getElementById('tableBody');

	// Dashboard elements
	const socGauge = document.getElementById('socGauge');
	const socValEl = document.getElementById('socVal');
	const socCcEl = document.getElementById('socCcVal');
	const socModelEl = document.getElementById('socModelVal');
	const voltValEl = document.getElementById('voltVal');
	const voltModelValEl = document.getElementById('voltModelVal');
	const currValEl = document.getElementById('currVal');
	const tempValEl = document.getElementById('tempVal');
	const stateValEl = document.getElementById('stateVal');
	const tsValEl = document.getElementById('tsVal');
	const voltSpark = document.getElementById('voltSpark');
	const currSpark = document.getElementById('currSpark');
	const tempSpark = document.getElementById('tempSpark');

	let pollTimer = null;
	let lastChecksum = '';

	// Simple in-memory history for sparklines
	const historyLimit = 90; // about 90 seconds if interval=1s
	const history = { voltage: [], current: [], temperature: [] };

	function readQueryParams(){
		const params = new URLSearchParams(window.location.search);
		return {
			range: params.get('range') || undefined,
			interval: params.get('interval') ? Number(params.get('interval')) : undefined,
		};
	}

	function loadConfig(){
		const fromQuery = readQueryParams();
		const local = JSON.parse(localStorage.getItem('gs_config_secure') || '{}');
		const config = {
			range: fromQuery.range ?? local.range ?? 'Sheet1!A1:H1000',
			interval: fromQuery.interval ?? local.interval ?? 1,
		};
		rangeInput.value = config.range;
		intervalInput.value = String(config.interval);
		return config;
	}

	function saveConfig(){
		const config = {
			range: rangeInput.value.trim() || 'Sheet1!A1:H1000',
			interval: Math.max(1, Number(intervalInput.value) || 1),
		};
		localStorage.setItem('gs_config_secure', JSON.stringify(config));
		return config;
	}

	function setStatus(text, isError=false){
		statusEl.textContent = text;
		statusEl.style.color = isError ? '#b91c1c' : '#334155';
	}

	function setLastUpdated(){
		const now = new Date();
		lastUpdatedEl.textContent = `Last updated: ${now.toLocaleString()}`;
	}

	function renderTable(values){
		// Clear
		tableHead.innerHTML = '';
		tableBody.innerHTML = '';
		if(!values || values.length === 0){
			setStatus('No data in the selected range.');
			return;
		}
		// Header from first row
		const headerRow = document.createElement('tr');
		values[0].forEach(cell => {
			const th = document.createElement('th');
			th.textContent = String(cell ?? '');
			headerRow.appendChild(th);
		});
		tableHead.appendChild(headerRow);

		// Body rows
		for(let r=1; r<values.length; r++){
			const tr = document.createElement('tr');
			values[r].forEach(cell => {
				const td = document.createElement('td');
				td.textContent = String(cell ?? '');
				tr.appendChild(td);
			});
			tableBody.appendChild(tr);
		}
	}

	function checksum(values){
		try {
			return JSON.stringify(values);
		} catch(_){
			return Math.random().toString(36);
		}
	}

	function normalizeHeader(h){
		return String(h || '').toLowerCase().replace(/[^a-z0-9]+/g, '');
	}

	function indicesFromHeaders(values){
		const headers = values[0] || [];
		const norm = headers.map(normalizeHeader);
		return {
			idxTimestamp: norm.indexOf('timestamp'),
			idxSocCc: norm.indexOf('soccc'),
			idxSocModel: norm.indexOf('socmodel'),
			idxStatus: norm.indexOf('status'),
			idxVMeas: norm.indexOf('vmeasv'),
			idxVModel: norm.indexOf('vmodelv'),
			idxCurrent: norm.indexOf('currenta'),
			idxTemp: norm.indexOf('tempc')
		};
	}

	function parseLatest(values){
		if(!values || values.length < 2) return null;
		const idx = indicesFromHeaders(values);
		// Last non-empty row
		let last = values.length - 1;
		while(last > 0 && (!values[last] || values[last].every(c => c === '' || c == null))) last--;
		const row = values[last] || [];
		function strAt(i){ return (i>=0 ? String(row[i] ?? '') : ''); }
		function numAt(i){ const n = Number(strAt(i)); return Number.isFinite(n) ? n : undefined; }
		return {
			timestamp: strAt(idx.idxTimestamp),
			socCc: numAt(idx.idxSocCc),
			socModel: numAt(idx.idxSocModel),
			status: strAt(idx.idxStatus),
			vMeas: numAt(idx.idxVMeas),
			vModel: numAt(idx.idxVModel),
			current: numAt(idx.idxCurrent),
			temp: numAt(idx.idxTemp)
		};
	}

	function sliceLastNSeries(values, n){
		if(!values || values.length < 2) return { vMeas: [], vModel: [], current: [] };
		const idx = indicesFromHeaders(values);
		const vMeas = [];
		const vModel = [];
		const current = [];
		for(let r = Math.max(1, values.length - n); r < values.length; r++){
			const row = values[r] || [];
			vMeas.push(idx.idxVMeas >= 0 ? Number(row[idx.idxVMeas]) : undefined);
			vModel.push(idx.idxVModel >= 0 ? Number(row[idx.idxVModel]) : undefined);
			current.push(idx.idxCurrent >= 0 ? Number(row[idx.idxCurrent]) : undefined);
		}
		return { vMeas, vModel, current };
	}

	function applyStateColor(text){
		const t = String(text || '').toLowerCase();
		stateValEl && (stateValEl.className = '');
		if(t.includes('discharg')) stateValEl && stateValEl.classList.add('state-discharging');
		else if(t.includes('charg')) stateValEl && stateValEl.classList.add('state-charging');
		else stateValEl && stateValEl.classList.add('state-idle');
	}

	function drawSocGauge(canvas, percent){
		if(!canvas) return;
		const ctx = canvas.getContext('2d');
		const w = canvas.width, h = canvas.height;
		ctx.clearRect(0,0,w,h);
		const cx = w/2, cy = h*0.9; // semi circle center below
		const r = Math.min(w, h*1.6)/2;
		const start = Math.PI; // 180°
		const end = 2*Math.PI; // 360°

		// Track
		ctx.lineWidth = 16;
		ctx.strokeStyle = '#e2e8f0';
		ctx.beginPath();
		ctx.arc(cx, cy, r, start, end);
		ctx.stroke();

		// Value arc
		const clamped = Math.max(0, Math.min(100, Number(percent)||0));
		const frac = clamped/100;
		const valEnd = start + (end - start) * frac;
		ctx.strokeStyle = clamped > 60 ? '#16a34a' : (clamped > 20 ? '#f59e0b' : '#ef4444');
		ctx.beginPath();
		ctx.arc(cx, cy, r, start, valEnd);
		ctx.stroke();
	}

	function normalizeSeries(series){
		return series.map(v => Number.isFinite(v) ? v : undefined);
	}

	function getMinMax(seriesList){
		let mins = [];
		let maxs = [];
		for(const s of seriesList){
			const vals = s.filter(v => typeof v === 'number');
			if(vals.length){
				mins.push(Math.min(...vals));
				maxs.push(Math.max(...vals));
			}
		}
		const min = mins.length ? Math.min(...mins) : 0;
		const max = maxs.length ? Math.max(...maxs) : 1;
		return { min, max: min===max ? min+1 : max };
	}

	function xAt(w, pad, i, count){
		if(count <= 1) return pad;
		return pad + (w - 2*pad) * (i / (count - 1));
	}

	function yAt(h, pad, value, min, span){
		return h - pad - (h - 2*pad) * ((value - min) / span);
	}

	function drawVoltageChart(canvas, vMeas, vModel){
		if(!canvas) return;
		const ctx = canvas.getContext('2d');
		const w = canvas.width, h = canvas.height;
		ctx.clearRect(0,0,w,h);
		const pad = 12;
		const s1 = normalizeSeries(vMeas);
		const s2 = normalizeSeries(vModel);
		const { min, max } = getMinMax([s1, s2]);
		const span = Math.max(1e-9, max - min);

		// Fill under measured line
		ctx.beginPath();
		let started = false;
		for(let i=0;i<s1.length;i++){
			const v = s1[i];
			if(typeof v !== 'number') continue;
			const x = xAt(w, pad, i, s1.length);
			const y = yAt(h, pad, v, min, span);
			if(!started){ ctx.moveTo(x,y); started = true; } else { ctx.lineTo(x,y); }
		}
		if(started){
			ctx.lineTo(xAt(w,pad,s1.length-1,s1.length), h-pad);
			ctx.lineTo(xAt(w,pad,0,s1.length), h-pad);
			ctx.closePath();
			const grad = ctx.createLinearGradient(0, pad, 0, h);
			grad.addColorStop(0, 'rgba(14,165,233,0.25)');
			grad.addColorStop(1, 'rgba(14,165,233,0.05)');
			ctx.fillStyle = grad;
			ctx.fill();
		}

		// Measured line
		ctx.beginPath();
		ctx.strokeStyle = '#0ea5e9';
		ctx.lineWidth = 2.5;
		let first = true;
		for(let i=0;i<s1.length;i++){
			const v = s1[i];
			if(typeof v !== 'number') continue;
			const x = xAt(w, pad, i, s1.length);
			const y = yAt(h, pad, v, min, span);
			if(first){ ctx.moveTo(x,y); first=false; } else { ctx.lineTo(x,y); }
		}
		ctx.stroke();

		// Model line (dashed)
		ctx.beginPath();
		ctx.setLineDash([4,3]);
		ctx.strokeStyle = '#64748b';
		ctx.lineWidth = 1.5;
		first = true;
		for(let i=0;i<s2.length;i++){
			const v = s2[i];
			if(typeof v !== 'number') continue;
			const x = xAt(w, pad, i, s2.length);
			const y = yAt(h, pad, v, min, span);
			if(first){ ctx.moveTo(x,y); first=false; } else { ctx.lineTo(x,y); }
		}
		ctx.stroke();
		ctx.setLineDash([]);
	}

	function drawCurrentChart(canvas, curr){
		if(!canvas) return;
		const ctx = canvas.getContext('2d');
		const w = canvas.width, h = canvas.height;
		ctx.clearRect(0,0,w,h);
		const pad = 12;
		const s = normalizeSeries(curr);
		const { min, max } = getMinMax([s]);
		const span = Math.max(1e-9, max - min);

		// Area fill
		ctx.beginPath();
		let started = false;
		for(let i=0;i<s.length;i++){
			const v = s[i];
			if(typeof v !== 'number') continue;
			const x = xAt(w, pad, i, s.length);
			const y = yAt(h, pad, v, min, span);
			if(!started){ ctx.moveTo(x,y); started = true; } else { ctx.lineTo(x,y); }
		}
		if(started){
			ctx.lineTo(xAt(w,pad,s.length-1,s.length), h-pad);
			ctx.lineTo(xAt(w,pad,0,s.length), h-pad);
			ctx.closePath();
			const grad = ctx.createLinearGradient(0, pad, 0, h);
			grad.addColorStop(0, 'rgba(16,185,129,0.25)');
			grad.addColorStop(1, 'rgba(16,185,129,0.05)');
			ctx.fillStyle = grad;
			ctx.fill();
		}

		// Line
		ctx.beginPath();
		ctx.strokeStyle = '#10b981';
		ctx.lineWidth = 2.5;
		let first = true;
		for(let i=0;i<s.length;i++){
			const v = s[i];
			if(typeof v !== 'number') continue;
			const x = xAt(w, pad, i, s.length);
			const y = yAt(h, pad, v, min, span);
			if(first){ ctx.moveTo(x,y); first=false; } else { ctx.lineTo(x,y); }
		}
		ctx.stroke();

		// Markers
		for(let i=0;i<s.length;i++){
			const v = s[i];
			if(typeof v !== 'number') continue;
			const x = xAt(w, pad, i, s.length);
			const y = yAt(h, pad, v, min, span);
			ctx.beginPath();
			ctx.fillStyle = '#10b981';
			ctx.arc(x, y, 2.5, 0, Math.PI*2);
			ctx.fill();
		}
	}

	// Small generic sparkline for temperature
	function drawSparkline(canvas, data, color){
		if(!canvas) return;
		const ctx = canvas.getContext('2d');
		const w = canvas.width, h = canvas.height;
		ctx.clearRect(0,0,w,h);
		const vals = (data || []).filter(v => typeof v === 'number');
		if(vals.length < 2) return;
		const min = Math.min(...vals);
		const max = Math.max(...vals);
		const pad = 4;
		const span = Math.max(1e-9, max - min);
		ctx.strokeStyle = color;
		ctx.lineWidth = 2;
		ctx.beginPath();
		let first = true;
		for(let i=0;i<data.length;i++){
			const v = data[i];
			if(typeof v !== 'number') continue;
			const x = pad + (w - 2*pad) * (i / (data.length - 1));
			const y = h - pad - (h - 2*pad) * ((v - min) / span);
			if(first){ ctx.moveTo(x,y); first=false; } else { ctx.lineTo(x,y); }
		}
		ctx.stroke();
	}

	async function fetchSheet(range){
		const url = `/api/values?range=${encodeURIComponent(range)}`;
		const res = await fetch(url, { cache: 'no-store' });
		if(!res.ok){
			const txt = await res.text();
			throw new Error(`HTTP ${res.status}: ${txt}`);
		}
		const data = await res.json();
		return data.values || [];
	}

	function updateDashboard(data){
		if(!data) return;
		if(typeof data.socCc === 'number'){
			socValEl && (socValEl.textContent = `${data.socCc.toFixed(0)}%`);
			drawSocGauge(socGauge, data.socCc);
			socCcEl && (socCcEl.textContent = `${data.socCc.toFixed(0)}%`);
		}
		if(typeof data.socModel === 'number'){
			socModelEl && (socModelEl.textContent = `${data.socModel.toFixed(0)}%`);
		}
		const isIdle = (String(data.status||'').toLowerCase().includes('idle'));
		if(typeof data.vMeas === 'number'){
			const displayV = (isIdle && data.vMeas === 0) ? undefined : data.vMeas;
			if(displayV !== undefined){
				voltValEl && (voltValEl.textContent = displayV.toFixed(3));
				history.voltage.push(displayV);
				if(history.voltage.length > historyLimit) history.voltage.shift();
			}
		}
		if(typeof data.vModel === 'number'){
			voltModelValEl && (voltModelValEl.textContent = data.vModel.toFixed(3));
		}
		if(typeof data.current === 'number'){
			currValEl && (currValEl.textContent = data.current.toFixed(3));
			history.current.push(data.current);
			if(history.current.length > historyLimit) history.current.shift();
		}
		if(typeof data.temp === 'number'){
			tempValEl && (tempValEl.textContent = data.temp.toFixed(2));
			history.temperature.push(data.temp);
			if(history.temperature.length > historyLimit) history.temperature.shift();
			drawSparkline(tempSpark, history.temperature, '#f97316');
		}
		if(typeof data.status === 'string'){
			stateValEl && (stateValEl.textContent = data.status || '--');
			applyStateColor(data.status);
		}
		if(typeof data.timestamp === 'string'){
			tsValEl && (tsValEl.textContent = data.timestamp || '--');
		}
	}

	async function refresh(config){
		try {
			setStatus('Fetching…');
			const values = await fetchSheet(config.range);
			const newSum = checksum(values);
			if(newSum !== lastChecksum){
				renderTable(values);
				lastChecksum = newSum;
			}
			const latest = parseLatest(values);
			updateDashboard(latest);
			// Draw last-10 graphs
			const series = sliceLastNSeries(values, 10);
			drawVoltageChart(voltSpark, series.vMeas, series.vModel);
			drawCurrentChart(currSpark, series.current);
			setLastUpdated();
			setStatus('Live');
		} catch(err){
			console.error(err);
			setStatus(`Error: ${err.message || err}`, true);
		}
	}

	function startPolling(config){
		if(pollTimer){
			clearInterval(pollTimer);
		}
		pollTimer = setInterval(() => refresh(config), Math.max(1000, config.interval * 1000));
	}

	// Wire up UI
	saveBtn.addEventListener('click', () => {
		const config = saveConfig();
		lastChecksum = '';
		refresh(config);
		startPolling(config);
	});

	refreshBtn.addEventListener('click', () => {
		const config = saveConfig();
		refresh(config);
	});

	// Initialize
	const initial = loadConfig();
	refresh(initial);
	startPolling(initial);
})();
