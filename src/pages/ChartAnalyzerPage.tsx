import React, { useCallback, useRef, useState } from 'react';
import { Navbar } from '@/components/layout/Navbar';
import { TickerTape } from '@/components/layout/TickerTape';
import { AmbientBackground } from '@/components/effects/AmbientBackground';
import { UpgradeBanner } from '@/components/subscription/UpgradeBanner';
import { VIPGateModal } from '@/components/subscription/VIPGateModal';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { useAuth } from '@/context/AuthContext';
import { Link } from 'react-router-dom';
import { toast } from 'sonner';
import {
  ScanEye,
  UploadCloud,
  Sparkles,
  Image as ImageIcon,
  TrendingUp,
  TrendingDown,
  Minus,
  Target,
  ShieldAlert,
  Ruler,
  Layers,
  Download,
  Copy,
  BookMarked,
  Loader2,
  X,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  Crosshair,
} from 'lucide-react';
import {
  analyzeChartImage,
  renderAnnotatedChart,
  buildAnalysisText,
  paperTradeInputFromAnalysis,
  formatPrice,
  ChartAnalysis,
} from '@/services/chartAnalysisService';
import { addPaperTradeManual, hasOpenTradeForSymbol } from '@/services/paperTradingService';

const MAX_MB = 8;

const ChartAnalyzerPage: React.FC = () => {
  const { isVipMember } = useAuth();

  const [imageDataUrl, setImageDataUrl] = useState<string | null>(null);
  const [annotated, setAnnotated] = useState<string | null>(null);
  const [analysis, setAnalysis] = useState<ChartAnalysis | null>(null);
  const [pair, setPair] = useState('');
  const [timeframe, setTimeframe] = useState('');
  const [notes, setNotes] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [dragging, setDragging] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const readFile = useCallback((file: File) => {
    if (!file.type.startsWith('image/')) {
      toast.error('Please upload an image (PNG, JPG, or WEBP).');
      return;
    }
    if (file.size > MAX_MB * 1024 * 1024) {
      toast.error(`Image is too large — keep it under ${MAX_MB}MB.`);
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      setImageDataUrl(reader.result as string);
      setAnalysis(null);
      setAnnotated(null);
      setError(null);
    };
    reader.onerror = () => toast.error('Could not read that file. Try another screenshot.');
    reader.readAsDataURL(file);
  }, []);

  const onDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setDragging(false);
      const file = e.dataTransfer.files?.[0];
      if (file) readFile(file);
    },
    [readFile],
  );

  const onPaste = useCallback(
    (e: React.ClipboardEvent) => {
      const item = Array.from(e.clipboardData.items).find((i) => i.type.startsWith('image/'));
      if (item) {
        const file = item.getAsFile();
        if (file) readFile(file);
      }
    },
    [readFile],
  );

  const runAnalysis = async () => {
    if (!imageDataUrl) {
      toast.error('Upload a chart screenshot first.');
      return;
    }
    setLoading(true);
    setError(null);
    setAnalysis(null);
    setAnnotated(null);
    try {
      const result = await analyzeChartImage(imageDataUrl, { pair, timeframe, notes });
      setAnalysis(result);
      try {
        const overlay = await renderAnnotatedChart(imageDataUrl, result);
        setAnnotated(overlay);
      } catch {
        // Overlay is a bonus; the text read still stands if canvas fails.
        setAnnotated(null);
      }
      toast.success(`Analysis ready — ${result.bias} bias at ${result.confidence}% confidence.`);
    } catch (e: any) {
      setError(e?.message ?? 'Analysis failed. Please try again.');
      toast.error('Chart analysis failed.');
    } finally {
      setLoading(false);
    }
  };

  const takePaperTrade = () => {
    if (!analysis) return;
    try {
      const input = paperTradeInputFromAnalysis(analysis);
      if (hasOpenTradeForSymbol(input.symbol)) {
        toast.info(`You already have an open paper trade on ${input.symbol}. Check your Journal.`);
        return;
      }
      addPaperTradeManual(input);
      toast.success(`📝 Paper trade opened: ${input.type} ${input.pair}. Track it in your Journal.`);
    } catch (e: any) {
      toast.error(e?.message ?? 'Could not open a paper trade from this analysis.');
    }
  };

  const copyText = async () => {
    if (!analysis) return;
    try {
      await navigator.clipboard.writeText(buildAnalysisText(analysis));
      toast.success('Full analysis copied to clipboard.');
    } catch {
      toast.error('Could not copy — your browser blocked clipboard access.');
    }
  };

  const downloadAnnotated = () => {
    if (!annotated) return;
    const a = document.createElement('a');
    a.href = annotated;
    a.download = `cotraders-analysis-${analysis?.pair?.replace(/[^A-Za-z0-9]/g, '') || 'chart'}.png`;
    a.click();
  };

  const clearImage = () => {
    setImageDataUrl(null);
    setAnalysis(null);
    setAnnotated(null);
    setError(null);
    if (fileRef.current) fileRef.current.value = '';
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 font-sans pb-16 md:pb-0" onPaste={onPaste}>
      <AmbientBackground />
      <TickerTape />
      <Navbar />

      <main className="relative z-10 max-w-7xl mx-auto px-4 lg:px-8 py-8">
        <UpgradeBanner />

        <div className="mb-6 animate-fade-up">
          <h1 className="text-3xl font-black text-slate-100 flex items-center gap-2 text-shimmer">
            <ScanEye className="h-7 w-7 text-violet-400" />
            AI Chart Screenshot Analysis
          </h1>
          <p className="text-sm text-slate-400 mt-1 max-w-3xl">
            Upload any chart screenshot. The AI reads the strategies in play, marks support &amp; resistance,
            detects the trade taken, applies Fibonacci, returns a full written breakdown with an annotated
            image — and lets you open a risk-free paper trade from it.
          </p>
        </div>

        {!isVipMember ? (
          <VIPGateModal
            title="AI Chart Analysis is a VIP Feature"
            description="Upgrade to VIP to upload chart screenshots and get instant AI strategy detection, support/resistance, Fibonacci, the detected trade, an annotated image, and one-tap paper trades."
          />
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
            {/* LEFT — uploader + controls */}
            <div className="lg:col-span-2 space-y-4">
              <div
                onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
                onDragLeave={() => setDragging(false)}
                onDrop={onDrop}
                onClick={() => fileRef.current?.click()}
                className={`glass-panel glass-panel-interactive rounded-2xl p-6 text-center cursor-pointer border-2 border-dashed transition-colors ${
                  dragging ? 'border-violet-400 bg-violet-500/10' : 'border-white/10'
                }`}
              >
                {imageDataUrl ? (
                  <div className="relative">
                    <img src={imageDataUrl} alt="chart to analyze" className="rounded-xl w-full object-contain max-h-72 mx-auto" />
                    <button
                      onClick={(e) => { e.stopPropagation(); clearImage(); }}
                      className="absolute -top-2 -right-2 h-7 w-7 rounded-full bg-rose-500 text-white flex items-center justify-center shadow-lg hover:bg-rose-400"
                      title="Remove image"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  </div>
                ) : (
                  <div className="py-8">
                    <div className="h-14 w-14 rounded-2xl bg-violet-500/15 border border-violet-500/30 flex items-center justify-center mx-auto mb-4">
                      <UploadCloud className="h-7 w-7 text-violet-300" />
                    </div>
                    <p className="font-bold text-slate-200">Drop a chart screenshot here</p>
                    <p className="text-xs text-slate-400 mt-1">or click to browse · paste with Ctrl/Cmd+V · PNG, JPG, WEBP up to {MAX_MB}MB</p>
                  </div>
                )}
                <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={(e) => e.target.files?.[0] && readFile(e.target.files[0])} />
              </div>

              <div className="glass-panel rounded-2xl p-5 space-y-3">
                <p className="text-xs font-bold text-slate-300 flex items-center gap-2">
                  <Sparkles className="h-4 w-4 text-violet-400" /> Optional context (improves accuracy)
                </p>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-[11px] text-slate-400 font-semibold">Pair</label>
                    <Input value={pair} onChange={(e) => setPair(e.target.value)} placeholder="BTC/USDT" className="mt-1 bg-slate-900 border-slate-800 text-xs font-mono text-slate-100 focus:border-violet-500" />
                  </div>
                  <div>
                    <label className="text-[11px] text-slate-400 font-semibold">Timeframe</label>
                    <Input value={timeframe} onChange={(e) => setTimeframe(e.target.value)} placeholder="15m / 1h / 4h" className="mt-1 bg-slate-900 border-slate-800 text-xs font-mono text-slate-100 focus:border-violet-500" />
                  </div>
                </div>
                <div>
                  <label className="text-[11px] text-slate-400 font-semibold">Notes for the AI</label>
                  <textarea
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    rows={2}
                    placeholder="e.g. I'm looking for a long scalp / did I enter too early?"
                    className="mt-1 w-full rounded-lg bg-slate-900 border border-slate-800 text-xs text-slate-100 focus:border-violet-500 focus:outline-none p-2 resize-none"
                  />
                </div>

                <Button
                  onClick={runAnalysis}
                  disabled={loading || !imageDataUrl}
                  className="w-full btn-glow text-white font-black gap-2 rounded-xl h-11 disabled:opacity-50"
                >
                  {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <ScanEye className="h-4 w-4" />}
                  {loading ? 'Analyzing chart…' : 'Analyze Chart with AI'}
                </Button>
              </div>
            </div>

            {/* RIGHT — results */}
            <div className="lg:col-span-3 space-y-5">
              {error && (
                <div className="glass-panel rounded-2xl p-6 border border-amber-500/30">
                  <div className="flex items-start gap-3">
                    <AlertTriangle className="h-6 w-6 text-amber-400 shrink-0 mt-0.5" />
                    <div>
                      <p className="font-bold text-slate-100">Couldn't analyze this chart</p>
                      <p className="text-sm text-slate-300 mt-1">{error}</p>
                    </div>
                  </div>
                </div>
              )}

              {!analysis && !error && !loading && (
                <div className="glass-panel rounded-2xl p-10 text-center text-slate-400">
                  <ImageIcon className="h-10 w-10 mx-auto mb-3 text-slate-600" />
                  <p className="font-bold text-slate-300">Your AI breakdown will appear here</p>
                  <p className="text-xs mt-1">Strategies · support/resistance · Fibonacci · the detected trade · an annotated image</p>
                </div>
              )}

              {loading && (
                <div className="glass-panel rounded-2xl p-10 text-center">
                  <Loader2 className="h-10 w-10 mx-auto mb-3 text-violet-400 animate-spin" />
                  <p className="font-bold text-slate-200">Reading your chart…</p>
                  <p className="text-xs text-slate-400 mt-1">Detecting structure, levels, Fibonacci and the trade setup.</p>
                </div>
              )}

              {analysis && <AnalysisResult analysis={analysis} annotated={annotated} onPaperTrade={takePaperTrade} onCopy={copyText} onDownload={downloadAnnotated} />}
            </div>
          </div>
        )}
      </main>
    </div>
  );
};

// ---------------------------------------------------------------------------

const BiasBadge: React.FC<{ bias: ChartAnalysis['bias']; confidence: number }> = ({ bias, confidence }) => {
  const style =
    bias === 'LONG'
      ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40'
      : bias === 'SHORT'
        ? 'bg-rose-500/20 text-rose-300 border-rose-500/40'
        : 'bg-slate-700/40 text-slate-300 border-slate-600/50';
  const Icon = bias === 'LONG' ? TrendingUp : bias === 'SHORT' ? TrendingDown : Minus;
  return (
    <Badge className={`gap-1.5 text-sm px-3 py-1 font-black ${style}`}>
      <Icon className="h-4 w-4" /> {bias} · {confidence}%
    </Badge>
  );
};

const AnalysisResult: React.FC<{
  analysis: ChartAnalysis;
  annotated: string | null;
  onPaperTrade: () => void;
  onCopy: () => void;
  onDownload: () => void;
}> = ({ analysis, annotated, onPaperTrade, onCopy, onDownload }) => {
  const t = analysis.detectedTrade;
  const canTrade = t.direction !== 'NONE' && !!t.entry && !!t.stopLoss;

  return (
    <div className="space-y-5 scene-3d">
      {/* Header + annotated image */}
      <div className="glass-panel card-3d rounded-2xl p-5">
        <div className="flex items-center justify-between flex-wrap gap-3 mb-4">
          <div>
            <p className="text-lg font-black text-slate-100">{analysis.pair} <span className="text-slate-500 text-sm font-mono">· {analysis.timeframe}</span></p>
            <p className="text-xs text-slate-400">AI-estimated read · educational only</p>
          </div>
          <BiasBadge bias={analysis.bias} confidence={analysis.confidence} />
        </div>

        {annotated ? (
          <div className="relative">
            <img src={annotated} alt="annotated chart" className="rounded-xl w-full border border-white/10" />
            <Button onClick={onDownload} size="sm" className="absolute top-3 right-3 bg-slate-900/80 backdrop-blur text-slate-100 hover:bg-slate-800 gap-1.5 text-xs font-bold">
              <Download className="h-3.5 w-3.5" /> PNG
            </Button>
          </div>
        ) : null}

        <p className="text-sm text-slate-200 leading-relaxed mt-4">{analysis.summary}</p>
      </div>

      {/* Detected trade */}
      <div className="glass-panel card-3d rounded-2xl p-5">
        <div className="flex items-center justify-between mb-3">
          <p className="font-black text-slate-100 flex items-center gap-2">
            <Crosshair className="h-4.5 w-4.5 text-violet-400" /> Detected Trade
          </p>
          {canTrade && (
            <Button onClick={onPaperTrade} size="sm" className="btn-glow text-white font-black gap-1.5 text-xs rounded-lg">
              <BookMarked className="h-3.5 w-3.5" /> Take Paper Trade
            </Button>
          )}
        </div>

        {t.direction === 'NONE' ? (
          <p className="text-sm text-slate-400">No clean trade setup was detected on this chart — treat it as observation only.</p>
        ) : (
          <>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <Stat label="Direction" value={t.direction} tone={t.direction === 'LONG' ? 'emerald' : 'rose'} />
              <Stat label="Entry" value={t.entry ? formatPrice(t.entry) : '—'} icon={<Target className="h-3.5 w-3.5" />} />
              <Stat label="Stop Loss" value={t.stopLoss ? formatPrice(t.stopLoss) : '—'} tone="rose" icon={<ShieldAlert className="h-3.5 w-3.5" />} />
              <Stat label="Targets" value={t.targets.length ? t.targets.map((x) => formatPrice(x.price)).join(' / ') : '—'} tone="emerald" />
            </div>
            {t.rationale && <p className="text-xs text-slate-400 mt-3 leading-relaxed">{t.rationale}</p>}
            {!canTrade && (
              <p className="text-[11px] text-amber-400/80 mt-3">A clear entry &amp; stop are needed to open a paper trade from this read.</p>
            )}
          </>
        )}
      </div>

      {/* Strategies */}
      {analysis.strategies.length > 0 && (
        <div className="glass-panel card-3d rounded-2xl p-5">
          <p className="font-black text-slate-100 flex items-center gap-2 mb-3">
            <Layers className="h-4.5 w-4.5 text-cyan-400" /> Strategies &amp; Patterns
          </p>
          <div className="space-y-2">
            {analysis.strategies.map((s, i) => (
              <div key={i} className="flex items-start gap-2.5">
                {s.applied ? (
                  <CheckCircle2 className="h-4 w-4 text-emerald-400 mt-0.5 shrink-0" />
                ) : (
                  <XCircle className="h-4 w-4 text-slate-600 mt-0.5 shrink-0" />
                )}
                <div>
                  <span className={`text-sm font-bold ${s.applied ? 'text-slate-100' : 'text-slate-500'}`}>{s.name}</span>
                  {s.note && <span className="text-xs text-slate-400"> — {s.note}</span>}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Support / Resistance */}
      {(analysis.supportLevels.length > 0 || analysis.resistanceLevels.length > 0) && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
          <LevelCard title="Support" tone="emerald" levels={analysis.supportLevels} />
          <LevelCard title="Resistance" tone="rose" levels={analysis.resistanceLevels} />
        </div>
      )}

      {/* Fibonacci */}
      {analysis.fibonacci && analysis.fibonacci.levels.length > 0 && (
        <div className="glass-panel card-3d rounded-2xl p-5">
          <p className="font-black text-slate-100 flex items-center gap-2 mb-3">
            <Ruler className="h-4.5 w-4.5 text-amber-400" /> Fibonacci
            <span className="text-xs font-normal text-slate-400">
              ({analysis.fibonacci.direction === 'up' ? 'swing low → high' : 'swing high → low'})
            </span>
          </p>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
            {analysis.fibonacci.levels.map((l, i) => (
              <div key={i} className="flex items-center justify-between px-3 py-2 rounded-lg bg-slate-900/60 border border-white/[0.06]">
                <span className="text-xs font-mono text-amber-300">{l.label}</span>
                <span className="text-xs font-mono text-slate-200">{formatPrice(l.price)}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Actions */}
      <div className="flex flex-wrap gap-3">
        <Button onClick={onCopy} variant="outline" className="gap-2 text-xs font-bold border-slate-700 text-slate-200">
          <Copy className="h-4 w-4" /> Copy full analysis
        </Button>
        <Link to="/journal">
          <Button variant="outline" className="gap-2 text-xs font-bold border-slate-700 text-slate-200">
            <BookMarked className="h-4 w-4 text-emerald-400" /> Open Paper Journal
          </Button>
        </Link>
      </div>

      <p className="text-[11px] text-slate-500 text-center">{analysis.disclaimer}</p>
    </div>
  );
};

const Stat: React.FC<{ label: string; value: string; tone?: 'emerald' | 'rose' | 'default'; icon?: React.ReactNode }> = ({ label, value, tone = 'default', icon }) => {
  const color = tone === 'emerald' ? 'text-emerald-300' : tone === 'rose' ? 'text-rose-300' : 'text-slate-100';
  return (
    <div className="rounded-xl bg-slate-900/60 border border-white/[0.06] px-3 py-2.5">
      <p className="text-[10px] uppercase tracking-wider text-slate-500 font-bold flex items-center gap-1">{icon}{label}</p>
      <p className={`text-sm font-black font-mono mt-0.5 ${color}`}>{value}</p>
    </div>
  );
};

const LevelCard: React.FC<{ title: string; tone: 'emerald' | 'rose'; levels: ChartAnalysis['supportLevels'] }> = ({ title, tone, levels }) => {
  const color = tone === 'emerald' ? 'text-emerald-300' : 'text-rose-300';
  const Icon = tone === 'emerald' ? TrendingUp : TrendingDown;
  return (
    <div className="glass-panel card-3d rounded-2xl p-5">
      <p className={`font-black flex items-center gap-2 mb-3 ${color}`}>
        <Icon className="h-4.5 w-4.5" /> {title}
      </p>
      {levels.length === 0 ? (
        <p className="text-xs text-slate-500">None detected.</p>
      ) : (
        <div className="space-y-2">
          {levels.map((l, i) => (
            <div key={i} className="flex items-center justify-between px-3 py-2 rounded-lg bg-slate-900/60 border border-white/[0.06]">
              <span className={`text-sm font-mono font-bold ${color}`}>{formatPrice(l.price)}</span>
              {l.note && <span className="text-[11px] text-slate-400 truncate ml-2 max-w-[60%] text-right">{l.note}</span>}
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default ChartAnalyzerPage;
