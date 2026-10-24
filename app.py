import os
import webbrowser
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
import threading
import time

HTML_CONTENT = """
<!DOCTYPE html>
<html>
<head>
    <title>BLE Heart Rate Receiver</title>
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <style>
        body { font-family: sans-serif; background: #121212; color: #fff; padding: 20px; text-align: center; }
        button { width: 100%; padding: 15px; margin: 10px 0; font-size: 16px; border: none; border-radius: 5px; cursor: pointer; color: white; font-weight: bold; }
        #start { background: #2e7d32; } #stop { background: #c62828; } button:disabled { background: #444; color: #888; }
        #log { background: #000; color: #00ff00; font-family: monospace; text-align: left; padding: 10px; height: 300px; overflow-y: scroll; border-radius: 5px; }
    </style>
</head>
<body>
    <h2>BLE Heart Rate Receiver</h2>
    <p style="color:#aaa; font-size: 14px;">Capturing universal GATT telemetry streams via Web Bluetooth API.</p>
    <button id="start">▶ Pair & Connect Device</button>
    <button id="stop" disabled>■ Stop & Save Session (CSV)</button>
    <div id="log"><p style="color:#aaa">> Receiver ready. Ensure your HR device broadcast mode is enabled.</p></div>

    <script>
        let csvContent = "timestamp,hr\\n";
        let hrCharacteristic;
        const startBtn = document.getElementById('start');
        const stopBtn = document.getElementById('stop');
        const logDiv = document.getElementById('log');

        function addLog(text, color="lightgreen") {
            const p = document.createElement('p');
            p.style.margin = "2px 0"; p.style.color = color;
            p.innerText = text; logDiv.appendChild(p);
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
                    csvContent += `${timestamp},${hr}\\n`;
                    addLog(`❤️ HR: ${hr} BPM | ${timestamp.split('T')[1].slice(0,8)}`, "white");
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
    </script>
</body>
</html>
"""

class InlineDashboardHandler(SimpleHTTPRequestHandler):
    def log_message(self, format, *args): return
    def do_GET(self):
        if self.path == "/":
            self.send_response(200)
            self.send_header("Content-type", "text/html")
            self.end_headers()
            self.wfile.write(HTML_CONTENT.encode("utf-8"))
        else:
            self.send_response(404)
            self.end_headers()

def run_server():
    server = ThreadingHTTPServer(("127.0.0.1", 8000), InlineDashboardHandler)
    server.serve_forever()

if __name__ == "__main__":
    threading.Thread(target=run_server, daemon=True).start()
    print("Receiver dashboard active at http://127.0.0.1:8000")
    webbrowser.open("http://127.0.0.1:8000")
    
    while True:
        time.sleep(1)
