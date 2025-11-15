// Maps GeoJSON names to CSV abbreviations
const stateNameMapping = {
    "NSW": "New South Wales",
    "VIC": "Victoria",
    "QLD": "Queensland",
    "SA": "South Australia",
    "WA": "Western Australia",
    "TAS": "Tasmania",
    "NT": "Northern Territory",
    "ACT": "Australian Capital Territory"
};
// Create a reverse map for convenience (e.g., "New South Wales" -> "NSW")
const reverseStateNameMapping = Object.fromEntries(
    Object.entries(stateNameMapping).map(([key, value]) => [value, key])
);

// --- TOOLTIP SETUP ---
const tooltip = d3.select("#tooltip");

const showTooltip = (event, html) => {
    tooltip.style("opacity", 1)
           .html(html)
           .style("left", (event.pageX + 15) + "px")
           .style("top", (event.pageY - 10) + "px");
};

const moveTooltip = (event) => {
    tooltip.style("left", (event.pageX + 15) + "px")
           .style("top", (event.pageY - 10) + "px");
};

const hideTooltip = () => {
    tooltip.style("opacity", 0);
};