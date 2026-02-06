import { gridToCanvasFactor } from "./index.js";

export class Animator {
  constructor() {
    this.activePath = null;
    this.segments = [];
    this.totalLength = 0;
    this.speed = 0;
    this.distanceTravelled = 0;
    this.lastTStamp = null;
    this.isPaused = false;
    this.planeEl = null;
    this.glyphEl = null;
    this.currentX = null;
    this.currentY = null;
    this.prevX = null;
    this.prevY = null;
  }

  startPath(planeEl, pathGrid, speedPixelsPerSec) {
    if (!planeEl || !Array.isArray(pathGrid) || pathGrid.length < 2) {
      return;
    }

    this.planeEl = planeEl;
    this.glyphEl = planeEl.querySelector(".plane-glyph") || planeEl;
    this.speed = Math.max(1, speedPixelsPerSec || 1);
    this.distanceTravelled = 0;
    this.lastTStamp = null;
    this.isPaused = false;
    this.totalLength = 0;
    this.segments = [];

    const points = pathGrid.map(([gx, gy]) => ({
      x: (gx + 0.5) * gridToCanvasFactor,
      y: (gy + 0.5) * gridToCanvasFactor,
    }));

    for (let i = 0; i < points.length - 1; i++) {
      const a = points[i];
      const b = points[i + 1];
      const dx = b.x - a.x;
      const dy = b.y - a.y;
      const length = Math.hypot(dx, dy);
      this.segments.push({ a, b, dx, dy, length });
      this.totalLength += length;
    }

    this.activePath = { points };

    // Initialize plane position at the start.
    planeEl.style.left = `${points[0].x}px`;
    planeEl.style.top = `${points[0].y}px`;
    this.currentX = points[0].x;
    this.currentY = points[0].y;
    this.prevX = points[0].x;
    this.prevY = points[0].y;
  }

  runAnimation(tStamp, timeScale = 1) {
    if (!this.activePath || this.totalLength === 0 || this.isPaused) {
      return;
    }

    if (this.lastTStamp === null) {
      this.lastTStamp = tStamp;
    }

    const deltaSeconds = Math.max(0, (tStamp - this.lastTStamp) / 1000);
    this.lastTStamp = tStamp;
    this.distanceTravelled += deltaSeconds * this.speed * Math.max(1, timeScale);
    this.prevX = this.currentX;
    this.prevY = this.currentY;

    if (this.distanceTravelled >= this.totalLength) {
      const last = this.segments[this.segments.length - 1].b;
      this.planeEl.style.left = `${last.x}px`;
      this.planeEl.style.top = `${last.y}px`;
      this.currentX = last.x;
      this.currentY = last.y;
      this.activePath = null;
      return;
    }

    let travelled = 0;
    for (const segment of this.segments) {
      if (travelled + segment.length >= this.distanceTravelled) {
        const remaining = this.distanceTravelled - travelled;
        const t = segment.length === 0 ? 0 : remaining / segment.length;
        const x = segment.a.x + segment.dx * t;
        const y = segment.a.y + segment.dy * t;
        const angle = Math.atan2(segment.dy, segment.dx);
        this.planeEl.style.left = `${x}px`;
        this.planeEl.style.top = `${y}px`;
        this.currentX = x;
        this.currentY = y;
        this.glyphEl.style.setProperty(
          "--heading",
          `${(angle * 180) / Math.PI}deg`
        );
        break;
      }
      travelled += segment.length;
    }
  }

  pause(tStamp) {
    if (!this.activePath || this.isPaused) return;
    this.isPaused = true;
  }

  resume(tStamp) {
    if (!this.activePath || !this.isPaused) return;
    this.lastTStamp = tStamp ?? performance.now();
    this.isPaused = false;
  }

  stop() {
    this.activePath = null;
    this.segments = [];
    this.totalLength = 0;
    this.speed = 0;
    this.distanceTravelled = 0;
    this.lastTStamp = null;
    this.isPaused = false;
  }

  getPosition() {
    if (this.currentX === null || this.currentY === null) return null;
    return { x: this.currentX, y: this.currentY };
  }

  getMotionSegment() {
    if (
      this.prevX === null ||
      this.prevY === null ||
      this.currentX === null ||
      this.currentY === null
    ) {
      return null;
    }
    return {
      ax: this.prevX,
      ay: this.prevY,
      bx: this.currentX,
      by: this.currentY,
    };
  }

  isActive() {
    return this.activePath !== null;
  }
}
