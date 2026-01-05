import React, { useState, useEffect, useRef } from 'react';
import { LocationData, Weather, Pollutant, PollutantLevels, PolicyType, SimulationResult } from '../types';
import { analyzeSource, getAQIColor, simulatePolicy } from '../services/analysisEngine';
import { AlertTriangle, Factory, Wind, Droplets, BookOpen, Banknote, ShieldCheck, TrendingUp, Eye, Calendar, MapPin, PieChart, Activity, Siren, History, Bot, Sparkles, Copy, Terminal, ChevronRight } from 'lucide-react';
import { GoogleGenAI } from '@google/genai';
import Chart from 'chart.js/auto';
import { generate24hHistory } from '../services/dataService';

interface SidebarProps {
  location: LocationData | null;
  weather: Weather;
  onClose: () => void;
  viewMode: 'Citizen' | 'Admin';
  history: { time: string, pollutants: PollutantLevels }[];
  selectedPollutant: Pollutant;
  theme: 'dark' | 'light';
}

const Sidebar: React.FC<SidebarProps> = ({ location, weather, onClose, viewMode, history, selectedPollutant, theme }) => {
  const [aiLoading, setAiLoading] = useState(false);
  const [aiReport, setAiReport] = useState<string | null>(null);
  
  // Simulation State
  const [selectedPolicy, setSelectedPolicy] = useState<PolicyType>('Odd-Even Traffic');
  const [simResult, setSimResult] = useState<SimulationResult | null>(null);
  const [enforceStatus, setEnforceStatus] = useState<string | null>(null);

  // Data State
  const [activeTab, setActiveTab] = useState<'overview' | 'history' | 'forecast'>('overview');
  const [history24h, setHistory24h] = useState<{ time: string, pollutants: PollutantLevels }[]>([]);

  // Refs for Charts
  const trendChartRef = useRef<HTMLCanvasElement>(null);
  const trendChartInstance = useRef<Chart | null>(null);
  
  const sourceChartRef = useRef<HTMLCanvasElement>(null);
  const sourceChartInstance = useRef<Chart | null>(null);
  
  // Logic Analysis
  const analysis = location ? analyzeSource(location, weather) : null;
  const color = location ? getAQIColor(location.aqi) : '#fff';

  // Generate 24h history when location changes
  useEffect(() => {
    if (location) {
      setHistory24h(generate24hHistory(location));
    }
  }, [location?.id]);

  // 1. Render Trend/Forecast Chart
  useEffect(() => {
    if (!trendChartRef.current || !location) return;

    if (trendChartInstance.current) {
      trendChartInstance.current.destroy();
    }

    const ctx = trendChartRef.current.getContext('2d');
    if (!ctx) return;

    let labels, dataPoints, label;

    if (activeTab === 'overview') {
        if (!history || history.length === 0) return;
        labels = history.map(h => h.time);
        dataPoints = history.map(h => h.pollutants[selectedPollutant]);
        label = `Live Session ${selectedPollutant}`;
    } else if (activeTab === 'history') {
        labels = history24h.map(h => h.time);
        dataPoints = history24h.map(h => h.pollutants[selectedPollutant]);
        label = `Last 24 Hours (${selectedPollutant})`;
    } else {
        labels = location.forecast.map(f => f.date);
        dataPoints = location.forecast.map(f => f.pm25);
        label = '7-Day PM2.5 Forecast';
    }

    const chartColor = getAQIColor(dataPoints[dataPoints.length - 1] || 100);
    
    // Theme colors for Chart
    const gridColor = theme === 'dark' ? '#334155' : '#e2e8f0';
    const textColor = theme === 'dark' ? '#94a3b8' : '#64748b';
    const tooltipBg = theme === 'dark' ? '#1e293b' : '#ffffff';
    const tooltipText = theme === 'dark' ? '#f8fafc' : '#0f172a';

    trendChartInstance.current = new Chart(ctx, {
      type: 'line',
      data: {
        labels: labels,
        datasets: [{
          label: label,
          data: dataPoints,
          borderColor: chartColor,
          backgroundColor: `${chartColor}33`,
          fill: true,
          tension: 0.4,
          pointRadius: activeTab === 'history' ? 2 : 3,
          pointBackgroundColor: theme === 'dark' ? '#fff' : '#fff'
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { display: false },
          tooltip: {
            mode: 'index',
            intersect: false,
            backgroundColor: tooltipBg,
            titleColor: tooltipText,
            bodyColor: tooltipText,
            borderColor: gridColor,
            borderWidth: 1
          }
        },
        scales: {
          x: { 
             display: true, 
             ticks: { 
               color: textColor, 
               font: { size: 9 }, 
               maxRotation: 45, 
               minRotation: 45,
               maxTicksLimit: activeTab === 'history' ? 8 : 12 
             },
             grid: { color: gridColor, drawBorder: false }
          },
          y: { 
            grid: { color: gridColor, drawBorder: false }, 
            ticks: { color: textColor, font: { size: 10 } }, 
            beginAtZero: false 
          }
        }
      }
    });

    return () => {
      if (trendChartInstance.current) trendChartInstance.current.destroy();
    };
  }, [history, selectedPollutant, activeTab, location, history24h, theme]);

  // 2. Render Source Breakdown Donut Chart
  useEffect(() => {
    if (!sourceChartRef.current || !analysis) return;

    if (sourceChartInstance.current) {
        sourceChartInstance.current.destroy();
    }

    const ctx = sourceChartRef.current.getContext('2d');
    if (!ctx) return;

    const textColor = theme === 'dark' ? '#94a3b8' : '#64748b';
    const tooltipBg = theme === 'dark' ? '#1e293b' : '#ffffff';
    const tooltipText = theme === 'dark' ? '#f8fafc' : '#0f172a';

    sourceChartInstance.current = new Chart(ctx, {
        type: 'doughnut',
        data: {
            labels: analysis.sourceBreakdown.map(s => s.source),
            datasets: [{
                data: analysis.sourceBreakdown.map(s => s.percentage),
                backgroundColor: analysis.sourceBreakdown.map(s => s.color),
                borderWidth: 0,
                hoverOffset: 4
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            cutout: '65%',
            plugins: {
                legend: { 
                    display: true, 
                    position: 'right', 
                    labels: { 
                        color: textColor, 
                        boxWidth: 8, 
                        font: { size: 10 },
                        padding: 10
                    } 
                },
                tooltip: {
                    backgroundColor: tooltipBg,
                    bodyColor: tooltipText,
                    titleColor: tooltipText,
                    borderColor: theme === 'light' ? '#e2e8f0' : undefined,
                    borderWidth: theme === 'light' ? 1 : 0,
                    callbacks: {
                        label: function(context) {
                            return ` ${context.label}: ${context.raw}%`;
                        }
                    }
                }
            },
            layout: {
                padding: {
                    right: 10
                }
            }
        }
    });

    return () => {
        if (sourceChartInstance.current) sourceChartInstance.current.destroy();
    };
  }, [analysis, theme]);

  // Reset Simulation when location changes
  useEffect(() => {
    setSimResult(null);
    setEnforceStatus(null);
  }, [location?.id]);


  if (!location || !analysis) return null;

  // AI Report Formatter
  const formatAIReport = (text: string) => {
    if (!text) return null;
    
    // Split into sections based on the prompt structure "[Section X: Title]"
    const sections = text.split(/\[Section \d+: /g).filter(Boolean);

    return (
      <div className="space-y-6">
        {sections.map((section, idx) => {
          const splitIndex = section.indexOf(']');
          if (splitIndex === -1) return null;

          const title = section.slice(0, splitIndex).trim();
          const content = section.slice(splitIndex + 1).trim();

          return (
            <div key={idx} className="animate-in slide-in-from-bottom-2 fade-in duration-500" style={{ animationDelay: `${idx * 150}ms` }}>
              <h4 className="text-[10px] font-mono font-bold uppercase tracking-widest text-indigo-600 dark:text-indigo-400 mb-3 flex items-center gap-2 border-b border-indigo-200 dark:border-indigo-500/30 pb-1">
                <ChevronRight className="w-3 h-3 text-indigo-500" />
                {title}
              </h4>
              <div className="text-sm text-slate-700 dark:text-slate-300 leading-relaxed font-sans pl-1">
                {content.split('\n').map((line, lineIdx) => {
                   const trimmed = line.trim();
                   if (!trimmed) return null;
                   if (trimmed.startsWith('-')) {
                      return (
                          <div key={lineIdx} className="flex gap-2 mb-2 items-start">
                              <span className="text-indigo-500 mt-1.5 text-[8px]">•</span>
                              <span className="text-slate-600 dark:text-slate-400">{trimmed.substring(1).trim()}</span>
                          </div>
                      )
                   }
                   return <p key={lineIdx} className="mb-2">{trimmed}</p>;
                })}
              </div>
            </div>
          );
        })}
      </div>
    );
  };

  const generateReport = async () => {
    if (!process.env.API_KEY) {
      alert("API Key not found. Please set REACT_APP_GEMINI_API_KEY.");
      return;
    }
    setAiLoading(true);
    try {
      const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
      const prompt = `
        Role: Environmental Scientist for Lucknow Municipal Corporation.
        Task: Create a brief situational report for ${location.name}.
        
        Data:
        - AQI: ${location.aqi}
        - Primary Pollutant: ${Object.entries(location.pollutants).sort(([,a], [,b]) => (b as number) - (a as number))[0][0]}
        - Detected Source: ${analysis.primarySource}
        - Recommended Action: ${analysis.intervention.action}
        
        Output Format:
        [Section 1: Threat Assessment]
        (1-2 sentences on immediate health/environmental risk)
        
        [Section 2: Key Observations]
        - (Bullet point 1)
        - (Bullet point 2)
        - (Bullet point 3)
        
        [Section 3: Strategic Recommendation]
        (1 clear, actionable sentence for LMC Admins)

        [Section 4: Citizen Action Strategy]
        (3 specific, actionable steps for residents in ${location.name} to mitigate personal exposure and aid reduction. Tailor to the specific pollutant and area context.)
        
        Tone: Clinical, Urgent, Professional. No markdown formatting like bold/italics, just clean text.
      `;
      
      const response = await ai.models.generateContent({
        model: 'gemini-3-flash-preview',
        contents: prompt
      });
      setAiReport(response.text || "No report generated.");
    } catch (e) {
      console.error(e);
      setAiReport("Could not generate AI report. Check console.");
    } finally {
      setAiLoading(false);
    }
  };

  const handleSimulate = () => {
    if (!location) return;
    const res = simulatePolicy(location, selectedPolicy, weather);
    setSimResult(res);
  };

  const handleEnforce = () => {
    setEnforceStatus(`Simulated Alert Sent to ${Math.floor(Math.random() * 50000) + 10000} users in ${location.name}.`);
    setTimeout(() => setEnforceStatus(null), 3000);
  };

  return (
    <div className="fixed top-20 right-4 w-96 max-h-[85vh] overflow-y-auto bg-white/95 dark:bg-slate-900/95 backdrop-blur-md border border-slate-200 dark:border-slate-700 rounded-xl shadow-2xl p-6 z-[1000] text-slate-900 dark:text-slate-100 animate-in slide-in-from-right duration-300 transition-colors duration-300">
      <div className="flex justify-between items-start mb-4">
        <div>
          <h2 className="text-2xl font-bold font-mono">{location.name}</h2>
          <span className="text-xs text-slate-500 dark:text-slate-400 uppercase tracking-widest">{location.type} Zone</span>
        </div>
        <button onClick={onClose} className="text-slate-400 hover:text-slate-900 dark:hover:text-white">&times;</button>
      </div>

      {/* AQI Badge */}
      <div className="flex items-center gap-4 mb-6 p-4 rounded-lg bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700">
        <div 
          className="w-16 h-16 rounded-full flex items-center justify-center text-xl font-bold shadow-lg text-white"
          style={{ backgroundColor: color, boxShadow: `0 0 20px ${color}40` }}
        >
          {location.aqi}
        </div>
        <div>
          <p className="text-sm text-slate-500 dark:text-slate-400">Current AQI</p>
          <p className="font-semibold text-lg" style={{ color }}>
            {location.aqi > 300 ? 'Hazardous' : location.aqi > 200 ? 'Very Poor' : 'Poor'}
          </p>
        </div>
      </div>

      {/* Vision AI Analysis Section */}
      <div className="mb-6 bg-slate-100 dark:bg-slate-800/40 p-3 rounded-lg border border-slate-200 dark:border-slate-700">
        <h3 className="text-xs font-bold text-sky-600 dark:text-sky-400 mb-2 flex items-center gap-2 uppercase tracking-wider">
           <Eye className="w-3 h-3" /> AI Vision Source Discovery
        </h3>
        <div className="flex justify-between items-center mb-2">
            <span className="text-sm text-slate-700 dark:text-slate-200 font-medium truncate pr-2">{analysis.primarySource}</span>
            <span className="text-xs bg-sky-100 dark:bg-sky-900/50 text-sky-700 dark:text-sky-200 px-2 py-0.5 rounded border border-sky-200 dark:border-sky-800 shrink-0">
                {(analysis.confidence * 100).toFixed(0)}% Conf.
            </span>
        </div>
        
        {/* Source Breakdown Chart */}
        <div className="h-48 w-full mt-3 relative">
            <canvas ref={sourceChartRef}></canvas>
        </div>
        
        <div className="mt-2 text-[10px] text-slate-500 italic">
            Wind Vector Analysis: {location.visionAnalysis.windVectorAnalysis}
        </div>
      </div>

      {/* Chart Tabs */}
      <div className="flex gap-2 mb-2 bg-slate-100 dark:bg-slate-800/50 p-1 rounded-lg border border-slate-200 dark:border-transparent">
         <button 
           onClick={() => setActiveTab('overview')} 
           className={`flex-1 text-[10px] py-1.5 rounded transition-all font-medium ${activeTab === 'overview' ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow' : 'text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-300'}`}
         >
           Live Session
         </button>
         <button 
           onClick={() => setActiveTab('history')} 
           className={`flex-1 text-[10px] py-1.5 rounded transition-all font-medium ${activeTab === 'history' ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow' : 'text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-300'}`}
         >
           24h History
         </button>
         <button 
           onClick={() => setActiveTab('forecast')} 
           className={`flex-1 text-[10px] py-1.5 rounded transition-all font-medium ${activeTab === 'forecast' ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow' : 'text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-300'}`}
         >
           7-Day
         </button>
      </div>

      {/* Trend Chart */}
      <div className="mb-6 h-40 w-full bg-slate-50 dark:bg-slate-800/30 rounded-lg border border-slate-200 dark:border-slate-700 p-2">
         <canvas ref={trendChartRef}></canvas>
      </div>

      {/* Pollutant Breakdown (Mini) */}
      <div className="grid grid-cols-2 gap-2 mb-6">
        {Object.entries(location.pollutants).slice(0, 4).map(([key, val]) => (
           <div key={key} className="bg-slate-100 dark:bg-slate-800 p-2 rounded flex justify-between items-center">
             <span className="text-xs text-slate-500 dark:text-slate-400">{key}</span>
             <span className={`text-sm font-mono ${(val as number) > 100 ? 'text-red-500 dark:text-red-400' : 'text-green-600 dark:text-green-400'}`}>{val as React.ReactNode}</span>
           </div>
        ))}
      </div>

      {/* View Specific Content */}
      {viewMode === 'Admin' ? (
        <div className="space-y-6">
          {/* Default Intervention Info */}
          <div className="border-t border-slate-200 dark:border-slate-700 pt-4 animate-in fade-in">
            <h3 className="text-sm font-semibold text-emerald-600 dark:text-emerald-400 flex items-center gap-2 mb-3">
              <ShieldCheck className="w-4 h-4" /> Intervention Protocol
            </h3>
            <div className="bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-900 p-4 rounded-lg">
                <h4 className="font-bold text-emerald-700 dark:text-emerald-200">{analysis.intervention.action}</h4>
                <p className="text-sm text-slate-600 dark:text-slate-300 mt-1">{analysis.intervention.description}</p>
                
                <div className="grid grid-cols-2 gap-4 mt-4 text-xs">
                  <div>
                    <span className="block text-slate-500">Proj. ROI</span>
                    <span className="text-emerald-600 dark:text-emerald-400 font-mono">{analysis.intervention.roi}</span>
                  </div>
                  <div>
                    <span className="block text-slate-500">Est. Cost</span>
                    <span className="text-emerald-600 dark:text-emerald-400 font-mono">₹{analysis.intervention.costPerSqKm} Lakhs/km²</span>
                  </div>
                </div>
            </div>
          </div>

          {/* POLICY SANDBOX (DYNAMIC LEZ SIMULATOR) */}
          <div className="border-t border-slate-200 dark:border-slate-700 pt-4 animate-in fade-in">
             <h3 className="text-sm font-semibold text-purple-600 dark:text-purple-400 flex items-center gap-2 mb-3">
               <Activity className="w-4 h-4" /> Dynamic LEZ Simulator
             </h3>
             <div className="bg-slate-50 dark:bg-slate-800/50 p-4 rounded-lg border border-slate-200 dark:border-slate-700">
                <div className="mb-3">
                  <label className="text-xs text-slate-500 dark:text-slate-400 block mb-1">Select Policy Protocol</label>
                  <select 
                    value={selectedPolicy}
                    onChange={(e) => setSelectedPolicy(e.target.value as PolicyType)}
                    className="w-full bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-600 rounded text-sm p-2 text-slate-900 dark:text-slate-200 outline-none focus:border-purple-500 transition-colors"
                  >
                    <option>Odd-Even Traffic</option>
                    <option>Total Diesel Ban</option>
                    <option>Construction Freeze</option>
                    <option>Industrial Shutdown</option>
                  </select>
                </div>
                
                <button 
                  onClick={handleSimulate}
                  className="w-full bg-purple-600 hover:bg-purple-700 text-white text-xs font-bold py-2 rounded transition-colors mb-4"
                >
                  RUN SIMULATION
                </button>

                {simResult && (
                  <div className="bg-purple-50 dark:bg-purple-950/30 border border-purple-200 dark:border-purple-900/50 rounded p-3 animate-in zoom-in-95 duration-200">
                      <h4 className="text-xs font-bold text-purple-700 dark:text-purple-300 uppercase mb-2 border-b border-purple-200 dark:border-purple-800/50 pb-1">Proj. Impact Analysis</h4>
                      
                      <div className="grid grid-cols-2 gap-2 mb-3">
                        <div className="bg-white dark:bg-slate-900/50 p-2 rounded shadow-sm dark:shadow-none">
                          <span className="block text-[10px] text-slate-500 dark:text-slate-400">Time to Blue Sky</span>
                          <span className="text-lg font-mono font-bold text-sky-600 dark:text-sky-400">{simResult.timeToRecovery}h</span>
                        </div>
                        <div className="bg-white dark:bg-slate-900/50 p-2 rounded shadow-sm dark:shadow-none">
                          <span className="block text-[10px] text-slate-500 dark:text-slate-400">Healthcare Savings</span>
                          <span className="text-lg font-mono font-bold text-green-600 dark:text-green-400">₹{simResult.healthcareSavings}Cr</span>
                        </div>
                      </div>

                      <div className="text-xs text-slate-600 dark:text-slate-300 mb-3">
                         <span className="text-purple-600 dark:text-purple-400 font-bold">{simResult.primaryPollutantDrop}% Drop</span> in primary pollutants. {simResult.impactDescription}
                      </div>

                      <button 
                        onClick={handleEnforce}
                        className="w-full flex items-center justify-center gap-2 border border-red-500 text-red-500 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-500/10 text-xs font-bold py-2 rounded transition-colors"
                      >
                        <Siren className="w-3 h-3" /> ENFORCE & NOTIFY
                      </button>
                      
                      {enforceStatus && (
                         <div className="mt-2 text-[10px] text-center text-green-600 dark:text-green-400 animate-pulse font-bold bg-green-100 dark:bg-green-900/20 p-1 rounded">
                           {enforceStatus}
                         </div>
                      )}
                  </div>
                )}
             </div>
          </div>
        </div>
      ) : (
        <div className="border-t border-slate-200 dark:border-slate-700 pt-4 animate-in fade-in">
           <h3 className="text-sm font-semibold text-rose-500 dark:text-rose-400 flex items-center gap-2 mb-3">
             <AlertTriangle className="w-4 h-4" /> Health Advisory
           </h3>
           <ul className="space-y-2 text-sm text-slate-600 dark:text-slate-300 list-disc pl-4">
             {location.aqi > 200 ? (
               <>
                <li>Avoid outdoor exercise, especially near {location.name}.</li>
                <li>N95 masks recommended for children and elderly.</li>
                <li>Keep windows closed during peak traffic hours.</li>
               </>
             ) : (
                <li>Air quality is moderate. Sensitive groups should limit prolonged exertion.</li>
             )}
           </ul>
        </div>
      )}

      {/* Gemini AI Integration */}
      <div className="mt-6 border-t border-slate-200 dark:border-slate-700 pt-4 pb-4">
         <button 
           onClick={generateReport}
           disabled={aiLoading}
           className="w-full group relative overflow-hidden py-2.5 bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-500 hover:to-violet-500 disabled:opacity-70 disabled:cursor-not-allowed rounded-lg text-sm font-medium text-white transition-all shadow-lg shadow-indigo-500/25 dark:shadow-indigo-900/50 flex items-center justify-center gap-2"
         >
           <div className="absolute inset-0 bg-white/20 translate-y-full group-hover:translate-y-0 transition-transform duration-300"></div>
           <div className="relative flex items-center gap-2">
             {aiLoading ? (
                <>
                   <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                   <span>Processing Neural Data...</span>
                </>
             ) : (
                <>
                   <Sparkles className="w-4 h-4" />
                   <span>Generate AI Situation Report</span>
                </>
             )}
           </div>
         </button>
         
         {aiReport && (
           <div className="mt-4 relative overflow-hidden rounded-xl border border-slate-200 dark:border-indigo-500/30 bg-slate-50 dark:bg-slate-950 backdrop-blur-md shadow-2xl animate-in fade-in slide-in-from-bottom-4 duration-500">
             
             {/* Tech Header */}
             <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 px-4 py-3 bg-slate-100/50 dark:bg-slate-900/50">
               <div className="flex items-center gap-2">
                 <div className="h-1.5 w-1.5 rounded-full bg-indigo-500 animate-pulse" />
                 <span className="text-[10px] font-bold uppercase tracking-widest text-slate-500 dark:text-slate-400">
                   Intelligence Brief
                 </span>
               </div>
               <span className="font-mono text-[10px] text-slate-400">
                 {new Date().toLocaleTimeString()}
               </span>
             </div>
 
             {/* Content Area */}
             <div className="p-5 max-h-96 overflow-y-auto custom-scrollbar">
                {/* Replaced raw prose with structured formatter */}
                {formatAIReport(aiReport)}
             </div>
             
             {/* Bottom Decoration */}
             <div className="h-0.5 w-full bg-gradient-to-r from-indigo-500 via-purple-500 to-pink-500 opacity-30"></div>
           </div>
         )}
      </div>

    </div>
  );
};

export default Sidebar;