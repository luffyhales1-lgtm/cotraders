import React from 'react';
import { Signal } from '@/types/trading';
import { useAuth } from '@/context/AuthContext';
import { 
  TrendingUp, 
  TrendingDown, 
  Lock, 
  Crown, 
  Target, 
  Copy, 
  Check, 
  Clock, 
  Sparkles, 
  ExternalLink, 
  Zap, 
  Send 
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { toast } from 'sonner';

interface SignalCardProps {
  signal: Signal;
  onSelectSymbol?: (symbol: string) => void;
}

export const SignalCard: React.FC<SignalCardProps> = ({ signal, onSelectSymbol }) => {
  const { user, instagramUrl, dispatchTelegramSignal, isVipMember } = useAuth();
  const [copied, setCopied] = React.useState<boolean>(false);

  const isLocked = signal.isVipOnly && !isVipMember;
  const isLong = signal.type === 'LONG';

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
    });
  };

  return (
    <Card className={`relative overflow-hidden bg-slate-900/90 border transition-all duration-300 ${isLocked ? 'border-amber-500/30' : isLong ? 'border-emerald-500/40 hover:border-emerald-500/70 shadow-emerald-950/20' : 'border-rose-500/40 hover:border-rose-500/70 shadow-rose-950/20'} shadow-xl`}>
      
      {/* Top Banner Status */}
      <div className={`px-4 py-2 border-b flex items-center justify-between text-xs font-bold ${isLong ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400' : 'bg-rose-500/10 border-rose-500/20 text-rose-400'}`}>
        <div className="flex items-center gap-1.5">
          {isLong ? <TrendingUp className="h-4 w-4" /> : <TrendingDown className="h-4 w-4" />}
          <span>{signal.type} SIGNAL ({signal.leverage})</span>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant="outline" className="text-[10px] bg-slate-950/60 border-slate-700 text-slate-300 font-mono">
            {signal.timeframe}
          </Badge>
          <span className="text-[10px] text-slate-400 flex items-center gap-1">
            <Clock className="h-3 w-3" /> {signal.timestamp}
          </span>
        </div>
      </div>

      <CardHeader className="p-4 pb-2">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="font-extrabold text-lg text-slate-100 flex items-center gap-2">
              {signal.pair}
              {signal.symbol === 'XAUUSDT' && (
                <Badge className="bg-amber-500/20 text-amber-300 border-amber-500/40 text-[10px]">GOLD</Badge>
              )}
            </h3>
            <p className="text-xs text-indigo-400 font-medium flex items-center gap-1 mt-0.5">
              <Zap className="h-3 w-3" /> {signal.strategy}
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

      <CardContent className="p-4 pt-2">
        
        {/* Blur overlay if locked for free users */}
        {isLocked ? (
          <div className="relative py-6 px-4 bg-slate-950/80 rounded-xl border border-amber-500/30 text-center flex flex-col items-center justify-center my-2 backdrop-blur-sm">
            <div className="h-10 w-10 rounded-full bg-amber-500/20 border border-amber-500/40 flex items-center justify-center mb-2">
              <Lock className="h-5 w-5 text-amber-400" />
            </div>
            <h4 className="font-extrabold text-sm text-slate-100">VIP Exclusive AI Signal</h4>
            <p className="text-xs text-slate-400 mt-1 max-w-xs">
              Targets, Stop Loss & SMC Rationale locked for Free accounts.
            </p>
            <a href={instagramUrl} target="_blank" rel="noopener noreferrer" className="mt-3">
              <Button size="sm" className="bg-amber-500 hover:bg-amber-400 text-slate-950 font-black text-xs gap-1 shadow-lg shadow-amber-500/20">
                <Crown className="h-3.5 w-3.5" /> Unlock via Instagram
                <ExternalLink className="h-3 w-3" />
              </Button>
            </a>
          </div>
        ) : (
          <div>
            {/* Entry, TP & SL Grid */}
            <div className="grid grid-cols-2 gap-2 my-3 font-mono text-xs">
              
              <div className="p-2.5 rounded-lg bg-slate-950 border border-slate-800">
                <span className="text-[10px] text-slate-400 block font-sans">ENTRY PRICE</span>
                <span className="font-bold text-slate-100">${signal.entryPrice}</span>
              </div>

              <div className="p-2.5 rounded-lg bg-slate-950 border border-slate-800">
                <span className="text-[10px] text-rose-400 block font-sans">STOP LOSS</span>
                <span className="font-bold text-rose-400">${signal.stopLoss}</span>
              </div>

              <div className="p-2.5 rounded-lg bg-slate-950 border border-slate-800">
                <span className="text-[10px] text-emerald-400 block font-sans">TARGET 1 (TP1)</span>
                <span className="font-bold text-emerald-400">${signal.target1}</span>
              </div>

              <div className="p-2.5 rounded-lg bg-slate-950 border border-slate-800">
                <span className="text-[10px] text-emerald-400 block font-sans">TARGET 2 (TP2)</span>
                <span className="font-bold text-emerald-400">${signal.target2}</span>
              </div>

            </div>

            <p className="text-xs text-slate-400 bg-slate-950/60 p-2.5 rounded-lg border border-slate-800/80 mb-3 leading-relaxed">
              <span className="text-slate-300 font-bold">AI Rationale:</span> {signal.rationale}
            </p>

            <div className="grid grid-cols-2 gap-2">
              <Button 
                onClick={copySignalToClipboard}
                variant="outline"
                size="sm"
                className="border-slate-800 hover:bg-slate-800 text-slate-300 text-xs font-bold gap-1"
              >
                {copied ? <Check className="h-3.5 w-3.5 text-emerald-400" /> : <Copy className="h-3.5 w-3.5 text-amber-400" />}
                {copied ? 'Copied!' : 'Copy Signal'}
              </Button>

              {user?.isAdmin ? (
                <Button 
                  onClick={handleTelegramBroadcast}
                  size="sm" 
                  className="bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold gap-1"
                >
                  <Send className="h-3.5 w-3.5" />
                  Telegram
                </Button>
              ) : onSelectSymbol ? (
                <Button 
                  onClick={() => onSelectSymbol(signal.symbol)}
                  variant="outline" 
                  size="sm" 
                  className="border-slate-800 hover:bg-slate-800 text-slate-200 text-xs font-bold gap-1.5"
                >
                  <Target className="h-3.5 w-3.5 text-indigo-400" />
                  Load Chart
                </Button>
              ) : null}
            </div>
          </div>
        )}

      </CardContent>

    </Card>
  );
};