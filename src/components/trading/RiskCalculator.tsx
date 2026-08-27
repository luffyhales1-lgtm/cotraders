import React, { useState } from 'react';
import { Calculator, DollarSign, Shield, Percent, Target } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';

export const RiskCalculator: React.FC = () => {
  const [accountBalance, setAccountBalance] = useState<number>(10000);
  const [riskPercent, setRiskPercent] = useState<number>(2);
  const [entryPrice, setEntryPrice] = useState<number>(96420);
  const [stopLossPrice, setStopLossPrice] = useState<number>(95000);
  const [targetPrice, setTargetPrice] = useState<number>(99500);

  const riskAmount = (accountBalance * riskPercent) / 100;
  const priceDistanceSL = Math.abs(entryPrice - stopLossPrice);
  const priceDistanceTP = Math.abs(targetPrice - entryPrice);

  const positionUnits = priceDistanceSL > 0 ? (riskAmount / priceDistanceSL) : 0;
  const positionValueUsd = positionUnits * entryPrice;

  const rewardAmount = positionUnits * priceDistanceTP;
  const riskRewardRatio = priceDistanceSL > 0 ? (priceDistanceTP / priceDistanceSL).toFixed(2) : '0.00';

  return (
    <div className="p-5 rounded-2xl glass-panel shadow-xl font-sans text-slate-900">

      <div className="flex items-center justify-between pb-3 mb-4 border-b border-slate-200">
        <div className="flex items-center gap-2">
          <div className="h-8 w-8 rounded-lg bg-emerald-100 border border-emerald-200 flex items-center justify-center">
            <Calculator className="h-4 w-4 text-emerald-600" />
          </div>
          <div>
            <h3 className="font-extrabold text-sm text-slate-900">Smart Position & Risk Calculator</h3>
            <p className="text-[10px] text-slate-500">Institutional Lot Size & Leverage Estimator</p>
          </div>
        </div>
        <Badge variant="outline" className="text-[10px] border-emerald-200 text-emerald-600 font-mono">
          R:R 1:{riskRewardRatio}
        </Badge>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-4">

        <div>
          <label className="text-[11px] text-slate-500 font-bold block mb-1">Account Balance ($)</label>
          <Input
            type="number"
            value={accountBalance}
            onChange={(e) => setAccountBalance(Number(e.target.value))}
            className="bg-white border-slate-200 text-xs font-mono text-slate-900"
          />
        </div>

        <div>
          <label className="text-[11px] text-slate-500 font-bold block mb-1">Risk per Trade (%)</label>
          <Input
            type="number"
            step="0.5"
            value={riskPercent}
            onChange={(e) => setRiskPercent(Number(e.target.value))}
            className="bg-white border-slate-200 text-xs font-mono text-emerald-600 font-bold"
          />
        </div>

        <div>
          <label className="text-[11px] text-slate-500 font-bold block mb-1">Entry Price ($)</label>
          <Input
            type="number"
            value={entryPrice}
            onChange={(e) => setEntryPrice(Number(e.target.value))}
            className="bg-white border-slate-200 text-xs font-mono text-slate-900"
          />
        </div>

        <div>
          <label className="text-[11px] text-rose-600 font-bold block mb-1">Stop Loss ($)</label>
          <Input
            type="number"
            value={stopLossPrice}
            onChange={(e) => setStopLossPrice(Number(e.target.value))}
            className="bg-white border-slate-200 text-xs font-mono text-rose-600 font-bold"
          />
        </div>

        <div>
          <label className="text-[11px] text-emerald-600 font-bold block mb-1">Take Profit Target ($)</label>
          <Input
            type="number"
            value={targetPrice}
            onChange={(e) => setTargetPrice(Number(e.target.value))}
            className="bg-white border-slate-200 text-xs font-mono text-emerald-600 font-bold"
          />
        </div>

        <div className="flex items-end">
          <div className="w-full p-2.5 rounded-lg bg-slate-50 border border-slate-200 text-center">
            <span className="text-[10px] text-slate-500 block font-bold">MAX RISK AMOUNT</span>
            <span className="text-sm font-black text-rose-600 font-mono">${riskAmount.toFixed(2)}</span>
          </div>
        </div>

      </div>

      {/* Output Summary */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-2 p-3 rounded-xl bg-slate-50 border border-slate-200 font-mono text-xs">
        <div>
          <span className="text-[10px] text-slate-500 font-sans block">POSITION SIZE</span>
          <span className="font-bold text-slate-900">{positionUnits.toFixed(4)} Units</span>
        </div>

        <div>
          <span className="text-[10px] text-slate-500 font-sans block">TOTAL VALUE</span>
          <span className="font-bold text-indigo-600">${positionValueUsd.toLocaleString(undefined, { maximumFractionDigits: 2 })}</span>
        </div>

        <div>
          <span className="text-[10px] text-emerald-600 font-sans block">ESTIMATED PROFIT</span>
          <span className="font-bold text-emerald-600">+${rewardAmount.toFixed(2)}</span>
        </div>

        <div>
          <span className="text-[10px] text-amber-600 font-sans block">RISK TO REWARD</span>
          <span className="font-bold text-amber-600">1 : {riskRewardRatio}</span>
        </div>
      </div>

    </div>
  );
};