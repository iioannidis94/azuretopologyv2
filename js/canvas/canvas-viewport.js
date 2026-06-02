// Viewport-based culling for performance optimization
// Reduces rendering load by only rendering visible elements

export class ViewportCuller {
  constructor(canvas) {
    this.canvas = canvas;
    this.viewportPadding = 100; // Extra pixels around viewport to prefetch
    this.MIN_NODES_FOR_CULLING = 50; // Only optimize when dataset is large enough
  }

  /**
   * Calculate visible viewport bounds in world coordinates
   */
  getViewportBounds(offsetX, offsetY, scaleX, scaleY) {
    const canvasW = this.canvas.width;
    const canvasH = this.canvas.height;
    
    // Convert canvas bounds to world coordinates
    const minX = -offsetX / scaleX;
    const minY = -offsetY / scaleY;
    const maxX = (canvasW - offsetX) / scaleX;
    const maxY = (canvasH - offsetY) / scaleY;
    
    // Add padding for prefetch
    const pad = this.viewportPadding / scaleX;
    return {
      minX: minX - pad,
      minY: minY - pad,
      maxX: maxX + pad,
      maxY: maxY + pad,
      width: maxX - minX + 2 * pad,
      height: maxY - minY + 2 * pad
    };
  }

  /**
   * Check if node is visible in viewport
   */
  isNodeVisible(node, viewport) {
    if (!node || !viewport) return false;
    
    const margin = 60; // Node rendering margin
    return !(
      node.x + (node.width || node.radius || 0) + margin < viewport.minX ||
      node.x - (node.width || node.radius || 0) - margin > viewport.maxX ||
      node.y + (node.height || node.radius || 0) + margin < viewport.minY ||
      node.y - (node.height || node.radius || 0) - margin > viewport.maxY
    );
  }

  /**
   * Check if a line/peering is visible
   */
  isLineVisible(x1, y1, x2, y2, viewport) {
    if (!viewport) return true;
    
    // Line is visible if either endpoint is in viewport or line crosses viewport
    const margin = 20;
    const lineMinX = Math.min(x1, x2) - margin;
    const lineMaxX = Math.max(x1, x2) + margin;
    const lineMinY = Math.min(y1, y2) - margin;
    const lineMaxY = Math.max(y1, y2) + margin;
    
    return !(
      lineMaxX < viewport.minX ||
      lineMinX > viewport.maxX ||
      lineMaxY < viewport.minY ||
      lineMinY > viewport.maxY
    );
  }

  /**
   * Filter nodes by viewport visibility
   */
  filterVisibleNodes(nodes, viewport) {
    if (!viewport || nodes.length < this.MIN_NODES_FOR_CULLING) return nodes; // Skip filtering for small datasets
    return nodes.filter(n => this.isNodeVisible(n, viewport));
  }

  /**
   * Calculate approximate bounds for a set of nodes
   */
  calculateBounds(nodes) {
    if (!nodes || nodes.length === 0) return null;
    
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    nodes.forEach(n => {
      const w = (n.width || n.radius || 0) / 2;
      const h = (n.height || n.radius || 0) / 2;
      minX = Math.min(minX, n.x - w);
      minY = Math.min(minY, n.y - h);
      maxX = Math.max(maxX, n.x + w);
      maxY = Math.max(maxY, n.y + h);
    });
    
    return { minX, minY, maxX, maxY, width: maxX - minX, height: maxY - minY };
  }
}

export class PeeringCache {
  constructor() {
    this.cache = new Map();
    this.maxCacheSize = 500; // Maximum number of cached peering paths
    this.maxZoomForDetail = 0.8; // Only show detail labels at this zoom level or higher
  }

  /**
   * Get or create cached peering path
   */
  getPath(key, x1, y1, x2, y2, layout) {
    const cacheKey = `${key}:${layout}`;
    if (this.cache.has(cacheKey)) {
      return this.cache.get(cacheKey);
    }

    const path = {
      key,
      x1, y1, x2, y2,
      midX: (x1 + x2) / 2,
      midY: (y1 + y2) / 2,
      layout,
      calculated: true
    };

    if (this.cache.size < this.maxCacheSize) {
      this.cache.set(cacheKey, path);
    }

    return path;
  }

  /**
   * Check if peering should show detail at current zoom level
   */
  shouldShowDetail(scale) {
    return scale >= this.maxZoomForDetail;
  }

  /**
   * Clear cache
   */
  clear() {
    this.cache.clear();
  }

  /**
   * Get cache stats
   */
  getStats() {
    return {
      size: this.cache.size,
      maxSize: this.maxCacheSize
    };
  }
}
