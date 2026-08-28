import React, { useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Navbar } from '@/components/layout/Navbar';
import { TickerTape } from '@/components/layout/TickerTape';
import { MobileNav } from '@/components/layout/MobileNav';
import { UpgradeBanner } from '@/components/subscription/UpgradeBanner';
import { AmbientBackground } from '@/components/effects/AmbientBackground';
import { AnalysisVideoStudio } from '@/components/trading/AnalysisVideoStudio';
import { Badge } from '@/components/ui/badge';
import { Video, Radio } from 'lucide-react';

/**
 * ANALYSIS VIDEO
 *
 * Deep-linkable from any signal card: /analysis-video?symbol=BTCUSDT&pair=BTC/USDT&mode=SCALP&auto=1
 * The studio re-runs the FULL live analysis (21 strategies, higher timeframes, order book)
 * and renders it as a recordable video. Nothing pre-rendered, nothing from stored candles.
 */
const AnalysisVideoPage: React.FC = () => {
  const [params] = useSearchParams();

  const symbol = (params.get('symbol') ?? 'BTCUSDT').toUpperCase();
  const pair = params.get('pair') ?? undefined;
  const mode = params.get('mode')?.toUpperCase() === 'SWING' ? 'SWING' : 'SCALP';
  const autoRun = params.get('auto') === '1';

  // Remount the studio when the deep link changes so a new signal starts clean.
  const studioKey = useMemo(() => `${symbol}-${mode}-${autoRun ? 'auto' : 'manual'}`, [symbol, mode, autoRun]);

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 font-sans pb-16 md:pb-0">
      <AmbientBackground />
      <TickerTape />
      <Navbar />

      <main className="relative z-10 max-w-7xl mx-auto px-4 lg:px-8 py-8">
        <UpgradeBanner />

        <div className="mb-8 animate-fade-up">
          <Badge className="bg-indigo-100 text-indigo-700 border-indigo-200 font-bold mb-2">
            <Video className="h-3.5 w-3.5 mr-1" /> LIVE ANALYSIS VIDEO
          </Badge>
          <h1 className="text-3xl font-black text-slate-900 text-shimmer">Watch the analysis behind the signal</h1>
          <p className="text-sm text-slate-500 mt-1 max-w-3xl">
            Every video is built the moment you press Analyse: all 21 strategies are re-run on live candles, the
            higher timeframes are re-checked, and the live order book is read for liquidity. The video shows which
            strategies fired and why, which timeframes confirmed, whether liquidity passed, and the exact entry,
            stop and target — or it says NO TRADE and names the check that failed.
          </p>
          <div className="flex flex-wrap items-center gap-2 mt-3 text-[11px]">
            <Badge className="bg-emerald-100 text-emerald-700 border-emerald-200 gap-1">
              <Radio className="h-3 w-3" /> Live market data only
            </Badge>
            <Badge className="bg-slate-100 text-slate-700 border-slate-200">No stored or pre-recorded clips</Badge>
            <Badge className="bg-slate-100 text-slate-700 border-slate-200">Downloadable .webm</Badge>
          </div>
        </div>

        <AnalysisVideoStudio
          key={studioKey}
          initialSymbol={symbol}
          initialPair={pair}
          initialMode={mode}
          autoRun={autoRun}
        />

        <div className="mt-6 p-4 rounded-2xl glass-panel">
          <h2 className="text-sm font-extrabold text-slate-900 mb-2">How to verify a signal is real</h2>
          <p className="text-xs text-slate-600 leading-relaxed">
            Open any signal card and press <span className="font-bold text-indigo-600">Watch analysis</span>. This
            page will re-analyse that exact market right now. If the signal was genuine, the gate list here will
            show the same checks passing; if the market has since changed, the fresh analysis will say so instead of
            pretending otherwise. The video is generated from that live run, so it can never disagree with the data
            it was built from. Backtested and live performance are not guarantees of future results, and nothing
            here is financial advice.
          </p>
        </div>
      </main>

      <MobileNav />
    </div>
  );
};

export default AnalysisVideoPage;
