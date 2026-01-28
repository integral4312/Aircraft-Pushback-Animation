const fileInput = document.getElementById("fileInput");
fileInput.addEventListener("change", handleFile);

// Variables that are exported 
export let flightData = [];
export let dataReady = null;

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

            let flights = [];
            for (let i = 1; i < rows.length; i++) {
                const row = rows[i];
                if (!row) continue;

                if (row[0] === "Dep" && row[1] === time().today) {
                    flights.push({
                        flightNum: row[2],
                        stationTime: row[3],
                    });
                }
            }

            flightData.length = 0;
            flightData.push(...flights);
            console.log("flightData:", flightData);

            resolve(flightData);
        };

        // Handle an error and use the reader to call the function from above
        reader.onerror = reject;
        reader.readAsArrayBuffer(file);
    });
}

// Function for returning the current time/date (today, the hour, the minute, and current time in HH:MM {meridiem})
function time() {
    let now = new Date();

    const options = {
        hour: "numeric",
        hourCycle: "h12",
        timeZone: "America/New_York",
    };

    let today = now.toLocaleDateString("en-US", { timeZone: "America/New_York"});
    let h = new Intl.DateTimeFormat("en-US", options).format(now);

    options.hourCycle = "h23";
    let mh = new Intl.DateTimeFormat("en-US", options).format(now);

    let hourNow = parseInt(h, 10);
    let meridiem = mh >= 12 ? "PM" : "AM";

    const minuteOptions = {
        minute: "2-digit",
        timeZone: "America/New_York",
    };

    let m = new Intl.DateTimeFormat("en-US", minuteOptions).format(now);

    return {
        today: today,
        currentHour: `${hourNow} ${meridiem}`,
        currentMinute: m,
        cTime: `${hourNow}:${m}:00 ${meridiem}`,
    };
}
