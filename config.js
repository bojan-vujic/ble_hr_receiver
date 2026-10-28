/**
 * @file config.js
 * @description Global application configuration thresholds and constants.
 */

/** @type {number} Max allowed time gap between sensor logs before chart curve breaks (ms) */
const MAX_GAP_MS = 5000; 

/** @type {number} Max point items kept inside chart memory array */
const MAX_CHART_POINTS = 3 * 60; //  3min.

/** @type {number} Viewport rendering duration window (60 seconds in ms) */
const CHART_DURATION_MS = 60 * 1000; 


