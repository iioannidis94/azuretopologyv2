// Performance monitoring and debugging utilities
// Helps identify bottlenecks in rendering and layout

export class PerformanceMonitor {
  constructor() {
    this.metrics = {
      drawTime: [],
      layoutTime: [],
      frameCount: 0,
      fps: 0,
      lastFpsUpdate: Date.now(),
      peakMemory: 0
    };
    this.enabled = false;
    this.historySize = 60; // Keep 60 frames of history
    this.MIN_ACCEPTABLE_FPS = 30; // Performance target for color coding
  }

  /**
   * Start measuring an operation
   */
  startMeasure(label) {
    if (!this.enabled) return null;
    return {
      label,
      startTime: performance.now(),
      startMemory: this._getMemory()
    };
  }

  /**
   * End measuring and record metric
   */
  endMeasure(measurement) {
    if (!this.enabled || !measurement) return;

    const duration = performance.now() - measurement.startTime;
    const memoryDelta = this._getMemory() - measurement.startMemory;

    if (measurement.label === 'draw') {
      this.metrics.drawTime.push(duration);
      if (this.metrics.drawTime.length > this.historySize) {
        this.metrics.drawTime.shift();
      }
    } else if (measurement.label === 'layout') {
      this.metrics.layoutTime.push(duration);
      if (this.metrics.layoutTime.length > this.historySize) {
        this.metrics.layoutTime.shift();
      }
    }

    return { duration, memoryDelta };
  }

  /**
   * Record frame
   */
  recordFrame() {
    if (!this.enabled) return;

    this.metrics.frameCount++;

    const now = Date.now();
    if (now - this.metrics.lastFpsUpdate > 1000) {
      this.metrics.fps = this.metrics.frameCount;
      this.metrics.frameCount = 0;
      this.metrics.lastFpsUpdate = now;
    }
  }

  /**
   * Get current metrics
   */
  getMetrics() {
    const getAverage = (arr) => arr.length ? arr.reduce((a, b) => a + b, 0) / arr.length : 0;
    const getMax = (arr) => arr.length ? Math.max(...arr) : 0;

    return {
      fps: this.metrics.fps,
      avgDrawTime: getAverage(this.metrics.drawTime),
      maxDrawTime: getMax(this.metrics.drawTime),
      avgLayoutTime: getAverage(this.metrics.layoutTime),
      maxLayoutTime: getMax(this.metrics.layoutTime),
      memory: this._getMemory(),
      peakMemory: this.metrics.peakMemory
    };
  }

  /**
   * Get memory usage
   */
  _getMemory() {
    if (performance.memory) {
      const used = performance.memory.usedJSHeapSize;
      this.metrics.peakMemory = Math.max(this.metrics.peakMemory, used);
      return used;
    }
    return 0;
  }

  /**
   * Enable/disable monitoring
   */
  setEnabled(enabled) {
    this.enabled = enabled;
    if (!enabled) {
      this.metrics.drawTime = [];
      this.metrics.layoutTime = [];
    }
  }

  /**
   * Reset metrics
   */
  reset() {
    this.metrics = {
      drawTime: [],
      layoutTime: [],
      frameCount: 0,
      fps: 0,
      lastFpsUpdate: Date.now(),
      peakMemory: 0
    };
  }
}

/**
 * Render performance stats display
 */
export class PerformanceDisplay {
  constructor(monitor) {
    this.monitor = monitor;
    this.overlay = null;
    this.visible = false;
  }

  /**
   * Toggle performance overlay display
   */
  toggle() {
    if (!this.overlay) {
      this.overlay = this._createOverlay();
    }
    this.visible = !this.visible;
    this.overlay.style.display = this.visible ? 'block' : 'none';
    this.monitor.setEnabled(this.visible);
  }

  /**
   * Create performance overlay element
   */
  _createOverlay() {
    const overlay = document.createElement('div');
    overlay.id = 'performance-overlay';
    overlay.style.cssText = `
      position: fixed;
      top: 10px;
      right: 10px;
      background: rgba(0, 0, 0, 0.8);
      color: #0F0;
      font-family: 'Courier New', monospace;
      font-size: 11px;
      padding: 10px;
      border-radius: 4px;
      z-index: 10000;
      min-width: 200px;
      display: none;
      line-height: 1.4;
      pointer-events: none;
    `;
    document.body.appendChild(overlay);
    return overlay;
  }

  /**
   * Update performance display
   */
  update() {
    if (!this.visible || !this.overlay) return;

    const metrics = this.monitor.getMetrics();
    const memoryMB = (metrics.memory / 1024 / 1024).toFixed(1);
    const peakMemoryMB = (metrics.peakMemory / 1024 / 1024).toFixed(1);

    const html = `
      <div style="color: #0F0;">
        <div><strong>Performance Monitor</strong></div>
        <hr style="border: 1px solid #0F0; margin: 5px 0;">
        <div>FPS: <span style="color: ${metrics.fps < this.monitor.MIN_ACCEPTABLE_FPS ? '#F00' : '#0F0'}">${metrics.fps}</span></div>
        <div>Draw: ${metrics.avgDrawTime.toFixed(1)}ms (max: ${metrics.maxDrawTime.toFixed(1)}ms)</div>
        <div>Layout: ${metrics.avgLayoutTime.toFixed(1)}ms (max: ${metrics.maxLayoutTime.toFixed(1)}ms)</div>
        <div>Memory: ${memoryMB}MB (peak: ${peakMemoryMB}MB)</div>
      </div>
    `;
    this.overlay.innerHTML = html;
  }
}

/**
 * Global performance monitor instance
 */
let globalMonitor = null;
let globalDisplay = null;

export function getPerformanceMonitor() {
  if (!globalMonitor) {
    globalMonitor = new PerformanceMonitor();
    globalDisplay = new PerformanceDisplay(globalMonitor);
    
    // Expose to window for console access
    if (typeof window !== 'undefined') {
      window._togglePerformanceMonitor = () => globalDisplay.toggle();
      window._getPerformanceMetrics = () => globalMonitor.getMetrics();
    }
  }
  return globalMonitor;
}

export function getPerformanceDisplay() {
  if (!globalDisplay) {
    getPerformanceMonitor(); // Initialize monitor first
  }
  return globalDisplay;
}

/**
 * Add animation frame hook for continuous updates
 */
export function setupPerformanceTracking() {
  const monitor = getPerformanceMonitor();
  const display = getPerformanceDisplay();

  // Update display every frame
  function updateDisplay() {
    monitor.recordFrame();
    display.update();
    requestAnimationFrame(updateDisplay);
  }

  if (typeof window !== 'undefined') {
    requestAnimationFrame(updateDisplay);
  }
}
