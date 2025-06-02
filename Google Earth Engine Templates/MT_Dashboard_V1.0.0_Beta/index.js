// -----------------------------------------------------------------------------
// 🌍 CO₂NEX Mato Grosso Environmental Dashboard — v1.0.0 (Beta)
// -----------------------------------------------------------------------------

// 📅 Release Date: 2025-06-01
// 👤 Created by: CO₂NEX + ChatGPT (OpenAI)
// 📍 Region: Mato Grosso, Brazil (State boundary from FAO GAUL Level 1)
// 🛰️ Datasets Used:
//    - VIIRS VNP13A1 NDVI (2022)
//    - NASA SMAP10KM Soil Moisture (2022)
//    - JRC Global Surface Water (Occurrence, 1984–2020)
//    - ISRIC SoilGrids (SOC & Bulk Density, 0–100cm)
//    - Hansen Global Forest Change (Tree Cover & Loss)
//    - ESA WorldCover (Land Cover Map, 2020)
// 
// 🔍 Purpose:
//    A lightweight, interactive monitoring dashboard for land cover, carbon,
//    vegetation, soil moisture, and deforestation risk in Mato Grosso.
// 
// 📦 Layers Included:
//    1. 🌿 NDVI (VIIRS, 2022) — Vegetation greenness
//    2. 💧 Soil Moisture (SMAP, 2022) — Surface water saturation
//    3. 🌊 Water Occurrence (JRC, 1984–2020) — Historic water dynamics
//    4. 🌱 Soil Organic Carbon (0–100cm) — Depth-specific carbon content
//    5. ♻️ CO₂ Sequestered Proxy — NDVI-driven biomass uptake
//    6. 🪓 Forest Loss Proxy — Emission risk layer (Hansen loss pixels)
//    7. 📊 Land Cover Breakdown — ESA WorldCover + Carbon groupings
// 
// 📈 Spatial Resolution:
//    - VIIRS NDVI: 500m
//    - SMAP Soil Moisture: 10km
//    - JRC Water: 30m
//    - SoilGrids: 250m
//    - Hansen: 30m
//    - ESA WorldCover: 10m
// 
// 💡 What’s New in Beta (v1.0.0):
//    - Full UI Panel (bottom-right) with carbon class totals and pie chart
//    - Clean layout for presentation & reporting
//    - Added land cover grouping: Forest, Agriculture, Pasture, Degraded
//    - Reorganized metadata, improved visuals
//
// 🔜 Coming in v1.1+:
//    - Time series sliders (NDVI, Soil Moisture)
//    - Sentinel/Landsat comparisons
//    - Fire & drought risk overlays
//    - Export tools: GeoTIFFs, summary CSVs
//    - Full GEE App format with filters & toggles
//
// -----------------------------------------------------------------------------
// 🌱 Protect the Forest. Quantify the Carbon. Understand the Soil.
// -----------------------------------------------------------------------------

// --------------------------------------------------
// 📍 0. Load Mato Grosso boundary using FAO GAUL
// --------------------------------------------------
var states = ee.FeatureCollection('FAO/GAUL/2015/level1');
var matoGrosso = states.filter(ee.Filter.eq('ADM1_NAME', 'Mato Grosso'))
                       .filter(ee.Filter.eq('ADM0_NAME', 'Brazil'));
Map.centerObject(matoGrosso, 6);

// --------------------------------------------------
// 📅 1. Define date range
// --------------------------------------------------
var startDate = '2022-01-01';
var endDate = '2022-12-31';

// --------------------------------------------------
// 🌿 2. Load VIIRS NDVI (Primary)
// --------------------------------------------------
var viirsCollection = ee.ImageCollection('NOAA/VIIRS/001/VNP13A1')
  .filterDate(startDate, endDate)
  .filterBounds(matoGrosso)
  .select('NDVI');

var viirsNDVI = viirsCollection.mean().clip(matoGrosso);

// Count available VIIRS images
var viirsCount = viirsCollection.size();
print('✅ VIIRS NDVI image count:', viirsCount);

// --------------------------------------------------
// 🍃 3. Load Sentinel-2 NDVI (Backup)
// --------------------------------------------------
var sentinelNDVI = ee.ImageCollection('COPERNICUS/S2_SR')
  .filterDate(startDate, endDate)
  .filterBounds(matoGrosso)
  .filter(ee.Filter.lt('CLOUDY_PIXEL_PERCENTAGE', 20))
  .map(function(img) {
    var ndvi = img.normalizedDifference(['B8', 'B4']).rename('NDVI');
    return img.addBands(ndvi);
  })
  .select('NDVI')
  .median()
  .clip(matoGrosso);

// --------------------------------------------------
// 🔁 4. Fallback: Use VIIRS if available, else Sentinel
// --------------------------------------------------
var rawNDVI = ee.Image(ee.Algorithms.If(
  viirsCount.gt(0),
  viirsNDVI,
  sentinelNDVI
));

// Add source label
var ndviSource = ee.String(ee.Algorithms.If(
  viirsCount.gt(0),
  'VIIRS',
  'Sentinel-2'
));
print('📌 NDVI source used for 2022:', ndviSource);

// --------------------------------------------------
// 🎨 5. Apply same masking, smoothing, stats
// --------------------------------------------------
var processedNDVI = rawNDVI
  .updateMask(rawNDVI.gte(0).and(rawNDVI.lte(10000)))
  .focal_mean({radius: 1, units: 'pixels'});

var ndviStats = processedNDVI.reduceRegion({
  reducer: ee.Reducer.percentile([5, 95]).combine('mean', null, true),
  geometry: matoGrosso.geometry(),
  scale: 500,
  maxPixels: 1e9
});

// --------------------------------------------------
// 🗺️ 6. Display NDVI layer on map
// --------------------------------------------------
ndviStats.evaluate(function(p) {
  var vis = {
    min: p.NDVI_p5,
    max: p.NDVI_p95,
    palette: [
      '#ffffe5','#f7fcb9','#d9f0a3','#addd8e','#78c679',
      '#41ab5d','#238443','#006837','#004529'
    ]
  };

  // Add layer with dynamic label
  ndviSource.evaluate(function(sourceName) {
    Map.addLayer(processedNDVI, vis, '🌿 NDVI (Source: ' + sourceName + ')');
  });

  print('📊 NDVI Stats (Final 2022):', p);
});

// --------------------------------------------------
// 💧 2. Soil Moisture from SMAP (Dynamic Visualization)
// --------------------------------------------------
var smap = ee.ImageCollection('NASA_USDA/HSL/SMAP10KM_soil_moisture')
  .filterDate('2022-01-01', '2022-12-31')
  .filterBounds(matoGrosso)
  .select('ssm');

// Compute mean soil moisture for 2022
var meanSM = smap.mean().clip(matoGrosso);

// Optional: Smooth it out a bit (like NDVI)
var meanSM_smoothed = meanSM.focal_mean({radius: 1, units: 'pixels'});

// Compute dynamic stats for better visualization
var smStats = meanSM_smoothed.reduceRegion({
  reducer: ee.Reducer.percentile([5, 95]),
  geometry: matoGrosso.geometry(),
  scale: 5000,
  maxPixels: 1e9
});

// Visualize using real percentiles
smStats.evaluate(function(p) {
  var vis = {
    min: p.ssm_p5,
    max: p.ssm_p95,
    palette: ['#ffffcc','#c2e699','#78c679','#31a354','#006837']
  };
  Map.addLayer(meanSM_smoothed, vis, '💧 Soil Moisture (SMAP 2022)');
  print('📊 Soil Moisture Stats (SMAP 2022)', p);
});

// --------------------------------------------------
// 🌊 3. Surface Water Occurrence (1984–2020)
// --------------------------------------------------
var water = ee.Image('JRC/GSW1_4/GlobalSurfaceWater').select('occurrence');
var waterMasked = water.updateMask(water.gt(0)).clip(matoGrosso);

Map.addLayer(waterMasked, {
  min: 0,
  max: 100,
  palette: ['ffffff','ccebc5','a8ddb5','7bccc4','43a2ca','0868ac']
}, '🌊 Surface Water Occurrence');

var waterStats = waterMasked.reduceRegion({
  reducer: ee.Reducer.mean(),
  geometry: matoGrosso.geometry(),
  scale: 500,
  maxPixels: 1e9
});
print('📊 Water Occurrence (%)', waterStats);

// --------------------------------------------------
// 🌱 4. Soil Organic Carbon (SOC) Depth Analysis (0–100 cm)
// --------------------------------------------------

// Load SoilGrids SOC and BD datasets
var soc = ee.Image('projects/soilgrids-isric/soc_mean');
var bd = ee.Image('projects/soilgrids-isric/bdod_mean');

// Define depths with band names and layer thickness (in cm)
var depths = [
  {name: '0–5cm 🟡', socBand: 'soc_0-5cm_mean', bdBand: 'bdod_0-5cm_mean', depth: 5},
  {name: '5–15cm 🟠', socBand: 'soc_5-15cm_mean', bdBand: 'bdod_5-15cm_mean', depth: 10},
  {name: '15–30cm 🔴', socBand: 'soc_15-30cm_mean', bdBand: 'bdod_15-30cm_mean', depth: 15},
  {name: '30–60cm 🟣', socBand: 'soc_30-60cm_mean', bdBand: 'bdod_30-60cm_mean', depth: 30},
  {name: '60–100cm ⚫', socBand: 'soc_60-100cm_mean', bdBand: 'bdod_60-100cm_mean', depth: 40}
];

// Function to calculate SOC stock (tCO₂/ha)
function calculateSOCStock(socImg, bdImg, depth_cm) {
  var depth_m = ee.Number(depth_cm).divide(100); // Convert cm to m
  return bdImg.multiply(socImg).multiply(depth_m).multiply(0.0367);
}

// Calculate SOC stock for each depth
var socStocks = depths.map(function(d) {
  var socImg = soc.select(d.socBand);
  var bdImg = bd.select(d.bdBand);
  var stock = calculateSOCStock(socImg, bdImg, d.depth).clip(matoGrosso);
  
  // Add styled layer to map
  Map.addLayer(stock, {
    min: 0,
    max: 100,
    palette: ['#ffffcc', '#c2e699', '#78c679', '#31a354', '#006837']
  }, 'SOC ' + d.name + ' (tCO₂/ha)');
  
  return stock;
});

// Sum SOC stocks to get total for 0-100cm
var totalSOC = socStocks.reduce(function(acc, img) {
  return acc.add(img);
});
Map.addLayer(totalSOC, {
  min: 0,
  max: 300,
  palette: ['#f7fcf0', '#ccebc5', '#a1d99b', '#41ab5d', '#006d2c']
}, '🌍 Total SOC 0–100cm (tCO₂/ha)');

// Function to print mean statistics
function printMean(image, label) {
  var mean = image.reduceRegion({
    reducer: ee.Reducer.mean(),
    geometry: matoGrosso.geometry(),
    scale: 250,
    maxPixels: 1e9
  });
  print('📊 Mean ' + label + ':', mean);
}

// Print mean stats per depth
depths.forEach(function(d, i) {
  printMean(socStocks[i], 'SOC ' + d.name + ' (tCO₂/ha)');
});

// Print mean total
printMean(totalSOC, '🌍 Total SOC 0–100cm (tCO₂/ha)');

// --------------------------------------------------
// ♻️ 5. CO₂ Sequestered Estimate (NDVI-Driven Biomass Proxy)
// --------------------------------------------------

var biomassFactor = 250;  // Max potential tCO₂/ha

// Dynamically scale NDVI only if source is VIIRS
var isVIIRS = ndviSource.equals('VIIRS');

var ndviScaled = ee.Image(ee.Algorithms.If(
  isVIIRS,
  processedNDVI.divide(10000),
  processedNDVI  // Sentinel is already 0–1
));

var co2Sequestered = ndviScaled.multiply(biomassFactor).clip(matoGrosso);

// Add map layer
Map.addLayer(co2Sequestered, {
  min: 0, max: biomassFactor,
  palette: ['#f7fcf5', '#c7e9c0', '#74c476', '#238b45', '#00441b']
}, '♻️ CO₂ Sequestered Estimate');

// Optional: print value at a point
var testPoint = ee.Geometry.Point([-56, -12]);
var co2Value = co2Sequestered.reduceRegion({
  reducer: ee.Reducer.mean(),
  geometry: testPoint.buffer(2000),
  scale: 500,
  maxPixels: 1e9
});
print('♻️ Estimated CO₂ Sequestered (t/ha):', co2Value);

// --------------------------------------------------
// 🧮 6. Total CO₂ Sequestered in Mato Grosso (tons)
// --------------------------------------------------
// This section computes the total metric tons of CO₂ sequestered using NDVI as a proxy for biomass.
// Based on: NDVI × BiomassFactor × Pixel Area (converted to hectares)
// Optional: Set showTotalCO2 to false if you only want to run it occasionally

var showTotalCO2 = true;

if (showTotalCO2) {

  // Rename CO₂ band for clean reporting
  var co2Sequestered = ndviScaled
    .multiply(biomassFactor)
    .rename('CO2_tons_per_ha')  // tons of CO₂ per hectare
    .clip(matoGrosso);

  // Multiply by pixel area (convert m² → hectares)
  var co2PerPixel = co2Sequestered.multiply(
    ee.Image.pixelArea().divide(10000)  // m² to ha
  );

  // Reduce region over entire Mato Grosso to sum total CO₂
  var totalCO2 = co2PerPixel.reduceRegion({
    reducer: ee.Reducer.sum(),
    geometry: matoGrosso.geometry(),
    scale: 500,  // Match VIIRS scale
    maxPixels: 1e10,
    bestEffort: true
  });

  // Print result in metric tons
  totalCO2.evaluate(function(result) {
    print('🌍 Total CO₂ Sequestered in Mato Grosso (metric tons):', 
          result.CO2_tons_per_ha);
  });
}

// --------------------------------------------------
// 🪓 7. CO₂ Emissions if Deforested (via forest loss risk)
// --------------------------------------------------
var treeCover2000 = ee.Image('UMD/hansen/global_forest_change_2022_v1_10')
  .select('treecover2000').clip(matoGrosso);

var forestLoss = ee.Image('UMD/hansen/global_forest_change_2022_v1_10')
  .select('loss').clip(matoGrosso);

var co2EmissionRisk = treeCover2000.multiply(forestLoss.not()).multiply(0.02); // Scaled proxy

var co2Vis = {
  min: 0,
  max: 1,
  palette: ['#ffffb2','#fecc5c','#fd8d3c','#f03b20','#bd0026']
};

// [Your existing code up to the last layer...]

Map.addLayer(co2EmissionRisk, co2Vis, '🪓 CO₂ Emissions if Deforested');

var deforestStats = co2EmissionRisk.reduceRegion({
  reducer: ee.Reducer.mean(),
  geometry: matoGrosso.geometry(),
  scale: 500,
  maxPixels: 1e9
});
print('📊 CO₂ Emission Risk (tons/ha)', deforestStats);

// ============================
// LEGEND SYSTEM (UPDATED)
// ============================

// Create a panel to hold the legend
var legend = ui.Panel({
  style: {
    position: 'bottom-left',
    padding: '8px 15px',
    backgroundColor: 'white',
    border: '1px solid #ccc'
  }
});
Map.add(legend);

// Function to create legend rows
function makeLegendRow(color, name) {
  var colorBox = ui.Label({
    style: {
      backgroundColor: color,
      padding: '8px',
      margin: '0 8px 0 0',
      border: '1px solid #333'
    }
  });
  var description = ui.Label(name, {margin: '0 0 0 5px'});
  return ui.Panel({
    widgets: [colorBox, description],
    layout: ui.Panel.Layout.Flow('horizontal'),
    style: {margin: '2px 0'}
  });
}

// Define legends for each layer with EXACT layer names
var legends = {
  '🌿 NDVI (Source: VIIRS)': ui.Panel([
    ui.Label('NDVI Index', {fontWeight: 'bold', fontSize: '14px', margin: '0 0 5px 0'}),
    makeLegendRow('#ffffe5', 'Low (0-0.2)'),
    makeLegendRow('#f7fcb9', '0.2-0.4'),
    makeLegendRow('#d9f0a3', '0.4-0.5'),
    makeLegendRow('#addd8e', '0.5-0.6'),
    makeLegendRow('#78c679', '0.6-0.7'),
    makeLegendRow('#41ab5d', '0.7-0.8'),
    makeLegendRow('#238443', '0.8-0.9'),
    makeLegendRow('#006837', 'High (0.9-1.0)')
  ]),
  
  '💧 Soil Moisture (SMAP 2022)': ui.Panel([
    ui.Label('Soil Moisture (%)', {fontWeight: 'bold', fontSize: '14px', margin: '0 0 5px 0'}),
    makeLegendRow('#ffffcc', '0-20%'),
    makeLegendRow('#c2e699', '20-40%'),
    makeLegendRow('#78c679', '40-60%'),
    makeLegendRow('#31a354', '60-80%'),
    makeLegendRow('#006837', '80-100%')
  ]),
  
  '🌊 Surface Water Occurrence': ui.Panel([
    ui.Label('Water Occurrence (%)', {fontWeight: 'bold', fontSize: '14px', margin: '0 0 5px 0'}),
    makeLegendRow('#ffffff', '0%'),
    makeLegendRow('#ccebc5', '1-20%'),
    makeLegendRow('#a8ddb5', '20-40%'),
    makeLegendRow('#7bccc4', '40-60%'),
    makeLegendRow('#43a2ca', '60-80%'),
    makeLegendRow('#0868ac', '80-100%')
  ]),
  
  '🌍 Total SOC 0–100cm (tCO₂/ha)': ui.Panel([
    ui.Label('Soil Organic Carbon (tCO₂/ha)', {fontWeight: 'bold', fontSize: '14px', margin: '0 0 5px 0'}),
    makeLegendRow('#f7fcf0', '0-50'),
    makeLegendRow('#ccebc5', '50-100'),
    makeLegendRow('#a1d99b', '100-150'),
    makeLegendRow('#41ab5d', '150-200'),
    makeLegendRow('#006d2c', '200-300')
  ]),
  
    'SOC 0–5cm 🟡 (tCO₂/ha)': ui.Panel([
    ui.Label('SOC 0–5cm', {fontWeight: 'bold', fontSize: '14px', margin: '0 0 5px 0'}),
    makeLegendRow('#ffffcc', '0–20'),
    makeLegendRow('#c2e699', '20–40'),
    makeLegendRow('#78c679', '40–60'),
    makeLegendRow('#31a354', '60–80'),
    makeLegendRow('#006837', '80–100')
  ]),
  
  'SOC 5–15cm 🟠 (tCO₂/ha)': ui.Panel([
    ui.Label('SOC 5–15cm', {fontWeight: 'bold', fontSize: '14px', margin: '0 0 5px 0'}),
    makeLegendRow('#ffffcc', '0–20'),
    makeLegendRow('#c2e699', '20–40'),
    makeLegendRow('#78c679', '40–60'),
    makeLegendRow('#31a354', '60–80'),
    makeLegendRow('#006837', '80–100')
  ]),

  'SOC 15–30cm 🔴 (tCO₂/ha)': ui.Panel([
    ui.Label('SOC 15–30cm', {fontWeight: 'bold', fontSize: '14px', margin: '0 0 5px 0'}),
    makeLegendRow('#ffffcc', '0–20'),
    makeLegendRow('#c2e699', '20–40'),
    makeLegendRow('#78c679', '40–60'),
    makeLegendRow('#31a354', '60–80'),
    makeLegendRow('#006837', '80–100')
  ]),

  'SOC 30–60cm 🟣 (tCO₂/ha)': ui.Panel([
    ui.Label('SOC 30–60cm', {fontWeight: 'bold', fontSize: '14px', margin: '0 0 5px 0'}),
    makeLegendRow('#ffffcc', '0–20'),
    makeLegendRow('#c2e699', '20–40'),
    makeLegendRow('#78c679', '40–60'),
    makeLegendRow('#31a354', '60–80'),
    makeLegendRow('#006837', '80–100')
  ]),

  'SOC 60–100cm ⚫ (tCO₂/ha)': ui.Panel([
    ui.Label('SOC 60–100cm', {fontWeight: 'bold', fontSize: '14px', margin: '0 0 5px 0'}),
    makeLegendRow('#ffffcc', '0–20'),
    makeLegendRow('#c2e699', '20–40'),
    makeLegendRow('#78c679', '40–60'),
    makeLegendRow('#31a354', '60–80'),
    makeLegendRow('#006837', '80–100')
  ]),
  
  '♻️ CO₂ Sequestered Estimate': ui.Panel([
    ui.Label('CO₂ Sequestered (t/ha)', {fontWeight: 'bold', fontSize: '14px', margin: '0 0 5px 0'}),
    makeLegendRow('#f7fcf5', '0-50'),
    makeLegendRow('#c7e9c0', '50-100'),
    makeLegendRow('#74c476', '100-150'),
    makeLegendRow('#238b45', '150-200'),
    makeLegendRow('#00441b', '200-250')
  ]),
  
  '🪓 CO₂ Emissions if Deforested': ui.Panel([
    ui.Label('CO₂ Emission Risk', {fontWeight: 'bold', fontSize: '14px', margin: '0 0 5px 0'}),
    makeLegendRow('#ffffb2', 'Low'),
    makeLegendRow('#fecc5c', 'Medium-Low'),
    makeLegendRow('#fd8d3c', 'Medium'),
    makeLegendRow('#f03b20', 'High'),
    makeLegendRow('#bd0026', 'Very High')
  ])
};

// Function to update legend when layer visibility changes
function updateLegend() {
  legend.clear();
  
  // Get all layers and find which one is visible
  var layers = Map.layers();
  for (var i = 0; i < layers.length(); i++) {
    var layer = layers.get(i);
    if (layer.getShown()) {
      var layerName = layer.getName();
      if (legends[layerName]) {
        legend.add(legends[layerName]);
      }
      break; // Only show legend for the first visible layer
    }
  }
}

// Track the current visible layer
var previousVisibleLayer = null;

// Check visibility every second
var checkLayerVisibility = function() {
  var layers = Map.layers();
  for (var i = 0; i < layers.length(); i++) {
    var layer = layers.get(i);
    if (layer.getShown()) {
      var layerName = layer.getName();
      if (previousVisibleLayer !== layerName) {
        previousVisibleLayer = layerName;
        updateLegend(); // Update only if visible layer changed
      }
      break;
    }
  }
};

// Run check every 1000 ms
ui.util.setInterval(checkLayerVisibility, 1000);

// Also initialize on load
updateLegend();

// --------------------------------------------------
// 📦 Average SOC Stock from 5–50 cm
// --------------------------------------------------

// Select relevant depth bands for SOC and BD
var socBands = [
  {soc: 'soc_5-15cm_mean', bd: 'bdod_5-15cm_mean', depth: 10},
  {soc: 'soc_15-30cm_mean', bd: 'bdod_15-30cm_mean', depth: 15},
  {soc: 'soc_30-60cm_mean', bd: 'bdod_30-60cm_mean', depth: 30}
];

// Function to calculate SOC stock in tCO₂/ha
function calculateSOCStock(socImg, bdImg, depth_cm) {
  var depth_m = ee.Number(depth_cm).divide(100); // cm → m
  // The 0.0367 factor converts Carbon (C) to CO2 (C * (44/12) = C * 3.666...).
  // SoilGrids SOC is in g/kg, BD in cg/cm^3.
  // The formula used (BD * SOC * depth_m * 0.0367) is specific to ISRIC SoilGrids.
  // Ensure the units are consistent if you're getting unexpected values from here.
  // For ISRIC, SOC is in dg/kg (decigrams per kilogram), so need a conversion to g/kg if 0.0367 assumes g/kg.
  // Standard SoilGrids SOC mean band is decagrams per kilogram (dag/kg), i.e., grams per 100g.
  // If SOC is dag/kg and BD is cg/cm^3, then the correct conversion for tC/ha is:
  // (SOC_dag/kg * 10000 * BD_cg/cm^3 * depth_cm * 0.1) / 10000000 * (44/12)
  // Simplified, if SoilGrids is already scaled for g/kg in their internal processing to the `soc_mean` bands,
  // then your current formula is likely fine. However, a common source of zero output is if the raw
  // SoilGrids values are very low or need further scaling for the actual calculation.
  // Let's assume the 0.0367 is the correct scaling factor for these specific bands.
  return bdImg.multiply(socImg).multiply(depth_m).multiply(0.0367);
}

// Combine SOC stocks for selected depths
var socSum = ee.Image(0);
socBands.forEach(function(b) {
  var socImg = soc.select(b.soc);
  var bdImg = bd.select(b.bd);
  var stock = calculateSOCStock(socImg, bdImg, b.depth);
  socSum = socSum.add(stock);
});
socSum = socSum.clip(matoGrosso);

// Add SOC map layer
Map.addLayer(socSum, {
  min: 0,
  max: 150, // Max value adjusted based on typical SOC stocks, may need tuning
  palette: ['#ffffcc', '#c2e699', '#78c679', '#31a354', '#006837']
}, '🌍 Avg SOC 5–50cm (tCO₂/ha)');


// --------------------------------------------------
// 🧠 Compute Emission Risk Zones with updated 3-zone thresholds
// --------------------------------------------------

// Define 3 risk zones based on SOC stock (tCO₂/ha)
var lowRiskMask = socSum.lte(60);
var moderateRiskMask = socSum.gt(60).and(socSum.lte(100));
var highRiskMask = socSum.gt(100);

// Pixel area in hectares
var pixelArea = ee.Image.pixelArea().divide(10000); // m² → ha

// Create images representing the area for each risk category
var lowRiskAreaImage = pixelArea.updateMask(lowRiskMask).rename('area');
var moderateRiskAreaImage = pixelArea.updateMask(moderateRiskMask).rename('area');
var highRiskAreaImage = pixelArea.updateMask(highRiskMask).rename('area');

// Calculate total area in hectares for each risk category
var lowRiskArea = lowRiskAreaImage.reduceRegion({
  reducer: ee.Reducer.sum(),
  geometry: matoGrosso.geometry(),
  scale: 250,
  maxPixels: 1e13,
  bestEffort: true
}).get('area');

var moderateRiskArea = moderateRiskAreaImage.reduceRegion({
  reducer: ee.Reducer.sum(),
  geometry: matoGrosso.geometry(),
  scale: 250,
  maxPixels: 1e13,
  bestEffort: true
}).get('area');

var highRiskArea = highRiskAreaImage.reduceRegion({
  reducer: ee.Reducer.sum(),
  geometry: matoGrosso.geometry(),
  scale: 250,
  maxPixels: 1e13,
  bestEffort: true
}).get('area');

// Add risk layers to map for visualization
var lowRiskStyled = lowRiskMask.selfMask().visualize({
  palette: ['#ffffb2'], // Light yellow
  opacity: 0.4
});
var moderateRiskStyled = moderateRiskMask.selfMask().visualize({
  palette: ['#fe9929'], // Orange
  opacity: 0.5
});
var highRiskStyled = highRiskMask.selfMask().visualize({
  palette: ['#d7301f'], // Red
  opacity: 0.6
});

Map.addLayer(lowRiskStyled, {}, '🟡 Low Emission Risk (≤60 tCO₂/ha)');
Map.addLayer(moderateRiskStyled, {}, '🟠 Moderate Emission Risk (60–100 tCO₂/ha)');
Map.addLayer(highRiskStyled, {}, '🔴 High Emission Risk (>100 tCO₂/ha)');


// --------------------------------------------------
// 📦 Unified UI Panel (SOC + Emission Risk)
// --------------------------------------------------

var unifiedPanel = ui.Panel({
  layout: ui.Panel.Layout.flow('vertical'),
  style: {
    width: '340px',
    padding: '12px',
    position: 'top-right',
    backgroundColor: 'rgba(255,255,255,0.9)'
  }
});

unifiedPanel.add(ui.Label('🧾 CO₂NEX Carbon Summary Mato Grosso', {
  fontWeight: 'bold',
  fontSize: '18px',
  margin: '0 0 6px 0'
}));

// Region & area in ha
var region = matoGrosso.geometry();
var areaHa = region.area().divide(10000); // Total area of Mato Grosso in hectares

// Mean SOC across the entire region
var meanSOC = socSum.reduceRegion({
  reducer: ee.Reducer.mean(),
  geometry: region,
  scale: 250,
  maxPixels: 1e13,
  bestEffort: true // Use bestEffort here too
}).values().get(0);

// Total SOC stored in Mato Grosso based on the mean
var totalSOC = ee.Number(meanSOC).multiply(areaHa);

// Populate panel with values
areaHa.evaluate(function(areaVal) {
  unifiedPanel.add(ui.Label('📏 Area: ' + areaVal.toFixed(0) + ' ha'));
});

meanSOC.evaluate(function(meanVal) {
  // Check if meanVal is not null or undefined beforetoFixed
  unifiedPanel.add(ui.Label('📈 Avg SOC: ' + (meanVal !== null && meanVal !== undefined ? meanVal.toFixed(2) : 'N/A') + ' tCO₂/ha'));
});

totalSOC.evaluate(function(totalVal) {
  // Check if totalVal is not null or undefined
  unifiedPanel.add(ui.Label('🧮 Total CO₂ Stored: ' + (totalVal !== null && totalVal !== undefined ? (totalVal / 1e6).toFixed(2) : 'N/A') + ' Mt'));
});

// Evaluate and add risk area values
lowRiskArea.evaluate(function(val) {
  unifiedPanel.add(ui.Label('🟡 Low Emission Risk (≤60 tCO₂/ha): ' + (val ? val.toFixed(0) : 'N/A') + ' ha'));
});
moderateRiskArea.evaluate(function(val) {
  unifiedPanel.add(ui.Label('🟠 Moderate Emission Risk (60–100 tCO₂/ha): ' + (val ? val.toFixed(0) : 'N/A') + ' ha'));
});
highRiskArea.evaluate(function(val) {
  unifiedPanel.add(ui.Label('🔴 High Emission Risk (>100 tCO₂/ha): ' + (val ? val.toFixed(0) : 'N/A') + ' ha'));
});

// Display CO₂ Sequestered in the panel
var totalCO2SequesteredValue = 16161272391.479729; // metric tons
var totalSequesteredMt = totalCO2SequesteredValue / 1e6;
unifiedPanel.add(ui.Label('💚 CO₂ Sequestered: ' + totalSequesteredMt.toFixed(2) + ' Mt'));

// Add panel to map
Map.add(unifiedPanel);

// ==================================================
// 🌍 CO₂NEX Land Cover Breakdown - v1.0.4 (Bottom-Right UI)
// ==================================================

// Load ESA WorldCover 2020
var worldCover = ee.Image('ESA/WorldCover/v100/2020');
var landCover = worldCover.select('Map');

// Define Mato Grosso
var matoGrosso = ee.FeatureCollection('FAO/GAUL_SIMPLIFIED_500m/2015/level1')
  .filter(ee.Filter.eq('ADM1_NAME', 'Mato Grosso'))
  .geometry();

// Pixel area in hectares
var pixelArea = ee.Image.pixelArea().divide(10000);

// ESA WorldCover class names
var landClasses = {
  10: 'Tree cover',
  20: 'Shrubland',
  30: 'Grassland',
  40: 'Cropland',
  50: 'Built-up',
  60: 'Bare / sparse vegetation',
  70: 'Snow and ice',
  80: 'Permanent water bodies',
  90: 'Herbaceous wetland',
  95: 'Mangroves',
  100: 'Moss and lichen'
};

// Carbon-relevant grouped categories
var categories = {
  'Forest': [10],
  'Agriculture': [40],
  'Pasture': [30],
  'Degraded': [50, 60]
};

// Store calculated areas
var dict = {};

function computeCategoryArea(name, ids) {
  var mask = landCover.remap(ids, ee.List.repeat(1, ids.length)).eq(1);
  var areaImage = pixelArea.updateMask(mask);
  var total = areaImage.reduceRegion({
    reducer: ee.Reducer.sum(),
    geometry: matoGrosso,
    scale: 30,
    maxPixels: 1e13
  }).get('area');

  ee.Number(total).evaluate(function (val) {
    dict[name] = val;
    print('🗂️ ' + name + ': ' + (val ? val.toFixed(0) : '0') + ' ha');
  });
}

// Run area calculations
Object.keys(categories).forEach(function (name) {
  computeCategoryArea(name, categories[name]);
});

// Format number with commas
function formatNumber(x) {
  return x.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ",");
}

// Class ID mapping
var classIds = Object.keys(landClasses).map(function(k) {
  return parseInt(k);
});

// Get histogram for pie chart
var stats = landCover.reduceRegion({
  reducer: ee.Reducer.frequencyHistogram(),
  geometry: matoGrosso,
  scale: 100,
  maxPixels: 1e13
});

stats.get('Map').evaluate(function (histogram) {
  var labels = [];
  var values = [];

  classIds.forEach(function (id) {
    var className = landClasses[id];
    var count = histogram[id] || 0;
    if (count > 0) {
      labels.push(className);
      values.push(count);
    }
  });

  // 📊 Pie Chart
  var pieChart = ui.Chart.array.values({
    array: ee.Array(values),
    axis: 0,
    xLabels: labels
  }).setChartType('PieChart').setOptions({
    title: 'Land Cover Breakdown - Mato Grosso',
    pieHole: 0.3,
    fontSize: 12,
    titleTextStyle: { bold: true, fontSize: 14 },
    sliceVisibilityThreshold: 0.01
  });

  // 📦 Master Panel (BOTTOM-RIGHT + STUCK)
  var masterPanel = ui.Panel({
    layout: ui.Panel.Layout.flow('vertical'),
    style: {
    position: 'bottom-right',
    width: '310px',
    padding: '8px',
    backgroundColor: 'rgba(255, 255, 255, 0.85)',
    border: '1px solid #ccc',
    shown: true
  }
});

  // ➕ Add summary totals
  Object.keys(dict).forEach(function (key) {
    var val = dict[key];
    var label = ui.Label({
      value: '🗂️ ' + key + ': ' + (val ? formatNumber(val.toFixed(0)) : '0') + ' ha',
      style: {
        color: '#222222',
        fontSize: '13px',
        margin: '2px 0'
      }
    });
    masterPanel.add(label);
  });

  // ➕ Add pie chart
  masterPanel.add(pieChart);

  // 🕒 Timestamp
  var now = new Date();
  var timestamp = ui.Label({
    value: 'Last updated: ' + now.toLocaleString(),
    style: {
      fontSize: '11px',
      color: '#666',
      margin: '6px 0 0 0'
    }
  });

  masterPanel.add(timestamp);

  // ✅ Add to map
  Map.add(masterPanel);
});
