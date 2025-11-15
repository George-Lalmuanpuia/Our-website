// GeoJSON for the map (used by both dashboards)
const geojsonURL = "https://raw.githubusercontent.com/rowanhogan/australian-states/master/states.geojson";

// --- PARSING FUNCTIONS ---
const parseFinesRow = (d) => {
    d.YEAR = +d.YEAR;
    d.FINES = +d.FINES;
    d.ARRESTS = +d.ARRESTS;
    d.CHARGES = +d.CHARGES;
    return d;
};

const parseYearMetricRow = (d) => {
    d.YEAR = +d.YEAR;
    d.COUNT = +d.COUNT;
    d.JURISDICTION = d["First(JURISDICTION)"];
    return d;
};

// ... (other parsing functions: parseLicenseRow, parsePositiveBreathRow, etc. are unchanged) ...
const parseLicenseRow = (d) => {
    d.Year = +d.Year;
    d.TotalLicence = +d.TotalLicence;
    return d;
};

const parsePositiveBreathRow = (d) => {
    d.YEAR = +d.YEAR;
    d.COUNT = +d.COUNT;
    d.JURISDICTION = d["First(JURISDICTION)"];
    return d;
};

const parsePositiveDrugRow = (d) => {
    d.YEAR = +d.YEAR;
    d.COUNT = +d.COUNT;
    d.JURISDICTION = d["First(JURISDICTION)"];
    return d;
};

const parseFatalitiesRow = (d) => {
    d.Year = +d.Year;
    d.Age = +d.Age;
    if (d.StateFullForm === "West Australia") {
        d.StateFullForm = "Western Australia";
    }
    return d;
};

const parseNumbersRow = (d) => {
    d.Year = +d.Year;
    d.NumberOfFatalities = +d.NumberOfFatalities;
    d.NumberOfFatalCrashes = +d.NumberOfFatalCrashes;
    d.Date = d3.timeParse("%Y-%m")(`${d.Year}-${d3.timeFormat("%m")(d3.timeParse("%B")(d.Month))}`);
    return d;
};


// --- ERROR HANDLER ---
function handleDataLoadError(error) {
    console.error("Error loading data:", error);
    d3.select("#loading").text("Error loading dashboard data. Please check console.");
}

// --- NEW: Loader for Map + Line Chart Page ---
function loadEnforcementMapLineData() {
    return Promise.all([
        d3.json(geojsonURL),
        d3.csv("./data/YearMetricCountByJurisdiction.csv", parseYearMetricRow),
        d3.csv("./data/PositiveBreathTestCountInEachJurisdictionPerYear.csv", parsePositiveBreathRow),
        d3.csv("./data/PositiveDrugTestCountInEachJurisdictionPerYear.csv", parsePositiveDrugRow)
    ]).then(([geo, yearMetric, positiveBreath, positiveDrug]) => {
        
        // 1. Assign data to global vars
        geoData = geo;
        yearMetricData = yearMetric;
        positiveBreathData = positiveBreath;
        positiveDrugData = positiveDrug;

        // 2. Process data (needed by this page)
        allYears = [...new Set(yearMetricData.filter(d => d).map(d => d.YEAR))].sort((a, b) => b - a);
        
        // 3. Pre-process map data for the latest year
        if (typeof processMapData === "function") {
             processMapData(allYears[0], positiveDrugData);
        }
    });
}

// --- NEW: Loader for Fines Page ---
function loadEnforcementFinesData() {
    return Promise.all([
        d3.csv("./data/Fines.csv", parseFinesRow),
        d3.json(geojsonURL) // ADDED: Load the map file
    ]).then(([fines, geo]) => {
        
        // 1. Assign data to global vars
        finesData = fines;
        geoData = geo; // ADDED: Assign the map data

        // 2. Process data (needed by this page)
        metrics = ["All", ...new Set(finesData.filter(d => d).map(d => d.METRIC).sort())];
        ageGroups = ["All", ...new Set(finesData.filter(d => d).map(d => d.AGE_GROUP).sort())];
        allYears = [...new Set(finesData.filter(d => d).map(d => d.YEAR))].sort((a, b) => b - a);
    });
}


// --- FATALITIES DATA LOADER (Unchanged) ---
function loadFatalitiesData() {
    Promise.all([
        d3.json(geojsonURL),
        d3.csv("./data/BITRE_fatalities.csv", parseFatalitiesRow),
        d3.csv("./data/BITRE_NumbersOfFatals.csv", parseNumbersRow)
    ]).then(([geo, fatalities, numbers]) => {
        
        // 1. Assign data
        geoData = geo;
        fatalitiesData = fatalities;
        numbersData = numbers;

        // 2. Process data
        allJurisdictions = ["All Australia", ...new Set(fatalitiesData.map(d => d.StateFullForm).sort())];

        // 3. Initialize Visualizations
        setupDeathFilters();
        setupDeathLineChart();
        setupDeathMap();
        setupDeathDonutChart();
        setupDeathBarChart();

        // 4. Initial Render
        updateDeathLineChart();
        updateDeathVisualizations();

        // 5. Hide loading screen
        d3.select("#loading").style("display", "none");

    }).catch(handleDataLoadError);
}

// --- PAGE ROUTER (Updated) ---
document.addEventListener('DOMContentLoaded', () => {
    if (document.getElementById('enforcement-dashboard-container')) {
        // This is the breath-drug.html page
        loadEnforcementMapLineData().then(() => { // CHANGED
            // Functions from dashboard.js
            setupFilters();
            setupMap();
            setupLineChart();
            updateVisualizations();
            d3.select("#loading").style("display", "none");
        }).catch(handleDataLoadError);

    } else if (document.getElementById('fines-dashboard-container')) {
        // This is the fines.html page
        loadEnforcementFinesData().then(() => { // CHANGED
            // Functions from fines.js
            setupFinesFilters();
            setupBarChart();
            setupMap();
            updateBarVisualizations();
            d3.select("#loading").style("display", "none");
        }).catch(handleDataLoadError);

    } else if (document.getElementById('fatalities-dashboard-container')) {
        // This is the deaths.html page
        loadFatalitiesData();
    }
});