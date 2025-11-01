import { httpGet } from './utils';

export interface StockInfo {
    code: string;
    name: string;
    changePercent: string;
    currentPrice: number;
    yesterdayClose: number;
    todayOpen: number;
    todayHigh: number;
    todayLow: number;
    changeAmount: number;
    volume: number;
    turnover: number;
    updateTime: string; // 数据更新时间
}

export class StockDataService {
    public async fetchStocks(codes: string[], dataSource: 'tencent' | 'sina'): Promise<StockInfo[]> {
        return dataSource === 'sina' 
            ? this.fetchFromSina(codes)
            : this.fetchFromTencent(codes);
    }
    
    private async fetchFromTencent(codes: string[]): Promise<StockInfo[]> {
        const results: StockInfo[] = [];
        
        for (const code of codes) {
            try {
                const data = await httpGet(`http://qt.gtimg.cn/q=${code}`);
                const match = data.match(/="([^"]+)"/);
                
                if (match?.[1]) {
                    const parts = match[1].split('~');
                    if (parts.length >= 5) {
                        results.push(this.parseTencentData(code, parts));
                    }
                }
            } catch (error) {
                console.error(`获取腾讯数据失败 ${code}`);
            }
        }
        
        return results;
    }
    
    private parseTencentData(code: string, parts: string[]): StockInfo {
        const name = parts[1] || code;
        const currentPrice = parseFloat(parts[3]) || 0;
        const yesterdayClose = parseFloat(parts[4]) || 0;
        const todayOpen = parseFloat(parts[5]) || 0;
        const todayHigh = parseFloat(parts[33]) || currentPrice;
        const todayLow = parseFloat(parts[34]) || currentPrice;
        
        const volume = this.extractVolume(parts);
        const turnover = this.calculateTurnover(parts, currentPrice, volume);
        const changePercent = parts[32] || this.calculateChangePercent(currentPrice, yesterdayClose);
        
        // 获取当前时间
        const updateTime = this.formatTime(new Date());
        
        return {
            code, name, changePercent,
            currentPrice, yesterdayClose, todayOpen, todayHigh, todayLow,
            changeAmount: currentPrice - yesterdayClose,
            volume, turnover, updateTime
        };
    }
    
    private extractVolume(parts: string[]): number {
        for (const idx of [6, 9, 36]) {
            const candidate = parseFloat(parts[idx]) || 0;
            if (candidate > 0 && candidate < 100000000) {
                return candidate;
            }
        }
        return 0;
    }
    
    private calculateTurnover(parts: string[], currentPrice: number, volume: number): number {
        let turnover = 0;
        const turnoverValue = parseFloat(parts[37]) || 0;
        
        if (turnoverValue > 0) {
            turnover = turnoverValue * 10000;
        } else {
            for (const idx of [7, 10]) {
                const candidate = parseFloat(parts[idx]) || 0;
                if (candidate > 0 && candidate < 10000000000000) {
                    turnover = candidate;
                    break;
                }
            }
        }
        
        if (volume > 0 && currentPrice > 0) {
            const estimatedTurnover = volume * 100 * currentPrice;
            if (turnover > 0) {
                const ratio = turnover / estimatedTurnover;
                if (ratio < 0.1 && turnover < 100000000) {
                    turnover *= 10000;
                } else if (ratio > 2) {
                    turnover = estimatedTurnover;
                }
            } else {
                turnover = estimatedTurnover;
            }
        }
        
        return turnover;
    }
    
    private async fetchFromSina(codes: string[]): Promise<StockInfo[]> {
        try {
            const data = await httpGet(`http://hq.sinajs.cn/list=${codes.join(',')}`, {
                'Referer': 'http://finance.sina.com.cn',
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
            });
            
            return this.parseSinaData(data, codes);
        } catch (error) {
            console.error('获取新浪数据失败');
            return [];
        }
    }
    
    private parseSinaData(data: string, codes: string[]): StockInfo[] {
        const results: StockInfo[] = [];
        const lines = data.split('\n');
        
        for (let i = 0; i < Math.min(lines.length, codes.length); i++) {
            const line = lines[i].trim();
            if (!line) continue;
            
            const match = line.match(/="([^"]+)"/);
            if (match?.[1]) {
                const parts = match[1].split(',');
                if (parts.length >= 4) {
                    results.push(this.parseSinaStock(codes[i], parts));
                }
            }
        }
        
        return results;
    }
    
    private parseSinaStock(code: string, parts: string[]): StockInfo {
        const name = parts[0] || code;
        const todayOpen = parseFloat(parts[1]) || 0;
        const yesterdayClose = parseFloat(parts[2]) || 0;
        const currentPrice = parseFloat(parts[3]) || 0;
        const todayHigh = parseFloat(parts[4]) || 0;
        const todayLow = parseFloat(parts[5]) || 0;
        
        let volume = (parseFloat(parts[8]) || 0) / 100;
        let turnover = this.adjustSinaTurnover(parseFloat(parts[9]) || 0, volume, currentPrice);
        
        const changePercent = this.calculateChangePercent(currentPrice, yesterdayClose);
        
        // 获取当前时间
        const updateTime = this.formatTime(new Date());
        
        return {
            code, name, changePercent,
            currentPrice, yesterdayClose, todayOpen, todayHigh, todayLow,
            changeAmount: currentPrice - yesterdayClose,
            volume, turnover, updateTime
        };
    }
    
    private adjustSinaTurnover(turnover: number, volume: number, currentPrice: number): number {
        if (turnover > 0 && volume > 0 && currentPrice > 0) {
            const estimatedTurnover = volume * 100 * currentPrice;
            const ratio = turnover / estimatedTurnover;
            
            if (ratio < 0.1 && turnover < 100000000) {
                return turnover * 10000;
            } else if (ratio > 100) {
                return turnover / 100;
            }
        } else if (volume > 0 && currentPrice > 0) {
            return volume * 100 * currentPrice;
        }
        
        return turnover;
    }
    
    private calculateChangePercent(currentPrice: number, yesterdayClose: number): string {
        if (yesterdayClose > 0 && !isNaN(currentPrice)) {
            return ((currentPrice - yesterdayClose) / yesterdayClose * 100).toFixed(2);
        }
        return '0.00';
    }
    
    private formatTime(date: Date): string {
        const hours = String(date.getHours()).padStart(2, '0');
        const minutes = String(date.getMinutes()).padStart(2, '0');
        const seconds = String(date.getSeconds()).padStart(2, '0');
        return `${hours}:${minutes}:${seconds}`;
    }
}

