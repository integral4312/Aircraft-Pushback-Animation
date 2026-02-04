import { gridToCanvasFactor } from "./index.js";

export class Animator {
  constructor() {
    this.activePath = null;
    this.segments = [];
    this.totalLength = 0;
    this.speed = 0;
    this.startTime = null;
    this.planeEl = null;
    this.glyphEl = null;
  }

  startPath(planeEl, pathGrid, speedPixelsPerSec) {
    if (!planeEl || !Array.isArray(pathGrid) || pathGrid.length < 2) {
      return;
    }

    this.planeEl = planeEl;
    this.glyphEl = planeEl.querySelector(".plane-glyph") || planeEl;
    this.speed = Math.max(1, speedPixelsPerSec || 1);
    this.startTime = null;
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
  }

  runAnimation(tStamp) {
    if (!this.activePath || this.totalLength === 0) {
      return;
    }

    if (this.startTime === null) {
      this.startTime = tStamp;
    }

    const elapsedSeconds = (tStamp - this.startTime) / 1000;
    let distance = elapsedSeconds * this.speed;

    if (distance >= this.totalLength) {
      const last = this.segments[this.segments.length - 1].b;
      this.planeEl.style.left = `${last.x}px`;
      this.planeEl.style.top = `${last.y}px`;
      this.activePath = null;
      return;
    }

    let travelled = 0;
    for (const segment of this.segments) {
      if (travelled + segment.length >= distance) {
        const remaining = distance - travelled;
        const t = segment.length === 0 ? 0 : remaining / segment.length;
        const x = segment.a.x + segment.dx * t;
        const y = segment.a.y + segment.dy * t;
        const angle = Math.atan2(segment.dy, segment.dx);
        this.planeEl.style.left = `${x}px`;
        this.planeEl.style.top = `${y}px`;
        this.glyphEl.style.setProperty(
          "--heading",
          `${(angle * 180) / Math.PI}deg`
        );
        break;
      }
      travelled += segment.length;
    }
  }
}
