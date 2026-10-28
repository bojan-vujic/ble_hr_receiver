/**
 * @file state.js
 * @description Application state containers, storage caches, logging streams, and core variable tracking.
 */

let csvContent = localStorage.getItem("hr_csv_cache") || "timestamp,heart_rate_bpm\n";
let hrCharacteristic;
let connectedDevice;
let isConnecting = false; 

let timerInterval = null;
let secondsElapsed = 0;

let hrMetrics = { min: Infinity, max: -Infinity, sum: 0, count: 0 };
let trailingLogsArray = [];
let chartHistoryWindow = [];

// Interface bindings
const startBtn = document.getElementById('start');
const stopBtn = document.getElementById('stop');
const logStream = document.getElementById('log-stream');
const chartCanvas = document.getElementById('trend-chart');
const ctx = chartCanvas.getContext('2d');

const currentHrEl = document.getElementById('current-hr');
const minHrEl = document.getElementById('min-hr');
const maxHrEl = document.getElementById('max-hr');
const avgHrEl = document.getElementById('avg-hr');
const dataPointsEl = document.getElementById('data-points');
const durationEl = document.getElementById('duration');

/**
 * Formats app runtime metrics into standard mm:ss output strings.
 */
function startTimer() {
    stopTimer(); 
    secondsElapsed = 0;
    timerInterval = setInterval(() => {
        secondsElapsed++;
        const mins = String(Math.floor(secondsElapsed / 60)).padStart(2, '0');
        const secs = String(secondsElapsed % 60).padStart(2, '0');
        durationEl.innerText = `${mins}:${secs}`;
    }, 1000);
}

/**
 * Halts session counter interval safely.
 */
function stopTimer() {
    if (timerInterval) {
        clearInterval(timerInterval);
        timerInterval = null;
    }
}

/**
 * Appends wide system alert log rows to output terminal array stream.
 * @param {string} text - The log alert message.
 * @param {string} [color="lightgreen"] - Style color parameter.
 */
function addLog(text, color = "lightgreen") {
    trailingLogsArray.push({ type: 'system', text, color });
    if (trailingLogsArray.length > 3) {
        trailingLogsArray.shift();
    }
    renderLogStream();
}

/**
 * Appends telemetry heart rate beats to output terminal array stream.
 * @param {number} bpm - Detected heart rate beat.
 * @param {string} timeStr - Extracted timeline string.
 * @param {string} [color="white"] - Style color parameter.
 */
function addLiveBeatLog(bpm, timeStr, color = "white") {
    trailingLogsArray.push({ type: 'beat', bpm, timeStr, color });
    if (trailingLogsArray.length > 3) {
        trailingLogsArray.shift();
    }
    renderLogStream();
}

/**
 * Renders stored rows from array log items to output display DOM tree context.
 */
function renderLogStream() {
    logStream.innerHTML = '';
    trailingLogsArray.forEach(item => {
        const p = document.createElement('p');
        p.className = 'log-row';
        p.style.color = item.color;

        if (item.type === 'beat') {
            p.innerHTML = `<span>❤️ HR: ${item.bpm} BPM</span><span class="timestamp">${item.timeStr}</span>`;
        } else {
            p.innerHTML = `<span>${item.text}</span>`;
        }
        logStream.appendChild(p);
    });
}

/**
 * Updates UI values and tracking history coordinates.
 * @param {number} currentBpm - Heart rate telemetry value.
 * @param {number|null} [explicitTimestampMs=null] - Restored file timestamp parameter.
 */
function updateLiveDisplay(currentBpm, explicitTimestampMs = null) {
    if (currentBpm < hrMetrics.min) hrMetrics.min = currentBpm;
    if (currentBpm > hrMetrics.max) hrMetrics.max = currentBpm;
    hrMetrics.sum += currentBpm;
    hrMetrics.count++;

    const average = Math.round(hrMetrics.sum / hrMetrics.count);

    currentHrEl.innerText = `${currentBpm} BPM`;
    minHrEl.innerText = `${hrMetrics.min}`;
    maxHrEl.innerText = `${hrMetrics.max}`;
    avgHrEl.innerText = `${average}`;
    
    dataPointsEl.innerText = hrMetrics.count;
    
    const accurateTimestamp = explicitTimestampMs !== null ? explicitTimestampMs : Date.now();
    
    chartHistoryWindow.push({ time: accurateTimestamp, bpm: currentBpm });
    if (chartHistoryWindow.length > MAX_CHART_POINTS) {
        chartHistoryWindow.shift();
    }
    drawTrendChart();
}

/**
 * Wipes variables and visual UI indicators back to initial properties.
 */
function resetMetrics() {
    stopTimer();
    hrMetrics = { min: Infinity, max: -Infinity, sum: 0, count: 0 };
    trailingLogsArray = [];
    chartHistoryWindow = [];
    logStream.innerHTML = '';
    ctx.clearRect(0, 0, chartCanvas.width, chartCanvas.height);
    currentHrEl.innerText = "-";
    minHrEl.innerText = "-";
    maxHrEl.innerText = "-";
    avgHrEl.innerText = "-";
    dataPointsEl.innerText = "-";
    durationEl.innerText = "--:--";
}

// Restore cache on script load sequence execution
window.addEventListener('DOMContentLoaded', () => {
    const cachedData = localStorage.getItem("hr_csv_cache");
    if (cachedData) {
        addLog("⚠️ Interrupted session detected! Click 'Start' to resume.", "orange");
        const lines = cachedData.trim().split('\n');
        if (lines.length > 1) {
            for (let i = 1; i < lines.length; i++) {
                const [timeIsoStr, bpmStr] = lines[i].split(',');
                const bpm = parseInt(bpmStr, 10);
                if (!isNaN(bpm)) {
                    const parsedTimestampMs = new Date(timeIsoStr + '.000Z').getTime();
                    updateLiveDisplay(bpm, isNaN(parsedTimestampMs) ? null : parsedTimestampMs);
                }
            }
            addLog(`✅ Metrics restored from storage cache.`, "#aaa");
        }
    }
});
