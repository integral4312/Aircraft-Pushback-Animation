import { gridToCanvasFactor } from "./index.js";

const AIRCRAFT_HEADING_OFFSET_DEG = 90;
const HEADING_LOOKAHEAD_PX = 16;

function normalizeDegrees(deg) {
  return ((deg % 360) + 360) % 360;
}

function angleBetweenPoints(a, b) {
  return (Math.atan2(b.y - a.y, b.x - a.x) * 180) / Math.PI;
}

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
    this.points = [];
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
    this.points = points;

    // Initialize plane position at the start.
    planeEl.style.left = `${points[0].x}px`;
    planeEl.style.top = `${points[0].y}px`;
    this.currentX = points[0].x;
    this.currentY = points[0].y;
    this.prevX = points[0].x;
    this.prevY = points[0].y;

    if (this.segments.length > 0) {
      this.glyphEl.style.setProperty(
        "--heading",
        `${this.getDisplayHeading(0)}deg`
      );
    }
  }

  pointAtDistance(distance) {
    if (!Array.isArray(this.points) || this.points.length === 0) return null;
    if (!Array.isArray(this.segments) || this.segments.length === 0) {
      return this.points[0];
    }

    const clampedDistance = Math.max(0, Math.min(distance, this.totalLength));
    let traversed = 0;
    for (const segment of this.segments) {
      if (traversed + segment.length >= clampedDistance) {
        const offset = clampedDistance - traversed;
        const t = segment.length === 0 ? 0 : offset / segment.length;
        return {
          x: segment.a.x + segment.dx * t,
          y: segment.a.y + segment.dy * t,
        };
      }
      traversed += segment.length;
    }

    return this.points[this.points.length - 1];
  }

  getDisplayHeading(distance) {
    const from = this.pointAtDistance(Math.max(0, distance - HEADING_LOOKAHEAD_PX));
    const to = this.pointAtDistance(
      Math.min(this.totalLength, distance + HEADING_LOOKAHEAD_PX),
    );
    if (!from || !to) return AIRCRAFT_HEADING_OFFSET_DEG;
    return normalizeDegrees(angleBetweenPoints(from, to) + AIRCRAFT_HEADING_OFFSET_DEG);
  }

  runAnimation(tStamp, timeScale = 1) {
    if (!this.activePath || this.totalLength === 0 || this.isPaused) {
      return false;
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
      return true;
    }

    let travelled = 0;
    for (const segment of this.segments) {
      if (travelled + segment.length >= this.distanceTravelled) {
        const remaining = this.distanceTravelled - travelled;
        const t = segment.length === 0 ? 0 : remaining / segment.length;
        const x = segment.a.x + segment.dx * t;
        const y = segment.a.y + segment.dy * t;
        this.planeEl.style.left = `${x}px`;
        this.planeEl.style.top = `${y}px`;
        this.currentX = x;
        this.currentY = y;
        this.glyphEl.style.setProperty(
          "--heading",
          `${this.getDisplayHeading(this.distanceTravelled)}deg`
        );
        break;
      }
      travelled += segment.length;
    }
    return false;
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
    this.points = [];
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
