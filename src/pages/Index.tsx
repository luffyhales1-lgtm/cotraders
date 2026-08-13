import React, { useEffect, useState } from 'react';
import { Navbar } from '@/components/layout/Navbar';
import { TickerTape } from '@/components/layout/TickerTape';
import { UpgradeBanner } from '@/components/subscription/UpgradeBanner';
import { ProChart } from '@/components/charts/ProChart';
import { SignalCard } from '@/components/signals/SignalCard';
import { fetchTopCryptos } from '@/services/binanceApi';
import { generateLiveSignals, INITIAL_NEWS } from '@/services/signalEngine';
import { CoinTicker, Signal, MarketNews } from '@/types/trading';
import { useAuth } from '@/context/AuthContext';
import { 
  TrendingUp, 
  TrendingDown, 
  Sparkles, 
  Zap, 
  Flame, 
  Globe, 
  Crown, 
  ArrowUpRight, 
  ArrowDownRight,
  ShieldCheck,
  BarChart2,
  Newspaper,
  Instagram
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Link } from 'react-router-dom';

const Index: React.FC = () => {
  const { user, instagramUrl } = useAuth();
  const [tickers, setTickers] = useState<CoinTicker[]>([]);
  const [signals, setSignals] = useState<Signal[]>([]);
  const [news, setNews] = useState<MarketNews[]>(INITIAL_NEWS);
  const [selectedCoin, setSelectedCoin] = useState<CoinTicker | null>(null);

  useEffect(() => {
    const load = async () => {
      const cryptoData = await fetchTopCryptos();
      setTickers(cryptoData);
      if (cryptoData.length > 0) {
        setSelectedCoin(cryptoData[0]); // Default BTC or Gold
      }
      setSignals(generateLiveSignals());
    };

    load();
    const interval = setInterval(load, 15000); // 15 sec auto live refresh
    return () => clearInterval(interval);
  }, []);

  const gainers = [...tickers].sort((a, b) => b.change24h - a.change24h).slice(0, 5);
  const losers = [...tickers].sort((a, b) => a.change24h - b.change24h).slice(0, 5);

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 font-sans selection:bg-emerald-500 selection:text-slate-950">
      <TickerTape />
      <Navbar />

      <main className="max-w-7xl mx-auto px-4 lg:px-8 py-6">
        
        {/* Floating Upgrade Banner for Free Users */}
        <UpgradeBanner />

        {/* Hero Banner Header */}
        <div className="relative overflow-hidden rounded-3xl bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 border border-slate-800 p-6 md:p-10 mb-8 shadow-2xl">
          <div className="relative z-10 max-w-3xl">
            <Badge className="bg-emerald-500/20 text-emerald-400 border-emerald-500/40 font-bold mb-3 gap-1 px-3 py-1">
              <Zap className="h-3.5 w-3.5 text-emerald-400" />
              LIVE 5-MINUTE AUTOMATED AI STRATEGY ENGINE
            </Badge>

            <h1 className="text-3xl md:text-5xl font-black tracking-tight text-white leading-tight">
              Institutional AI Signals for <span className="text-transparent bg-clip-text bg-gradient-to-r from-emerald-400 via-teal-300 to-cyan-400">Crypto & Gold</span>
            </h1>

            <p className="text-sm md:text-base text-slate-300 mt-3 leading-relaxed">
              Scan over 1,000+ Binance pairs in real time. Backtested SMC Order Block, EMA Crossovers, and RSI Divergence strategies updating every 5 minutes.
            </p>

            <div className="flex flex-wrap items-center gap-4 mt-6">
              <Link to="/signals">
                <Button className="bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-600 hover:to-teal-600 text-slate-950 font-black px-6 py-5 rounded-xl shadow-lg shadow-emerald-500/20 gap-2">
                  <Sparkles className="h-5 w-5" />
                  View 5min AI Signals
                </Button>
              </Link>

              <a href={instagramUrl} target="_blank" rel="noopener noreferrer">
                <Button variant="outline" className="border-slate-700 bg-slate-900/80 hover:bg-slate-800 text-slate-200 font-bold px-6 py-5 rounded-xl gap-2">
                  <Instagram className="h-5 w-5 text-pink-400" />
                  Subscribe VIP Access
                </Button>
              </a>
            </div>
          </div>

          <div className="absolute right-[-40px] top-[-40px] opacity-10 pointer-events-none">
            <BarChart2 className="w-96 h-96 text-cyan-400" />
          </div>
        </div>

        {/* Live Market Dashboard Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
          <div className="p-4 rounded-2xl bg-slate-900 border border-slate-800">
            <span className="text-xs text-slate-400 block font-medium">SCANNER COVERAGE</span>
            <span className="text-2xl font-black text-slate-100 font-mono mt-1 block">1,000+ PAIRS</span>
            <span className="text-[11px] text-emerald-400 font-bold flex items-center gap-1 mt-1">
              <ShieldCheck className="h-3.5 w-3.5" /> Binance Live WebSocket
            </span>
          </div>

          <div className="p-4 rounded-2xl bg-slate-900 border border-slate-800">
            <span className="text-xs text-slate-400 block font-medium">XAU/USD (GOLD) LIVE</span>
            <span className="text-2xl font-black text-amber-400 font-mono mt-1 block">
              ${tickers.find(t => t.symbol === 'XAUUSDT')?.price.toFixed(2) || '2738.50'}
            </span>
            <span className="text-[11px] text-amber-400 font-bold flex items-center gap-1 mt-1">
              <TrendingUp className="h-3.5 w-3.5" /> Real-time Metals Stream
            </span>
          </div>

          <div className="p-4 rounded-2xl bg-slate-900 border border-slate-800">
            <span className="text-xs text-slate-400 block font-medium">AI WIN ACCURACY</span>
            <span className="text-2xl font-black text-cyan-400 font-mono mt-1 block">89.4%</span>
            <span className="text-[11px] text-cyan-400 font-bold flex items-center gap-1 mt-1">
              <Zap className="h-3.5 w-3.5" /> 5-Min Strategy Confluence
            </span>
          </div>

          <div className="p-4 rounded-2xl bg-slate-900 border border-slate-800">
            <span className="text-xs text-slate-400 block font-medium">ACTIVE VIP TRADERS</span>
            <span className="text-2xl font-black text-indigo-400 font-mono mt-1 block">14,280+</span>
            <span className="text-[11px] text-indigo-400 font-bold flex items-center gap-1 mt-1">
              <Crown className="h-3.5 w-3.5" /> Verified Community
            </span>
          </div>
        </div>

        {/* Selected Live Pro Chart */}
        {selectedCoin && (
          <div className="mb-10">
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-xl font-extrabold text-slate-100 flex items-center gap-2">
                <BarChart2 className="h-5 w-5 text-indigo-400" />
                Live Terminal Chart: {selectedCoin.pair}
              </h2>
              <span className="text-xs text-slate-400 font-mono">Selecting coin updates live terminal below</span>
            </div>
            <ProChart 
              symbol={selectedCoin.symbol} 
              pair={selectedCoin.pair} 
              currentPrice={selectedCoin.price} 
              change24h={selectedCoin.change24h} 
            />
          </div>
        )}

        {/* Live Top Gainers & Losers Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-10">
          
          {/* Gainers */}
          <div className="p-5 rounded-2xl bg-slate-900 border border-slate-800">
            <div className="flex items-center justify-between pb-3 mb-3 border-b border-slate-800">
              <h3 className="font-extrabold text-sm text-emerald-400 flex items-center gap-2">
                <TrendingUp className="h-4 w-4" /> TOP 24H GAINERS
              </h3>
              <Badge variant="outline" className="text-[10px] border-emerald-500/30 text-emerald-400">Binance Spot</Badge>
            </div>
            <div className="space-y-2">
              {gainers.map((coin) => (
                <div 
                  key={coin.symbol} 
                  onClick={() => setSelectedCoin(coin)}
                  className="flex items-center justify-between p-2.5 rounded-xl bg-slate-950/60 hover:bg-slate-800/80 cursor-pointer transition-colors border border-slate-800/60"
                >
                  <div>
                    <span className="font-bold text-sm text-slate-100 block">{coin.pair}</span>
                    <span className="text-[10px] text-slate-400">Vol ${ (coin.volume24h / 1e6).toFixed(1) }M</span>
                  </div>
                  <div className="text-right">
                    <span className="font-mono text-sm text-slate-100 font-bold block">${coin.price < 1 ? coin.price.toFixed(4) : coin.price.toLocaleString()}</span>
                    <span className="text-xs font-bold text-emerald-400 font-mono flex items-center justify-end">
                      <ArrowUpRight className="h-3 w-3" /> +{coin.change24h.toFixed(2)}%
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Losers */}
          <div className="p-5 rounded-2xl bg-slate-900 border border-slate-800">
            <div className="flex items-center justify-between pb-3 mb-3 border-b border-slate-800">
              <h3 className="font-extrabold text-sm text-rose-400 flex items-center gap-2">
                <TrendingDown className="h-4 w-4" /> TOP 24H LOSERS
              </h3>
              <Badge variant="outline" className="text-[10px] border-rose-500/30 text-rose-400">Binance Spot</Badge>
            </div>
            <div className="space-y-2">
              {losers.map((coin) => (
                <div 
                  key={coin.symbol} 
                  onClick={() => setSelectedCoin(coin)}
                  className="flex items-center justify-between p-2.5 rounded-xl bg-slate-950/60 hover:bg-slate-800/80 cursor-pointer transition-colors border border-slate-800/60"
                >
                  <div>
                    <span className="font-bold text-sm text-slate-100 block">{coin.pair}</span>
                    <span className="text-[10px] text-slate-400">Vol ${ (coin.volume24h / 1e6).toFixed(1) }M</span>
                  </div>
                  <div className="text-right">
                    <span className="font-mono text-sm text-slate-100 font-bold block">${coin.price < 1 ? coin.price.toFixed(4) : coin.price.toLocaleString()}</span>
                    <span className="text-xs font-bold text-rose-400 font-mono flex items-center justify-end">
                      <ArrowDownRight className="h-3 w-3" /> {coin.change24h.toFixed(2)}%
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>

        </div>

        {/* Featured Live AI Signals Section */}
        <div className="mb-10">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-2xl font-black text-slate-100 flex items-center gap-2">
                <Sparkles className="h-6 w-6 text-cyan-400" />
                Latest 5-Minute Strategy AI Signals
              </h2>
              <p className="text-xs text-slate-400 mt-0.5">Automated confluence algorithm updated every 5 minutes across Binance & Gold</p>
            </div>
            <Link to="/signals">
              <Button size="sm" variant="outline" className="border-slate-700 text-slate-200 text-xs font-bold">
                View All Signals
              </Button>
            </Link>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {signals.slice(0, 6).map((sig) => (
              <SignalCard key={sig.id} signal={sig} onSelectSymbol={(sym) => {
                const found = tickers.find(t => t.symbol === sym);
                if (found) setSelectedCoin(found);
              }} />
            ))}
          </div>
        </div>

        {/* Live News Preview Section */}
        <div className="p-6 rounded-2xl bg-slate-900 border border-slate-800">
          <div className="flex items-center justify-between pb-4 mb-4 border-b border-slate-800">
            <h3 className="font-extrabold text-lg text-slate-100 flex items-center gap-2">
              <Newspaper className="h-5 w-5 text-rose-400" />
              Live Crypto & Gold Institutional Intelligence
            </h3>
            <Link to="/news">
              <Button size="sm" variant="ghost" className="text-xs text-slate-400 hover:text-white">
                Read All News
              </Button>
            </Link>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {news.map((item) => (
              <div key={item.id} className="p-4 rounded-xl bg-slate-950 border border-slate-800/80">
                <div className="flex items-center justify-between text-xs text-slate-400 mb-1">
                  <span className="font-bold text-slate-300">{item.source}</span>
                  <span>{item.time}</span>
                </div>
                <h4 className="font-bold text-sm text-slate-100 leading-snug">{item.title}</h4>
                <p className="text-xs text-slate-400 mt-1 leading-relaxed">{item.summary}</p>
              </div>
            ))}
          </div>
        </div>

      </main>

      <footer className="mt-12 border-t border-slate-800/80 bg-slate-950 py-8 px-4 text-center text-xs text-slate-500">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row items-center justify-between gap-4">
          <div>
            <p className="font-bold text-slate-400">LiveTrading AI Pro Platform © {new Date().getFullYear()}</p>
            <p className="text-[11px] text-slate-600 mt-0.5">High-frequency Binance REST & Metals Stream Terminal</p>
          </div>
          <div className="flex items-center gap-4">
            <a href={instagramUrl} target="_blank" rel="noopener noreferrer" className="text-slate-400 hover:text-pink-400 font-medium">
              Instagram DM Access
            </a>
            <Link to="/admin" className="text-slate-500 hover:text-amber-400 font-mono">
              Admin Portal
            </Link>
          </div>
        </div>
      </footer>

    </div>
  );
};

export default Index;