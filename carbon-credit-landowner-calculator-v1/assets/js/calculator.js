document.addEventListener('DOMContentLoaded', function() {
    // DOM elements
    const elements = {
        landArea: document.getElementById('landArea'),
        areaUnit: document.getElementById('areaUnit'),
        landType: document.getElementById('landType'),
        projectDuration: document.getElementById('projectDuration'),
        carbonPrice: document.getElementById('carbonPrice'),
        results: document.getElementById('results'),
        // Add all other DOM elements needed for results
    };

    // Sequestration rates
    const sequestrationRates = {
        forest: { rate: 1.8, biomass: 75, soil: 20, litter: 5 },
        reforest: { rate: 9.2, biomass: 65, soil: 30, litter: 5 },
        regenAg: { rate: 1.3, biomass: 15, soil: 80, litter: 5 },
        pasture: { rate: 0.9, biomass: 25, soil: 70, litter: 5 },
        wetland: { rate: 6.5, biomass: 40, soil: 50, litter: 10 }
    };

    // Conversion factors
    const constants = {
        acresToHectares: 0.404686,
        carsPerTonne: 1 / 4.6,
        treesPerTonne: 1 / 0.06,
        coalPerTonne: 2000 / 2.26,
        homesPerTonne: 1 / 7.15
    };

    // Initialize calculator
    function initCalculator() {
        calculateResults();
        setupEventListeners();
    }

    // Set up event listeners
    function setupEventListeners() {
        Object.values(elements).forEach(element => {
            if (element && (element.tagName === 'INPUT' || element.tagName === 'SELECT')) {
                element.addEventListener('input', calculateResults);
                element.addEventListener('change', calculateResults);
            }
        });
    }

    // Main calculation function
    function calculateResults() {
        // Get input values
        const inputs = {
            landArea: parseFloat(elements.landArea.value) || 0,
            areaUnit: elements.areaUnit.value,
            landType: elements.landType.value,
            duration: parseFloat(elements.projectDuration.value) || 0,
            price: parseFloat(elements.carbonPrice.value) || 0
        };

        // Perform calculations
        const results = performCalculations(inputs);
        
        // Update DOM
        updateResults(results, inputs.price > 0);
    }

    // Calculation logic
    function performCalculations(inputs) {
        const landAreaHectares = inputs.areaUnit === 'ha' ? inputs.landArea : inputs.landArea * constants.acresToHectares;
        const { rate } = sequestrationRates[inputs.landType] || sequestrationRates.forest;
        
        const annualSeq = landAreaHectares * rate;
        const totalSeq = annualSeq * inputs.duration;
        
        return {
            annualSeq,
            totalSeq,
            annualRev: annualSeq * inputs.price,
            totalRev: totalSeq * inputs.price,
            impacts: {
                cars: Math.round(annualSeq * constants.carsPerTonne),
                trees: Math.round(totalSeq * constants.treesPerTonne),
                coal: Math.round(totalSeq * constants.coalPerTonne),
                homes: Math.round(annualSeq * constants.homesPerTonne)
            }
        };
    }

    // Update DOM with results
    function updateResults(results, hasRevenue) {
        // Update all result elements
        // Example:
        document.getElementById('annualSequestration').textContent = results.annualSeq.toFixed(1);
        // Add all other DOM updates
        
        // Toggle results visibility
        elements.results.style.display = results.landArea > 0 ? 'block' : 'none';
    }

    // Initialize
    initCalculator();
});
