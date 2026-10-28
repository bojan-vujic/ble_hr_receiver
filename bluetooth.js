/**
 * @file bluetooth.js
 * @description Web Bluetooth connection loops and GATT characteristic notification handling.
 */

let lastTimestamp = "";

/**
 * Unpacks binary GATT heart rate packets into metric integers.
 * @param {Event} e - GATT characteristic change event payload context.
 */
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

// IO initialization stream handshakes.
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

// IO tear-down and output compilation extraction.
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

document.addEventListener("DOMContentLoaded", () => {
    // Initializer hooks layout logic.
});

let wakeLock = null;

/**
 * Requests a continuous Screen Wake Lock from the user agent platform layer.
 */
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

/**
 * Voluntarily breaks the Screen Wake Lock channel handle profile.
 */
function releaseWakeLock() {
  if (wakeLock !== null) {
    wakeLock.release();
    wakeLock = null;
  }
}
