// ------------------------------------------------------------------
// 🌍 Mato Grosso Environmental Dashboard (VIIRS + Earth Engine)
// ------------------------------------------------------------------

// Define Mato Grosso boundary using FAO GAUL
var states = ee.FeatureCollection('FAO/GAUL/2015/level1');
var matoGrosso = states.filter(ee.Filter.eq('ADM1_NAME', 'Mato Grosso'))
                       .filter(ee.Filter.eq('ADM0_NAME', 'Brazil'));
Map.centerObject(matoGrosso, 6);

// --------------------------------------------------
// 🌿 1. NDVI from VIIRS (2022)
// --------------------------------------------------
var viirsNDVI = ee.ImageCollection('NOAA/VIIRS/001/VNP13A1')
  .filterDate('2022-01-01', '2022-12-31')
  .filterBounds(matoGrosso)
  .select('NDVI');

var meanNDVI = viirsNDVI.mean().clip(matoGrosso);
meanNDVI = meanNDVI.updateMask(meanNDVI.gte(0).and(meanNDVI.lte(10000)));
meanNDVI = meanNDVI.focal_mean({radius: 1, units: 'pixels'});

var ndviStats = meanNDVI.reduceRegion({
  reducer: ee.Reducer.percentile([5, 95]).combine('mean', null, true),
  geometry: matoGrosso.geometry(),
  scale: 500,
  maxPixels: 1e9
});

ndviStats.evaluate(function(p) {
  var vis = {
    min: p.NDVI_p5,
    max: p.NDVI_p95,
    palette: [
      '#ffffe5','#f7fcb9','#d9f0a3','#addd8e','#78c679',
      '#41ab5d','#238443','#006837','#004529'
    ]
  };
  Map.addLayer(meanNDVI, vis, '🌿 VIIRS NDVI (2022)');
  print('📊 NDVI Stats (VIIRS 2022)', p);
});

// --------------------------------------------------
// 💧 2. Soil Moisture from SMAP
// --------------------------------------------------
var smap = ee.ImageCollection('NASA_USDA/HSL/SMAP10KM_soil_moisture')
  .filterDate('2022-01-01', '2022-12-31')
  .filterBounds(matoGrosso)
  .select('ssm');

var meanSM = smap.mean().clip(matoGrosso);

var smVis = {
  min: 0.05,
  max: 0.4,
  palette: ['#ffffcc','#c2e699','#78c679','#31a354','#006837']
};

Map.addLayer(meanSM, smVis, '💧 Soil Moisture (SMAP 2022)');

var smStats = meanSM.reduceRegion({
  reducer: ee.Reducer.mean().combine('min', null, true).combine('max', null, true),
  geometry: matoGrosso.geometry(),
  scale: 5000,
  maxPixels: 1e9
});
print('📊 Soil Moisture Stats (SMAP 2022)', smStats);

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

var biomassFactor = 250;  // Adjust max biomass potential (tCO₂/ha)
var ndviScaled = meanNDVI.divide(10000);  // Normalize NDVI (0–1)
var co2Sequestered = ndviScaled.multiply(biomassFactor).clip(matoGrosso);

// Add color contrast
var co2Palette = [
  '#ffffe0', '#d9f0a3', '#addd8e', '#78c679',
  '#41ab5d', '#238443', '#006837', '#004529'
];

Map.addLayer(co2Sequestered, {
  min: 0,
  max: biomassFactor,
  palette: co2Palette
}, '♻️ CO₂ Sequestered (NDVI-Biomass Proxy)');

// Print summary stats
var co2SequesteredStats = co2Sequestered.reduceRegion({
  reducer: ee.Reducer.min()
            .combine(ee.Reducer.mean(), '', true)
            .combine(ee.Reducer.max(), '', true),
  geometry: matoGrosso.geometry(),
  scale: 500,
  maxPixels: 1e9
});
print('📊 CO₂ Sequestered Stats (tCO₂/ha)', co2SequesteredStats);

// --------------------------------------------------
// 🪓 6. CO₂ Emissions if Deforested (via forest loss risk)
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

Map.addLayer(co2EmissionRisk, co2Vis, '🪓 CO₂ Emissions if Deforested');

var deforestStats = co2EmissionRisk.reduceRegion({
  reducer: ee.Reducer.mean(),
  geometry: matoGrosso.geometry(),
  scale: 500,
  maxPixels: 1e9
});
print('📊 CO₂ Emission Risk (tons/ha)', deforestStats);
