// --- DATA PROCESSING FUNCTION ---
function processMapData(year, positiveDrugData) {
    // Clear the map for reprocessing
    mapMetricData.clear(); 

    // Filter historical data for the target year
    const yearMetricForYear = yearMetricData.filter(d => d.YEAR === year);
    const positiveBreathForYear = positiveBreathData.filter(d => d.YEAR === year);
    const positiveDrugForYear = positiveDrugData.filter(d => d.YEAR === year);

    // Aggregate totals by jurisdiction for the target year
    const totalBreathTests = d3.rollup(
        yearMetricForYear.filter(d => d.METRIC === 'breath_tests_conducted'), 
        v => d3.sum(v, d => d.COUNT), 
        d => d.JURISDICTION
    );
    
    const positiveBreathTests = d3.rollup(
        positiveBreathForYear, 
        v => d3.sum(v, d => d.COUNT), 
        d => d.JURISDICTION
    );

    const totalDrugTests = d3.rollup(
        yearMetricForYear.filter(d => d.METRIC === 'drug_tests_conducted'), 
        v => d3.sum(v, d => d.COUNT), 
        d => d.JURISDICTION
    );
    
    const positiveDrugTests = d3.rollup(
        positiveDrugForYear, 
        v => d3.sum(v, d => d.COUNT), 
        d => d.JURISDICTION
    );

    // Build the mapMetricData Map
    Object.keys(stateNameMapping).forEach(jurisdictionAbbr => {
        const totalBreath = totalBreathTests.get(jurisdictionAbbr) || 0;
        const positiveBreath = positiveBreathTests.get(jurisdictionAbbr) || 0;
        const totalDrug = totalDrugTests.get(jurisdictionAbbr) || 0;
        const positiveDrug = positiveDrugTests.get(jurisdictionAbbr) || 0;

        const breathPercent = totalBreath > 0 ? (positiveBreath / totalBreath) * 100 : 0;
        const drugPercent = totalDrug > 0 ? (positiveDrug / totalDrug) * 100 : 0;
        
        mapMetricData.set(jurisdictionAbbr, {
            breath_test_percent: breathPercent,
            drug_test_percent: drugPercent,
            drug_test_total: totalDrug,
            // Store raw numbers for tooltip
            totalBreathTests: totalBreath,
            positiveBreathTests: positiveBreath,
            positiveDrugTests: positiveDrug 
        });
    });
}


// --- SETUP FUNCTIONS ---

function setupFilters() {
    // Populate Year filter
    d3.select("#filter-year")
        .selectAll("option")
        .data(allYears)
        .join("option")
        .attr("value", d => d)
        .text(d => d)
        .property("selected", d => d === allYears[0]); // Select latest year

    // Populate Jurisdiction filter
    const jurisdictions = ["All", ...Object.keys(stateNameMapping)];
    d3.select("#filter-jurisdiction")
        .selectAll("option")
        .data(jurisdictions)
        .join("option")
        .attr("value", d => d)
        .text(d => d === "All" ? "All Australia" : stateNameMapping[d]);

    // NOTE: Metric and Age filters removed, as they only applied to the bar chart

    // Add event listeners to filters for THIS page
    d3.selectAll("#filter-map-metric, #filter-line-metric, #filter-year, #filter-jurisdiction")
        .on("change", updateVisualizations);
}

function setupMap() {
    const container = d3.select("#map-container");
    mapWidth = container.node().getBoundingClientRect().width;
    mapHeight = 600;

    mapSvg = d3.select("#map-viz");

    // --- Projection ---
    mapProjection = d3.geoMercator()
        .center([133, -25])
        .scale(mapWidth * 0.9)
        .translate([mapWidth / 2, mapHeight / 2.2]);

    mapPath = d3.geoPath().projection(mapProjection);

    // --- Color Scale ---
    mapColorScale = d3.scaleQuantize()
        .domain([0, 1]) // Initial domain, will be updated
        .range(d3.schemeBlues[9]);

    // --- Draw Paths ---
    mapSvg.append("g")
        .selectAll("path")
        .data(geoData.features)
        .join("path")
        .attr("d", mapPath)
        .attr("class", "state")
        .attr("data-state-name", d => d.properties.STATE_NAME)
        .on("click", (event, d) => {
            const stateName = d.properties.STATE_NAME;
            const stateAbbr = reverseStateNameMapping[stateName];
            
            // Toggle selection by updating the filter dropdown
            const currentFilter = d3.select("#filter-jurisdiction").property("value");
            const newFilterVal = (currentFilter === stateAbbr) ? "All" : stateAbbr;
            d3.select("#filter-jurisdiction").property("value", newFilterVal);
            
            // Trigger a full update
            updateVisualizations(); 
        })
        .on("mouseover", (event, d) => {
            // Tooltip logic moved to updateMap
        })
        .on("mousemove", moveTooltip)
        .on("mouseout", hideTooltip);
    
    // --- Legend ---
    mapSvg.append("g")
        .attr("class", "legendQuant")
        .attr("transform", `translate(${mapWidth * 0.05}, ${mapHeight * 0.9})`);
}

// --- BAR CHART FUNCTIONS (setupBarChart, updateBarChart) REMOVED ---

function setupLineChart() {
    lineMargin = { top: 20, right: 30, bottom: 40, left: 60 };
    const container = d3.select("#line-chart-container");
    lineChartWidth = container.node().getBoundingClientRect().width - lineMargin.left - lineMargin.right;
    lineChartHeight = 300 - lineMargin.top - lineMargin.bottom;

    lineChartSvg = d3.select("#line-chart-viz")
        .attr("width", lineChartWidth + lineMargin.left + lineMargin.right)
        .attr("height", lineChartHeight + lineMargin.top + lineMargin.bottom)
        .append("g")
        .attr("transform", `translate(${lineMargin.left},${lineMargin.top})`);

    // --- Scales ---
    xLineScale = d3.scaleLinear()
        .range([0, lineChartWidth]);

    yLineScale = d3.scaleLinear()
        .range([lineChartHeight, 0]);
    
    // --- Line Generators ---
    lineGeneratorBreath = d3.line()
        .x(d => xLineScale(d.YEAR))
        .y(d => yLineScale(d.COUNT));
    
    lineGeneratorPositive = d3.line()
        .x(d => xLineScale(d.YEAR))
        .y(d => yLineScale(d.COUNT));

    // --- Axes ---
    lineChartSvg.append("g")
        .attr("class", "x-axis")
        .attr("transform", `translate(0, ${lineChartHeight})`);

    lineChartSvg.append("g")
        .attr("class", "y-axis");
    
    // --- Line Paths (initially empty) ---
    lineChartSvg.append("path")
        .attr("id", "breath-test-line")
        .attr("fill", "none")
        .attr("stroke", d3.schemeCategory10[0])
        .attr("stroke-width", 2);
    
    lineChartSvg.append("path")
        .attr("id", "positive-test-line")
        .attr("fill", "none")
        .attr("stroke", d3.schemeCategory10[1])
        .attr("stroke-width", 2);

    // --- Legend ---
    const legend = lineChartSvg.append("g")
        .attr("transform", `translate(${lineChartWidth - 160}, -10)`);
    
    legend.append("rect")
        .attr("x", 0)
        .attr("width", 15)
        .attr("height", 2)
        .attr("fill", d3.schemeCategory10[0]);
    legend.append("text")
        .attr("class", "legend-label-total")
        .attr("x", 20)
        .attr("y", 4)
        .text("Breath Tests")
        .style("font-size", "12px");
    
    legend.append("rect")
        .attr("x", 0)
        .attr("y", 20)
        .attr("width", 15)
        .attr("height", 2)
        .attr("fill", d3.schemeCategory10[1]);
    legend.append("text")
        .attr("class", "legend-label-positive")
        .attr("x", 20)
        .attr("y", 24)
        .text("Positive Breath Tests")
        .style("font-size", "12px");
    
    // --- Tooltip Interaction Setup ---
    const focus = lineChartSvg.append("g")
        .attr("class", "tooltip-focus")
        .style("display", "none");

    focus.append("line").attr("class", "focus-line").attr("y1", 0).attr("y2", 
        lineChartHeight).attr("stroke", "#374151").attr("stroke-width", 1).attr("stroke-dasharray", "3,3");
    
    lineChartSvg.append("rect")
        .attr("class", "tooltip-overlay")
        .attr("width", lineChartWidth)
        .attr("height", lineChartHeight)
        .style("fill", "none")
        .style("pointer-events", "all")
        .on("mouseover", () => { 
            focus.style("display", null);
            tooltip.style("opacity", 1);
        })
        .on("mouseout", () => { 
            focus.style("display", "none"); 
            tooltip.style("opacity", 0);
        })
        .on("mousemove", (event) => onLineChartMousemove(event)); // Separate handler
}


// --- UPDATE FUNCTION (The Core) ---

function updateVisualizations() {
    // 1. Get all current filter values
    const selectedYear = +d3.select("#filter-year").property("value");
    const selectedJurisdiction = d3.select("#filter-jurisdiction").property("value") === "All" ? null : d3.select("#filter-jurisdiction").property("value");
    // const selectedMetric = d3.select("#filter-metric").property("value"); // Removed
    // const selectedAgeGroup = d3.select("#filter-age").property("value"); // Removed
    const selectedMapMetric = d3.select("#filter-map-metric").property("value");
    // const selectedBarMetric = d3.select("#filter-bar-metric").property("value"); // Removed
    const selectedLineMetric = d3.select("#filter-line-metric").property("value");
    
    // 2. Update subtitles
    let jurisdictionText = selectedJurisdiction ? stateNameMapping[selectedJurisdiction] : "all of Australia";
    
    // d3.select("#bar-chart-subtitle").text(`Showing data for ${jurisdictionText} in ${selectedYear}.`); // Removed
    d3.select("#line-chart-subtitle").text(`Showing data for ${jurisdictionText}.`);
    d3.select("#map-subtitle").text(`Click a state to filter charts. Showing data for ${selectedYear}.`);

    // 3. Filter fines data (for bar chart) // Removed
    // let filteredFines = ... // Removed

    // 4. Re-process Map Data for the selected year
    processMapData(selectedYear, positiveDrugData);

    // 5. Update Map
    updateMap(selectedMapMetric, selectedJurisdiction, selectedYear);

    // 6. Update Bar Chart // Removed
    // updateBarChart(...) // Removed

    // 7. Update Line Chart
    updateLineChart(selectedLineMetric, selectedJurisdiction);
}

function updateMap(mapMetric, selectedJurisdiction, selectedYear) {
    let dataValues = [];
    let colorScheme = d3.schemeBlues[9]; // Default for percentages
    let legendFormat = (d) => `${d.toFixed(1)}%`; // Default for percentages
    let subtitle = `Showing Positive Breath Test % (${selectedYear})`;

    // Set scale and labels based on selected metric
    if (mapMetric === "breath_test_percent") {
        dataValues = Array.from(mapMetricData.values()).map(d => d.breath_test_percent);
        colorScheme = d3.schemeBlues[9];
        legendFormat = (d) => `${d.toFixed(1)}%`;
        subtitle = `Showing Positive Breath Test % (${selectedYear})`;
    } else if (mapMetric === "drug_test_total") {
        dataValues = Array.from(mapMetricData.values()).map(d => d.drug_test_total);
        colorScheme = d3.schemeGreens[9];
        legendFormat = d3.format(".2s"); // e.g., 1.5k
        subtitle = `Showing Total Drug Tests Conducted (${selectedYear})`;
    } else if (mapMetric === "drug_test_percent") {
        dataValues = Array.from(mapMetricData.values()).map(d => d.drug_test_percent);
        colorScheme = d3.schemeReds[9];
        legendFormat = (d) => `${d.toFixed(1)}%`;
        subtitle = `Showing Positive Drug Test % (${selectedYear})`;
    }
    
    d3.select("#map-subtitle").text(subtitle);

    // Update color scale domain
    const maxVal = d3.max(dataValues);
    mapColorScale.domain([0, maxVal > 0 ? maxVal : 1]).range(colorScheme);

    // Update paths
    mapSvg.selectAll(".state")
        .attr("fill", d => {
            const stateAbbr = reverseStateNameMapping[d.properties.STATE_NAME];
            const stateData = mapMetricData.get(stateAbbr);
            // Handle cases where data might be missing for a metric
            const value = stateData ? stateData[mapMetric] : 0;
            return (value === undefined || value === 0) ? "#e5e7eb" : mapColorScale(value);
        })
        .attr("class", d => {
            const stateAbbr = reverseStateNameMapping[d.properties.STATE_NAME];
            return `state ${selectedJurisdiction === stateAbbr ? "selected" : ""}`;
        })
        .on("mouseover", (event, d) => {
            const stateName = d.properties.STATE_NAME;
            const stateAbbr = reverseStateNameMapping[stateName];
            const stateData = mapMetricData.get(stateAbbr);
            
            let html = `<strong>${stateName} (${selectedYear})</strong><br/>`;
            if (stateData) {
                html += `Positive Breath Test %: ${stateData.breath_test_percent.toFixed(2)}%<br/>`;
                html += ` (Pos: ${stateData.positiveBreathTests.toLocaleString()} / Total: ${stateData.totalBreathTests.toLocaleString()})<br/>`;
                html += `Total Drug Tests: ${stateData.drug_test_total.toLocaleString()}<br/>`;
                html += `Positive Drug Test %: ${stateData.drug_test_percent.toFixed(2)}%<br/>`;
                html += ` (Pos: ${stateData.positiveDrugTests.toLocaleString()} / Total: ${stateData.drug_test_total.toLocaleString()})`;
            } else {
                html += "No data available";
            }
            showTooltip(event, html);
        });
    
    // Update Legend
    const legend = mapSvg.select(".legendQuant");
    legend.selectAll("*").remove(); // Clear old legend
    
    const legendColors = mapColorScale.range();
    const legendWidth = mapWidth * 0.9 / legendColors.length;

    legend.selectAll("rect")
        .data(legendColors)
        .join("rect")
        .attr("x", (d, i) => i * legendWidth)
        .attr("y", 15)
        .attr("width", legendWidth)
        .attr("height", 10)
        .attr("fill", d => d);
    
    legend.append("text")
        .attr("x", 0)
        .attr("y", 25)
        .attr("fill", "#374151")
        .style("font-size", "12px")
        .text(legendFormat(0));
    
    legend.append("text")
        .attr("x", mapWidth * 0.9)
        .attr("y", 25)
        .attr("fill", "#374151")
        .style("font-size", "12px")
        .style("text-anchor", "end")
        .text(legendFormat(maxVal));
}

// --- updateBarChart() REMOVED ---

function updateLineChart(lineMetric, selectedJurisdiction) {
    let jurisTotalData, jurisPositiveData, totalMetricName, positiveMetricName;

    if (lineMetric === 'drug') {
        // --- DRUG DATA ---
        jurisTotalData = yearMetricData.filter(d => d.METRIC === 'drug_tests_conducted');
        jurisPositiveData = positiveDrugData;
        totalMetricName = "Drug Tests";
        positiveMetricName = "Positive Drug Tests";
    } else {
        // --- BREATH DATA (default) ---
        jurisTotalData = yearMetricData.filter(d => d.METRIC === 'breath_tests_conducted');
        jurisPositiveData = positiveBreathData;
        totalMetricName = "Breath Tests";
        positiveMetricName = "Positive Breath Tests";
    }

    // Filter by selected jurisdiction (if any)
    if (selectedJurisdiction) {
        jurisTotalData = jurisTotalData.filter(d => d.JURISDICTION === selectedJurisdiction);
        jurisPositiveData = jurisPositiveData.filter(d => d.JURISDICTION === selectedJurisdiction);
    }

    // Aggregate by year
    const totalByYear = d3.rollups(jurisTotalData, v => d3.sum(v, d => d.COUNT), d => d.YEAR)
        .map(([year, count]) => ({ YEAR: year, COUNT: count })).sort((a,b) => a.YEAR - b.YEAR);
    
    const positiveByYear = d3.rollups(jurisPositiveData, v => d3.sum(v, d => d.COUNT), d => d.YEAR)
        .map(([year, count]) => ({ YEAR: year, COUNT: count })).sort((a,b) => a.YEAR - b.YEAR);

    // --- Update Scales ---
    const minYear = d3.min([d3.min(totalByYear, d => d.YEAR), d3.min(positiveByYear, d => d.YEAR)]);
    const maxYear = d3.max([d3.max(totalByYear, d => d.YEAR), d3.max(positiveByYear, d => d.YEAR)]);
    
    // Ensure we have a valid domain, even if data is empty
    xLineScale.domain([minYear || 2008, maxYear || 2024]);
    
    const maxCount = d3.max(totalByYear, d => d.COUNT) || 1;
    yLineScale.domain([0, maxCount]).nice();
    
    // --- Update Axes ---
    lineChartSvg.select(".x-axis")
        .transition().duration(300)
        .call(d3.axisBottom(xLineScale).tickFormat(d3.format("d"))); // Format as integer

    lineChartSvg.select(".y-axis")
        .transition().duration(300)
        .call(d3.axisLeft(yLineScale).ticks(5).tickFormat(d3.format(".2s")));
    
    // --- Update Lines ---
    lineChartSvg.select("#breath-test-line") // Re-using element
        .datum(totalByYear)
        .transition().duration(500)
        .attr("d", lineGeneratorBreath);
    
    lineChartSvg.select("#positive-test-line") // Re-using element
        .datum(positiveByYear)
        .transition().duration(500)
        .attr("d", lineGeneratorPositive);

    // --- Update Legend Text ---
    lineChartSvg.select(".legend-label-total").text(totalMetricName);
    lineChartSvg.select(".legend-label-positive").text(positiveMetricName);

    // Store data for tooltip
    lineChartSvg.select(".tooltip-overlay").datum({
        totalByYear,
        positiveByYear,
        totalMetricName,
        positiveMetricName
    });
}

function onLineChartMousemove(event) {
    const { totalByYear, positiveByYear, totalMetricName, positiveMetricName } = d3.select(event.currentTarget).datum();

    if (totalByYear.length === 0 && positiveByYear.length === 0) return;

    const x0 = xLineScale.invert(d3.pointer(event)[0]);
    const bisectYear = d3.bisector(d => d.YEAR).left;
    
    const iTotal = bisectYear(totalByYear, x0, 1);
    const d0Total = totalByYear[iTotal - 1];
    const d1Total = totalByYear[iTotal];
    
    // FIX: Add boundary checks for d0/d1 before calculating dTotal
    let dTotal;
    if (d0Total && d1Total) {
        dTotal = (x0 - d0Total.YEAR > d1Total.YEAR - x0) ? d1Total : d0Total;
    } else if (d0Total) {
        dTotal = d0Total;
    } else if (d1Total) {
        dTotal = d1Total;
    }

    const iPositive = bisectYear(positiveByYear, x0, 1);
    const d0Positive = positiveByYear[iPositive - 1];
    const d1Positive = positiveByYear[iPositive];

    // FIX: Add boundary checks for d0/d1 before calculating dPositive
    let dPositive;
    if (d0Positive && d1Positive) {
        dPositive = (x0 - d0Positive.YEAR > d1Positive.YEAR - x0) ? d1Positive : d0Positive;
    } else if (d0Positive) {
        dPositive = d0Positive;
    } else if (d1Positive) {
        dPositive = d1Positive;
    }

    // Find the closest year
    let closestYear, totalCount = 0, positiveCount = 0;
    
    if (dTotal && dPositive) {
        if (Math.abs(x0 - dTotal.YEAR) < Math.abs(x0 - dPositive.YEAR)) {
            closestYear = dTotal.YEAR;
        } else {
            closestYear = dPositive.YEAR;
        }
    } else if (dTotal) {
        closestYear = dTotal.YEAR;
    } else if (dPositive) {
        closestYear = dPositive.YEAR;
    } else {
        return; // No data
    }

    if (closestYear === undefined) return;
    
    const matchingTotal = totalByYear.find(d => d.YEAR === closestYear);
    const matchingPositive = positiveByYear.find(d => d.YEAR === closestYear);
    
    totalCount = matchingTotal ? matchingTotal.COUNT : 0;
    positiveCount = matchingPositive ? matchingPositive.COUNT : 0;

    d3.select(".tooltip-focus").attr("transform", `translate(${xLineScale(closestYear)},0)`);
    
    tooltip.html(`
        <strong>Year: ${closestYear}</strong><br/>
        ${totalMetricName}: ${totalCount.toLocaleString()}<br/>
        ${positiveMetricName}: ${positiveCount.toLocaleString()}
    `)
    .style("left", (event.pageX + 15) + "px")
    .style("top", (event.pageY - 10) + "px");
}