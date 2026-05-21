export async function getCoinData(coinId: string = 'bitcoin') {
  try {
    const response = await fetch(
      `https://api.coingecko.com/api/v3/simple/price?ids=${coinId}&vs_currencies=usd&include_24hr_change=true&include_market_cap=true`,
      { next: { revalidate: 60 } } // Cache for 1 minute
    );
    
    if (!response.ok) throw new Error('Failed to fetch data');
    
    const data = await response.json();
    return data[coinId];
  } catch (error) {
    console.error('Error fetching crypto data:', error);
    return null;
  }
}

export async function getMarketTrends() {
  try {
    const response = await fetch(
      'https://api.coingecko.com/api/v3/search/trending',
      { next: { revalidate: 300 } } // Cache for 5 minutes
    );
    
    if (!response.ok) throw new Error('Failed to fetch trends');
    
    return await response.json();
  } catch (error) {
    console.error('Error fetching trends:', error);
    return null;
  }
}
