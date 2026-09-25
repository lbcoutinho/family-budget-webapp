import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

export interface ProviderQuote {
  price: string;
  marketDate: Date;
}

export interface MarketQuoteProvider {
  isConfigured(): boolean;
  quote(symbol: string): Promise<ProviderQuote | null>;
}

export const MARKET_QUOTE_PROVIDER = Symbol('MARKET_QUOTE_PROVIDER');

@Injectable()
export class EodhdQuoteProvider implements MarketQuoteProvider {
  constructor(private readonly config: ConfigService) {}

  isConfigured(): boolean {
    return this.config.get<string>('EODHD_API_KEY') !== undefined;
  }

  async quote(symbol: string): Promise<ProviderQuote | null> {
    const token = this.config.get<string>('EODHD_API_KEY');
    if (!token) return null;

    const date = new Date().toISOString().slice(0, 10);
    const url = new URL(`https://eodhd.com/api/eod/${encodeURIComponent(symbol)}`);
    url.searchParams.set('api_token', token);
    url.searchParams.set('fmt', 'json');
    url.searchParams.set('from', date);
    url.searchParams.set('to', date);
    const response = await fetch(url);
    if (!response.ok) throw new Error(`EODHD returned ${response.status}.`);
    const rows = await response.json();
    if (!isUnknownArray(rows) || rows.length === 0) return null;
    const row = rows.at(-1);
    if (!isEodRow(row)) throw new Error('EODHD returned an invalid quote.');
    return { price: String(row.close), marketDate: new Date(`${row.date}T00:00:00.000Z`) };
  }
}

function isEodRow(value: unknown): value is { close: string | number; date: string } {
  return (
    typeof value === 'object' && value !== null && 'close' in value && 'date' in value && typeof value.date === 'string' && typeof value.close !== 'undefined'
  );
}

function isUnknownArray(value: unknown): value is unknown[] {
  return Array.isArray(value);
}
