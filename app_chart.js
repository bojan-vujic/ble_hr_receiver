// Canvas trace curve line layout paint pipeline loop with time gap detection
function drawTrendChart() {
    const w = chartCanvas.width;
    const h = chartCanvas.height;
    ctx.clearRect(0, 0, w, h);
    
    if (chartHistoryWindow.length === 0) return;
    
    // Determine the true rightmost time boundary (latest point or current time)
    const now = chartHistoryWindow[chartHistoryWindow.length - 1].time;
    // The leftmost boundary is exactly 60 seconds before the latest point
    const startTimeBoundary = now - CHART_DURATION_MS;
    
    // Extract heart rates to calculate dynamic Y scaling boundaries
    const heartRates = chartHistoryWindow.map(pt => pt.bpm);
    let localMin = Math.min(...heartRates) - 2;
    let localMax = Math.max(...heartRates) + 2;
    if (localMax - localMin < 10) { 
        localMin -= 5;
        localMax += 5;
    }
    
    ctx.beginPath();
    ctx.strokeStyle = '#ef4444';
    ctx.lineWidth = 2;
    ctx.lineJoin = 'round';
    ctx.lineCap = 'round';
    
    let pathStarted = false;
    
    chartHistoryWindow.forEach((point, index) => {
        // Skip points that dropped out of the active 60-second viewing window
        if (point.time < startTimeBoundary) return;
        
        // Map X position strictly proportional to its location in the fixed 60-second window
        const timeElapsed = point.time - startTimeBoundary;
        const x = (timeElapsed / CHART_DURATION_MS) * w;
        const y = h - ((point.bpm - localMin) / (localMax - localMin) * h);
        
        if (!pathStarted) {
            ctx.moveTo(x, y);
            pathStarted = true;
        } else {
            // Check the gap between this point and the immediate previous point
            const previousPoint = chartHistoryWindow[index - 1];
            const timeGap = point.time - previousPoint.time;
            
            if (timeGap > MAX_GAP_MS) {
                // Lift pen and jump if gap limit is exceeded
                ctx.moveTo(x, y);
            } else {
                ctx.lineTo(x, y);
            }
        }
    });
    ctx.stroke();
}

