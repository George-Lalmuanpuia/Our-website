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
            breath_test_total: totalBreath,
            
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
        .property("selected", d => d === allYears[0]); // Selects 2024

    // Populate Jurisdiction filter
    const jurisdictions = ["All", ...Object.keys(stateNameMapping)];
    d3.select("#filter-jurisdiction")
        .selectAll("option")
        .data(jurisdictions)
        .join("option")
        .attr("value", d => d)
        .text(d => d === "All" ? "All Australia" : stateNameMapping[d]);

    // Add event listeners to filters for THIS page
    d3.selectAll("#filter-map-metric, #filter-line-metric, #filter-year, #filter-jurisdiction, #filter-hbar-metric")
        .on("change", updateVisualizations);
}

function setupMap() {
    mapWidth = 800;
    mapHeight = 600;

    mapSvg = d3.select("#map-viz");

    // --- Projection ---
    // CHANGED: Increased y-translation divisor to 2.4 to move map UP
    mapProjection = d3.geoMercator()
        .center([133, -25])
        .scale(mapWidth * 0.9)
        .translate([mapWidth / 2, mapHeight / 2.4]); 

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
    // The position here (0.9 * mapHeight) stays the same, 
    // but since the map is moved up, they won't overlap.
    mapSvg.append("g")
        .attr("class", "legendQuant")
        .attr("transform", `translate(${mapWidth * 0.05}, ${mapHeight * 0.9})`);
}

// --- UPDATED: Horizontal Bar Chart Setup (Corrected) ---
function setupHBarChart() {
    hBarMargin = { top: 20, right: 30, bottom: 40, left: 100 };
    const container = d3.select("#hbar-chart-container");
    
    // Ensure the container exists (assuming it was added to breath-drug.html)
    if (!container.node()) return; 

    hBarChartWidth = container.node().getBoundingClientRect().width - hBarMargin.left - hBarMargin.right;
    hBarChartHeight = 300 - hBarMargin.top - hBarMargin.bottom;

    hBarChartSvg = d3.select("#hbar-chart-viz")
        .attr("width", hBarChartWidth + hBarMargin.left + hBarMargin.right)
        .attr("height", hBarChartHeight + hBarMargin.top + hBarMargin.bottom)
        .append("g")
        .attr("transform", `translate(${hBarMargin.left},${hBarMargin.top})`);
    
    // Scales (X is value, Y is categorical)
    xHBarScale = d3.scaleLinear().range([0, hBarChartWidth]);
    yHBarScale = d3.scaleBand().range([hBarChartHeight, 0]).padding(0.1);
    hBarColorScale = d3.scaleOrdinal().domain(["Male", "Female", "Unknown"]).range(["#2563eb", "#f43f5e", "#9ca3af"]); 

    // Axes
    hBarChartSvg.append("g")
        .attr("class", "x-axis")
        .attr("transform", `translate(0, ${hBarChartHeight})`);

    hBarChartSvg.append("g")
        .attr("class", "y-axis");

    // X-axis Label
    hBarChartSvg.append("text")
        .attr("class", "x-axis-label")
        .attr("transform", `translate(${hBarChartWidth / 2}, ${hBarChartHeight + hBarMargin.bottom - 5})`)
        .style("text-anchor", "middle")
        .attr("fill", "#374151")
        .text("Test Rate (per 10,000 Licence Holders)");
}
// --- END UPDATE ---


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
    const selectedMapMetric = d3.select("#filter-map-metric").property("value");
    const selectedLineMetric = d3.select("#filter-line-metric").property("value");
    const selectedHBarMetric = d3.select("#filter-hbar-metric").property("value");
    
    // 2. Update subtitles
    let jurisdictionText = selectedJurisdiction ? stateNameMapping[selectedJurisdiction] : "all of Australia";
    
    d3.select("#line-chart-subtitle").text(`Showing data for ${jurisdictionText}.`);
    d3.select("#map-subtitle").text(`Click a state to filter charts. Showing data for ${selectedYear}.`);
    d3.select("#hbar-chart-subtitle").text(`Showing data for ${jurisdictionText} in ${selectedYear}.`);

    // 3. Re-process Map Data for the selected year
    processMapData(selectedYear, positiveDrugData);

    // 4. Update Map
    updateMap(selectedMapMetric, selectedJurisdiction, selectedYear);

    // 5. Update Line Chart
    updateLineChart(selectedLineMetric, selectedJurisdiction);
    
    // 6. Update Horizontal Bar Chart
    updateHBarChart(selectedYear, selectedHBarMetric, selectedJurisdiction);
}

function updateMap(mapMetric, selectedJurisdiction, selectedYear) {
    let dataValues = [];
    let colorScheme = d3.schemeBlues[9]; 
    let legendFormat = (d) => `${d.toFixed(1)}%`; 
    let subtitle = `Showing Positive Breath Test % (${selectedYear})`;
    let labelFormat;

    // Set scale and labels based on selected metric
    if (mapMetric === "breath_test_percent") {
        dataValues = Array.from(mapMetricData.values()).map(d => d.breath_test_percent);
        colorScheme = d3.schemeBlues[9];
        labelFormat = (val) => `${val.toFixed(1)}%`;
        legendFormat = (d) => `${d.toFixed(1)}%`;
        subtitle = `Showing Positive Breath Test % (${selectedYear})`;
    
    } else if (mapMetric === "breath_test_total") {  // --- NEW BLOCK ---
        dataValues = Array.from(mapMetricData.values()).map(d => d.breath_test_total);
        colorScheme = d3.schemePurples[9]; // Use Purple to distinguish from Breath %
        labelFormat = d3.format(".2s"); // Format as 1.5M, 500k, etc.
        legendFormat = d3.format(".2s");
        subtitle = `Showing Total Breath Tests Conducted (${selectedYear})`;

    } else if (mapMetric === "drug_test_total") {
        dataValues = Array.from(mapMetricData.values()).map(d => d.drug_test_total);
        colorScheme = d3.schemeGreens[9];
        labelFormat = d3.format(".2s");
        legendFormat = d3.format(".2s"); 
        subtitle = `Showing Total Drug Tests Conducted (${selectedYear})`;
    
    } else if (mapMetric === "drug_test_percent") {
        dataValues = Array.from(mapMetricData.values()).map(d => d.drug_test_percent);
        colorScheme = d3.schemeReds[9];
        labelFormat = (val) => `${val.toFixed(1)}%`;
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
            // Use bracket notation to access the dynamic key (e.g., stateData["totalBreathTests"])
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
                html += ` (Pos: ${stateData.positiveBreathTests.toLocaleString()} / Total: ${stateData.breath_test_total.toLocaleString()})<br/>`;
                html += `Total Drug Tests: ${stateData.drug_test_total.toLocaleString()}<br/>`;
                html += `Positive Drug Test %: ${stateData.drug_test_percent.toFixed(2)}%<br/>`;
                html += ` (Pos: ${stateData.positiveDrugTests.toLocaleString()} / Total: ${stateData.drug_test_total.toLocaleString()})`;
            } else {
                html += "No data available";
            }
            showTooltip(event, html);
        });
    
    // Draw Text Labels on Map
    const colorRange = mapColorScale.range();
    const splitIndex = Math.floor(colorRange.length / 2); 

    mapSvg.selectAll(".state-label")
        .data(geoData.features, d => d.properties.STATE_NAME)
        .join(
            enter => enter.append("text")
                .attr("class", "state-label")
                .attr("pointer-events", "none")
                .attr("text-anchor", "middle")
                .attr("alignment-baseline", "middle")
                .attr("font-size", "12px")
                .style("font-weight", "bold")
                .style("paint-order", "stroke")
                .attr("stroke-width", "3px")
                .attr("stroke-linejoin", "round")
                .attr("x", d => mapPath.centroid(d)[0])
                .attr("y", d => mapPath.centroid(d)[1]),
            update => update
        )
        .text(d => {
            const stateAbbr = reverseStateNameMapping[d.properties.STATE_NAME];
            const stateData = mapMetricData.get(stateAbbr);
            const value = stateData ? stateData[mapMetric] : 0;
            return value > 0 ? labelFormat(value) : "";
        })
        .attr("fill", d => {
            const stateAbbr = reverseStateNameMapping[d.properties.STATE_NAME];
            const stateData = mapMetricData.get(stateAbbr);
            const value = stateData ? stateData[mapMetric] : 0;
            const color = mapColorScale(value);
            const colorIndex = colorRange.indexOf(color);
            return (colorIndex !== -1 && colorIndex >= splitIndex) ? "white" : "#374151";
        })
        .attr("stroke", d => {
            const stateAbbr = reverseStateNameMapping[d.properties.STATE_NAME];
            const stateData = mapMetricData.get(stateAbbr);
            const value = stateData ? stateData[mapMetric] : 0;
            const color = mapColorScale(value);
            const colorIndex = colorRange.indexOf(color);

            return (colorIndex !== -1 && colorIndex >= splitIndex) ? "#374151" : "white";
        })

    // Update Legend
    const legend = mapSvg.select(".legendQuant");
    legend.selectAll("*").remove(); 
    
    const legendColors = mapColorScale.range();
    const legendWidth = mapWidth * 0.9 / legendColors.length;

    legend.selectAll("rect")
        .data(legendColors)
        .join("rect")
        .attr("x", (d, i) => i * legendWidth)
        .attr("y", 0)
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

// --- UPDATED: Horizontal Bar Chart Update Function (Corrected) ---
function updateHBarChart(selectedYear, selectedHBarMetric, selectedJurisdiction) {
    
    // 1. Setup based on metric selection
    const isBreath = selectedHBarMetric === "breath_tests_conducted";
    const metricKey = isBreath ? 'breath_tests_conducted' : 'drug_tests_conducted';
    const metricTitle = isBreath ? 'Total Breath Tests' : 'Total Drug Tests';
    
    // --- 2. Calculate Rate (Tests per 10,000 Holders) ---
    
    // Filter test data for the selected year and metric
    const totalMetricForYear = yearMetricData.filter(d => 
        d.YEAR === selectedYear && d.METRIC === metricKey
    );
    
    // Total Licenses (national, aggregated)
    const totalLicensesByJurisdiction = d3.rollup(
        licenseData.filter(d => d.Year === selectedYear),
        v => d3.sum(v, d => d.TotalLicence),
        d => d.Jurisdiction
    );

    // Total Tests Conducted
    const totalTestsByJurisdiction = d3.rollup(
        totalMetricForYear,
        v => d3.sum(v, d => d.COUNT),
        d => d.JURISDICTION
    );

    // Combine, calculate rate, and filter
    let processedData = Array.from(totalTestsByJurisdiction, ([jurisdiction, totalTests]) => {
        const totalLicenses = totalLicensesByJurisdiction.get(jurisdiction) || 0;
        const ratePer10k = totalLicenses > 0 ? (totalTests / totalLicenses) * 10000 : 0;
        
        return {
            jurisdiction: jurisdiction,
            rate: ratePer10k,
            totalTests: totalTests,
            totalLicenses: totalLicenses
        };
    }).filter(d => d.jurisdiction !== "Australia") // Exclude 'Australia' pseudo-jurisdiction
      .sort((a, b) => b.rate - a.rate);

    // Filter to a single jurisdiction if one is selected (used for error handling)
    if (selectedJurisdiction) {
        processedData = processedData.filter(d => d.jurisdiction === selectedJurisdiction);
        if (processedData.length === 0) {
             d3.select("#hbar-chart-error").style("display", null).text(`No ${metricTitle} data available for ${stateNameMapping[selectedJurisdiction]} in ${selectedYear}.`);
             hBarChartSvg.selectAll(".bar-container").remove(); 
             return;
        }
    }
    d3.select("#hbar-chart-error").style("display", "none");

    // --- 3. Update Scales & Axes (Bar Height Fix Included) ---
    
    const domainJurisdictions = processedData.map(d => d.jurisdiction);
    
    // Y-scale range is fixed to the container height to ensure correct bandwidth calculation
    yHBarScale
        .domain(domainJurisdictions)
        .range([hBarChartHeight, 0]); 

    xHBarScale.domain([0, d3.max(processedData, d => d.rate) || 1]).nice();
    
    // Update X-axis
    hBarChartSvg.select(".x-axis")
        .transition().duration(300)
        .call(d3.axisBottom(xHBarScale).ticks(5).tickFormat(d3.format(".1f"))); 

    // Update Y-axis (with full state name tick formatting)
    hBarChartSvg.select(".y-axis")
        .transition().duration(300)
        .call(d3.axisLeft(yHBarScale).tickFormat(d => d.Jurisdiction || d).tickSize(0));
        
    // Update X-axis label
    hBarChartSvg.select(".x-axis-label").text(`${metricTitle} Rate (per 10,000 Licence Holders)`);

    // Calculate the bar height once after the yHBarScale domain is set
    const barHeight = yHBarScale.bandwidth(); 
    
    // --- 4. Draw Bars and Text Labels ---

    // Create a group for each bar + text combination for easier management
    const barGroups = hBarChartSvg.selectAll(".bar-container")
        .data(processedData, d => d.jurisdiction)
        .join(
            enter => enter.append("g")
                .attr("class", "bar-container")
                .attr("transform", d => `translate(0, ${yHBarScale(d.jurisdiction)})`),
            update => update.call(update => update.transition().duration(500)
                .attr("transform", d => `translate(0, ${yHBarScale(d.jurisdiction)})`)
            ),
            exit => exit.call(exit => exit.transition().duration(500)
                .style("opacity", 0)
                .remove()
            )
        );
        
    // --- Draw the Rectangles (Bars) ---
    barGroups.selectAll("rect.bar")
        .data(d => [d])
        .join(
            enter => enter.append("rect")
                .attr("class", "bar")
                .attr("fill", isBreath ? "#4338ca" : "#059669")
                .attr("x", xHBarScale(0))
                .attr("height", barHeight) 
                .attr("width", 0)
                .call(enter => enter.transition().duration(500)
                    .attr("width", d => xHBarScale(d.rate))),
            update => update
                .call(update => update.transition().duration(500)
                    .attr("height", barHeight)
                    .attr("width", d => xHBarScale(d.rate))
                    .attr("fill", isBreath ? "#4338ca" : "#059669")
                )
        )
        .on("mouseover", (event, d) => {
            showTooltip(event, `
                <strong>${stateNameMapping[d.jurisdiction]} (${selectedYear})</strong><br/>
                ${metricTitle} Rate: ${d.rate.toFixed(2)} / 10k Holders<br/>
                Total Tests: ${d.totalTests.toLocaleString()}<br/>
                Total Holders: ${d.totalLicenses.toLocaleString()}
            `);
        })
        .on("mousemove", moveTooltip)
        .on("mouseout", hideTooltip);

    // --- Draw the Text Labels (The part that adds the value inside the bar) ---
    barGroups.selectAll("text.bar-label")
        .data(d => [d])
        .join(
            enter => enter.append("text")
                .attr("class", "bar-label")
                .attr("x", xHBarScale(0)) // Start text at 0 for transition
                .attr("y", barHeight / 2) // Center vertically
                .attr("dy", "0.35em")
                .text(d => d.rate.toFixed(0)) // Display the rate, rounded
                .attr("fill", "white")
                .style("font-weight", "bold")
                .style("font-size", "12px")
                .style("text-anchor", "end") // Anchor to the end of the bar
                .call(enter => enter.transition().duration(500)
                    .attr("x", d => xHBarScale(d.rate) - 5)),
            update => update
                .call(update => update.transition().duration(500)
                    .attr("y", barHeight / 2) 
                    .attr("x", d => xHBarScale(d.rate) - 5)
                    .text(d => d.rate.toFixed(0))
                )
        );
}
// --- END UPDATE ---


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