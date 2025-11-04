import { StockDataService, StockInfo } from '../src/stockDataService';
import * as utils from '../src/utils';

// Mock utils module
jest.mock('../src/utils', () => ({
  ...jest.requireActual('../src/utils'),
  httpGet: jest.fn(),
}));

describe('StockDataService', () => {
  let service: StockDataService;
  const mockHttpGet = utils.httpGet as jest.MockedFunction<typeof utils.httpGet>;

  beforeEach(() => {
    service = new StockDataService();
    jest.clearAllMocks();
  });

  describe('fetchFromTencent', () => {
    it('应该正确解析腾讯财经A股数据', async () => {
      // 腾讯财经格式：parts[1]=名称, parts[3]=当前价, parts[4]=昨收, parts[5]=今开, parts[6]=成交量, parts[30]=时间戳, parts[32]=涨跌幅, parts[33]=最高, parts[34]=最低
      // 使用数组确保字段索引正确
      const fields = Array(35).fill('');
      fields[0] = 'sz000001';
      fields[1] = '平安银行';
      fields[2] = '未知字段';
      fields[3] = '10.50';
      fields[4] = '10.20';
      fields[5] = '10.55';
      fields[6] = '50000';
      fields[30] = '20240105143000';
      fields[32] = '5.00';
      fields[33] = '10.55';
      fields[34] = '10.45';
      const mockData = `v_sz000001="${fields.join('~')}"`;
      mockHttpGet.mockResolvedValue(mockData);

      const stocks = await service.fetchStocks(['sz000001'], 'tencent');
      
      expect(stocks).toHaveLength(1);
      expect(stocks[0].code).toBe('sz000001');
      expect(stocks[0].name).toBe('平安银行');
      expect(stocks[0].currentPrice).toBe(10.50);
      expect(stocks[0].yesterdayClose).toBe(10.20);
      expect(stocks[0].todayOpen).toBe(10.55);
      expect(stocks[0].todayHigh).toBe(10.55);
      expect(stocks[0].todayLow).toBe(10.45);
      expect(stocks[0].changeAmount).toBeCloseTo(0.30);
      expect(stocks[0].volume).toBe(50000);
      expect(stocks[0].dataTimestamp).toBe('20240105143000');
    });

    it('应该正确解析腾讯财经港股数据', async () => {
      const mockData = 'v_hk00700="hk00700~腾讯控股~未知字段~350.00~345.00~348.00~1000000~350000000~0~0~0~0~0~0~0~0~0~0~0~0~0~0~0~0~0~0~0~0~0~0~0~0~20240105143000~1.45~350.00~345.00~352.00~348.00~1000000~350000000~0~0~0~0~0~0~0~0~0~0~0~0~0~0~0~0~0~0~0~0~0~0~0~"';
      mockHttpGet.mockResolvedValue(mockData);

      const stocks = await service.fetchStocks(['hk00700'], 'tencent');
      
      expect(stocks).toHaveLength(1);
      expect(stocks[0].code).toBe('hk00700');
      expect(stocks[0].name).toBe('腾讯控股');
      expect(stocks[0].currentPrice).toBe(350.00);
      expect(stocks[0].volume).toBe(1000000);
    });

    it('应该正确转换美股代码格式', async () => {
      const mockData = 'v_r_usAAPL="r_usAAPL~苹果~未知字段~150.00~148.00~149.00~5000000~750000000~0~0~0~0~0~0~0~0~0~0~0~0~0~0~0~0~0~0~0~0~0~0~0~0~20240105143000~1.35~150.00~148.00~151.00~149.00~5000000~750000000~0~0~0~0~0~0~0~0~0~0~0~0~0~0~0~0~0~0~0~0~0~0~0~"';
      mockHttpGet.mockResolvedValue(mockData);

      const stocks = await service.fetchStocks(['us.AAPL'], 'tencent');
      
      expect(stocks).toHaveLength(1);
      expect(stocks[0].code).toBe('us.AAPL');
      expect(stocks[0].name).toBe('苹果');
      expect(mockHttpGet).toHaveBeenCalledWith(expect.stringContaining('r_usAAPL'));
    });

    it('应该处理请求失败的情况', async () => {
      mockHttpGet.mockRejectedValue(new Error('Network error'));

      const stocks = await service.fetchStocks(['sz000001'], 'tencent');
      
      expect(stocks).toHaveLength(0);
    });

    it('应该处理无效数据格式', async () => {
      mockHttpGet.mockResolvedValue('invalid data');

      const stocks = await service.fetchStocks(['sz000001'], 'tencent');
      
      expect(stocks).toHaveLength(0);
    });

    it('应该批量获取多只股票', async () => {
      const mockData1 = 'v_sz000001="sz000001~平安银行~未知字段~10.50~10.20~10.55~50000~510000~0~0~0~0~0~0~0~0~0~0~0~0~0~0~0~0~0~0~0~0~0~0~0~0~0~20240105143000~5.00~10.50~10.20~10.55~10.45~50000~510000~0~0~0~0~0~0~0~0~0~0~0~0~0~0~0~0~0~0~0~0~0~0~0~0~0~"';
      const mockData2 = 'v_sh600000="sh600000~浦发银行~未知字段~8.50~8.30~8.55~60000~510000~0~0~0~0~0~0~0~0~0~0~0~0~0~0~0~0~0~0~0~0~0~0~0~0~20240105143000~2.41~8.50~8.30~8.55~8.45~60000~510000~0~0~0~0~0~0~0~0~0~0~0~0~0~0~0~0~0~0~0~0~0~0~0~0~0~"';
      
      mockHttpGet
        .mockResolvedValueOnce(mockData1)
        .mockResolvedValueOnce(mockData2);

      const stocks = await service.fetchStocks(['sz000001', 'sh600000'], 'tencent');
      
      expect(stocks).toHaveLength(2);
      expect(stocks[0].code).toBe('sz000001');
      expect(stocks[1].code).toBe('sh600000');
    });
  });

  describe('fetchFromSina', () => {
    it('应该正确解析新浪财经A股数据', async () => {
      // 新浪财经格式：parts[0]=名称, parts[1]=今开, parts[2]=昨收, parts[3]=当前价, parts[4]=最高, parts[5]=最低, parts[8]=成交量, parts[9]=成交额, parts[30]=日期, parts[31]=时间
      // 使用数组确保字段索引正确，确保 parts[30] 是日期，parts[31] 是时间
      const fields = Array(35).fill('');
      fields[0] = '平安银行';
      fields[1] = '10.55';
      fields[2] = '10.20';
      fields[3] = '10.50';
      fields[4] = '10.55';
      fields[5] = '10.45';
      fields[6] = '10.48';
      fields[7] = '10.49';
      fields[8] = '5000000';
      fields[9] = '51000000';
      fields[30] = '2024-01-05';
      fields[31] = '14:30:00';
      fields[32] = '00';
      const mockData = `var hq_str_sz000001="${fields.join(',')}";`;
      mockHttpGet.mockResolvedValue(mockData);

      const stocks = await service.fetchStocks(['sz000001'], 'sina');
      
      expect(stocks).toHaveLength(1);
      expect(stocks[0].code).toBe('sz000001');
      expect(stocks[0].name).toBe('平安银行');
      expect(stocks[0].currentPrice).toBe(10.50);
      expect(stocks[0].yesterdayClose).toBe(10.20);
      expect(stocks[0].todayOpen).toBe(10.55);
      expect(stocks[0].todayHigh).toBe(10.55);
      expect(stocks[0].todayLow).toBe(10.45);
      expect(stocks[0].dataTimestamp).toBe('2024-01-05 14:30:00');
    });

    it('应该过滤不支持的港美股代码', async () => {
      // 提供有效的A股数据
      const mockData = 'var hq_str_sz000001="平安银行,10.55,10.20,10.50,10.55,10.45,10.48,10.49,5000000,51000000,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,2024-01-05,14:30:00,00";';
      mockHttpGet.mockResolvedValue(mockData);
      
      const stocks = await service.fetchStocks(['hk00700', 'us.AAPL', 'sz000001'], 'sina');
      
      // 只应该获取A股
      expect(mockHttpGet).toHaveBeenCalledWith(
        expect.stringContaining('sz000001'),
        expect.any(Object)
      );
      expect(stocks).toHaveLength(1);
      expect(stocks[0].code).toBe('sz000001');
    });

    it('应该处理空结果', async () => {
      mockHttpGet.mockResolvedValue('');

      const stocks = await service.fetchStocks(['sz000001'], 'sina');
      
      expect(stocks).toHaveLength(0);
    });

    it('应该批量获取多只股票', async () => {
      const mockData = `var hq_str_sz000001="平安银行,10.55,10.20,10.50,10.55,10.45,10.48,10.49,5000000,51000000,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,2024-01-05,14:30:00,00";
var hq_str_sh600000="浦发银行,8.55,8.30,8.50,8.55,8.45,8.48,8.49,6000000,51000000,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,2024-01-05,14:30:00,00";`;
      mockHttpGet.mockResolvedValue(mockData);

      const stocks = await service.fetchStocks(['sz000001', 'sh600000'], 'sina');
      
      expect(stocks).toHaveLength(2);
      expect(stocks[0].code).toBe('sz000001');
      expect(stocks[1].code).toBe('sh600000');
    });
  });

  describe('数据解析边界情况', () => {
    it('应该处理缺失数据字段', async () => {
      const mockData = 'v_sz000001="sz000001~平安银行~未知字段~10.50~10.20~10.55~"';
      mockHttpGet.mockResolvedValue(mockData);

      const stocks = await service.fetchStocks(['sz000001'], 'tencent');
      
      expect(stocks).toHaveLength(1);
      expect(stocks[0].currentPrice).toBe(10.50);
      expect(stocks[0].todayHigh).toBe(10.50); // 使用当前价格作为默认值
    });

    it('应该计算涨跌幅', async () => {
      // 当 parts[32] 不存在或为空时，会计算涨跌幅
      // 需要确保 parts[32] 位置是空字符串
      // 构造数据：使用数组确保字段索引正确，parts[30]=时间戳，parts[32]=空字符串
      const fields = Array(35).fill('');
      fields[0] = 'sz000001';
      fields[1] = '平安银行';
      fields[2] = '未知字段';
      fields[3] = '10.50';
      fields[4] = '10.00';
      fields[5] = '10.55';
      fields[6] = '50000';
      fields[30] = '20240105143000';
      fields[31] = '某个字段';
      fields[32] = ''; // 空字符串，会触发计算
      fields[33] = '10.55';
      fields[34] = '10.45';
      const mockData = `v_sz000001="${fields.join('~')}"`;
      mockHttpGet.mockResolvedValue(mockData);

      const stocks = await service.fetchStocks(['sz000001'], 'tencent');
      
      expect(stocks).toHaveLength(1);
      // 涨跌幅应该是 (10.50 - 10.00) / 10.00 * 100 = 5.00%
      // 由于 parts[32] 为空字符串，会调用 calculateChangePercent
      expect(parseFloat(stocks[0].changePercent)).toBeCloseTo(5.00, 2);
    });

    it('应该处理成交量和成交额计算', async () => {
      const mockData = 'v_sz000001="sz000001~平安银行~未知字段~10.50~10.20~10.55~50000~510000~0~0~0~0~0~0~0~0~0~0~0~0~0~0~0~0~0~0~0~0~0~0~0~0~0~20240105143000~5.00~10.50~10.20~10.55~10.45~50000~510000~0~0~0~0~0~0~0~0~0~0~0~0~0~0~0~0~0~0~0~0~0~0~0~0~0~"';
      mockHttpGet.mockResolvedValue(mockData);

      const stocks = await service.fetchStocks(['sz000001'], 'tencent');
      
      expect(stocks).toHaveLength(1);
      expect(stocks[0].volume).toBe(50000);
      // A股成交额应该是 510000 * 10000 = 5100000000 元（A股成交额单位是万元，需要乘以10000）
      expect(stocks[0].turnover).toBeGreaterThan(0);
    });
  });
});
