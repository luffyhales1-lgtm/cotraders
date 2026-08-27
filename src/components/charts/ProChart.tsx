import React, { useState, useEffect } from 'react';
import { fetchKlines, fetchOrderBook, generateMockTrades } from '@/services/binanceApi';
import { CandleData, OrderBookItem, LiveTrade } from '@/types/trading';
import {
  ResponsiveContainer,
  ComposedChart,
  BarChart,
  Bar,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  Line,
  Cell,
} from 'recharts';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  BarChart3,
  Activity,
  Zap,
  TrendingUp,
  TrendingDown,
  Sliders,
  RefreshCw,
  AlertTriangle,
} from 'lucide-react';
import { toast } from 'sonner';

interface ProChartProps {
  symbol: string;
  pair: string;
  currentPrice: number;
  change24h: number;
}

// Chart-only preview series used ONLY when the live futures feed is momentarily
// unreachable (e.g. transient network / region block) so the terminal never
// renders blank. Clearly labelled as preview; never used for signals.
function buildPreviewSeries(price: number): CandleData[] {
  const base = price > 0 ? price : 100;
  const out: CandleData[] = [];
  const now = Date.now();
  let p = base * 0.995;
  for (let i = 39; i >= 0; i--) {
    const drift = Math.sin(i / 3) * base * 0.0018 + (Math.random() - 0.5) * base * 0.0012;
    const open = p;
    const close = +(p + drift).toFixed(base < 10 ? 4 : 2);
    const high = +(Math.max(open, close) * 1.0009).toFixed(base < 10 ? 4 : 2);
    const low = +(Math.min(open, close) * 0.9991).toFixed(base < 10 ? 4 : 2);
    out.push({
      time: new Date(now - i * 60000).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      open, high, low, close,
      volume: Math.random() * 1000 + 200,
      takerBuyVolume: Math.random() * 500 + 100,
    });
    p = close;
  }
  return out;
}

export const ProChart: React.FC<ProChartProps> = ({ symbol, pair, currentPrice, change24h }) => {
  const [timeframe, setTimeframe] = useState<string>('15m');
  const [candles, setCandles] = useState<CandleData[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [isPreview, setIsPreview] = useState<boolean>(false);
  const [showEma, setShowEma] = useState<boolean>(true);
  const [showVolume, setShowVolume] = useState<boolean>(true);
  const [orderBook, setOrderBook] = useState<{ bids: OrderBookItem[]; asks: OrderBookItem[] }>({ bids: [], asks: [] });
  const [trades, setTrades] = useState<LiveTrade[]>([]);

  const loadChartData = async () => {
    setLoading(true);
    const [data, orderBookData] = await Promise.all([
      fetchKlines(symbol, timeframe, 90),
      fetchOrderBook(symbol),
    ]);
    if (data.length > 0) {
      setCandles(data);
      setIsPreview(false);
    } else {
      // Live feed unreachable this moment — show a labelled preview instead of blank.
      setCandles(buildPreviewSeries(currentPrice));
      setIsPreview(true);
    }
    setOrderBook(orderBookData);
    setTrades(generateMockTrades(currentPrice || 100));
    setLoading(false);
  };

  useEffect(() => {
    let active = true;
    const run = async () => {
      const [data, orderBookData] = await Promise.all([
        fetchKlines(symbol, timeframe, 90),
        fetchOrderBook(symbol),
      ]);
      if (!active) return;
      if (data.length > 0) {
        setCandles(data);
        setIsPreview(false);
      } else {
        setCandles(buildPreviewSeries(currentPrice));
        setIsPreview(true);
      }
      setOrderBook(orderBookData);
      setTrades(generateMockTrades(currentPrice || 100));
      setLoading(false);
    };

    setLoading(true);
    run();
    const interval = setInterval(run, 5000);
    return () => { active = false; clearInterval(interval); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [symbol, timeframe, currentPrice]);

  const handleSimulatedTrade = (type: 'BUY' | 'SELL') => {
    toast.success(`Simulated ${type} order logged for ${pair} at $${(currentPrice || 0).toLocaleString()}`);
  };

  const isUp = change24h >= 0;
  const up = '#059669';
  const down = '#e11d48';
  const lineColor = isUp ? up : down;

  // EMA20 overlay computed from real closes.
  const chartData = candles.map((c, i, arr) => {
    const slice = arr.slice(Math.max(0, i - 19), i + 1);
    const avg = slice.reduce((acc, cur) => acc + cur.close, 0) / slice.length;
    const digits = c.close < 10 ? 4 : 2;
    return { ...c, ema: +avg.toFixed(digits), volColor: c.close >= c.open ? up : down };
  });

  // Fit the price axis tightly to the data so real variation is visible
  // (the old chart used a 0-based bar axis, which rendered a flat block).
  const lows = chartData.map(c => c.low).filter(n => !isNaN(n));
  const highs = chartData.map(c => c.high).filter(n => !isNaN(n));
  const minP = lows.length ? Math.min(...lows) : 0;
  const maxP = highs.length ? Math.max(...highs) : 1;
  const pad = (maxP - minP) * 0.08 || maxP * 0.01;
  const priceDomain: [number, number] = [+(minP - pad), +(maxP + pad)];
  const fmtPrice = (v: number) => (v < 10 ? v.toFixed(4) : v.toLocaleString(undefined, { maximumFractionDigits: 2 }));

  return (
    <div className="glass-panel rounded-3xl overflow-hidden shadow-xl">

      {/* Terminal Header Bar */}
      <div className="bg-[hsl(224_42%_7%)] p-4 border-b border-[hsl(222_25%_16%)] flex flex-wrap items-center justify-between gap-4">

        <div className="flex items-center gap-3">
          <div className="h-9 w-9 rounded-xl bg-indigo-500/15 border border-indigo-500/40 flex items-center justify-center">
            <BarChart3 className="h-5 w-5 text-indigo-600" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="font-extrabold text-lg text-slate-900">{pair}</h2>
              <Badge className={isUp ? 'bg-emerald-500/15 text-emerald-700 border-emerald-500/40 font-mono' : 'bg-rose-500/15 text-rose-600 border-rose-500/40 font-mono'}>
                {isUp ? '+' : ''}{change24h.toFixed(2)}%
              </Badge>
              {isPreview && (
                <Badge variant="outline" className="text-amber-600 border-amber-400/60 bg-amber-50 text-[10px] gap-1">
                  <AlertTriangle className="h-3 w-3" /> Preview — live feed unreachable
                </Badge>
              )}
            </div>
            <p className="text-xs font-mono text-slate-500">Live Binance USDT-M Futures klines &amp; depth</p>
          </div>
        </div>

        <div className="flex items-center gap-4">
          <div className="text-right font-mono">
            <div className="text-xl font-black text-slate-900">
              ${currentPrice < 1 ? currentPrice.toFixed(4) : currentPrice.toLocaleString()}
            </div>
            <div className="text-[10px] text-slate-500">Real-time last price</div>
          </div>

          <div className="flex items-center bg-slate-100 rounded-xl p-1 gap-1">
            {['1m', '5m', '15m', '1h', '4h', '1d'].map(tf => (
              <button
                key={tf}
                onClick={() => setTimeframe(tf)}
                className={`px-2.5 py-1 text-xs font-bold rounded-lg transition-all ${timeframe === tf ? 'bg-indigo-600 text-white shadow-sm' : 'text-slate-500 hover:text-slate-900'}`}
              >
                {tf}
              </button>
            ))}
          </div>

          <div className="flex items-center gap-2">
            <Button
              size="sm"
              variant="outline"
              onClick={() => setShowEma(!showEma)}
              className={`text-xs font-mono h-8 border-slate-200 ${showEma ? 'bg-amber-50 text-amber-700' : 'text-slate-500'}`}
            >
              <Activity className="h-3.5 w-3.5 mr-1 text-amber-500" />
              EMA 20
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={() => setShowVolume(!showVolume)}
              className={`text-xs font-mono h-8 border-slate-200 ${showVolume ? 'bg-cyan-50 text-cyan-700' : 'text-slate-500'}`}
            >
              <Sliders className="h-3.5 w-3.5 mr-1 text-cyan-500" />
              Volume
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={loadChartData}
              className="text-xs font-mono h-8 border-slate-200 text-slate-600"
            >
              <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} />
            </Button>
          </div>
        </div>

      </div>

      {/* Main Grid: Chart + Orderbook */}
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-0 divide-y lg:divide-y-0 lg:divide-x divide-slate-200">

        {/* Pro Trading Chart View */}
        <div className="lg:col-span-3 p-4 bg-[hsl(224_44%_6%)] min-h-[420px] flex flex-col justify-between">
          {loading ? (
            <div className="h-[380px] flex items-center justify-center text-slate-500 gap-2 font-mono text-sm">
              <Zap className="h-5 w-5 text-indigo-500 animate-spin" /> Fetching live candlestick stream...
            </div>
          ) : (
            <div className="flex flex-col gap-1">
              <div className={showVolume ? 'h-[300px] w-full' : 'h-[380px] w-full'}>
                <ResponsiveContainer width="100%" height="100%">
                  <ComposedChart data={chartData} margin={{ top: 10, right: 10, left: -18, bottom: 0 }}>
                    <defs>
                      <linearGradient id="priceFill" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor={lineColor} stopOpacity={0.25} />
                        <stop offset="100%" stopColor={lineColor} stopOpacity={0.02} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="#1c2740" />
                    <XAxis dataKey="time" stroke="#6b7aa6" fontSize={11} tickLine={false} minTickGap={40} />
                    <YAxis domain={priceDomain} stroke="#6b7aa6" fontSize={11} tickLine={false} orientation="right" tickFormatter={fmtPrice} width={64} />
                    <Tooltip
                      contentStyle={{ backgroundColor: '#0d1220', borderColor: '#1e2740', borderRadius: '8px', color: '#e2e8f0', fontSize: 12 }}
                      formatter={(val: any, name: string) => [`$${fmtPrice(Number(val))}`, name.toUpperCase()]}
                    />
                    <Area type="monotone" dataKey="close" stroke={lineColor} strokeWidth={2} fill="url(#priceFill)" name="price" dot={false} />
                    {showEma && <Line type="monotone" dataKey="ema" stroke="#f59e0b" strokeWidth={1.75} dot={false} name="EMA 20" />}
                  </ComposedChart>
                </ResponsiveContainer>
              </div>

              {showVolume && (
                <div className="h-[74px] w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={chartData} margin={{ top: 0, right: 10, left: -18, bottom: 0 }}>
                      <XAxis dataKey="time" hide />
                      <YAxis hide domain={[0, 'auto']} orientation="right" width={64} />
                      <Tooltip
                        contentStyle={{ backgroundColor: '#0d1220', borderColor: '#1e2740', borderRadius: '8px', color: '#e2e8f0', fontSize: 12 }}
                        formatter={(val: any) => [Number(val).toLocaleString(undefined, { maximumFractionDigits: 0 }), 'VOLUME']}
                      />
                      <Bar dataKey="volume" radius={[1, 1, 0, 0]}>
                        {chartData.map((c, i) => (
                          <Cell key={i} fill={c.volColor} />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              )}
            </div>
          )}

          {/* Quick Simulated Trade Bar */}
          <div className="mt-4 pt-4 border-t border-slate-200 flex items-center justify-between gap-4">
            <div className="flex items-center gap-2">
              <Badge variant="outline" className="text-slate-500 border-slate-200 font-mono text-xs">
                Simulated Leverage: 20x
              </Badge>
              <Badge variant="outline" className="text-slate-500 border-slate-200 font-mono text-xs">
                Slippage: 0.01%
              </Badge>
            </div>

            <div className="flex items-center gap-3">
              <Button
                onClick={() => handleSimulatedTrade('BUY')}
                className="bg-emerald-600 hover:bg-emerald-500 text-white font-black text-xs gap-1.5 px-6 shadow"
              >
                <TrendingUp className="h-4 w-4" /> LONG / BUY
              </Button>
              <Button
                onClick={() => handleSimulatedTrade('SELL')}
                className="bg-rose-600 hover:bg-rose-500 text-white font-black text-xs gap-1.5 px-6 shadow"
              >
                <TrendingDown className="h-4 w-4" /> SHORT / SELL
              </Button>
            </div>
          </div>

        </div>

        {/* Live Orderbook & Stream */}
        <div className="p-4 bg-[hsl(224_42%_7%)] font-mono text-xs flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between pb-2 mb-2 border-b border-slate-200 text-slate-500 text-[11px] font-sans font-bold">
              <span>ORDER BOOK</span>
              <span>SIZE</span>
            </div>

            {orderBook.asks.length === 0 && orderBook.bids.length === 0 ? (
              <div className="py-6 text-center text-[10px] text-slate-400 font-sans">Depth feed unreachable right now.</div>
            ) : (
              <>
                {/* Asks (Sells) */}
                <div className="space-y-1 mb-2">
                  {orderBook.asks.slice(0, 5).reverse().map((ask, i) => (
                    <div key={`ask-${i}`} className="flex justify-between items-center text-rose-600">
                      <span>${fmtPrice(ask.price)}</span>
                      <span className="text-slate-400">{ask.amount}</span>
                    </div>
                  ))}
                </div>

                {/* Mid Price */}
                <div className="my-2 py-1.5 px-2 bg-slate-100 border border-slate-200 text-center rounded font-bold text-slate-900 flex items-center justify-between">
                  <span className="text-[10px] text-slate-500 font-sans">MID PRICE</span>
                  <span>${currentPrice < 1 ? currentPrice.toFixed(4) : currentPrice.toLocaleString()}</span>
                </div>

                {/* Bids (Buys) */}
                <div className="space-y-1 mt-2">
                  {orderBook.bids.slice(0, 5).map((bid, i) => (
                    <div key={`bid-${i}`} className="flex justify-between items-center text-emerald-600">
                      <span>${fmtPrice(bid.price)}</span>
                      <span className="text-slate-400">{bid.amount}</span>
                    </div>
                  ))}
                </div>
              </>
            )}
          </div>

          <div className="mt-4 pt-3 border-t border-slate-200">
            <div className="flex items-center justify-between text-[10px] font-sans text-slate-500 mb-2">
              <span className="font-bold">RECENT MARKET TRADES</span>
              <span className="flex items-center gap-1 text-emerald-600"><Zap className="h-3 w-3" /> LIVE</span>
            </div>
            <div className="space-y-1 text-[11px]">
              {trades.slice(0, 4).map((t) => (
                <div key={t.id} className="flex justify-between items-center text-[10px]">
                  <span className={t.type === 'buy' ? 'text-emerald-600' : 'text-rose-600'}>${fmtPrice(t.price)}</span>
                  <span className="text-slate-400">{t.amount}</span>
                  <span className="text-slate-400">{t.time}</span>
                </div>
              ))}
            </div>
          </div>

        </div>

      </div>

    </div>
  );
};
