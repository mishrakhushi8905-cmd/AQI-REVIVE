import { LocationData, Weather, AnalysisResult, Pollutant, SourceContributor, Intervention, PolicyType, SimulationResult } from '../types';

// 1. Source Proxy Mapping (Lookup)
const SOURCE_PROXY_MAP = {
  'Traffic': {
    pollutants: [Pollutant.NO2, Pollutant.CO, Pollutant.Pb],
    signature: 'High NO2/CO'
  },
  'Industrial': {
    pollutants: [Pollutant.SO2, Pollutant.NH3, Pollutant.PM10],
    signature: 'High SO2/PM10'
  },
  'Residential': {
    pollutants: [Pollutant.PM25],
    signature: 'High PM2.5'
  }
};

// Helper: Generate randomized, normalized breakdown based on base profile
const generateBreakdown = (baseProfile: {source: string, p: number, c: string}[]): SourceContributor[] => {
    // Add natural variation (+/- 5%) to base percentages to simulate real-time fluctuation
    let items = baseProfile.map(item => ({
        ...item,
        p: Math.max(1, item.p + (Math.floor(Math.random() * 10) - 5))
    }));
    
    // Normalize to exactly 100%
    const total = items.reduce((sum, item) => sum + item.p, 0);
    return items.map(item => ({
        source: item.source,
        percentage: Math.round((item.p / total) * 100),
        color: item.c
    })).sort((a, b) => b.percentage - a.percentage); // Sort descending
};

// 3. Street View Integration (Mock)
// Simulates checking if coordinate overlaps with 'Primary Road' or 'Industrial Zone'
const checkStreetViewProxy = (loc: LocationData, suspectedSource: string): boolean => {
  if (suspectedSource.includes('Diesel') || suspectedSource.includes('Traffic')) {
    return loc.type === 'Traffic' || loc.type === 'Mixed'; // Matches "Primary Road" tag
  }
  if (suspectedSource.includes('Industrial') || suspectedSource.includes('Kiln') || suspectedSource.includes('Factory')) {
    return loc.type === 'Industrial'; // Matches "Industrial Zone" tag
  }
  if (suspectedSource.includes('Biomass') || suspectedSource.includes('Cooking')) {
    return loc.type === 'Residential';
  }
  return false;
};

// 2. Logic Gates (The 'AI Mind')
export const diagnoseSource = (
  loc: LocationData,
  weather: Weather
): AnalysisResult => {
  const p = loc.pollutants;
  
  let primarySource = "Background Urban Mix";
  let confidence = 0.50;
  
  // Define Base Profiles based on Zone Type
  let breakdownRaw: {source: string, p: number, c: string}[] = [];

  if (loc.type === 'Industrial') {
      breakdownRaw = [
          { source: 'Industrial Stacks', p: 40, c: '#7c3aed' },
          { source: 'Heavy Transport', p: 25, c: '#ea580c' },
          { source: 'Diesel Generators', p: 20, c: '#db2777' },
          { source: 'Suspended Dust', p: 15, c: '#a8a29e' }
      ];
  } else if (loc.type === 'Traffic') {
      breakdownRaw = [
          { source: 'Vehicular Exhaust', p: 50, c: '#ef4444' },
          { source: 'Road Dust', p: 30, c: '#fbbf24' },
          { source: 'Idling Engines', p: 10, c: '#f59e0b' },
          { source: 'Background', p: 10, c: '#94a3b8' }
      ];
  } else if (loc.type === 'Residential') {
      breakdownRaw = [
          { source: 'Bio-mass/Cooking', p: 35, c: '#10b981' },
          { source: 'Vehicular Drift', p: 25, c: '#f59e0b' },
          { source: 'Construction Dust', p: 20, c: '#a8a29e' },
          { source: 'Waste Burning', p: 20, c: '#64748b' }
      ];
  } else { // Mixed
      breakdownRaw = [
          { source: 'Vehicular Traffic', p: 40, c: '#f59e0b' },
          { source: 'Urban Dust', p: 30, c: '#d97706' },
          { source: 'Biomass Burning', p: 20, c: '#10b981' },
          { source: 'Industrial Drift', p: 10, c: '#6366f1' }
      ];
  }

  let intervention: Intervention = {
      action: "Monitor & Audit",
      description: "Increase sensor density to identify specific sources.",
      roi: "Data accuracy improvement",
      citation: "LMC Guideline",
      costPerSqKm: 2,
      type: 'Policy'
  };

  // --- LOGIC GATES (Detect Anomalies & Override Profile) ---

  // Rule A (IT/Traffic): NO2 > 135ppb & Rush Hour & Gomti Nagar/Polytechnic
  // Relaxing NO2 threshold slightly for mock data variability
  if (p[Pollutant.NO2] > 100 && (loc.name === 'Gomti Nagar' || loc.name === 'Indira Nagar')) {
     const isRushHourMock = loc.trafficDensity === 'Severe' || loc.trafficDensity === 'High';
     
     if (isRushHourMock) {
        primarySource = "Diesel Commuter Shuttles";
        confidence = 0.65;
        // Override breakdown for specific high-traffic event
        breakdownRaw = [
          { source: 'Diesel Shuttles', p: 60, c: '#ef4444' }, // Red for danger
          { source: 'Commuter Cars', p: 20, c: '#f97316' },
          { source: 'Road Dust', p: 15, c: '#d97706' },
          { source: 'Other', p: 5, c: '#94a3b8' }
        ];
        intervention = {
          action: "Odd-Even & E-Feeder Zones",
          description: "Restrict diesel shuttles during peak hours; deploy e-rickshaw feeders.",
          roi: "20% NO2 reduction",
          citation: "IITK Urban Mobility",
          costPerSqKm: 5,
          type: 'Policy'
        };
     }
  }
  
  // Rule B (Industrial): SO2 > 50ppb & Wind from SW (Amausi direction)
  else if (p[Pollutant.SO2] > 50) {
     const isDownwind = weather.windDir === 'SW' || loc.type === 'Industrial';
     
     if (isDownwind) {
        primarySource = "Brick Kiln/Factory Discharge";
        confidence = 0.70;
        breakdownRaw = [
          { source: 'Brick Kilns', p: 45, c: '#be185d' }, // Magenta
          { source: 'Industrial Stacks', p: 35, c: '#7c3aed' }, 
          { source: 'Heavy Trucks', p: 15, c: '#f59e0b' },
          { source: 'Background', p: 5, c: '#94a3b8' }
        ];
        intervention = {
          action: "FGD Installation Mandate",
          description: "Enforce Flue Gas Desulfurization units in nearby brick kilns.",
          roi: "45% SO2 reduction",
          citation: "CPCB Industrial Standards",
          costPerSqKm: 50,
          type: 'Source Suppression'
        };
     }
  }

  // Rule C (Dust): PM10 / PM2.5 Ratio > 2.0
  else if ((p[Pollutant.PM10] / (p[Pollutant.PM25] || 1)) > 2.0) {
     primarySource = "Unpaved Road/Construction Dust";
     confidence = 0.60;
     breakdownRaw = [
        { source: 'Construction Dust', p: 55, c: '#78716c' }, // Stone
        { source: 'Unpaved Roads', p: 25, c: '#a8a29e' },
        { source: 'Vehicular', p: 15, c: '#f59e0b' },
        { source: 'Regional', p: 5, c: '#cbd5e1' }
     ];
     intervention = {
        action: "Mist Cannons & Paving",
        description: "Deploy anti-smog guns targeting vision-identified construction clusters.",
        roi: "Est. ₹1.2Cr healthcare saving/month",
        citation: "NEERI Winter Action Plan",
        costPerSqKm: 15,
        type: 'Source Suppression'
     };
  }

  // Fallback Logic for Residential/Biomass
  else if (loc.type === 'Residential' && p[Pollutant.PM25] > 100) {
     primarySource = "Biomass Burning / Cooking";
     confidence = 0.55;
     // Residential Base Profile is already good, but we boost Biomass
     breakdownRaw = [
        { source: 'Biomass Burning', p: 55, c: '#10b981' },
        { source: 'Vehicular', p: 25, c: '#f59e0b' },
        { source: 'Dust', p: 15, c: '#d97706' },
        { source: 'Other', p: 5, c: '#94a3b8' }
     ];
     intervention = {
        action: "Heater Distribution",
        description: "Distribute electric heaters to reduce biomass burning.",
        roi: "15% PM2.5 reduction",
        citation: "IITK Winter Study",
        costPerSqKm: 8,
        type: 'Source Suppression'
     };
  }

  // 3. Street View Mock Integration (Confidence Boost)
  if (checkStreetViewProxy(loc, primarySource)) {
    confidence = Math.min(0.99, confidence + 0.25);
    primarySource += " (Street View Confirmed)";
  }

  return {
    primarySource,
    confidence,
    intervention,
    sourceBreakdown: generateBreakdown(breakdownRaw)
  };
};

export const simulatePolicy = (
  loc: LocationData,
  policy: PolicyType,
  weather: Weather
): SimulationResult => {
  // Coefficients
  const currentAQI = loc.aqi;
  let reductionFactor = 0; // % drop in primary pollutant
  let primaryPollutant = 'PM2.5';
  let description = '';

  // 1. Determine Impact based on Policy & Location Type
  switch (policy) {
    case 'Total Diesel Ban':
      if (loc.type === 'Traffic' || loc.type === 'Mixed') {
        reductionFactor = 0.45; // 45% drop
        primaryPollutant = 'NO2';
        description = "Halts commercial transport. High impact on NO2 levels.";
      } else {
        reductionFactor = 0.15; // Lower impact in residential
        primaryPollutant = 'NO2';
        description = "Moderate impact. Most residential traffic is petrol/CNG.";
      }
      break;

    case 'Odd-Even Traffic':
      reductionFactor = 0.25;
      primaryPollutant = 'PM2.5';
      description = "Reduces vehicular volume by 50%, improving PM2.5 and CO.";
      break;

    case 'Construction Freeze':
      if (loc.pollutants[Pollutant.PM10] > 200) {
        reductionFactor = 0.55; // Huge impact on dust
        primaryPollutant = 'PM10';
        description = "Stops dust generation. Critical for high PM10 zones.";
      } else {
        reductionFactor = 0.10;
        primaryPollutant = 'PM10';
        description = "Low impact. Dust is not the primary driver here.";
      }
      break;

    case 'Industrial Shutdown':
      if (loc.type === 'Industrial') {
        reductionFactor = 0.60;
        primaryPollutant = 'SO2';
        description = "Immediate cessation of stack emissions.";
      } else {
        reductionFactor = 0.05;
        primaryPollutant = 'PM2.5';
        description = "Negligible impact. Not an industrial zone.";
      }
      break;
  }

  // 2. Weather Modifier (Wind accelerates recovery)
  // If Wind > 5km/h, dispersion is 20% faster
  const windModifier = Math.max(1, weather.windSpeed / 3); 
  
  // 3. Calculate Projected Stats
  const targetAQI = 60; // "Blue Sky" goal
  const decayRate = (currentAQI * reductionFactor * windModifier) / 4; // Arbitrary units/hour
  
  // Time = Distance / Speed
  let timeToRecovery = (currentAQI - targetAQI) / decayRate;
  timeToRecovery = Math.max(2, parseFloat(timeToRecovery.toFixed(1))); // Min 2 hours
  if (!isFinite(timeToRecovery)) timeToRecovery = 24; // Cap at 24h

  // 4. Economic Healthcare Savings Model
  // Baseline: Lucknow loses ~₹15,000 Cr annually due to air pollution (Proxy stat)
  // Ward Impact = (Total Loss / 25 Wards) * (PM2.5 Reduction %)
  // reductionFactor is roughly proportional to health benefit
  const wardAnnualLossBaseline = 15000 / 25; // ₹600 Cr per ward/year
  const dailySavings = (wardAnnualLossBaseline / 365) * reductionFactor; // Daily saving in Cr
  
  return {
    policy,
    projectedAQI: Math.floor(currentAQI * (1 - reductionFactor)),
    timeToRecovery,
    primaryPollutantDrop: Math.floor(reductionFactor * 100),
    healthcareSavings: parseFloat(dailySavings.toFixed(2)),
    impactDescription: description
  };
};

// wrapper for backward compatibility if needed, or direct usage
export const analyzeSource = diagnoseSource;

export const getAQIColor = (aqi: number) => {
  if (aqi <= 50) return '#059669'; 
  if (aqi <= 100) return '#65a30d'; 
  if (aqi <= 200) return '#ca8a04'; 
  if (aqi <= 300) return '#ea580c'; 
  if (aqi <= 400) return '#dc2626'; 
  return '#7f1d1d'; 
};