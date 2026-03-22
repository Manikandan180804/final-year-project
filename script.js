document.addEventListener('DOMContentLoaded', () => {
    // --- Element References ---
    const sidebarNav = document.getElementById('sidebarNav');
    const pages = document.querySelectorAll('.page-content');
    const uploadForm = document.getElementById('uploadForm');
    const alertsTableBody = document.querySelector('#alertsTable tbody');
    const aiChatToggle = document.getElementById('aiChatToggle');
    const chatbotContainer = document.getElementById('chatbotContainer');
    const closeChatbotBtn = document.getElementById('closeChatbot');
    const chatInput = document.getElementById('chatInput');
    const sendChatBtn = document.getElementById('sendChat');
    const chatbotMessages = document.getElementById('chatbotMessages');
    const alertModal = document.getElementById('alertModal');
    const modalClose = document.getElementById('modalClose');
    const alertDetails = document.getElementById('alert-details');
    const annotatedImageElement = document.getElementById('annotated-crack-image');
    const visualPlaceholder = document.getElementById('visual-analysis-placeholder');
    
    // --- State Variables ---
    let lastAnalysisData = null;
    let riskTrendChart = null;
    let alerts = [];
    let predictionCount = 0;

    // --- Page Navigation Logic ---
    sidebarNav.addEventListener('click', (event) => {
        event.preventDefault();
        const targetId = event.target.dataset.target;
        if (!targetId) return;
        sidebarNav.querySelectorAll('li').forEach(li => li.classList.remove('active'));
        event.target.closest('li').classList.add('active');
        pages.forEach(page => page.classList.toggle('active', page.id === targetId));
    });

    // --- File Upload Logic ---
    uploadForm.addEventListener('submit', (event) => {
        event.preventDefault();
        const formData = new FormData(uploadForm);
        document.getElementById('dash-risk-level').textContent = 'Analyzing...';
        fetch('http://localhost:5000/predict_upload', {
            method: 'POST',
            body: formData,
        })
        .then(response => response.json())
        .then(data => {
            if (data.error) {
                console.error("Backend Error:", data.error);
                alert(`An error occurred: ${data.error}`);
                return;
            }
            lastAnalysisData = data;
            updateAllUI(data);
        })
        .catch(error => console.error('Upload Error:', error));
    });

    // --- UI Update Functions ---
    const updateAllUI = (data) => {
        updateDashboardPage(data);
        updatePredictionsPage(data);
        updateResultsPage(data);
        updateAlerts(data);
    };

    const updateDashboardPage = (data) => {
        const riskLevel = data.final_risk_score > 0.7 ? 'High' : (data.final_risk_score > 0.4 ? 'Moderate' : 'Low');
        document.getElementById('dash-risk-level').textContent = riskLevel;
        const activityList = document.getElementById('recent-activity-list');
        const newActivity = document.createElement('li');
        newActivity.textContent = `New prediction completed. Risk: ${data.final_risk_score.toFixed(2)}`;
        activityList.prepend(newActivity);
        if (data.weather) {
            document.getElementById('dash-weather-condition').textContent = data.weather.condition;
            document.getElementById('dash-weather-details').textContent = `${data.weather.temperature.toFixed(1)}°C | ${data.weather.rainfall_mm}mm rain (1h)`;
        }
    };

    const updatePredictionsPage = (data) => {
        document.getElementById('model-confidence').textContent = data.modelConfidence;
        predictionCount++;
        document.getElementById('model-predictions').textContent = predictionCount;
        const chartCanvas = document.getElementById('riskTrendChart');
        if (!data.chart_data || !data.chart_data.timestamp) {
            if (riskTrendChart) riskTrendChart.destroy();
            return;
        };
        const labels = data.chart_data.timestamp.map((_, i) => `T-${data.chart_data.timestamp.length - i}`);
        if (riskTrendChart) riskTrendChart.destroy();
        riskTrendChart = new Chart(chartCanvas, {
            type: 'line', data: { labels: labels, datasets: [{ label: 'Risk Score Trend', data: data.chart_data.displacement_mm.map((d, i) => (d / 20 + data.chart_data.pore_pressure_kpa[i] / 30) / 2 * 0.8 + Math.random() * 0.2), borderColor: 'var(--primary-color)', tension: 0.4, fill: true }] }, options: { responsive: true }
        });

        if (data.annotated_image) {
            annotatedImageElement.src = `http://localhost:5000/uploads/${data.annotated_image}?t=${new Date().getTime()}`;
            annotatedImageElement.style.display = 'block';
            visualPlaceholder.style.display = 'none';
        } else {
            annotatedImageElement.style.display = 'none';
            visualPlaceholder.style.display = 'block';
        }
    };

    const updateResultsPage = (data) => {
        const riskLevel = data.final_risk_score > 0.7 ? 'Critical' : (data.final_risk_score > 0.4 ? 'Moderate' : 'Low');
        document.getElementById('results-risk-level').textContent = riskLevel;
        document.getElementById('results-confidence').textContent = data.modelConfidence;
        document.getElementById('results-date').textContent = data.analysisDate;
        const actionsList = document.getElementById('mitigation-actions-list');
        actionsList.innerHTML = '';
        data.mitigationActions.forEach(action => { actionsList.innerHTML += `<li>${action}</li>`; });
        const zoneList = document.getElementById('zone-analysis-list');
        zoneList.innerHTML = '';
        data.zoneAnalysis.forEach(zone => { const riskClass = zone.level.includes('Critical') ? 'zone-risk-high' : 'zone-risk-moderate'; zoneList.innerHTML += `<li class="zone-analysis-item"><span>${zone.name} (${zone.confidence})</span><span class="zone-risk-level ${riskClass}">${zone.level}</span></li>`; });
    };
    
    const showMockAlert = (data) => {
        alertDetails.textContent = `High risk score of ${data.final_risk_score.toFixed(2)} detected. ${data.xai_explanation}`;
        alertModal.classList.add('active');
    };

    const updateAlerts = (data) => {
        if (data.final_risk_score > 0.7) {
            showMockAlert(data);
            const now = new Date();
            const time = now.toLocaleString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false });
            const severity = 'High';
            const alertEntry = { id: Date.now(), time, score: data.final_risk_score, severity, details: data.xai_explanation, status: 'Unacknowledged' };
            alerts.unshift(alertEntry);
        }
        renderAlerts();
    };

    const renderAlerts = () => {
        document.getElementById('dash-active-alerts').textContent = alerts.filter(a => a.status === 'Unacknowledged').length;
        alertsTableBody.innerHTML = '';
        alerts.forEach(alert => {
            const severityClass = alert.severity === 'High' ? 'severity-high' : 'severity-moderate';
            const isSolved = alert.status === 'Solved';
            const row = `<tr class="${isSolved ? 'solved' : ''}"><td>${alert.time}</td><td>${alert.score.toFixed(2)}</td><td class="${severityClass}">${alert.severity}</td><td>${alert.details}</td><td>${alert.status}</td><td><button class="solve-btn" data-id="${alert.id}" ${isSolved ? 'disabled' : ''}>${isSolved ? 'Solved' : 'Mark as Solved'}</button></td></tr>`;
            alertsTableBody.innerHTML += row;
        });
    };

    alertsTableBody.addEventListener('click', (event) => {
        if (event.target.classList.contains('solve-btn')) {
            const alertId = parseInt(event.target.dataset.id);
            const alertToSolve = alerts.find(a => a.id === alertId);
            if (alertToSolve) { alertToSolve.status = 'Solved'; renderAlerts(); }
        }
    });

    modalClose.addEventListener('click', () => alertModal.classList.remove('active'));

    // --- Chatbot Logic ---
    aiChatToggle.addEventListener('click', () => chatbotContainer.classList.add('active'));
    closeChatbotBtn.addEventListener('click', () => chatbotContainer.classList.remove('active'));

    const addMessageToChat = (text, sender) => {
        const messageDiv = document.createElement('div');
        messageDiv.className = `message ${sender}-message`;
        messageDiv.textContent = text;
        chatbotMessages.appendChild(messageDiv);
        chatbotMessages.scrollTop = chatbotMessages.scrollHeight;
    };

    const handleSendMessage = () => {
        const userInput = chatInput.value.trim();
        if (!userInput) return;
        addMessageToChat(userInput, 'user');
        chatInput.value = '';
        if (!lastAnalysisData) {
            addMessageToChat("Please run an analysis first so I have data to report on.", 'bot');
            return;
        }
        addMessageToChat("Thinking...", 'bot');
        fetch('http://localhost:5000/chat', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ message: userInput, context: lastAnalysisData }),
        })
        .then(response => response.json())
        .then(data => {
            const thinkingMessage = chatbotMessages.lastChild;
            if (thinkingMessage && thinkingMessage.textContent === "Thinking...") {
                chatbotMessages.removeChild(thinkingMessage);
            }
            addMessageToChat(data.reply, 'bot');
        })
        .catch(error => {
            console.error('Chat Error:', error);
            addMessageToChat("Sorry, I'm having trouble connecting to the AI engine.", 'bot');
        });
    };
    
    sendChatBtn.addEventListener('click', handleSendMessage);
    chatInput.addEventListener('keypress', (event) => {
        if (event.key === 'Enter') handleSendMessage();
    });
});