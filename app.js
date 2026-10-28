let csvContent = localStorage.getItem("hr_csv_cache") || "timestamp,heart_rate_bpm\n";
let hrCharacteristic;
let connectedDevice;
let isConnecting = false; 

// Active session intervals & duration counters
let timerInterval = null;
let secondsElapsed = 0;

// Configurable gap threshold in milliseconds (e.g., 5000ms = 5 seconds)
const MAX_GAP_MS = 5000; 

// Historical metrics container
let hrMetrics = { min: Infinity, max: -Infinity, sum: 0, count: 0 };
// Local array cache to manage live telemetry lines limitation
let trailingLogsArray = [];

// Clear structure containing objects: { time: epoch_ms, bpm: value }
let chartHistoryWindow = [];
const MAX_CHART_POINTS = 1 * 60; 

// Change the viewport configuration to a fixed duration window in milliseconds
const CHART_DURATION_MS = 60 * 1000; // 60 seconds

const startBtn = document.getElementById('start');
const stopBtn = document.getElementById('stop');
const logStream = document.getElementById('log-stream');
const chartCanvas = document.getElementById('trend-chart');
const ctx = chartCanvas.getContext('2d');

// Interface references
const currentHrEl = document.getElementById('current-hr');
const minHrEl = document.getElementById('min-hr');
const maxHrEl = document.getElementById('max-hr');
const avgHrEl = document.getElementById('avg-hr');
const dataPointsEl = document.getElementById('data-points');
const durationEl = document.getElementById('duration');

// Timer display tick function formatting outputs to standard mm:ss
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

function stopTimer() {
    if (timerInterval) {
        clearInterval(timerInterval);
        timerInterval = null;
    }
}

// System logging (e.g. state alerts, errors) formatted across full width
function addLog(text, color = "lightgreen") {
    trailingLogsArray.push({ type: 'system', text, color });
    if (trailingLogsArray.length > 3) {
        trailingLogsArray.shift();
    }
    renderLogStream();
}

// Live beat tracking structured to isolate heartbeats from timestamps
function addLiveBeatLog(bpm, timeStr, color = "white") {
    trailingLogsArray.push({ type: 'beat', bpm, timeStr, color });
    // Limit the array items to exactly 3 points
    if (trailingLogsArray.length > 3) {
        trailingLogsArray.shift();
    }
    renderLogStream();
}

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

function resetMetrics() {
    stopTimer();
    hrMetrics = { min: Infinity, max: -Infinity, sum: 0, count: 0 };
    trailingLogsArray = [];
    chartHistoryWindow = [];
    logStream.innerHTML = '';
    ctx.clearRect(0, 0, chartCanvas.width, chartCanvas.height);
    currentHrEl.innerText = "0";
    minHrEl.innerText = "-";
    maxHrEl.innerText = "-";
    avgHrEl.innerText = "-";
    dataPointsEl.innerText = "0";
    durationEl.innerText = "00:00";
}

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

let lastTimestamp = "";

function handleHeartRateNotification(e) {
    const value = e.target.value;
    const flags = value.getUint8(0);
    const is16Bit = flags & 0x01;
    const heartRate = is16Bit ? value.getUint16(1, true) : value.getUint8(1);
    
    const now = new Date();
    const isoString = now.toISOString();
    const timestamp = isoString.split('.')[0]; 
    
    if (timestamp === lastTimestamp) return; 
    lastTimestamp = timestamp; 
    
    csvContent += `${timestamp},${heartRate}\n`;
    localStorage.setItem("hr_csv_cache", csvContent);
    
    updateLiveDisplay(heartRate, now.getTime());
    
    const timeString = timestamp.split('T')[1]; 
    addLiveBeatLog(heartRate, timeString, "white");
}





startBtn.onclick = async () => {
    if (isConnecting) return;
    try {
        isConnecting = true;
        startBtn.disabled = true; 
        addLog("Scanning for BLE devices...", "#aaa");
        
        connectedDevice = await navigator.bluetooth.requestDevice({
            filters: [{ services: ['heart_rate'] }]
        });
        
        addLog(`Connecting to ${connectedDevice.name || 'Device'}...`);
        const server = await connectedDevice.gatt.connect();
        const service = await server.getPrimaryService('heart_rate');
        hrCharacteristic = await service.getCharacteristic('heart_rate_measurement');
        
        hrCharacteristic.removeEventListener('characteristicvaluechanged', handleHeartRateNotification);
        await hrCharacteristic.startNotifications();
        hrCharacteristic.addEventListener('characteristicvaluechanged', handleHeartRateNotification);
        
        addLog("✅ Stream established! Active logging initiated.");
        
        // Wake lock runs inside the successful try loop right after streaming works
        await requestWakeLock(); 
        
        startTimer();
        stopBtn.disabled = false;
    } catch (error) {
        addLog(`❌ Error: ${error.message}`, "red");
        startBtn.disabled = false; 
    } finally {
        isConnecting = false;
    }
};

stopBtn.onclick = () => {
    stopTimer();
    if (hrCharacteristic) {
        hrCharacteristic.removeEventListener('characteristicvaluechanged', handleHeartRateNotification);
        hrCharacteristic.stopNotifications();
    }
    if (connectedDevice && connectedDevice.gatt.connected) {
        connectedDevice.gatt.disconnect();
    }
    
    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `hr_session_${Date.now()}.csv`;
    a.click();
    
    localStorage.removeItem("hr_csv_cache");
    csvContent = "timestamp,heart_rate_bpm\n";
    resetMetrics();
    
    addLog("✅ Session completed. Cache cleared.");
    startBtn.disabled = false;
    stopBtn.disabled = true;
    releaseWakeLock();
};

const dimBtn = document.createElement('button');
dimBtn.id = 'dim-screen-btn';
dimBtn.innerText = '🌙 Dim Screen (Save Battery)';
dimBtn.style.cssText = 'margin-top: 10px; display: block; width: 100%; padding: 10px; background: #333; color: white; border: none; border-radius: 5px; cursor: pointer;';
stopBtn.parentNode.insertBefore(dimBtn, stopBtn.nextSibling);

const blackoutEl = document.getElementById('screen-blackout');
let lastTap = 0;

// Frame loop parameters for smooth float animation
let animationFrameId = null;
let textX = 20;
let textY = 20;
let speedX = 1.5; // Controls horizontal glide speed (pixels per frame)
let speedY = 1.5; // Controls vertical glide speed (pixels per frame)

dimBtn.onclick = () => {
    const movinText = document.getElementById('movin-text');
    
    blackoutEl.style.position = 'fixed';
    blackoutEl.style.top = '0';
    blackoutEl.style.left = '0';
    blackoutEl.style.width = '100%';
    blackoutEl.style.height = '100%';
    blackoutEl.style.backgroundColor = 'black';
    blackoutEl.style.zIndex = '99999';
    blackoutEl.style.display = 'flex';
    blackoutEl.style.overflow = 'hidden';

    if (movinText) {
        movinText.style.color = "lightgreen";
        movinText.style.position = "absolute";
        movinText.style.whiteSpace = "nowrap";
        // Remove CSS layout delay transitions so frame updates are completely instant and smooth
        movinText.style.transition = "none"; 
        
        if (!animationFrameId) {
            // Randomize starting directions so it doesn't move the same way every time
            speedX = Math.random() > 0.5 ? 1.5 : -1.5;
            speedY = Math.random() > 0.5 ? 1.5 : -1.5;

            const updateFrame = () => {
                // Keep text metrics completely live inside the animation loop
                const cur = currentHrEl.innerText;
                const min = minHrEl.innerText;
                const max = maxHrEl.innerText;
                const avg = avgHrEl.innerText;
                const pts = dataPointsEl.innerText;

                movinText.innerHTML = `❤️ ${cur} | Min: ${min} Max: ${max} Avg: ${avg} | Pts: ${pts} <br><span style="font-size: 11px; opacity: 0.7; display: block; text-align: center; margin-top: 4px;">Double tap to wake</span>`;

                const maxX = window.innerWidth - movinText.clientWidth;
                const maxY = window.innerHeight - movinText.clientHeight;

                // Handle bouncing physics rules on edge boundaries
                if (textX <= 10 || textX >= maxX) speedX *= -1;
                if (textY <= 10 || textY >= maxY) speedY *= -1;

                // Step position forward
                textX += speedX;
                textY += speedY;

                // Lock elements inside viewport limits to prevent trailing line bleed layout overflow
                textX = Math.max(10, Math.min(textX, maxX > 20 ? maxX : 20));
                textY = Math.max(10, Math.min(textY, maxY > 20 ? maxY : 20));

                movinText.style.left = textX + "px";
                movinText.style.top = textY + "px";

                animationFrameId = requestAnimationFrame(updateFrame);
            };
            
            animationFrameId = requestAnimationFrame(updateFrame);
        }
    }

    if (document.documentElement.requestFullscreen) {
        document.documentElement.requestFullscreen().catch(() => {});
    }
};

blackoutEl.onclick = (e) => {
    e.stopPropagation(); 
    e.preventDefault();

    const now = Date.now();
    if (now - lastTap < 300) {
        if (animationFrameId) {
            cancelAnimationFrame(animationFrameId);
            animationFrameId = null;
        }
        
        blackoutEl.style.display = 'none';
        
        const movinText = document.getElementById('movin-text');
        if (movinText) {
            movinText.textContent = "Tap anywhere to wake screen";
            movinText.style.color = "#222";
            movinText.style.position = "static";
        }

        if (document.fullscreenElement && document.exitFullscreen) {
            document.exitFullscreen().catch(() => {});
        }
    }
    lastTap = now;
};

document.addEventListener("DOMContentLoaded", () => {
    // Initializer hooks go here
});

let wakeLock = null;

async function requestWakeLock() {
  try {
    if ('wakeLock' in navigator) {
      wakeLock = await navigator.wakeLock.request('screen');
      addLog("🔒 Screen Wake Lock active. Screen will stay on.");
    }
  } catch (err) {
    addLog(`⚠️ Wake Lock failed: ${err.message}`, "orange");
  }
}

function releaseWakeLock() {
  if (wakeLock !== null) {
    wakeLock.release();
    wakeLock = null;
  }
}

// Global active focus observer keeping Chrome from dropping wake lock tracking profiles
document.addEventListener("visibilitychange", async () => {
    if (wakeLock !== null && document.visibilityState === "visible") {
        await requestWakeLock();
    }
});

