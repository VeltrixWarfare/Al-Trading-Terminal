export type MarketQuote = {
  symbol: "XAUUSD"; bid: number; ask: number; timestamp: string; source: string;
};
export type Candle = { time: number; open: number; high: number; low: number; close: number; };
export type MarketPayload = { quote: MarketQuote; candles: Candle[]; timeframe: string; };
