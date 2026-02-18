const fileInput = document.getElementById("fileInput");
fileInput.addEventListener("change", handleFile);

// Variables that are exported 
export let flightData = [];
export let dataReady = null;
const GATE_COUNT = 25;
const STARTUP_COUNT = 6;
const SPACED_GATE_ORDER = [
    2, 11, 20, 4, 15, 23, 0, 9, 18, 6, 13, 21, 1, 8, 24, 3, 12, 19, 5, 16, 22,
    7, 14, 17, 10,
];
const STARTUP_DIRECTION_ORDER = [0, 3, 5, 1, 4, 2];

function normalizeCell(cell) {
    if (cell === null || cell === undefined) return "";
    return String(cell).trim();
}

function parseStationTimeMs(cell) {
    if (cell instanceof Date && Number.isFinite(cell.getTime())) {
        return cell.getTime();
    }

    // Excel date serial number (days since 1899-12-30).
    if (typeof cell === "number" && Number.isFinite(cell)) {
        return Math.round((cell - 25569) * 86400 * 1000);
    }

    const raw = normalizeCell(cell);
    if (!raw) return null;

    const parsed = Date.parse(raw);
    if (Number.isFinite(parsed)) return parsed;

    const match = raw.match(
        /^(\d{1,2})\/(\d{1,2})\/(\d{2,4})\s+(\d{1,2}):(\d{2})(?::(\d{2}))?\s*(AM|PM)?$/i
    );
    if (!match) return null;

    const month = Number(match[1]);
    const day = Number(match[2]);
    const yearRaw = Number(match[3]);
    let hour = Number(match[4]);
    const minute = Number(match[5]);
    const second = match[6] ? Number(match[6]) : 0;
    const meridiem = (match[7] || "").toUpperCase();

    const year = yearRaw < 100 ? 2000 + yearRaw : yearRaw;
    if (meridiem === "PM" && hour < 12) hour += 12;
    if (meridiem === "AM" && hour === 12) hour = 0;

    return new Date(year, month - 1, day, hour, minute, second).getTime();
}

function formatStationTime(ms) {
    const date = new Date(ms);
    const month = date.getMonth() + 1;
    const day = date.getDate();
    const year = date.getFullYear();
    const hour24 = date.getHours();
    const hour12 = hour24 % 12 || 12;
    const minute = String(date.getMinutes()).padStart(2, "0");
    const second = String(date.getSeconds()).padStart(2, "0");
    const meridiem = hour24 >= 12 ? "PM" : "AM";
    return `${month}/${day}/${year} ${hour12}:${minute}:${second} ${meridiem}`;
}

export function compileFlightsFromRows(rows) {
    const parsedFlights = [];
    const firstCell = normalizeCell(rows?.[0]?.[0]).toLowerCase();
    const isHeaderByRowLayout = firstCell === "station operation type";

    if (isHeaderByRowLayout) {
        for (let i = 1; i < rows.length; i++) {
            const row = rows[i];
            if (!row) continue;

            const operationType = normalizeCell(row[0]);
            if (operationType.toLowerCase() !== "dep") continue;

            const flightNumber = normalizeCell(row[2]);
            const stationMs = parseStationTimeMs(row[3]);
            if (!flightNumber || stationMs === null) continue;

            parsedFlights.push({
                operationType: "Dep",
                flightNumber,
                stationMs,
            });
        }
    } else {
        // Backward compatibility for older row-oriented extraction mode.
        const operationRow = rows[0] || [];
        const flightNumberRow = rows[2] || [];
        const stationTimeRow = rows[3] || [];
        const maxCols = Math.max(
            operationRow.length,
            flightNumberRow.length,
            stationTimeRow.length
        );

        for (let col = 1; col < maxCols; col++) {
            const operationType = normalizeCell(operationRow[col]);
            if (operationType.toLowerCase() !== "dep") continue;

            const flightNumber = normalizeCell(flightNumberRow[col]);
            const stationMs = parseStationTimeMs(stationTimeRow[col]);
            if (!flightNumber || stationMs === null) continue;

            parsedFlights.push({
                operationType: "Dep",
                flightNumber,
                stationMs,
            });
        }
    }

    parsedFlights.sort((a, b) => a.stationMs - b.stationMs);

    let gateCursor = 0;
    let startupCursor = 0;
    let burstOffset = 0;
    let previousStationMs = Number.NaN;

    const compiledFlights = parsedFlights.map((flight) => {
        if (flight.stationMs === previousStationMs) {
            burstOffset += 1;
        } else {
            previousStationMs = flight.stationMs;
            burstOffset = 0;
        }

        const gateIndex =
            SPACED_GATE_ORDER[(gateCursor + burstOffset) % SPACED_GATE_ORDER.length];
        const startupIndex =
            STARTUP_DIRECTION_ORDER[
                (startupCursor + burstOffset * 2) % STARTUP_DIRECTION_ORDER.length
            ];

        gateCursor = (gateCursor + 1) % GATE_COUNT;
        startupCursor = (startupCursor + 1) % STARTUP_COUNT;

        return {
            flightNumber: flight.flightNumber,
            stationTime: formatStationTime(flight.stationMs),
            start: gateIndex,
            end: startupIndex,
        };
    });

    return compiledFlights;
}

// Function for fetching the data from the spreadsheet
function handleFile(event) {
    const file = event.target.files[0];
    if (!file) return;

    // Create a new instance of the FileReader class
    const reader = new FileReader();

    // Create a promise in order to fetch the data for the algorithm
    dataReady = new Promise((resolve, reject) => {
        // When the file reader loads, read the file and sort flight data based on time and departure/arrival
        reader.onload = function (e) {
            const fileData = new Uint8Array(e.target.result);
            const workbook = XLSX.read(fileData, { type: "array" });
            const sheet = workbook.Sheets[workbook.SheetNames[0]];
            const rows = XLSX.utils.sheet_to_json(sheet, { header: 1 });
            const flights = compileFlightsFromRows(rows);

            flightData.length = 0;
            flightData.push(...flights);
            console.log("Compiled flightData:", flightData);

            resolve(flightData);
        };

        // Handle an error and use the reader to call the function from above
        reader.onerror = reject;
        reader.readAsArrayBuffer(file);
    });
}
