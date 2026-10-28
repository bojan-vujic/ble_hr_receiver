/**
 * @file overlay.js
 * @description Battery-saving overlay presentation mechanics, screensaver loops, and viewport focus observers.
 */

// Create a trigger button dynamically
const dimBtn = document.createElement('button');
dimBtn.id = 'dim-screen-btn';
dimBtn.innerText = '🌙 Dim Screen (Save Battery)';
dimBtn.style.cssText = 'margin-top: 10px; display: block; width: 100%; padding: 10px; background: #333; color: white; border: none; border-radius: 5px; cursor: pointer;';
stopBtn.parentNode.insertBefore(dimBtn, stopBtn.nextSibling);

const blackoutEl = document.getElementById('screen-blackout');
let lastTap = 0;
let animationFrameId = null;
let textX = 20;
let textY = 20;
let speedX = 1.5; 
let speedY = 1.5; 

// Activate black screen overlay configurations.
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
        movinText.style.transition = "none"; 
        
        if (!animationFrameId) {
            speedX = Math.random() > 0.5 ? 1.5 : -1.5;
            speedY = Math.random() > 0.5 ? 1.5 : -1.5;

            const updateFrame = () => {
                const cur = currentHrEl.innerText;
                const min = minHrEl.innerText;
                const max = maxHrEl.innerText;
                const avg = avgHrEl.innerText;
                const pts = dataPointsEl.innerText;

                movinText.innerHTML = `❤️ ${cur} | Min: ${min} Max: ${max} Avg: ${avg} | Pts: ${pts} <br><span style="font-size: 11px; opacity: 0.7; display: block; text-align: center; margin-top: 4px;">Double tap to wake</span>`;

                const maxX = window.innerWidth - movinText.clientWidth;
                const maxY = window.innerHeight - movinText.clientHeight;

                if (textX <= 10 || textX >= maxX) speedX *= -1;
                if (textY <= 10 || textY >= maxY) speedY *= -1;

                textX += speedX;
                textY += speedY;

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

// Dismiss black screen overlay via double tap.
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

// Focus observer preventing Chrome from forcing low-power execution state drops.
document.addEventListener("visibilitychange", async () => {
    if (wakeLock !== null && document.visibilityState === "visible") {
        await requestWakeLock();
    }
});

