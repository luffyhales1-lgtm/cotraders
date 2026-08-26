import React, { useEffect, useState } from 'react';
import { Navbar } from '@/components/layout/Navbar';
import { TickerTape } from '@/components/layout/TickerTape';
import { UpgradeBanner } from '@/components/subscription/UpgradeBanner';
import { ProChart } from '@/components/charts/ProChart';
import { SignalCard } from '@/components/signals/SignalCard';
import { Hero3DCanvas } from '@/components/effects/Hero3DCanvas';
import { AmbientBackground } from '@/components/effects/AmbientBackground';
import { RiskCalculator } from '@/components/trading/RiskCalculator';
import { MarketAnalyzer } from '@/components/trading/MarketAnalyzer';
import { TelegramBotSimulator } from '@/components/telegram/TelegramBotSimulator';
import { AutoScannerService } from '@/components/telegram/AutoScannerService';
import { fetchTopCryptos, subscribeBinanceTickerStream } from '@/services/binanceApi';
import { scanMarketForSignals } from '@/services/signalEngine';
import { CoinTicker, Signal } from '@/types/trading';
import { useAuth } from '@/context/AuthContext';
import {
  TrendingUp,
  TrendingDown,
  Sparkles,
  Zap,
  Crown,
  ArrowUpRight,
  ArrowDownRight,
  ShieldCheck,
  BarChart2,
  Send,
  ScanEye,
  Radio,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Link } from 'react-router-dom';

const Index: React.FC = () => {
  const { instagramUrl, isVipMember } = useAuth();
  const [tickers, setTickers] = useState<CoinTicker[]>([]);
  const [signals, setSignals] = useState<Signal[]>([]);
  const [selectedCoin, setSelectedCoin] = useState<CoinTicker | null>(null);

  useEffect(() => {
    let isSubscribed = true;

    const loadInitial = async () => {
      const data = await fetchTopCryptos();
      if (!isSubscribed) return;
      setTickers(data);
      if (data.length > 0) setSelectedCoin(data[0]);
      const live = await scanMarketForSignals();
      if (isSubscribed) setSignals(live);
    };

    loadInitial();

    const unsubscribeWs = subscribeBinanceTickerStream((livePrices) => {
      if (!isSubscribed) return;
      setTickers(prev => prev.map(t => {
        if (livePrices[t.symbol]) {
          return { ...t, price: livePrices[t.symbol] };
        }
        return t;
      }));
    });

    return () => {
      isSubscribed = false;
      unsubscribeWs();
    };
  }, []);

  const gainers = [...tickers].sort((a, b) => b.change24h - a.change24h).slice(0, 5);
  const losers = [...tickers].sort((a, b) => a.change24h - b.change24h).slice(0, 5);

  const goldPrice = tickers.find(t => t.symbol === 'XAUUSDT')?.price;

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 font-sans selection:bg-violet-500 selection:text-white pb-16 md:pb-0">
      <AmbientBackground />
      <TickerTape />
      <Navbar />

      <main className="relative z-10 max-w-7xl mx-auto px-4 lg:px-8 py-6">

        <UpgradeBanner />

        {/* ===================== HERO ===================== */}
        <section className="relative overflow-hidden rounded-3xl border border-white/[0.06] border-aurora animate-fade-up p-6 md:p-12 mb-10 glass-panel">
          <Hero3DCanvas />

          <div className="relative z-10 grid lg:grid-cols-[1.4fr_1fr] gap-8 items-center">
            <div>
              <Badge className="chip-3d text-emerald-300 border-emerald-500/40 font-bold mb-4 gap-1.5 px-3 py-1">
                <span className="relative flex h-2 w-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-400" />
                </span>
                DIRECT BINANCE FUTURES &amp; GOLD SPOT · LIVE API
              </Badge>

              <h1 className="text-4xl md:text-6xl font-black tracking-tight leading-[1.05]">
                <span className="text-white">Institutional AI Signals for</span>{' '}
                <span className="text-shimmer">Futures &amp; Gold</span>
              </h1>

              <p className="text-sm md:text-base text-slate-300 mt-4 leading-relaxed max-w-xl">
                Footprint Delta, orderbook spoofing &amp; SMC order blocks — now with an AI chart-screenshot
                analyzer, 1-minute auto Telegram dispatches and hourly backtests.
              </p>

              <div className="flex flex-wrap items-center gap-3 mt-7">
                <Link to="/signals">
                  <Button className="btn-glow text-white font-black px-6 py-5 rounded-xl gap-2">
                    <Sparkles className="h-5 w-5" />
                    View Live AI Signals
                  </Button>
                </Link>

                <Link to="/analyze">
                  <Button variant="outline" className="border-violet-500/50 bg-violet-500/10 text-violet-200 hover:bg-violet-500/20 font-bold px-6 py-5 rounded-xl gap-2">
                    <ScanEye className="h-5 w-5 text-violet-300" />
                    AI Chart Analysis
                  </Button>
                </Link>

                <a href={instagramUrl} target="_blank" rel="noopener noreferrer">
                  <Button variant="outline" className="border-amber-500/50 bg-amber-500/10 text-amber-300 hover:bg-amber-500/20 font-bold px-6 py-5 rounded-xl gap-2">
                    <Crown className="h-5 w-5 text-amber-400" />
                    Go VIP
                  </Button>
                </a>
              </div>
            </div>

            {/* Floating 3D live-metric stack */}
            <div className="scene-3d hidden lg:block">
              <div className="card-3d glass-panel rounded-2xl p-5 float-3d">
                <div className="flex items-center justify-between mb-4">
                  <span className="text-xs font-bold text-slate-300 flex items-center gap-1.5">
                    <Radio className="h-3.5 w-3.5 text-emerald-400 animate-pulse" /> LIVE COMMAND DECK
                  </span>
                  <Badge className="chip-3d text-violet-300 border-violet-500/40 text-[10px] font-black">REALTIME</Badge>
                </div>
                <div className="space-y-3">
                  <HeroStat icon={<ShieldCheck className="h-4 w-4 text-emerald-400" />} label="Scanner coverage" value={tickers.length > 0 ? `${tickers.length} markets` : '500+ markets'} />
                  <HeroStat icon={<TrendingUp className="h-4 w-4 text-amber-400" />} label="Gold (XAU/USD)" value={goldPrice ? `$${goldPrice.toFixed(2)}` : '$2,894.50'} tone="amber" />
                  <HeroStat icon={<Zap className="h-4 w-4 text-cyan-400" />} label="Footprint CVD" value="+1,840 delta" tone="cyan" />
                  <HeroStat icon={<Send className="h-4 w-4 text-violet-400" />} label="Telegram dispatch" value="Automated" tone="violet" />
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* ===================== COMMAND STRIP (mobile + all) ===================== */}
        <div className="scene-3d grid grid-cols-2 md:grid-cols-4 gap-4 mb-10 lg:hidden">
          <StatTile label="SCANNER COVERAGE" value={tickers.length > 0 ? `${tickers.length}` : '500+'} sub="Futures · Gold · FX" icon={<ShieldCheck className="h-3.5 w-3.5" />} tone="emerald" />
          <StatTile label="GOLD (XAU/USD)" value={goldPrice ? `$${goldPrice.toFixed(0)}` : '$2894'} sub="Live spot metals" icon={<TrendingUp className="h-3.5 w-3.5" />} tone="amber" />
          <StatTile label="FOOTPRINT CVD" value="+1,840" sub="Spoof filtered" icon={<Zap className="h-3.5 w-3.5" />} tone="cyan" />
          <StatTile label="DISPATCH" value="AUTO" sub="Charts & TP alerts" icon={<Send className="h-3.5 w-3.5" />} tone="violet" />
        </div>

        {/* Analyze Whole Market — full-universe strategy scan + market read */}
        <MarketAnalyzer onSignals={setSignals} />

        {/* 1-Minute Auto Scanner Service Engine */}
        <AutoScannerService />

        {/* Interactive Telegram Bot Menu Simulator Widget */}
        <div className="mb-10">
          <TelegramBotSimulator />
        </div>

        {/* Position Size Calculator */}
        <div className="mb-10">
          <RiskCalculator />
        </div>

        {/* ===================== LIVE TERMINAL ===================== */}
        {selectedCoin && (
          <div className="mb-12">
            <SectionHeading
              icon={<BarChart2 className="h-6 w-6 text-indigo-400" />}
              title={`Live Futures Terminal · ${selectedCoin.pair}`}
              subtitle="Real-time Binance Futures WebSocket stream active"
            />
            <div className="scene-3d">
              <div className="card-3d rounded-2xl">
                <ProChart
                  symbol={selectedCoin.symbol}
                  pair={selectedCoin.pair}
                  currentPrice={selectedCoin.price}
                  change24h={selectedCoin.change24h}
                />
              </div>
            </div>
          </div>
        )}

        {/* ===================== GAINERS & LOSERS ===================== */}
        <div className="scene-3d grid grid-cols-1 md:grid-cols-2 gap-6 mb-12">
          <MoverPanel
            title="TOP 24H FUTURES GAINERS"
            tone="emerald"
            coins={gainers}
            onSelect={setSelectedCoin}
          />
          <MoverPanel
            title="TOP 24H FUTURES LOSERS"
            tone="rose"
            coins={losers}
            onSelect={setSelectedCoin}
          />
        </div>

        {/* ===================== LIVE SIGNALS ===================== */}
        <div className="mb-12">
          <div className="flex items-center justify-between mb-5">
            <SectionHeading
              icon={<Sparkles className="h-6 w-6 text-cyan-400" />}
              title="Latest Live AI Signals"
              subtitle="Footprint Delta, orderbook spoofing & SMC order blocks"
              noMargin
            />
            <Link to="/signals">
              <Button size="sm" variant="outline" className="border-slate-700 text-slate-200 text-xs font-bold shrink-0">
                View All Signals
              </Button>
            </Link>
          </div>

          <div className="scene-3d grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {signals.slice(0, isVipMember ? 6 : 3).map((sig) => (
              <div key={sig.id} className="card-3d rounded-2xl">
                <SignalCard
                  signal={sig}
                  onSelectSymbol={(sym) => {
                    const found = tickers.find(t => t.symbol === sym);
                    if (found) setSelectedCoin(found);
                  }}
                />
              </div>
            ))}
          </div>
        </div>

      </main>

      <footer className="relative z-10 mt-12 border-t border-white/[0.06] py-8 px-4 text-center text-xs text-slate-500">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row items-center justify-between gap-4">
          <div>
            <p className="font-bold text-slate-400">COTRADERS AI Pro Platform © {new Date().getFullYear()}</p>
            <p className="text-[11px] text-slate-600 mt-0.5">Binance Futures &amp; Gold Live API Stream Terminal</p>
          </div>
          <div className="flex items-center gap-4">
            <a href={instagramUrl} target="_blank" rel="noopener noreferrer" className="text-slate-400 hover:text-amber-400 font-medium">
              Instagram DM Support (@abdul_kaif12)
            </a>
            <Link to="/admin" className="text-slate-500 hover:text-violet-400 font-mono">
              Admin Portal
            </Link>
          </div>
        </div>
      </footer>
    </div>
  );
};

// ---------------------------------------------------------------------------
// Presentational helpers (dashboard-local, no new deps)
// ---------------------------------------------------------------------------

const toneText: Record<string, string> = {
  emerald: 'text-emerald-400',
  amber: 'text-amber-400',
  cyan: 'text-cyan-400',
  violet: 'text-violet-400',
  rose: 'text-rose-400',
  slate: 'text-slate-100',
};

const HeroStat: React.FC<{ icon: React.ReactNode; label: string; value: string; tone?: string }> = ({ icon, label, value, tone = 'slate' }) => (
  <div className="flex items-center justify-between rounded-xl bg-slate-950/50 border border-white/[0.06] px-3 py-2.5">
    <span className="text-xs text-slate-400 font-medium flex items-center gap-2">{icon}{label}</span>
    <span className={`text-sm font-black font-mono ${toneText[tone]}`}>{value}</span>
  </div>
);

const StatTile: React.FC<{ label: string; value: string; sub: string; icon: React.ReactNode; tone: string }> = ({ label, value, sub, icon, tone }) => (
  <div className="p-4 rounded-2xl glass-panel card-3d">
    <span className="text-xs text-slate-400 block font-medium">{label}</span>
    <span className={`text-2xl font-black font-mono mt-1 block ${tone === 'amber' ? 'text-amber-400' : tone === 'cyan' ? 'text-cyan-400' : tone === 'violet' ? 'text-indigo-400' : 'text-slate-100'}`}>{value}</span>
    <span className={`text-[11px] font-bold flex items-center gap-1 mt-1 ${toneText[tone]}`}>{icon}{sub}</span>
  </div>
);

const SectionHeading: React.FC<{ icon: React.ReactNode; title: string; subtitle?: string; noMargin?: boolean }> = ({ icon, title, subtitle, noMargin }) => (
  <div className={noMargin ? '' : 'mb-4'}>
    <h2 className="text-2xl font-black text-slate-100 flex items-center gap-2">
      {icon}
      {title}
    </h2>
    {subtitle && <p className="text-xs text-slate-400 mt-0.5">{subtitle}</p>}
  </div>
);

const MoverPanel: React.FC<{
  title: string;
  tone: 'emerald' | 'rose';
  coins: CoinTicker[];
  onSelect: (c: CoinTicker) => void;
}> = ({ title, tone, coins, onSelect }) => {
  const Icon = tone === 'emerald' ? TrendingUp : TrendingDown;
  const Arrow = tone === 'emerald' ? ArrowUpRight : ArrowDownRight;
  const color = tone === 'emerald' ? 'text-emerald-400' : 'text-rose-400';
  const border = tone === 'emerald' ? 'border-emerald-500/30 text-emerald-400' : 'border-rose-500/30 text-rose-400';
  return (
    <div className="p-5 rounded-2xl glass-panel card-3d">
      <div className="flex items-center justify-between pb-3 mb-3 border-b border-white/[0.06]">
        <h3 className={`font-extrabold text-sm flex items-center gap-2 ${color}`}>
          <Icon className="h-4 w-4" /> {title}
        </h3>
        <Badge variant="outline" className={`text-[10px] ${border}`}>Binance Futures</Badge>
      </div>
      <div className="space-y-2">
        {coins.map((coin) => (
          <div
            key={coin.symbol}
            onClick={() => onSelect(coin)}
            className="flex items-center justify-between p-2.5 rounded-xl bg-slate-950/50 hover:bg-slate-800/70 cursor-pointer transition-colors border border-white/[0.04]"
          >
            <div>
              <span className="font-bold text-sm text-slate-100 block">{coin.pair}</span>
              <span className="text-[10px] text-slate-400">Vol ${(coin.volume24h / 1e6).toFixed(1)}M</span>
            </div>
            <div className="text-right">
              <span className="font-mono text-sm text-slate-100 font-bold block">${coin.price < 1 ? coin.price.toFixed(4) : coin.price.toLocaleString()}</span>
              <span className={`text-xs font-bold font-mono flex items-center justify-end ${color}`}>
                <Arrow className="h-3 w-3" /> {coin.change24h > 0 ? '+' : ''}{coin.change24h.toFixed(2)}%
              </span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default Index;
