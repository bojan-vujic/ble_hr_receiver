/**
 * @file app-chart.js
 * @description HTML5 Canvas charting trace curve paint pipeline with time gap analysis layout rules.
 */

/**
 * Repaints the real-time line graph tracking heart rate velocity over time.
 */
function drawTrendChart() {
    const w = chartCanvas.width;
    const h = chartCanvas.height;
    ctx.clearRect(0, 0, w, h);
    
    if (chartHistoryWindow.length === 0) return;
    
    const now = chartHistoryWindow[chartHistoryWindow.length - 1].time;
    const startTimeBoundary = now - CHART_DURATION_MS;
    
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
        if (point.time < startTimeBoundary) return;
        
        const timeElapsed = point.time - startTimeBoundary;
        const x = (timeElapsed / CHART_DURATION_MS) * w;
        const y = h - ((point.bpm - localMin) / (localMax - localMin) * h);
        
        if (!pathStarted) {
            ctx.moveTo(x, y);
            pathStarted = true;
        } else {
            const previousPoint = chartHistoryWindow[index - 1];
            const timeGap = point.time - previousPoint.time;
            
            if (timeGap > MAX_GAP_MS) {
                ctx.moveTo(x, y);
            } else {
                ctx.lineTo(x, y);
            }
        }
    });
    ctx.stroke();
}

