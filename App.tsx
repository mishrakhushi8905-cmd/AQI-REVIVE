import React, { useState, useEffect, useMemo, useRef } from 'react';
import { fetchLucknowAQI, updateLiveReadings, STATIONS_LIST } from './services/dataService';
import { LocationData, Pollutant, Weather, ViewMode, PollutantLevels } from './types';
import { analyzeSource } from './services/analysisEngine';
import Map from './components/Map';
import Sidebar from './components/Sidebar';
import Chart from 'chart.js/auto';
import { 
  Wind, 
  Thermometer, 
  Printer, 
  CloudFog,
  IndianRupee,
  LayoutDashboard,
  Navigation,
  Shield,
  ShieldCheck,
  MapPin,
  FileText,
  Sun,
  Moon,
  Zap,
  Compass
} from 'lucide-react';
import { GoogleGenAI } from '@google/genai';

const App: React.FC = () => {
  // State: Theme with Persistence
  const [theme, setTheme] = useState<'dark' | 'light'>(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('aqi-revive-theme');
      if (saved === 'light' || saved === 'dark') return saved;
      return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
    }
    return 'dark';
  });

  const [weather, setWeather] = useState<Weather>({
    temp: 18,
    humidity: 72,
    windSpeed: 4,
    windDir: 'NE',
    isWinter: true,
    isInversion: true 
  });
  
  const [data, setData] = useState<LocationData[]>([]);
  const [history, setHistory] = useState<Record<string, { time: string, pollutants: PollutantLevels }[]>>({});
  
  const [viewMode, setViewMode] = useState<ViewMode>(ViewMode.ADMIN);
  const [selectedPollutant, setSelectedPollutant] = useState<Pollutant>(Pollutant.PM25);
  const [selectedLocation, setSelectedLocation] = useState<LocationData | null>(null);
  
  // Admin State
  const [budgetCr, setBudgetCr] = useState<number>(10); // Crores

  // Citizen State
  const [routeStart, setRouteStart] = useState<string>('Hazratganj');
  const [routeEnd, setRouteEnd] = useState<string>('Gomti Nagar');
  const [routeAnalysis, setRouteAnalysis] = useState<{safe: boolean, saving: number, text: string} | null>(null);

  // Wind Rose Refs
  const windRoseRef = useRef<HTMLCanvasElement>(null);
  const windRoseInstance = useRef<Chart | null>(null);

  // Theme Effect: Apply to DOM and Persist
  useEffect(() => {
    const root = window.document.documentElement;
    root.classList.remove('light', 'dark');
    root.classList.add(theme);
    localStorage.setItem('aqi-revive-theme', theme);
  }, [theme]);

  // Init Data (Async)
  useEffect(() => {
    const init = async () => {
      const initialData = await fetchLucknowAQI(weather);
      setData(initialData);
    };
    init();
  }, []); 

  // --- REAL-TIME DATA SIMULATION ENGINE ---
  useEffect(() => {
    const intervalId = setInterval(() => {
      // Functional update to get latest weather without restarting interval
      setWeather(prevWeather => {
        // 1. Mutate Weather: Simulating slight environmental fluctuations
        const newWind = parseFloat(Math.max(0, prevWeather.windSpeed + (Math.random() * 2 - 1)).toFixed(1));
        const newTemp = parseFloat((prevWeather.temp + (Math.random() * 0.4 - 0.2)).toFixed(1));
        
        const newWeather = {
          ...prevWeather,
          windSpeed: newWind,
          temp: newTemp
        };

        // 2. Update Pollutant Data using the NEW weather context
        setData(prevData => {
          const newData = updateLiveReadings(prevData, newWeather);
          
          // 3. Update History Buffer for Charts
          setHistory(prevHist => {
             const newHist = { ...prevHist };
             const timeLabel = new Date().toLocaleTimeString([], { hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit' });
             
             newData.forEach(loc => {
               if (!newHist[loc.id]) newHist[loc.id] = [];
               const newEntry = { time: timeLabel, pollutants: loc.pollutants };
               // Keep last 20 points for live trend charts
               const updatedLocHist = [...newHist[loc.id], newEntry].slice(-20);
               newHist[loc.id] = updatedLocHist;
             });
             return newHist;
          });

          return newData;
        });

        return newWeather;
      });

    }, 3000); // 3-second heartbeat

    return () => clearInterval(intervalId);
  }, []); // Empty dependency array allows stable interval

  // Sync selectedLocation with live data
  useEffect(() => {
     if (selectedLocation && data.length > 0) {
        const updated = data.find(d => d.id === selectedLocation.id);
        if (updated && updated !== selectedLocation) {
           setSelectedLocation(updated);
        }
     }
  }, [data]);


  // --- Wind Rose Chart Logic ---
  useEffect(() => {
    if (!windRoseRef.current) return;

    if (windRoseInstance.current) {
      windRoseInstance.current.destroy();
    }

    const ctx = windRoseRef.current.getContext('2d');
    if (!ctx) return;

    // Generate Mock Distribution based on dominant windDir
    const directions = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'];
    const currentIndex = directions.indexOf(weather.windDir);
    
    // Create a distribution where the current wind dir is dominant
    const dataPoints = directions.map((_, idx) => {
      // Distance from dominant index (handling wrap-around)
      let dist = Math.abs(idx - currentIndex);
      if (dist > 4) dist = 8 - dist;
      
      // Base value + randomness - distance penalty
      let val = 0;
      if (dist === 0) val = Math.random() * 20 + 60; // Dominant: 60-80%
      else if (dist === 1) val = Math.random() * 15 + 30; // Adjacent: 30-45%
      else val = Math.random() * 10 + 5; // Others: 5-15%
      
      return val;
    });

    const textColor = theme === 'dark' ? '#94a3b8' : '#64748b';
    const gridColor = theme === 'dark' ? '#334155' : '#e2e8f0';
    const fillColor = theme === 'dark' ? 'rgba(56, 189, 248, 0.2)' : 'rgba(14, 165, 233, 0.2)';
    const borderColor = theme === 'dark' ? '#38bdf8' : '#0ea5e9';

    windRoseInstance.current = new Chart(ctx, {
      type: 'radar',
      data: {
        labels: directions,
        datasets: [{
          label: 'Frequency (%)',
          data: dataPoints,
          backgroundColor: fillColor,
          borderColor: borderColor,
          borderWidth: 2,
          pointRadius: 0,
          pointHoverRadius: 4
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        animation: { duration: 1000 },
        scales: {
          r: {
            angleLines: { color: gridColor },
            grid: { color: gridColor },
            pointLabels: { 
              color: textColor, 
              font: { size: 9, family: 'monospace', weight: 'bold' } 
            },
            ticks: { display: false, backdropColor: 'transparent' },
            suggestedMin: 0,
            suggestedMax: 100
          }
        },
        plugins: {
          legend: { display: false },
          tooltip: {
            enabled: true,
            backgroundColor: theme === 'dark' ? '#1e293b' : '#ffffff',
            titleColor: theme === 'dark' ? '#f8fafc' : '#0f172a',
            bodyColor: theme === 'dark' ? '#f8fafc' : '#0f172a',
            borderColor: gridColor,
            borderWidth: 1
          }
        }
      }
    });

    return () => {
      if (windRoseInstance.current) windRoseInstance.current.destroy();
    };
  }, [weather.windDir, theme]);


  // --- Logic Engines ---

  // 1. Budget Optimization Algorithm
  const optimizedZones = useMemo(() => {
    if (viewMode !== ViewMode.ADMIN) return undefined;
    
    const budgetLakhs = budgetCr * 100;
    let currentSpend = 0;
    const selectedIds = new Set<string>();

    const candidates = data.map(d => {
      const analysis = analyzeSource(d, weather);
      const cost = analysis.intervention.costPerSqKm * 2;
      return {
        id: d.id,
        aqi: d.aqi,
        cost: cost,
        priorityScore: d.aqi
      };
    });

    candidates.sort((a, b) => b.priorityScore - a.priorityScore);

    for (const c of candidates) {
      if (currentSpend + c.cost <= budgetLakhs) {
        currentSpend += c.cost;
        selectedIds.add(c.id);
      }
    }
    return selectedIds;
  }, [data, weather, budgetCr, viewMode]);


  // 2. Route Shield Analyzer
  useEffect(() => {
    if (viewMode === ViewMode.CITIZEN) {
      const baseExposure = Math.random() * 50 + 150; 
      const optimizedExposure = baseExposure * 0.65; // 35% reduction
      setRouteAnalysis({
        safe: true,
        saving: 35,
        text: `Via Lohia Path: Avoids traffic spike at ${STATIONS_LIST[Math.floor(Math.random()*STATIONS_LIST.length)]}.`
      });
    }
  }, [routeStart, routeEnd, viewMode]);


  // Handlers
  const toggleInversion = () => {
    setWeather(prev => ({ ...prev, isInversion: !prev.isInversion }));
  };
  
  const toggleTheme = () => {
    setTheme(prev => prev === 'dark' ? 'light' : 'dark');
  };

  const handlePrint = () => {
    window.print();
  };

  // Stats
  const avgAQI = Math.floor(data.reduce((acc, curr) => acc + curr.aqi, 0) / (data.length || 1));
  const criticalZones = data.filter(d => d.aqi > 300).length;

  return (
    <div className="flex h-screen w-screen bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 font-sans overflow-hidden transition-colors duration-300">
      
      {/* LEFT SIDEBAR (Controls) */}
      <div className="w-80 flex flex-col border-r border-slate-200 dark:border-slate-800 bg-white/50 dark:bg-slate-900/50 backdrop-blur-sm z-50 no-print transition-colors duration-300">
        {/* Branding */}
        <div className="p-6 border-b border-slate-200 dark:border-slate-800">
          <div className="flex items-center justify-between mb-1">
             <div className="flex items-center gap-2">
                <LayoutDashboard className="text-emerald-600 dark:text-emerald-400" />
                <h1 className="text-xl font-bold tracking-tight">AQI-REVIVE</h1>
             </div>
             <button 
               onClick={toggleTheme}
               className="p-1.5 rounded-full bg-slate-200 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-300 dark:hover:bg-slate-700 transition-colors shadow-sm"
               title={theme === 'dark' ? "Switch to Light Mode" : "Switch to Dark Mode"}
             >
               {theme === 'dark' ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
             </button>
          </div>
          <div className="flex items-center gap-2 mt-1">
            <p className="text-xs text-slate-500 dark:text-slate-500">LMC Command Center v1.0</p>
            <span className="flex items-center gap-1 px-1.5 py-0.5 rounded-full bg-red-500/10 border border-red-500/20 text-[10px] text-red-500 dark:text-red-400 font-bold tracking-wider animate-pulse">
              <span className="w-1.5 h-1.5 rounded-full bg-red-500"></span> LIVE
            </span>
          </div>
        </div>

        {/* View Switcher */}
        <div className="p-4 grid grid-cols-2 gap-2 bg-slate-50 dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800">
          <button 
            onClick={() => setViewMode(ViewMode.CITIZEN)}
            className={`p-2 rounded-lg text-sm font-medium transition-all ${viewMode === ViewMode.CITIZEN ? 'bg-sky-600 text-white shadow-lg shadow-sky-500/30' : 'bg-white dark:bg-slate-800 text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700'}`}
          >
            Citizen
          </button>
          <button 
             onClick={() => setViewMode(ViewMode.ADMIN)}
             className={`p-2 rounded-lg text-sm font-medium transition-all ${viewMode === ViewMode.ADMIN ? 'bg-emerald-600 text-white shadow-lg shadow-emerald-500/30' : 'bg-white dark:bg-slate-800 text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700'}`}
          >
            Admin
          </button>
        </div>

        {/* Controls Scroll Area */}
        <div className="flex-1 overflow-y-auto p-4 space-y-6">
          
          {/* Weather Toggle */}
          <div className="space-y-3">
             <div className="flex justify-between items-center">
                <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Atmosphere</label>
                <div className="flex items-center gap-1 text-[10px] text-amber-500 font-bold animate-pulse">
                   <Zap className="w-3 h-3" />
                   SIMULATION ON
                </div>
             </div>
             
             <div 
               onClick={toggleInversion}
               className={`cursor-pointer p-4 rounded-xl border transition-all duration-300 relative overflow-hidden group ${weather.isInversion ? 'bg-white dark:bg-slate-800 border-orange-500/50' : 'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700'}`}
             >
                <div className="flex justify-between items-center z-10 relative">
                  <div>
                    <h4 className={`text-sm font-bold ${weather.isInversion ? 'text-orange-500 dark:text-orange-400' : 'text-slate-700 dark:text-slate-300'}`}>
                      {weather.isInversion ? 'Inversion Active' : 'Normal Dispersion'}
                    </h4>
                    <p className="text-[10px] text-slate-500 dark:text-slate-400 mt-1">
                      {weather.isInversion ? 'Pollutants trapped at ground level.' : 'Natural wind dispersion active.'}
                    </p>
                  </div>
                  <CloudFog className={`w-6 h-6 ${weather.isInversion ? 'text-orange-500' : 'text-slate-400'}`} />
                </div>
                {weather.isInversion && <div className="absolute inset-0 bg-orange-500/5 z-0"></div>}
             </div>
             <div className="grid grid-cols-2 gap-2 text-xs">
                <div className="bg-white dark:bg-slate-800 p-2 rounded flex items-center gap-2 border border-slate-200 dark:border-slate-700">
                   <Thermometer className="w-3 h-3 text-red-400" /> {weather.temp}°C
                </div>
                <div className="bg-white dark:bg-slate-800 p-2 rounded flex items-center gap-2 border border-slate-200 dark:border-slate-700">
                   <Wind className="w-3 h-3 text-blue-400" /> {weather.windSpeed} km/h {weather.windDir}
                </div>
             </div>
             
             {/* Wind Rose Visualization */}
             <div className="mt-2 bg-white dark:bg-slate-800/50 p-3 rounded-xl border border-slate-200 dark:border-slate-700">
                <h5 className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-2 flex items-center gap-1">
                   <Compass className="w-3 h-3" /> 24h Wind Rose
                </h5>
                <div className="h-40 w-full relative">
                    <canvas ref={windRoseRef}></canvas>
                </div>
             </div>
          </div>

          {/* ADMIN: Budget Allocator */}
          {viewMode === ViewMode.ADMIN && (
            <div className="space-y-3 animate-in fade-in slide-in-from-left-4">
              <label className="text-xs font-bold text-emerald-600 dark:text-emerald-500 uppercase tracking-wider flex items-center gap-2">
                <IndianRupee className="w-3 h-3" /> Budget Optimization
              </label>
              
              <div className="bg-slate-50 dark:bg-slate-800/50 p-4 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm transition-all duration-300">
                 {/* Header Stats */}
                 <div className="flex justify-between items-end mb-4">
                     <div>
                        <span className="text-[10px] uppercase text-slate-500 dark:text-slate-400 font-bold tracking-wider">Allocation</span>
                        <div className="text-2xl font-bold text-emerald-600 dark:text-emerald-400 leading-none mt-1">
                           ₹{budgetCr}<span className="text-sm font-normal text-slate-500 ml-1">Cr</span>
                        </div>
                     </div>
                     <div className="text-right">
                        <span className="text-[10px] uppercase text-slate-500 dark:text-slate-400 font-bold tracking-wider">Coverage</span>
                        <div className="text-sm font-bold text-slate-700 dark:text-slate-300 leading-none mt-1">
                           {optimizedZones?.size || 0} / {data.length} Zones
                        </div>
                     </div>
                 </div>
                 
                 {/* Slider Track */}
                 <div className="relative w-full h-8 flex items-center mb-1 group">
                    {/* Background Track */}
                    <div className="absolute w-full h-2 bg-slate-200 dark:bg-slate-700 rounded-full overflow-hidden">
                       <div 
                         className="h-full bg-gradient-to-r from-emerald-400 to-emerald-600 transition-all duration-300 ease-out" 
                         style={{ width: `${(budgetCr/50)*100}%` }}
                       ></div>
                    </div>
                    
                    {/* Native Input */}
                    <input 
                      type="range" 
                      min="1" 
                      max="50" 
                      step="1"
                      value={budgetCr} 
                      onChange={(e) => setBudgetCr(Number(e.target.value))}
                      className="absolute w-full h-full opacity-0 cursor-pointer z-20"
                    />
                    
                    {/* Custom Thumb handle for better visual */}
                    <div 
                      className="absolute h-5 w-5 bg-white dark:bg-emerald-950 border-2 border-emerald-500 rounded-full shadow-lg pointer-events-none transition-all duration-100 ease-out z-10 flex items-center justify-center"
                      style={{ left: `calc(${((budgetCr-1)/49)*100}% - 10px)` }}
                    >
                       <div className="w-1.5 h-1.5 bg-emerald-500 rounded-full"></div>
                    </div>
                 </div>
                 <div className="flex justify-between text-[10px] text-slate-400 dark:text-slate-500 font-mono">
                    <span>₹1Cr</span>
                    <span>₹50Cr</span>
                 </div>

                 {/* Impact Badge */}
                 <div className="mt-4 p-3 bg-white dark:bg-emerald-950/20 border border-emerald-100 dark:border-emerald-900/50 rounded-lg flex items-center gap-3 shadow-sm">
                    <div className="p-2 bg-emerald-100 dark:bg-emerald-900/50 rounded-full">
                       <ShieldCheck className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                    </div>
                    <div>
                      <span className="block text-[10px] text-slate-500 dark:text-slate-400 uppercase tracking-wide">Proj. Impact</span>
                      <span className="text-sm font-bold text-slate-700 dark:text-slate-200">
                        {Math.min(100, (optimizedZones?.size || 0) * 4)}% Reduction
                      </span>
                    </div>
                 </div>
              </div>
            </div>
          )}

          {/* CITIZEN: Route Shield */}
          {viewMode === ViewMode.CITIZEN && (
             <div className="space-y-3 animate-in fade-in slide-in-from-left-4">
                <label className="text-xs font-bold text-sky-500 uppercase tracking-wider flex items-center gap-2">
                   <Shield className="w-3 h-3" /> Route Shield
                </label>
                <div className="bg-slate-50 dark:bg-slate-800/50 p-4 rounded-xl border border-slate-200 dark:border-slate-700 space-y-3">
                   <div className="space-y-1">
                      <label className="text-[10px] text-slate-500 dark:text-slate-400 ml-1">Start Point</label>
                      <div className="relative">
                         <MapPin className="w-3 h-3 absolute left-3 top-2.5 text-slate-400" />
                         <select 
                           value={routeStart} 
                           onChange={(e) => setRouteStart(e.target.value)}
                           className="w-full bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 text-xs rounded-lg py-2 pl-8 pr-2 text-slate-700 dark:text-slate-200 focus:border-sky-500 outline-none appearance-none"
                         >
                            {STATIONS_LIST.map(s => <option key={s} value={s}>{s}</option>)}
                         </select>
                      </div>
                   </div>
                   <div className="space-y-1">
                      <label className="text-[10px] text-slate-500 dark:text-slate-400 ml-1">Destination</label>
                      <div className="relative">
                         <Navigation className="w-3 h-3 absolute left-3 top-2.5 text-slate-400" />
                         <select 
                           value={routeEnd}
                           onChange={(e) => setRouteEnd(e.target.value)}
                           className="w-full bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 text-xs rounded-lg py-2 pl-8 pr-2 text-slate-700 dark:text-slate-200 focus:border-sky-500 outline-none appearance-none"
                         >
                            {STATIONS_LIST.map(s => <option key={s} value={s}>{s}</option>)}
                         </select>
                      </div>
                   </div>
                   
                   {/* Recommendation */}
                   <div className="pt-2 border-t border-slate-200 dark:border-slate-700/50 mt-2">
                      <div className="flex items-center gap-2 text-xs font-medium text-sky-600 dark:text-sky-400 mb-1">
                         <ShieldCheck className="w-3 h-3" /> AI Recommendation
                      </div>
                      <p className="text-[10px] text-slate-600 dark:text-slate-300 leading-relaxed">
                         {routeAnalysis?.text}
                      </p>
                      <div className="flex gap-2 mt-2">
                         <span className="text-[10px] px-2 py-0.5 bg-green-100 dark:bg-green-900/40 text-green-700 dark:text-green-300 rounded border border-green-200 dark:border-green-800">
                           Save {routeAnalysis?.saving}% Exposure
                         </span>
                      </div>
                   </div>
                </div>
             </div>
          )}

          {/* Pollutant Layer */}
          <div className="space-y-3">
             <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Pollutant Layer</label>
             <div className="grid grid-cols-2 gap-2">
               {Object.values(Pollutant).map(p => (
                 <button
                   key={p}
                   onClick={() => setSelectedPollutant(p)}
                   className={`px-2 py-1.5 rounded text-xs font-mono transition-colors border ${selectedPollutant === p ? 'bg-slate-700 dark:bg-slate-700 border-slate-600 text-white' : 'bg-white dark:bg-transparent border-slate-200 dark:border-slate-800 text-slate-500 hover:border-slate-400 dark:hover:border-slate-600'}`}
                 >
                   {p}
                 </button>
               ))}
             </div>
          </div>

        </div>

        {/* Footer Actions */}
        <div className="p-4 border-t border-slate-200 dark:border-slate-800 flex gap-2">
           <button onClick={handlePrint} className="flex-1 bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700 border border-slate-200 dark:border-slate-700 text-xs py-2 rounded text-slate-700 dark:text-slate-300 flex items-center justify-center gap-2 transition-colors">
              <FileText className="w-3 h-3" /> Export Report
           </button>
        </div>
      </div>

      {/* MAIN CONTENT */}
      <div className="flex-1 relative bg-slate-100 dark:bg-slate-900 transition-colors duration-300">
        
        {/* Floating Header Stats */}
        <div className="absolute top-4 left-4 z-[400] flex gap-4 no-print">
           <div className="bg-white/90 dark:bg-slate-900/80 backdrop-blur border border-slate-200 dark:border-slate-700 px-4 py-2 rounded-lg shadow-xl">
              <span className="text-xs text-slate-500 dark:text-slate-400 block">City Avg AQI</span>
              <span className={`text-xl font-bold ${avgAQI > 200 ? 'text-red-600 dark:text-red-500' : 'text-yellow-600 dark:text-yellow-500'}`}>{avgAQI}</span>
           </div>
           {viewMode === ViewMode.ADMIN ? (
              <div className="bg-white/90 dark:bg-slate-900/80 backdrop-blur border border-slate-200 dark:border-slate-700 px-4 py-2 rounded-lg shadow-xl">
                 <span className="text-xs text-slate-500 dark:text-slate-400 block">Optimized Zones</span>
                 <span className="text-xl font-bold text-emerald-600 dark:text-emerald-500">{optimizedZones?.size}</span>
              </div>
           ) : (
              <div className="bg-white/90 dark:bg-slate-900/80 backdrop-blur border border-slate-200 dark:border-slate-700 px-4 py-2 rounded-lg shadow-xl flex items-center gap-3">
                 <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse"></div>
                 <span className="text-sm font-medium text-slate-700 dark:text-slate-200">User GPS: Gomti Nagar</span>
              </div>
           )}
        </div>

        {/* Legend */}
        <div className="absolute bottom-6 right-6 z-[400] bg-white/90 dark:bg-slate-900/90 backdrop-blur border border-slate-200 dark:border-slate-700 p-3 rounded-lg shadow-2xl no-print">
           <h4 className="text-[10px] uppercase font-bold text-slate-500 mb-2">AQI Scale (CPCB)</h4>
           <div className="space-y-1">
             {[
               { l: 'Good (0-50)', c: '#059669' },
               { l: 'Satisfactory (51-100)', c: '#65a30d' },
               { l: 'Moderate (101-200)', c: '#ca8a04' },
               { l: 'Poor (201-300)', c: '#ea580c' },
               { l: 'Very Poor (301-400)', c: '#dc2626' },
               { l: 'Severe (401+)', c: '#7f1d1d' },
             ].map(i => (
               <div key={i.l} className="flex items-center gap-2">
                 <div className="w-3 h-3 rounded-full" style={{ backgroundColor: i.c }}></div>
                 <span className="text-[10px] text-slate-700 dark:text-slate-300">{i.l}</span>
               </div>
             ))}
           </div>
           {viewMode === ViewMode.ADMIN && (
              <div className="mt-3 pt-3 border-t border-slate-200 dark:border-slate-700">
                  <div className="flex items-center gap-2">
                     <div className="w-3 h-3 bg-[#10b981]/20 border border-[#10b981]"></div>
                     <span className="text-[10px] text-slate-700 dark:text-slate-300">Funded Intervention</span>
                  </div>
              </div>
           )}
        </div>

        {/* Map */}
        <div className="w-full h-full relative z-0">
          <Map 
            data={data} 
            selectedPollutant={selectedPollutant} 
            weather={weather} 
            onLocationSelect={setSelectedLocation}
            selectedLocationId={selectedLocation?.id || null}
            optimizedZones={optimizedZones}
            theme={theme}
          />
        </div>

        {/* Sidebar Overlay */}
        <Sidebar 
          location={selectedLocation} 
          weather={weather} 
          onClose={() => setSelectedLocation(null)}
          viewMode={viewMode}
          history={selectedLocation ? history[selectedLocation.id] : []}
          selectedPollutant={selectedPollutant}
          theme={theme}
        />
      </div>

      {/* PRINT / EXPORT REPORT */}
      <div className="hidden print-only p-10 bg-white text-black w-full min-h-screen">
         <div className="border-b-4 border-black pb-4 mb-8 flex justify-between items-end">
            <div>
               <h1 className="text-4xl font-black uppercase tracking-tight mb-2">LMC Compliance Report</h1>
               <p className="text-gray-600">Environmental Monitoring & Mitigation Command Center</p>
            </div>
            <div className="text-right">
               <p className="font-bold text-lg">{new Date().toLocaleDateString('en-IN', { year: 'numeric', month: 'long', day: 'numeric' })}</p>
               <p className="text-sm text-gray-500">Ref: LMC-ENV-{new Date().getTime().toString().slice(-6)}</p>
            </div>
         </div>

         <div className="grid grid-cols-3 gap-6 mb-8">
            <div className="bg-gray-100 p-4 border border-gray-300">
               <span className="block text-sm text-gray-500 uppercase">City Avg AQI</span>
               <span className="text-3xl font-bold">{avgAQI}</span>
            </div>
            <div className="bg-gray-100 p-4 border border-gray-300">
               <span className="block text-sm text-gray-500 uppercase">Critical Hotspots</span>
               <span className="text-3xl font-bold text-red-700">{criticalZones}</span>
            </div>
            <div className="bg-gray-100 p-4 border border-gray-300">
               <span className="block text-sm text-gray-500 uppercase">Inversion Status</span>
               <span className="text-xl font-bold">{weather.isInversion ? 'ACTIVE' : 'INACTIVE'}</span>
            </div>
         </div>

         <h2 className="text-xl font-bold mb-4 uppercase border-l-4 border-black pl-3">Zone-wise Analysis & Mitigation Strategy</h2>
         <table className="w-full text-left border-collapse text-sm">
            <thead className="bg-black text-white">
               <tr>
                 <th className="p-3">Zone Name</th>
                 <th className="p-3">Current AQI</th>
                 <th className="p-3">Primary Pollutant</th>
                 <th className="p-3">Source Attribution</th>
                 <th className="p-3">Required Intervention</th>
                 <th className="p-3 text-right">Proj. Reduction</th>
               </tr>
            </thead>
            <tbody>
              {data.map((d, idx) => {
                 const a = analyzeSource(d, weather);
                 const isOptimized = optimizedZones?.has(d.id);
                 return (
                   <tr key={d.id} className={`border-b border-gray-300 ${idx % 2 === 0 ? 'bg-gray-50' : 'bg-white'}`}>
                     <td className="p-3 font-semibold">{d.name}</td>
                     <td className={`p-3 font-bold ${d.aqi > 300 ? 'text-red-700' : ''}`}>{d.aqi}</td>
                     <td className="p-3">{selectedPollutant} ({d.pollutants[selectedPollutant]})</td>
                     <td className="p-3 text-gray-700">{a.primarySource}</td>
                     <td className="p-3">
                        <span className="block font-medium">{a.intervention.action}</span>
                        {isOptimized && <span className="text-xs bg-green-100 text-green-800 px-1 rounded border border-green-300">BUDGET APPROVED</span>}
                     </td>
                     <td className="p-3 text-right font-mono">{a.intervention.roi.split(' ')[0]}</td>
                   </tr>
                 );
              })}
            </tbody>
         </table>

         <div className="mt-12 pt-8 border-t border-gray-300 text-center text-xs text-gray-500">
            <p>Generated by AQI-REVIVE System | Lucknow Municipal Corporation</p>
            <p>This report assumes standard meterological conditions as per IMD inputs.</p>
         </div>
      </div>

    </div>
  );
};

export default App;