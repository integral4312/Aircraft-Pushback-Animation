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

// Array holding the grid of nodes for the algorithm
const grid = new Grid(300, canvas);
export const gridToCanvasFactor = canvas.width / grid.size;

// Animator class
const animators = planeElements.map((planeEl) => ({
  planeEl,
  animator: new Animator(),
}));

for (let i = 0; i < animators.length; i++) {
  const glyph = animators[i].planeEl.querySelector(".plane-glyph");
  if (glyph) glyph.style.filter = `hue-rotate(${(i * 27) % 360}deg)`;
}

// Load the airport map to the canvas
const img = new Image();
img.src = "./fll_final_copy2.jpg";

// Get the coordinates (in grid coordinates, on the canvas) for the gates used by JetBlue
const gateCoordinates = [
  { id: "E1", x: 137, y: 93 },
  { id: "E2", x: 130, y: 114 },
  { id: "E4", x: 120, y: 105 },
  { id: "E6", x: 108, y: 100 },
  { id: "E8", x: 101, y: 94 },
  { id: "E9", x: 95, y: 80 },
  { id: "E10", x: 90, y: 87 },

  { id: "F1", x: 126, y: 135 },
  { id: "F2", x: 137, y: 183 },
  { id: "F3", x: 117, y: 154 },
  { id: "F4", x: 123, y: 179 },
  { id: "F5", x: 106, y: 154 },
  { id: "F6", x: 113, y: 179 },
  { id: "F7", x: 96, y: 157 },
  { id: "F8", x: 103, y: 179 },
  { id: "F9", x: 90, y: 161 },
  { id: "F10", x: 93, y: 173 },

  { id: "G5", x: 224, y: 234 },
  { id: "G6", x: 212, y: 234 },
  { id: "G7", x: 200, y: 236 },
  { id: "G8", x: 191, y: 235 },
  { id: "G9", x: 175, y: 235 },
  { id: "G10", x: 164, y: 236 },
];

const startupLocations = [
  { id: "9", x: 66, y: 110 },
  { id: "10", x: 67, y: 151 },
  { id: "bravo", x: 88, y: 130 },
  { id: "11", x: 127, y: 203 },
  { id: "charlie", x: 62, y: 62 },
  { id: "delta", x: 173, y: 278 },
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
];

let mouse = { x: 0, y: 0 };

img.onload = () => {
  ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

  markTaxiwaysAsNavigable(grid, ctx);
  drawNavigableOverlay(grid, ctx);

  // Auto-start after navigable tiles are computed from the map.
  applyPathfinding(flights);
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
  const idx = Math.round(((deg % 360) / 45)) % 8;
  return directions[idx];
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
          grid.tileSize
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

function applyPathfinding(currentFlights) {
  for (let i = 0; i < currentFlights.length; i++) {
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
      requestedStart.y
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
    const pathGrid =
      Array.isArray(pathNodes[0]) ? pathNodes : pathNodes.map((n) => [n.x, n.y]);

    const hasNonNavigableStep = pathGrid.some(
      ([x, y]) => !grid.grid[x] || !grid.grid[x][y] || !grid.grid[x][y].navigable
    );

    if (hasNonNavigableStep) {
      console.warn("Path contains non-navigable nodes; aborting animation.");
      continue;
    }

    slot.animator.startPath(slot.planeEl, pathGrid, 140);
  }
}

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
    mouse.y + offset + 15
  );
  ctx.fillText(
    `y: ${mouse.y.toFixed(0)}`,
    mouse.x + offset + 5,
    mouse.y + offset + 28
  );
}

canvas.addEventListener("click", (e) => {
  const rect = canvas.getBoundingClientRect();
  mouse.x = e.clientX - rect.left;
  mouse.y = e.clientY - rect.top;
  //drawMouseOverlay();

  console.log(
    Math.round(mouse.x / gridToCanvasFactor),
    Math.round(mouse.y / gridToCanvasFactor)
  );
});

function runAnimation(tStamp) {
  for (const slot of animators) {
    slot.animator.runAnimation(tStamp);
  }
  requestAnimationFrame(runAnimation);
}
requestAnimationFrame(runAnimation);
