import { supabase } from '@/integrations/supabase/client';

export interface WhaleEvent {
  id: string;
  source: 'hyperliquid' | 'chain';
  timestamp: number; // unix seconds
  asset: string;
  action: 'BUY' | 'SELL' | 'TRANSFER';
  usdValue: number;
  amount: number;
  price: number;
  wallet: string; // shortened to first6...last4
  detail?: string;
}

export interface WhaleTrackerResponse {
  events: WhaleEvent[];
  sourceErrors: {
    hyperliquid: string | null;
    chain: string | null;
  };
  fetchedAt: string; // ISO timestamp
}

export class WhaleTrackerError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'WhaleTrackerError';
  }
}

export async function fetchWhaleTrackerData(symbol?: string): Promise<WhaleTrackerResponse> {
  try {
    const response = await supabase.functions.invoke('coinglass-whale-tracker', {
      body: { symbol },
    });

    if (!response.data) {
      throw new WhaleTrackerError('No data returned from whale tracker function');
    }

    return response.data as WhaleTrackerResponse;
  } catch (error: any) {
    console.error('Error fetching whale tracker data:', error);
    throw new WhaleTrackerError(error.message || 'Failed to fetch whale tracker data');
  }
}