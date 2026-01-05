import React, { useEffect, useRef, useState } from 'react';
import * as L from 'leaflet';
import { LocationData, Weather, Pollutant } from '../types';
import { analyzeSource, getAQIColor } from '../services/analysisEngine.ts';
import { Layers, CalendarDays } from 'lucide-react';

interface MapProps {
  data: LocationData[];
  selectedPollutant: Pollutant;
  weather: Weather;
  onLocationSelect: (loc: LocationData) => void;
  selectedLocationId: string | null;
  optimizedZones?: Set<string>;
  theme: 'dark' | 'light';
}

const Map: React.FC<MapProps> = ({ 
  data, 
  selectedPollutant, 
  weather, 
  onLocationSelect, 
  selectedLocationId,
  optimizedZones,
  theme
}) => {
  const mapRef = useRef<L.Map | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const tileLayerRef = useRef<L.TileLayer | null>(null);
  
  const markersRef = useRef<{ [id: string]: L.Circle }>({});
  const markersLayerRef = useRef<L.LayerGroup>(L.layerGroup());
  const polygonsLayerRef = useRef<L.LayerGroup>(L.layerGroup());
  const forecastLayerRef = useRef<L.LayerGroup>(L.layerGroup());

  const [showForecast, setShowForecast] = useState(false);

  // Initialize Map
  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;

    mapRef.current = L.map(containerRef.current, {
        zoomControl: false,
        attributionControl: false
    }).setView([26.8467, 80.9462], 12);

    // Initial Tile Layer (will be updated by theme effect)
    
    // Add layer groups to map
    polygonsLayerRef.current.addTo(mapRef.current);
    forecastLayerRef.current.addTo(mapRef.current);
    markersLayerRef.current.addTo(mapRef.current);
    
    L.control.zoom({ position: 'bottomright' }).addTo(mapRef.current);

    return () => {
      if (mapRef.current) {
        mapRef.current.remove();
        mapRef.current = null;
      }
    };
  }, []);

  // Theme Logic for Tiles
  useEffect(() => {
    if (!mapRef.current) return;

    // Remove old tile layer
    if (tileLayerRef.current) {
      mapRef.current.removeLayer(tileLayerRef.current);
    }

    // Determine URL based on theme
    const tileUrl = theme === 'dark' 
      ? 'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png'
      : 'https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png';

    // Add new layer
    tileLayerRef.current = L.tileLayer(tileUrl, {
      attribution: '&copy; OpenStreetMap &copy; CARTO',
      subdomains: 'abcd',
      maxZoom: 19
    }).addTo(mapRef.current);
    
    // Ensure tiles are at back
    tileLayerRef.current.bringToBack();

  }, [theme]);

  // Update Markers Efficiently
  useEffect(() => {
    if (!mapRef.current) return;

    // 1. Clean up removed markers
    const currentIds = new Set(data.map(d => d.id));
    Object.keys(markersRef.current).forEach(id => {
      if (!currentIds.has(id)) {
        markersRef.current[id].remove();
        delete markersRef.current[id];
      }
    });

    // 2. Update or Create markers
    data.forEach(loc => {
      const val = loc.pollutants[selectedPollutant];
      const radius = 300 + (val * 2);
      let color = getAQIColor(selectedPollutant === 'PM2.5' ? val * 2 : val);
      
      const analysis = analyzeSource(loc, weather);
      const isSelected = selectedLocationId === loc.id;
      const isOptimized = optimizedZones?.has(loc.id);

      // --- VISUAL LOGIC REFINEMENT ---
      let fillOpacity = 0.6;
      let strokeColor = color;
      let weight = 1;

      if (optimizedZones) {
         // ADMIN MODE
         if (isOptimized) {
             // Highlight: Keep color, increase opacity, emerald border
             fillOpacity = 0.9;
             strokeColor = '#10b981'; // Emerald highlight
             weight = 3;
         } else {
             // Ghost: Desaturate (Grey), decrease opacity
             fillOpacity = 0.1;
             color = theme === 'dark' ? '#475569' : '#94a3b8'; // Grey out the fill
             strokeColor = theme === 'dark' ? '#334155' : '#e2e8f0'; // Faint stroke
             weight = 1;
         }
      } else {
         // CITIZEN MODE
         if (isSelected) {
            fillOpacity = 0.9;
            strokeColor = '#38bdf8'; // Sky blue selection
            weight = 3;
         } else {
            fillOpacity = 0.6;
            strokeColor = color;
            weight = 1;
         }
      }

      // Tooltip Content - Generic classes handled by CSS based on .dark parent
      const tooltipContent = `
        <div class="font-sans">
          <h3 class="font-bold text-sm">${loc.name}</h3>
          <p class="text-xs">${selectedPollutant}: ${val}</p>
          <p class="text-xs opacity-70">${analysis.primarySource}</p>
        </div>
      `;
      const tooltipOptions = {
        permanent: false,
        direction: 'top' as L.Direction,
      };

      if (markersRef.current[loc.id]) {
        // UPDATE existing
        const circle = markersRef.current[loc.id];
        circle.setRadius(radius);
        circle.setStyle({
          color: strokeColor,
          fillColor: color,
          fillOpacity: fillOpacity,
          weight: weight
        });
        
        if (circle.getTooltip()) {
          circle.setTooltipContent(tooltipContent);
        } else {
          circle.bindTooltip(tooltipContent, tooltipOptions);
        }
      } else {
        // CREATE new
        const circle = L.circle([loc.lat, loc.lng], {
          color: strokeColor,
          fillColor: color,
          fillOpacity: fillOpacity,
          radius: radius,
          weight: weight
        });

        circle.on('click', () => {
          onLocationSelect(loc);
          mapRef.current?.flyTo([loc.lat, loc.lng], 14, { duration: 1.5 });
        });

        circle.bindTooltip(tooltipContent, tooltipOptions);
        circle.addTo(markersLayerRef.current);
        markersRef.current[loc.id] = circle;
      }
    });

  }, [data, selectedPollutant, weather, selectedLocationId, optimizedZones, onLocationSelect, theme]);

  // Handle Polygons (Intervention Layers)
  useEffect(() => {
    polygonsLayerRef.current.clearLayers();
    
    if (optimizedZones) {
       data.forEach(loc => {
         const isOptimized = optimizedZones.has(loc.id);
         
         const polyCoords = [
           [loc.lat + 0.006, loc.lng - 0.006],
           [loc.lat + 0.006, loc.lng + 0.006],
           [loc.lat - 0.006, loc.lng + 0.006],
           [loc.lat - 0.006, loc.lng - 0.006],
         ];
         
         const polygon = L.polygon(polyCoords as L.LatLngExpression[], {
            // Active: Bright Emerald, Solid. Inactive: Faint Grey, Dashed.
            color: isOptimized ? '#10b981' : (theme === 'dark' ? '#475569' : '#94a3b8'), 
            dashArray: isOptimized ? undefined : '4, 8',
            fillColor: isOptimized ? '#10b981' : 'transparent',
            fillOpacity: isOptimized ? 0.3 : 0, // Higher opacity for active to highlight
            weight: isOptimized ? 2 : 1,
            interactive: false
         });
         
         polygonsLayerRef.current.addLayer(polygon);
         polygon.bringToBack();
       });
    }
  }, [data, optimizedZones, weather, theme]);

  // Handle Forecast Layer
  useEffect(() => {
    forecastLayerRef.current.clearLayers();

    if (showForecast) {
      data.forEach(loc => {
        const maxForecastAQI = Math.max(...loc.forecast.map(f => f.aqi));
        const color = getAQIColor(maxForecastAQI);
        
        const currentVal = loc.pollutants[selectedPollutant];
        const baseRadius = 300 + (currentVal * 2);
        const forecastRadius = baseRadius + 300; 

        const ring = L.circle([loc.lat, loc.lng], {
          radius: forecastRadius,
          color: color,
          fill: false,
          dashArray: '12, 12',
          weight: 2,
          className: 'forecast-ring'
        });

        // Mini Chart Tooltip for Trend
        const chartHtml = loc.forecast.map(day => {
          const height = Math.min(100, (day.aqi / 400) * 100);
          const barColor = getAQIColor(day.aqi);
          return `
            <div class="flex flex-col items-center gap-1 group">
              <div class="w-1.5 rounded-t-sm transition-all relative" style="height: ${height}%; background-color: ${barColor}"></div>
              <span class="text-[8px] opacity-70">${day.date.split(' ')[0]}</span>
            </div>
          `;
        }).join('');

        const tooltipContent = `
          <div class="p-1 min-w-[120px]">
            <div class="flex justify-between items-center mb-2 border-b border-gray-600/30 pb-1">
               <span class="text-[10px] font-bold opacity-60 uppercase">7-Day Projection</span>
               <span class="text-xs font-bold" style="color: ${color}">Max ${maxForecastAQI}</span>
            </div>
            <div class="flex items-end justify-between h-12 gap-1">
               ${chartHtml}
            </div>
          </div>
        `;

        ring.bindTooltip(tooltipContent, {
          permanent: false,
          direction: 'bottom',
          offset: [0, 20],
          // ClassName handled by global CSS for dark/light
          className: theme === 'dark' 
            ? 'bg-slate-900/95 border border-slate-600 text-slate-100 shadow-xl rounded-lg overflow-hidden' 
            : 'bg-white/95 border border-slate-200 text-slate-800 shadow-xl rounded-lg overflow-hidden'
        });

        forecastLayerRef.current.addLayer(ring);
      });
    }
  }, [showForecast, data, selectedPollutant, theme]);

  return (
    <div className="relative w-full h-full">
      <div ref={containerRef} className={`w-full h-full rounded-xl overflow-hidden shadow-2xl border transition-colors duration-300 ${theme === 'dark' ? 'border-slate-700/50' : 'border-slate-200 bg-slate-100'}`} />
      
      {/* Forecast Toggle Control */}
      <button
        onClick={() => setShowForecast(!showForecast)}
        className={`absolute top-4 right-4 z-[500] p-2 rounded-lg shadow-xl border transition-all duration-300 flex items-center gap-2 ${
          showForecast 
            ? 'bg-indigo-600 border-indigo-400 text-white' 
            : (theme === 'dark' ? 'bg-slate-800 border-slate-600 text-slate-400 hover:bg-slate-700' : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50')
        }`}
        title="Toggle 7-Day Forecast Layer"
      >
        {showForecast ? <CalendarDays className="w-5 h-5" /> : <Layers className="w-5 h-5" />}
        {showForecast && <span className="text-xs font-bold animate-in fade-in slide-in-from-right-2">Forecast On</span>}
      </button>
    </div>
  );
};

export default Map;