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

// 获取所有股票（沪深A股 + 北交所）
export async function fetchAllStocks(): Promise<StockItem[]> {
    try {
        const startTime = Date.now();
        
        const [aStocks, bjStocks] = await Promise.all([
            fetchAllStocksFromSina().catch(() => []),
            fetchBJStocksFromTencent().catch(() => [])
        ]);
        
        const elapsed = ((Date.now() - startTime) / 1000).toFixed(2);
        const allStocks = [...aStocks, ...bjStocks];
        
        console.log(`获取${allStocks.length}只股票（沪深${aStocks.length}+北交所${bjStocks.length}），耗时${elapsed}秒`);
        
        return allStocks;
    } catch (error) {
        console.error('获取股票列表失败:', error);
        return [];
    }
}
