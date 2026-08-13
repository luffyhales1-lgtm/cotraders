import React, { useEffect, useState } from 'react';
import { Navbar } from '@/components/layout/Navbar';
import { TickerTape } from '@/components/layout/TickerTape';
import { UpgradeBanner } from '@/components/subscription/UpgradeBanner';
import { VIPGateModal } from '@/components/subscription/VIPGateModal';
import { fetchTopCryptos } from '@/services/binanceApi';
import { CoinTicker } from '@/types/trading';
import { Scan, Search, ArrowUpRight, ArrowDownRight, Activity } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { useAuth } from '@/context/AuthContext';

const MarketScannerPage: React.FC = () => {
  const { isVipMember } = useAuth();
  const [tickers, setTickers] = useState<CoinTicker[]>([]);
  const [searchTerm, setSearchTerm] = useState<string>('');

  useEffect(() => {
    const load = async () => {
      const data = await fetchTopCryptos();
      setTickers(data);
    };
    load();
    const interval = setInterval(load, 10000);
    return () => clearInterval(interval);
  }, []);

  const filtered = tickers.filter(t => 
    t.pair.toLowerCase().includes(searchTerm.toLowerCase()) || 
    t.baseAsset.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 font-sans pb-16 md:pb-0">
      <TickerTape />
      <Navbar />

      <main className="max-w-7xl mx-auto px-4 lg:px-8 py-8">
        <UpgradeBanner />

        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 mb-6">
          <div>
            <h1 className="text-3xl font-black text-slate-100 flex items-center gap-2">
              <Scan className="h-7 w-7 text-amber-400" />
              1,000+ Live Binance & Gold Scanner
            </h1>
            <p className="text-sm text-slate-400 mt-1">Real-time market depth, volume surges, and 24h price volatility.</p>
          </div>

          {isVipMember && (
            <div className="relative w-full md:w-80">
              <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-500" />
              <Input
                placeholder="Search 1,000+ markets..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-9 bg-slate-900 border-slate-800 text-xs text-slate-100"
              />
            </div>
          )}
        </div>

        {!isVipMember ? (
          <VIPGateModal 
            title="1,000+ Pair Depth Scanner Restricted" 
            description="Subscribe to VIP to scan over 1,000+ Binance spot pairs in real time with high-volume surge filters and depth indicators."
          />
        ) : (
          <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-2xl">
            <div className="overflow-x-auto">
              <table className="w-full text-left font-mono text-xs">
                <thead className="bg-slate-950 text-slate-400 border-b border-slate-800 font-sans">
                  <tr>
                    <th className="p-4 font-bold">PAIR</th>
                    <th className="p-4 font-bold">PRICE</th>
                    <th className="p-4 font-bold">24H CHANGE</th>
                    <th className="p-4 font-bold">24H HIGH</th>
                    <th className="p-4 font-bold">24H LOW</th>
                    <th className="p-4 font-bold">24H VOLUME</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800">
                  {filtered.map(coin => {
                    const isUp = coin.change24h >= 0;
                    return (
                      <tr key={coin.symbol} className="hover:bg-slate-800/50 transition-colors">
                        <td className="p-4 font-bold text-slate-100 flex items-center gap-2">
                          {coin.pair}
                          {coin.isGold && <Badge className="bg-amber-500/20 text-amber-300 border-amber-500/40 text-[9px]">GOLD</Badge>}
                        </td>
                        <td className="p-4 text-slate-100 font-bold">
                          ${coin.isGold ? coin.price.toFixed(2) : coin.price < 1 ? coin.price.toFixed(4) : coin.price.toLocaleString()}
                        </td>
                        <td className={`p-4 font-bold ${isUp ? 'text-emerald-400' : 'text-rose-400'}`}>
                          <span className="flex items-center gap-0.5">
                            {isUp ? <ArrowUpRight className="h-3.5 w-3.5" /> : <ArrowDownRight className="h-3.5 w-3.5" />}
                            {isUp ? '+' : ''}{coin.change24h.toFixed(2)}%
                          </span>
                        </td>
                        <td className="p-4 text-slate-400">${coin.high24h.toLocaleString()}</td>
                        <td className="p-4 text-slate-400">${coin.low24h.toLocaleString()}</td>
                        <td className="p-4 text-slate-300">${(coin.volume24h / 1e6).toFixed(2)}M</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}

      </main>
    </div>
  );
};

export default MarketScannerPage;