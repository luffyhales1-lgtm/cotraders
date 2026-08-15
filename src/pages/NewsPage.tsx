import React, { useState, useEffect } from 'react';
import { Navbar } from '@/components/layout/Navbar';
import { TickerTape } from '@/components/layout/TickerTape';
import { UpgradeBanner } from '@/components/subscription/UpgradeBanner';
import { Newspaper, Flame, ExternalLink, Lock } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/context/AuthContext';

const NewsPage: React.FC = () => {
  const { user, instagramUrl } = useAuth();
  const [news, setNews] = useState<Array<any>>([]);
  const [loading, setLoading] = useState<boolean>(false);

  useEffect(() => {
    const fetchNews = async () => {
      setLoading(true);
      try {
        // Simulate fetching from a news API
        // In a real app, you would call an actual news API like NewsAPI, Bloomberg, etc.
        const simulatedNews = [
          {
            id: 'news-1',
            title: 'Gold Spot Hits $2,894 as Macro Futures Inflow Surges',
            source: 'Bloomberg Terminal',
            time: '2 mins ago',
            summary: 'Binance Futures and Gold Spot markets report historic Cumulative Volume Delta (CVD) accumulation.',
            sentiment: 'BULLISH' as const,
            impact: 'HIGH' as const,
            isVipOnly: false,
          },
          {
            id: 'news-2',
            title: 'Binance Futures Orderbook Liquidity Wall Breach at $96,500',
            source: 'CoinDesk Pro',
            time: '12 mins ago',
            summary: 'Footprint delta analysis highlights massive institutional absorption of ask spoofing walls.',
            sentiment: 'BULLISH' as const,
            impact: 'HIGH' as const,
            isVipOnly: false,
          },
          {
            id: 'news-3',
            title: 'Hyperliquid Whale Activity Detected: $50M BTC Long Position',
            source: 'Whale Alert',
            time: '5 mins ago',
            summary: 'Large whale movement detected on Hyperliquid with significant BTC accumulation.',
            sentiment: 'BULLISH' as const,
            impact: 'HIGH' as const,
            isVipOnly: true,
          },
          {
            id: 'news-4',
            title: 'Federal Reserve Signals Potential Rate Cut in Q3',
            source: 'Reuters',
            time: '18 mins ago',
            summary: 'Fed officials hint at possible monetary policy easing as inflation cools.',
            sentiment: 'BULLISH' as const,
            impact: 'HIGH' as const,
            isVipOnly: false,
          }
        ];
        
        setNews(simulatedNews);
        setLoading(false);
      } catch (error) {
        console.error('Error fetching news:', error);
        setLoading(false);
      }
    };

    fetchNews();
    
    // Refresh news every 1 minute
    const interval = setInterval(fetchNews, 60 * 1000);
    
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 font-sans">
      <TickerTape />
      <Navbar />

      <main className="max-w-7xl mx-auto px-4 lg:px-8 py-8">
        <UpgradeBanner />

        <div className="mb-8">
          <h1 className="text-3xl font-black text-slate-100 flex items-center gap-2">
            <Newspaper className="h-7 w-7 text-rose-400" />
            Institutional Intelligence & Gold News
          </h1>
          <p className="text-sm text-slate-400 mt-1">Real-time market sentiment and global central bank macro updates.</p>
        </div>

        {loading ? (
          <div className="text-center py-10">
            <div className="flex items-center justify-center gap-3">
              <div className="h-8 w-8 rounded-lg bg-indigo-500/20 border border-indigo-500/40 flex items-center justify-center">
                <Flame className="h-4 w-4 text-indigo-400 animate-spin" />
              </div>
              <span className="text-sm text-slate-400">Loading latest news...</span>
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {news.map(item => {
              const isLocked = item.isVipOnly && user?.tier === 'free';
              return (
                <div key={item.id} className="p-6 rounded-2xl bg-slate-900 border border-slate-800 flex flex-col justify-between">
                  <div>
                    <div className="flex items-center justify-between text-xs text-slate-400 mb-2">
                      <span className="font-bold text-slate-200">{item.source}</span>
                      <span className="flex items-center gap-1"><Flame className="h-3 w-3 text-amber-400" /> {item.time}</span>
                    </div>

                    <h3 className="font-extrabold text-lg text-slate-100 leading-snug">{item.title}</h3>
                    <p className="text-sm text-slate-300 mt-2 leading-relaxed">{item.summary}</p>
                  </div>

                  <div className="mt-4 pt-4 border-t border-slate-800 flex items-center justify-between">
                    <Badge className={item.sentiment === 'BULLISH' ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/40' : 'bg-slate-800 text-slate-300'}>
                      {item.sentiment}
                    </Badge>

                    {isLocked ? (
                      <a href={instagramUrl} target="_blank" rel="noopener noreferrer">
                        <Button size="sm" className="bg-amber-500 hover:bg-amber-400 text-slate-950 font-black text-xs gap-1">
                          <Lock className="h-3 w-3" /> VIP Analysis Locked
                        </Button>
                      </a>
                    ) : (
                      <Button size="sm" variant="ghost" className="text-xs text-indigo-400 hover:text-indigo-300 gap-1">
                        Full Intelligence Report <ExternalLink className="h-3 w-3" />
                      </Button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </main>
    </div>
  );
};

export default NewsPage;