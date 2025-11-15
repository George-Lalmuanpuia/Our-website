// This file defines all the setup and update functions for the FATALITIES dashboard
// It relies on variables defined in shared-variables.js and shared-constants.js

// --- VIZ SETUP: SHARED VARS ---
let selectedTimeRange = null; 
let selectedJurisdiction = null; 

let lineGenerator, lineGeneratorCrashes, areaBrush;
let donutColorScale, pie, arc, outerArc; 
let lineBrushHeight;


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
    d3.select("#filter-line-metric").on("change", updateDeathLineChart);
    d3.select("#filter-jurisdiction").on("change", () => {
        const value = d3.select("#filter-jurisdiction").property("value");
        selectedJurisdiction = (value === "All Australia") ? null : value;
        updateDeathVisualizations();
    });
}

function setupDeathLineChart() {
    lineMargin = { top: 20, right: 40, bottom: 20, left: 60 };
    lineBrushMargin = { top: 10, right: 40, bottom: 30, left: 60 };

    const container = d3.select("#line-chart-container");
    const containerWidth = container.node().getBoundingClientRect().width;
    
    let lineWidth = containerWidth - lineMargin.left - lineMargin.right;
    let lineHeight = 300 - lineMargin.top - lineMargin.bottom;
    
    lineChartSvg = d3.select("#line-chart-viz")
        .attr("width", lineWidth + lineMargin.left + lineMargin.right)
        .attr("height", lineHeight + lineMargin.top + lineMargin.bottom)
        .append("g")
        .attr("transform", `translate(${lineMargin.left},${lineMargin.top})`);

    lineBrushHeight = 75 - lineBrushMargin.top - lineBrushMargin.bottom;
    
    lineBrushSvg = d3.select("#line-chart-brush")
        .attr("width", lineWidth + lineBrushMargin.left + lineBrushMargin.right)
        .attr("height", lineBrushHeight + lineBrushMargin.top + lineBrushMargin.bottom)
        .append("g")
        .attr("transform", `translate(${lineBrushMargin.left},${lineBrushMargin.top})`);
        
    xLine = d3.scaleTime().range([0, lineWidth]);
    yLine = d3.scaleLinear().range([lineHeight, 0]);
    xBrush = d3.scaleTime().range([0, lineWidth]);
    yBrush = d3.scaleLinear().range([lineBrushHeight, 0]);

    const monthlyData = d3.rollup(numbersData, 
        v => ({
            NumberOfFatalities: d3.sum(v, d => d.NumberOfFatalities),
            NumberOfFatalCrashes: d3.sum(v, d => d.NumberOfFatalCrashes)
        }),
        d => d.Date
    );
    
    const monthlyAgg = Array.from(monthlyData, ([date, values]) => ({ Date: date, ...values }))
        .sort((a, b) => a.Date - b.Date);

    const timeExtent = d3.extent(monthlyAgg, d => d.Date);
    xLine.domain(timeExtent);
    xBrush.domain(timeExtent);
    
    yLine.domain([0, d3.max(monthlyAgg, d => Math.max(d.NumberOfFatalities, d.NumberOfFatalCrashes))]).nice();
    yBrush.domain(yLine.domain());

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

    lineChartSvg.append("path")
        .datum(monthlyAgg)
        .attr("class", "line")
        .attr("id", "fatalities-line")
        .attr("fill", "none")
        .attr("stroke", d3.schemeTableau10[0])
        .attr("stroke-width", 2)
        .attr("d", lineGenerator);

    lineChartSvg.append("path")
        .datum(monthlyAgg)
        .attr("class", "line")
        .attr("id", "crashes-line")
        .attr("fill", "none")
        .attr("stroke", d3.schemeTableau10[1])
        .attr("stroke-width", 2)
        .attr("d", lineGeneratorCrashes);

    lineBrushSvg.append("path")
        .datum(monthlyAgg)
        .attr("class", "area-brush")
        .attr("fill", "#ccc")
        .attr("d", areaBrush);
        
    const brush = d3.brushX()
        .extent([[0, 0], [lineWidth, lineBrushHeight]])
        .on("brush end", (event) => {
            if (event.selection) {
                const [x0, x1] = event.selection.map(xBrush.invert);
                selectedTimeRange = [x0, x1];
                xLine.domain(selectedTimeRange);
                lineChartSvg.select(".x-axis").call(d3.axisBottom(xLine));
                const filteredAgg = monthlyAgg.filter(p => p.Date >= x0 && p.Date <= x1);
                lineChartSvg.select("#fatalities-line").attr("d", lineGenerator(filteredAgg));
                lineChartSvg.select("#crashes-line").attr("d", lineGeneratorCrashes(filteredAgg));
            } else {
                selectedTimeRange = null;
                xLine.domain(xBrush.domain());
                lineChartSvg.select(".x-axis").call(d3.axisBottom(xLine));
                lineChartSvg.select("#fatalities-line").attr("d", lineGenerator(monthlyAgg));
                lineChartSvg.select("#crashes-line").attr("d", lineGeneratorCrashes(monthlyAgg));
            }
            updateDeathVisualizations();
        });

    lineBrushSvg.append("g")
        .attr("class", "brush")
        .call(brush);
        
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
    const viewBoxWidth = 800;
    const viewBoxHeight = 600;

    mapSvg = d3.select("#map-viz");

    mapProjection = d3.geoMercator()
        .center([133, -25])
        .scale(viewBoxWidth * 0.9)
        .translate([viewBoxWidth / 2, viewBoxHeight / 2.2]);

    mapPath = d3.geoPath().projection(mapProjection);

    mapColorScale = d3.scaleQuantize()
        .range(d3.schemeReds[9]); 

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

    mapSvg.append("g")
        .attr("class", "legendQuant")
        .attr("transform", `translate(${viewBoxWidth * 0.05}, ${viewBoxHeight * 0.9})`);
}

function setupDeathDonutChart() {
    donutChartSvg = d3.select("#donut-chart-viz")
        .append("g");

    donutColorScale = d3.scaleOrdinal(d3.schemeTableau10);
    
    pie = d3.pie()
        .value(d => d.value)
        .sort(null);
}

function setupDeathBarChart() {
    barMargin = { top: 20, right: 20, bottom: 40, left: 50 };

    barChartSvg = d3.select("#bar-chart-viz")
        .append("g");
    
    xBarScale = d3.scaleBand();
    yBarScale = d3.scaleLinear();

    barChartSvg.append("g")
        .attr("class", "x-axis");

    barChartSvg.append("g")
        .attr("class", "y-axis");
    
    barChartSvg.append("text")
        .attr("class", "y-axis-label")
        .attr("transform", "translate(50,20)")
        .attr("dy", "1em")
        .style("text-anchor", "top")
        .attr("fill", "#374151")
        .text("Total Fatalities");

    barChartSvg.append("text")
        .attr("class", "x-axis-label")
        .attr("dx", "15em")
        .attr("dy", "14em")
        .attr("text-anchor", "bottom")
        .attr("fill", "#374151")
        .text("Age Groups");
}


// --- UPDATE FUNCTIONS ---

function updateDeathLineChart() {
    const selectedMetric = d3.select("#filter-line-metric").property("value");
    const areaPath = (selectedMetric === "NumberOfFatalities") ? areaBrush : d3.area().x(d => xBrush(d.Date)).y0(lineBrushHeight).y1(d => yBrush(d.NumberOfFatalCrashes));
    
    // This part is correct, it hides/shows the lines
    d3.select("#fatalities-line").style("display", selectedMetric === "NumberOfFatalities" ? null : "none");
    d3.select("#crashes-line").style("display", selectedMetric === "NumberOfFatalCrashes" ? null : "none");

    lineBrushSvg.select(".area-brush")
        .transition().duration(300)
        .attr("d", areaPath);
        
    lineBrushSvg.select(".brush").call(d3.brush().clear);
    
    selectedTimeRange = null;
    xLine.domain(xBrush.domain());
    lineChartSvg.select(".x-axis").call(d3.axisBottom(xLine));
    
    lineChartSvg.select("#fatalities-line").attr("d", lineGenerator);
    lineChartSvg.select("#crashes-line").attr("d", lineGeneratorCrashes);
    
    // This call is what triggers the crash
    updateDeathVisualizations();
}

function updateDeathVisualizations() {
    let timeText = "all time";
    if (selectedTimeRange) {
        timeText = `from ${d3.timeFormat("%b %Y")(selectedTimeRange[0])} to ${d3.timeFormat("%b %Y")(selectedTimeRange[1])}`;
    }
    const jurisdictionText = selectedJurisdiction || "All Australia";

    const filteredData = fatalitiesData.filter(d => {
        const inTime = !selectedTimeRange || (d.Year >= selectedTimeRange[0].getFullYear() && d.Year <= selectedTimeRange[1].getFullYear());
        const inJurisdiction = !selectedJurisdiction || d.StateFullForm === selectedJurisdiction;
        return inTime && inJurisdiction;
    });

    d3.select("#map-subtitle").text(`Total fatalities ${timeText}.`);
    d3.select("#donut-chart-subtitle").text(`Showing data for ${jurisdictionText}, ${timeText}.`);
    d3.select("#bar-chart-subtitle").text(`Showing data for ${jurisdictionText}, ${timeText}.`);

    updateDeathMap(filteredData);
    updateDeathDonutChart(filteredData); // This function contains the bug
    updateDeathBarChart(filteredData);
}

function updateDeathMap(filteredData) {
    const viewBoxWidth = 800;

    const fatalitiesByState = d3.rollup(filteredData, 
        v => v.length, 
        d => d.StateFullForm
    );

    const maxFatalities = d3.max(Array.from(fatalitiesByState.values())) || 0;
    mapColorScale.domain([0, maxFatalities > 0 ? maxFatalities : 1]);

    mapSvg.selectAll(".state")
        .attr("fill", d => {
            const stateName = d.properties.STATE_NAME;
            const count = fatalitiesByState.get(stateName) || 0;
            return (count === 0) ? "#e5e7eb" : mapColorScale(count);
        })
        .attr("class", d => `state ${selectedJurisdiction === d.properties.STATE_NAME ? "selected" : ""}`)
        .on("mouseover", (event, d) => {
            const stateName = d.properties.STATE_NAME;
            const count = fatalitiesByState.get(stateName) || 0;
            showTooltip(event, `<strong>${stateName}</strong><br/>Total Fatalities: ${count.toLocaleString()}`);
        });
    
    const legend = mapSvg.select(".legendQuant");
    legend.selectAll("*").remove();
    
    const legendColors = mapColorScale.range();
    const legendWidth = viewBoxWidth * 0.9 / legendColors.length; 
    const legendFormat = d3.format(".0f"); 

    legend.selectAll("rect")
        .data(legendColors)
        .join("rect")
        .attr("x", (d, i) => i * legendWidth)
        .attr("y", 30)
        .attr("width", legendWidth)
        .attr("height", 10)
        .attr("fill", d => d);
    
    legend.append("text")
        .attr("x", 0)
        .attr("y", 50)
        .attr("fill", "#374151")
        .style("font-size", "12px")
        .text(legendFormat(0));
    
    legend.append("text")
        .attr("x", viewBoxWidth * 0.9)
        .attr("y", 50)
        .attr("fill", "#374151")
        .style("font-size", "12px")
        .style("text-anchor", "end")
        .text(legendFormat(maxFatalities));
}

// --- THIS IS THE CORRECTED FUNCTION ---
function updateDeathDonutChart(filteredData) {
    
    // --- 1. CALCULATE DIMENSIONS ---
    const container = d3.select("#donut-chart-container");
    let donutWidth = container.node().getBoundingClientRect().width;
    let donutHeight = 250;
    let donutRadius = Math.max(Math.min(donutWidth, donutHeight) / 2 - 20, 0);

    d3.select("#donut-chart-viz")
        .attr("width", donutWidth)
        .attr("height", donutHeight);
    
    donutChartSvg.attr("transform", `translate(${donutWidth / 2}, ${donutHeight / 2})`);

    // --- 2. CREATE ARC GENERATORS ---
    arc = d3.arc()
        .innerRadius(donutRadius * 0.5)
        .outerRadius(donutRadius);

    outerArc = d3.arc()
        .innerRadius(donutRadius * 0.9)
        .outerRadius(donutRadius * 0.9);

    // --- 3. AGGREGATE DATA ---
    const dataByUserType = d3.rollup(filteredData, 
        v => v.length, 
        d => d.DeadPersonType
    );
    
    const pieData = Array.from(dataByUserType, ([key, value]) => ({ key, value }))
        .sort((a, b) => b.value - a.value);
        
    const total = d3.sum(pieData, d => d.value);

    donutColorScale.domain(pieData.map(d => d.key));

    // --- 4. DRAW SLICES ---
    donutChartSvg.selectAll("path.slice")
        .data(pie(pieData), d => d.data.key) // This .data() call IS correct
        .join(
            enter => enter.append("path")
                .attr("class", "slice")
                .attr("fill", d => donutColorScale(d.data.key))
                .each(function(d) { this._current = d; })
                .style("opacity", 1) 
                .attr("d", arc),
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

    // --- 5. DRAW LABELS (REMOVED) ---
    donutChartSvg.selectAll("text.donut-label").remove();
    
    // --- 6. (NEW) DRAW LEGEND ---
    const legendContainer = d3.select("#donut-chart-legend");

    legendContainer.selectAll("div.legend-item")
        .data(pieData, d => d.key) // <-- FIX 1: Was d.data.key
        .join(
            enter => {
                const item = enter.append("div")
                    .attr("class", "legend-item");

                // Add color swatch
                item.append("svg")
                    .attr("width", 12)
                    .attr("height", 12)
                    .append("rect")
                    .attr("width", 12)
                    .attr("height", 12)
                    .attr("fill", d => donutColorScale(d.key)); // <-- FIX 2: Was d.data.key

                // Add text label
                item.append("span")
                    .attr("class", "legend-text")
                    .text(d => d.key); // <-- FIX 3: Was d.data.key
                
                return item;
            },
            update => update,
            exit => exit.remove()
        );


    // --- 7. CENTER TEXT ---
    const centerText = donutChartSvg.selectAll("text.center-text")
        .data([total]);
        
    centerText.enter()
        .append("text")
        .attr("class", "center-text")
        .attr("dy", "-0.1em")
        .style("text-anchor", "middle")
        .style("font-size", "2em")
        .style("font-weight", "bold")
        .merge(centerText)
        .text(d => d.toLocaleString());
        
    const centerSubText = donutChartSvg.selectAll("text.center-subtext")
        .data([total]);
        
    centerSubText.enter()
        .append("text")
        .attr("class", "center-subtext")
        .attr("dy", "1.1em")
        .style("text-anchor", "middle")
        .style("font-size", "0.9em")
        .style("fill", "#6b7280")
        .merge(centerSubText)
        .text("Total Fatalities");
}
// --- END OF CORRECTED FUNCTION ---


function updateDeathBarChart(filteredData) {
    
    // --- 1. CALCULATE DIMENSIONS ---
    const container = d3.select("#bar-chart-container");
    let barWidth = container.node().getBoundingClientRect().width - barMargin.left - barMargin.right;
    let barHeight = 250 - barMargin.top - barMargin.bottom;
    
    barWidth = Math.max(barWidth, 0);
    barHeight = Math.max(barHeight, 0);
    
    d3.select("#bar-chart-viz")
        .attr("width", barWidth + barMargin.left + barMargin.right)
        .attr("height", barHeight + barMargin.top + barMargin.bottom);
        
    barChartSvg.attr("transform", `translate(${barMargin.left},${barMargin.top})`);
    
    barChartSvg.select(".y-axis-label")
        .attr("y", 0 - barMargin.left + 10)
        .attr("x", 0 - (barHeight / 2));
        
    // --- 2. BIN DATA ---
    const ageBins = [
        { key: "0-16", min: 0, max: 16 },
        { key: "17-25", min: 17, max: 25 },
        { key: "26-39", min: 26, max: 39 },
        { key: "40-64", min: 40, max: 64 },
        { key: "65+", min: 65, max: 200 },
        { key: "Unknown", min: -1, max: -1 }
    ];
    
    const ageData = ageBins.map(bin => {
        const count = filteredData.filter(d => {
            if (bin.key === "Unknown") return d.Age === -1;
            return d.Age >= bin.min && d.Age <= bin.max;
        }).length;
        return { AgeGroup: bin.key, Count: count };
    });

    // --- 3. UPDATE SCALES ---
    xBarScale.domain(ageData.map(d => d.AgeGroup))
             .range([0, barWidth])
             .padding(0.1);
             
    yBarScale.domain([0, d3.max(ageData, d => d.Count) || 1]).nice()
             .range([barHeight, 0]);

    // --- 4. UPDATE AXES ---
    barChartSvg.select(".x-axis")
        .attr("transform", `translate(0, ${barHeight})`)
        .transition().duration(300)
        .call(d3.axisBottom(xBarScale));

    barChartSvg.select(".y-axis")
        .transition().duration(300)
        .call(d3.axisLeft(yBarScale).ticks(5).tickFormat(d3.format("d")));

    // --- 5. DRAW BARS ---
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
                    .attr("x", d => xBarScale(d.AgeGroup))
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
      .attr("y2", lineHeight);
    
    tooltip.html(`
        <strong>${d3.timeFormat("%B %Y")(d.Date)}</strong><br/>
        Fatalities: ${d.NumberOfFatalities.toLocaleString()}<br/>
        Fatal Crashes: ${d.NumberOfFatalCrashes.toLocaleString()}
    `)
    .style("left", (event.pageX + 15) + "px")
    .style("top", (event.pageY - 10) + "px");
}