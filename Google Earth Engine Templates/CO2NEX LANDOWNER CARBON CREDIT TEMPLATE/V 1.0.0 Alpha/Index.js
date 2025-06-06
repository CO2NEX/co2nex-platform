// ╭────────────────────────────────────────────────────────────╮
// │          CO2NEX LANDOWNER CARBON CREDIT TEMPLATE V1 Alpha  │
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

// 🗺️ MAP INIT - Initial map setup
Map.centerObject(farmArea, 14);
Map.setOptions('HYBRID');
Map.addLayer(farmArea, {color: 'blue'}, 'Project Boundary');

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

// Add Current Carbon Stock layer to map
Map.addLayer(currentCarbonImage.clip(farmArea), totalCarbonVis, '📊 Current Total Carbon Stock (tonnes/ha)');


// Evaluate and print Baseline Carbon Stock
var baselineCarbonStats = baselineCarbonImage.reduceRegion({
  reducer: ee.Reducer.mean(),
  geometry: farmArea,
  scale: 10, // Use Sentinel-2 resolution for consistency
  maxPixels: 1e9
});

baselineCarbonStats.evaluate(function(baselineResult) {
  var avgBaselineCarbon = baselineResult.Total_Carbon_tonnes_ha;
  if (avgBaselineCarbon !== null && !isNaN(avgBaselineCarbon)) {
    print('⭐ Baseline Total Carbon Stock: ' + avgBaselineCarbon.toFixed(2) + ' tonnes C/ha');

    // Evaluate and print Current Carbon Stock (nested inside baseline evaluation)
    var currentCarbonStats = currentCarbonImage.reduceRegion({
      reducer: ee.Reducer.mean(),
      geometry: farmArea,
      scale: 10,
      maxPixels: 1e9
    });

    currentCarbonStats.evaluate(function(currentResult) {
      var avgCurrentCarbon = currentResult.Total_Carbon_tonnes_ha;
      if (avgCurrentCarbon !== null && !isNaN(avgCurrentCarbon)) {
        print('⭐ Current Total Carbon Stock: ' + avgCurrentCarbon.toFixed(2) + ' tonnes C/ha');

        // ╭────────────────────────────────────────────────────────────╮
        // │                    CO₂ SEQUESTERED CALCULATION            │
        // ╰────────────────────────────────────────────────────────────╯

        // Calculate Net Carbon Sequestration (tonnes C/ha)
        var netSequesteredCarbon_C_per_ha = avgCurrentCarbon - avgBaselineCarbon;

        // Convert Net Carbon to CO₂e (tonnes CO₂e/ha)
        // Conversion factor: 1 tonne C = 3.67 tonnes CO₂e
        var netSequesteredCO2e_per_ha = netSequesteredCarbon_C_per_ha * 3.67;

        print('♻️ Net CO₂ Sequestered: ' + netSequesteredCO2e_per_ha.toFixed(2) + ' tonnes CO₂e/ha');

        // Calculate Total Net CO₂ Sequestered for the entire farm area
        farmAreaHectares.evaluate(function(ha) {
          var totalNetSequesteredCO2e = netSequesteredCO2e_per_ha * ha;
          print('♻️ Total Net CO₂ Sequestered for Farm Area: ' + totalNetSequesteredCO2e.toFixed(2) + ' tonnes CO₂e');
        });

      } else {
        print('⚠️ Could not compute Current Total Carbon Stock. Result: ' + JSON.stringify(currentResult));
      }
    }); // End of currentCarbonStats.evaluate

  } else {
    print('⚠️ Could not compute Baseline Total Carbon Stock. Result: ' + JSON.stringify(baselineResult));
  }
}); // End of baselineCarbonStats.evaluate


// ╭────────────────────────────────────────────────────────────╮
// │🌱 NDVI: Carbon Health Index (Primary: Sentinel-2)         │
// ╰────────────────────────────────────────────────────────────╯

// This section is kept for the NDVI health index display,
// but the underlying image collection is now used by `calculateTotalCarbonImage`
var s2CollectionForDisplay = ee.ImageCollection('COPERNICUS/S2_SR')
  .filterDate(currentStartDate, currentEndDate)
  .filterBounds(farmArea)
  .filter(ee.Filter.lt('CLOUDY_PIXEL_PERCENTAGE', 10))
  .map(function(image) {
    var s2Image = image.divide(10000);
    var ndvi = s2Image.normalizedDifference(['B8', 'B4']).rename('NDVI');
    return ndvi.copyProperties(image, image.propertyNames());
  });

var s2MeanNDVIDisplay = s2CollectionForDisplay.median().clip(farmArea);

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
Map.addLayer(s2MeanNDVIDisplay, ndviVis, '🌱 NDVI: Carbon Health Index (Sentinel-2)');

var s2NdviStats = s2MeanNDVIDisplay.reduceRegion({
  reducer: ee.Reducer.mean().combine({
    reducer2: ee.Reducer.stdDev(),
    sharedInputs: true
  }),
  geometry: farmArea,
  scale: 10,
  maxPixels: 1e9
});

s2NdviStats.evaluate(function(result) {
  var avgNDVI = result.NDVI_mean;
  var stdDev = result['NDVI_stdDev'];
  if (avgNDVI !== null && !isNaN(avgNDVI) && stdDev !== null && !isNaN(stdDev)) {
    var score = Math.max(0, (avgNDVI * 100)).toFixed(2);
    var stdDevPercent = (stdDev * 100).toFixed(2);
    print('📈 Average NDVI (Carbon Health Index - Sentinel-2): ' + score + ' / 100');
    print('📊 Standard Deviation (Sentinel-2): ' + stdDevPercent + '%');
  } else {
    print('⚠️ Could not compute Sentinel-2 NDVI statistics – Result was: ' + JSON.stringify(result));
  }
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
    // Mask NDVI values outside the valid range
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
        print('📊 Standard Deviation (VIIRS Backup): ' + stdDevPercent + '%');
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
  }
});

// =========================
// 🗺 MAP VISUALIZATION - Final map layers
// =========================
Map.addLayer(farmArea, {color: 'blue'}, '🌾 Farm Area');
Map.addLayer(buffer, {color: 'gray'}, 'Buffer (5km)');
Map.addLayer(fires, {color: 'red'}, '🔥 Fire Detections');

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
