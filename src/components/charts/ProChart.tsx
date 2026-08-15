import React, { useState, useEffect } from 'react';
import { fetchKlines, fetchOrderBook, generateMockTrades } from '@/services/binanceApi';
import { CandleData, OrderBookItem, LiveTrade } from '@/types/trading';
import { 
  ResponsiveContainer, 
  ComposedChart, 
  Bar, 
  XAxis, 
  YAxis, 
  Tooltip, 
  CartesianGrid, 
  Line 
} from 'recharts';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { 
  BarChart3, 
  Activity, 
  Zap, 
  TrendingUp, 
  TrendingDown, 
  Sliders
} from 'lucide-react';
import { toast } from 'sonner';

interface ProChartProps {
  symbol: string;
  pair: string;
  currentPrice: number;
  change24h: number;
}

export const ProChart: React.FC<ProChartProps> = ({ symbol, pair, currentPrice, change24h }) => {
  const [timeframe, setTimeframe] = useState<string>('15m');
  const [candles, setCandles] = useState<CandleData[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [showRsi, setShowRsi] = useState<boolean>(true);
  const [showEma, setShowEma] = useState<boolean>(true);
  const [orderBook, setOrderBook] = useState<{ bids: OrderBookItem[]; asks: OrderBookItem[] }>({ bids: [], asks: [] });
  const [trades, setTrades] = useState<LiveTrade[]>([]);

  useEffect(() => {
    let active = true;
    const loadChartData = async () => {
      setLoading(true);
      const data = await fetchKlines(symbol, timeframe, 40);
      const orderBookData = await fetchOrderBook(symbol);
      if (active) {
        setCandles(data);
        setOrderBook(orderBookData);
        setTrades(generateMockTrades(currentPrice));
        setLoading(false);
      }
    };

    loadChartData();
    const interval = setInterval(async () => {
      if (!active) return;
      const latest = await fetchKlines(symbol, timeframe, 40);
      const orderBookData = await fetchOrderBook(symbol);
      setCandles(latest);
      setOrderBook(orderBookData);
      setTrades(generateMockTrades(currentPrice));
    }, 4000);

    return () => {
      active = false;
      clearInterval(interval);
    };
  }, [symbol, timeframe, currentPrice]);

  const handleSimulatedTrade = (type: 'BUY' | 'SELL') => {
    toast.success(`Simulated ${type} Order placed for ${pair} at $${currentPrice.toLocaleString()}`);
  };

  const isUp = change24h >= 0;

  const chartWithData = candles.map((c, i, arr) => {
    const slice = arr.slice(Math.max(0, i - 10), i + 1);
    const avg = slice.reduce((acc, curr) => acc + curr.close, 0) / slice.length;
    return {
      ...c,
      ema: +avg.toFixed(2),
      color: c.close >= c.open ? '#10b981' : '#f43f5e',
    };
  });

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-3xl overflow-hidden shadow-2xl">
      
      {/* Terminal Header Bar */}
      <div className="bg-slate-950 p-4 border-b border-slate-800 flex flex-wrap items-center justify-between gap-4">
        
        <div className="flex items-center gap-3">
          <div className="h-9 w-9 rounded-xl bg-indigo-500/20 border border-indigo-500/40 flex items-center justify-center">
            <BarChart3 className="h-5 w-5 text-indigo-400" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="font-extrabold text-lg text-slate-100">{pair}</h2>
              <Badge className={isUp ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/40 font-mono' : 'bg-rose-500/20 text-rose-400 border-rose-500/40 font-mono'}>
                {isUp ? '+' : ''}{change24h.toFixed(2)}%
              </Badge>
            </div>
            <p className="text-xs font-mono text-slate-400">Live Binance Vision & Metals API Stream</p>
          </div>
        </div>

        <div className="flex items-center gap-4">
          <div className="text-right font-mono">
            <div className="text-xl font-black text-slate-100">
              ${currentPrice < 1 ? currentPrice.toFixed(4) : currentPrice.toLocaleString()}
            </div>
            <div className="text-[10px] text-slate-400">Real-time Live Tick</div>
          </div>

          <div className="flex items-center bg-slate-900 border border-slate-800 rounded-xl p-1 gap-1">
            {['1m', '5m', '15m', '1h', '4h', '1d'].map(tf => (
              <button
                key={tf}
                onClick={() => setTimeframe(tf)}
                className={`px-2.5 py-1 text-xs font-bold rounded-lg transition-all ${timeframe === tf ? 'bg-indigo-600 text-white shadow-sm' : 'text-slate-400 hover:text-slate-200'}`}
              >
                {tf}
              </button>
            ))}
          </div>

          <div className="flex items-center gap-2">
            <Button
              size="sm"
              variant={showEma ? 'secondary' : 'outline'}
              onClick={() => setShowEma(!showEma)}
              className="text-xs font-mono h-8 border-slate-700"
            >
              <Activity className="h-3.5 w-3.5 mr-1 text-amber-400" />
              EMA 20
            </Button>
            <Button
              size="sm"
              variant={showRsi ? 'secondary' : 'outline'}
              onClick={() => setShowRsi(!showRsi)}
              className="text-xs font-mono h-8 border-slate-700"
            >
              <Sliders className="h-3.5 w-3.5 mr-1 text-cyan-400" />
              Volume
            </Button>
          </div>
        </div>

      </div>

      {/* Main Grid: Chart + Orderbook */}
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-0 divide-y lg:divide-y-0 lg:divide-x divide-slate-800">
        
        {/* Pro Trading Chart View */}
        <div className="lg:col-span-3 p-4 bg-slate-950/60 min-h-[420px] flex flex-col justify-between">
          {loading ? (
            <div className="h-[380px] flex items-center justify-center text-slate-400 gap-2 font-mono text-sm">
              <Zap className="h-5 w-5 text-indigo-400 animate-spin" /> Fetching Live Candlestick Stream...
            </div>
          ) : (
            <div className="h-[380px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <ComposedChart data={chartWithData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" opacity={0.6} />
                  <XAxis dataKey="time" stroke="#64748b" fontSize={11} tickLine={false} />
                  <YAxis domain={['auto', 'auto']} stroke="#64748b" fontSize={11} tickLine={false} orientation="right" />
                  <Tooltip 
                    contentStyle={{ backgroundColor: '#0f172a', borderColor: '#334155', borderRadius: '8px', color: '#f8fafc' }}
                    formatter={(val: any, name: string) => [`$${val}`, name.toUpperCase()]}
                  />
                  <Bar dataKey="close" fill="#10b981" radius={[2, 2, 0, 0]} />
                  {showEma && <Line type="monotone" dataKey="ema" stroke="#f59e0b" strokeWidth={2} dot={false} name="EMA 20" />}
                </ComposedChart>
              </ResponsiveContainer>
            </div>
          )}

          {/* Quick Simulated Trade Bar */}
          <div className="mt-4 pt-4 border-t border-slate-800 flex items-center justify-between gap-4">
            <div className="flex items-center gap-2">
              <Badge variant="outline" className="text-slate-400 border-slate-800 font-mono text-xs">
                Simulated Leverage: 20x
              </Badge>
              <Badge variant="outline" className="text-slate-400 border-slate-800 font-mono text-xs">
                Slippage: 0.01%
              </Badge>
            </div>

            <div className="flex items-center gap-3">
              <Button 
                onClick={() => handleSimulatedTrade('BUY')} 
                className="bg-emerald-600 hover:bg-emerald-500 text-white font-black text-xs gap-1.5 px-6 shadow-lg shadow-emerald-900/30"
              >
                <TrendingUp className="h-4 w-4" /> LONG / BUY
              </Button>
              <Button 
                onClick={() => handleSimulatedTrade('SELL')} 
                className="bg-rose-600 hover:bg-rose-500 text-white font-black text-xs gap-1.5 px-6 shadow-lg shadow-rose-900/30"
              >
                <TrendingDown className="h-4 w-4" /> SHORT / SELL
              </Button>
            </div>
          </div>

        </div>

        {/* Live Orderbook & Stream */}
        <div className="p-4 bg-slate-950/80 font-mono text-xs flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between pb-2 mb-2 border-b border-slate-800 text-slate-400 text-[11px] font-sans font-bold">
              <span>ORDER BOOK</span>
              <span>SIZE</span>
            </div>

            {/* Asks (Sells) */}
            <div className="space-y-1 mb-2">
              {orderBook.asks.slice(0, 5).reverse().map((ask, i) => (
                <div key={`ask-${i}`} className="flex justify-between items-center text-rose-400">
                  <span>${ask.price}</span>
                  <span className="text-slate-400">{ask.amount}</span>
                </div>
              ))}
            </div>

            {/* Mid Price */}
            <div className="my-2 py-1.5 px-2 bg-slate-900 border border-slate-800 text-center rounded font-bold text-slate-100 flex items-center justify-between">
              <span className="text-[10px] text-slate-400 font-sans">MID PRICE</span>
              <span>${currentPrice < 1 ? currentPrice.toFixed(4) : currentPrice.toLocaleString()}</span>
            </div>

            {/* Bids (Buys) */}
            <div className="space-y-1 mt-2">
              {orderBook.bids.slice(0, 5).map((bid, i) => (
                <div key={`bid-${i}`} className="flex justify-between items-center text-emerald-400">
                  <span>${bid.price}</span>
                  <span className="text-slate-400">{bid.amount}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="mt-4 pt-3 border-t border-slate-800">
            <div className="flex items-center justify-between text-[10px] font-sans text-slate-400 mb-2">
              <span className="font-bold">RECENT MARKET TRADES</span>
              <span className="flex items-center gap-1 text-emerald-400"><Zap className="h-3 w-3" /> LIVE</span>
            </div>
            <div className="space-y-1 text-[11px]">
              {trades.slice(0, 4).map((t) => (
                <div key={t.id} className="flex justify-between items-center text-[10px]">
                  <span className={t.type === 'buy' ? 'text-emerald-400' : 'text-rose-400'}>${t.price}</span>
                  <span className="text-slate-400">{t.amount}</span>
                  <span className="text-slate-500">{t.time}</span>
                </div>
              ))}
            </div>
          </div>

        </div>

      </div>

    </div>
  );
};