import React, { useEffect, useState } from 'react';
import { fetchTopCryptos } from '@/services/binanceApi';
import { CoinTicker } from '@/types/trading';
import { ArrowUpRight, ArrowDownRight, Flame } from 'lucide-react';

export const TickerTape: React.FC = () => {
  const [tickers, setTickers] = useState<CoinTicker[]>([]);

  useEffect(() => {
    let isMounted = true;
    const load = async () => {
      const data = await fetchTopCryptos();
      if (isMounted) setTickers(data.slice(0, 15));
    };

    load();
    const interval = setInterval(load, 8000);
    return () => {
      isMounted = false;
      clearInterval(interval);
    };
  }, []);

  if (tickers.length === 0) return null;

  return (
    <div className="bg-slate-900/90 border-b border-slate-800/60 overflow-hidden py-1.5 px-2">
      <div className="flex items-center gap-6 animate-marquee whitespace-nowrap scrollbar-none">
        <div className="flex items-center gap-2 text-xs font-bold text-amber-400 px-2 py-0.5 rounded bg-amber-500/10 border border-amber-500/20 shrink-0">
          <Flame className="h-3.5 w-3.5 text-amber-400 animate-pulse" />
          LIVE BINANCE & GOLD
        </div>

        <div className="flex items-center gap-6">
          {tickers.concat(tickers).map((ticker, idx) => {
            const isPos = ticker.change24h >= 0;
            return (
              <div key={`${ticker.symbol}-${idx}`} className="flex items-center gap-2 text-xs font-mono shrink-0">
                <span className="font-bold text-slate-200">{ticker.pair}</span>
                <span className="font-semibold text-slate-100">
                  {ticker.isGold ? `$${ticker.price.toFixed(2)}` : `$${ticker.price < 1 ? ticker.price.toFixed(4) : ticker.price.toLocaleString()}`}
                </span>
                <span className={`flex items-center font-bold text-[11px] ${isPos ? 'text-emerald-400' : 'text-rose-400'}`}>
                  {isPos ? <ArrowUpRight className="h-3 w-3" /> : <ArrowDownRight className="h-3 w-3" />}
                  {isPos ? '+' : ''}{ticker.change24h.toFixed(2)}%
                </span>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};