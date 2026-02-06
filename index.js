import { dataReady, flightData } from "./data.js";
import { Node, Grid, PathHandler } from "./grid.js";
import { Animator } from "./animation.js";

// Load the canvas and get the context of the canvas for drawing
const canvas = document.getElementById("mapCanvas");
const ctx = canvas.getContext("2d");

const planeElements = Array.from(document.querySelectorAll(".plane-icon"));
const weatherStatus = document.getElementById("weatherStatus");
const wxTemp = document.getElementById("wxTemp");
const wxWind = document.getElementById("wxWind");
const wxHumidity = document.getElementById("wxHumidity");
const wxPressure = document.getElementById("wxPressure");
const mapContainer = document.querySelector(".map-container");
const collisionWarning = document.getElementById("collisionWarning");
const startBtn = document.querySelector(".start");
const pauseBtn = document.querySelector(".pause");
const resetBtn = document.querySelector(".reset");
const emergencyBtn = document.querySelector(".emergency");
const timeScaleDownBtn = document.getElementById("timeScaleDown");
const timeScaleUpBtn = document.getElementById("timeScaleUp");
const timeScaleValue = document.getElementById("timeScaleValue");
const simClockValue = document.getElementById("simClockValue");

// Array holding the grid of nodes for the algorithm
const grid = new Grid(1000, canvas);
export const gridToCanvasFactor = canvas.width / grid.size;

// Animator class
const animators = planeElements.map((planeEl) => ({
  planeEl,
  animator: new Animator(),
  flightNumber: null,
  collisionStopped: false,
}));

let mapReady = false;
let isPaused = false;
const collisionPairs = new Set();
const collisionDots = [];
const COLLISION_DISTANCE_PX = 28;
const TAXI_SPEED_KTS = 20;
const KTS_TO_MPS = 0.514444;
const TAXI_SPEED_PX_PER_SIM_SEC = metersToPixels(TAXI_SPEED_KTS * KTS_TO_MPS);
const MAX_TIME_SCALE = 300;
let timeScale = 1;
let simClockMs = Number.NaN;
let simClockLastTs = null;
let flightSchedule = [];
let simulationActive = false;

for (let i = 0; i < animators.length; i++) {
  const glyph = animators[i].planeEl.querySelector(".plane-glyph");
  if (glyph) glyph.style.filter = `hue-rotate(${(i * 27) % 360}deg)`;
  animators[i].planeEl.style.display = "none";
}

// Load the airport map to the canvas
const img = new Image();
img.src = "./fll_final_copy2.jpg";

// Get the coordinates (in grid coordinates, on the canvas) for the gates used by JetBlue
const gateCoordinates = [
  { id: "E1", x: 457, y: 310 },
  { id: "E2", x: 433, y: 380 },
  { id: "E4", x: 400, y: 350 },
  { id: "E6", x: 360, y: 333 },
  { id: "E8", x: 337, y: 313 },
  { id: "E9", x: 317, y: 267 },
  { id: "E10", x: 300, y: 290 },

  { id: "F1", x: 420, y: 450 },
  { id: "F2", x: 457, y: 610 },
  { id: "F3", x: 390, y: 513 },
  { id: "F4", x: 410, y: 597 },
  { id: "F5", x: 353, y: 513 },
  { id: "F6", x: 377, y: 597 },
  { id: "F7", x: 320, y: 523 },
  { id: "F8", x: 343, y: 597 },
  { id: "F9", x: 300, y: 537 },
  { id: "F10", x: 310, y: 577 },

  { id: "G5", x: 747, y: 780 },
  { id: "G6", x: 707, y: 780 },
  { id: "G7", x: 667, y: 787 },
  { id: "G8", x: 637, y: 783 },
  { id: "G9", x: 583, y: 783 },
  { id: "G10", x: 547, y: 787 },
];

const startupLocations = [
  { id: "9", x: 220, y: 367 },
  { id: "10", x: 223, y: 503 },
  { id: "bravo", x: 293, y: 433 },
  { id: "11", x: 423, y: 677 },
  { id: "charlie", x: 207, y: 207 },
  { id: "delta", x: 577, y: 927 },
];

const flights = [
  // Existing baseline scenarios
  { flightNumber: "7142", stationTime: "12/10/25 8:00:00", start: 0, end: 0 },
  { flightNumber: "1452", stationTime: "12/10/25 8:00:00", start: 1, end: 1 },

  // 10 additional mixed pushback/taxi scenarios
  { flightNumber: "6789", stationTime: "12/10/25 8:03:00", start: 2, end: 2 },
  { flightNumber: "2210", stationTime: "12/10/25 8:05:30", start: 3, end: 0 },
  { flightNumber: "3307", stationTime: "12/10/25 8:08:00", start: 4, end: 3 },
  { flightNumber: "4126", stationTime: "12/10/25 8:10:30", start: 5, end: 1 },
  { flightNumber: "5094", stationTime: "12/10/25 8:13:00", start: 6, end: 4 },
  { flightNumber: "6188", stationTime: "12/10/25 8:15:30", start: 8, end: 5 },
  { flightNumber: "7021", stationTime: "12/10/25 8:18:00", start: 10, end: 2 },
  { flightNumber: "8153", stationTime: "12/10/25 8:20:30", start: 13, end: 0 },
  { flightNumber: "9047", stationTime: "12/10/25 8:23:00", start: 16, end: 3 },
  { flightNumber: "9932", stationTime: "12/10/25 8:25:30", start: 20, end: 1 },

  // 5 additional scenarios
  { flightNumber: "1064", stationTime: "12/10/25 8:28:00", start: 7, end: 4 },
  { flightNumber: "2375", stationTime: "12/10/25 8:30:30", start: 9, end: 2 },
  { flightNumber: "3481", stationTime: "12/10/25 8:33:00", start: 11, end: 5 },
  { flightNumber: "4590", stationTime: "12/10/25 8:35:30", start: 14, end: 1 },
  { flightNumber: "5702", stationTime: "12/10/25 8:38:00", start: 22, end: 0 },
];

let mouse = { x: 0, y: 0 };

img.onload = () => {
  ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

  markTaxiwaysAsNavigable(grid, ctx);
  drawNavigableOverlay(grid, ctx);
  mapReady = true;
};

fetchWeatherAndMetar();
setInterval(fetchWeatherAndMetar, 10 * 60 * 1000);

// Function for running the algorithm and fetching flight data
async function main() {
  if (!dataReady) {
    console.log("Waiting for file upload...");
    return;
  }

  const data = await flightData;
}

// Gets the current time in EST (New_York/America) in the form HH:MM:SS
function currentTimeEST() {
  let now = new Date();
  return `${now.getHours()}:${now.getMinutes()}:${now.getSeconds()}`;
}

function pixelsToMeters(pixels) {
  return pixels * 0.5528125;
}

function metersToPixels(meters) {
  return meters * 1.80893159977;
}

function toCardinal(deg) {
  if (deg === null || deg === undefined || Number.isNaN(deg)) return "—";
  const directions = ["N", "NE", "E", "SE", "S", "SW", "W", "NW"];
  const idx = Math.round((deg % 360) / 45) % 8;
  return directions[idx];
}

function parseStationTime(stationTime) {
  if (!stationTime || typeof stationTime !== "string") return null;
  const [datePart, timePart = "00:00:00"] = stationTime.trim().split(/\s+/);
  if (!datePart) return null;

  const [monthRaw, dayRaw, yearRaw] = datePart.split("/").map((v) => Number(v));
  const [hourRaw, minuteRaw, secondRaw] = timePart
    .split(":")
    .map((v) => Number(v));

  if (
    !Number.isFinite(monthRaw) ||
    !Number.isFinite(dayRaw) ||
    !Number.isFinite(yearRaw)
  ) {
    return null;
  }

  const year = yearRaw < 100 ? 2000 + yearRaw : yearRaw;
  const hour = Number.isFinite(hourRaw) ? hourRaw : 0;
  const minute = Number.isFinite(minuteRaw) ? minuteRaw : 0;
  const second = Number.isFinite(secondRaw) ? secondRaw : 0;
  return new Date(year, monthRaw - 1, dayRaw, hour, minute, second).getTime();
}

function formatSimClock(ms) {
  if (!Number.isFinite(ms)) return "--/--/-- --:--:--";
  const d = new Date(ms);
  const pad = (v) => String(v).padStart(2, "0");
  return `${pad(d.getMonth() + 1)}/${pad(d.getDate())}/${String(
    d.getFullYear(),
  ).slice(-2)} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(
    d.getSeconds(),
  )}`;
}

function updateTimeScaleUI() {
  if (timeScaleValue) timeScaleValue.textContent = `${timeScale}x`;
  if (simClockValue) simClockValue.textContent = formatSimClock(simClockMs);
}

function updateSimClock(tStamp) {
  if (!simulationActive || isPaused) {
    simClockLastTs = tStamp;
    return;
  }

  if (simClockLastTs === null) {
    simClockLastTs = tStamp;
    return;
  }

  const deltaSeconds = Math.max(0, (tStamp - simClockLastTs) / 1000);
  simClockMs += deltaSeconds * 1000 * timeScale;
  simClockLastTs = tStamp;
}

function sqrDistancePointToSegment(px, py, ax, ay, bx, by) {
  const abx = bx - ax;
  const aby = by - ay;
  const apx = px - ax;
  const apy = py - ay;
  const abLenSq = abx * abx + aby * aby;
  if (abLenSq === 0) return apx * apx + apy * apy;
  const t = Math.max(0, Math.min(1, (apx * abx + apy * aby) / abLenSq));
  const cx = ax + abx * t;
  const cy = ay + aby * t;
  const dx = px - cx;
  const dy = py - cy;
  return dx * dx + dy * dy;
}

function segmentIntersectionPoint(segA, segB) {
  const x1 = segA.ax;
  const y1 = segA.ay;
  const x2 = segA.bx;
  const y2 = segA.by;
  const x3 = segB.ax;
  const y3 = segB.ay;
  const x4 = segB.bx;
  const y4 = segB.by;

  const denominator = (x1 - x2) * (y3 - y4) - (y1 - y2) * (x3 - x4);
  if (Math.abs(denominator) < 1e-9) return null;

  const pre = x1 * y2 - y1 * x2;
  const post = x3 * y4 - y3 * x4;
  const px = (pre * (x3 - x4) - (x1 - x2) * post) / denominator;
  const py = (pre * (y3 - y4) - (y1 - y2) * post) / denominator;

  const within = (v, a, b) =>
    v >= Math.min(a, b) - 1e-6 && v <= Math.max(a, b) + 1e-6;
  if (
    within(px, x1, x2) &&
    within(py, y1, y2) &&
    within(px, x3, x4) &&
    within(py, y3, y4)
  ) {
    return { x: px, y: py };
  }

  return null;
}

function minDistanceBetweenSegments(segA, segB) {
  const intersection = segmentIntersectionPoint(segA, segB);
  if (intersection) {
    return { distance: 0, point: intersection };
  }

  const d1 = sqrDistancePointToSegment(
    segA.ax,
    segA.ay,
    segB.ax,
    segB.ay,
    segB.bx,
    segB.by,
  );
  const d2 = sqrDistancePointToSegment(
    segA.bx,
    segA.by,
    segB.ax,
    segB.ay,
    segB.bx,
    segB.by,
  );
  const d3 = sqrDistancePointToSegment(
    segB.ax,
    segB.ay,
    segA.ax,
    segA.ay,
    segA.bx,
    segA.by,
  );
  const d4 = sqrDistancePointToSegment(
    segB.bx,
    segB.by,
    segA.ax,
    segA.ay,
    segA.bx,
    segA.by,
  );
  return { distance: Math.sqrt(Math.min(d1, d2, d3, d4)), point: null };
}

async function fetchWeatherAndMetar() {
  const obsUrl =
    "https://api.weather.gov/stations/KFLL/observations/latest?require_qc=false";

  if (weatherStatus) weatherStatus.textContent = "Loading";

  try {
    const obsRes = await fetch(obsUrl);
    const obsData = await obsRes.json();
    const props = obsData?.properties || {};

    const tempC = props?.temperature?.value;
    const windMs = props?.windSpeed?.value;
    const windDir = props?.windDirection?.value;
    const humidity = props?.relativeHumidity?.value;
    const pressurePa = props?.barometricPressure?.value;

    if (wxTemp) {
      const f = tempC === null || tempC === undefined ? null : tempC * 1.8 + 32;
      wxTemp.textContent = f === null ? "—" : `${Math.round(f)}°F`;
    }
    if (wxWind) {
      const kt =
        windMs === null || windMs === undefined ? null : windMs * 1.94384;
      const dir = toCardinal(windDir);
      wxWind.textContent =
        kt === null ? `— ${dir}` : `${Math.round(kt)} kt ${dir}`;
    }
    if (wxHumidity)
      wxHumidity.textContent =
        humidity === null || humidity === undefined
          ? "—"
          : `${Math.round(humidity)}%`;
    if (wxPressure)
      wxPressure.textContent =
        pressurePa === null || pressurePa === undefined
          ? "—"
          : `${Math.round(pressurePa / 100)} hPa`;
    if (weatherStatus) weatherStatus.textContent = "Live";
  } catch (err) {
    if (wxTemp) wxTemp.textContent = "—";
    if (wxWind) wxWind.textContent = "—";
    if (wxHumidity) wxHumidity.textContent = "—";
    if (wxPressure) wxPressure.textContent = "—";
    if (weatherStatus) weatherStatus.textContent = "Unavailable";
  }
}

function markTaxiwaysAsNavigable(grid, ctx) {
  for (let gx = 0; gx < grid.size; gx++) {
    for (let gy = 0; gy < grid.size; gy++) {
      const px = Math.floor(gx * grid.tileSize + grid.tileSize / 2);
      const py = Math.floor(gy * grid.tileSize + grid.tileSize / 2);

      const p = ctx.getImageData(px, py, 1, 1).data;
      const r = p[0],
        g = p[1],
        b = p[2];

      const isYellow =
        r > 180 && g > 180 && b < 150 && r - b > 60 && g - b > 60;

      grid.grid[gx][gy].navigable = isYellow;
    }
  }
}

function drawNavigableOverlay(grid, ctx) {
  ctx.save();
  ctx.globalAlpha = 0.35;
  ctx.fillStyle = "#00ff00";

  for (let gx = 0; gx < grid.size; gx++) {
    for (let gy = 0; gy < grid.size; gy++) {
      if (grid.grid[gx][gy].navigable) {
        ctx.fillRect(
          gx * grid.tileSize,
          gy * grid.tileSize,
          grid.tileSize,
          grid.tileSize,
        );
      }
    }
  }

  ctx.restore();
}

function nearestNavigableNode(grid, x, y) {
  const maxRadius = grid.size;
  const clampedX = Math.max(0, Math.min(grid.size - 1, x));
  const clampedY = Math.max(0, Math.min(grid.size - 1, y));

  if (grid.grid[clampedX][clampedY].navigable) {
    return grid.grid[clampedX][clampedY];
  }

  for (let radius = 1; radius <= maxRadius; radius++) {
    for (let dx = -radius; dx <= radius; dx++) {
      const x1 = clampedX + dx;
      const yTop = clampedY - radius;
      const yBottom = clampedY + radius;

      if (
        grid.grid[x1] &&
        grid.grid[x1][yTop] &&
        grid.grid[x1][yTop].navigable
      ) {
        return grid.grid[x1][yTop];
      }
      if (
        grid.grid[x1] &&
        grid.grid[x1][yBottom] &&
        grid.grid[x1][yBottom].navigable
      ) {
        return grid.grid[x1][yBottom];
      }
    }

    for (let dy = -radius + 1; dy <= radius - 1; dy++) {
      const y1 = clampedY + dy;
      const xLeft = clampedX - radius;
      const xRight = clampedX + radius;

      if (
        grid.grid[xLeft] &&
        grid.grid[xLeft][y1] &&
        grid.grid[xLeft][y1].navigable
      ) {
        return grid.grid[xLeft][y1];
      }
      if (
        grid.grid[xRight] &&
        grid.grid[xRight][y1] &&
        grid.grid[xRight][y1].navigable
      ) {
        return grid.grid[xRight][y1];
      }
    }
  }

  return null;
}

function buildFlightSchedule(currentFlights) {
  const schedule = [];
  const flightCount = Math.min(currentFlights.length, animators.length);

  if (currentFlights.length > animators.length) {
    console.warn(
      `Only ${animators.length} planes available; scheduling first ${animators.length} flights.`,
    );
  }

  for (const slot of animators) {
    slot.flightNumber = null;
    slot.collisionStopped = false;
  }

  for (let i = 0; i < flightCount; i++) {
    const flight = currentFlights[i];
    const slot = animators[i];

    if (!slot || !slot.planeEl) {
      console.warn("No plane icon available for flight.", flight.flightNumber);
      continue;
    }

    const flightLabel = slot.planeEl.querySelector(".plane-flight-number");
    if (flightLabel) {
      flightLabel.textContent = flight.flightNumber;
    }
    slot.flightNumber = flight.flightNumber;

    const pathFinder = new PathHandler(grid);

    const requestedStart =
      grid.grid[gateCoordinates[flight.start].x][
        gateCoordinates[flight.start].y
      ];

    const requestedEnd =
      grid.grid[startupLocations[flight.end].x][startupLocations[flight.end].y];

    const startNode = nearestNavigableNode(
      grid,
      requestedStart.x,
      requestedStart.y,
    );
    const endNode = nearestNavigableNode(grid, requestedEnd.x, requestedEnd.y);

    if (!startNode || !endNode) {
      console.warn("No navigable start/end node found for flight.", flight);
      continue;
    }

    const pathNodes = pathFinder.aStar(startNode, endNode);

    if (!pathNodes || pathNodes.length < 2) {
      console.warn("No path returned from A*.", pathNodes);
      continue;
    }

    // ✅ Keep in GRID coords: [[x,y],...]
    const pathGrid = Array.isArray(pathNodes[0])
      ? pathNodes
      : pathNodes.map((n) => [n.x, n.y]);

    const hasNonNavigableStep = pathGrid.some(
      ([x, y]) =>
        !grid.grid[x] || !grid.grid[x][y] || !grid.grid[x][y].navigable,
    );

    if (hasNonNavigableStep) {
      console.warn("Path contains non-navigable nodes; aborting animation.");
      continue;
    }

    const stationMs = parseStationTime(flight.stationTime);
    if (stationMs === null) {
      console.warn("Invalid station time; skipping flight.", flight);
      continue;
    }

    slot.planeEl.style.display = "none";
    schedule.push({
      slot,
      pathGrid,
      stationMs,
      started: false,
    });
  }

  schedule.sort((a, b) => a.stationMs - b.stationMs);
  return schedule;
}

function activateScheduledFlights() {
  if (!simulationActive) return;
  for (const entry of flightSchedule) {
    if (entry.started || simClockMs < entry.stationMs) continue;
    entry.slot.planeEl.style.display = "block";
    entry.slot.animator.startPath(
      entry.slot.planeEl,
      entry.pathGrid,
      TAXI_SPEED_PX_PER_SIM_SEC,
    );
    entry.started = true;
  }
}

function stopAllAnimations() {
  for (const slot of animators) {
    slot.animator.stop();
    slot.collisionStopped = false;
    slot.flightNumber = null;
    slot.planeEl.style.display = "none";
    const flightLabel = slot.planeEl.querySelector(".plane-flight-number");
    if (flightLabel) flightLabel.textContent = "----";
  }
  simulationActive = false;
  flightSchedule = [];
}

function clearCollisionVisuals() {
  collisionPairs.clear();
  for (const dot of collisionDots) {
    dot.remove();
  }
  collisionDots.length = 0;
  if (collisionWarning) {
    collisionWarning.classList.remove("active");
    collisionWarning.textContent = "Collision Warning";
  }
}

function raiseCollisionAlert(flightA, flightB, x, y) {
  if (mapContainer) {
    const dot = document.createElement("div");
    dot.className = "incursion-dot";
    dot.style.left = `${x}px`;
    dot.style.top = `${y}px`;
    mapContainer.appendChild(dot);
    collisionDots.push(dot);
  }

  if (collisionWarning) {
    collisionWarning.classList.add("active");
    collisionWarning.textContent = `Collision Warning: ${flightA} / ${flightB}`;
  }
}

function detectAndHandleCollisions(tStamp) {
  const isVisible = (slot) => slot.planeEl.style.display !== "none";

  for (let i = 0; i < animators.length; i++) {
    const a = animators[i];
    if (!isVisible(a)) continue;
    const posA = a.animator.getPosition();
    if (!posA) continue;

    for (let j = i + 1; j < animators.length; j++) {
      const b = animators[j];
      if (!isVisible(b)) continue;
      const posB = b.animator.getPosition();
      if (!posB) continue;

      const pairKey = `${i}-${j}`;
      if (collisionPairs.has(pairKey)) continue;

      const distance = Math.hypot(posA.x - posB.x, posA.y - posB.y);
      const segA = a.animator.getMotionSegment();
      const segB = b.animator.getMotionSegment();
      const sweptResult =
        segA && segB
          ? minDistanceBetweenSegments(segA, segB)
          : { distance, point: null };
      const minDistance = Math.min(distance, sweptResult.distance);
      if (minDistance > COLLISION_DISTANCE_PX) continue;

      if (a.animator.isActive() && !a.collisionStopped) {
        a.animator.pause(tStamp);
        a.collisionStopped = true;
      }
      if (b.animator.isActive() && !b.collisionStopped) {
        b.animator.pause(tStamp);
        b.collisionStopped = true;
      }
      collisionPairs.add(pairKey);

      const hitX = sweptResult.point
        ? sweptResult.point.x
        : (posA.x + posB.x) / 2;
      const hitY = sweptResult.point
        ? sweptResult.point.y
        : (posA.y + posB.y) / 2;
      raiseCollisionAlert(
        a.flightNumber || "Unknown",
        b.flightNumber || "Unknown",
        hitX,
        hitY,
      );
    }
  }
}

function startAllFlights() {
  if (!mapReady) {
    console.warn("Map is still loading, please try Start again.");
    return;
  }
  stopAllAnimations();
  clearCollisionVisuals();
  flightSchedule = buildFlightSchedule(flights);
  if (flightSchedule.length === 0) {
    console.warn("No valid flights available for simulation.");
    updateTimeScaleUI();
    return;
  }

  simClockMs = flightSchedule[0].stationMs;
  simClockLastTs = performance.now();
  simulationActive = true;
  isPaused = false;
  if (pauseBtn) pauseBtn.textContent = "⏸️ Pause";
  updateTimeScaleUI();
}

if (startBtn) {
  startBtn.addEventListener("click", () => {
    startAllFlights();
  });
}

if (pauseBtn) {
  pauseBtn.addEventListener("click", () => {
    const now = performance.now();
    if (!isPaused) {
      for (const slot of animators) {
        if (slot.collisionStopped) continue;
        slot.animator.pause(now);
      }
      isPaused = true;
      simClockLastTs = now;
      pauseBtn.textContent = "▶️ Resume";
      return;
    }

    for (const slot of animators) {
      if (slot.collisionStopped) continue;
      slot.animator.resume(now);
    }
    isPaused = false;
    simClockLastTs = now;
    pauseBtn.textContent = "⏸️ Pause";
  });
}

if (resetBtn) {
  resetBtn.addEventListener("click", () => {
    startAllFlights();
  });
}

if (emergencyBtn) {
  emergencyBtn.addEventListener("click", () => {
    stopAllAnimations();
    clearCollisionVisuals();
    isPaused = false;
    simClockMs = Number.NaN;
    simClockLastTs = null;
    if (pauseBtn) pauseBtn.textContent = "⏸️ Pause";
    updateTimeScaleUI();
  });
}

if (timeScaleDownBtn) {
  timeScaleDownBtn.addEventListener("click", () => {
    timeScale = Math.max(1, timeScale - 1);
    updateTimeScaleUI();
  });
}

if (timeScaleUpBtn) {
  timeScaleUpBtn.addEventListener("click", () => {
    timeScale = Math.min(MAX_TIME_SCALE, timeScale + 1);
    updateTimeScaleUI();
  });
}

updateTimeScaleUI();

function drawMouseOverlay() {
  const boxWidth = 90;
  const boxHeight = 35;
  const offset = 0;

  ctx.fillStyle = "rgba(255, 255, 255, 0.8)";
  ctx.fillRect(mouse.x + offset, mouse.y + offset, boxWidth, boxHeight);

  ctx.strokeStyle = "black";
  ctx.strokeRect(mouse.x + offset, mouse.y + offset, boxWidth, boxHeight);

  ctx.fillStyle = "black";
  ctx.font = "12px monospace";
  ctx.fillText(
    `x: ${mouse.x.toFixed(0)}`,
    mouse.x + offset + 5,
    mouse.y + offset + 15,
  );
  ctx.fillText(
    `y: ${mouse.y.toFixed(0)}`,
    mouse.x + offset + 5,
    mouse.y + offset + 28,
  );
}

canvas.addEventListener("click", (e) => {
  const rect = canvas.getBoundingClientRect();
  mouse.x = e.clientX - rect.left;
  mouse.y = e.clientY - rect.top;
  //drawMouseOverlay();

  console.log(
    Math.round(mouse.x / gridToCanvasFactor),
    Math.round(mouse.y / gridToCanvasFactor),
  );
});

function runAnimation(tStamp) {
  updateSimClock(tStamp);
  activateScheduledFlights();
  detectAndHandleCollisions(tStamp);

  for (const slot of animators) {
    slot.animator.runAnimation(tStamp, timeScale);
  }
  detectAndHandleCollisions(tStamp);
  updateTimeScaleUI();
  requestAnimationFrame(runAnimation);
}
requestAnimationFrame(runAnimation);
