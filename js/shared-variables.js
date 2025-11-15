let finesData, yearMetricData, licenseData, positiveBreathData, positiveDrugData, geoData, fatalitiesData, numbersData, allJurisdictions;
let metrics, ageGroups, allYears;

let mapMetricData = new Map(); 

// D3 selections for each chart
let mapSvg, barChartSvg, lineChartSvg;
let mapWidth, mapHeight;
let barChartWidth, barChartHeight, barMargin;
let lineChartWidth, lineChartHeight, lineMargin;

// D3 generators and scales
let mapProjection, mapPath, mapColorScale;
let xBarScale, yBarScale, barColorScale, stackGenerator;
let xLineScale, yLineScale, lineGeneratorBreath, lineGeneratorPositive;