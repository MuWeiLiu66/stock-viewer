import * as http from 'http';
import * as https from 'https';

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
    ],
    // 指数代码列表（常见指数）
    INDICES: [
        // 上海指数
        'sh000001', // 上证指数
        'sh000002', // A股指数
        'sh000003', // B股指数
        'sh000008', // 综合指数
        'sh000009', // 上证380
        'sh000010', // 上证180
        'sh000016', // 上证50
        'sh000017', // 新综指
        'sh000300', // 沪深300
        'sh000688', // 科创50
        'sh000852', // 中证1000
        'sh000905', // 中证500
        'sh000906', // 中证800
        'sh000985', // 中证全指
        // 深圳指数
        'sz399001', // 深证成指
        'sz399002', // 深成指R
        'sz399003', // 深证B指
        'sz399004', // 深证100R
        'sz399005', // 中小板指
        'sz399006', // 创业板指
        'sz399007', // 深证300
        'sz399008', // 中小300
        'sz399010', // 深证700
        'sz399011', // 深证1000
        'sz399012', // 创业300
        'sz399013', // 深证成指R
        'sz399015', // 深证100
        'sz399016', // 深证创新
        'sz399017', // 中小板创新
        'sz399018', // 创业板创新
        'sz399100', // 深证新指数
        'sz399106', // 深证综指
        'sz399107', // 深证A指
        'sz399108', // 深证B指
        'sz399330', // 深证100
        'sz399333', // 中小板指
        'sz399606', // 创业板综
        // 北交所指数
        'bj899050', // 北证50
    ],
    // ETF代码范围
    ETF_RANGES: [
        { name: '上海ETF510段', prefix: 'sh', start: 510000, end: 519999 },
        { name: '上海ETF562段', prefix: 'sh', start: 562000, end: 562999 }, // 包含北证50ETF
        { name: '上海ETF588段', prefix: 'sh', start: 588000, end: 588999 },
        { name: '深圳ETF159段', prefix: 'sz', start: 159000, end: 159999 },
    ],
    // 港股代码范围（常见港股）
    HK_STOCK_RANGES: [
        { name: '港股00001-00999', start: 1, end: 999 },
        { name: '港股01000-01999', start: 1000, end: 1999 },
        { name: '港股02000-02999', start: 2000, end: 2999 },
        { name: '港股03000-03999', start: 3000, end: 3999 },
        { name: '港股04000-04999', start: 4000, end: 4999 },
        { name: '港股05000-05999', start: 5000, end: 5999 },
        { name: '港股06000-06999', start: 6000, end: 6999 },
        { name: '港股07000-07999', start: 7000, end: 7999 },
        { name: '港股08000-08999', start: 8000, end: 8999 },
        { name: '港股09000-09999', start: 9000, end: 9999 },
    ],
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
                    // 使用 Node.js 内置的 TextDecoder (支持 GBK，Node.js 14.5.0+)
                    // VS Code 使用 Node.js 18+，完全支持
                    const decoder = new TextDecoder('gbk');
                    resolve(decoder.decode(buffer));
                } catch {
                    // 如果 GBK 解码失败，尝试 UTF-8
                    resolve(buffer.toString('utf-8'));
                }
            });
        }).on('error', reject);
    });
}

// 根据股票代码判断股票类型
export function getStockUnitType(code: string): 'a' | 'hk' | 'us' {
    const lowerCode = code.toLowerCase();
    if (lowerCode.startsWith('hk')) {
        return 'hk';
    } else if (lowerCode.startsWith('us.')) {
        return 'us';
    }
    return 'a';
}

// 格式化成交量
// unitType: 'a' 表示A股（单位：手），'hk' 表示港股（单位：股），'us' 表示美股（单位：股）
export function formatVolume(vol: number, unitType: 'a' | 'hk' | 'us' = 'a'): string {
    const unit = unitType === 'a' ? '手' : '股';
    
    if (vol >= 100000000) {
        // 达到亿单位，显示为"亿股"或"亿手"
        return `${(vol / 100000000).toFixed(2)}亿${unit}`;
    } else if (vol >= 10000) {
        // 达到万单位，显示为"万股"或"万手"
        return `${(vol / 10000).toFixed(2)}万${unit}`;
    }
    return `${vol.toFixed(0)}${unit}`;
}

// 格式化成交量（根据股票代码自动判断单位）
export function formatVolumeByCode(vol: number, code: string): string {
    return formatVolume(vol, getStockUnitType(code));
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

