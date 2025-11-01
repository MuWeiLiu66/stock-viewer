import * as http from 'http';
import * as https from 'https';
import * as iconv from 'iconv-lite';

// 常量定义
export const CACHE_EXPIRY_DAYS = 7;
export const MIN_EXPECTED_STOCKS = 5000;
export const MIN_UPDATE_INTERVAL = 3000;
export const BATCH_SIZE = 200;
export const CONCURRENCY = 15;

// 股票代码范围定义
export const CODE_RANGES = {
    SHENZHEN_MAIN: [
        { name: '深圳000段', start: 0, end: 999 },
        { name: '深圳001段', start: 1000, end: 1999 },
        { name: '深圳002段', start: 2000, end: 2999 },
        { name: '深圳003段', start: 3000, end: 3999 },
    ],
    SHENZHEN_GEM: [
        { name: '深圳300段', start: 300000, end: 300999 },
        { name: '深圳301段', start: 301000, end: 301999 },
        { name: '深圳302段', start: 302000, end: 302999 },
    ],
    SHANGHAI_MAIN: [
        { name: '上海600段', start: 600000, end: 600999 },
        { name: '上海601段', start: 601000, end: 601999 },
        { name: '上海603段', start: 603000, end: 603999 },
        { name: '上海605段', start: 605000, end: 605999 },
    ],
    SHANGHAI_STAR: [
        { name: '上海688段', start: 688000, end: 688999 },
        { name: '上海689段', start: 689000, end: 689999 },
    ],
    BEIJING: [
        { name: '北交所920段', start: 920000, end: 920999 },
    ]
};

// HTTP GET 请求（支持 GBK 编码）
export async function httpGet(url: string, headers?: http.OutgoingHttpHeaders): Promise<string> {
    return new Promise((resolve, reject) => {
        const protocol = url.startsWith('https') ? https : http;
        const options: http.RequestOptions = { headers: headers || {} };
        
        protocol.get(url, options, (res) => {
            if (res.statusCode && res.statusCode >= 400) {
                reject(new Error(`HTTP ${res.statusCode}`));
                return;
            }
            
            const chunks: Buffer[] = [];
            res.on('data', (chunk) => chunks.push(chunk));
            res.on('end', () => {
                const buffer = Buffer.concat(chunks);
                try {
                    resolve(iconv.decode(buffer, 'gbk'));
                } catch {
                    resolve(buffer.toString('utf-8'));
                }
            });
        }).on('error', reject);
    });
}

// 格式化成交量
export function formatVolume(vol: number): string {
    if (vol >= 10000) {
        return `${(vol / 10000).toFixed(2)}万手`;
    }
    return `${vol.toFixed(0)}手`;
}

// 格式化成交额
export function formatTurnover(turn: number): string {
    if (turn >= 100000000) {
        return `${(turn / 100000000).toFixed(2)}亿元`;
    } else if (turn >= 10000) {
        return `${(turn / 10000).toFixed(2)}万元`;
    }
    return `${turn.toFixed(0)}元`;
}

// 生成指定范围的股票代码
export function generateCodes(prefix: string, start: number, end: number): string[] {
    const codes: string[] = [];
    for (let i = start; i <= end; i++) {
        codes.push(`${prefix}${String(i).padStart(6, '0')}`);
    }
    return codes;
}

// 随机延迟
export function randomDelay(minMs: number, maxMs: number): number {
    return Math.floor(minMs + Math.random() * (maxMs - minMs));
}

// 并发控制的批量请求执行器
export async function executeConcurrent<T>(
    tasks: (() => Promise<T>)[],
    concurrency: number
): Promise<T[]> {
    const results: T[] = new Array(tasks.length);
    let currentIndex = 0;
    
    const workers = Array.from({ length: Math.min(concurrency, tasks.length) }, async () => {
        while (currentIndex < tasks.length) {
            const index = currentIndex++;
            try {
                results[index] = await tasks[index]();
            } catch (error) {
                results[index] = null as any;
            }
        }
    });
    
    await Promise.all(workers);
    return results.filter(r => r !== null);
}

// 规范化股票代码前缀判断
export function getStockPrefix(num: number): string {
    if ((num >= 600000 && num <= 605999) || (num >= 688000 && num <= 689999)) {
        return 'sh';
    } else if ((num >= 0 && num <= 6999) || (num >= 300000 && num <= 302999)) {
        return 'sz';
    } else if (num >= 920000 && num <= 920999) {
        return 'bj';
    }
    return 'sz'; // 默认深圳
}

// 格式化涨跌幅显示
export function formatChangePercent(percent: string): string {
    const num = parseFloat(percent);
    const sign = num >= 0 ? '+' : '';
    return `${sign}${percent}%`;
}

// 格式化涨跌额显示
export function formatChangeAmount(amount: number): string {
    return amount >= 0 ? `+${amount.toFixed(2)}` : amount.toFixed(2);
}

/**
 * 判断当前是否在A股交易时间内
 * 交易时间：周一至周五 9:30-11:30, 13:00-15:00
 * @returns 是否在交易时间内
 */
export function isMarketOpen(): boolean {
    const now = new Date();
    const day = now.getDay();
    
    // 周末不交易
    if (day === 0 || day === 6) {
        return false;
    }
    
    const hours = now.getHours();
    const minutes = now.getMinutes();
    const time = hours * 100 + minutes;
    
    // 上午交易时间：9:30 - 11:30
    if (time >= 930 && time <= 1130) {
        return true;
    }
    
    // 下午交易时间：13:00 - 15:00
    if (time >= 1300 && time <= 1500) {
        return true;
    }
    
    return false;
}

