let csvContent = "timestamp,hr\n";
let hrCharacteristic;
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

startBtn.onclick = async () => {
    try {
        addLog("Scanning for BLE heart rate monitors...", "#aaa");
        const device = await navigator.bluetooth.requestDevice({
            filters: [{ services: ['heart_rate'] }]
        });
        
        addLog(`Connecting to ${device.name || 'Unknown Device'}...`);
        const server = await device.gatt.connect();
        const service = await server.getPrimaryService('heart_rate');
        hrCharacteristic = await service.getCharacteristic('heart_rate_measurement');
        
        await hrCharacteristic.startNotifications();
        hrCharacteristic.addEventListener('characteristicvaluechanged', (e) => {
            const value = e.target.value;
            const flags = value.getUint8(0);
            const is16Bit = flags & 0x01;
            const hr = is16Bit ? value.getUint16(1, true) : value.getUint8(1);
            
            const timestamp = new Date().toISOString();
            csvContent += `${timestamp},${hr}\n`;
            addLog(`❤️ HR: ${hr} BPM | ${timestamp.split('T')[1].slice(0, 8)}`, "white");
        });
        
        addLog("✅ Stream established! Active logging initiated.");
        startBtn.disabled = true;
        stopBtn.disabled = false;
    } catch (error) {
        addLog(`❌ Error: ${error.message}`, "red");
    }
};

stopBtn.onclick = () => {
    if (hrCharacteristic) hrCharacteristic.stopNotifications();
    addLog("🔒 Connection closed. Compiling CSV payload...", "#aaa");
    
    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `hr_receiver_session_${Date.now()}.csv`;
    a.click();
    
    addLog("✅ Session data downloaded successfully.");
    startBtn.disabled = false;
    stopBtn.disabled = true;
};
