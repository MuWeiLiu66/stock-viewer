import { httpGet, generateCodes, randomDelay, executeConcurrent, CODE_RANGES, BATCH_SIZE, CONCURRENCY } from './utils';

export interface StockItem {
    code: string;
    name: string;
    number: string;
}

interface CodeRange {
    name: string;
    codes: string[];
}

// 从新浪财经接口获取A股股票列表
async function fetchBatch(batch: string[], rangeName: string, batchIndex: number): Promise<StockItem[]> {
    await new Promise(resolve => setTimeout(resolve, randomDelay(0, 50)));
    
    try {
        const url = `http://hq.sinajs.cn/list=${batch.join(',')}`;
        const data = await httpGet(url, {
            'Referer': 'http://finance.sina.com.cn',
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
        });
        
        const stocks: StockItem[] = [];
        const lines = data.split('\n');
        
        for (let j = 0; j < Math.min(lines.length, batch.length); j++) {
            const line = lines[j].trim();
            if (!line) continue;
            
            const match = line.match(/var hq_str_(\w+?)="([^"]+)"/);
            if (match && match[1] && match[2]) {
                const code = match[1];
                const parts = match[2].split(',');
                const name = parts[0]?.trim();
                
                if (name && !name.includes('不存在') && !name.includes('error')) {
                    stocks.push({
                        code: code.toLowerCase(),
                        name: name,
                        number: code.substring(2)
                    });
                }
            }
        }
        
        return stocks;
    } catch (error) {
        console.error(`获取${rangeName}批次${batchIndex + 1}失败`);
        return [];
    }
}

// 生成批次任务
function createBatchTasks(ranges: CodeRange[]): Array<() => Promise<StockItem[]>> {
    const tasks: Array<() => Promise<StockItem[]>> = [];
    
    for (const range of ranges) {
        for (let i = 0; i < range.codes.length; i += BATCH_SIZE) {
            const batch = range.codes.slice(i, i + BATCH_SIZE);
            const batchIndex = Math.floor(i / BATCH_SIZE);
            tasks.push(() => fetchBatch(batch, range.name, batchIndex));
        }
    }
    
    return tasks;
}

// 从新浪财经获取沪深A股
export async function fetchAllStocksFromSina(): Promise<StockItem[]> {
    const codeRanges: CodeRange[] = [
        ...CODE_RANGES.SHENZHEN_MAIN.map(r => ({ name: r.name, codes: generateCodes('sz', r.start, r.end) })),
        ...CODE_RANGES.SHENZHEN_GEM.map(r => ({ name: r.name, codes: generateCodes('sz', r.start, r.end) })),
        ...CODE_RANGES.SHANGHAI_MAIN.map(r => ({ name: r.name, codes: generateCodes('sh', r.start, r.end) })),
        ...CODE_RANGES.SHANGHAI_STAR.map(r => ({ name: r.name, codes: generateCodes('sh', r.start, r.end) })),
    ];
    
    const tasks = createBatchTasks(codeRanges);
    const results = await executeConcurrent(tasks, CONCURRENCY);
    
    return results.flat();
}

// 从腾讯接口获取北交所股票
async function fetchBJBatch(batch: string[], batchIndex: number): Promise<StockItem[]> {
    await new Promise(resolve => setTimeout(resolve, randomDelay(0, 50)));
    
    try {
        const url = `http://qt.gtimg.cn/q=${batch.join(',')}`;
        const data = await httpGet(url);
        
        const stocks: StockItem[] = [];
        const lines = data.split('\n');
        
        for (const line of lines) {
            const match = line.match(/v_(\w+)="([^"]+)"/);
            if (match && match[1] && match[2]) {
                const code = match[1];
                const parts = match[2].split('~');
                const name = parts[1]?.trim();
                
                if (name && name !== '' && !name.includes('no qt')) {
                    stocks.push({
                        code: code.toLowerCase(),
                        name: name,
                        number: code.substring(2)
                    });
                }
            }
        }
        
        return stocks;
    } catch (error) {
        console.error(`获取北交所批次${batchIndex + 1}失败`);
        return [];
    }
}

export async function fetchBJStocksFromTencent(): Promise<StockItem[]> {
    const bjRanges: CodeRange[] = CODE_RANGES.BEIJING.map(r => ({
        name: r.name,
        codes: generateCodes('bj', r.start, r.end)
    }));
    
    const tasks: Array<() => Promise<StockItem[]>> = [];
    
    for (const range of bjRanges) {
        for (let i = 0; i < range.codes.length; i += 150) {
            const batch = range.codes.slice(i, i + 150);
            const batchIndex = Math.floor(i / 150);
            tasks.push(() => fetchBJBatch(batch, batchIndex));
        }
    }
    
    const results = await executeConcurrent(tasks, 12);
    return results.flat();
}

// 从新浪财经获取指数列表
export async function fetchIndicesFromSina(): Promise<StockItem[]> {
    try {
        const indices = CODE_RANGES.INDICES;
        const batchSize = 50; // 指数数量较少，可以一次性查询更多
        
        const stocks: StockItem[] = [];
        
        for (let i = 0; i < indices.length; i += batchSize) {
            const batch = indices.slice(i, i + batchSize);
            await new Promise(resolve => setTimeout(resolve, randomDelay(0, 50)));
            
            try {
                const url = `http://hq.sinajs.cn/list=${batch.join(',')}`;
                const data = await httpGet(url, {
                    'Referer': 'http://finance.sina.com.cn',
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
                });
                
                const lines = data.split('\n');
                for (let j = 0; j < Math.min(lines.length, batch.length); j++) {
                    const line = lines[j].trim();
                    if (!line) continue;
                    
                    const match = line.match(/var hq_str_(\w+?)="([^"]+)"/);
                    if (match && match[1] && match[2]) {
                        const code = match[1];
                        const parts = match[2].split(',');
                        const name = parts[0]?.trim();
                        
                        if (name && !name.includes('不存在') && !name.includes('error')) {
                            stocks.push({
                                code: code.toLowerCase(),
                                name: name,
                                number: code.substring(2)
                            });
                        }
                    }
                }
            } catch (error) {
                console.error(`获取指数批次${Math.floor(i / batchSize) + 1}失败`);
            }
        }
        
        return stocks;
    } catch (error) {
        console.error('获取指数列表失败:', error);
        return [];
    }
}

// 从新浪财经获取ETF列表
export async function fetchETFsFromSina(): Promise<StockItem[]> {
    try {
        const etfRanges: CodeRange[] = CODE_RANGES.ETF_RANGES.map(r => ({
            name: r.name,
            codes: generateCodes(r.prefix, r.start, r.end)
        }));
        
        const tasks = createBatchTasks(etfRanges);
        const results = await executeConcurrent(tasks, CONCURRENCY);
        
        // 过滤掉空名称的数据（可能是无效代码）
        const allStocks = results.flat().filter(stock => stock.name && stock.name.trim() !== '');
        
        return allStocks;
    } catch (error) {
        console.error('获取ETF列表失败:', error);
        return [];
    }
}

// 从腾讯接口获取港股列表
async function fetchHKBatch(batch: string[], batchIndex: number): Promise<StockItem[]> {
    await new Promise(resolve => setTimeout(resolve, randomDelay(0, 50)));
    
    try {
        const url = `http://qt.gtimg.cn/q=${batch.join(',')}`;
        const data = await httpGet(url);
        
        const stocks: StockItem[] = [];
        const lines = data.split('\n');
        
        for (const line of lines) {
            // 匹配格式：v_hk00700="..." 或 v_rt_hk00700="..."
            const match = line.match(/v_(?:rt_)?(hk\d{5})="([^"]+)"/);
            if (match && match[1] && match[2]) {
                const code = match[1];
                const parts = match[2].split('~');
                const name = parts[1]?.trim();
                
                if (name && name !== '' && !name.includes('no qt')) {
                    stocks.push({
                        code: code.toLowerCase(),
                        name: name,
                        number: code.substring(2) // 去掉 'hk' 前缀
                    });
                }
            }
        }
        
        return stocks;
    } catch (error) {
        console.error(`获取港股批次${batchIndex + 1}失败`);
        return [];
    }
}

export async function fetchHKStocksFromTencent(): Promise<StockItem[]> {
    try {
        const hkRanges: CodeRange[] = CODE_RANGES.HK_STOCK_RANGES.map(r => ({
            name: r.name,
            codes: Array.from({ length: r.end - r.start + 1 }, (_, i) => {
                const num = r.start + i;
                // 港股代码格式：hk00700（5位数字，不足5位前面补0）
                return `hk${String(num).padStart(5, '0')}`;
            })
        }));
        
        const tasks: Array<() => Promise<StockItem[]>> = [];
        
        for (const range of hkRanges) {
            for (let i = 0; i < range.codes.length; i += 150) {
                const batch = range.codes.slice(i, i + 150);
                const batchIndex = Math.floor(i / 150);
                tasks.push(() => fetchHKBatch(batch, batchIndex));
            }
        }
        
        const results = await executeConcurrent(tasks, 12);
        return results.flat();
    } catch (error) {
        console.error('获取港股列表失败:', error);
        return [];
    }
}

// 从腾讯接口获取美股列表（常见美股代码）
async function fetchUSBatch(batch: string[], batchIndex: number): Promise<StockItem[]> {
    await new Promise(resolve => setTimeout(resolve, randomDelay(0, 50)));
    
    try {
        const url = `http://qt.gtimg.cn/q=${batch.join(',')}`;
        const data = await httpGet(url);
        
        const stocks: StockItem[] = [];
        const lines = data.split('\n');
        
        for (const line of lines) {
            // 腾讯财经美股格式：v_r_usAAPL="..." 或 v_r_usBRK.A="..."
            // 匹配 r_us 后面跟着字母和可能的点号加字母
            const match = line.match(/v_r_us([A-Z0-9]+(?:\.[A-Z]+)?)="([^"]+)"/);
            if (match && match[1] && match[2]) {
                const symbol = match[1];
                const parts = match[2].split('~');
                const name = parts[1]?.trim();
                
                // 检查数据是否有效（索引1是名称，索引2是代码，索引3是价格）
                if (name && name !== '' && !name.includes('no qt') && parts.length >= 3) {
                    // 构造标准格式：us.AAPL 或 us.BRK.A
                    const code = `us.${symbol}`;
                    stocks.push({
                        code: code.toLowerCase(),
                        name: name,
                        number: symbol // 保存股票代码（如AAPL或BRK.A）
                    });
                }
            }
        }
        
        return stocks;
    } catch (error) {
        console.error(`获取美股批次${batchIndex + 1}失败`);
        return [];
    }
}

// 常见美股代码列表（腾讯财经格式：r_usAAPL）
// 包含标普500主要成分股和热门中概股
const COMMON_US_STOCKS = [
    // 科技股
    'r_usAAPL', 'r_usMSFT', 'r_usGOOGL', 'r_usGOOG', 'r_usAMZN', 'r_usMETA', 'r_usTSLA', 'r_usNVDA',
    'r_usAVGO', 'r_usADBE', 'r_usCRM', 'r_usNFLX', 'r_usPYPL', 'r_usINTC', 'r_usQCOM', 'r_usAMD',
    'r_usAMGN', 'r_usORCL', 'r_usIBM', 'r_usTXN', 'r_usCSCO', 'r_usMU', 'r_usLRCX', 'r_usKLAC',
    'r_usANET', 'r_usSNPS', 'r_usCDNS', 'r_usMCHP', 'r_usMRVL', 'r_usSWKS', 'r_usQRVO', 'r_usNXPI',
    // 金融股
    'r_usBRK.A', 'r_usBRK.B', 'r_usJPM', 'r_usBAC', 'r_usWFC', 'r_usGS', 'r_usMS', 'r_usC', 'r_usBLK',
    'r_usSCHW', 'r_usAXP', 'r_usV', 'r_usMA', 'r_usCOF', 'r_usUSB', 'r_usTFC', 'r_usPNC',
    // 消费股
    'r_usHD', 'r_usWMT', 'r_usMCD', 'r_usSBUX', 'r_usNKE', 'r_usTGT', 'r_usCOST', 'r_usTJX',
    'r_usLOW', 'r_usDG', 'r_usDLTR', 'r_usBBY', 'r_usROST', 'r_usKMX',
    // 医疗健康
    'r_usJNJ', 'r_usUNH', 'r_usABBV', 'r_usTMO', 'r_usABT', 'r_usDHR', 'r_usPFE', 'r_usMRK',
    'r_usBMY', 'r_usGILD', 'r_usBIIB', 'r_usREGN', 'r_usVRTX', 'r_usILMN', 'r_usALXN',
    // 工业
    'r_usBA', 'r_usHON', 'r_usLMT', 'r_usRTX', 'r_usGE', 'r_usCAT', 'r_usDE', 'r_usEMR',
    // 能源
    'r_usXOM', 'r_usCVX', 'r_usCOP', 'r_usEOG', 'r_usSLB', 'r_usPSX', 'r_usMPC',
    // 通信服务
    'r_usDIS', 'r_usVZ', 'r_usCMCSA', 'r_usT', 'r_usCHTR', 'r_usEA', 'r_usTTWO',
    // 其他
    'r_usPG', 'r_usKO', 'r_usPEP', 'r_usPM', 'r_usMO', 'r_usCL', 'r_usEL', 'r_usGIS',
    // 中概股
    'r_usBIDU', 'r_usJD', 'r_usPDD', 'r_usNIO', 'r_usXPEV', 'r_usLI', 'r_usBABA', 'r_usTME',
    'r_usWB', 'r_usDOYU', 'r_usYY', 'r_usDIDI', 'r_usBILI', 'r_usFTCH',
    // 其他热门股票
    'r_usUBER', 'r_usLYFT', 'r_usSNAP', 'r_usRBLX', 'r_usPLTR', 'r_usSOFI', 'r_usHOOD', 'r_usCOIN',
];

export async function fetchUSStocksFromTencent(): Promise<StockItem[]> {
    try {
        const tasks: Array<() => Promise<StockItem[]>> = [];
        const batchSize = 50;
        
        for (let i = 0; i < COMMON_US_STOCKS.length; i += batchSize) {
            const batch = COMMON_US_STOCKS.slice(i, i + batchSize);
            const batchIndex = Math.floor(i / batchSize);
            tasks.push(() => fetchUSBatch(batch, batchIndex));
        }
        
        const results = await executeConcurrent(tasks, 8);
        return results.flat();
    } catch (error) {
        console.error('获取美股列表失败:', error);
        return [];
    }
}

// 获取所有股票（沪深A股 + 北交所 + 指数 + ETF + 港股 + 美股）
export async function fetchAllStocks(): Promise<StockItem[]> {
    try {
        const startTime = Date.now();
        
        const [aStocks, bjStocks, indices, etfs, hkStocks, usStocks] = await Promise.all([
            fetchAllStocksFromSina().catch(() => []),
            fetchBJStocksFromTencent().catch(() => []),
            fetchIndicesFromSina().catch(() => []),
            fetchETFsFromSina().catch(() => []),
            fetchHKStocksFromTencent().catch(() => []),
            fetchUSStocksFromTencent().catch(() => [])
        ]);
        
        const elapsed = ((Date.now() - startTime) / 1000).toFixed(2);
        const allStocks = [...aStocks, ...bjStocks, ...indices, ...etfs, ...hkStocks, ...usStocks];
        
        console.log(`获取${allStocks.length}只股票（沪深${aStocks.length}+北交所${bjStocks.length}+指数${indices.length}+ETF${etfs.length}+港股${hkStocks.length}+美股${usStocks.length}），耗时${elapsed}秒`);
        
        return allStocks;
    } catch (error) {
        console.error('获取股票列表失败:', error);
        return [];
    }
}
