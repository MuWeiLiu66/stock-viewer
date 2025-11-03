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
    dataTimestamp?: string; // API返回的数据时间戳（用于判断市场状态）
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
                // 转换代码格式为腾讯财经格式
                let tencentCode = code;
                
                // 美股代码：us.AAPL -> r_usAAPL
                if (code.toLowerCase().startsWith('us.')) {
                    const symbol = code.substring(3); // 去掉 'us.'
                    tencentCode = `r_us${symbol.toUpperCase()}`;
                }
                // 港股代码：hk00700 -> hk00700（保持不变）
                // A股代码：sz000001 -> sz000001（保持不变）
                
                const data = await httpGet(`http://qt.gtimg.cn/q=${tencentCode}`);
                const match = data.match(/="([^"]+)"/);
                
                if (match?.[1]) {
                    const parts = match[1].split('~');
                    if (parts.length >= 5) {
                        // 使用原始代码保存，而不是腾讯格式
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
        
        // 判断股票类型
        const lowerCode = code.toLowerCase();
        const isHKStock = lowerCode.startsWith('hk');
        const isUSStock = lowerCode.startsWith('us.');
        
        const volume = this.extractVolume(parts, isHKStock, isUSStock);
        const turnover = this.calculateTurnover(parts, currentPrice, volume, isHKStock, isUSStock);
        const changePercent = parts[32] || this.calculateChangePercent(currentPrice, yesterdayClose);
        
        // 提取API返回的数据时间戳（索引30，格式：YYYYMMDDHHMMSS）
        const dataTimestamp = parts[30] || '';
        
        // 使用API返回的时间戳作为更新时间，如果无法解析则使用当前时间
        const updateTime = this.parseTimestampToTime(dataTimestamp, 'tencent') || this.formatTime(new Date());
        
        return {
            code, name, changePercent,
            currentPrice, yesterdayClose, todayOpen, todayHigh, todayLow,
            changeAmount: currentPrice - yesterdayClose,
            volume, turnover, updateTime,
            dataTimestamp
        };
    }
    
    private extractVolume(parts: string[], isHKStock: boolean, isUSStock: boolean): number {
        // 腾讯财经API数据格式：
        // A股：索引6是成交量（单位：手）
        // 港股：索引6和36是成交量（单位：股），保持为股
        // 美股：索引6和36是成交量（单位：股），保持为股
        
        let volume = 0;
        
        // 优先使用索引6
        if (parts[6]) {
            volume = parseFloat(parts[6]) || 0;
        } else if (parts[36]) {
            volume = parseFloat(parts[36]) || 0;
        }
        
        // 港股和美股成交量单位保持为"股"，不转换为"手"
        // A股成交量单位已经是"手"，无需转换
        
        return volume;
    }
    
    private calculateTurnover(parts: string[], currentPrice: number, volume: number, isHKStock: boolean, isUSStock: boolean): number {
        // 腾讯财经API数据格式：
        // A股：索引37是成交额（单位：万元），需要乘以10000转换为元
        // 港股：索引37是成交额（单位：港元），已经是元为单位
        // 美股：索引37是成交额（单位：美元），已经是元为单位
        
        let turnover = 0;
        
        // 优先使用索引37
        const turnoverValue = parseFloat(parts[37]) || 0;
        
        if (turnoverValue > 0) {
            if (isHKStock || isUSStock) {
                // 港股和美股成交额已经是元为单位，直接使用
                turnover = turnoverValue;
            } else {
                // A股成交额单位是"万元"，需要乘以10000转换为元
                // 但如果值很大（>1000），可能已经是元为单位
                if (turnoverValue < 1000) {
                    turnover = turnoverValue * 10000;
                } else {
                    turnover = turnoverValue;
                }
            }
        } else {
            // 如果没有索引37，尝试其他索引（A股）
            if (!isHKStock && !isUSStock) {
                for (const idx of [7, 10]) {
                    const candidate = parseFloat(parts[idx]) || 0;
                    if (candidate > 0 && candidate < 10000000000000) {
                        turnover = candidate;
                        break;
                    }
                }
            }
        }
        
        // 如果还是没有成交额，尝试根据成交量和价格计算（A股）
        // A股：成交量单位是"手"，所以乘以100（1手=100股）
        // 港美股：成交量单位是"股"，所以不需要乘以100
        if (turnover === 0 && volume > 0 && currentPrice > 0) {
            if (isHKStock || isUSStock) {
                turnover = volume * currentPrice;
            } else {
                turnover = volume * 100 * currentPrice;
            }
        }
        
        return turnover;
    }
    
    private async fetchFromSina(codes: string[]): Promise<StockInfo[]> {
        try {
            // 新浪财经不支持港美股，只支持A股和指数
            // 过滤出支持的代码（A股和指数）
            const supportedCodes = codes.filter(code => {
                const lower = code.toLowerCase();
                return lower.startsWith('sz') || 
                       lower.startsWith('sh') || 
                       lower.startsWith('bj') ||
                       /^\d{6}$/.test(code);
            });
            
            if (supportedCodes.length === 0) {
                return [];
            }
            
            const data = await httpGet(`http://hq.sinajs.cn/list=${supportedCodes.join(',')}`, {
                'Referer': 'http://finance.sina.com.cn',
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
            });
            
            return this.parseSinaData(data, supportedCodes);
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
        
        // 提取API返回的数据时间戳（索引30是日期，索引31是时间，格式：YYYY-MM-DD,HH:MM:SS）
        const dataDate = parts[30] || '';
        const dataTime = parts[31] || '';
        const dataTimestamp = dataDate && dataTime ? `${dataDate} ${dataTime}` : '';
        
        // 使用API返回的时间戳作为更新时间，如果无法解析则使用当前时间
        const updateTime = this.parseTimestampToTime(dataTimestamp, 'sina') || this.formatTime(new Date());
        
        return {
            code, name, changePercent,
            currentPrice, yesterdayClose, todayOpen, todayHigh, todayLow,
            changeAmount: currentPrice - yesterdayClose,
            volume, turnover, updateTime,
            dataTimestamp
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
    
    /**
     * 解析API返回的时间戳并格式化为时间字符串（HH:MM:SS）
     * @param timestamp API返回的时间戳
     * @param dataSource 数据源类型
     * @returns 格式化的时间字符串，如果解析失败返回null
     */
    private parseTimestampToTime(timestamp: string, dataSource: 'tencent' | 'sina'): string | null {
        if (!timestamp || !timestamp.trim()) {
            return null;
        }
        
        try {
            if (dataSource === 'tencent') {
                // 腾讯财经格式：YYYYMMDDHHMMSS（如：20251103161412）
                if (timestamp.length >= 14) {
                    const hours = timestamp.substring(8, 10);
                    const minutes = timestamp.substring(10, 12);
                    const seconds = timestamp.substring(12, 14);
                    return `${hours}:${minutes}:${seconds}`;
                }
            } else {
                // 新浪财经格式：YYYY-MM-DD HH:MM:SS（如：2025-11-03 15:30:39）
                const timeMatch = timestamp.match(/(\d{2}):(\d{2}):(\d{2})/);
                if (timeMatch) {
                    return `${timeMatch[1]}:${timeMatch[2]}:${timeMatch[3]}`;
                }
            }
        } catch (error) {
            // 解析失败，返回null，使用当前时间
        }
        
        return null;
    }
}

