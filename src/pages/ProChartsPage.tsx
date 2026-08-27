import React, { useState, useEffect } from 'react';
import { Navbar } from '@/components/layout/Navbar';
import { TickerTape } from '@/components/layout/TickerTape';
import { ProChart } from '@/components/charts/ProChart';
import { LiquidityHeatmap } from '@/components/trading/LiquidityHeatmap';
import { TechnicalGauge } from '@/components/trading/TechnicalGauge';
import { VIPGateModal } from '@/components/subscription/VIPGateModal';
import { AmbientBackground } from '@/components/effects/AmbientBackground';
import { fetchTopCryptos } from '@/services/binanceApi';
import { CoinTicker } from '@/types/trading';
import { Search, LineChart, Sparkles } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/context/AuthContext';

const ProChartsPage: React.FC = () => {
  const { isVipMember } = useAuth();
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
    <div className="min-h-screen bg-slate-50 text-slate-900 font-sans pb-16 md:pb-0">
      <AmbientBackground />
      <TickerTape />
      <Navbar />

      <main className="relative z-10 max-w-7xl mx-auto px-4 lg:px-8 py-8">

        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 mb-6">
          <div>
            <h1 className="text-3xl font-black text-slate-900 flex items-center gap-2">
              <LineChart className="h-7 w-7 text-indigo-600" />
              Pro Trading Terminal
            </h1>
            <p className="text-sm text-slate-500 mt-1">
              Binance WebSocket Klines, Real-Time Depth Orderbook, and Technical Overlays.
            </p>
          </div>

          {isVipMember && (
            <div className="relative w-full md:w-72">
              <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
              <Input
                placeholder="Search symbol (e.g. BTC, XAU, SOL)..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-9 bg-white border-slate-200 text-xs font-mono text-slate-900 focus:border-indigo-500"
              />
            </div>
          )}
        </div>

        {!isVipMember ? (
          <VIPGateModal
            title="Pro Dark Terminal Locked"
            description="Upgrade to VIP Subscription to access full candlestick charts, live orderbooks, SMC liquidity heatmaps, and technical summary gauges."
          />
        ) : (
          <div>
            <div className="flex items-center gap-2 overflow-x-auto pb-4 mb-6 scrollbar-none">
              {searchFiltered.slice(0, 12).map((coin) => (
                <Button
                  key={coin.symbol}
                  onClick={() => setSelectedCoin(coin)}
                  variant={selectedCoin?.symbol === coin.symbol ? 'secondary' : 'outline'}
                  size="sm"
                  className={`shrink-0 font-mono text-xs ${selectedCoin?.symbol === coin.symbol ? 'bg-indigo-600 text-white border-indigo-500 font-bold' : 'border-slate-200 text-slate-600 hover:bg-slate-100'}`}
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
          </div>
        )}

      </main>
    </div>
  );
};

export default ProChartsPage;
