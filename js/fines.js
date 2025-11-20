// --- FILTER SETUP ---
function setupFinesFilters() {
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

    // Populate metric filter
    d3.select("#filter-metric")
        .selectAll("option")
        .data(metrics)
        .join("option")
        .attr("value", d => d)
        .text(d => d.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())); // Prettify name

    // Populate age group filter
    d3.select("#filter-age")
        .selectAll("option")
        .data(ageGroups)
        .join("option")
        .attr("value", d => d)
        .text(d => d);
    
    // Add event listeners to ALL filters
    d3.selectAll("#filter-metric, #filter-age, #filter-bar-metric, #filter-year, #filter-jurisdiction")
        .on("change", updateBarVisualizations);
}

// --- BAR CHART (AGE GROUP) SETUP (Unchanged) ---
function setupBarChart() {
    barMargin = { top: 20, right: 30, bottom: 60, left: 75 };
    const container = d3.select("#bar-chart-container");
    if (container.empty()) {
        console.error("Bar chart container not found.");
        return;
    }
    barChartWidth = container.node().getBoundingClientRect().width - barMargin.left - barMargin.right;
    barChartHeight = 300 - barMargin.top - barMargin.bottom;

    barChartSvg = d3.select("#bar-chart-viz")
        .attr("width", barChartWidth + barMargin.left + barMargin.right)
        .attr("height", barChartHeight + barMargin.top + barMargin.bottom)
        .append("g")
        .attr("transform", `translate(${barMargin.left},${barMargin.top})`);
    
    // --- Scales ---
    xBarScale = d3.scaleBand()
        .range([0, barChartWidth])
        .padding(0.2);

    yBarScale = d3.scaleLinear()
        .range([barChartHeight, 0]);

    // Color scale (Metrics from Fines.csv)
    const metricKeys = metrics.filter(m => m !== "All");
    barColorScale = d3.scaleOrdinal()
        .domain(metricKeys)
        .range(d3.schemeTableau10); 

    // --- Stack Generator ---
    stackGenerator = d3.stack()
        .keys(metricKeys)
        .order(d3.stackOrderNone)
        .offset(d3.stackOffsetNone);

    // --- Axes ---
    barChartSvg.append("g")
        .attr("class", "x-axis")
        .attr("transform", `translate(0, ${barChartHeight})`);

    barChartSvg.append("g")
        .attr("class", "y-axis");
    
    // Y-axis Label
    barChartSvg.append("text")
        .attr("class", "y-axis-label")
        .attr("transform", "rotate(-90)")
        .attr("y", 0 - barMargin.left + 15)
        .attr("x", 0 - (barChartHeight / 2))
        .attr("dy", "1em")
        .style("text-anchor", "middle")
        .attr("fill", "#374151")
        .text("Total Fines"); // Initial label

    // --- Bar Chart Legend ---
    const legendContainer = d3.select("#bar-chart-legend");

    const legendItems = legendContainer.selectAll(".legend-item")
        .data(metricKeys)
        .join("div")
        .attr("class", "legend-item");

    legendItems.append("svg")
        .attr("width", 12)
        .attr("height", 12)
        .append("rect")
        .attr("width", 12)
        .attr("height", 12)
        .attr("fill", d => barColorScale(d));

    legendItems.append("span")
        .attr("class", "legend-text")
        .text(d => d.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())); // Prettify name
}

// --- REMOVED: setupJurisdictionBarChart() ---

// --- ADDED: Map Setup ---
function setupMap() {
    mapWidth = 800;
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
            
            if (!stateAbbr) return; // Ignore clicks on areas like "Jervis Bay Territory"

            // Toggle selection by updating the filter dropdown
            const currentFilter = d3.select("#filter-jurisdiction").property("value");
            const newFilterVal = (currentFilter === stateAbbr) ? "All" : stateAbbr;
            d3.select("#filter-jurisdiction").property("value", newFilterVal);
            
            // Trigger a full update
            updateBarVisualizations(); 
        })
        .on("mouseover", (event, d) => {
            // Tooltip logic moved to updateFinesMap
        })
        .on("mousemove", moveTooltip)
        .on("mouseout", hideTooltip);
    
    // --- Legend ---
    mapSvg.append("g")
        .attr("class", "legendQuant")
        .attr("transform", `translate(${mapWidth * 0.05}, ${mapHeight * 0.9})`);
}


// --- UPDATE FUNCTIONS ---

function updateBarVisualizations() {
    // 1. Get all current filter values
    const selectedYear = +d3.select("#filter-year").property("value");
    const selectedJurisdiction = d3.select("#filter-jurisdiction").property("value") === "All" ? null : d3.select("#filter-jurisdiction").property("value");
    const selectedMetric = d3.select("#filter-metric").property("value");
    const selectedAgeGroup = d3.select("#filter-age").property("value");
    const selectedBarMetric = d3.select("#filter-bar-metric").property("value");
    
    // 2. Update subtitles
    let jurisdictionText = selectedJurisdiction ? stateNameMapping[selectedJurisdiction] : "all of Australia";
    const yearText = `in ${selectedYear}`;
    const filtersText = `Showing data for ${jurisdictionText} ${yearText}.`;
    
    d3.select("#bar-chart-subtitle").text(filtersText);
    d3.select("#map-subtitle").text(filtersText + " Click state to filter."); // Updated map subtitle


    // 3. Filter fines data (for both charts)
    let filteredFines = finesData.filter(d => 
        (d.YEAR === selectedYear) && // Filter by selected year
        (selectedMetric === "All" || d.METRIC === selectedMetric) &&
        (selectedAgeGroup === "All" || d.AGE_GROUP === selectedAgeGroup)
    );

    // 4. Update Bar Chart (Age Group)
    updateBarChart(filteredFines, selectedBarMetric, selectedJurisdiction);
    
    // 5. Update Map (Jurisdiction)
    updateFinesMap(filteredFines, selectedBarMetric, selectedJurisdiction);
}

// --- BAR CHART (AGE GROUP) UPDATE (Unchanged) ---
function updateBarChart(data, barMetric, selectedJurisdiction) {
    // Filter by selected jurisdiction (if any)
    let jurisdictionalData = data;
    if (selectedJurisdiction) {
        jurisdictionalData = data.filter(d => d.JURISDICTION === selectedJurisdiction);
    }

    // Aggregate data by Age Group
    const ageGroupsList = ageGroups.filter(m => m !== "All"); 
    const aggregated = d3.rollups(
        jurisdictionalData,
        v => d3.sum(v, d => d[barMetric]), 
        d => d.AGE_GROUP,
        d => d.METRIC
    );

    // Re-format data for stacking
    let dataForStacking = ageGroupsList.map(age => {
        let obj = { AGE_GROUP: age };
        metrics.filter(m => m !== "All").forEach(m => obj[m] = 0); // Initialize
        return obj;
    });
    
    const ageGroupMap = new Map(dataForStacking.map(d => [d.AGE_GROUP, d]));
    for (const [ageGroup, metricsMap] of aggregated) {
        const ageGroupObj = ageGroupMap.get(ageGroup);
        if (ageGroupObj) {
            for (const [metric, value] of metricsMap) {
                if (ageGroupObj.hasOwnProperty(metric)) {
                    ageGroupObj[metric] = value;
                }
            }
        }
    }
    
    const stackData = stackGenerator(dataForStacking);
    
    // --- Update Scales ---
    xBarScale.domain(dataForStacking.map(d => d.AGE_GROUP));
    const maxCount = d3.max(stackData[stackData.length - 1] || [], d => d[1]) || 1;
    yBarScale.domain([0, maxCount]).nice();

    // --- Update Axes ---
    barChartSvg.select(".x-axis")
        .transition().duration(300)
        .call(d3.axisBottom(xBarScale))
        .selectAll("text")
        .attr("transform", "rotate(-45)")
        .style("text-anchor", "end");

    barChartSvg.select(".y-axis")
        .transition().duration(300)
        .call(d3.axisLeft(yBarScale).ticks(5).tickFormat(d3.format(".2s")));
    
    // Update Y-axis label
    const metricLabel = barMetric.charAt(0).toUpperCase() + barMetric.slice(1).toLowerCase();
    barChartSvg.select(".y-axis-label").text(`Total ${metricLabel}`);

    // --- Draw Bars (Enter/Update/Exit) ---
    barChartSvg.selectAll(".layer")
        .data(stackData, d => d.key)
        .join("g")
        .attr("class", "layer")
        .attr("fill", d => barColorScale(d.key))
        .selectAll("rect")
        .data(d => d, d => d.data.AGE_GROUP)
        .join(
            enter => enter.append("rect")
                // ... (enter transition) ...
                .attr("class", "bar-segment")
                .attr("x", d => xBarScale(d.data.AGE_GROUP))
                .attr("y", yBarScale(0))
                .attr("height", 0)
                .attr("width", xBarScale.bandwidth())
                .call(enter => enter.transition().duration(500)
                    .attr("y", d => yBarScale(d[1]))
                    .attr("height", d => yBarScale(d[0]) - yBarScale(d[1]))
                ),
            update => update
                .call(update => update.transition().duration(500)
                    // ... (update transition) ...
                    .attr("x", d => xBarScale(d.data.AGE_GROUP))
                    .attr("width", xBarScale.bandwidth())
                    .attr("y", d => yBarScale(d[1]))
                    .attr("height", d => yBarScale(d[0]) - yBarScale(d[1]))
                ),
            exit => exit
                .call(exit => exit.transition().duration(500)
                    // ... (exit transition) ...
                    .attr("y", yBarScale(0))
                    .attr("height", 0)
                    .remove()
                )
        )
        .on("mouseover", (event, d) => {
            const metricName = d3.select(event.currentTarget.parentNode).datum().key;
            const metricValue = d.data[metricName];
            showTooltip(event, `
                <strong>${d.data.AGE_GROUP}</strong><br/>
                ${metricName.replace(/_/g, ' ')}: ${metricValue.toLocaleString()}
            `);
        })
        .on("mousemove", moveTooltip)
        .on("mouseout", hideTooltip);
}

// --- REMOVED: updateJurisdictionBarChart() ---

// --- ADDED: Map Update Function ---
function updateFinesMap(data, barMetric, selectedJurisdiction) {
    // 1. Aggregate data
    const aggregated = d3.rollups(
        data,
        v => d3.sum(v, d => d[barMetric]), 
        d => d.JURISDICTION
    );
    const finesByState = new Map(aggregated);

    // 2. Set color scale
    const metricLabel = barMetric.charAt(0).toUpperCase() + barMetric.slice(1).toLowerCase();
    
    const colorScheme = (barMetric === 'FINES') ? d3.schemeBlues[9] :
                      (barMetric === 'ARRESTS') ? d3.schemeReds[9] :
                      d3.schemeGreens[9];
                      
    const maxVal = d3.max(finesByState.values()) || 1; 
    
    mapColorScale.domain([0, maxVal]).range(colorScheme);

    // 3. Update map paths
    mapSvg.selectAll(".state")
        .attr("fill", d => {
            const stateAbbr = reverseStateNameMapping[d.properties.STATE_NAME];
            const count = finesByState.get(stateAbbr) || 0;
            return (count === 0) ? "#e5e7eb" : mapColorScale(count);
        })
        .attr("class", d => { 
            const stateAbbr = reverseStateNameMapping[d.properties.STATE_NAME];
            return `state ${selectedJurisdiction === stateAbbr ? "selected" : ""}`;
        })
        .on("mouseover", (event, d) => { 
            const stateName = d.properties.STATE_NAME;
            const stateAbbr = reverseStateNameMapping[stateName];
            const count = finesByState.get(stateAbbr) || 0;
            
            showTooltip(event, `
                <strong>${stateName}</strong><br/>
                Total ${metricLabel}: ${count.toLocaleString()}
            `);
        });

    // --- 4. ADDED: Draw Text Labels on Map ---
    const colorRange = mapColorScale.range();
    const splitIndex = Math.floor(colorRange.length / 2); 
    const labelFormat = d3.format(".2s"); // Format large numbers like 15k, 1.5M

    mapSvg.selectAll(".state-label")
        .data(geoData.features, d => d.properties.STATE_NAME)
        .join(
            enter => enter.append("text")
                .attr("class", "state-label")
                .attr("pointer-events", "none")
                .attr("text-anchor", "middle")
                .attr("alignment-baseline", "middle")
                .attr("font-size", "10px")
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
            const count = finesByState.get(stateAbbr) || 0;
            return count > 0 ? labelFormat(count) : "";
        })
        .attr("fill", d => {
            const stateAbbr = reverseStateNameMapping[d.properties.STATE_NAME];
            const count = finesByState.get(stateAbbr) || 0;
            const color = mapColorScale(count);
            const colorIndex = colorRange.indexOf(color);
            return (colorIndex !== -1 && colorIndex >= splitIndex) ? "white" : "#374151";
        })
        .attr("stroke", d => {
            const stateAbbr = reverseStateNameMapping[d.properties.STATE_NAME];
            const count = finesByState.get(stateAbbr) || 0;
            const color = mapColorScale(count);
            const colorIndex = colorRange.indexOf(color);
            return (colorIndex !== -1 && colorIndex >= splitIndex) ? "#374151" : "white";
        });
    
    // 5. Update Legend
    const legend = mapSvg.select(".legendQuant");
    legend.selectAll("*").remove(); 
    
    const legendColors = mapColorScale.range();
    const legendWidth = mapWidth * 0.9 / legendColors.length;
    const legendFormat = d3.format(".2s"); 

    legend.selectAll("rect")
        .data(legendColors)
        .join("rect")
        .attr("x", (d, i) => i * legendWidth)
        .attr("y", 20)
        .attr("width", legendWidth)
        .attr("height", 10)
        .attr("fill", d => d);
    
    legend.append("text")
        .attr("x", 0)
        .attr("y", 43)
        .attr("fill", "#374151")
        .style("font-size", "12px")
        .text(legendFormat(0));
    
    legend.append("text")
        .attr("x", mapWidth * 0.9)
        .attr("y", 43)
        .attr("fill", "#374151")
        .style("font-size", "12px")
        .style("text-anchor", "end")
        .text(legendFormat(maxVal));
}