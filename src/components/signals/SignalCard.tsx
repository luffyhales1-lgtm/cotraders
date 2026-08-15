import React, { useState } from 'react';
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
  Image as ImageIcon,
  ExternalLink,
  Lock,
  Clock,
  Target
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useAuth } from '@/context/AuthContext';
import { generateTradeSetupChartImage } from '@/utils/chartScreenshot';
import { toast } from 'sonner';

interface SignalCardProps {
  signal: Signal;
  onSelectSymbol?: (symbol: string) => void;
}

export const SignalCard: React.FC<SignalCardProps> = ({ signal, onSelectSymbol }) => {
  const { user, instagramUrl, dispatchTelegramSignal, isVipMember } = useAuth();
  const [copied, setCopied] = useState<boolean>(false);
  const [showChartModal, setShowChartModal] = useState<boolean>(false);

  const isLocked = signal.isVipOnly && !isVipMember;
  const isLong = signal.type === 'LONG';

  // Dynamic Chart Setup Screenshot Data URL
  const chartImage = generateTradeSetupChartImage({
    pair: signal.pair,
    type: signal.type,
    entryPrice: signal.entryPrice,
    target1: signal.target1,
    target2: signal.target2,
    target3: signal.target3,
    stopLoss: signal.stopLoss,
    timeframe: signal.timeframe,
    strategy: signal.strategy,
    winProbability: signal.winProbability,
  });

  const copySignalToClipboard = () => {
    const text = `🚨 LIVE AI TRADING SIGNAL 🚨
Pair: ${signal.pair}
Type: ${signal.type} (${signal.leverage})
Strategy: ${signal.strategy}
Entry: $${signal.entryPrice}
TP1: $${signal.target1}
TP2: $${signal.target2}
TP3: $${signal.target3}
Stop Loss: $${signal.stopLoss}
Win Probability: ${signal.winProbability}%
R:R Ratio: ${signal.riskReward}
Platform: LiveTrading AI Pro`;

    navigator.clipboard.writeText(text);
    setCopied(true);
    toast.success(`Signal parameters for ${signal.pair} copied to clipboard!`);
    setTimeout(() => setCopied(false), 3000);
  };

  const handleTelegramBroadcast = () => {
    dispatchTelegramSignal({
      pair: signal.pair,
      type: signal.type,
      strategy: signal.strategy,
      timeframe: signal.timeframe,
      entryPrice: signal.entryPrice,
      target1: signal.target1,
      target2: signal.target2,
      target3: signal.target3,
      stopLoss: signal.stopLoss,
      leverage: signal.leverage,
      winProbability: signal.winProbability,
      riskReward: signal.riskReward,
      rationale: signal.rationale,
      chartScreenshotUrl: chartImage,
    });
  };

  return (
    <Card className={`relative overflow-hidden bg-slate-900/95 border transition-all duration-400 ${isLocked ? 'border-amber-500/30' : isLong ? 'border-emerald-500/40 hover:border-emerald-500/70 shadow-emerald-950/30' : 'border-rose-500/40 hover:border-rose-500/70 shadow-rose-950/30'} shadow-xl`}>
      
      {/* Top Banner Status */}
      <div className={`px-5 py-2.5 border-b flex items-center justify-between text-xs font-bold ${isLong ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400' : 'bg-rose-500/10 border-rose-500/20 text-rose-400'}`}>
        <div className="flex items-center gap-2">
          {isLong ? <TrendingUp className="h-4 w-4" /> : <TrendingDown className="h-4 w-4" />}
          <span>{signal.type} SIGNAL ({signal.leverage})</span>
        </div>
        <div className="flex items-center gap-3">
          <Badge variant="outline" className="text-[10px] bg-slate-950/60 border-slate-700 text-slate-300 font-mono">
            {signal.timeframe}
          </Badge>
          <span className="text-[10px] text-slate-400 flex items-center gap-1.5">
            <Clock className="h-4 w-4" /> {signal.timestamp}
          </span>
        </div>
      </div>

      <CardHeader className="p-5 pb-3">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="font-extrabold text-lg text-slate-100 flex items-center gap-2.5">
              {signal.pair}
              {signal.symbol === 'XAUUSDT' && (
                <Badge className="bg-amber-500/20 text-amber-300 border-amber-500/40 text-[10px]">GOLD</Badge>
              )}
            </h3>
            <p className="text-xs text-indigo-400 font-medium flex items-center gap-1 mt-0.5">
              <Zap className="h-4 w-4" /> {signal.strategy}
            </p>
          </div>

          <div className="text-right">
            <div className="text-xs font-bold text-emerald-400 font-mono">
              {signal.winProbability}% Win Rate
            </div>
            <div className="text-[10px] text-slate-400 font-mono">RR {signal.riskReward}</div>
          </div>
        </div>
      </CardHeader>

      <CardContent className="p-5 pt-3">
        
        {/* Blur overlay if locked for free users */}
        {isLocked ? (
          <div className="relative py-8 px-6 bg-slate-950/85 rounded-xl border border-amber-500/30 text-center flex flex-col items-center justify-center my-4 backdrop-blur-sm">
            <div className="h-12 w-12 rounded-full bg-amber-500/20 border border-amber-500/40 flex items-center justify-center mb-3">
              {/* Replaced Lock icon with text to avoid Illegal constructor error */}
              <span className="h-7 w-7 text-amber-400">LOCK</span>
            </div>
            <h4 className="font-extrabold text-sm text-slate-100">VIP Exclusive AI Signal</h4>
            <p className="text-xs text-slate-400 mt-2 max-w-xs">
              Targets, Stop Loss & SMC Rationale locked for Free accounts.
            </p>
            <a href={instagramUrl} target="_blank" rel="noopener noreferrer" className="mt-4">
              <Button size="sm" className="bg-amber-500 hover:bg-amber-400 text-slate-950 font-black text-xs gap-1.5 py-4 px-6 shadow-lg shadow-amber-500/20 transition-all duration-300">
                <Crown className="h-4 w-4" /> Unlock via Instagram
                <ExternalLink className="h-4 w-4" />
              </Button>
            </a>
          </div>
        ) : (
          <div>
            {/* Entry, TP & SL Grid */}
            <div className="grid grid-cols-2 gap-3 my-4 font-mono text-xs">
              
              <div className="p-3 rounded-lg bg-slate-950 border border-slate-800">
                <span className="text-[11px] text-slate-400 block font-sans">ENTRY PRICE</span>
                <span className="font-bold text-slate-100">${signal.entryPrice}</span>
              </div>

              <div className="p-3 rounded-lg bg-slate-950 border border-slate-800">
                <span className="text-[11px] text-rose-400 block font-sans">STOP LOSS</span>
                <span className="font-bold text-rose-400">${signal.stopLoss}</span>
              </div>

              <div className="p-3 rounded-lg bg-slate-950 border border-slate-800">
                <span className="text-[11px] text-emerald-400 block font-sans">TARGET 1 (TP1)</span>
                <span className="font-bold text-emerald-400">${signal.target1}</span>
              </div>

              <div className="p-3 rounded-lg bg-slate-950 border border-slate-800">
                <span className="text-[11px] text-emerald-400 block font-sans">TARGET 2 (TP2)</span>
                <span className="font-bold text-emerald-400">${signal.target2}</span>
              </div>

            </div>

            <p className="text-xs text-slate-400 bg-slate-950/60 p-3 rounded-lg border border-slate-800/80 mb-4 leading-relaxed">
              <span className="text-slate-300 font-bold">AI Rationale:</span> {signal.rationale}
            </p>

            <div className="grid grid-cols-2 gap-3">
              <Button 
                onClick={() => setShowChartModal(true)}
                variant="outline"
                size="sm"
                className="border-slate-800 hover:bg-slate-800 text-cyan-300 text-xs font-bold gap-1.5"
              >
                <ImageIcon className="h-4 w-4 text-cyan-400" />
                Chart Screenshot
              </Button>

              {user?.isAdmin ? (
                <Button 
                  onClick={handleTelegramBroadcast}
                  size="sm" 
                  className="bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold gap-1.5"
                >
                  <Send className="h-4 w-4" />
                  Telegram
                </Button>
              ) : onSelectSymbol ? (
                <Button 
                  onClick={() => onSelectSymbol(signal.symbol)}
                  variant="outline" 
                  size="sm" 
                  className="border-slate-800 hover:bg-slate-800 text-slate-200 text-xs font-bold gap-2"
                >
                  <Target className="h-4 w-4 text-indigo-400" />
                  Load Chart
                </Button>
              ) : null}
            </div>
          </div>
        )}

      </CardContent>

      {/* Chart Screenshot Modal */}
      {showChartModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-6 bg-slate-950/95 backdrop-blur-md">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-[480px] w-full p-6 overflow-hidden shadow-2xl">
            <div className="flex items-center justify-between pb-4 border-b border-slate-800 mb-4">
              <span className="font-bold text-sm text-slate-100 flex items-center gap-2.5">
                <ImageIcon className="h-5 w-5 text-cyan-400" />
                {signal.pair} Trade Setup Chart Screenshot
              </span>
              <Button size="sm" variant="ghost" onClick={() => setShowChartModal(false)} className="text-slate-400">
                Close
              </Button>
            </div>

            <img 
              src={chartImage} 
              alt="Trade Setup Chart Screenshot" 
              className="w-full rounded-xl border border-slate-800 shadow-lg"
            />

            <div className="mt-4 flex items-center justify-between">
              <Button size="sm" variant="outline" onClick={copySignalToClipboard} className="border-slate-800 text-xs font-bold text-slate-300">
                {copied ? 'Parameters Copied!' : 'Copy Signal text'}
              </Button>
              <Button size="sm" onClick={() => setShowChartModal(false)} className="bg-indigo-600 text-white font-bold text-xs">
                Done
              </Button>
            </div>
          </div>
        </div>
      )}

    </Card>
  );
};