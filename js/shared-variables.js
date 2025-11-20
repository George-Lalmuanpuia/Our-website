let finesData, yearMetricData, licenseData, licenseBySexData, positiveBreathData, positiveDrugData, geoData, fatalitiesData, numbersData, allJurisdictions;
let metrics, ageGroups, allYears;

let mapMetricData = new Map(); 
let licenseMap = new Map();

// D3 selections for each chart
let mapSvg, barChartSvg, lineChartSvg;
let mapWidth, mapHeight;
let barChartWidth, barChartHeight, barMargin;
let lineChartWidth, lineChartHeight, lineMargin;

// --- NEW: Variables for Horizontal Bar Chart ---
let hBarChartSvg;
let hBarChartWidth, hBarChartHeight, hBarMargin;
let xHBarScale, yHBarScale, hBarColorScale;
// --- END NEW ---

// D3 generators and scales
let mapProjection, mapPath, mapColorScale;
let xBarScale, yBarScale, barColorScale, stackGenerator;
let xLineScale, yLineScale, lineGeneratorBreath, lineGeneratorPositive;