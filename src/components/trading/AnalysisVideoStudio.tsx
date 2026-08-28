import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Video, Loader2, Play, Square, Download, AlertTriangle, Radio, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Signal, SignalAnalysis, CandleData } from '@/types/trading';
import { analyzeSymbolLive, ScanTarget } from '@/services/signalEngine';
import { buildScenes, Scene, totalDuration } from '@/services/analysisVideoService';
import { toast } from 'sonner';

const W = 960;
const H = 540;

const COLORS = {
  bg: '#0b1220',
  panel: '#111c31',
  grid: '#1e2b45',
  text: '#e8eef8',
  dim: '#93a4bf',
  ok: '#10b981',
  bad: '#f43f5e',
  accent: '#6366f1',
  cyan: '#22d3ee',
};

/** Word-wraps a line to a pixel width and returns the wrapped rows. */
function wrap(ctx: CanvasRenderingContext2D, text: string, maxW: number): string[] {
  const words = text.split(' ');
  const rows: string[] = [];
  let cur = '';
  for (const w of words) {
    const test = cur ? `${cur} ${w}` : w;
    if (ctx.measureText(test).width > maxW && cur) {
      rows.push(cur);
      cur = w;
    } else {
      cur = test;
    }
  }
  if (cur) rows.push(cur);
  return rows;
}

function drawCandles(ctx: CanvasRenderingContext2D, candles: CandleData[], signal: Signal | null, box: { x: number; y: number; w: number; h: number }) {
  if (candles.length === 0) return;
  const levels = signal ? [signal.entryPrice, signal.stopLoss, signal.target1] : [];
  const highs = candles.map(c => c.high).concat(levels);
  const lows = candles.map(c => c.low).concat(levels);
  const max = Math.max(...highs);
  const min = Math.min(...lows);
  const span = max - min || 1;
  const toY = (p: number) => box.y + box.h - ((p - min) / span) * box.h;
  const cw = box.w / candles.length;

  ctx.strokeStyle = COLORS.grid;
  ctx.lineWidth = 1;
  for (let g = 0; g <= 4; g++) {
    const y = box.y + (box.h / 4) * g;
    ctx.beginPath(); ctx.moveTo(box.x, y); ctx.lineTo(box.x + box.w, y); ctx.stroke();
  }

  candles.forEach((c, idx) => {
    const x = box.x + idx * cw + cw / 2;
    const up = c.close >= c.open;
    ctx.strokeStyle = up ? COLORS.ok : COLORS.bad;
    ctx.fillStyle = up ? COLORS.ok : COLORS.bad;
    ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(x, toY(c.high)); ctx.lineTo(x, toY(c.low)); ctx.stroke();
    const bodyTop = toY(Math.max(c.open, c.close));
    const bodyH = Math.max(1, Math.abs(toY(c.open) - toY(c.close)));
    ctx.fillRect(x - Math.max(1, cw * 0.3), bodyTop, Math.max(1.5, cw * 0.6), bodyH);
  });

  if (signal) {
    const marks: { p: number; label: string; color: string }[] = [
      { p: signal.entryPrice, label: `Entry ${signal.entryPrice}`, color: COLORS.cyan },
      { p: signal.stopLoss, label: `Stop ${signal.stopLoss}`, color: COLORS.bad },
      { p: signal.target1, label: `TP1 ${signal.target1}`, color: COLORS.ok },
    ];
    ctx.font = '600 12px system-ui, sans-serif';
    for (const m of marks) {
      const y = toY(m.p);
      ctx.strokeStyle = m.color;
      ctx.setLineDash([6, 4]);
      ctx.lineWidth = 1.5;
      ctx.beginPath(); ctx.moveTo(box.x, y); ctx.lineTo(box.x + box.w, y); ctx.stroke();
      ctx.setLineDash([]);
      ctx.fillStyle = m.color;
      ctx.fillText(m.label, box.x + 6, y - 5);
    }
  }
}

/** Draws a single frame of the video at time `t` ms into the script. */
function drawFrame(
  ctx: CanvasRenderingContext2D,
  scenes: Scene[],
  analysis: SignalAnalysis,
  signal: Signal | null,
  t: number,
) {
  // Which scene are we in, and how far through it?
  let acc = 0;
  let idx = 0;
  for (let s = 0; s < scenes.length; s++) {
    if (t < acc + scenes[s].durationMs) { idx = s; break; }
    acc += scenes[s].durationMs;
    idx = s;
  }
  const scene = scenes[idx];
  const local = Math.max(0, t - acc);
  const total = totalDuration(scenes);

  // Background
  ctx.fillStyle = COLORS.bg;
  ctx.fillRect(0, 0, W, H);

  // Header
  ctx.fillStyle = COLORS.panel;
  ctx.fillRect(0, 0, W, 62);
  ctx.fillStyle = COLORS.accent;
  ctx.fillRect(0, 60, W, 2);
  ctx.font = '800 20px system-ui, sans-serif';
  ctx.fillStyle = COLORS.text;
  ctx.fillText('COTRADERS · LIVE SIGNAL ANALYSIS', 24, 30);
  ctx.font = '500 12px system-ui, sans-serif';
  ctx.fillStyle = COLORS.dim;
  ctx.fillText(
    `${analysis.pair} · ${analysis.mode} · ${analysis.baseTimeframe} · analysed ${new Date(analysis.takenAt).toLocaleString()}`,
    24, 48,
  );
  // Live badge
  ctx.fillStyle = COLORS.bad;
  ctx.beginPath(); ctx.arc(W - 92, 26, 5, 0, Math.PI * 2); ctx.fill();
  ctx.font = '700 12px system-ui, sans-serif';
  ctx.fillStyle = COLORS.text;
  ctx.fillText('LIVE DATA', W - 80, 30);

  // Scene title
  ctx.font = '800 26px system-ui, sans-serif';
  ctx.fillStyle = scene.kind === 'VERDICT'
    ? (analysis.verdict === 'TRADE' ? COLORS.ok : COLORS.bad)
    : COLORS.text;
  ctx.fillText(scene.title, 24, 108);
  ctx.font = '500 13px system-ui, sans-serif';
  ctx.fillStyle = COLORS.dim;
  wrap(ctx, scene.subtitle, W - 48).slice(0, 2).forEach((row, r) => ctx.fillText(row, 24, 130 + r * 18));

  const bodyTop = 170;

  if (scene.kind === 'CHART' && analysis.candles && analysis.candles.length) {
    drawCandles(ctx, analysis.candles, signal, { x: 24, y: bodyTop, w: W - 340, h: 300 });
    // Level list on the right
    ctx.font = '600 13px system-ui, sans-serif';
    let y = bodyTop + 6;
    for (const line of scene.lines) {
      ctx.fillStyle = line.ok === true ? COLORS.ok : line.ok === false ? COLORS.bad : COLORS.text;
      for (const row of wrap(ctx, line.text, 280)) {
        ctx.fillText(row, W - 300, y);
        y += 18;
      }
      y += 6;
    }
  } else {
    // Typed-in reveal: lines appear progressively across the scene so the video
    // reads like a walkthrough rather than a static slide.
    const perLine = scene.lines.length > 0 ? scene.durationMs / scene.lines.length : scene.durationMs;
    const revealed = Math.min(scene.lines.length, Math.floor(local / perLine) + 1);
    ctx.font = '600 15px system-ui, sans-serif';
    let y = bodyTop;
    scene.lines.slice(0, revealed).forEach((line) => {
      const color = line.ok === true ? COLORS.ok : line.ok === false ? COLORS.bad : COLORS.text;
      const marker = line.ok === true ? '✓' : line.ok === false ? '✗' : '•';
      ctx.fillStyle = color;
      ctx.fillText(marker, 26, y);
      for (const row of wrap(ctx, line.text, W - 90)) {
        ctx.fillStyle = color;
        ctx.fillText(row, 50, y);
        y += 22;
      }
      y += 8;
    });
  }

  // Footer: scene chips + progress bar
  ctx.font = '700 11px system-ui, sans-serif';
  let cx = 24;
  scenes.forEach((s, i) => {
    const label = s.kind;
    const w = ctx.measureText(label).width + 16;
    ctx.fillStyle = i === idx ? COLORS.accent : COLORS.panel;
    ctx.fillRect(cx, H - 58, w, 20);
    ctx.fillStyle = i === idx ? '#ffffff' : COLORS.dim;
    ctx.fillText(label, cx + 8, H - 44);
    cx += w + 6;
  });
  ctx.fillStyle = COLORS.panel;
  ctx.fillRect(24, H - 26, W - 48, 6);
  ctx.fillStyle = COLORS.cyan;
  ctx.fillRect(24, H - 26, Math.max(0, Math.min(1, t / total)) * (W - 48), 6);
}

interface Props {
  /** Pre-fill the studio from a signal card ("watch the analysis for THIS signal"). */
  initialSymbol?: string;
  initialPair?: string;
  initialMode?: 'SCALP' | 'SWING';
  /** Start analysing immediately on mount (used when opened from a signal). */
  autoRun?: boolean;
}

export const AnalysisVideoStudio: React.FC<Props> = ({
  initialSymbol = 'BTCUSDT',
  initialPair,
  initialMode = 'SCALP',
  autoRun = false,
}) => {
  const [symbol, setSymbol] = useState(initialSymbol.toUpperCase());
  const [mode, setMode] = useState<'SCALP' | 'SWING'>(initialMode);
  const [analyzing, setAnalyzing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [analysis, setAnalysis] = useState<SignalAnalysis | null>(null);
  const [signal, setSignal] = useState<Signal | null>(null);
  const [playing, setPlaying] = useState(false);
  const [recording, setRecording] = useState(false);
  const [videoUrl, setVideoUrl] = useState<string | null>(null);

  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const rafRef = useRef<number | null>(null);
  const startRef = useRef<number>(0);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const mounted = useRef(true);

  const scenes: Scene[] = useMemo(
    () => (analysis ? buildScenes(analysis, signal) : []),
    [analysis, signal],
  );
  const duration = useMemo(() => totalDuration(scenes), [scenes]);

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      if (recorderRef.current && recorderRef.current.state !== 'inactive') recorderRef.current.stop();
    };
  }, []);

  // Revoke the previous blob URL when a new video replaces it.
  useEffect(() => () => { if (videoUrl) URL.revokeObjectURL(videoUrl); }, [videoUrl]);

  const paint = useCallback((t: number) => {
    const canvas = canvasRef.current;
    if (!canvas || !analysis || scenes.length === 0) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    drawFrame(ctx, scenes, analysis, signal, t);
  }, [analysis, scenes, signal]);

  // Draw the opening frame as soon as an analysis lands.
  useEffect(() => { if (analysis) paint(0); }, [analysis, paint]);

  const stopLoop = useCallback(() => {
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    rafRef.current = null;
    setPlaying(false);
  }, []);

  const runLoop = useCallback((onEnd?: () => void) => {
    startRef.current = performance.now();
    const tick = () => {
      if (!mounted.current) return;
      const t = performance.now() - startRef.current;
      paint(Math.min(t, duration));
      if (t >= duration) {
        rafRef.current = null;
        setPlaying(false);
        onEnd?.();
        return;
      }
      rafRef.current = requestAnimationFrame(tick);
    };
    setPlaying(true);
    rafRef.current = requestAnimationFrame(tick);
  }, [duration, paint]);

  const analyse = useCallback(async (sym?: string, m?: 'SCALP' | 'SWING') => {
    const s = (sym ?? symbol).trim().toUpperCase();
    const useMode = m ?? mode;
    if (!s) return;
    stopLoop();
    setAnalyzing(true);
    setError(null);
    setAnalysis(null);
    setSignal(null);
    setVideoUrl(null);
    try {
      const target: ScanTarget = {
        symbol: s,
        pair: initialPair && s === initialSymbol.toUpperCase() ? initialPair : s.replace('USDT', '/USDT'),
        mode: useMode,
        isScalp: useMode === 'SCALP',
      };
      const res = await analyzeSymbolLive(target);
      if (!mounted.current) return;
      setAnalysis(res.analysis);
      setSignal(res.signal);
      if (res.analysis.verdict === 'TRADE') toast.success(`${s}: qualified ${res.analysis.direction} setup`);
      else toast.message(`${s}: no trade — ${res.analysis.rejectionReason ?? 'failed a check'}`);
    } catch (e) {
      if (!mounted.current) return;
      console.error('[AnalysisVideoStudio] analysis failed:', e);
      setError('Could not fetch live market data for that symbol. Check the symbol and try again.');
    } finally {
      if (mounted.current) setAnalyzing(false);
    }
  }, [symbol, mode, stopLoop, initialPair, initialSymbol]);

  useEffect(() => { if (autoRun) analyse(initialSymbol, initialMode); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, []);

  const record = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas || !analysis || scenes.length === 0) return;
    if (typeof MediaRecorder === 'undefined' || !canvas.captureStream) {
      toast.error('This browser cannot record canvas video. Use Play to watch the analysis instead.');
      return;
    }
    try {
      const stream = canvas.captureStream(30);
      const mime = ['video/webm;codecs=vp9', 'video/webm;codecs=vp8', 'video/webm']
        .find(m => MediaRecorder.isTypeSupported(m)) ?? '';
      const rec = new MediaRecorder(stream, mime ? { mimeType: mime } : undefined);
      chunksRef.current = [];
      rec.ondataavailable = (e) => { if (e.data.size > 0) chunksRef.current.push(e.data); };
      rec.onstop = () => {
        const blob = new Blob(chunksRef.current, { type: 'video/webm' });
        const url = URL.createObjectURL(blob);
        if (mounted.current) {
          setVideoUrl(url);
          setRecording(false);
          toast.success('Analysis video ready to download.');
        }
      };
      recorderRef.current = rec;
      rec.start();
      setRecording(true);
      runLoop(() => { if (rec.state !== 'inactive') rec.stop(); });
    } catch (e) {
      console.error('[AnalysisVideoStudio] recording failed:', e);
      setRecording(false);
      toast.error('Recording failed in this browser. You can still watch the analysis with Play.');
    }
  }, [analysis, scenes.length, runLoop]);

  const stopRecording = useCallback(() => {
    stopLoop();
    if (recorderRef.current && recorderRef.current.state !== 'inactive') recorderRef.current.stop();
  }, [stopLoop]);

  const verdictBadge = analysis
    ? analysis.verdict === 'TRADE'
      ? <Badge className="bg-emerald-100 text-emerald-700 border-emerald-200">TRADE · {analysis.direction}</Badge>
      : <Badge className="bg-rose-100 text-rose-700 border-rose-200">NO TRADE</Badge>
    : null;

  return (
    <div className="p-5 rounded-2xl glass-panel shadow-xl font-sans text-slate-900">
      <div className="flex flex-col lg:flex-row lg:items-center justify-between pb-3 mb-4 border-b border-slate-200 gap-3">
        <div className="flex items-center gap-2">
          <div className="h-8 w-8 rounded-lg bg-indigo-100 border border-indigo-200 flex items-center justify-center">
            <Video className="h-4 w-4 text-indigo-600" />
          </div>
          <div>
            <h3 className="font-extrabold text-sm text-slate-900">Analysis Video · built live</h3>
            <p className="text-[10px] text-slate-500">
              Re-runs all 21 strategies, every confirmation timeframe and the live order book right now, then
              renders the whole walkthrough as a video you can download. Nothing pre-recorded, nothing stored.
            </p>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Input
            value={symbol}
            onChange={(e) => setSymbol(e.target.value.toUpperCase())}
            onKeyDown={(e) => { if (e.key === 'Enter') analyse(); }}
            placeholder="BTCUSDT"
            className="h-8 w-32 text-xs font-mono bg-white border-slate-200"
          />
          <div className="flex rounded-lg border border-slate-200 overflow-hidden">
            {(['SCALP', 'SWING'] as const).map(m => (
              <button
                key={m}
                onClick={() => setMode(m)}
                className={`px-3 py-1.5 text-[11px] font-bold transition-colors ${
                  mode === m ? 'bg-indigo-600 text-white' : 'bg-white text-slate-600 hover:bg-slate-50'
                }`}
              >
                {m}
              </button>
            ))}
          </div>
          <Button size="sm" onClick={() => analyse()} disabled={analyzing} className="bg-indigo-600 hover:bg-indigo-500 text-white gap-1.5 font-bold">
            {analyzing ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />}
            {analyzing ? 'Analysing…' : 'Analyse live'}
          </Button>
        </div>
      </div>

      {error && (
        <div className="text-center py-8">
          <AlertTriangle className="h-8 w-8 text-amber-500 mx-auto mb-2" />
          <p className="text-sm text-slate-700">{error}</p>
        </div>
      )}

      {!error && !analysis && !analyzing && (
        <div className="text-center py-10 text-sm text-slate-500">
          Enter a market and press <span className="font-bold text-indigo-600">Analyse live</span>. The video is
          generated from that live analysis — if the setup fails a check, the video shows exactly which one and
          says NO TRADE instead of publishing a signal.
        </div>
      )}

      {analyzing && (
        <div className="py-12 flex items-center justify-center gap-3 text-slate-600 text-sm">
          <Loader2 className="h-5 w-5 animate-spin text-indigo-600" />
          Running 21 strategies, higher timeframes and the live order book…
        </div>
      )}

      {analysis && !analyzing && (
        <>
          <div className="flex flex-wrap items-center gap-2 mb-3">
            {verdictBadge}
            <Badge className="bg-slate-100 text-slate-700 border-slate-200">
              {analysis.pair} · {analysis.mode} · {analysis.baseTimeframe}
            </Badge>
            <Badge className="bg-indigo-100 text-indigo-700 border-indigo-200 gap-1">
              <Radio className="h-3 w-3" /> LIVE DATA · {new Date(analysis.takenAt).toLocaleTimeString()}
            </Badge>
            <Badge className="bg-slate-100 text-slate-700 border-slate-200">
              {scenes.length} scenes · {Math.round(duration / 1000)}s
            </Badge>
          </div>

          <div className="rounded-xl overflow-hidden border border-slate-200 bg-slate-900">
            <canvas
              ref={canvasRef}
              width={W}
              height={H}
              className="w-full h-auto block"
              aria-label={`Live analysis video canvas for ${analysis.pair}`}
            />
          </div>

          <div className="flex flex-wrap items-center gap-2 mt-3">
            <Button
              size="sm"
              onClick={() => (playing ? stopLoop() : runLoop())}
              disabled={recording}
              className="bg-slate-900 hover:bg-slate-800 text-white gap-1.5 font-bold"
            >
              {playing ? <Square className="h-3.5 w-3.5" /> : <Play className="h-3.5 w-3.5" />}
              {playing ? 'Stop' : 'Play walkthrough'}
            </Button>
            {recording ? (
              <Button size="sm" onClick={stopRecording} className="bg-rose-600 hover:bg-rose-500 text-white gap-1.5 font-bold">
                <Square className="h-3.5 w-3.5" /> Stop recording
              </Button>
            ) : (
              <Button
                size="sm"
                onClick={record}
                disabled={playing}
                variant="outline"
                className="border-indigo-500/50 text-indigo-600 hover:bg-indigo-500/10 gap-1.5 font-bold"
              >
                <Video className="h-3.5 w-3.5" /> Record video
              </Button>
            )}
            {videoUrl && (
              <a
                href={videoUrl}
                download={`${analysis.pair.replace('/', '')}-${analysis.mode}-analysis.webm`}
                className="inline-flex items-center gap-1.5 h-8 px-3 rounded-md text-xs font-bold border border-emerald-500/50 text-emerald-700 hover:bg-emerald-500/10"
              >
                <Download className="h-3.5 w-3.5" /> Download .webm
              </a>
            )}
            <span className="text-[10px] text-slate-400">
              Recording plays the walkthrough once and captures it — leave this tab visible while it runs.
            </span>
          </div>

          {videoUrl && (
            <video src={videoUrl} controls className="w-full rounded-xl border border-slate-200 mt-3 bg-black" />
          )}

          {/* The same audit trail the video narrates, in text, so the page itself proves it. */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mt-5">
            <div>
              <span className="text-[11px] uppercase tracking-wider text-slate-500 font-bold block mb-2">
                Qualification gate ({analysis.gateChecks.filter(g => g.passed).length}/{analysis.gateChecks.length} passed)
              </span>
              <div className="space-y-1.5">
                {analysis.gateChecks.map(g => (
                  <div key={g.label} className="flex items-start gap-2 rounded-lg bg-slate-50 border border-slate-200 px-3 py-2">
                    <span className={`text-xs font-black shrink-0 ${g.passed ? 'text-emerald-600' : 'text-rose-600'}`}>
                      {g.passed ? '✓' : '✗'}
                    </span>
                    <span className="text-[11px] text-slate-700">
                      <span className="font-bold text-slate-900">{g.label}</span> — {g.detail}
                    </span>
                  </div>
                ))}
                {analysis.gateChecks.length === 0 && (
                  <p className="text-[11px] text-slate-400">The gate did not run — see the rejection reason above.</p>
                )}
              </div>
            </div>

            <div className="space-y-4">
              <div>
                <span className="text-[11px] uppercase tracking-wider text-slate-500 font-bold block mb-2">
                  Higher-timeframe verification
                </span>
                <div className="space-y-1.5">
                  {analysis.timeframeChecks.map(t => (
                    <div key={t.timeframe} className="flex items-start gap-2 rounded-lg bg-slate-50 border border-slate-200 px-3 py-2">
                      <span className={`text-xs font-black shrink-0 ${t.agrees ? 'text-emerald-600' : 'text-rose-600'}`}>
                        {t.agrees ? '✓' : '✗'}
                      </span>
                      <span className="text-[11px] text-slate-700">
                        <span className="font-bold text-slate-900">{t.timeframe}</span> trend {t.trend}
                        {t.rsi != null && ` · RSI ${t.rsi}`} — {t.note}
                      </span>
                    </div>
                  ))}
                  {analysis.timeframeChecks.length === 0 && (
                    <p className="text-[11px] text-rose-600 font-medium">
                      No higher-timeframe data was available, so this setup is NOT multi-timeframe confirmed.
                    </p>
                  )}
                </div>
              </div>

              <div>
                <span className="text-[11px] uppercase tracking-wider text-slate-500 font-bold block mb-2">
                  Market liquidity (live order book)
                </span>
                {analysis.liquidity ? (
                  <div className="rounded-lg bg-slate-50 border border-slate-200 px-3 py-2 text-[11px] text-slate-700 space-y-1">
                    <div className="font-mono">
                      bid {analysis.liquidity.bidDepth} / ask {analysis.liquidity.askDepth} · imbalance {analysis.liquidity.imbalance}
                      {analysis.liquidity.spreadPct != null && ` · spread ${analysis.liquidity.spreadPct}%`}
                    </div>
                    {analysis.liquidity.wall && <div className="text-slate-600">{analysis.liquidity.wall}</div>}
                    <div className={analysis.liquidity.passed ? 'text-emerald-700 font-bold' : 'text-rose-600 font-bold'}>
                      {analysis.liquidity.passed ? '✓' : '✗'} {analysis.liquidity.note}
                    </div>
                  </div>
                ) : (
                  <p className="text-[11px] text-rose-600 font-medium">
                    No live order book was available for this market, so liquidity could NOT be verified.
                  </p>
                )}
              </div>

              <div>
                <span className="text-[11px] uppercase tracking-wider text-slate-500 font-bold block mb-2">
                  Strategies
                </span>
                <p className="text-[11px] text-slate-700">
                  {analysis.strategyReads.filter(s => s.triggered).length} of {analysis.strategyReads.length} fired ·{' '}
                  {analysis.strategyReads.filter(s => s.triggered && s.direction === analysis.direction).length} agree with{' '}
                  {analysis.direction ?? 'no direction'}
                  {analysis.rejectionReason && (
                    <span className="block mt-1 text-rose-600 font-medium">Rejected: {analysis.rejectionReason}</span>
                  )}
                </p>
              </div>
            </div>
          </div>

          <p className="text-[10px] text-slate-400 mt-4 leading-relaxed">
            Every number in this video comes from the analysis that just ran against live market data — the same
            engine and the same gate the published signals use. Nothing here is pre-rendered, and a setup that
            fails a check is shown as NO TRADE rather than published as a signal. Not financial advice.
          </p>
        </>
      )}
    </div>
  );
};
