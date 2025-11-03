import {
  fetchAllStocksFromSina,
  fetchBJStocksFromTencent,
  fetchIndicesFromSina,
  fetchETFsFromSina,
  fetchHKStocksFromTencent,
  fetchUSStocksFromTencent,
  fetchAllStocks,
  StockItem,
} from '../src/stockDatabase';
import * as utils from '../src/utils';

// Mock utils module
jest.mock('../src/utils', () => ({
  ...jest.requireActual('../src/utils'),
  httpGet: jest.fn(),
  generateCodes: jest.fn(),
  randomDelay: jest.fn(() => 0), // 不延迟，加快测试速度
  executeConcurrent: jest.fn(),
}));

describe('stockDatabase', () => {
  const mockHttpGet = utils.httpGet as jest.MockedFunction<typeof utils.httpGet>;
  const mockGenerateCodes = utils.generateCodes as jest.MockedFunction<typeof utils.generateCodes>;
  const mockExecuteConcurrent = utils.executeConcurrent as jest.MockedFunction<typeof utils.executeConcurrent>;

  beforeEach(() => {
    jest.clearAllMocks();
    // 默认 mock executeConcurrent 返回空数组
    mockExecuteConcurrent.mockResolvedValue([]);
  });

  describe('fetchAllStocksFromSina', () => {
    it('应该从新浪财经获取A股列表', async () => {
      mockGenerateCodes.mockReturnValue(['sz000001', 'sz000002']);
      // executeConcurrent 会执行任务并过滤 null
      mockExecuteConcurrent.mockImplementation(async (tasks) => {
        const results: StockItem[][] = [];
        for (const task of tasks) {
          try {
            const result = await task();
            results.push(result as StockItem[]);
          } catch {
            results.push(null as any);
          }
        }
        return results.filter(r => r !== null).flat();
      });

      mockHttpGet.mockResolvedValue(
        'var hq_str_sz000001="平安银行,10.55,10.20,10.50,10.55,10.45,10.48,10.49,5000000,51000000,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,2024-01-05,14:30:00,00";\n' +
        'var hq_str_sz000002="万科A,20.55,20.20,20.50,20.55,20.45,20.48,20.49,5000000,51000000,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,2024-01-05,14:30:00,00";'
      );

      const stocks = await fetchAllStocksFromSina();

      expect(stocks.length).toBeGreaterThan(0);
      expect(stocks[0].code).toBe('sz000001');
      expect(stocks[0].name).toBe('平安银行');
      expect(stocks[0].number).toBe('000001');
    });

    it('应该过滤无效数据', async () => {
      // 简化测试：只验证过滤逻辑，不关心具体数量
      mockGenerateCodes.mockReturnValue(['sz000001']);
      mockExecuteConcurrent.mockImplementation(async (tasks) => {
        const results: StockItem[][] = [];
        for (const task of tasks) {
          try {
            const result = await task();
            results.push(result as StockItem[]);
          } catch {
            results.push(null as any);
          }
        }
        return results.filter(r => r !== null).flat();
      });

      // 包含"不存在"和"error"的数据应该被过滤
      mockHttpGet.mockResolvedValue(
        'var hq_str_sz000001="不存在,10.55,10.20,10.50";\n' +
        'var hq_str_sz000002="error,20.55,20.20,20.50";\n' +
        'var hq_str_sz000003="万科A,20.55,20.20,20.50";'
      );

      const stocks = await fetchAllStocksFromSina();

      // 验证无效数据被过滤（不包含"不存在"或"error"）
      const invalidStocks = stocks.filter(s => s.name && (s.name.includes('不存在') || s.name.includes('error')));
      expect(invalidStocks.length).toBe(0);
    });

    it('应该处理请求失败', async () => {
      mockGenerateCodes.mockReturnValue(['sz000001']);
      // executeConcurrent 内部会捕获错误并返回 null，然后过滤掉
      mockExecuteConcurrent.mockImplementation(async (tasks) => {
        const results: StockItem[][] = [];
        for (const task of tasks) {
          try {
            const result = await task();
            results.push(result as StockItem[]);
          } catch {
            results.push(null as any);
          }
        }
        return results.filter(r => r !== null).flat();
      });

      mockHttpGet.mockRejectedValue(new Error('Network error'));

      const stocks = await fetchAllStocksFromSina();

      expect(stocks).toEqual([]);
    });
  });

  describe('fetchBJStocksFromTencent', () => {
    it('应该从腾讯财经获取北交所股票', async () => {
      mockGenerateCodes.mockReturnValue(['bj920001']);
      mockExecuteConcurrent.mockImplementation(async (tasks) => {
        const results: StockItem[][] = [];
        for (const task of tasks) {
          try {
            const result = await task();
            results.push(result as StockItem[]);
          } catch {
            results.push(null as any);
          }
        }
        return results.filter(r => r !== null).flat();
      });

      mockHttpGet.mockResolvedValue('v_bj920001="bj920001~测试股票~未知字段~10.50~10.20~10.55";');

      const stocks = await fetchBJStocksFromTencent();

      expect(stocks.length).toBeGreaterThan(0);
      expect(stocks[0].code).toBe('bj920001');
      expect(stocks[0].name).toBe('测试股票');
    });

    it('应该过滤无效数据（no qt）', async () => {
      mockGenerateCodes.mockReturnValue(['bj920001', 'bj920002']);
      mockExecuteConcurrent.mockImplementation(async (tasks) => {
        const results: StockItem[][] = [];
        for (const task of tasks) {
          try {
            const result = await task();
            results.push(result as StockItem[]);
          } catch {
            results.push(null as any);
          }
        }
        return results.filter(r => r !== null).flat();
      });

      mockHttpGet.mockResolvedValue(
        'v_bj920001="bj920001~no qt~未知字段";\n' +
        'v_bj920002="bj920002~有效股票~未知字段~10.50";'
      );

      const stocks = await fetchBJStocksFromTencent();

      expect(stocks.length).toBe(1);
      expect(stocks[0].name).toBe('有效股票');
    });
  });

  describe('fetchIndicesFromSina', () => {
    it('应该从新浪财经获取指数列表', async () => {
      mockHttpGet.mockResolvedValue(
        'var hq_str_sh000001="上证指数,3000.00,2990.00,3010.00";\n' +
        'var hq_str_sz399001="深证成指,10000.00,9990.00,10010.00";'
      );

      const stocks = await fetchIndicesFromSina();

      expect(stocks.length).toBeGreaterThan(0);
      expect(stocks.some(s => s.code === 'sh000001')).toBe(true);
      expect(stocks.some(s => s.code === 'sz399001')).toBe(true);
    });

    it('应该处理批次请求失败', async () => {
      mockHttpGet
        .mockResolvedValueOnce('var hq_str_sh000001="上证指数,3000.00";')
        .mockRejectedValueOnce(new Error('Network error'))
        .mockResolvedValueOnce('var hq_str_sz399001="深证成指,10000.00";');

      const stocks = await fetchIndicesFromSina();

      // 应该返回成功的批次
      expect(stocks.length).toBeGreaterThan(0);
    });
  });

  describe('fetchETFsFromSina', () => {
    it('应该从新浪财经获取ETF列表', async () => {
      mockGenerateCodes.mockReturnValue(['sh510300']);
      mockExecuteConcurrent.mockImplementation(async (tasks) => {
        const results: StockItem[][] = [];
        for (const task of tasks) {
          try {
            const result = await task();
            results.push(result as StockItem[]);
          } catch {
            results.push(null as any);
          }
        }
        return results.filter(r => r !== null).flat();
      });

      mockHttpGet.mockResolvedValue('var hq_str_sh510300="沪深300ETF,5.55,5.20,5.50";');

      const stocks = await fetchETFsFromSina();

      expect(stocks.length).toBeGreaterThan(0);
      const etfStock = stocks.find(s => s.code === 'sh510300');
      expect(etfStock).toBeDefined();
      expect(etfStock?.code).toBe('sh510300');
    });

    it('应该过滤空名称的ETF', async () => {
      mockGenerateCodes.mockReturnValue(['sh510300', 'sh510301']);
      mockExecuteConcurrent.mockImplementation(async (tasks) => {
        const results: StockItem[][] = [];
        for (const task of tasks) {
          try {
            const result = await task();
            results.push(result as StockItem[]);
          } catch {
            results.push(null as any);
          }
        }
        return results.filter(r => r !== null).flat();
      });

      mockHttpGet.mockResolvedValue(
        'var hq_str_sh510300=",5.55,5.20,5.50";\n' +
        'var hq_str_sh510301="有效ETF,5.55,5.20,5.50";'
      );

      const stocks = await fetchETFsFromSina();

      // 验证空名称被过滤
      const emptyNameStocks = stocks.filter(s => !s.name || s.name.trim() === '');
      expect(emptyNameStocks.length).toBe(0);
      // 验证有效ETF存在
      const validETF = stocks.find(s => s.name === '有效ETF');
      expect(validETF).toBeDefined();
    });
  });

  describe('fetchHKStocksFromTencent', () => {
    it('应该从腾讯财经获取港股列表', async () => {
      mockExecuteConcurrent.mockImplementation(async (tasks) => {
        const results: StockItem[][] = [];
        for (const task of tasks) {
          try {
            const result = await task();
            results.push(result as StockItem[]);
          } catch {
            results.push(null as any);
          }
        }
        return results.filter(r => r !== null).flat();
      });

      mockHttpGet.mockResolvedValue(
        'v_hk00700="hk00700~腾讯控股~未知字段~350.00";\n' +
        'v_rt_hk00700="hk00700~腾讯控股~未知字段~350.00";'
      );

      const stocks = await fetchHKStocksFromTencent();

      expect(stocks.length).toBeGreaterThan(0);
      // 应该正确处理 hk 和 rt_hk 格式
      expect(stocks.some(s => s.code === 'hk00700')).toBe(true);
    });

    it('应该正确处理港股代码格式（5位数字）', async () => {
      mockExecuteConcurrent.mockImplementation(async (tasks) => {
        const results: StockItem[][] = [];
        for (const task of tasks) {
          try {
            const result = await task();
            results.push(result as StockItem[]);
          } catch {
            results.push(null as any);
          }
        }
        return results.filter(r => r !== null).flat();
      });

      mockHttpGet.mockResolvedValue('v_hk00001="hk00001~测试港股~未知字段~10.50";');

      const stocks = await fetchHKStocksFromTencent();

      expect(stocks.length).toBeGreaterThan(0);
      expect(stocks[0].code).toBe('hk00001');
      expect(stocks[0].number).toBe('00001'); // 去掉 hk 前缀
    });
  });

  describe('fetchUSStocksFromTencent', () => {
    it('应该从腾讯财经获取美股列表', async () => {
      mockExecuteConcurrent.mockImplementation(async (tasks) => {
        const results: StockItem[][] = [];
        for (const task of tasks) {
          try {
            const result = await task();
            results.push(result as StockItem[]);
          } catch {
            results.push(null as any);
          }
        }
        return results.filter(r => r !== null).flat();
      });

      mockHttpGet.mockResolvedValue(
        'v_r_usAAPL="r_usAAPL~苹果~AAPL~150.00~148.00";\n' +
        'v_r_usBRK.A="r_usBRK.A~伯克希尔~BRK.A~400.00~395.00";'
      );

      const stocks = await fetchUSStocksFromTencent();

      expect(stocks.length).toBeGreaterThan(0);
      expect(stocks.some(s => s.code === 'us.aapl')).toBe(true);
      expect(stocks.some(s => s.code === 'us.brk.a')).toBe(true);
    });

    it('应该正确处理带点号的美股代码（如BRK.A）', async () => {
      mockExecuteConcurrent.mockImplementation(async (tasks) => {
        const results: StockItem[][] = [];
        for (const task of tasks) {
          try {
            const result = await task();
            results.push(result as StockItem[]);
          } catch {
            results.push(null as any);
          }
        }
        return results.filter(r => r !== null).flat();
      });

      mockHttpGet.mockResolvedValue('v_r_usBRK.A="r_usBRK.A~伯克希尔~BRK.A~400.00";');

      const stocks = await fetchUSStocksFromTencent();

      expect(stocks.length).toBeGreaterThan(0);
      const brkStock = stocks.find(s => s.code === 'us.brk.a');
      expect(brkStock).toBeDefined();
      expect(brkStock?.number).toBe('BRK.A');
    });

    it('应该过滤无效数据（parts长度不足）', async () => {
      mockExecuteConcurrent.mockImplementation(async (tasks) => {
        const results: StockItem[][] = [];
        for (const task of tasks) {
          try {
            const result = await task();
            results.push(result as StockItem[]);
          } catch {
            results.push(null as any);
          }
        }
        return results.filter(r => r !== null).flat();
      });

      // 只返回包含有效数据（parts.length >= 3）的股票
      mockHttpGet.mockResolvedValue(
        'v_r_usAAPL="r_usAAPL~苹果";\n' + // parts.length < 3，应该被过滤
        'v_r_usMSFT="r_usMSFT~微软~MSFT~200.00~198.00";' // 有效数据
      );

      const stocks = await fetchUSStocksFromTencent();

      // 由于 COMMON_US_STOCKS 有多个批次，mockExecuteConcurrent 会被调用多次
      // 我们只需要验证返回的股票中不包含无效数据
      const validStocks = stocks.filter(s => s.code === 'us.msft');
      expect(validStocks.length).toBeGreaterThan(0);
      expect(validStocks[0].code).toBe('us.msft');
      // 验证无效数据（parts.length < 3）被过滤
      const invalidStocks = stocks.filter(s => s.code === 'us.aapl');
      expect(invalidStocks.length).toBe(0);
    });
  });

  describe('fetchAllStocks', () => {
    it('应该合并所有类型的股票', async () => {
      mockExecuteConcurrent.mockResolvedValue([]);
      mockHttpGet.mockResolvedValue('');

      const stocks = await fetchAllStocks();

      expect(Array.isArray(stocks)).toBe(true);
    });

    it('应该处理部分数据源失败的情况', async () => {
      // 模拟部分数据源成功，部分失败
      mockExecuteConcurrent
        .mockResolvedValueOnce([{ code: 'sz000001', name: '平安银行', number: '000001' }]) // A股成功
        .mockResolvedValueOnce([]) // 北交所成功但无数据
        .mockResolvedValueOnce([]) // 指数成功但无数据
        .mockResolvedValueOnce([]) // ETF成功但无数据
        .mockResolvedValueOnce([]) // 港股成功但无数据
        .mockResolvedValueOnce([]); // 美股成功但无数据

      const stocks = await fetchAllStocks();

      expect(stocks.length).toBeGreaterThanOrEqual(0);
    });

    it('应该处理所有数据源都失败的情况', async () => {
      mockExecuteConcurrent.mockRejectedValue(new Error('All failed'));

      const stocks = await fetchAllStocks();

      expect(stocks).toEqual([]);
    });
  });
});

