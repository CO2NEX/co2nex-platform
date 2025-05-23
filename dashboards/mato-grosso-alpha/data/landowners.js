// Sample landowner polygons for Mato Grosso region (Alpha dataset)

var landowners = ee.FeatureCollection([
  ee.Feature(
    ee.Geometry.Polygon([
      [
        [-56.095, -12.753],
        [-56.091, -12.753],
        [-56.091, -12.750],
        [-56.095, -12.750],
        [-56.095, -12.753]
      ]
    ]),
    {
      landowner: 'João Silva',
      property_id: 'MT001',
      area_ha: 112.5
    }
  ),
  ee.Feature(
    ee.Geometry.Polygon([
      [
        [-56.080, -12.760],
        [-56.076, -12.760],
        [-56.076, -12.757],
        [-56.080, -12.757],
        [-56.080, -12.760]
      ]
    ]),
    {
      landowner: 'Maria Souza',
      property_id: 'MT002',
      area_ha: 84.2
    }
  )
]);

// Display polygons on the map (optional)
Map.addLayer(landowners, {color: 'green'}, 'Landowner Polygons');
Map.centerObject(landowners, 13);
