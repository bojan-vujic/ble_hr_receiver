// Initialize csvContent from localStorage if a session was interrupted, otherwise use default header
let csvContent = localStorage.getItem("hr_csv_cache") || "timestamp,heart_rate_bpm\n";
let hrCharacteristic;
let connectedDevice;
let isConnecting = false; 

const startBtn = document.getElementById('start');
const stopBtn = document.getElementById('stop');
const logDiv = document.getElementById('log');

function addLog(text, color = "lightgreen") {
    const p = document.createElement('p');
    p.style.margin = "2px 0"; 
    p.style.color = color;
    p.innerText = text; 
    logDiv.appendChild(p);
    logDiv.scrollTop = logDiv.scrollHeight;
}

// On page load, check if an existing session is waiting to be resumed
window.addEventListener('DOMContentLoaded', () => {
    const cachedData = localStorage.getItem("hr_csv_cache");
    if (cachedData) {
        addLog("⚠️ An interrupted session was found! Click 'Start' to re-pair and resume appending data.", "orange");
        
        // Split by lines and remove any empty trailing rows
        const lines = cachedData.trim().split('\n');
        
        // Skip the header row (index 0) when fetching data rows
        if (lines.length > 1) {
            addLog(`Cached data:`)
            addLog("...", "#aaa");
            
            // Slice out up to the last 3 rows
            const lastLines = lines.slice(-3);
            
            // Log each historical data point out to the terminal
            lastLines.forEach(line => {
                // format it nicely like the live logs
                const [ts, bpm] = line.split(',');
                const timeString = ts.includes('T') ? ts.split('T')[1] : ts;
                addLog(`⏳ ❤️ HR: ${bpm} BPM | ${timeString}`, "#aaa");
            });
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
    const timestamp = now.toISOString().split('.')[0]; 
    
    if (timestamp === lastTimestamp) {
        return; 
    }
    lastTimestamp = timestamp; 
    
    csvContent += `${timestamp},${heartRate}\n`;
    
    // Backup data instantly to local storage so a refresh can never wipe it
    localStorage.setItem("hr_csv_cache", csvContent);
    
    const timeString = timestamp.split('T')[1]; 
    addLog(` ❤️ HR: ${heartRate} BPM | ${timeString}`, "white");
}

startBtn.onclick = async () => {
    if (isConnecting) return;
    
    try {
        isConnecting = true;
        startBtn.disabled = true; 
        
        addLog("Scanning for BLE heart rate monitors...", "#aaa");
        connectedDevice = await navigator.bluetooth.requestDevice({
            filters: [{ services: ['heart_rate'] }]
        });
        
        addLog(`Connecting to ${connectedDevice.name || 'Unknown Device'}...`);
        const server = await connectedDevice.gatt.connect();
        const service = await server.getPrimaryService('heart_rate');
        hrCharacteristic = await service.getCharacteristic('heart_rate_measurement');
        
        hrCharacteristic.removeEventListener('characteristicvaluechanged', handleHeartRateNotification);
        
        await hrCharacteristic.startNotifications();
        hrCharacteristic.addEventListener('characteristicvaluechanged', handleHeartRateNotification);
        
        addLog("✅ Stream established! Active logging initiated.");
        stopBtn.disabled = false;
    } catch (error) {
        addLog(`❌ Error: ${error.message}`, "red");
        startBtn.disabled = false; 
    } finally {
        isConnecting = false;
    }
};

stopBtn.onclick = () => {
    if (hrCharacteristic) {
        hrCharacteristic.removeEventListener('characteristicvaluechanged', handleHeartRateNotification);
        hrCharacteristic.stopNotifications();
    }
    
    if (connectedDevice && connectedDevice.gatt.connected) {
        connectedDevice.gatt.disconnect();
        addLog("🔒 Connection closed. Compiling CSV payload...", "#aaa");
    }
    
    // Generate and trigger download using the accumulated string
    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `hr_receiver_session_${Date.now()}.csv`;
    a.click();
    
    // Clear cache from storage and reset your in-memory stream variable back to default
    localStorage.removeItem("hr_csv_cache");
    csvContent = "timestamp,heart_rate_bpm\n";
    
    addLog("✅ Session data downloaded successfully. Storage cache cleared.");
    startBtn.disabled = false;
    stopBtn.disabled = true;
};
