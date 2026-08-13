import React, { useState, useEffect } from 'react';
import { Navbar } from '@/components/layout/Navbar';
import { TickerTape } from '@/components/layout/TickerTape';
import { ProChart } from '@/components/charts/ProChart';
import { LiquidityHeatmap } from '@/components/trading/LiquidityHeatmap';
import { TechnicalGauge } from '@/components/trading/TechnicalGauge';
import { fetchTopCryptos } from '@/services/binanceApi';
import { CoinTicker } from '@/types/trading';
import { Search, LineChart, Sparkles } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';

const ProChartsPage: React.FC = () => {
  const [tickers, setTickers] = useState<CoinTicker[]>([]);
  const [selectedCoin, setSelectedCoin] = useState<CoinTicker | null>(null);
  const [searchTerm, setSearchTerm] = useState<string>('');

  useEffect(() => {
    const load = async () => {
      const data = await fetchTopCryptos();
      setTickers(data);
      if (data.length > 0) setSelectedCoin(data[0]);
    };
    load();
  }, []);

  const searchFiltered = tickers.filter(t => 
    t.pair.toLowerCase().includes(searchTerm.toLowerCase()) || 
    t.symbol.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 font-sans pb-16 md:pb-0">
      <TickerTape />
      <Navbar />

      <main className="max-w-7xl mx-auto px-4 lg:px-8 py-8">
        
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 mb-6">
          <div>
            <h1 className="text-3xl font-black text-slate-100 flex items-center gap-2">
              <LineChart className="h-7 w-7 text-indigo-400" />
              Pro Dark Trading Terminal
            </h1>
            <p className="text-sm text-slate-400 mt-1">
              Binance WebSocket Klines, Real-Time Depth Orderbook, and Technical Overlays.
            </p>
          </div>

          <div className="relative w-full md:w-72">
            <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-500" />
            <Input
              placeholder="Search symbol (e.g. BTC, XAU, SOL)..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-9 bg-slate-900 border-slate-800 text-xs font-mono text-slate-100 focus:border-indigo-500"
            />
          </div>
        </div>

        {/* Pair Quick Selector Bar */}
        <div className="flex items-center gap-2 overflow-x-auto pb-4 mb-6 scrollbar-none">
          {searchFiltered.slice(0, 12).map((coin) => (
            <Button
              key={coin.symbol}
              onClick={() => setSelectedCoin(coin)}
              variant={selectedCoin?.symbol === coin.symbol ? 'secondary' : 'outline'}
              size="sm"
              className={`shrink-0 font-mono text-xs ${selectedCoin?.symbol === coin.symbol ? 'bg-indigo-600 text-white border-indigo-500 font-bold' : 'border-slate-800 text-slate-300 hover:bg-slate-900'}`}
            >
              {coin.pair}
            </Button>
          ))}
        </div>

        {selectedCoin && (
          <div className="space-y-8">
            <ProChart
              symbol={selectedCoin.symbol}
              pair={selectedCoin.pair}
              currentPrice={selectedCoin.price}
              change24h={selectedCoin.change24h}
            />

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <TechnicalGauge 
                pair={selectedCoin.pair} 
                price={selectedCoin.price} 
                change24h={selectedCoin.change24h} 
              />
              <LiquidityHeatmap 
                symbol={selectedCoin.symbol} 
                pair={selectedCoin.pair} 
                currentPrice={selectedCoin.price} 
              />
            </div>
          </div>
        )}

      </main>
    </div>
  );
};

export default ProChartsPage;