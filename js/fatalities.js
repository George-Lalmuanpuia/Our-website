// This file defines all the setup and update functions for the FATALITIES dashboard
// It relies on variables defined in shared-variables.js and shared-constants.js

// --- VIZ SETUP: SHARED VARS ---
// Note: These are declared in shared-variables.js
// let fatalitiesData, numbersData, geoData;
// let allJurisdictions;
// ... and all other shared vars

// Global state
let selectedTimeRange = null; // Stores [startDate, endDate] from brush
let selectedJurisdiction = null; // Stores "New South Wales", etc.

// --- D3 Scales & Generators ---
let xLine, yLine, xBrush, yBrush;
let lineGenerator, lineGeneratorCrashes, areaBrush;
let donutColorScale, pie, arc, outerArc; // <-- Arc/OuterArc are just declared here

// --- SETUP FUNCTIONS ---

function setupDeathFilters() {
    // Populate Jurisdiction filter
    d3.select("#filter-jurisdiction")
        .selectAll("option")
        .data(allJurisdictions)
        .join("option")
        .attr("value", d => d)
        .text(d => d);

    // Add event listeners
    d3.select("#filter-line-metric").on("change", updateDeathLineChart); // Only updates line chart
    d3.select("#filter-jurisdiction").on("change", () => {
        const value = d3.select("#filter-jurisdiction").property("value");
        selectedJurisdiction = (value === "All Australia") ? null : value;
        updateDeathVisualizations(); // Update all charts except line chart
    });
}

function setupDeathLineChart() {
    lineMargin = { top: 20, right: 40, bottom: 20, left: 60 };
    lineBrushMargin = { top: 10, right: 40, bottom: 30, left: 60 };

    const container = d3.select("#line-chart-container");
    // This chart is lg:col-span-2, so its width is usually fine on load.
    const containerWidth = container.node().getBoundingClientRect().width;
    
    // Main chart setup
    let lineWidth = containerWidth - lineMargin.left - lineMargin.right;
    let lineHeight = 300 - lineMargin.top - lineMargin.bottom;
    
    lineChartSvg = d3.select("#line-chart-viz")
        .attr("width", lineWidth + lineMargin.left + lineMargin.right)
        .attr("height", lineHeight + lineMargin.top + lineMargin.bottom)
        .append("g")
        .attr("transform", `translate(${lineMargin.left},${lineMargin.top})`);

    // Brush chart setup
    let lineBrushHeight = 75 - lineBrushMargin.top - lineBrushMargin.bottom;
    
    lineBrushSvg = d3.select("#line-chart-brush")
        .attr("width", lineWidth + lineBrushMargin.left + lineBrushMargin.right)
        .attr("height", lineBrushHeight + lineBrushMargin.top + lineBrushMargin.bottom)
        .append("g")
        .attr("transform", `translate(${lineBrushMargin.left},${lineBrushMargin.top})`);
        
    // --- Scales ---
    xLine = d3.scaleTime().range([0, lineWidth]);
    yLine = d3.scaleLinear().range([lineHeight, 0]);
    xBrush = d3.scaleTime().range([0, lineWidth]);
    yBrush = d3.scaleLinear().range([lineBrushHeight, 0]);

    // --- Data Aggregation (Monthly) ---
    const monthlyData = d3.rollup(numbersData, 
        v => ({
            NumberOfFatalities: d3.sum(v, d => d.NumberOfFatalities),
            NumberOfFatalCrashes: d3.sum(v, d => d.NumberOfFatalCrashes)
        }),
        d => d.Date
    );
    
    const monthlyAgg = Array.from(monthlyData, ([date, values]) => ({ Date: date, ...values }))
        .sort((a, b) => a.Date - b.Date);

    // Set scale domains
    const timeExtent = d3.extent(monthlyAgg, d => d.Date);
    xLine.domain(timeExtent);
    xBrush.domain(timeExtent);
    
    yLine.domain([0, d3.max(monthlyAgg, d => Math.max(d.NumberOfFatalities, d.NumberOfFatalCrashes))]).nice();
    yBrush.domain(yLine.domain());

    // --- Line/Area Generators ---
    lineGenerator = d3.line()
        .x(d => xLine(d.Date))
        .y(d => yLine(d.NumberOfFatalities));
        
    lineGeneratorCrashes = d3.line()
        .x(d => xLine(d.Date))
        .y(d => yLine(d.NumberOfFatalCrashes));
        
    areaBrush = d3.area()
        .x(d => xBrush(d.Date))
        .y0(lineBrushHeight)
        .y1(d => yBrush(d.NumberOfFatalities));

    // --- Axes ---
    lineChartSvg.append("g")
        .attr("class", "x-axis")
        .attr("transform", `translate(0, ${lineHeight})`)
        .call(d3.axisBottom(xLine));

    lineChartSvg.append("g")
        .attr("class", "y-axis")
        .call(d3.axisLeft(yLine).ticks(5).tickFormat(d3.format("d")));

    lineBrushSvg.append("g")
        .attr("class", "x-axis-brush")
        .attr("transform", `translate(0, ${lineBrushHeight})`)
        .call(d3.axisBottom(xBrush));

    // --- Draw Main Lines ---
    lineChartSvg.append("path")
        .datum(monthlyAgg)
        .attr("class", "line")
        .attr("id", "fatalities-line")
        .attr("fill", "none")
        .attr("stroke", d3.schemeTableau10[0])
        .attr("stroke-width", 2)
        .attr("d", lineGenerator); // Set d attribute on load

    lineChartSvg.append("path")
        .datum(monthlyAgg)
        .attr("class", "line")
        .attr("id", "crashes-line")
        .attr("fill", "none")
        .attr("stroke", d3.schemeTableau10[1])
        .attr("stroke-width", 2)
        .attr("d", lineGeneratorCrashes); // Set d attribute on load

    // --- Draw Brush Area ---
    lineBrushSvg.append("path")
        .datum(monthlyAgg)
        .attr("class", "area-brush")
        .attr("fill", "#ccc")
        .attr("d", areaBrush);
        
    // --- Brush ---
    const brush = d3.brushX()
        .extent([[0, 0], [lineWidth, lineBrushHeight]])
        .on("brush end", (event) => {
            if (event.selection) {
                const [x0, x1] = event.selection.map(xBrush.invert);
                selectedTimeRange = [x0, x1];
                // Update main chart's x-axis
                xLine.domain(selectedTimeRange);
                lineChartSvg.select(".x-axis").call(d3.axisBottom(xLine));
                // Filter data for zoomed view
                const filteredAgg = monthlyAgg.filter(p => p.Date >= x0 && p.Date <= x1);
                lineChartSvg.select("#fatalities-line").attr("d", lineGenerator(filteredAgg));
                lineChartSvg.select("#crashes-line").attr("d", lineGeneratorCrashes(filteredAgg));
            } else {
                selectedTimeRange = null;
                // Reset main chart's x-axis
                xLine.domain(xBrush.domain());
                lineChartSvg.select(".x-axis").call(d3.axisBottom(xLine));
                lineChartSvg.select("#fatalities-line").attr("d", lineGenerator(monthlyAgg));
                lineChartSvg.select("#crashes-line").attr("d", lineGeneratorCrashes(monthlyAgg));
            }
            // Trigger update for all other charts
            updateDeathVisualizations();
        });

    lineBrushSvg.append("g")
        .attr("class", "brush")
        .call(brush);
        
    // --- Line Chart Tooltip Overlay ---
    const focus = lineChartSvg.append("g")
        .attr("class", "tooltip-focus")
        .style("display", "none");

    focus.append("line").attr("class", "focus-line").attr("y1", 0).attr("y2", lineHeight).attr("stroke", "#374151").attr("stroke-width", 1).attr("stroke-dasharray", "3,3");
    
    lineChartSvg.append("rect")
        .attr("class", "tooltip-overlay")
        .attr("width", lineWidth)
        .attr("height", lineHeight)
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
        .on("mousemove", (event) => onDeathLineChartMousemove(event, monthlyAgg));
}

function setupDeathMap() {
    const container = d3.select("#map-container");
    let mapWidth = container.node().getBoundingClientRect().width;
    let mapHeight = 600; // Using viewBox, height is relative

    mapSvg = d3.select("#map-viz");

    // Projection
    mapProjection = d3.geoMercator()
        .center([133, -25])
        .scale(mapWidth * 0.9)
        .translate([mapWidth / 2, mapHeight / 2.2]);

    mapPath = d3.geoPath().projection(mapProjection);

    // Color Scale
    mapColorScale = d3.scaleQuantize()
        .range(d3.schemeReds[9]); // Red for fatalities

    // Draw Paths
    mapSvg.append("g")
        .selectAll("path")
        .data(geoData.features)
        .join("path")
        .attr("d", mapPath)
        .attr("class", "state")
        .attr("data-state-name", d => d.properties.STATE_NAME)
        .on("click", (event, d) => {
            const stateName = d.properties.STATE_NAME;
            const currentFilter = d3.select("#filter-jurisdiction").property("value");
            
            if (allJurisdictions.includes(stateName)) {
                const newFilterVal = (currentFilter === stateName) ? "All Australia" : stateName;
                d3.select("#filter-jurisdiction").property("value", newFilterVal);
                selectedJurisdiction = (newFilterVal === "All Australia") ? null : newFilterVal;
                updateDeathVisualizations();
            }
        })
        .on("mouseover", (event, d) => {
            const stateName = d.properties.STATE_NAME;
            const stateData = fatalitiesData.filter(f => 
                f.StateFullForm === stateName &&
                (!selectedTimeRange || (f.Year >= selectedTimeRange[0].getFullYear() && f.Year <= selectedTimeRange[1].getFullYear()))
            );
            const total = stateData.length;
            
            let html = `<strong>${stateName}</strong><br/>Total Fatalities: ${total.toLocaleString()}`;
            showTooltip(event, html);
        })
        .on("mousemove", moveTooltip)
        .on("mouseout", hideTooltip);
}

function setupDeathDonutChart() {
    // The setup function now ONLY creates the SVG 'g' group and non-dimension helpers.
    
    // Select the SVG and append the 'g' group
    donutChartSvg = d3.select("#donut-chart-viz")
        .append("g");
        // We will set the transform in the update function

    // Color scale for user types
    donutColorScale = d3.scaleOrdinal(d3.schemeTableau10);
    
    // Pie generator
    pie = d3.pie()
        .value(d => d.value)
        .sort(null);
        
    // Arc generators (arc, outerArc) are now created in the update function
}

function setupDeathBarChart() {
    // The setup function now ONLY creates the SVG 'g' group and non-dimension helpers.
    barMargin = { top: 20, right: 20, bottom: 40, left: 50 };

    barChartSvg = d3.select("#bar-chart-viz")
        .append("g");
    
    // Scales (domains and ranges will be set in the update function)
    xBarScale = d3.scaleBand();
    yBarScale = d3.scaleLinear();

    // Axes (will be called in update)
    barChartSvg.append("g")
        .attr("class", "x-axis");

    barChartSvg.append("g")
        .attr("class", "y-axis");
    
    // Y-axis Label
    barChartSvg.append("text")
        .attr("class", "y-axis-label")
        .attr("transform", "rotate(-90)")
        .attr("dy", "1em")
        .style("text-anchor", "middle")
        .attr("fill", "#374151")
        .text("Total Fatalities");
}


// --- UPDATE FUNCTIONS ---

function updateDeathLineChart() {
    const selectedMetric = d3.select("#filter-line-metric").property("value");

    const areaPath = (selectedMetric === "NumberOfFatalities") ? areaBrush : d3.area().x(d => xBrush(d.Date)).y0(lineBrushHeight).y1(d => yBrush(d.NumberOfFatalCrashes));
    
    // Hide/show lines
    d3.select("#fatalities-line").style("display", selectedMetric === "NumberOfFatalities" ? null : "none");
    d3.select("#crashes-line").style("display", selectedMetric === "NumberOfFatalCrashes" ? null : "none");

    // Update brush area to match
    lineBrushSvg.select(".area-brush")
        .transition().duration(300)
        .attr("d", areaPath);
        
    // Reset brush if it exists
    lineBrushSvg.select(".brush").call(d3.brush().clear);
    
    // Clear global filters and update
    selectedTimeRange = null;
    xLine.domain(xBrush.domain()); // Manually reset domain
    lineChartSvg.select(".x-axis").call(d3.axisBottom(xLine)); // Manually reset axis
    
    // Reset the line paths
    lineChartSvg.select("#fatalities-line").attr("d", lineGenerator);
    lineChartSvg.select("#crashes-line").attr("d", lineGeneratorCrashes);
    
    updateDeathVisualizations();
}

function updateDeathVisualizations() {
    // 1. Determine active filters
    let timeText = "all time";
    if (selectedTimeRange) {
        timeText = `from ${d3.timeFormat("%b %Y")(selectedTimeRange[0])} to ${d3.timeFormat("%b %Y")(selectedTimeRange[1])}`;
    }
    const jurisdictionText = selectedJurisdiction || "All Australia";

    // 2. Filter the fatalitiesData
    const filteredData = fatalitiesData.filter(d => {
        const inTime = !selectedTimeRange || (d.Year >= selectedTimeRange[0].getFullYear() && d.Year <= selectedTimeRange[1].getFullYear());
        const inJurisdiction = !selectedJurisdiction || d.StateFullForm === selectedJurisdiction;
        return inTime && inJurisdiction;
    });

    // 3. Update subtitles
    d3.select("#map-subtitle").text(`Total fatalities ${timeText}.`);
    d3.select("#donut-chart-subtitle").text(`Showing data for ${jurisdictionText}, ${timeText}.`);
    d3.select("#bar-chart-subtitle").text(`Showing data for ${jurisdictionText}, ${timeText}.`);

    // 4. Update the charts
    updateDeathMap(filteredData);
    updateDeathDonutChart(filteredData);
    updateDeathBarChart(filteredData);
}

function updateDeathMap(filteredData) {
    // Aggregate data by state
    const fatalitiesByState = d3.rollup(filteredData, 
        v => v.length, 
        d => d.StateFullForm
    );

    // Update color scale domain
    const maxFatalities = d3.max(Array.from(fatalitiesByState.values())) || 0;
    mapColorScale.domain([0, maxFatalities > 0 ? maxFatalities : 1]);

    // Update map paths
    mapSvg.selectAll(".state")
        .attr("fill", d => {
            const stateName = d.properties.STATE_NAME;
            const count = fatalitiesByState.get(stateName) || 0;
            return (count === 0) ? "#e5e7eb" : mapColorScale(count);
        })
        .attr("class", d => `state ${selectedJurisdiction === d.properties.STATE_NAME ? "selected" : ""}`)
        .on("mouseover", (event, d) => { // Re-bind mouseover to show filtered count
            const stateName = d.properties.STATE_NAME;
            const count = fatalitiesByState.get(stateName) || 0;
            showTooltip(event, `<strong>${stateName}</strong><br/>Total Fatalities: ${count.toLocaleString()}`);
        });
}

function updateDeathDonutChart(filteredData) {
    
    // --- 1. CALCULATE DIMENSIONS (MOVED FROM SETUP) ---
    // Get the container and its current size
    const container = d3.select("#donut-chart-container");
    let donutWidth = container.node().getBoundingClientRect().width;
    let donutHeight = 250;
    // Ensure radius is non-negative
    let donutRadius = Math.max(Math.min(donutWidth, donutHeight) / 2 - 20, 0);

    // Apply attributes to the SVG container
    d3.select("#donut-chart-viz")
        .attr("width", donutWidth)
        .attr("height", donutHeight);
    
    // Move the 'g' group to the center
    donutChartSvg.attr("transform", `translate(${donutWidth / 2}, ${donutHeight / 2})`);

    // --- 2. CREATE ARC GENERATORS (MOVED FROM SETUP) ---
    // (These now use the up-to-date radius)
    arc = d3.arc()
        .innerRadius(donutRadius * 0.5)
        .outerRadius(donutRadius);

    outerArc = d3.arc()
        .innerRadius(donutRadius * 0.9)
        .outerRadius(donutRadius * 0.9);

    // --- 3. AGGREGATE DATA (Original code) ---
    const dataByUserType = d3.rollup(filteredData, 
        v => v.length, 
        d => d.DeadPersonType
    );
    
    const pieData = Array.from(dataByUserType, ([key, value]) => ({ key, value }))
        .sort((a, b) => b.value - a.value);
        
    const total = d3.sum(pieData, d => d.value);

    // Set color domain
    donutColorScale.domain(pieData.map(d => d.key));

    // --- 4. DRAW SLICES (Original code) ---
    donutChartSvg.selectAll("path.slice")
        .data(pie(pieData), d => d.data.key)
        .join(
            enter => enter.append("path")
                .attr("class", "slice")
                .attr("fill", d => donutColorScale(d.data.key))
                .each(function(d) { this._current = d; }) // Store initial angle
                .style("opacity", 0)
                .attr("d", arc)
                .call(enter => enter.transition().duration(500)
                    .style("opacity", 1)),
            update => update
                .call(update => update.transition().duration(500)
                    .attrTween("d", function(d) {
                        const interpolate = d3.interpolate(this._current, d);
                        this._current = interpolate(0);
                        return (t) => arc(interpolate(t));
                    })),
            exit => exit
                .call(exit => exit.transition().duration(500)
                    .attrTween("d", function(d) {
                        const interpolate = d3.interpolate(this._current, {...this._current, startAngle: this._current.endAngle});
                        return (t) => arc(interpolate(t));
                    })
                    .style("opacity", 0)
                    .remove())
        )
        .on("mouseover", (event, d) => {
            const percent = total > 0 ? (d.data.value / total * 100).toFixed(1) : 0;
            showTooltip(event, `<strong>${d.data.key}</strong><br/>${d.data.value.toLocaleString()} Fatalities (${percent}%)`);
        })
        .on("mousemove", moveTooltip)
        .on("mouseout", hideTooltip);

    // --- 5. DRAW LABELS (Original code) ---
    donutChartSvg.selectAll("text.donut-label")
        .data(pie(pieData.filter(d => (d.value / total) > 0.05)), d => d.data.key) // Only label slices > 5%
        .join(
            enter => enter.append("text")
                .attr("class", "donut-label")
                .attr("transform", d => `translate(${outerArc.centroid(d)})`)
                .attr("dy", "0.35em")
                .style("text-anchor", "middle")
                .style("opacity", 0)
                .text(d => d.data.key)
                .call(enter => enter.transition().duration(500)
                    .style("opacity", 1)),
            update => update
                .call(update => update.transition().duration(500)
                    .attr("transform", d => `translate(${outerArc.centroid(d)})`)),
            exit => exit
                .call(exit => exit.transition().duration(500)
                    .style("opacity", 0)
                    .remove())
        );

    // --- 6. CENTER TEXT (Original code, with class bug fixed) ---
    const centerText = donutChartSvg.selectAll("text.center-text")
        .data([total]);
        
    centerText.enter()
        .append("text")
        .attr("class", "center-text") // <-- Use one class
        .attr("dy", "-0.1em")
        .style("text-anchor", "middle")
        .style("font-size", "2em") // <-- Set styles
        .style("font-weight", "bold") // <-- Set styles
        .merge(centerText)
        .text(d => d.toLocaleString());
        
    const centerSubText = donutChartSvg.selectAll("text.center-subtext")
        .data([total]);
        
    centerSubText.enter()
        .append("text")
        .attr("class", "center-subtext") // <-- Use one class
        .attr("dy", "1.1em")
        .style("text-anchor", "middle")
        .style("font-size", "0.9em") // <-- Set styles
        .style("fill", "#6b7280") // <-- Set styles
        .merge(centerSubText)
        .text("Total Fatalities");
}

function updateDeathBarChart(filteredData) {
    
    // --- 1. CALCULATE DIMENSIONS (MOVED FROM SETUP) ---
    const container = d3.select("#bar-chart-container");
    let barWidth = container.node().getBoundingClientRect().width - barMargin.left - barMargin.right;
    let barHeight = 250 - barMargin.top - barMargin.bottom;
    
    // Update SVG and 'g' group sizes
    d3.select("#bar-chart-viz")
        .attr("width", barWidth + barMargin.left + barMargin.right)
        .attr("height", barHeight + barMargin.top + barMargin.bottom);
        
    barChartSvg.attr("transform", `translate(${barMargin.left},${barMargin.top})`);
    
    // Update Y-Axis label position
    barChartSvg.select(".y-axis-label")
        .attr("y", 0 - barMargin.left + 10)
        .attr("x", 0 - (barHeight / 2));
        
    // --- 2. BIN DATA (Original code) ---
    const ageBins = [
        { key: "0-16", min: 0, max: 16 },
        { key: "17-25", min: 17, max: 25 },
        { key: "26-39", min: 26, max: 39 },
        { key: "40-64", min: 40, max: 64 },
        { key: "65+", min: 65, max: 200 }, // Use 200 as a high upper bound
        { key: "Unknown", min: -1, max: -1 } // For Age -1
    ];
    
    const ageData = ageBins.map(bin => {
        const count = filteredData.filter(d => {
            if (bin.key === "Unknown") return d.Age === -1;
            return d.Age >= bin.min && d.Age <= bin.max;
        }).length;
        return { AgeGroup: bin.key, Count: count };
    });

    // --- 3. UPDATE SCALES (MOVED/MODIFIED) ---
    xBarScale.domain(ageData.map(d => d.AgeGroup))
             .range([0, barWidth])
             .padding(0.1);
             
    yBarScale.domain([0, d3.max(ageData, d => d.Count) || 1]).nice()
             .range([barHeight, 0]);

    // --- 4. UPDATE AXES (MOVED/MODIFIED) ---
    barChartSvg.select(".x-axis")
        .attr("transform", `translate(0, ${barHeight})`) // Move x-axis to bottom
        .transition().duration(300)
        .call(d3.axisBottom(xBarScale));

    barChartSvg.select(".y-axis")
        .transition().duration(300)
        .call(d3.axisLeft(yBarScale).ticks(5).tickFormat(d3.format("d")));

    // --- 5. DRAW BARS (Original code) ---
    barChartSvg.selectAll("rect.bar")
        .data(ageData, d => d.AgeGroup)
        .join(
            enter => enter.append("rect")
                .attr("class", "bar")
                .attr("x", d => xBarScale(d.AgeGroup))
                .attr("y", yBarScale(0))
                .attr("width", xBarScale.bandwidth())
                .attr("height", 0)
                .attr("fill", d3.schemeTableau10[2])
                .call(enter => enter.transition().duration(500)
                    .attr("y", d => yBarScale(d.Count))
                    .attr("height", d => barHeight - yBarScale(d.Count))
                ),
            update => update
                .call(update => update.transition().duration(500)
                    .attr("x", d => xBarScale(d.AgeGroup)) // Need to update x/width in case of resize
                    .attr("width", xBarScale.bandwidth())
                    .attr("y", d => yBarScale(d.Count))
                    .attr("height", d => barHeight - yBarScale(d.Count))
                ),
            exit => exit
                .call(exit => exit.transition().duration(500)
                    .attr("y", yBarScale(0))
                    .attr("height", 0)
                    .remove())
        )
        .on("mouseover", (event, d) => {
            showTooltip(event, `<strong>Age Group: ${d.AgeGroup}</strong><br/>${d.Count.toLocaleString()} Fatalities`);
        })
        .on("mousemove", moveTooltip)
        .on("mouseout", hideTooltip);
}

// --- Line Chart Tooltip Handler ---
function onDeathLineChartMousemove(event, data) {
    if (data.length === 0) return;

    // Get the line chart's height, as it's not globally available
    let lineHeight = 300 - lineMargin.top - lineMargin.bottom;
    
    const x0 = xLine.invert(d3.pointer(event)[0]);
    const bisectDate = d3.bisector(d => d.Date).left;
    
    const i = bisectDate(data, x0, 1);
    const d0 = data[i - 1];
    const d1 = data[i];
    
    let d;
    if (d0 && d1) {
        d = (x0 - d0.Date > d1.Date - x0) ? d1 : d0;
    } else if (d0) {
        d = d0;
    } else if (d1) {
        d = d1;
    } else {
        return;
    }

    d3.select(".tooltip-focus")
      .attr("transform", `translate(${xLine(d.Date)},0)`)
      .select("line")
      .attr("y2", lineHeight); // Ensure focus line has correct height
    
    tooltip.html(`
        <strong>${d3.timeFormat("%B %Y")(d.Date)}</strong><br/>
        Fatalities: ${d.NumberOfFatalities.toLocaleString()}<br/>
        Fatal Crashes: ${d.NumberOfFatalCrashes.toLocaleString()}
    `)
    .style("left", (event.pageX + 15) + "px")
    .style("top", (event.pageY - 10) + "px");
}