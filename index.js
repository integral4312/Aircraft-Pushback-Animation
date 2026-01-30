import { dataReady, flightData } from "./data.js";
import { Node, Grid, PathHandler } from "./grid.js";
import { Animator } from "./animation.js";

// Load the canvas and get the context of the canvas for drawing
const canvas = document.getElementById("mapCanvas");
const ctx = canvas.getContext("2d");

const plane = document.getElementById("plane");

// Array holding the grid of nodes for the algorithm
const grid = new Grid(300, canvas);
export const gridToCanvasFactor = canvas.width / grid.size;

// Animator class
const animator = new Animator();

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
  { flightNumber: "7142", stationTime: "12/10/25 8:00:00", start: 0, end: 2 },
  /*{ flightNumber: "1452", stationTime: "12/10/25 8:00:00", start: 1, end: 1 },
  { flightNumber: "6789", stationTime: "12/10/25 8:00:00", start: 1, end: 0 },*/
];

applyPathfinding(flights);

let mouse = { x: 0, y: 0 };

img.onload = () => {
  ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

  markTaxiwaysAsNavigable(grid, ctx);
  drawNavigableOverlay(grid, ctx);

  // OPTIONAL: auto-start the first flight once map is ready
  // applyPathfinding(flights);
};

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

function applyPathfinding(currentFlights) {
  for (let flight of currentFlights) {
    const pathFinder = new PathHandler(grid);

    const startNode =
      grid.grid[gateCoordinates[flight.start].x][
        gateCoordinates[flight.start].y
      ];

    const endNode =
      grid.grid[startupLocations[flight.end].x][startupLocations[flight.end].y];

    const pathNodes = pathFinder.aStar(startNode, endNode);

    if (!pathNodes || pathNodes.length < 2) {
      console.warn("No path returned from A*.", pathNodes);
      return;
    }

    // ✅ Keep in GRID coords: [[x,y],...]
    const pathGrid =
      Array.isArray(pathNodes[0]) ? pathNodes : pathNodes.map((n) => [n.x, n.y]);

    animator.startPath(plane, pathGrid, 140);
    break; // animate first flight only for now
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
  animator.runAnimation(tStamp);
  requestAnimationFrame(runAnimation);
}
requestAnimationFrame(runAnimation);
