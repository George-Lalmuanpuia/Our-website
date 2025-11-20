*Team Number* - 20

*Team Members* - Nyi La Min (105735585) and Lalmuanpuia (105735572)

*Project Title* - Visualizing Road Safety Enforcement Across Australia

*Overview* - This project aims to enhance and modernize the Australian Government's transport enforcement data visualization by creating a highly interactive, multi-page dashboard. The system utilizes D3.js, HTML, and CSS to present two distinct but related public safety stories: Road Safety Enforcement (fines, breath tests, drug tests) and Road Fatalities. Users can explore granular data, such as offense type and age group, through coordinated views including Choropleth Maps, Stacked Bar Charts, and Historical Line Charts, all interconnected by dynamic filters for year and jurisdiction, transforming raw CSV data into actionable, visual insights for police and the general public.

*Project Folder and File Structure*

│

├── 📄 home.html                <- Main Navigation/Landing Page

├── 📄 fines.html               <- Enforcement Dashboard (Main Fines View)

├── 📄 breath-drug.html         <- Enforcement Dashboard (Breath/Drug View)

├── 📄 deaths.html              <- Fatalities Dashboard

│

├── 📂 js/

│   ├── 📄 dashboard.js         <- Logic for fines.html and breath-drug.html (Enforcement Vizzes)

│   ├── 📄 fatalities.js        <- Logic for deaths.html (Fatalities Vizzes)

│   ├── 📄 load-data.js         <- *CRITICAL:* Handles page detection and loads the correct data

│   ├── 📄 script.js            <- General utilities (e.g., Navbar highlighting)

│   ├── 📄 shared-constants.js  <- D3 constants (Tooltip functions, state maps)

│   ├── 📄 shared-variables.js  <- Global variables (data arrays, D3 selections)

│

├── 📂 css/

│   ├── 📄 style.css            <- All custom and D3-specific CSS

│

├── 📂 data/                    <- **Recommended** folder for all your CSVs

│   ├── 📄 BITRE_fatalities.csv

│   ├── 📄 BITRE_NumbersOfFatals.csv

│   ├── 📄 Fines.csv

│   ├── 📄 PositiveBreathTestCountInEachJurisdictionPerYear.csv

│   ├── 📄 PositiveDrugTestCountInEachJurisdictionPerYear.csv

│   ├── 📄 TotalLicenceHolders.csv

│   ├── 📄 TotalLicenceHoldersBySex.csv

│   └── 📄 YearMetricCountByJurisdiction.csv

*List of finalized and selected datasets used in the website*

1. BITRE_fatalities.csv
2. BITRE_NumbersOfFatals.csv
3. Fines.csv
4. PositiveBreathTestCountInEachJurisdictionPerYear.csv
5. PositiveDrugTestCountInEachJurisdictionPerYear.csv
6. TotalLicenceHoldersBySex.csv
7. YearMetricCountByJurisdiction.csv


*Generative AI Declaration for Australian Transport Data Project*

General Statement

The majority of the code and documentation for this project—including the core structure, logic, layout, and textual content (e.g., this declaration, the project overview, and report drafts)—was designed, generated, and iteratively refined using a Large Language Model (LLM), specifically a Gemini model built by Google.

LLM Usage and Roles

The LLM served primarily in three roles:

Architecture and Code Generation: The LLM was responsible for translating the project requirements and data schema into functional JavaScript (D3.js), HTML, and CSS. This included setting up the multi-file architecture (load-data.js, dashboard.js, fatalities.js, shared-variables.js, etc.), handling the asynchronous loading and parsing of multiple CSV and GeoJSON files, and implementing the core D3.js idioms (e.g., choropleth maps, stacked bar charts, time-series lines, and pie charts).

Iterative Refinement and Debugging: The LLM analyzed and resolved multiple runtime errors, including data path errors, script load order dependencies, and D3-specific logic bugs, ensuring the functionality of the interactive filters and coordinated views.

Documentation and Reporting: The LLM generated the project overview, the draft for the Visualization Design report section (Section 4), and this declaration, based on provided academic requirements and structural constraints.

Human Involvement

The Human user was responsible for the following creative and executive decisions:

Defining the Project Scope and Data: Providing the specific task, the five initial CSV datasets (Fines.csv, YearMetricCountByJurisdiction.csv, etc.), and the two subsequent datasets (BITRE_fatalities.csv, BITRE_NumbersOfFatals.csv).

Guiding Visualization Design: Specifying the core visual requirements (e.g., using D3.js, creating 2 charts and 1 map), the need for specific filters (Year, Jurisdiction, Metric), and the high-level interactive behavior (cross-filtering between map and charts).

Final Review and Integration: The Human user is responsible for the final placement of all files in the project directory and validating the final compiled output against the original project brief.
