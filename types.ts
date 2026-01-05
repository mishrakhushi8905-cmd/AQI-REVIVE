export enum Pollutant {
  PM25 = 'PM2.5',
  PM10 = 'PM10',
  NO2 = 'NO2',
  SO2 = 'SO2',
  CO = 'CO',
  O3 = 'O3',
  NH3 = 'NH3',
  Pb = 'Pb'
}

export interface Weather {
  temp: number;
  humidity: number;
  windSpeed: number; // km/h
  windDir: string;
  isWinter: boolean;
  isInversion: boolean;
}

export interface PollutantLevels {
  [Pollutant.PM25]: number;
  [Pollutant.PM10]: number;
  [Pollutant.NO2]: number;
  [Pollutant.SO2]: number;
  [Pollutant.CO]: number;
  [Pollutant.O3]: number;
  [Pollutant.NH3]: number;
  [Pollutant.Pb]: number;
}

export interface Intervention {
  action: string;
  description: string;
  roi: string; // "25-40% reduction"
  citation: string; // "TERI/IITK"
  costPerSqKm: number; // in Lakhs
  type: 'Source Suppression' | 'Dispersion' | 'Policy';
}

export interface ForecastDay {
  date: string;
  pm25: number;
  o3: number;
  aqi: number;
  condition: 'Clear' | 'Haze' | 'Smog' | 'Severe';
}

export interface VisionAnalysis {
  detectedProxies: string[]; // e.g., "Heavy Trucks", "Chimneys", "Construction"
  confidence: number;
  windVectorAnalysis: string;
  sourceProbability: string; // "High-Density Diesel Transit", etc.
}

export interface LocationData {
  id: string;
  name: string;
  lat: number;
  lng: number;
  type: 'Traffic' | 'Industrial' | 'Residential' | 'Mixed';
  pollutants: PollutantLevels;
  aqi: number;
  trafficDensity: 'Low' | 'Medium' | 'High' | 'Severe';
  forecast: ForecastDay[];
  visionAnalysis: VisionAnalysis;
}

export interface SourceContributor {
  source: string;
  percentage: number;
  color: string;
}

export interface AnalysisResult {
  primarySource: string;
  confidence: number; // 0-1
  intervention: Intervention;
  sourceBreakdown: SourceContributor[];
}

export enum ViewMode {
  CITIZEN = 'Citizen',
  ADMIN = 'Admin'
}

// GeoJSON Types for Interpolated Grid
export interface GridFeature {
  type: 'Feature';
  geometry: {
    type: 'Polygon';
    coordinates: number[][][];
  };
  properties: {
    aqi: number;
    dominant_pollutant: string;
    is_gomti_basin: boolean;
    fillColor: string;
  };
}

export interface GridData {
  type: 'FeatureCollection';
  features: GridFeature[];
}

// Policy Simulation Types
export type PolicyType = 'Odd-Even Traffic' | 'Total Diesel Ban' | 'Construction Freeze' | 'Industrial Shutdown';

export interface SimulationResult {
  policy: PolicyType;
  projectedAQI: number;
  timeToRecovery: number; // Hours to reach < 100 AQI ("Blue Sky")
  primaryPollutantDrop: number; // Percentage
  healthcareSavings: number; // Crores (INR)
  impactDescription: string;
}