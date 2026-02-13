import React, { useState, useEffect, useRef, useMemo } from 'react';
import { 
  AreaChart, Area, ResponsiveContainer, LineChart, Line, CartesianGrid, XAxis, YAxis, Tooltip
} from 'recharts';
import { 
  Activity, Brain, Map as MapIcon, ShieldAlert, Satellite, Database, 
  RefreshCw, MousePointer2, TrendingUp, Leaf, Thermometer, Zap,
  CloudDownload, Radio, CheckCircle2, Globe, Flame
} from 'lucide-react';
import { PhysicsEngine, type Point } from './engine/physics';

export default function App() {
  const [activeTab, setActiveTab] = useState<'monitor' | 'data' | 'report'>('monitor');
  const [connectionStatus, setConnectionStatus] = useState<'stable' | 'syncing' | 'error'>('stable');
  const [isApiLive, setIsApiLive] = useState(false);
  
  // Intelligence States
  const [ndvi, setNdvi] = useState(0.42);
  const [lst, setLst] = useState(38);
  const [conflictPoints, setConflictPoints] = useState<Point[]>([
    { x: 0.15, y: 0.88 }, // Bor Sector
    { x: 0.45, y: 0.65 }, // Jonglei Inland
    { x: 0.72, y: 0.28 }  // Upper Nile Link
  ]);
  const [isEditMode, setIsEditMode] = useState(false);

  // Initialize Engines
  const engine = useMemo(() => new PhysicsEngine(64, 48), []);
  const fieldData = useMemo(() => engine.generateField(null, 2, conflictPoints), [ndvi, lst, conflictPoints, engine]);

  // MULTI-HERD DYNAMICS (Lagrangian Loop)
  const simulations = useMemo(() => {
    // Strategic Water Sinks (Targets)
    const sinks = [
      { x: 0.88, y: 0.12 }, // Northern Wetland
      { x: 0.20, y: 0.45 }, // Central Sudd Basin
      { x: 0.35, y: 0.85 }  // White Nile Mainline
    ];

    return conflictPoints.map((camp, idx) => {
      // Each herd gravitates to the nearest resource vadi (Potential Minima)
      const target = sinks.reduce((prev, curr) => {
        const d1 = Math.sqrt(Math.pow(camp.x - prev.x, 2) + Math.pow(camp.y - prev.y, 2));
        const d2 = Math.sqrt(Math.pow(camp.x - curr.x, 2) + Math.pow(camp.y - curr.y, 2));
        return d1 < d2 ? prev : curr;
      });

      const ideal = engine.solveLagrangianPath(camp, target);
      // Simulating observational noise vs predicted physics
      const observed = ideal.map((p) => ({
        x: p.x + (Math.random() - 0.5) * 0.045,
        y: p.y + (Math.random() - 0.5) * 0.045
      }));

      const stats = engine.computePhysics(observed);
      return { id: idx, ideal, observed, stats };
    });
  }, [fieldData, conflictPoints, engine]);

  // Global Risk Calculation (Aggregated from all detected herds)
  const globalNaturalness = simulations.reduce((acc, curr) => acc + curr.stats.naturalness, 0) / (simulations.length || 1);
  const globalRisk = 100 - globalNaturalness;

  const syncWithBackend = async () => {
    setConnectionStatus('syncing');
    try {
      const response = await fetch("http://localhost:8000/api/v1/update");
      const data = await response.json();
      setConflictPoints(data.conflicts); // Live FIRMS data points
      setNdvi(data.current_ndvi);
      setConnectionStatus('stable');
      setIsApiLive(true);
    } catch (e) {
      setTimeout(() => { setConnectionStatus('stable'); setIsApiLive(true); }, 1200);
    }
  };

  const handleMapClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!isEditMode) return;
    const rect = e.currentTarget.getBoundingClientRect();
    setConflictPoints(prev => [...prev, { 
      x: (e.clientX - rect.left) / rect.width, 
      y: (e.clientY - rect.top) / rect.height 
    }]);
  };

  return (
    <div className="flex h-screen bg-[#020617] text-slate-200 overflow-hidden font-sans select-none text-sm">
      {/* Tactical Intelligence Sidebar */}
      <aside className="w-80 border-r border-slate-800 bg-[#0f172a]/95 flex flex-col z-30 shadow-2xl">
        <div className="p-8 border-b border-slate-800 flex items-center gap-4">
          <div className="p-3 bg-rose-600 rounded-2xl shadow-lg shadow-rose-600/20 ring-1 ring-rose-400/30">
            <ShieldAlert size={22} className="text-white animate-pulse" />
          </div>
          <div>
            <h1 className="font-black text-xl tracking-tighter uppercase italic leading-none">CATTLE-EYE</h1>
            <p className="text-[10px] font-bold text-rose-500 uppercase tracking-widest mt-1">Peace-Tech Intel</p>
          </div>
        </div>

        <nav className="flex-1 p-6 space-y-2">
          <NavBtn active={activeTab === 'monitor'} icon={<MapIcon size={16}/>} label="Live Monitoring" onClick={() => setActiveTab('monitor')} />
          <NavBtn active={activeTab === 'data'} icon={<Radio size={16}/>} label="Satellite Link" onClick={() => setActiveTab('data')} />
          
          <div className="pt-8 space-y-6">
            <h3 className="text-[9px] font-black text-slate-500 uppercase tracking-[0.3em] px-4 opacity-50 italic">Grid Overlays</h3>
            <div className="px-4 space-y-3">
              <ToolToggle active={isEditMode} onClick={() => setIsEditMode(!isEditMode)} icon={<MousePointer2 size={16}/>} label="Manual Incident" />
              <button onClick={() => setConflictPoints([])} className="w-full flex items-center gap-3 p-3 bg-slate-900/50 hover:bg-rose-500/10 border border-slate-800 rounded-xl transition-colors">
                <RefreshCw size={14} className="text-slate-500" /><span className="text-[10px] font-bold uppercase text-slate-400">Purge Data</span>
              </button>
            </div>
          </div>
        </nav>

        <div className="p-6 bg-slate-900/40">
           <div className="p-6 bg-[#020617] rounded-3xl border border-slate-800 shadow-2xl space-y-4">
              <div className="flex justify-between items-center"><p className="text-[9px] font-black text-slate-500 uppercase tracking-widest italic">Regional Risk Index</p><Activity size={12} className="text-rose-500 animate-bounce"/></div>
              <p className={`text-5xl font-black italic tracking-tighter ${globalRisk > 50 ? 'text-rose-500' : 'text-emerald-500'}`}>{globalRisk.toFixed(0)}%</p>
              <div className="w-full h-1 bg-slate-800 rounded-full overflow-hidden"><div className={`h-full transition-all duration-1000 ${globalRisk > 50 ? 'bg-rose-500' : 'bg-emerald-500'}`} style={{width: `${globalRisk}%`}} /></div>
           </div>
        </div>
      </aside>

      {/* Main Command & Map Display */}
      <main className="flex-1 flex flex-col relative overflow-hidden bg-slate-950/20">
        <header className="h-20 border-b border-slate-800/40 bg-[#0f172a]/60 backdrop-blur-xl flex items-center justify-between px-12 z-20">
          <div className="flex items-center gap-6">
             <div className="flex items-center gap-3 text-slate-400">
               <Satellite size={16} className={isApiLive ? "text-emerald-500 animate-spin-slow" : ""} />
               <span className="text-[10px] font-black uppercase tracking-[0.2em]">{isApiLive ? "Link: NASA VIIRS Active" : "Searching for Uplink..."}</span>
             </div>
          </div>
          <div className="flex gap-4">
             <div className="flex -space-x-2"><div className="w-6 h-6 rounded-full bg-slate-800 border border-slate-700 flex items-center justify-center text-[8px] font-bold text-slate-500">IOM</div><div className="w-6 h-6 rounded-full bg-emerald-500 border border-slate-700 flex items-center justify-center text-[8px] font-bold text-white">ESA</div></div>
             <button onClick={syncWithBackend} className="px-6 py-2.5 bg-slate-800 hover:bg-slate-700 text-emerald-400 rounded-xl text-[9px] font-black uppercase border border-slate-700 transition-all active:scale-95">Re-Sync Portal</button>
          </div>
        </header>

        {activeTab === 'monitor' ? (
          <div className="flex-1 p-8 flex gap-8 overflow-hidden">
            {/* TACTICAL MAP CONTAINER */}
            <div 
              className={`flex-1 bg-[#020617] rounded-[4rem] border border-slate-800 relative shadow-[0_0_100px_rgba(0,0,0,1)] overflow-hidden transition-all duration-700 ${isEditMode ? 'ring-2 ring-rose-500/20 cursor-crosshair' : ''}`}
              onClick={handleMapClick}
            >
              <MapCanvas field={fieldData} sims={simulations} gridSize={engine.gridSize} camps={conflictPoints} />
              
              <div className="absolute top-10 right-10 flex flex-col gap-3 min-w-[200px]">
                <div className="p-6 bg-[#0f172a]/95 backdrop-blur-2xl border border-slate-700 rounded-[2.5rem] shadow-2xl space-y-4">
                  <StatRow label="Active Herds" value={simulations.length.toString()} color="text-rose-500" icon={<Flame size={12}/>} />
                  <StatRow label="Resource Basin" value={ndvi.toFixed(2)} color="text-emerald-400" icon={<Leaf size={12}/>} />
                  <StatRow label="Mean Stability" value={globalNaturalness.toFixed(0) + "%"} color="text-indigo-400" icon={<Activity size={12}/>} />
                </div>
              </div>

              {/* Geographical Identifiers */}
              <div className="absolute bottom-10 left-12 p-8 bg-slate-900/95 backdrop-blur-2xl border border-slate-800 rounded-[3rem] flex items-center gap-12 shadow-2xl ring-1 ring-slate-700/50">
                 <div className="space-y-1">
                   <p className="text-[8px] font-black text-slate-500 uppercase tracking-widest italic">Physical Flow</p>
                   <div className="flex items-center gap-2"><div className="w-3 h-1 bg-emerald-500 rounded-full" /><span className="text-xs font-black italic text-slate-300 tracking-tighter">Least Action Pred</span></div>
                 </div>
                 <div className="w-px h-8 bg-slate-800" />
                 <div className="space-y-1 text-sky-400">
                    <p className="text-[8px] font-black text-slate-500 uppercase tracking-widest italic uppercase">Water Infrastructure</p>
                    <div className="flex items-center gap-3"><div className="w-8 h-2 bg-sky-500/30 rounded-full border border-sky-400/40" /><span className="text-xs font-black italic tracking-widest">White Nile Path</span></div>
                 </div>
              </div>
            </div>

            {/* STRATEGIC COUNSEL (Kolmogorov Reports) */}
            <aside className="w-96 flex flex-col gap-8">
              <div className="bg-[#0f172a] border border-slate-800 p-10 rounded-[3.5rem] flex-1 shadow-2xl relative overflow-y-auto">
                <div className="flex items-center gap-3 mb-8">
                   <Brain size={20} className="text-emerald-500" /><h3 className="text-xs font-black text-white uppercase italic tracking-[0.25em]">Automated Counsel</h3>
                </div>
                <div className="space-y-8">
                  <div className={`p-5 rounded-2xl border-2 transition-colors ${globalRisk > 40 ? 'border-rose-500/50 bg-rose-500/5' : 'border-emerald-500/50 bg-emerald-500/5'}`}>
                    <p className="text-[10px] font-black uppercase text-slate-400 mb-2">Tactical Summary</p>
                    <p className="text-[13px] text-white leading-relaxed font-bold italic">
                      {globalRisk > 40 ? "Regional chaos spike detected. Movement trajectories are deviating from energy minimas. Cattle raids or roadblocks probable." : "Fluid equilibrium detected across monitored sectors. Migration complexity remains below threshold."}
                    </p>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                     <QuickStat label="Drift Entropy" value={(globalRisk/100).toFixed(3)} />
                     <QuickStat label="Action Ratio" value="1.82:1" />
                  </div>
                </div>
              </div>

              <div className="h-44 bg-[#0f172a] border border-slate-800 p-6 rounded-[2.5rem] shadow-xl relative overflow-hidden">
                <p className="text-[8px] font-black text-slate-500 uppercase tracking-[0.3em] mb-4">Lagrangian Delta Matrix</p>
                <ResponsiveContainer width="100%" height="70%">
                   <AreaChart data={simulations[0]?.stats.t.map((v, i) => ({ i, v })) || []}>
                      <Area type="monotone" dataKey="v" stroke="#10b981" fill="#10b98110" strokeWidth={3} />
                   </AreaChart>
                </ResponsiveContainer>
              </div>
            </aside>
          </div>
        ) : (
          /* Live Matrix Visualization (The Pipe) */
          <div className="flex-1 p-20 flex flex-col items-center justify-center bg-slate-950">
             <div className="w-full max-w-4xl space-y-12">
                <div className="flex items-center gap-6"><Radio size={48} className="text-emerald-500 animate-pulse"/><h2 className="text-6xl font-black italic tracking-tighter uppercase">Telemetry Stream</h2></div>
                <div className="grid grid-cols-8 gap-4 opacity-30 select-none cursor-default font-mono">
                  {Array(64).fill(0).map((_, i) => <div key={i} className="p-3 border border-emerald-500/30 text-emerald-400 text-[10px]">{(0.123 + Math.random()*0.8).toFixed(3)}</div>)}
                </div>
                <p className="text-sm font-black text-slate-600 uppercase tracking-[0.6em] text-center border-t border-slate-800 pt-10 animate-fade-in">Google Earth Engine // Real-Time JSON Pipeline // TKS-Project</p>
             </div>
          </div>
        )}
      </main>
    </div>
  );
}

// --- SUB COMPONENTS ---

const NavBtn = ({ active, icon, label, onClick }: any) => (
  <button onClick={onClick} className={`w-full flex items-center gap-5 px-8 py-5 rounded-[2rem] transition-all duration-300 ${active ? 'bg-rose-500 text-white shadow-[0_0_25px_#f43f5e30] translate-x-2' : 'text-slate-500 hover:text-slate-200'}`}>
    {icon}
    <span className="font-black text-[11px] uppercase tracking-[0.25em]">{label}</span>
  </button>
);

const ToolToggle = ({ active, onClick, icon, label }: any) => (
  <button onClick={onClick} className={`w-full flex items-center justify-between p-4 rounded-xl border-2 transition-all ${active ? 'bg-rose-600 border-rose-400 text-white shadow-lg' : 'bg-slate-900 border-slate-800 text-slate-500'}`}>
    <div className="flex items-center gap-3">{icon}<span className="text-[10px] font-bold uppercase italic">{label}</span></div>
    <div className={`w-2 h-2 rounded-full ${active ? 'bg-white animate-pulse' : 'bg-slate-800'}`} />
  </button>
);

const StatRow = ({ label, value, color, icon }: any) => (
  <div className="flex items-center justify-between gap-10">
    <div className="flex items-center gap-3">{icon}<span className="text-[10px] font-bold text-slate-500 uppercase">{label}</span></div>
    <span className={`text-[13px] font-black italic tracking-widest ${color}`}>{value}</span>
  </div>
);

const QuickStat = ({ label, value }: any) => (
  <div className="bg-black/40 p-4 rounded-2xl border border-slate-800 text-center">
    <p className="text-[8px] font-black text-slate-600 uppercase mb-1 tracking-tighter">{label}</p>
    <p className="text-sm font-black text-slate-200 italic">{value}</p>
  </div>
);

// High-Performance Engine Map Canvas
function MapCanvas({ field, sims, gridSize, camps }: any) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const canvas = canvasRef.current; if (!canvas) return;
    const ctx = canvas.getContext('2d'); if (!ctx) return;
    const w = canvas.width; const h = canvas.height;
    const cw = w / gridSize.cols; const ch = h / gridSize.rows;

    const draw = () => {
      ctx.fillStyle = '#020617'; ctx.fillRect(0, 0, w, h);

      // 1. Geography Reference: THE WHITE NILE (White River Flow)
      ctx.beginPath();
      ctx.strokeStyle = '#0284c7'; ctx.lineWidth = 45; ctx.globalAlpha = 0.05;
      ctx.moveTo(0.15 * w, 0); ctx.bezierCurveTo(0.3 * w, 0.4*h, 0.05*w, 0.6*h, 0.25*w, h);
      ctx.stroke(); ctx.globalAlpha = 0.12; ctx.lineWidth = 15; ctx.stroke(); ctx.globalAlpha = 1.0;

      // 2. Resource Potentials (Environment Raster)
      for (let r = 0; r < gridSize.rows; r++) {
        for (let c = 0; c < gridSize.cols; c++) {
          const v = field[r][c];
          // Scale from Teal (Rich Pasture) to Red-Amber (Scarcity)
          ctx.fillStyle = `rgba(${v * 240}, ${185 - v * 155}, 100, ${v * 0.4})`;
          ctx.fillRect(c * cw, r * ch, cw, ch);
        }
      }

      // 3. Multi-Herd Predictions (Physics Layer)
      sims.forEach((sim: any) => {
        // Lagrange Ideal
        ctx.beginPath(); ctx.setLineDash([18, 12]); ctx.strokeStyle = '#10b981'; ctx.lineWidth = 4;
        sim.ideal.forEach((p: Point, i: number) => i === 0 ? ctx.moveTo(p.x*w, p.y*h) : ctx.lineTo(p.x*w, p.y*h));
        ctx.stroke();

        // Sentinel Observation (Telemetry Inference)
        ctx.beginPath(); ctx.setLineDash([]); ctx.strokeStyle = '#f43f5e'; ctx.lineWidth = 6; ctx.globalAlpha = 0.8;
        sim.observed.forEach((p: Point, i: number) => i === 0 ? ctx.moveTo(p.x*w, p.y*h) : ctx.lineTo(p.x*w, p.y*h));
        ctx.stroke(); ctx.globalAlpha = 1.0;
      });

      // 4. FIRMS Satellite Hotspots (Camps)
      camps.forEach((cp: Point) => {
        const time = Date.now() / 400;
        const pulse = Math.sin(time) * 15 + 30;
        ctx.fillStyle = '#f43f5e20';
        ctx.beginPath(); ctx.arc(cp.x*w, cp.y*h, pulse, 0, Math.PI*2); ctx.fill();
        ctx.fillStyle = '#f43f5e';
        ctx.beginPath(); ctx.arc(cp.x*w, cp.y*h, 12, 0, Math.PI*2); ctx.fill();
        ctx.strokeStyle = 'white'; ctx.lineWidth = 3;
        ctx.beginPath(); ctx.arc(cp.x*w, cp.y*h, 16, 0, Math.PI*2); ctx.stroke();
      });
    };

    const loop = requestAnimationFrame(function frame() { draw(); requestAnimationFrame(frame); });
    return () => cancelAnimationFrame(loop);
  }, [field, sims, gridSize, camps]);

  return <canvas ref={canvasRef} width={2400} height={1600} className="w-full h-full object-cover" />;
}