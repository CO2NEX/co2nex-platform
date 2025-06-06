// ╭────────────────────────────────────────────────────────────╮
// │      CO2NEX LANDOWNER CARBON CREDIT TEMPLATE V2.0.0 Alpha  │
// ╰────────────────────────────────────────────────────────────╯

// HA Size - 400
// Location - Brazil
// Biome - Cerrado Biome
// State - Mato Grosso
// Current Biomass - Wooded Savanna
// H20 - Yes H20 Credits Will Be Issued

// 🧾 PROJECT METADATA (AUTO OR MANUAL INPUT)
var projectID = 'CO2NEX-0001';                         // Auto populate via dashboard
var classification = 'Voluntary - Agroforestry';       // Options: Agro, Pasture, Cattle, Wetlands, etc.
var landownerName = 'Example Farm Name';
var dataCollectionDate = '2024-11-01';                 // Placeholder — used for filtering imagery

// 📍 POLYGON GEOMETRY (LANDOWNER PROPERTY)
var farmPolygonCoords = [
  [-53.97405079865982, -15.38997022225261],
  [-53.97224802375366, -15.39481360812152],
  [-53.97427949687147, -15.39952207465037],
  [-53.96458127514247, -15.39570967268717],
  [-53.95609940762319, -15.38761883901998],
  [-53.95411787819605, -15.38488352528416],
  [-53.95700326721895, -15.3730417053592],
  [-53.98698776984043, -15.37824917809488],
  [-53.98499305688799, -15.39188774418369],
  [-53.97405079865982, -15.38997022225261]
];
var farmArea = ee.Geometry.Polygon(farmPolygonCoords);

// 📍 5km BUFFER AROUND PROPERTY
var bufferRadius = 5000; // meters
var fireAlertZone = farmArea.buffer(bufferRadius);

// Define the current date range for analysis
var currentEndDate = ee.Date(Date.now()).advance(-1, 'day'); // Get yesterday's date
var currentStartDate = currentEndDate.advance(-1, 'year'); // One year prior to yesterday

print('Current Date Range for Carbon Health Index:', currentStartDate.format('YYYY-MM-dd'), 'to', currentEndDate.format('YYYY-MM-dd'));

// Define the baseline date range (e.g., one year prior to the current analysis period)
var baselineEndDate = currentStartDate.advance(-1, 'day'); // Day before current startDate
var baselineStartDate = baselineEndDate.advance(-1, 'year'); // One year prior to baselineEndDate

print('Baseline Date Range for Carbon Stock:', baselineStartDate.format('YYYY-MM-dd'), 'to', baselineEndDate.format('YYYY-MM-dd'));


// Calculate farm area in hectares
var farmAreaHectares = farmArea.area().divide(10000);
farmAreaHectares.evaluate(function(ha) {
  print('Farm Area Size: ' + ha.toFixed(2) + ' hectares');
});


// ╭────────────────────────────────────────────────────────────╮
// │          CARBON STOCK ESTIMATION & SOILGRIDS FUNCTION      │
// ╰────────────────────────────────────────────────────────────╯

/**
 * Function to calculate total carbon image (SOC + AGB Carbon) for a given date range and geometry.
 * This function encapsulates the logic for fetching Sentinel-2 NDVI and SoilGrids data,
 * calculating simulated AGB, and summing with SOC to get total carbon.
 * @param {ee.Date} start The start date for the image collection filter.
 * @param {ee.Date} end The end date for the image collection filter.
 * @param {ee.Geometry.Polygon} geometry The area of interest to clip and reduce.
 * @returns {ee.Image} An image with the total carbon stock in tonnes C/ha.
 */
var calculateTotalCarbonImage = function(start, end, geometry) {
  // --- Sentinel-2 NDVI for AGB proxy ---
  // Load the Sentinel-2 SR image collection
  var s2Collection = ee.ImageCollection('COPERNICUS/S2_SR')
    .filterDate(start, end)
    .filterBounds(geometry)
    .filter(ee.Filter.lt('CLOUDY_PIXEL_PERCENTAGE', 10)) // Filter out cloudy images
    .map(function(image) {
      // Apply scaling factor for Sentinel-2 bands (reflectance values are 10000 * reflectance)
      var s2Image = image.divide(10000);
      // Calculate NDVI for Sentinel-2 (NIR: B8, Red: B4)
      var ndvi = s2Image.normalizedDifference(['B8', 'B4']).rename('NDVI');
      return ndvi.copyProperties(image, image.propertyNames());
    });

  // Compute the median NDVI image over the time period for Sentinel-2
  var s2MeanNDVI = s2Collection.median().clip(geometry);

  // For demonstration, use a simple simulated AGB based on NDVI for now.
  // This is NOT a real biomass estimate but shows how you'd integrate.
  // In a real scenario, you'd use actual AGB data or a robust allometric model.
  var simulatedAGB = s2MeanNDVI.multiply(200).rename('Simulated_AGB_tonnes_ha'); // Scale NDVI to a plausible AGB range
  var simulatedAGBCarbon = simulatedAGB.multiply(0.5).rename('AGB_Carbon_tonnes_ha'); // Convert biomass to carbon (assuming 50% carbon content)

  // --- Soil Organic Carbon (SOC) from SoilGrids (Enhanced Scientific Method) ---
  // Using ISRIC SoilGrids v2017 for more detailed and recent soil properties.
  // Data units: ocd (Organic Carbon Density Mean) in cg/kg, bld (Bulk Density Mean) in cg/cm^3.
  // Both have a scale factor of 10 (raw value / 10 = actual value).

  // Load individual SoilGrids bands using their correct asset IDs
  var ocd_image = ee.Image("projects/soilgrids-isric/ocd_mean");
  var bld_image = ee.Image("projects/soilgrids-isric/bdod_mean");

  // Define layer depths in meters for 0-30cm profile
  var layerDepths = {
    '0-5cm': 0.05, // 0-5 cm
    '5-15cm': 0.10, // 5-15 cm (15-5)
    '15-30cm': 0.15  // 15-30 cm (30-15)
  };

  // Function to calculate carbon mass for a given depth layer
  var calculateLayerCarbon = function(layerId, depth_m) {
    // Select Organic Carbon and Bulk Density for the specific layer
    // SoilGrids v2_0 bands: ocd_0-5cm_mean, bdod_0-5cm_mean etc.
    // Scale factor for raw values:
    // ocd_mean: raw value * 10 = kg/m^3
    // bdod_mean: raw value / 10 = kg/m^3
    var ocd_raw = ocd_image.select('ocd_' + layerId + '_mean');
    var bld_raw = bld_image.select('bdod_' + layerId + '_mean');

    // Convert OCD from raw to kg/m^3 based on ISRIC documentation
    var ocd_kg_m3 = ocd_raw.multiply(10);

    // Convert BLD from raw to kg/m^3 based on ISRIC documentation
    var bld_kg_m3 = bld_raw.divide(10);

    // Calculate carbon mass for the layer (kg/m^2)
    // Carbon_Layer (kg/m^2) = OC_density (kg/m^3) * Layer_Depth (m)
    var carbon_mass_layer = ocd_kg_m3.multiply(depth_m)
      .rename('SOC_Layer_' + layerId + '_kg_m2');
    return carbon_mass_layer;
  };

  // Calculate carbon for each layer
  var soc_layer1 = calculateLayerCarbon('0-5cm', layerDepths['0-5cm']);
  var soc_layer2 = calculateLayerCarbon('5-15cm', layerDepths['5-15cm']);
  var soc_layer3 = calculateLayerCarbon('15-30cm', layerDepths['15-30cm']);

  // Sum the carbon from all layers to get total SOC (0-30cm)
  var totalSoilCarbon = soc_layer1.add(soc_layer2).add(soc_layer3).rename('Total_SOC_0_30cm_kg_m2');
  var socCarbonTonnesPerHa = totalSoilCarbon.multiply(10).rename('SOC_Carbon_tonnes_ha'); // kg/m^2 to tonnes/ha

  // Total Carbon Stock (tonnes C/ha) = AGB Carbon + SOC Carbon
  var totalCarbonStock = simulatedAGBCarbon.add(socCarbonTonnesPerHa).rename('Total_Carbon_tonnes_ha');

  return totalCarbonStock;
};


// ╭────────────────────────────────────────────────────────────╮
// │                  CARBON STOCK CALCULATIONS                │
// ╰────────────────────────────────────────────────────────────╯

// Calculate Baseline Carbon Stock Image
var baselineCarbonImage = calculateTotalCarbonImage(baselineStartDate, baselineEndDate, farmArea);

// Calculate Current Carbon Stock Image
var currentCarbonImage = calculateTotalCarbonImage(currentStartDate, currentEndDate, farmArea);


// Define visualization for Total Carbon Stock
var totalCarbonVis = {
  min: 10, // Adjust based on expected range for your biome
  max: 150, // Adjust based on expected range for your biome
  palette: ['#f0f9e8', '#ccebc5', '#a8ddb5', '#7bccc4', '#4eb3d3', '#2b8cbe', '#0868ac', '#084081']
};

// Evaluate and print Baseline Carbon Stock
var baselineCarbonStats = baselineCarbonImage.reduceRegion({
  reducer: ee.Reducer.mean(),
  geometry: farmArea,
  scale: 10, // Use Sentinel-2 resolution for consistency
  maxPixels: 1e9
});


// Evaluate and print Current Carbon Stock (nested inside baseline evaluation)
var currentCarbonStats = currentCarbonImage.reduceRegion({
  reducer: ee.Reducer.mean(),
  geometry: farmArea,
  scale: 10,
  maxPixels: 1e9
});


// ╭────────────────────────────────────────────────────────────╮
// │🌱 NDVI: Carbon Health Index (Primary: Sentinel-2)         │
// ╰────────────────────────────────────────────────────────────╯

// This section is kept for the NDVI health index display,
// but the underlying image collection is now used by `calculateTotalCarbonImage`
var s2CollectionForDisplay = ee.ImageCollection('COPERNICUS/S2_SR')
  .filterDate(currentStartDate, currentEndDate)
  .filterBounds(farmArea)
  .filter(ee.Filter.lt('CLOUDY_PIXEL_PERCENTAGE', 10)) // Filter out cloudy images
  .map(function(image) {
    var s2Image = image.divide(10000);
    var ndvi = s2Image.normalizedDifference(['B8', 'B4']).rename('NDVI');
    return ndvi.copyProperties(image, image.propertyNames());
  });

var s2MeanNDVIDisplay = s2CollectionForDisplay.median().clip(farmArea);

// Calculate baseline NDVI for change detection
var baselineS2Collection = ee.ImageCollection('COPERNICUS/S2_SR')
  .filterDate(baselineStartDate, baselineEndDate)
  .filterBounds(farmArea)
  .filter(ee.Filter.lt('CLOUDY_PIXEL_PERCENTAGE', 10))
  .map(function(image) {
    var s2Image = image.divide(10000);
    var ndvi = s2Image.normalizedDifference(['B8', 'B4']).rename('NDVI');
    return ndvi.copyProperties(image, image.propertyNames());
  });
var baselineS2MeanNDVI = baselineS2Collection.median().clip(farmArea);


var ndviVis = {
  min: 0.0,
  max: 1.0,
  palette: [
    '#ffffff',  // 0.0 - white (bare)
    '#f7fcb9',  // very light yellow
    '#addd8e',  // light green
    '#41ab5d',  // green
    '#238443',  // darker green
    '#005a32',  // very dense veg
    '#00ff00',  // glow green accent (optional)
    '#00cc44',  // neon forest green
    '#009933'   // deep lush
  ]
};

var s2NdviStats = s2MeanNDVIDisplay.reduceRegion({
  reducer: ee.Reducer.mean().combine({
    reducer2: ee.Reducer.stdDev(),
    sharedInputs: true
  }),
  geometry: farmArea,
  scale: 10,
  maxPixels: 1e9
});

var baselineS2NdviStats = baselineS2MeanNDVI.reduceRegion({
  reducer: ee.Reducer.mean(),
  geometry: farmArea,
  scale: 10,
  maxPixels: 1e9
});


// ╭────────────────────────────────────────────────────────────╮
// │            VIIRS NDVI (Backup/Optional)                    │
// ╰────────────────────────────────────────────────────────────╯

// Load the VIIRS VNP13A1 NDVI dataset
var viirsNDVI = ee.ImageCollection('NASA/VIIRS/002/VNP13A1')
  .filterDate(currentStartDate, currentEndDate)
  .filterBounds(farmArea)
  .map(function(image) {
    // Scale NDVI values to the range [-1, 1]
    var ndvi = image.select('NDVI').multiply(0.0001);
    // Apply pixel reliability mask (0: good, 1: marginal)
    var reliability = image.select('pixel_reliability');
    var mask = reliability.lte(1); // Excludes snow/ice, clouds, etc.
    var ndviMasked = ndvi.updateMask(mask).updateMask(ndvi.gte(-1).and(ndvi.lte(1)));
    return ndviMasked.copyProperties(image, image.propertyNames());
  });

// Calculate the number of images in the collection
var viirsCollectionSize = viirsNDVI.size();
print('🛰️ VIIRS NDVI images found (backup):', viirsCollectionSize);

// Optional: Uncomment the section below to add VIIRS NDVI layer and calculate stats
/*
viirsCollectionSize.evaluate(function(size) {
  if (size > 0) {
    var meanVIIRSNDVI = viirsNDVI.mean().clip(farmArea);
    var viirsNdviVis = {
      min: 0.0,
      max: 1.0,
      palette: [
        '#d73027', '#f46d43', '#fdae61', '#fee08b',
        '#d9ef8b', '#a6d96a', '#66bd63', '#1a9850', '#006837'
      ]
    };
    Map.addLayer(meanVIIRSNDVI, viirsNdviVis, '🌱 NDVI: Carbon Health Index (VIIRS - Backup)', false); // false to be off by default

    var viirsNdviStats = meanVIIRSNDVI.reduceRegion({
      reducer: ee.Reducer.mean().combine({
        reducer2: ee.Reducer.stdDev(),
        sharedInputs: true
      }),
      geometry: farmArea,
      scale: 500, // VIIRS native resolution
      maxPixels: 1e9
    });

    viirsNdviStats.evaluate(function(result) {
      var avgNDVI = result.NDVI;
      var stdDev = result['NDVI_stdDev'];
      if (avgNDVI !== null && stdDev !== null) {
        var score = Math.max(0, (avgNDVI * 100)).toFixed(2);
        var stdDevPercent = (stdDev * 100).toFixed(2);
        print('📈 Average NDVI (Carbon Health Index - VIIRS Backup): ' + score + ' / 100');
      } else {
        print('⚠️ Could not compute VIIRS NDVI statistics (backup) – Result was: ' + JSON.stringify(result));
      }
    });
  } else {
    print('⚠️ No VIIRS NDVI data available for backup calculation.');
  }
});
*/


// ╭────────────────────────────────────────────────────────────╮
// │             FIRE ALERT: VIIRS ACTIVE FIRE POINTS           │
// ╰────────────────────────────────────────────────────────────╯

var buffer = farmArea.buffer(5000);

var fires = ee.FeatureCollection('FIRMS').filterDate(
  ee.Date(Date.now()).advance(-3, 'day'),
  ee.Date(Date.now())
).filterBounds(buffer);

fires.size().evaluate(function(count) {
  if (count > 0) {
    print('🔥 ALERT: ' + count + ' fire(s) detected within 5km of project area.');
    fireAlertLabel_ui.setValue(count + ' fires detected');

    // Limit to 10 fires for printing to avoid overwhelming the console if many fires
    // are present.
    fires.limit(10).evaluate(function(fc) {
      print('📍 Fire Point Coordinates (lon, lat):');
      fc.features.forEach(function(fire) {
        var coords = null;
        if (fire.geometry && fire.geometry.coordinates) {
          coords = fire.geometry.coordinates;
        } else if (fire.geometry && fire.geometry.geometries && fire.geometry.geometries.length > 0) {
          coords = fire.geometry.geometries[0].coordinates;
        }

        if (coords && coords.length === 2) {
          var lon = coords[0];
          var lat = coords[1];
          print('→ [' + lon.toFixed(5) + ', ' + lat.toFixed(5) + ']');
        } else {
          print('⚠️ Could not extract coordinates for a fire point.');
        }
      });
    });
  } else {
    print('✅ No fires detected within 5km in the past 3 days.');
    fireAlertLabel_ui.setValue('No fires detected');
  }
});


// ╭────────────────────────────────────────────────────────────╮
// │             INTEGRATION OF GROUND TRUTH DATA (CONCEPTUAL)  │
// ╰────────────────────────────────────────────────────────────╯

// This section demonstrates how you would load and potentially use your field data.
// You would upload your soil/water samples as a FeatureCollection asset to GEE.
// Each point in your FeatureCollection should have properties like 'soil_carbon_measured', 'water_content_measured', etc.

// Example: Create a dummy FeatureCollection for demonstration
var groundTruthPoints = ee.FeatureCollection([
  ee.Feature(ee.Geometry.Point([-53.970, -15.385]), { 'soil_carbon_g_kg': 25, 'water_content_percent': 15 }),
  ee.Feature(ee.Geometry.Point([-53.965, -15.390]), { 'soil_carbon_g_kg': 30, 'water_content_percent': 18 }),
  ee.Feature(ee.Geometry.Point([-53.975, -15.395]), { 'soil_carbon_g_kg': 20, 'water_content_percent': 12 })
]);

Map.addLayer(groundTruthPoints, {color: 'purple'}, '📍 Ground Truth Sample Points (Conceptual)');
print('🧪 Ground Truth Sample Points (first 3):', groundTruthPoints.limit(3));

// You can then extract remote sensing values at these points for calibration/validation:
// This part needs to be nested within the `calculateTotalCarbonImage`'s evaluate blocks
// if it depends on `s2MeanNDVI` or `totalSoilCarbon` from those specific time periods.
// For simplicity, we'll keep it here, assuming `s2MeanNDVIDisplay` is representative.
var sampledData = s2MeanNDVIDisplay.reduceRegions({
  collection: groundTruthPoints,
  reducer: ee.Reducer.mean(), // Get mean NDVI at each point
  scale: 10 // Match Sentinel-2 resolution
});

// You would then typically export this 'sampledData' to a CSV for analysis
// and develop statistical relationships (allometric equations) between
// remote sensing data (NDVI, AGB proxies) and your measured carbon/biomass.
// print('Sampled Remote Sensing Data at Ground Truth Points:', sampledData.limit(3));


// ╭────────────────────────────────────────────────────────────╮
// │             GEDI ABOVEGROUND BIOMASS (AGB) AUDIT           │
// ╰────────────────────────────────────────────────────────────╯

// Load GEDI L4A Aboveground Biomass Density as an ImageCollection (monthly gridded product)
var gedi = ee.ImageCollection('LARSE/GEDI/GEDI04_A_002_MONTHLY')
  .filterBounds(farmArea)
  .filterDate(currentStartDate, currentEndDate); // Filter for the current period

var gediCollectionSize = gedi.size();
print('🛰️ GEDI L4A AGB monthly images found:', gediCollectionSize);

gediCollectionSize.evaluate(function(size) {
  if (size > 0) {
    // Take the mean of the monthly AGB images over the period
    var gediAGBImage = gedi.select('agbd').mean().clip(farmArea);

    var gediAGBVis = {
      min: 0,
      max: 200, // Tonnes/ha, adjust based on expected values for Cerrado
      palette: ['#f7fcf0', '#e0f3db', '#c7e9c0', '#a1d99b', '#74c476', '#41ab5d', '#238b45', '#006d2c', '#00441b']
    };
    Map.addLayer(gediAGBImage, gediAGBVis, '🌳 GEDI AGB (tonnes/ha) Audit');

    var gediAGBStats = gediAGBImage.reduceRegion({
      reducer: ee.Reducer.mean(),
      geometry: farmArea,
      scale: 25, // GEDI resolution is around 25m
      maxPixels: 1e9
    });

    gediAGBStats.evaluate(function(result) {
      var avgGediAGB = result.agbd;
      if (avgGediAGB !== null && !isNaN(avgGediAGB)) {
        print('? GEDI AGB (Audit) - Average: ' + avgGediAGB.toFixed(2) + ' tonnes/ha');
        gediAGBLabel_ui.setValue(avgGediAGB.toFixed(2) + ' t/ha');
      } else {
        print('⚠️ GEDI AGB (Audit) - Could not compute statistics. Result: ' + JSON.stringify(result));
        gediAGBLabel_ui.setValue('N/A');
      }
    });
  } else {
    print('⚠️ GEDI AGB (Audit) - No monthly data available for current period (' + currentStartDate.format('YYYY-MM-dd').getInfo() + ' to ' + currentEndDate.format('YYYY-MM-dd').getInfo() + ') in farmArea. This is common for sparse GEDI coverage.');
    gediAGBLabel_ui.setValue('No data');
  }
});


// ╭────────────────────────────────────────────────────────────╮
// │             FOREST CHANGE DETECTION (HANSEN) AUDIT         │
// ╰────────────────────────────────────────────────────────────╯

// --- Updated Hansen Global Forest Change dataset to the latest v1.11 ---
var gfc = ee.Image('UMD/hansen/global_forest_change_2023_v1_11');
print('Using Hansen Global Forest Change version:', gfc.get('system:id').getInfo());


// Select the forest loss and gain bands
var lossImage = gfc.select(['lossyear']).clip(farmArea);
var gainImage = gfc.select(['gain']).clip(farmArea);
var treeCover2000 = gfc.select('treecover2000').clip(farmArea);

// Filter loss to show only recent loss (e.g., since baseline start year)
// The 'lossyear' band is the year of loss, e.g., 1 for 2001, 23 for 2023.
var recentLoss = lossImage.gte(baselineStartDate.get('year').subtract(2000));

// Combine Hansen loss with FIRMS fire detections to estimate fire-related loss (proxy for involuntary)
var fireLoss = fires.reduceToImage({
  properties: ['confidence'], // Any property, just to create a mask
  reducer: ee.Reducer.max()
}).reproject({
  crs: 'EPSG:4326',
  scale: 30
}).focal_max(90, 'square', 'meters').clip(farmArea); // Buffer fires to catch nearby loss pixels

var fireRelatedLoss = recentLoss.updateMask(fireLoss.gt(0)); // Loss pixels that overlap with fire
var otherLoss = recentLoss.updateMask(fireLoss.eq(0)); // Loss pixels NOT overlapping with fire (potential voluntary/other causes)

// Define visualization for loss and gain
var lossVis = {min: 0, max: 1, palette: ['ff0000']}; // Red for general loss
var fireLossVis = {min: 0, max: 1, palette: ['FFA500']}; // Orange for fire-related loss
var gainVis = {min: 0, max: 1, palette: ['00ff00']}; // Green for gain

Map.addLayer(recentLoss.updateMask(recentLoss), lossVis, '🌲 Forest Loss (Hansen) Audit');
Map.addLayer(fireRelatedLoss.updateMask(fireRelatedLoss), fireLossVis, '🔥 Fire-Related Forest Loss (Audit)');
Map.addLayer(gainImage.updateMask(gainImage), gainVis, '🌳 Forest Gain (Hansen) Audit');

// Calculate forest loss and gain area
var lossArea = recentLoss.multiply(ee.Image.pixelArea()).reduceRegion({
  reducer: ee.Reducer.sum(),
  geometry: farmArea,
  scale: 30, // Hansen resolution
  maxPixels: 1e9
}).get('lossyear');

var gainArea = gainImage.multiply(ee.Image.pixelArea()).reduceRegion({
  reducer: ee.Reducer.sum(),
  geometry: farmArea,
  scale: 30,
  maxPixels: 1e9
}).get('gain');

var fireRelatedLossArea = fireRelatedLoss.multiply(ee.Image.pixelArea()).reduceRegion({
  reducer: ee.Reducer.sum(),
  geometry: farmArea,
  scale: 30,
  maxPixels: 1e9
}).get('lossyear');

var otherLossArea = otherLoss.multiply(ee.Image.pixelArea()).reduceRegion({
  reducer: ee.Reducer.sum(),
  geometry: farmArea,
  scale: 30,
  maxPixels: 1e9
}).get('lossyear');


lossArea.evaluate(function(area) {
  if (area !== null && !isNaN(area)) {
    var hectares = (area / 10000).toFixed(2);
    print('🌲 Total Forest Loss (Hansen) Audit: ' + hectares + ' hectares lost since ' + baselineStartDate.format('YYYY').getInfo());
    totalForestLossLabel_ui.setValue(hectares + ' ha');
  } else {
    print('⚠️ Total Forest Loss (Hansen) Audit: No loss detected or could not compute area for selected period/area.');
    totalForestLossLabel_ui.setValue('No loss');
  }
});

fireRelatedLossArea.evaluate(function(area) {
  if (area !== null && !isNaN(area)) {
    var hectares = (area / 10000).toFixed(2);
    print('🔥 Fire-Related Forest Loss (Audit): ' + hectares + ' hectares (proxy for involuntary)');
    fireRelatedLossLabel_ui.setValue(hectares + ' ha');
  } else {
    print('⚠️ Fire-Related Forest Loss (Audit): No fire-related loss detected or could not compute area.');
    fireRelatedLossLabel_ui.setValue('No data');
  }
});

otherLossArea.evaluate(function(area) {
  if (area !== null && !isNaN(area)) {
    var hectares = (area / 10000).toFixed(2);
    print('🌳 Other Forest Loss (Audit): ' + hectares + ' hectares (potential voluntary/other causes)');
    otherLossLabel_ui.setValue(hectares + ' ha');
  } else {
    print('⚠️ Other Forest Loss (Audit): No other loss detected or could not compute area.');
    otherLossLabel_ui.setValue('No data');
  }
});


gainArea.evaluate(function(area) {
  if (area !== null && !isNaN(area)) {
    var hectares = (area / 10000).toFixed(2);
    print('🌳 Forest Gain (Hansen) Audit: ' + hectares + ' hectares gained.');
    forestGainLabel_ui.setValue(hectares + ' ha');
  } else {
    print('⚠️ Forest Gain (Hansen) Audit: No gain detected or could not compute area for selected period/area.');
    forestGainLabel_ui.setValue('No gain');
  }
});


// ╭────────────────────────────────────────────────────────────╮
// │             WATER RESOURCES AUDIT  (FOR H2O CREDITS)        │
// ╰────────────────────────────────────────────────────────────╯

// --- 1. JRC Global Surface Water (Permanent and Seasonal Water) ---
// Load JRC Global Surface Water dataset
var gsw = ee.Image('JRC/GSW1_4/GlobalSurfaceWater');

// Select the occurrence band (probability of water presence)
var waterOccurrence = gsw.select('occurrence').clip(farmArea);

// Select the change dynamics (seasonal and permanent water) for baseline vs current
var waterDynamics = gsw.select('change_abs').clip(farmArea); // change_abs: 0 = no change, 1 = perm water disappeared, 2 = seasonal water disappeared, etc.

// Define visualization for water - Adjusted palette for better visibility
var waterVis = {
  min: 1, // Min based on provided diagnostic
  max: 29, // Max based on provided diagnostic
  palette: ['#CCEFFF', '#99DAF0', '#66C4E0', '#33AFD0', '#0099C0', '#007AA0'] // Light to deep vibrant blue
};

// Add JRC water occurrence layer
Map.addLayer(waterOccurrence, waterVis, '? JRC Water Occurrence (Permanent)');

// Calculate statistics for permanent water occurrence
var permanentWaterStats = waterOccurrence.reduceRegion({
  reducer: ee.Reducer.mean(),
  geometry: farmArea,
  scale: 30, // JRC data resolution
  maxPixels: 1e9
});

permanentWaterStats.evaluate(function(result) {
  var avgWaterOcc = result.occurrence;
  if (avgWaterOcc !== null && !isNaN(avgWaterOcc)) {
    print('? JRC Permanent Water Occurrence (Audit): ' + avgWaterOcc.toFixed(2) + '% of time water was present');
    jrcWaterOccLabel_ui.setValue(avgWaterOcc.toFixed(2) + '%');
  } else {
    print('⚠️ JRC Permanent Water Occurrence (Audit): Could not compute statistics for water occurrence.');
    jrcWaterOccLabel_ui.setValue('N/A');
  }
});

// >>> DIAGNOSTIC PRINT for JRC Water Occurrence MIN/MAX <<<
waterOccurrence.reduceRegion({
  reducer: ee.Reducer.minMax(),
  geometry: farmArea,
  scale: 30,
  maxPixels: 1e9
}).evaluate(function(minMaxResult) {
  var minVal = minMaxResult.occurrence_min;
  var maxVal = minMaxResult.occurrence_max;
  if (minVal !== null && maxVal !== null) {
    print('🌊 JRC Water Occurrence (Audit) - Actual Min/Max: Min=' + minVal.toFixed(2) + '%, Max=' + maxVal.toFixed(2) + '%');
  } else {
    print('⚠️ JRC Water Occurrence (Audit) - Could not determine actual min/max values.');
  }
});


// --- 2. Precipitation (CHIRPS Daily) - Keeping calculation, removing map layer
// Load CHIRPS daily precipitation data
var chirps = ee.ImageCollection('UCSB-CHG/CHIRPS/DAILY')
  .filterDate(currentStartDate, currentEndDate)
  .filterBounds(farmArea);

// Diagnostic: Print size of CHIRPS collection
chirps.size().evaluate(function(size) {
  print('💧 CHIRPS Collection Size (Diagnostic): ' + size + ' images found.');
});

// Diagnostic: Print info about the first image in CHIRPS collection
chirps.first().evaluate(function(imageInfo) {
  if (imageInfo) {
    print('💧 CHIRPS First Image Info (Diagnostic): ' + JSON.stringify(imageInfo.bands));
  } else {
    print('⚠️ CHIRPS First Image Info (Diagnostic): No images found in collection or could not retrieve info.');
  }
});


// Compute the total precipitation over the period
var totalPrecipitation = chirps.sum().clip(farmArea); // Sums up daily rainfall in mm

// Diagnostic: Sample a pixel value from totalPrecipitation within the farm area
farmArea.centroid(1).evaluate(function(centroid) {
  totalPrecipitation.reduceRegion({
    reducer: ee.Reducer.first(),
    geometry: centroid,
    scale: 5566,
    tileScale: 16 // Increase tileScale to avoid computation limits for single pixel reduction
  }).evaluate(function(pixelValue) {
    if (pixelValue && pixelValue.precipitation !== undefined) {
      print('💧 Total Precipitation (Diagnostic) - Sampled Pixel Value at Centroid: ' + pixelValue.precipitation.toFixed(2) + 'mm');
    } else {
      print('⚠️ Total Precipitation (Diagnostic) - Could not sample pixel value. No data at centroid or masked.');
    }
  });
});

// Calculate average precipitation over the farm area
var precipStats = totalPrecipitation.reduceRegion({
  reducer: ee.Reducer.mean(),
  geometry: farmArea,
  scale: 5566, // CHIRPS original resolution in meters
  maxPixels: 1e9
});

precipStats.evaluate(function(result) {
  var avgPrecip = result.precipitation;
  if (avgPrecip !== null && !isNaN(avgPrecip)) {
    print('💧 Average Total Precipitation (Audit): ' + avgPrecip.toFixed(2) + ' mm for period ' + currentStartDate.format('YYYY-MM-dd').getInfo() + ' to ' + currentEndDate.format('YYYY-MM-dd').getInfo());
    avgPrecipitationLabel_ui.setValue(avgPrecip.toFixed(2) + ' mm');
  } else {
    print('⚠️ Average Total Precipitation (Audit): Could not compute average precipitation.');
    avgPrecipitationLabel_ui.setValue('N/A');
  }
});


// ╭────────────────────────────────────────────────────────────╮
// │             SOIL MOISTURE AUDIT  (FOR H2O CREDITS)          │
// ╰────────────────────────────────────────────────────────────╯

// Load SMAP L3 Daily soil moisture data using the correct asset ID
var smap = ee.ImageCollection('NASA_USDA/HSL/SMAP10KM_soil_moisture')
  // Filtering for the full known historical range of this dataset
  .filterDate('2015-04-02', '2022-08-02') // This dataset's availability is from April 2015 to August 2022
  .filterBounds(farmArea);

// Compute the mean soil moisture over the period, selecting the correct band and unmasking
var meanSoilMoisture = smap.select('ssm').mean().unmask().clip(farmArea);

// Calculate dynamic visualization parameters for soil moisture using percentiles
var smStats = meanSoilMoisture.reduceRegion({
  reducer: ee.Reducer.percentile([5, 95]), // Use 5th and 95th percentiles for min/max
  geometry: farmArea,
  scale: 10000, // SMAP 10KM resolution
  maxPixels: 1e9
});

// Define visualization for soil moisture based on dynamic percentiles
smStats.evaluate(function(p) {
  // Check if percentile values are valid before defining visualization
  if (p && p.ssm_p5 !== undefined && p.ssm_p95 !== undefined && !isNaN(p.ssm_p5) && !isNaN(p.ssm_p95)) {
    // Print the dynamically calculated min/max to confirm the range
    print('💧 Soil Moisture (Audit) - Dynamic Percentile Range (2015-2022): Min=' + p.ssm_p5.toFixed(3) + ' m³/m³, Max=' + p.ssm_p95.toFixed(3) + ' m³/m³');

    // Only apply visualization if there's actual variation, otherwise fallback will apply
    if (p.ssm_p5 !== p.ssm_p95) {
      var soilMoistureVis = {
        min: p.ssm_p5,
        max: p.ssm_p95,
        // Aggressively contrasting palette to highlight subtle variations
        palette: ['#b30000', '#e34a33', '#fc8d59', '#fdbb84', '#fdd8a7', '#fff7bc', '#c7e9c0', '#a1d99b', '#74c476', '#41ab5d', '#238b45', '#006d2c'] // Red to dark green, with more steps
      };
      Map.addLayer(meanSoilMoisture, soilMoistureVis, '💧 Soil Moisture (m³/m³) Audit (2015-2022)');
      print('💧 Soil Moisture (Audit) - Visualized using 5th-95th Percentiles (2015-2022)');
    } else {
      print('⚠️ Soil Moisture (Audit) - No variation found within 5th-95th percentiles (2015-2022). Displaying as uniform color.');
      // Fallback to a single color if no variation, as the map would anyway show one color.
      Map.addLayer(meanSoilMoisture, {palette: ['#006400']}, '💧 Soil Moisture (m³/m³) Audit (Uniform, 2015-2022)');
    }
  } else {
    print('⚠️ Soil Moisture (Audit) - Could not determine dynamic min/max values for visualization (2015-2022). Raw percentile result: ' + JSON.stringify(p));
    // Fallback to a fixed visualization if dynamic calculation fails, with a wider range and clear palette
    var fallbackSoilMoistureVis = {
      min: 0.05, // Adjusted min
      max: 0.35, // Adjusted max
      palette: ['#8c510a', '#d8b365', '#f6e8c3', '#c7eae5', '#5ab4ac', '#01665e'] // Brown to teal, more distinct
    };
    Map.addLayer(meanSoilMoisture, fallbackSoilMoistureVis, '💧 Soil Moisture (m³/m³) Audit (Fallback Vis, 2015-2022)');
  }
});


// Calculate average soil moisture over the farm area
var soilMoistureMeanStats = meanSoilMoisture.reduceRegion({
  reducer: ee.Reducer.mean(),
  geometry: farmArea,
  scale: 10000, // SMAP resolution is 10km
  maxPixels: 1e9
});

soilMoistureMeanStats.evaluate(function(result) {
  if (result === null || result === undefined) {
    print('⚠️ Average Soil Moisture (Audit): Result object is null or undefined. Cannot compute average soil moisture. Raw result: ' + JSON.stringify(result));
    avgSoilMoistureLabel_ui.setValue('N/A');

  } else {
    var avgSoilMoisture = result.ssm; // Corrected band name
    if (avgSoilMoisture !== null && !isNaN(avgSoilMoisture)) {
      print('💧 Average Soil Moisture (Audit): ' + avgSoilMoisture.toFixed(3) + ' m³/m³ for period (2015-2022)');
      avgSoilMoistureLabel_ui.setValue(avgSoilMoisture.toFixed(3) + ' m³/m³');
    } else {
      print('⚠️ Average Soil Moisture (Audit): Could not compute average soil moisture. "ssm" property is missing or invalid. Raw result: ' + JSON.stringify(result));
      avgSoilMoistureLabel_ui.setValue('N/A');
    }
  }
});

// Diagnostic: Print size of SMAP collection
smap.size().evaluate(function(size) {
  print('💧 SMAP Collection Size (Diagnostic): ' + size + ' images found (2015-2022).');
});

// Diagnostic: Print info about the first image in SMAP collection
smap.first().evaluate(function(imageInfo) {
  if (imageInfo) {
    print('💧 SMAP First Image Info (Diagnostic): ' + JSON.stringify(imageInfo.bands));
  } else {
    print('⚠️ SMAP First Image Info (Diagnostic): No images found in collection or could not retrieve info (2015-2022).');
  }
});

// Diagnostic: Sample a pixel value from meanSoilMoisture within the farm area
farmArea.centroid(1).evaluate(function(centroid) {
  meanSoilMoisture.reduceRegion({
    reducer: ee.Reducer.first(),
    geometry: centroid,
    scale: 10000, // SMAP resolution is 10km
    tileScale: 16 // Increase tileScale to avoid computation limits for single pixel reduction
  }).evaluate(function(pixelValue) {
    if (pixelValue && pixelValue.ssm !== undefined) { // Corrected band name
      print('💧 Soil Moisture (Diagnostic) - Sampled Pixel Value at Centroid: ' + pixelValue.ssm.toFixed(3) + ' m³/m³ (2015-2022)');
    } else {
      print('⚠️ Soil Moisture (Diagnostic) - Could not sample pixel value. No data at centroid or masked (2015-2022).');
    }
  });
});

// Diagnostic: Count non-masked pixels in meanSoilMoisture within farmArea
meanSoilMoisture.reduceRegion({
  reducer: ee.Reducer.count(),
  geometry: farmArea,
  scale: 10000, // SMAP resolution is 10km
  maxPixels: 1e9
}).evaluate(function(pixelCountResult) {
  if (pixelCountResult && pixelCountResult.ssm !== undefined) { // Corrected band name
    print('💧 Soil Moisture (Diagnostic) - Non-masked Pixels within Farm Area: ' + pixelCountResult.ssm + ' (2015-2022)');
  } else {
    print('⚠️ Soil Moisture (Diagnostic) - Could not count non-masked pixels for soil moisture (2015-2022).');
  }
});


// ---------------------------------------------
// CO2NEX Land Carbon Report - UI Panel Setup
// ---------------------------------------------

// Global variables to hold UI Label widgets for dynamic updates
var farmAreaLabel_ui, baselineCarbonLabel_ui, currentCarbonLabel_ui;
var netSequesteredLabel_ui, totalNetSequesteredLabel_ui, finalCarbonCreditLabel_ui;
var avgNdviLabel_ui, ndviChangeLabel_ui, avgPrecipitationLabel_ui;
var avgSoilMoistureLabel_ui, fireAlertLabel_ui, totalForestLossLabel_ui;
var fireRelatedLossLabel_ui, otherLossLabel_ui, forestGainLabel_ui;
var jrcWaterOccLabel_ui, gediAGBLabel_ui, collectionDateLabel_ui;

// Image panel components (declared for compatibility)
var selectedImageView, imageTitleLabel, imageDescriptionLabel, imageDateLabel, photoLinkLabel;

// Helper function to create a row and return the value widget
function addInfoRow(parentPanel, labelText, initialValue) {
  var row = ui.Panel({
    layout: ui.Panel.Layout.flow('horizontal'),
    style: {margin: '2px 0'}
  });

  var labelWidget = ui.Label(labelText + ':', {
    fontWeight: 'bold',
    width: '180px',
    color: '#34495e'
  });

  var valueWidget = ui.Label(initialValue || 'Loading...', {
    color: '#2d3436',
    stretch: 'horizontal'
  });

  row.add(labelWidget);
  row.add(valueWidget);
  parentPanel.add(row);
  return valueWidget;
}

// Create the scrollable inner content panel
var scrollableContent = ui.Panel({
  layout: ui.Panel.Layout.flow('vertical'),
  style: {
    maxHeight: '500px',
    backgroundColor: '#f9f9f9',
    padding: '10px',
    border: '1px solid #dfe6e9',
    borderRadius: '6px',
    width: '100%'
  }
});

// Create the main floating panel positioned at the bottom-right
var controlPanel = ui.Panel({
  layout: ui.Panel.Layout.flow('vertical'),
  style: {
    position: 'bottom-right',
    width: '360px',
    padding: '10px',
    backgroundColor: 'rgba(255,255,255,0.97)',
    border: '1px solid #ccc',
    borderRadius: '8px',
    maxHeight: '600px'
  }
});

// Add title to the control panel
controlPanel.add(ui.Label('CO2NEX Land Carbon Project Report', {
  fontWeight: 'bold',
  fontSize: '16px',
  margin: '0 0 10px 0',
  color: '#2c3e50'
}));

// Add scrollable content to control panel
controlPanel.add(scrollableContent);

// Add control panel to the UI
ui.root.add(controlPanel);

// === Add All Key Fields to scrollableContent ===
// Project Info
farmAreaLabel_ui = addInfoRow(scrollableContent, 'Farm Area (ha)');
baselineCarbonLabel_ui = addInfoRow(scrollableContent, 'Baseline Carbon Stock (tC/ha)');
currentCarbonLabel_ui = addInfoRow(scrollableContent, 'Current Carbon Stock (tC/ha)');
netSequesteredLabel_ui = addInfoRow(scrollableContent, 'Net CO₂ Sequestered (tCO₂e/ha)');
totalNetSequesteredLabel_ui = addInfoRow(scrollableContent, 'Total Net CO₂ Sequestered (tCO₂e)');
finalCarbonCreditLabel_ui = addInfoRow(scrollableContent, 'Est. tCO₂e/ha for Credits');

// Environmental Audits
avgNdviLabel_ui = addInfoRow(scrollableContent, 'Avg NDVI (Carbon Health)');
ndviChangeLabel_ui = addInfoRow(scrollableContent, 'NDVI Change (Current vs Baseline)');
avgPrecipitationLabel_ui = addInfoRow(scrollableContent, 'Avg Total Precipitation (mm)');
avgSoilMoistureLabel_ui = addInfoRow(scrollableContent, 'Avg Soil Moisture (m³/m³)');
fireAlertLabel_ui = addInfoRow(scrollableContent, 'Active Fires (last 3 days)');
totalForestLossLabel_ui = addInfoRow(scrollableContent, 'Total Forest Loss (ha)');
fireRelatedLossLabel_ui = addInfoRow(scrollableContent, 'Fire-Related Loss (ha)');
otherLossLabel_ui = addInfoRow(scrollableContent, 'Other Forest Loss (ha)');
forestGainLabel_ui = addInfoRow(scrollableContent, 'Forest Gain (ha)');
jrcWaterOccLabel_ui = addInfoRow(scrollableContent, 'JRC Water Occurrence (%)');
gediAGBLabel_ui = addInfoRow(scrollableContent, 'GEDI AGB Audit (t/ha)');

// Static / Metadata Info (use String() to avoid crashing on nulls)
addInfoRow(scrollableContent, 'Project ID', String(projectID || 'N/A'));
addInfoRow(scrollableContent, 'Classification', String(classification || 'N/A'));
addInfoRow(scrollableContent, 'Landowner Name', String(landownerName || 'N/A'));

collectionDateLabel_ui = addInfoRow(scrollableContent, 'Data Collection Date', 'Loading...');
currentEndDate.format('YYYY-MM-dd').evaluate(function(dateStr) {
  collectionDateLabel_ui.setValue(dateStr);
});
addInfoRow(scrollableContent, 'Satellite Sources', 'Sentinel-2, SoilGrids, GEDI, Hansen, CHIRPS, SMAP');

// === Map Setup ===
Map.setOptions('HYBRID');
Map.centerObject(farmArea, 14);

// Final Visualization Layers
Map.addLayer(farmArea, {color: 'blue', opacity: 0.8}, '🌾 Project Boundary (Top Layer)');
Map.addLayer(fireAlertZone, {color: 'gray', opacity: 0.3}, 'Buffer Zone (5km)');
Map.addLayer(currentCarbonImage.clip(farmArea), totalCarbonVis, '📊 Current Total Carbon Stock (tonnes/ha)');
Map.addLayer(s2MeanNDVIDisplay, ndviVis, '🌱 NDVI: Carbon Health Index (Sentinel-2)');
Map.addLayer(fires, {color: 'red'}, '🔥 Fire Detections');
Map.addLayer(groundTruthPoints, {color: 'purple'}, '📍 Ground Truth Sample Points (Conceptual)');

// === Helper Function (Optional) ===
var firePhotos = []; // Needed for fire point click logic
var findPhotoByName = function(name) {
  for (var i = 0; i < firePhotos.length; i++) {
    if (firePhotos[i].name === name) {
      return firePhotos[i];
    }
  }
  return null;
};

// LANDOWNER GROUND TRUTH DOCUMENTATION POINTS (CORRECTED STYLING)
// This FeatureCollection is used to create the ground truth  markers and their associated data.
var fireDamagePoints = ee.FeatureCollection([
  // 1. Lake Total Building Loss
  ee.Feature(
    ee.Geometry.Point([-53.97144182416474, -15.39444772249011]), {
      name: 'Lake Total Building Loss',
      photo: 'https://co2nex.org/wp-content/uploads/2025/04/08_farm_north_cattle_pin_lake_destroyed.webp',
      date: 'August 22, 2023',
      description: 'Complete destruction of lake infrastructure and cattle processing facilities.'
    }
  ),
  
  // 2. Fazenda Guanabara - Cambará Agro
  ee.Feature(
    ee.Geometry.Point([-53.99312530958786, -15.39429393949623]), {
      name: 'Fazenda - Cambará Agro',
      photo: 'https://co2nex.org/wp-content/uploads/2025/04/12_total_fire_damage_area_600_hectares.webp',
      date: 'August 22, 2023',
      description: 'Central hub of operations. 490 acres pasture lost, 520 acres grain fields lost, 400 acres cerrado burned.'
    }
  ),
  
  // 3. 20 km of fence destroyed
  ee.Feature(
    ee.Geometry.Point([-53.96405979061254, -15.38453971548273]), {
      name: '20 km of fence destroyed',
      photo: 'https://co2nex.org/wp-content/uploads/2025/04/10_20km_fence_destoyed_fire_property_line.webp',
      date: 'August 22, 2023',
      description: 'Boundary fencing destroyed along property line with reservation.'
    }
  ),
  
  // 4. Looking West From Fire
  ee.Feature(
    ee.Geometry.Point([-53.98506922688957, -15.39187213238204]), {
      name: 'Looking West From Fire',
      photo: 'https://co2nex.org/wp-content/uploads/2025/04/09_looking_west_farm_grain_stroage_corner_fire.webp',
      date: 'August 22, 2023',
      description: 'View toward grain storage facility with fire approaching from right.'
    }
  ),
  
  // 5. Drone Looking East
  ee.Feature(
    ee.Geometry.Point([-53.9846857824926, -15.38500802077057]), {
      name: 'Drone Looking East',
      photo: 'https://co2nex.org/wp-content/uploads/2025/04/07_drone_looking_east_farm_damage.webp',
      date: 'August 22, 2023',
      description: 'Aerial view showing extent of damage across multiple fields.'
    }
  ),
  
  // 6. Drone Footage of fire on the reserve
  ee.Feature(
    ee.Geometry.Point([-53.99207771169187, -15.39352043912761]), {
      name: 'Fire Origin on Reservation',
      photo: 'https://co2nex.org/wp-content/uploads/2025/04/02_drone_fire_from_grain_storage_westside.webp',
      date: 'August 22, 2023',
      description: 'Documentation of fire originating on reservation land before spreading.'
    }
  ),
  
  // 7. Fire reached the grain fields
  ee.Feature(
    ee.Geometry.Point([-53.96845453398752, -15.39455210034347]), {
      name: 'Fire in Grain Fields',
      photo: 'https://co2nex.org/wp-content/uploads/2025/04/01_fire_smoke_northeast_crop_fields.webp',
      date: 'August 22, 2023',
      description: 'Fire consuming already-harvested grain fields, destroying soil organic matter.'
    }
  ),
  
  // 8. Drone Of Approaching Fire
  ee.Feature(
    ee.Geometry.Point([-53.96063722479749, -15.38088067930878]), {
      name: 'Fire Approaching Boundary',
      photo: 'https://co2nex.org/wp-content/uploads/2025/04/03_drone_fire_illegal_native_lands_forest_burn.webp',
      date: 'August 22, 2023',
      description: 'Documentation of fire moving toward farm from reservation land.'
    }
  ),
  
  // 9. Water Truck Lost Fighting Fire
  ee.Feature(
    ee.Geometry.Point([-53.98178769269612, -15.39080150720604]), {
      name: 'Water Truck Destroyed',
      photo: 'https://co2nex.org/wp-content/uploads/2025/04/11_water_truck_destroyed_fighting_fire.webp',
      date: 'August 22, 2023',
      description: 'Equipment lost while attempting to control fire spread.'
    }
  ),
  
  // 10. Fire Burns On Pastures
  ee.Feature(
    ee.Geometry.Point([-53.97635902967543, -15.38886746420416]), {
      name: 'Pasture Destruction',
      photo: 'https://co2nex.org/wp-content/uploads/2025/04/05_farm_reservation_property_line_fire_uncontainmed.webp',
      date: 'August 22, 2023',
      description: 'High-quality pasture land being consumed by flames.'
    }
  ),
  
  // 11. Fire Burns On Farm Land
  ee.Feature(
    ee.Geometry.Point([-53.97463494276788, -15.38754629696177]), {
      name: 'Cerrado Biome Impact',
      photo: 'https://co2nex.org/wp-content/uploads/2025/04/06_farm_reservation_property_line_fire_uncontainmed.webp',
      date: 'August 22, 2023',
      description: 'Fire burning through legally protected native vegetation.'
    }
  ),
  
  // 12. Fire Enters at Property Line
  ee.Feature(
    ee.Geometry.Point([-53.96894553792941, -15.39580193089747]), {
      name: 'Initial Fire Entry Point',
      photo: 'https://co2nex.org/wp-content/uploads/2025/04/04_farm_fields_cow_feed_destroyed_fire.webp',
      date: 'August 22, 2023',
      description: 'Location where fire first crossed from reservation to farm property.'
    }
  )
]);

// This evaluate block is used to populate `firePhotos` for the click function,
// even though the buttons themselves are not being added to the UI in this version.
fireDamagePoints.toList(fireDamagePoints.size()).evaluate(function(features) {
  features.forEach(function(f) {
    firePhotos.push({
      name: f.properties.name,
      url: f.properties.photo,
      description: f.properties.description,
      date: f.properties.date
    });
  });

  // Since we're not adding buttons here, no need for the forEach to add buttons
  // This block essentially just ensures firePhotos array is populated.
});


// Update labels with actual values
farmAreaHectares.evaluate(function(ha) {
  farmAreaLabel_ui.setValue(ha.toFixed(2) + ' ha');
});

baselineCarbonStats.evaluate(function(baselineResult) {
  var avgBaselineCarbon = baselineResult.Total_Carbon_tonnes_ha;
  if (avgBaselineCarbon !== null && !isNaN(avgBaselineCarbon)) {
    print('⭐ Baseline Total Carbon Stock: ' + avgBaselineCarbon.toFixed(2) + ' tonnes C/ha');
    baselineCarbonLabel_ui.setValue(avgBaselineCarbon.toFixed(2) + ' tC/ha');

    currentCarbonStats.evaluate(function(currentResult) {
      var avgCurrentCarbon = currentResult.Total_Carbon_tonnes_ha;
      if (avgCurrentCarbon !== null && !isNaN(avgCurrentCarbon)) {
        print('⭐ Current Total Carbon Stock: ' + avgCurrentCarbon.toFixed(2) + ' tonnes C/ha');
        currentCarbonLabel_ui.setValue(avgCurrentCarbon.toFixed(2) + ' tC/ha');

        var netSequesteredCarbon_C_per_ha = avgCurrentCarbon - avgBaselineCarbon;
        var netSequesteredCO2e_per_ha = netSequesteredCarbon_C_per_ha * 3.67;

        print('♻️ Net CO₂ Sequestered: ' + netSequesteredCO2e_per_ha.toFixed(2) + ' tonnes CO₂e/ha');
        netSequesteredLabel_ui.setValue(netSequesteredCO2e_per_ha.toFixed(2) + ' tCO₂e/ha');

        farmAreaHectares.evaluate(function(ha) {
          var totalNetSequesteredCO2e = netSequesteredCO2e_per_ha * ha;
          print('♻️ Total Net CO₂ Sequestered for Farm Area: ' + totalNetSequesteredCO2e.toFixed(2) + ' tonnes CO₂e');
          totalNetSequesteredLabel_ui.setValue(totalNetSequesteredCO2e.toFixed(2) + ' tCO₂e');
          finalCarbonCreditLabel_ui.setValue(netSequesteredCO2e_per_ha.toFixed(2) + ' tCO₂e/ha');
        });

      } else {
        print('⚠️ Could not compute Current Total Carbon Stock. Result: ' + JSON.stringify(currentResult));
        currentCarbonLabel_ui.setValue('N/A');
        netSequesteredLabel_ui.setValue('N/A');
        totalNetSequesteredLabel_ui.setValue('N/A');
        finalCarbonCreditLabel_ui.setValue('N/A');
      }
    }); // End of currentCarbonStats.evaluate

  } else {
    print('⚠️ Could not compute Baseline Total Carbon Stock. Result: ' + JSON.stringify(baselineResult));
    baselineCarbonLabel_ui.setValue('N/A');
    currentCarbonLabel_ui.setValue('N/A');
    netSequesteredLabel_ui.setValue('N/A');
    totalNetSequesteredLabel_ui.setValue('N/A');
    finalCarbonCreditLabel_ui.setValue('N/A');
  }
}); // End of baselineCarbonStats.evaluate


s2NdviStats.evaluate(function(result) {
  var avgNDVI = result.NDVI_mean;
  if (avgNDVI !== null && !isNaN(avgNDVI)) {
    var score = Math.max(0, (avgNDVI * 100)).toFixed(2);
    print('📈 Average NDVI (Carbon Health Index - Sentinel-2): ' + score + ' / 100');
    avgNdviLabel_ui.setValue(score + ' / 100');
  } else {
    print('⚠️ Could not compute Sentinel-2 NDVI statistics – Result was: ' + JSON.stringify(result));
    avgNdviLabel_ui.setValue('N/A');
  }
});

baselineS2NdviStats.evaluate(function(baselineResult) {
  var avgBaselineNDVI = baselineResult.NDVI;
  s2NdviStats.evaluate(function(currentResult) {
    var avgCurrentNDVI = currentResult.NDVI_mean;
    if (avgBaselineNDVI !== null && !isNaN(avgBaselineNDVI) && avgCurrentNDVI !== null && !isNaN(avgCurrentNDVI)) {
      var ndviChange = (avgCurrentNDVI - avgBaselineNDVI).toFixed(3);
      ndviChangeLabel_ui.setValue(ndviChange);
    } else {
      ndviChangeLabel_ui.setValue('N/A');
    }
  });
});


precipStats.evaluate(function(result) {
  var avgPrecip = result.precipitation;
  if (avgPrecip !== null && !isNaN(avgPrecip)) {
    print('💧 Average Total Precipitation (Audit): ' + avgPrecip.toFixed(2) + ' mm for period ' + currentStartDate.format('YYYY-MM-dd').getInfo() + ' to ' + currentEndDate.format('YYYY-MM-dd').getInfo());
    avgPrecipitationLabel_ui.setValue(avgPrecip.toFixed(2) + ' mm');
  } else {
    print('⚠️ Average Total Precipitation (Audit): Could not compute average precipitation.');
    avgPrecipitationLabel_ui.setValue('N/A');
  }
});

soilMoistureMeanStats.evaluate(function(result) {
  if (result === null || result === undefined) {
    print('⚠️ Average Soil Moisture (Audit): Result object is null or undefined. Cannot compute average soil moisture. Raw result: ' + JSON.stringify(result));
    avgSoilMoistureLabel_ui.setValue('N/A');

  } else {
    var avgSoilMoisture = result.ssm; // Corrected band name
    if (avgSoilMoisture !== null && !isNaN(avgSoilMoisture)) {
      print('💧 Average Soil Moisture (Audit): ' + avgSoilMoisture.toFixed(3) + ' m³/m³ for period (2015-2022)');
      avgSoilMoistureLabel_ui.setValue(avgSoilMoisture.toFixed(3) + ' m³/m³');
    } else {
      print('⚠️ Average Soil Moisture (Audit): Could not compute average soil moisture. "ssm" property is missing or invalid. Raw result: ' + JSON.stringify(result));
      avgSoilMoistureLabel_ui.setValue('N/A');
    }
  }
});
