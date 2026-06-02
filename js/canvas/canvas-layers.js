// Canvas layer system with dirty-rect tracking
// Caches layers and only redraws changed ones for significant performance boost

export class CanvasLayer {
  constructor(name, canvas) {
    this.name = name;
    this.offscreenCanvas = new OffscreenCanvas(canvas.width, canvas.height);
    this.ctx = this.offscreenCanvas.getContext('2d');
    this.isDirty = true;
    this.priority = 0; // Higher priority = drawn last (on top)
  }

  resize(width, height) {
    if (this.offscreenCanvas.width !== width || this.offscreenCanvas.height !== height) {
      this.offscreenCanvas = new OffscreenCanvas(width, height);
      this.ctx = this.offscreenCanvas.getContext('2d');
      this.isDirty = true;
    }
  }

  markDirty() {
    this.isDirty = true;
  }

  clear() {
    this.ctx.clearRect(0, 0, this.offscreenCanvas.width, this.offscreenCanvas.height);
  }

  getContext() {
    return this.ctx;
  }

  drawToCanvas(destCtx, offsetX, offsetY, scaleX, scaleY) {
    if (!this.isDirty) {
      // Layer is cached, just draw it
      const bitmap = this.offscreenCanvas.convertToImageBitmap();
      destCtx.drawImage(bitmap, 0, 0);
      return;
    }
    // If layer is dirty, it should be redrawn by caller
  }
}

export class LayerManager {
  constructor(canvas) {
    this.canvas = canvas;
    this.layers = new Map();
    this.layerOrder = [];
    this.stateHash = null;
    this.lastDrawTime = 0;
    this.frameTime = 0;
    this.MAX_DIRTY_RECTS = 10; // Maximum rectangles to track for optimal performance
  }

  /**
   * Create or get a layer
   */
  getLayer(name, priority = 0) {
    if (!this.layers.has(name)) {
      const layer = new CanvasLayer(name, this.canvas);
      layer.priority = priority;
      this.layers.set(name, layer);
      this._updateLayerOrder();
    }
    return this.layers.get(name);
  }

  /**
   * Mark layer as needing redraw
   */
  markLayerDirty(name) {
    const layer = this.layers.get(name);
    if (layer) layer.markDirty();
  }

  /**
   * Mark all layers as dirty
   */
  markAllDirty() {
    this.layers.forEach(layer => layer.markDirty());
  }

  /**
   * Update layer order based on priority
   */
  _updateLayerOrder() {
    this.layerOrder = Array.from(this.layers.values()).sort((a, b) => a.priority - b.priority);
  }

  /**
   * Resize all layers
   */
  resize(width, height) {
    this.layers.forEach(layer => layer.resize(width, height));
  }

  /**
   * Get layers that need redrawing
   */
  getDirtyLayers() {
    return this.layerOrder.filter(layer => layer.isDirty);
  }

  /**
   * Composite all layers to main canvas
   */
  composite(mainCtx, offsetX, offsetY, scaleX, scaleY) {
    mainCtx.save();
    mainCtx.translate(offsetX, offsetY);
    mainCtx.scale(scaleX, scaleY);

    this.layerOrder.forEach(layer => {
      if (layer.isDirty) return; // Skip dirty layers (they need to be redrawn first)
      
      try {
        const bitmap = layer.offscreenCanvas.convertToImageBitmap();
        mainCtx.drawImage(bitmap, 0, 0);
      } catch (e) {
        // Fallback if convertToImageBitmap fails
        mainCtx.drawImage(layer.offscreenCanvas, 0, 0);
      }
    });

    mainCtx.restore();
  }

  /**
   * Clear cache and stats
   */
  clear() {
    this.layers.forEach(layer => layer.clear());
  }

  /**
   * Get layer stats for debugging
   */
  getStats() {
    const dirtyCount = this.getDirtyLayers().length;
    return {
      totalLayers: this.layers.size,
      dirtyLayers: dirtyCount,
      cleanLayers: this.layers.size - dirtyCount,
      frameTime: this.frameTime,
      lastDrawTime: this.lastDrawTime
    };
  }
}

/**
 * Dirty rect tracking for invalidation
 */
export class DirtyRectTracker {
  constructor() {
    this.rects = [];
    this.maxRects = 10; // Limit to prevent too many small rects for optimal performance
    this.mergeThreshold = 200; // Merge rects if they overlap by this much
  }

  /**
   * Add a dirty rectangle
   */
  add(x, y, width, height) {
    if (width <= 0 || height <= 0) return;

    const newRect = { x, y, width, height, x1: x + width, y1: y + height };

    // Check if we should merge with existing rects
    let merged = false;
    for (let i = 0; i < this.rects.length; i++) {
      const rect = this.rects[i];
      // If rects overlap significantly, merge them
      if (this._shouldMerge(rect, newRect)) {
        rect.x = Math.min(rect.x, newRect.x);
        rect.y = Math.min(rect.y, newRect.y);
        rect.x1 = Math.max(rect.x1, newRect.x1);
        rect.y1 = Math.max(rect.y1, newRect.y1);
        rect.width = rect.x1 - rect.x;
        rect.height = rect.y1 - rect.y;
        merged = true;
        break;
      }
    }

    if (!merged) {
      this.rects.push(newRect);
      // If too many rects, merge smallest ones
      if (this.rects.length > this.maxRects) {
        this._mergeSmallerRects();
      }
    }
  }

  /**
   * Check if two rects should be merged
   */
  _shouldMerge(rect1, rect2) {
    // Calculate overlap
    const overlapX = Math.min(rect1.x1, rect2.x1) - Math.max(rect1.x, rect2.x);
    const overlapY = Math.min(rect1.y1, rect2.y1) - Math.max(rect1.y, rect2.y);

    if (overlapX <= 0 || overlapY <= 0) return false;

    const overlapArea = overlapX * overlapY;
    const combinedArea = rect1.width * rect1.height + rect2.width * rect2.height;

    // Merge if overlap is significant
    return overlapArea > (combinedArea * 0.1);
  }

  /**
   * Merge smaller rects to reduce count
   */
  _mergeSmallerRects() {
    if (this.rects.length <= 1) return;

    // Sort by area (smallest first)
    this.rects.sort((a, b) => (a.width * a.height) - (b.width * b.height));

    // Merge smallest two
    const small1 = this.rects.shift();
    const small2 = this.rects.shift();

    const merged = {
      x: Math.min(small1.x, small2.x),
      y: Math.min(small1.y, small2.y),
      x1: Math.max(small1.x1, small2.x1),
      y1: Math.max(small1.y1, small2.y1)
    };
    merged.width = merged.x1 - merged.x;
    merged.height = merged.y1 - merged.y;

    this.rects.push(merged);
  }

  /**
   * Clear dirty rects
   */
  clear() {
    this.rects = [];
  }

  /**
   * Get all dirty rects
   */
  getRects() {
    return this.rects;
  }
}
