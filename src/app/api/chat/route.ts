"use strict";

import { NextResponse } from 'next/server';
import { getCoinData } from '@/lib/crypto-api';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { message } = body;

    // Simple keyword extraction for the mock-up
    const lowerMessage = message.toLowerCase();
    let coinId = 'bitcoin';
    let coinName = 'Bitcoin';

    if (lowerMessage.includes('ethereum') || lowerMessage.includes('eth')) {
      coinId = 'ethereum';
      coinName = 'Ethereum';
    } else if (lowerMessage.includes('solana') || lowerMessage.includes('sol')) {
      coinId = 'solana';
      coinName = 'Solana';
    } else if (lowerMessage.includes('doge')) {
      coinId = 'dogecoin';
      coinName = 'Dogecoin';
    }

    const liveData = await getCoinData(coinId);

    const responseText = liveData 
      ? `Based on my analysis, ${coinName} is currently priced at $${liveData.usd.toLocaleString()}. It has changed ${liveData.usd_24h_change.toFixed(2)}% in the last 24 hours. The market sentiment is ${liveData.usd_24h_change > 0 ? 'bullish' : 'bearish'}.`
      : `I couldn't fetch live data for ${coinName} right now, but generally, the market is showing interesting patterns.`;

    return NextResponse.json({
      role: 'assistant',
      content: responseText,
      data: liveData
    });
  } catch (error) {
    return NextResponse.json(
      { success: false, error: 'Failed to process request' },
      { status: 500 }
    );
  }
}
