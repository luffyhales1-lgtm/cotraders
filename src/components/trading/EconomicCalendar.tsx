import React, { useEffect, useState } from 'react';
import { Calendar, AlertTriangle, Clock } from 'lucide-react';
import { Badge } from '@/components/ui/badge';

/**
 * LIVE macro calendar. Instead of hard-coded "Today / Tomorrow" rows with stale
 * forecast numbers, every event's next occurrence is COMPUTED from the current
 * date using the real recurring release schedule (weekly jobless claims, first-
 * Friday NFP, monthly CPI/PPI, the published FOMC decision dates, and the
 * last-Friday crypto options expiry). The list re-sorts by soonest and shows a
 * live countdown that ticks every minute — so it's always current, never stale.
 */

type Impact = 'HIGH' | 'MEDIUM' | 'LOW';

interface MacroEvent {
  id: string;
  when: Date;          // next occurrence (absolute)
  currency: 'USD' | 'CRYPTO';
  event: string;
  impact: Impact;
  assetAffected: string;
  watch: string;       // what to watch for (no fabricated forecast numbers)
}

// ---- date helpers (all scheduling done in UTC for determinism) -------------
const atUTC = (y: number, mo: number, d: number, h: number, mi: number) =>
  new Date(Date.UTC(y, mo, d, h, mi));

/** Next date at/after `from` whose UTC weekday === dow, at h:mi UTC. */
function nextWeekdayUTC(from: Date, dow: number, h: number, mi: number): Date {
  const d = atUTC(from.getUTCFullYear(), from.getUTCMonth(), from.getUTCDate(), h, mi);
  let add = (dow - d.getUTCDay() + 7) % 7;
  if (add === 0 && d.getTime() < from.getTime()) add = 7;
  d.setUTCDate(d.getUTCDate() + add);
  return d;
}

/** The `nth` (1-based) weekday `dow` of a given month, at h:mi UTC. */
function nthWeekdayOfMonthUTC(y: number, mo: number, dow: number, nth: number, h: number, mi: number): Date {
  const first = atUTC(y, mo, 1, h, mi);
  const offset = (dow - first.getUTCDay() + 7) % 7;
  first.setUTCDate(1 + offset + (nth - 1) * 7);
  return first;
}

/** The LAST weekday `dow` of a given month, at h:mi UTC. */
function lastWeekdayOfMonthUTC(y: number, mo: number, dow: number, h: number, mi: number): Date {
  const last = atUTC(y, mo + 1, 0, h, mi); // day 0 of next month = last day of this month
  const back = (last.getUTCDay() - dow + 7) % 7;
  last.setUTCDate(last.getUTCDate() - back);
  return last;
}

/** First occurrence of a monthly release (fixed day-of-month) at/after `from`. */
function nextMonthlyDayUTC(from: Date, day: number, h: number, mi: number): Date {
  let y = from.getUTCFullYear();
  let mo = from.getUTCMonth();
  let d = atUTC(y, mo, day, h, mi);
  if (d.getTime() < from.getTime()) {
    mo += 1;
    if (mo > 11) { mo = 0; y += 1; }
    d = atUTC(y, mo, day, h, mi);
  }
  return d;
}

function nextFirstFriday(from: Date, h: number, mi: number): Date {
  const thisMonth = nthWeekdayOfMonthUTC(from.getUTCFullYear(), from.getUTCMonth(), 5, 1, h, mi);
  if (thisMonth.getTime() >= from.getTime()) return thisMonth;
  const y = from.getUTCMonth() === 11 ? from.getUTCFullYear() + 1 : from.getUTCFullYear();
  const mo = (from.getUTCMonth() + 1) % 12;
  return nthWeekdayOfMonthUTC(y, mo, 5, 1, h, mi);
}

function nextLastFriday(from: Date, h: number, mi: number): Date {
  const thisMonth = lastWeekdayOfMonthUTC(from.getUTCFullYear(), from.getUTCMonth(), 5, h, mi);
  if (thisMonth.getTime() >= from.getTime()) return thisMonth;
  const y = from.getUTCMonth() === 11 ? from.getUTCFullYear() + 1 : from.getUTCFullYear();
  const mo = (from.getUTCMonth() + 1) % 12;
  return lastWeekdayOfMonthUTC(y, mo, 5, h, mi);
}

// Published FOMC rate-decision dates (decision day). Announced ~2y ahead by the
// Fed; times shown at 18:00 UTC (2:00pm ET). Next upcoming is picked at runtime.
const FOMC_DATES_UTC = [
  '2025-09-17', '2025-10-29', '2025-12-10',
  '2026-01-28', '2026-03-18', '2026-04-29', '2026-06-17',
  '2026-07-29', '2026-09-17', '2026-10-28', '2026-12-09',
  '2027-01-27', '2027-03-17',
];

function nextFomc(from: Date): Date | null {
  for (const ds of FOMC_DATES_UTC) {
    const [y, m, d] = ds.split('-').map(Number);
    const dt = atUTC(y, m - 1, d, 18, 0);
    if (dt.getTime() >= from.getTime()) return dt;
  }
  return null;
}

function buildEvents(now: Date): MacroEvent[] {
  const events: MacroEvent[] = [];

  // US Initial Jobless Claims — every Thursday 12:30 UTC (8:30 ET)
  events.push({
    id: 'jobless', when: nextWeekdayUTC(now, 4, 12, 30), currency: 'USD',
    event: 'US Initial Jobless Claims', impact: 'MEDIUM', assetAffected: 'DXY · Gold · BTC',
    watch: 'Labor-market pulse — hot prints lift the dollar and pressure risk.',
  });

  // US CPI (Inflation) — monthly, ~12th 12:30 UTC
  events.push({
    id: 'cpi', when: nextMonthlyDayUTC(now, 12, 12, 30), currency: 'USD',
    event: 'US CPI Inflation Rate (MoM / YoY)', impact: 'HIGH', assetAffected: 'XAU/USD · BTC · ETH',
    watch: 'Top rate-path driver — a hot number = risk-off, a soft one = risk-on.',
  });

  // US PPI — monthly, ~13th 12:30 UTC
  events.push({
    id: 'ppi', when: nextMonthlyDayUTC(now, 13, 12, 30), currency: 'USD',
    event: 'US Producer Price Index (PPI)', impact: 'MEDIUM', assetAffected: 'DXY · Metals',
    watch: 'Pipeline inflation — confirms or fades the CPI read.',
  });

  // US Non-Farm Payrolls — first Friday 12:30 UTC
  events.push({
    id: 'nfp', when: nextFirstFriday(now, 12, 30), currency: 'USD',
    event: 'US Non-Farm Payrolls (NFP) & Unemployment', impact: 'HIGH', assetAffected: 'All FX · Metals · Crypto',
    watch: 'The month\'s biggest FX/metals volatility event.',
  });

  // FOMC decision
  const fomc = nextFomc(now);
  if (fomc) {
    events.push({
      id: 'fomc', when: fomc, currency: 'USD',
      event: 'FOMC Rate Decision & Statement', impact: 'HIGH', assetAffected: 'Gold · Crypto · DXY',
      watch: 'Rate path + tone set the macro regime for weeks.',
    });
  }

  // Crypto monthly options expiry — last Friday 08:00 UTC
  events.push({
    id: 'expiry', when: nextLastFriday(now, 8, 0), currency: 'CRYPTO',
    event: 'Deribit BTC/ETH Monthly Options Expiry', impact: 'HIGH', assetAffected: 'BTC · ETH · SOL',
    watch: 'Large notional rolls off — expect max-pain magnet & post-expiry moves.',
  });

  return events.filter(e => e.when.getTime() > now.getTime() - 60_000).sort((a, b) => a.when.getTime() - b.when.getTime());
}

function countdown(when: Date, now: Date): string {
  let diff = Math.floor((when.getTime() - now.getTime()) / 1000);
  if (diff <= 60) return 'Live now';
  const d = Math.floor(diff / 86400); diff -= d * 86400;
  const h = Math.floor(diff / 3600); diff -= h * 3600;
  const m = Math.floor(diff / 60);
  if (d > 0) return `in ${d}d ${h}h`;
  if (h > 0) return `in ${h}h ${m}m`;
  return `in ${m}m`;
}

function formatWhen(when: Date): string {
  return when.toLocaleString([], {
    weekday: 'short', month: 'short', day: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });
}

const impactStyle: Record<Impact, string> = {
  HIGH: 'bg-rose-100 text-rose-700 border-rose-200',
  MEDIUM: 'bg-amber-100 text-amber-700 border-amber-200',
  LOW: 'bg-slate-100 text-slate-600 border-slate-200',
};

export const EconomicCalendar: React.FC = () => {
  const [now, setNow] = useState<Date>(new Date());

  // tick every minute so countdowns stay live and past events roll off
  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 60_000);
    return () => clearInterval(t);
  }, []);

  const events = buildEvents(now);

  return (
    <div className="p-5 rounded-2xl glass-panel shadow-xl font-sans text-slate-900">
      <div className="flex items-center justify-between pb-3 mb-4 border-b border-slate-200">
        <div className="flex items-center gap-2">
          <div className="h-8 w-8 rounded-lg bg-rose-100 border border-rose-200 flex items-center justify-center">
            <Calendar className="h-4 w-4 text-rose-600" />
          </div>
          <div>
            <h3 className="font-extrabold text-sm text-slate-900">High-Impact Macro Calendar</h3>
            <p className="text-[10px] text-slate-500">Live upcoming schedule · FOMC, CPI, NFP & crypto expiries</p>
          </div>
        </div>
        <Badge className="bg-rose-100 text-rose-700 border-rose-200 text-[10px] gap-1">
          <AlertTriangle className="h-3 w-3" /> VOLATILITY WATCH
        </Badge>
      </div>

      <div className="space-y-2.5 text-xs">
        {events.map((ev) => {
          const soon = ev.when.getTime() - now.getTime() < 24 * 3600 * 1000;
          return (
            <div key={ev.id} className="p-3 rounded-xl bg-slate-50 border border-slate-200 flex flex-col md:flex-row md:items-center justify-between gap-2">
              <div className="flex items-center gap-3">
                <span className="px-2 py-1 rounded bg-white border border-slate-200 text-slate-600 font-bold text-[10px]">
                  {ev.currency}
                </span>
                <div>
                  <span className="font-bold text-slate-900 block">{ev.event}</span>
                  <span className="text-[10px] text-slate-500 flex items-center gap-1 mt-0.5">
                    <Clock className="h-3 w-3 text-slate-400" /> {formatWhen(ev.when)}
                    <span className={`ml-1 font-bold ${soon ? 'text-rose-600' : 'text-indigo-600'}`}>· {countdown(ev.when, now)}</span>
                  </span>
                </div>
              </div>

              <div className="flex items-center gap-4 md:text-right">
                <div className="min-w-0">
                  <span className="text-[10px] text-slate-400 block">AFFECTS</span>
                  <span className="text-amber-600 font-bold">{ev.assetAffected}</span>
                </div>
                <Badge className={`${impactStyle[ev.impact]} text-[9px] shrink-0`}>
                  {ev.impact}
                </Badge>
              </div>
            </div>
          );
        })}
      </div>

      <p className="text-[10px] text-slate-400 mt-3 leading-relaxed">
        Auto-generated from the recurring macro-release schedule and published FOMC dates, shown in your local time. Exact print times can shift — always confirm with your broker/economic calendar before trading the event.
      </p>
    </div>
  );
};
