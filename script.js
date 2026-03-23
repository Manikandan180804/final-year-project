/* ============================================================
   MineGuard AI — Complete JavaScript
   Features: Gauge, Donut Chart, Live Monitor, Multi-line Chart,
   History, Zone Map, Image Comparison, Dark Mode, PDF Export,
   Sample CSV, Toast Notifications, Alert Sound, Skeleton Loaders
   ============================================================ */

document.addEventListener('DOMContentLoaded', () => {

    // ============ ELEMENT REFERENCES ============
    const sidebarNav      = document.getElementById('sidebarNav');
    const pages           = document.querySelectorAll('.page-content');
    const uploadForm      = document.getElementById('uploadForm');
    const alertsTableBody = document.getElementById('alertsTableBody');
    const historyTableBody = document.getElementById('historyTableBody');
    const aiChatToggle    = document.getElementById('aiChatToggle');
    const chatbotContainer= document.getElementById('chatbotContainer');
    const closeChatbotBtn = document.getElementById('closeChatbot');
    const chatInput       = document.getElementById('chatInput');
    const sendChatBtn     = document.getElementById('sendChat');
    const chatbotMessages = document.getElementById('chatbotMessages');
    const alertModal      = document.getElementById('alertModal');
    const modalClose      = document.getElementById('modalClose');
    const modalAcknowledge= document.getElementById('modalAcknowledge');
    const alertDetails    = document.getElementById('alert-details');
    const themeToggle     = document.getElementById('themeToggle');
    const exportReportBtn = document.getElementById('exportReportBtn');
    const exportResultsBtn= document.getElementById('exportResultsBtn');
    const generateCsvBtn  = document.getElementById('generateCsvBtn');
    const clearHistoryBtn = document.getElementById('clearHistoryBtn');
    const toggleLiveBtn   = document.getElementById('toggleLiveBtn');
    const livePulse       = document.getElementById('livePulse');
    const imageFile       = document.getElementById('imageFile');
    const imagePreview    = document.getElementById('imagePreview');
    const imagePreviewContainer = document.getElementById('imagePreviewContainer');
    const analyzeBtn      = document.getElementById('analyzeBtn');
    const analyzeLoader   = document.getElementById('analyzeLoader');

    // ============ STATE ============
    let lastAnalysisData  = null;
    let riskTrendChart    = null;
    let riskGaugeChart    = null;
    let contributionChart = null;
    let liveChart         = null;
    let alerts            = [];
    let analysisHistory   = JSON.parse(localStorage.getItem('mineguard_history') || '[]');
    let predictionCount   = 0;
    let liveInterval      = null;
    let liveRunning       = false;
    let liveBuffer        = { disp: [], pres: [], strain: [], labels: [] };
    const MAX_LIVE_POINTS = 30;
    const API_BASE        = 'http://localhost:5000';

    // ============ THEME TOGGLE ============
    const savedTheme = localStorage.getItem('mineguard_theme') || 'dark';
    document.documentElement.setAttribute('data-theme', savedTheme);

    themeToggle.addEventListener('click', () => {
        const current = document.documentElement.getAttribute('data-theme');
        const next = current === 'dark' ? 'light' : 'dark';
        document.documentElement.setAttribute('data-theme', next);
        localStorage.setItem('mineguard_theme', next);
        showToast(`Theme: ${next.charAt(0).toUpperCase() + next.slice(1)} mode`, 'info');
        // Rebuild charts with new colors
        if (lastAnalysisData) {
            buildTrendChart(lastAnalysisData.chart_data);
        }
        if (lastAnalysisData) {
            buildContributionChart(
                lastAnalysisData.numerical_model_risk_prob,
                lastAnalysisData.visual_model_risk_prob
            );
        }
    });

    // ============ NAVIGATION ============
    sidebarNav.addEventListener('click', (e) => {
        e.preventDefault();
        const targetId = e.target.closest('a')?.dataset?.target;
        if (!targetId) return;
        sidebarNav.querySelectorAll('li').forEach(li => li.classList.remove('active'));
        e.target.closest('li').classList.add('active');
        pages.forEach(page => page.classList.toggle('active', page.id === targetId));
    });

    // ============ TOAST NOTIFICATIONS ============
    function showToast(message, type = 'info', duration = 3500) {
        const container = document.getElementById('toastContainer');
        const icons = { success: 'fa-check-circle', error: 'fa-circle-xmark', info: 'fa-circle-info', warn: 'fa-triangle-exclamation' };
        const toast = document.createElement('div');
        toast.className = `toast toast-${type}`;
        toast.innerHTML = `<i class="fa-solid ${icons[type] || icons.info}"></i> ${message}`;
        container.appendChild(toast);
        setTimeout(() => toast.remove(), duration + 400);
    }

    // ============ ALERT SOUND ============
    function playAlertSound() {
        try {
            const ctx = new (window.AudioContext || window.webkitAudioContext)();
            [880, 660, 880].forEach((freq, i) => {
                const osc = ctx.createOscillator();
                const gain = ctx.createGain();
                osc.connect(gain); gain.connect(ctx.destination);
                osc.frequency.value = freq;
                osc.type = 'square';
                gain.gain.setValueAtTime(0.3, ctx.currentTime + i * 0.2);
                gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + i * 0.2 + 0.18);
                osc.start(ctx.currentTime + i * 0.2);
                osc.stop(ctx.currentTime + i * 0.2 + 0.18);
            });
        } catch (e) { /* Audio not available */ }
    }

    // ============ IMAGE PREVIEW ============
    imageFile.addEventListener('change', () => {
        const file = imageFile.files[0];
        if (file) {
            const reader = new FileReader();
            reader.onload = (e) => {
                imagePreview.src = e.target.result;
                imagePreviewContainer.style.display = 'block';
            };
            reader.readAsDataURL(file);
        }
    });

    // ============ GAUGE CHART ============
    function initGaugeChart() {
        const ctx = document.getElementById('riskGaugeChart').getContext('2d');
        riskGaugeChart = new Chart(ctx, {
            type: 'doughnut',
            data: {
                datasets: [{
                    data: [0, 100],
                    backgroundColor: ['#2ecc71', '#2a3250'],
                    borderWidth: 0,
                    circumference: 180,
                    rotation: -90,
                }]
            },
            options: {
                responsive: false,
                cutout: '75%',
                plugins: { legend: { display: false }, tooltip: { enabled: false } },
                animation: { duration: 900, easing: 'easeInOutQuart' }
            }
        });
    }

    function updateGauge(score) {
        const pct = Math.round(score * 100);
        const color = score > 0.7 ? '#e74c3c' : score > 0.4 ? '#f39c12' : '#2ecc71';
        const level = score > 0.7 ? 'HIGH RISK' : score > 0.4 ? 'MODERATE' : 'LOW RISK';
        const bg = document.documentElement.getAttribute('data-theme') === 'dark' ? '#1a2035' : '#e8edf5';

        riskGaugeChart.data.datasets[0].data = [pct, 100 - pct];
        riskGaugeChart.data.datasets[0].backgroundColor = [color, bg];
        riskGaugeChart.update();

        const gaugePercent = document.getElementById('gaugePercent');
        const gaugeLevel = document.getElementById('gaugeLevel');
        gaugePercent.textContent = pct + '%';
        gaugePercent.style.color = color;
        gaugeLevel.textContent = level;
        gaugeLevel.style.color = color;
    }

    // ============ DONUT / CONTRIBUTION CHART ============
    function initContributionChart() {
        const ctx = document.getElementById('contributionChart').getContext('2d');
        contributionChart = new Chart(ctx, {
            type: 'doughnut',
            data: {
                labels: ['Sensor Model', 'Vision Model'],
                datasets: [{
                    data: [60, 40],
                    backgroundColor: ['#4a90e2', '#e74c3c'],
                    borderWidth: 2,
                    borderColor: document.documentElement.getAttribute('data-theme') === 'dark' ? '#1a2035' : '#ffffff',
                }]
            },
            options: {
                responsive: true,
                cutout: '65%',
                plugins: {
                    legend: { display: false },
                    tooltip: {
                        callbacks: {
                            label: (ctx) => ` ${ctx.label}: ${ctx.parsed}%`
                        }
                    }
                },
                animation: { duration: 800 }
            }
        });
    }

    function buildContributionChart(numProb, visProb) {
        if (!contributionChart) initContributionChart();
        const numContrib = Math.round(numProb * 60 * 100);
        const visContrib = Math.round(visProb * 40 * 100);
        const total = numContrib + visContrib || 1;
        contributionChart.data.datasets[0].data = [
            Math.round(numContrib / total * 100),
            Math.round(visContrib / total * 100)
        ];
        contributionChart.update();
    }

    // ============ MULTI-LINE SENSOR TREND CHART ============
    function buildTrendChart(chartData) {
        const ctx = document.getElementById('riskTrendChart').getContext('2d');
        if (riskTrendChart) riskTrendChart.destroy();

        if (!chartData || !chartData.displacement_mm) return;

        const labels = chartData.displacement_mm.map((_, i) => `T-${chartData.displacement_mm.length - i}`);
        const gridColor = document.documentElement.getAttribute('data-theme') === 'dark'
            ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)';
        const textColor = document.documentElement.getAttribute('data-theme') === 'dark'
            ? '#8896b3' : '#6b7a99';

        riskTrendChart = new Chart(ctx, {
            type: 'line',
            data: {
                labels,
                datasets: [
                    {
                        label: 'Displacement (mm)',
                        data: chartData.displacement_mm,
                        borderColor: '#4a90e2',
                        backgroundColor: 'rgba(74,144,226,0.1)',
                        tension: 0.4, fill: true, pointRadius: 2, borderWidth: 2
                    },
                    {
                        label: 'Pore Pressure (kPa)',
                        data: chartData.pore_pressure_kpa,
                        borderColor: '#e74c3c',
                        backgroundColor: 'rgba(231,76,60,0.1)',
                        tension: 0.4, fill: false, pointRadius: 2, borderWidth: 2
                    },
                    {
                        label: 'Strain (με)',
                        data: chartData.strain_micro,
                        borderColor: '#f39c12',
                        backgroundColor: 'rgba(243,156,18,0.1)',
                        tension: 0.4, fill: false, pointRadius: 2, borderWidth: 2
                    }
                ]
            },
            options: {
                responsive: true,
                interaction: { mode: 'index', intersect: false },
                plugins: {
                    legend: { labels: { color: textColor, font: { family: 'Inter', size: 12 }, boxWidth: 14 } }
                },
                scales: {
                    x: { ticks: { color: textColor, font: { size: 10 } }, grid: { color: gridColor } },
                    y: { ticks: { color: textColor, font: { size: 10 } }, grid: { color: gridColor } }
                }
            }
        });
    }

    // ============ LIVE MONITOR ============
    function initLiveChart() {
        const ctx = document.getElementById('liveChart').getContext('2d');
        const gridColor = document.documentElement.getAttribute('data-theme') === 'dark'
            ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)';
        const textColor = document.documentElement.getAttribute('data-theme') === 'dark'
            ? '#8896b3' : '#6b7a99';

        liveChart = new Chart(ctx, {
            type: 'line',
            data: {
                labels: [],
                datasets: [
                    { label: 'Displacement (mm)', data: [], borderColor: '#4a90e2', backgroundColor: 'rgba(74,144,226,0.08)', tension: 0.4, fill: true, pointRadius: 2, borderWidth: 2 },
                    { label: 'Pore Pressure (kPa)', data: [], borderColor: '#e74c3c', backgroundColor: 'transparent', tension: 0.4, fill: false, pointRadius: 2, borderWidth: 2 },
                    { label: 'Strain (με)', data: [], borderColor: '#f39c12', backgroundColor: 'transparent', tension: 0.4, fill: false, pointRadius: 2, borderWidth: 2 }
                ]
            },
            options: {
                responsive: true,
                animation: { duration: 300 },
                interaction: { mode: 'index', intersect: false },
                plugins: { legend: { labels: { color: textColor, font: { family: 'Inter', size: 11 }, boxWidth: 12 } } },
                scales: {
                    x: { ticks: { color: textColor, font: { size: 10 }, maxTicksLimit: 10 }, grid: { color: gridColor } },
                    y: { ticks: { color: textColor, font: { size: 10 } }, grid: { color: gridColor } }
                }
            }
        });
    }

    async function fetchLiveSensor() {
        try {
            const res = await fetch(`${API_BASE}/live_sensor`);
            const d = await res.json();

            // Update KPI cards
            document.getElementById('live-displacement').textContent = d.displacement_mm + ' mm';
            document.getElementById('live-pressure').textContent = d.pore_pressure_kpa + ' kPa';
            document.getElementById('live-strain').textContent = d.strain_micro + ' με';
            const liveRiskEl = document.getElementById('live-risk');
            liveRiskEl.textContent = d.risk_level;
            liveRiskEl.className = 'kpi-value risk-' + d.risk_level.toLowerCase();

            // Update chart buffer
            if (liveBuffer.labels.length >= MAX_LIVE_POINTS) {
                liveBuffer.labels.shift();
                liveBuffer.disp.shift();
                liveBuffer.pres.shift();
                liveBuffer.strain.shift();
            }
            liveBuffer.labels.push(d.timestamp);
            liveBuffer.disp.push(d.displacement_mm);
            liveBuffer.pres.push(d.pore_pressure_kpa);
            liveBuffer.strain.push(d.strain_micro);

            liveChart.data.labels = [...liveBuffer.labels];
            liveChart.data.datasets[0].data = [...liveBuffer.disp];
            liveChart.data.datasets[1].data = [...liveBuffer.pres];
            liveChart.data.datasets[2].data = [...liveBuffer.strain];
            liveChart.update('none');

        } catch (e) {
            console.warn('Live sensor fetch failed:', e);
        }
    }

    toggleLiveBtn.addEventListener('click', () => {
        liveRunning = !liveRunning;
        if (liveRunning) {
            if (!liveChart) initLiveChart();
            liveInterval = setInterval(fetchLiveSensor, 2000);
            fetchLiveSensor();
            toggleLiveBtn.innerHTML = '<i class="fa-solid fa-stop"></i> Stop Monitoring';
            toggleLiveBtn.className = 'btn-danger';
            livePulse.className = 'live-pulse active';
            livePulse.innerHTML = '<i class="fa-solid fa-circle"></i> LIVE';
            showToast('Live monitoring started', 'success');
        } else {
            clearInterval(liveInterval);
            toggleLiveBtn.innerHTML = '<i class="fa-solid fa-play"></i> Start Monitoring';
            toggleLiveBtn.className = 'btn-primary';
            livePulse.className = 'live-pulse';
            livePulse.innerHTML = '<i class="fa-solid fa-circle"></i> STANDBY';
            showToast('Live monitoring stopped', 'warn');
        }
    });

    // ============ UPLOAD & ANALYSIS ============
    uploadForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const formData = new FormData(uploadForm);
        const loc = document.getElementById('locationSelect')?.value || 'Tiruchirappalli';
        formData.append('location', loc);

        // Show loader
        analyzeBtn.disabled = true;
        analyzeLoader.style.display = 'flex';
        document.getElementById('dash-risk-level').textContent = 'Analyzing...';
        showToast('Running AI analysis...', 'info', 6000);

        try {
            const res = await fetch(`${API_BASE}/predict_upload`, { method: 'POST', body: formData });
            const data = await res.json();

            analyzeBtn.disabled = false;
            analyzeLoader.style.display = 'none';

            if (data.error) {
                showToast('Error: ' + data.error, 'error');
                document.getElementById('dash-risk-level').textContent = 'Error';
                return;
            }

            lastAnalysisData = data;
            updateAllUI(data);
            showToast('Analysis complete!', 'success');

            // Enable export buttons
            exportReportBtn.disabled = false;
            if (exportResultsBtn) exportResultsBtn.disabled = false;

        } catch (err) {
            analyzeBtn.disabled = false;
            analyzeLoader.style.display = 'none';
            showToast('Connection error. Is Flask running?', 'error');
            console.error(err);
        }
    });

    // ============ UPDATE ALL UI ============
    function updateAllUI(data) {
        updateDashboard(data);
        updatePredictions(data);
        updateResults(data);
        updateZoneMap(data);
        updateAlerts(data);
        addToHistory(data);
    }

    // ============ DASHBOARD ============
    function updateDashboard(data) {
        const score = data.final_risk_score;
        const level = score > 0.7 ? 'HIGH' : score > 0.4 ? 'MODERATE' : 'LOW';
        const cls   = score > 0.7 ? 'risk-high' : score > 0.4 ? 'risk-moderate' : 'risk-low';

        const riskEl = document.getElementById('dash-risk-level');
        riskEl.textContent = level;
        riskEl.className = 'kpi-value ' + cls;

        document.getElementById('dash-confidence').textContent = data.modelConfidence;

        if (data.weather) {
            document.getElementById('dash-weather-condition').textContent = data.weather.condition;
            document.getElementById('dash-weather-details').textContent =
                `${data.weather.temperature}°C | ${data.weather.rainfall_mm}mm rain | ${data.weather.humidity}% humidity`;
        }

        // Activity feed
        const actList = document.getElementById('recent-activity-list');
        const li = document.createElement('li');
        li.className = 'activity-item';
        const iconClass = score > 0.7 ? 'danger' : score > 0.4 ? 'warn' : 'ok';
        const icon      = score > 0.7 ? 'fa-circle-exclamation' : score > 0.4 ? 'fa-circle-dot' : 'fa-circle-check';
        li.innerHTML = `<i class="fa-solid ${icon} act-icon ${iconClass}"></i><span>Analysis complete — Risk: ${level} (${(score * 100).toFixed(1)}%) | ${data.crack_count} crack(s) | ${new Date().toLocaleTimeString()}</span>`;
        actList.prepend(li);

        // Gauge
        updateGauge(score);

        // Donut
        buildContributionChart(data.numerical_model_risk_prob, data.visual_model_risk_prob);
    }

    // ============ PREDICTIONS PAGE ============
    function updatePredictions(data) {
        document.getElementById('model-confidence').textContent = data.modelConfidence;
        document.getElementById('info-cracks').textContent = data.crack_count ?? '--';
        document.getElementById('info-num-risk').textContent = (data.numerical_model_risk_prob * 100).toFixed(1) + '%';
        document.getElementById('info-vis-risk').textContent = (data.visual_model_risk_prob * 100).toFixed(1) + '%';
        document.getElementById('info-rainfall').textContent = data.weather
            ? `${data.weather.rainfall_mm}mm (${data.weather.condition})`
            : 'N/A';
        predictionCount++;
        document.getElementById('model-predictions').textContent = predictionCount;

        // Multi-line trend chart
        buildTrendChart(data.chart_data);

        // Before/After image comparison
        const wrapper = document.getElementById('imgWrapper');
        const placeholder = document.getElementById('visual-analysis-placeholder');
        if (placeholder) placeholder.remove();

        wrapper.innerHTML = '';

        if (data.original_image || data.annotated_image) {
            if (data.original_image) {
                const div = document.createElement('div');
                div.className = 'side-img-container';
                div.innerHTML = `<img src="${API_BASE}/uploads/${data.original_image}?t=${Date.now()}" alt="Original">
                                 <div class="side-img-label">📷 Original</div>`;
                wrapper.appendChild(div);
            }
            if (data.annotated_image) {
                const div = document.createElement('div');
                div.className = 'side-img-container';
                div.innerHTML = `<img src="${API_BASE}/uploads/${data.annotated_image}?t=${Date.now()}" alt="YOLO Annotated">
                                 <div class="side-img-label">🔍 YOLO Detected (${data.crack_count} crack${data.crack_count !== 1 ? 's' : ''})</div>`;
                wrapper.appendChild(div);
            }
        } else {
            wrapper.innerHTML = '<p id="visual-analysis-placeholder" style="color:var(--text-light);padding:40px;text-align:center">No cracks detected in this image.</p>';
        }
    }

    // ============ RESULTS PAGE ============
    function updateResults(data) {
        const score = data.final_risk_score;
        const level = score > 0.7 ? 'Critical' : score > 0.4 ? 'Moderate' : 'Low';
        const cls   = score > 0.7 ? 'risk-high' : score > 0.4 ? 'risk-moderate' : 'risk-low';

        const riskEl = document.getElementById('results-risk-level');
        riskEl.textContent = level;
        riskEl.className = 'kpi-value ' + cls;

        document.getElementById('results-confidence').textContent = data.modelConfidence;
        document.getElementById('results-date').textContent = data.analysisDate;
        document.getElementById('results-cracks').textContent = data.crack_count ?? 0;
        document.getElementById('xai-text').textContent = data.xai_explanation;

        // Mitigation actions
        const actionsList = document.getElementById('mitigation-actions-list');
        actionsList.innerHTML = '';
        data.mitigationActions.forEach(action => {
            const li = document.createElement('li');
            li.textContent = action;
            actionsList.appendChild(li);
        });

        // Zone analysis
        const zoneList = document.getElementById('zone-analysis-list');
        zoneList.innerHTML = '';
        data.zoneAnalysis.forEach(zone => {
            const isCrit = zone.level.includes('Critical');
            const isMod  = zone.level.includes('Moderate');
            const badgeCls = isCrit ? 'badge-red' : isMod ? 'badge-yellow' : 'badge-green';
            const label    = isCrit ? 'HIGH' : isMod ? 'MOD' : 'LOW';
            const li = document.createElement('li');
            li.className = 'zone-list-item';
            li.innerHTML = `
                <div class="zone-name"><i class="fa-solid fa-circle-dot"></i> ${zone.name}</div>
                <div class="zone-badge ${badgeCls}">${label}</div>
                <div class="zone-conf">Confidence: ${zone.confidence}</div>`;
            zoneList.appendChild(li);
        });

        // Also update map mitigation
        const mapMit = document.getElementById('map-mitigation-list');
        if (mapMit) {
            mapMit.innerHTML = '';
            data.mitigationActions.slice(0, 5).forEach(action => {
                const li = document.createElement('li');
                li.textContent = action;
                mapMit.appendChild(li);
            });
        }
    }

    // ============ ZONE MAP ============
    const zoneIds = {
        'North Slope': { path: 'zone-north', label: 'map-label-north', badge: 'zb-north', conf: 'zc-north' },
        'East Wall':   { path: 'zone-east',  label: 'map-label-east',  badge: 'zb-east',  conf: 'zc-east'  },
        'South Slope': { path: 'zone-south', label: 'map-label-south', badge: 'zb-south', conf: 'zc-south' },
        'Central Pit': { path: 'zone-west',  label: 'map-label-west',  badge: 'zb-west',  conf: 'zc-west'  },
    };

    function updateZoneMap(data) {
        data.zoneAnalysis.forEach(zone => {
            const ids = zoneIds[zone.name];
            if (!ids) return;
            const isCrit = zone.level.includes('Critical');
            const isMod  = zone.level.includes('Moderate');
            const color  = isCrit ? '#e74c3c' : isMod ? '#f39c12' : '#2ecc71';
            const label  = isCrit ? 'HIGH RISK' : isMod ? 'MODERATE RISK' : 'LOW RISK';
            const badgeCls = isCrit ? 'badge-red' : isMod ? 'badge-yellow' : 'badge-green';

            const path = document.getElementById(ids.path);
            if (path) path.setAttribute('fill', color);

            const mapLbl = document.getElementById(ids.label);
            if (mapLbl) mapLbl.textContent = label;

            const badge = document.getElementById(ids.badge);
            if (badge) {
                badge.textContent = label.split(' ')[0];
                badge.className = 'zone-badge ' + badgeCls;
            }

            const conf = document.getElementById(ids.conf);
            if (conf) conf.textContent = 'Confidence: ' + zone.confidence;
        });
    }

    // ============ ALERTS ============
    function updateAlerts(data) {
        const score = data.final_risk_score;
        if (score > 0.7) {
            playAlertSound();
            showCriticalModal(data);

            const alertEntry = {
                id: Date.now(),
                time: new Date().toLocaleTimeString(),
                score,
                severity: 'High',
                details: data.xai_explanation,
                status: 'Unacknowledged'
            };
            alerts.unshift(alertEntry);
        } else if (score > 0.4) {
            const alertEntry = {
                id: Date.now(),
                time: new Date().toLocaleTimeString(),
                score,
                severity: 'Moderate',
                details: data.xai_explanation,
                status: 'Unacknowledged'
            };
            alerts.unshift(alertEntry);
        }
        renderAlerts();
    }

    function renderAlerts() {
        const unread = alerts.filter(a => a.status === 'Unacknowledged').length;
        document.getElementById('dash-active-alerts').textContent = unread;

        const badge = document.getElementById('alertBadge');
        badge.textContent = unread;
        badge.style.display = unread > 0 ? 'inline' : 'none';

        alertsTableBody.innerHTML = '';
        if (alerts.length === 0) {
            alertsTableBody.innerHTML = '<tr><td colspan="6" style="text-align:center;color:var(--text-light);padding:30px">No alerts yet.</td></tr>';
            return;
        }
        alerts.forEach(alert => {
            const sevCls = alert.severity === 'High' ? 'severity-high' : 'severity-moderate';
            const isSolved = alert.status === 'Solved';
            const tr = document.createElement('tr');
            if (isSolved) tr.className = 'solved';
            tr.innerHTML = `
                <td>${alert.time}</td>
                <td>${(alert.score * 100).toFixed(1)}%</td>
                <td class="${sevCls}">${alert.severity}</td>
                <td>${alert.details.substring(0, 80)}...</td>
                <td>${alert.status}</td>
                <td><button class="solve-btn" data-id="${alert.id}" ${isSolved ? 'disabled' : ''}>${isSolved ? '✓ Solved' : 'Mark Solved'}</button></td>`;
            alertsTableBody.appendChild(tr);
        });
    }

    alertsTableBody.addEventListener('click', (e) => {
        if (e.target.classList.contains('solve-btn')) {
            const id = parseInt(e.target.dataset.id);
            const a = alerts.find(x => x.id === id);
            if (a) { a.status = 'Solved'; renderAlerts(); showToast('Alert marked as solved', 'success'); }
        }
    });

    // ============ CRITICAL MODAL ============
    function showCriticalModal(data) {
        alertDetails.textContent = data.xai_explanation;
        alertModal.classList.add('active');
    }

    modalClose.addEventListener('click', () => alertModal.classList.remove('active'));
    modalAcknowledge.addEventListener('click', () => {
        alertModal.classList.remove('active');
        showToast('Alert acknowledged', 'warn');
    });

    // ============ HISTORY ============
    function addToHistory(data) {
        const entry = {
            id: Date.now(),
            date: data.analysisDate,
            score: data.final_risk_score,
            level: data.final_risk_score > 0.7 ? 'High' : data.final_risk_score > 0.4 ? 'Moderate' : 'Low',
            confidence: data.modelConfidence,
            weather: data.weather ? data.weather.condition : 'N/A',
            numRisk: (data.numerical_model_risk_prob * 100).toFixed(1) + '%',
            visRisk: (data.visual_model_risk_prob * 100).toFixed(1) + '%',
            cracks: data.crack_count ?? 0
        };
        analysisHistory.unshift(entry);
        if (analysisHistory.length > 50) analysisHistory = analysisHistory.slice(0, 50);
        localStorage.setItem('mineguard_history', JSON.stringify(analysisHistory));
        renderHistory();
    }

    function renderHistory() {
        if (analysisHistory.length === 0) {
            historyTableBody.innerHTML = '<tr><td colspan="9" style="text-align:center;color:var(--text-light);padding:30px">No history yet.</td></tr>';
            return;
        }
        historyTableBody.innerHTML = '';
        analysisHistory.forEach((h, i) => {
            const sevCls = h.level === 'High' ? 'severity-high' : h.level === 'Moderate' ? 'severity-moderate' : 'severity-low';
            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td>${analysisHistory.length - i}</td>
                <td>${h.date}</td>
                <td>${(h.score * 100).toFixed(1)}%</td>
                <td class="${sevCls}">${h.level}</td>
                <td>${h.confidence}</td>
                <td>${h.weather}</td>
                <td>${h.numRisk}</td>
                <td>${h.visRisk}</td>
                <td>${h.cracks}</td>`;
            historyTableBody.appendChild(tr);
        });
    }

    clearHistoryBtn.addEventListener('click', () => {
        if (confirm('Clear all analysis history?')) {
            analysisHistory = [];
            localStorage.removeItem('mineguard_history');
            renderHistory();
            showToast('History cleared', 'warn');
        }
    });

    // ============ PDF EXPORT ============
    async function exportPDF() {
        if (!lastAnalysisData) { showToast('Run an analysis first!', 'warn'); return; }
        showToast('Generating PDF report...', 'info', 5000);

        const { jsPDF } = window.jspdf;
        const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
        const data = lastAnalysisData;
        const score = data.final_risk_score;
        const level = score > 0.7 ? 'HIGH RISK' : score > 0.4 ? 'MODERATE RISK' : 'LOW RISK';
        const color = score > 0.7 ? [231, 76, 60] : score > 0.4 ? [243, 156, 18] : [46, 204, 113];

        // Header bar
        doc.setFillColor(26, 32, 53);
        doc.rect(0, 0, 210, 30, 'F');
        doc.setTextColor(255, 255, 255);
        doc.setFontSize(18); doc.setFont('helvetica', 'bold');
        doc.text('MineGuard AI — Risk Analysis Report', 14, 13);
        doc.setFontSize(9); doc.setFont('helvetica', 'normal');
        doc.text(`Generated: ${data.analysisDate}  |  Location: ${data.weather?.location || 'Tiruchirappalli'}`, 14, 22);

        // Risk level banner
        doc.setFillColor(...color);
        doc.rect(0, 32, 210, 16, 'F');
        doc.setTextColor(255, 255, 255);
        doc.setFontSize(14); doc.setFont('helvetica', 'bold');
        doc.text(`${level}  —  Risk Score: ${(score * 100).toFixed(1)}%`, 14, 43);

        // Summary section
        doc.setTextColor(30, 42, 58);
        doc.setFontSize(12); doc.setFont('helvetica', 'bold');
        doc.text('Analysis Summary', 14, 60);
        doc.setFontSize(9); doc.setFont('helvetica', 'normal');
        doc.setTextColor(100, 110, 130);
        const summaryLines = [
            `Numerical Model Risk:  ${(data.numerical_model_risk_prob * 100).toFixed(1)}%`,
            `Visual Model Risk:     ${(data.visual_model_risk_prob * 100).toFixed(1)}%`,
            `Model Confidence:      ${data.modelConfidence}`,
            `Cracks Detected:       ${data.crack_count ?? 0}`,
            `Weather:               ${data.weather ? `${data.weather.condition}, ${data.weather.temperature}°C, ${data.weather.rainfall_mm}mm rain` : 'N/A'}`,
        ];
        summaryLines.forEach((line, i) => doc.text(line, 14, 68 + i * 7));

        // XAI Explanation
        doc.setFontSize(12); doc.setFont('helvetica', 'bold'); doc.setTextColor(30, 42, 58);
        doc.text('AI Explanation (XAI)', 14, 110);
        doc.setFontSize(9); doc.setFont('helvetica', 'normal'); doc.setTextColor(100, 110, 130);
        const xaiLines = doc.splitTextToSize(data.xai_explanation, 180);
        doc.text(xaiLines, 14, 118);

        // Zone Analysis
        let y = 118 + xaiLines.length * 5 + 8;
        doc.setFontSize(12); doc.setFont('helvetica', 'bold'); doc.setTextColor(30, 42, 58);
        doc.text('Zone Risk Analysis', 14, y); y += 8;

        data.zoneAnalysis.forEach(zone => {
            const isCrit = zone.level.includes('Critical');
            const isMod = zone.level.includes('Moderate');
            const zColor = isCrit ? [231,76,60] : isMod ? [243,156,18] : [46,204,113];
            doc.setFillColor(...zColor);
            doc.circle(17, y - 1.5, 2, 'F');
            doc.setFontSize(9); doc.setFont('helvetica', 'normal'); doc.setTextColor(30, 42, 58);
            doc.text(`${zone.name}  —  ${zone.level}  (Confidence: ${zone.confidence})`, 22, y);
            y += 7;
        });

        // Mitigation Actions
        y += 4;
        doc.setFontSize(12); doc.setFont('helvetica', 'bold'); doc.setTextColor(30, 42, 58);
        doc.text('Mitigation Actions', 14, y); y += 8;
        data.mitigationActions.forEach(action => {
            doc.setFontSize(9); doc.setFont('helvetica', 'normal'); doc.setTextColor(100, 110, 130);
            const wrappedAction = doc.splitTextToSize(`• ${action}`, 180);
            doc.text(wrappedAction, 14, y);
            y += wrappedAction.length * 5 + 2;
            if (y > 270) { doc.addPage(); y = 20; }
        });

        // Footer
        doc.setFillColor(26, 32, 53);
        doc.rect(0, 282, 210, 15, 'F');
        doc.setTextColor(150, 160, 180);
        doc.setFontSize(8);
        doc.text('MineGuard AI — Confidential Mine Safety Report | Generated by AI Safety System', 14, 291);

        doc.save(`MineGuard_Report_${new Date().toISOString().slice(0,10)}.pdf`);
        showToast('PDF report downloaded!', 'success');
    }

    exportReportBtn.addEventListener('click', exportPDF);
    if (exportResultsBtn) exportResultsBtn.addEventListener('click', exportPDF);

    // ============ SAMPLE CSV GENERATOR ============
    generateCsvBtn.addEventListener('click', () => {
        const headers = ['timestamp', 'displacement_mm', 'pore_pressure_kpa', 'strain_micro', 'risk_label'];
        const rows = [headers.join(',')];
        const now = new Date();

        for (let i = 49; i >= 0; i--) {
            const t = new Date(now.getTime() - i * 5 * 60000).toISOString();
            const disp  = (Math.random() * 18 + 2).toFixed(2);
            const pore  = (Math.random() * 80 + 20).toFixed(2);
            const strain = (Math.random() * 600 + 100).toFixed(2);
            const risk  = parseFloat(disp) > 14 || parseFloat(pore) > 75 ? 1 : 0;
            rows.push(`${t},${disp},${pore},${strain},${risk}`);
        }

        const blob = new Blob([rows.join('\n')], { type: 'text/csv' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url; a.download = 'mineguard_sample_sensor_data.csv';
        a.click(); URL.revokeObjectURL(url);
        showToast('Sample CSV downloaded! 50 readings generated.', 'success');
    });

    // ============ CHATBOT ============
    aiChatToggle.addEventListener('click', () => chatbotContainer.classList.add('active'));
    closeChatbotBtn.addEventListener('click', () => chatbotContainer.classList.remove('active'));

    function addMessage(text, sender) {
        const div = document.createElement('div');
        div.className = `message ${sender}-message`;
        div.textContent = text;
        chatbotMessages.appendChild(div);
        chatbotMessages.scrollTop = chatbotMessages.scrollHeight;
    }

    async function sendMessage() {
        const msg = chatInput.value.trim();
        if (!msg) return;
        addMessage(msg, 'user');
        chatInput.value = '';

        if (!lastAnalysisData) {
            addMessage('Please run an analysis first so I have data to report on!', 'bot');
            return;
        }

        const thinking = document.createElement('div');
        thinking.className = 'message bot-message';
        thinking.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Thinking...';
        chatbotMessages.appendChild(thinking);
        chatbotMessages.scrollTop = chatbotMessages.scrollHeight;

        try {
            const res = await fetch(`${API_BASE}/chat`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ message: msg, context: lastAnalysisData })
            });
            const data = await res.json();
            thinking.remove();
            addMessage(data.reply, 'bot');
        } catch (e) {
            thinking.remove();
            addMessage("Sorry, I can't connect to the AI engine right now.", 'bot');
        }
    }

    sendChatBtn.addEventListener('click', sendMessage);
    chatInput.addEventListener('keypress', (e) => { if (e.key === 'Enter') sendMessage(); });

    // ============ WORKERS MANAGEMENT ============
    const AVATAR_COLORS = ['#4a90e2','#e74c3c','#f39c12','#2ecc71','#9b59b6','#1abc9c','#e67e22','#3498db'];
    let allWorkers = [];
    let alertLog = [];

    async function loadWorkers() {
        try {
            const res = await fetch(`${API_BASE}/workers`);
            allWorkers = await res.json();
            renderWorkers(allWorkers);
            updateWorkerBadge();
            const broadcastBtn = document.getElementById('broadcastAlertBtn');
            if (broadcastBtn) broadcastBtn.disabled = allWorkers.length === 0;
        } catch(e) {
            console.warn('Could not load workers:', e);
        }
    }

    function updateWorkerBadge() {
        const badge = document.getElementById('workerCountBadge');
        const count = document.getElementById('workerListCount');
        if (badge) badge.textContent = allWorkers.length;
        if (count) count.textContent = allWorkers.length;
    }

    function getAvatarColor(name) {
        let hash = 0;
        for (let i = 0; i < name.length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash);
        return AVATAR_COLORS[Math.abs(hash) % AVATAR_COLORS.length];
    }

    function renderWorkers(workers) {
        const grid   = document.getElementById('workerGrid');
        const empty  = document.getElementById('workerEmpty');
        if (!grid) return;

        // Remove existing cards (not the empty placeholder)
        grid.querySelectorAll('.worker-card').forEach(c => c.remove());

        if (workers.length === 0) {
            if (empty) empty.style.display = 'flex';
            return;
        }
        if (empty) empty.style.display = 'none';

        workers.forEach(worker => {
            const initials = worker.name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0,2);
            const avatarColor = getAvatarColor(worker.name);
            const card = document.createElement('div');
            card.className = 'worker-card';
            card.dataset.id = worker.id;
            card.innerHTML = `
                <div class="worker-actions">
                    <button class="worker-alert-btn" title="Alert this worker" data-id="${worker.id}">
                        <i class="fa-solid fa-bell"></i>
                    </button>
                    <button class="worker-del-btn" title="Remove worker" data-id="${worker.id}">
                        <i class="fa-solid fa-trash"></i>
                    </button>
                </div>
                <div class="worker-avatar" style="background:${avatarColor}">${initials}</div>
                <div class="worker-name">${worker.name}</div>
                <div class="worker-role">${worker.role} &bull; Added ${worker.added}</div>
                <div class="worker-meta">
                    ${worker.email ? `<div class="worker-meta-item"><i class="fa-solid fa-envelope"></i>${worker.email}</div>` : '<div class="worker-meta-item" style="opacity:0.5"><i class="fa-solid fa-envelope"></i>No email</div>'}
                    ${worker.phone ? `<div class="worker-meta-item"><i class="fa-solid fa-phone"></i>${worker.phone}</div>` : '<div class="worker-meta-item" style="opacity:0.5"><i class="fa-solid fa-phone"></i>No phone</div>'}
                </div>
                <span class="worker-zone-badge"><i class="fa-solid fa-map-pin"></i> ${worker.zone}</span>`;
            grid.appendChild(card);
        });
    }

    // Add Worker
    const addWorkerForm = document.getElementById('addWorkerForm');
    if (addWorkerForm) {
        addWorkerForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const payload = {
                name:  document.getElementById('workerName').value.trim(),
                email: document.getElementById('workerEmail').value.trim(),
                phone: document.getElementById('workerPhone').value.trim(),
                zone:  document.getElementById('workerZone').value,
                role:  document.getElementById('workerRole').value
            };
            try {
                const res = await fetch(`${API_BASE}/workers`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(payload)
                });
                const data = await res.json();
                if (data.success) {
                    addWorkerForm.reset();
                    await loadWorkers();
                    showToast(`✅ ${payload.name} registered successfully!`, 'success');
                } else {
                    showToast('Error: ' + (data.error || 'Unknown error'), 'error');
                }
            } catch(err) {
                showToast('Connection error adding worker', 'error');
            }
        });
    }

    // Delete / Alert single worker (event delegation)
    const workerGrid = document.getElementById('workerGrid');
    if (workerGrid) {
        workerGrid.addEventListener('click', async (e) => {
            const delBtn   = e.target.closest('.worker-del-btn');
            const alertBtn = e.target.closest('.worker-alert-btn');

            if (delBtn) {
                const id   = parseInt(delBtn.dataset.id);
                const worker = allWorkers.find(w => w.id === id);
                if (!confirm(`Remove ${worker?.name || 'this worker'}?`)) return;
                await fetch(`${API_BASE}/workers/${id}`, { method: 'DELETE' });
                await loadWorkers();
                showToast('Worker removed', 'warn');
            }

            if (alertBtn) {
                const id = parseInt(alertBtn.dataset.id);
                const worker = allWorkers.find(w => w.id === id);
                if (!lastAnalysisData) {
                    showToast('Run an analysis first to have data to alert about!', 'warn');
                    return;
                }
                await broadcastAlert([id], 'Manual');
                showToast(`📣 Alert sent to ${worker?.name}`, 'success');
            }
        });
    }

    // Worker search
    const workerSearch = document.getElementById('workerSearch');
    if (workerSearch) {
        workerSearch.addEventListener('input', () => {
            const q = workerSearch.value.toLowerCase();
            const filtered = allWorkers.filter(w =>
                w.name.toLowerCase().includes(q) ||
                w.zone.toLowerCase().includes(q) ||
                w.role.toLowerCase().includes(q)
            );
            renderWorkers(filtered);
        });
    }

    // Broadcast to all
    const broadcastAlertBtn = document.getElementById('broadcastAlertBtn');
    if (broadcastAlertBtn) {
        broadcastAlertBtn.addEventListener('click', async () => {
            if (!lastAnalysisData) {
                showToast('Run an analysis first!', 'warn');
                return;
            }
            if (allWorkers.length === 0) {
                showToast('No workers registered!', 'warn');
                return;
            }
            const confirmed = confirm(`Send MANUAL alert to ALL ${allWorkers.length} registered workers?`);
            if (!confirmed) return;
            await broadcastAlert(null, 'Manual Broadcast');
        });
    }

    // Core broadcast function
    async function broadcastAlert(workerIds = null, trigger = 'Auto') {
        if (!lastAnalysisData) return;
        const score  = lastAnalysisData.final_risk_score;
        const level  = score > 0.7 ? 'High' : score > 0.4 ? 'Moderate' : 'Low';
        const payload = {
            risk_score:   score,
            risk_level:   level,
            explanation:  lastAnalysisData.xai_explanation,
            worker_ids:   workerIds,
            manual:       trigger !== 'Auto'
        };

        try {
            const res = await fetch(`${API_BASE}/broadcast_alert`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });
            const data = await res.json();
            if (data.success) {
                addAlertLogEntry(trigger, level, score, data.sent, data.results);
                showBanner(`📣 Alerts dispatched to ${data.sent} worker(s) via Email/SMS`, true);
                showToast(`Alert broadcast to ${data.sent} worker(s)!`, 'success');
            } else {
                showToast('Broadcast error: ' + (data.error || 'Unknown'), 'error');
            }
        } catch(err) {
            showToast('Failed to broadcast alert. Is Flask running?', 'error');
        }
    }

    function showBanner(msg, success = true) {
        const banner = document.getElementById('alertStatusBanner');
        const text   = document.getElementById('alertStatusText');
        if (!banner || !text) return;
        banner.style.background = success
            ? 'linear-gradient(135deg,#27ae60,#2ecc71)'
            : 'linear-gradient(135deg,#c0392b,#e74c3c)';
        banner.querySelector('i').className = success ? 'fa-solid fa-circle-check' : 'fa-solid fa-circle-xmark';
        text.textContent = msg;
        banner.style.display = 'flex';
        setTimeout(() => { banner.style.display = 'none'; }, 6000);
    }

    function addAlertLogEntry(trigger, level, score, sent, results) {
        const tbody = document.getElementById('alertLogBody');
        if (!tbody) return;

        // Clear placeholder row
        if (tbody.querySelector('td[colspan]')) tbody.innerHTML = '';

        const emailOk = results.filter(r => r.email_status === 'sent').length;
        const smsOk   = results.filter(r => r.sms_status === 'sent').length;
        const levCls  = level === 'High' ? 'severity-high' : level === 'Moderate' ? 'severity-moderate' : 'severity-low';

        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td>${new Date().toLocaleTimeString()}</td>
            <td>${trigger}</td>
            <td class="${levCls}">${level}</td>
            <td>${(score * 100).toFixed(1)}%</td>
            <td><strong>${sent}</strong></td>
            <td>${emailOk > 0 ? `<span class="badge badge-green">✓ ${emailOk} sent</span>` : '<span style="color:var(--text-light)">--</span>'}</td>
            <td>${smsOk > 0 ? `<span class="badge badge-green">✓ ${smsOk} sent</span>` : '<span style="color:var(--text-light)">Twilio needed</span>'}</td>`;
        tbody.prepend(tr);
    }

    // Hook auto-alert into updateAlerts — after high risk analysis, auto-broadcast
    const _origUpdateAlerts = updateAlerts.bind(this);  // Keep reference above

    // Override updateAlerts to also broadcast
    function updateAlerts(data) {
        const score = data.final_risk_score;
        if (score > 0.7) {
            playAlertSound();
            showCriticalModal(data);
            const alertEntry = { id: Date.now(), time: new Date().toLocaleTimeString(), score, severity: 'High', details: data.xai_explanation, status: 'Unacknowledged' };
            alerts.unshift(alertEntry);
            // Auto-broadcast to all workers
            if (allWorkers.length > 0) {
                broadcastAlert(null, 'Auto (High Risk)');
                showToast(`🚨 AUTO-ALERT sent to ${allWorkers.length} worker(s)!`, 'error', 6000);
            }
        } else if (score > 0.4) {
            const alertEntry = { id: Date.now(), time: new Date().toLocaleTimeString(), score, severity: 'Moderate', details: data.xai_explanation, status: 'Unacknowledged' };
            alerts.unshift(alertEntry);
        }
        renderAlerts();
    }

    // ============ INITIALISE ============
    initGaugeChart();
    initContributionChart();
    renderHistory();
    renderAlerts();
    loadWorkers();  // Load workers on startup

    setTimeout(() => showToast('MineGuard AI ready — upload data to begin analysis', 'info'), 800);

    console.log('✅ MineGuard AI fully loaded with Worker Alert System.');
});