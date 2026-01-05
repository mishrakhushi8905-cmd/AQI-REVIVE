import { LocationData, Pollutant, Weather, ForecastDay, VisionAnalysis, PollutantLevels } from '../types';

const LUCKNOW_CENTER = { lat: 26.8467, lng: 80.9462 };

// 25 Specific Stations (Mocked for Bharat-AQI Structure)
export const STATIONS_LIST = [
  'Hazratganj', 'Gomti Nagar', 'Charbagh', 'Amausi', 'Lalbagh',
  'Aishbagh', 'Kathauta', 'Talkatora', 'Indira Nagar', 'Alambagh',
  'Chowk', 'Aminabad', 'Jankipuram', 'Kapoorthala', 'Vikas Nagar',
  'Mahanagar', 'Rajajipuram', 'Sadar', 'Telibagh', 'Vrindavan Yojana',
  'Chinhat', 'Hussainganj', 'Kaiserbagh', 'Daliganj', 'Nirala Nagar'
] as const;

const STATIONS = [
  { name: 'Hazratganj', lat: 26.8500, lng: 80.9499, type: 'Mixed' },
  { name: 'Gomti Nagar', lat: 26.8486, lng: 80.9993, type: 'Traffic' },
  { name: 'Charbagh', lat: 26.8318, lng: 80.9199, type: 'Traffic' },
  { name: 'Amausi', lat: 26.7606, lng: 80.8893, type: 'Industrial' },
  { name: 'Lalbagh', lat: 26.8496, lng: 80.9400, type: 'Mixed' },
  { name: 'Aishbagh', lat: 26.8290, lng: 80.9090, type: 'Industrial' },
  { name: 'Kathauta', lat: 26.8640, lng: 81.0060, type: 'Industrial' },
  { name: 'Talkatora', lat: 26.8200, lng: 80.9000, type: 'Industrial' },
  { name: 'Indira Nagar', lat: 26.8833, lng: 80.9933, type: 'Residential' },
  { name: 'Alambagh', lat: 26.8115, lng: 80.9069, type: 'Mixed' },
  { name: 'Chowk', lat: 26.8667, lng: 80.9167, type: 'Mixed' },
  { name: 'Aminabad', lat: 26.8433, lng: 80.9233, type: 'Traffic' },
  { name: 'Jankipuram', lat: 26.9033, lng: 80.9533, type: 'Residential' },
  { name: 'Kapoorthala', lat: 26.8733, lng: 80.9433, type: 'Traffic' },
  { name: 'Vikas Nagar', lat: 26.8933, lng: 80.9633, type: 'Residential' },
  { name: 'Mahanagar', lat: 26.8800, lng: 80.9500, type: 'Residential' },
  { name: 'Rajajipuram', lat: 26.8333, lng: 80.8833, type: 'Residential' },
  { name: 'Sadar', lat: 26.8167, lng: 80.9500, type: 'Mixed' },
  { name: 'Telibagh', lat: 26.7833, lng: 80.9500, type: 'Residential' },
  { name: 'Vrindavan Yojana', lat: 26.7667, lng: 80.9667, type: 'Residential' },
  { name: 'Chinhat', lat: 26.8667, lng: 81.0333, type: 'Industrial' },
  { name: 'Hussainganj', lat: 26.8333, lng: 80.9333, type: 'Traffic' },
  { name: 'Kaiserbagh', lat: 26.8500, lng: 80.9333, type: 'Traffic' },
  { name: 'Daliganj', lat: 26.8667, lng: 80.9333, type: 'Mixed' },
  { name: 'Nirala Nagar', lat: 26.8667, lng: 80.9500, type: 'Residential' }
] as const;

function random(min: number, max: number) {
  return Math.floor(Math.random() * (max - min + 1) + min);
}

// Simple Seasonal Trend Model for Forecast
const forecastEngine = (currentPM25: number, currentO3: number): ForecastDay[] => {
  const forecast: ForecastDay[] = [];
  const today = new Date();

  for (let i = 1; i <= 7; i++) {
    const nextDate = new Date(today);
    nextDate.setDate(today.getDate() + i);
    
    // Trend: slight fluctuation based on "Gomti inversion patterns" (simulated as random sine wave)
    const trendFactor = Math.sin(i * 0.5) * 20; 
    const p = Math.max(10, Math.floor(currentPM25 + trendFactor + random(-10, 10)));
    const o = Math.max(10, Math.floor(currentO3 + trendFactor/2 + random(-5, 5)));
    const aqi = Math.max(p, o);
    
    let condition: ForecastDay['condition'] = 'Clear';
    if (aqi > 300) condition = 'Severe';
    else if (aqi > 200) condition = 'Smog';
    else if (aqi > 100) condition = 'Haze';

    forecast.push({
      date: nextDate.toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric' }),
      pm25: p,
      o3: o,
      aqi,
      condition
    });
  }
  return forecast;
};

// Spatial Interpolation (IDW) Helper - Exposed for potential use, 
// primarily used here to fill gaps if we had missing stations, 
// but we will use it to influence "Vision Analysis" confidence based on neighbor proximity.
export const inverseDistanceWeighting = (targetLat: number, targetLng: number, stations: LocationData[]) => {
  let numerator = 0;
  let denominator = 0;
  const power = 2; // Standard power for IDW

  stations.forEach(station => {
    const d = Math.sqrt(Math.pow(station.lat - targetLat, 2) + Math.pow(station.lng - targetLng, 2));
    if (d === 0) return station.aqi; // Exact match
    const weight = 1 / Math.pow(d, power);
    numerator += weight * station.aqi;
    denominator += weight;
  });

  return denominator === 0 ? 0 : numerator / denominator;
};

// Generate Mock Vision Analysis based on Attributes
const analyzeVisionProxies = (spot: typeof STATIONS[number], pollutants: any, weather: Weather): VisionAnalysis => {
  const proxies = [];
  let sourceProb = "Urban Background";
  let vectorMatch = "Neutral";
  
  // Logic: NO2 > 135ppb + NE Wind (towards Gomti Nagar) -> Diesel
  if (spot.name === 'Gomti Nagar' && pollutants[Pollutant.NO2] > 100 && (weather.windDir === 'NE' || weather.windDir === 'N')) {
     proxies.push("High Density Traffic");
     proxies.push("Diesel Shuttles");
     sourceProb = "High-Density Diesel Transit";
     vectorMatch = "Positive (Upwind)";
  }
  // PM10 Spike + Aishbagh + Low Wind -> Dust
  else if (spot.name === 'Aishbagh' && pollutants[Pollutant.PM10] > 200 && weather.windSpeed < 5) {
     proxies.push("Unpaved Roads");
     proxies.push("Construction Material");
     sourceProb = "Suspended Dust / Roadside";
     vectorMatch = "Stagnant (Accumulation)";
  }
  // Industrial Checks
  else if (spot.type === 'Industrial' && pollutants[Pollutant.SO2] > 50) {
    proxies.push("Industrial Chimneys");
    proxies.push("Kiln Structures");
    sourceProb = "Industrial Discharge";
    vectorMatch = "Positive";
  }
  else if (spot.type === 'Traffic') {
    proxies.push("Vehicle Congestion");
    sourceProb = "Vehicular Exhaust";
  }

  return {
    detectedProxies: proxies.length > 0 ? proxies : ["Residential Heating", "Light Traffic"],
    confidence: proxies.length > 0 ? 0.85 + (Math.random() * 0.1) : 0.5,
    windVectorAnalysis: vectorMatch,
    sourceProbability: sourceProb
  };
};

export const fetchLucknowAQI = async (weather: Weather): Promise<LocationData[]> => {
  // Simulating async API call
  return new Promise((resolve) => {
    const data: LocationData[] = STATIONS.map((spot, index) => {
      // Base generation (Enhanced)
      let pm25 = random(50, 150);
      let pm10 = random(100, 250);
      let no2 = random(20, 80);
      let so2 = random(10, 40);
      let o3 = random(10, 60);
      let pb = random(0, 5);
      let nh3 = random(5, 20);
      let co = random(10, 80);

      // Apply Location Biases
      if (spot.name === 'Lalbagh') pb = random(20, 50);
      if (spot.name === 'Aishbagh') { no2 = random(120, 200); pm10 = random(200, 400); }
      if (spot.name === 'Kathauta') so2 = random(80, 150);
      if (spot.name === 'Gomti Nagar') { o3 = random(80, 120); no2 = random(90, 150); }
      if (spot.name === 'Talkatora') pm25 = random(200, 350);
      
      if (spot.type === 'Traffic') { no2 += 40; co += 30; }
      if (spot.type === 'Industrial') { so2 += 30; pm10 += 50; }

      // Inversion Multiplier
      if (weather.isInversion) {
        pm25 = Math.floor(pm25 * 1.5);
        pm10 = Math.floor(pm10 * 1.4);
        no2 = Math.floor(no2 * 1.3);
      }

      // Calculate AQI
      const aqi = Math.max(pm25, pm10 / 2, no2, so2 / 2, o3);
      
      const pollutants = {
        [Pollutant.PM25]: pm25,
        [Pollutant.PM10]: pm10,
        [Pollutant.NO2]: no2,
        [Pollutant.SO2]: so2,
        [Pollutant.CO]: co,
        [Pollutant.O3]: o3,
        [Pollutant.NH3]: nh3,
        [Pollutant.Pb]: pb,
      };

      return {
        id: `loc-${index}`,
        name: spot.name,
        lat: spot.lat,
        lng: spot.lng,
        type: spot.type as any,
        pollutants,
        aqi,
        trafficDensity: spot.type === 'Traffic' || spot.name === 'Hazratganj' ? 'Severe' : (aqi > 300 ? 'High' : 'Medium'),
        forecast: forecastEngine(pm25, o3),
        visionAnalysis: analyzeVisionProxies(spot, pollutants, weather)
      };
    });
    resolve(data);
  });
};

export const updateLiveReadings = (data: LocationData[], weather: Weather): LocationData[] => {
  return data.map(loc => {
    const p = { ...loc.pollutants };
    
    // Physics-Based Dispersion Logic
    // Wind > 8 km/h causes active dispersion (negative drift).
    // Wind < 3 km/h causes stagnation (neutral/positive drift).
    // Inversion actively traps pollutants (positive drift).
    
    const windFactor = weather.windSpeed > 8 ? -1 : (weather.windSpeed < 3 ? 1 : 0);
    const inversionFactor = weather.isInversion ? 2 : -1;
    
    (Object.keys(p) as Pollutant[]).forEach(k => {
       let drift = random(-2, 2); // Natural volatility
       
       // Apply physics bias
       drift += windFactor; 
       drift += inversionFactor;

       // Boundary checks to prevent runaway values or negatives
       if (p[k] > 480) drift -= 3; // Natural decay at extreme highs
       if (p[k] < 10) drift += 2;  // Background level floor

       p[k] = Math.max(0, p[k] + drift);
    });

    const aqi = Math.max(
      p[Pollutant.PM25], 
      p[Pollutant.PM10] / 2, 
      p[Pollutant.NO2], 
      p[Pollutant.SO2] / 2, 
      p[Pollutant.O3]
    );

    return {
      ...loc,
      pollutants: p,
      aqi: Math.round(aqi)
    };
  });
};

export const generate24hHistory = (loc: LocationData): { time: string, pollutants: PollutantLevels }[] => {
  const history = [];
  const now = new Date();
  
  // We want the last point to be close to current loc.pollutants
  // We'll generate 25 points (24h ago to now)
  for (let i = 24; i >= 0; i--) {
    const timeOffset = i * 60 * 60 * 1000;
    const d = new Date(now.getTime() - timeOffset);
    const hour = d.getHours();
    
    // Simple Diurnal Model
    // Traffic peaks: 9AM (9), 6PM (18)
    // Low: 3AM (3)
    let timeFactor = 0.9; 
    if (hour >= 8 && hour <= 11) timeFactor = 1.3;
    else if (hour >= 17 && hour <= 20) timeFactor = 1.4;
    else if (hour >= 2 && hour <= 5) timeFactor = 0.6;
    else timeFactor = 1.0;

    const p: any = {};
    (Object.keys(loc.pollutants) as Pollutant[]).forEach(k => {
        const baseVal = loc.pollutants[k];
        // Scale base value by time factor and add random noise
        const variation = (Math.random() * 0.3) - 0.15; // +/- 15% random
        let val = baseVal * timeFactor * (1 + variation);
        
        // Smoothing towards current value as we approach i=0 (now) to make the chart connect seamlessly to live view if needed
        if (i < 2) {
            val = baseVal; // Ensure last point matches current
        }

        p[k] = Math.floor(Math.max(5, val));
    });

    history.push({
      time: d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      pollutants: p as PollutantLevels
    });
  }
  return history;
};