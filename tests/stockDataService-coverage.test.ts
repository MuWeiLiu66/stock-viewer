import { StockDataService } from '../src/stockDataService';
import * as utils from '../src/utils';

jest.mock('../src/utils', () => ({
  ...jest.requireActual('../src/utils'),
  httpGet: jest.fn(),
}));

describe('StockDataService 覆盖率补充测试', () => {
  let service: StockDataService;
  const mockHttpGet = utils.httpGet as jest.MockedFunction<typeof utils.httpGet>;

  beforeEach(() => {
    service = new StockDataService();
    jest.clearAllMocks();
  });

  describe('extractVolume - 使用 parts[36]', () => {
    it('应该使用 parts[36] 当 parts[6] 不存在时（港股）', async () => {
      const fields = Array(40).fill('');
      fields[0] = 'hk00700';
      fields[1] = '腾讯控股';
      fields[3] = '350.00';
      fields[4] = '345.00';
      fields[5] = '348.00';
      fields[36] = '1000000'; // 使用索引36
      fields[30] = '20240105143000';
      fields[32] = '1.45';
      fields[33] = '352.00';
      fields[34] = '348.00';
      const mockData = `v_hk00700="${fields.join('~')}"`;
      mockHttpGet.mockResolvedValue(mockData);

      const stocks = await service.fetchStocks(['hk00700'], 'tencent');
      
      expect(stocks).toHaveLength(1);
      expect(stocks[0].volume).toBe(1000000);
    });

    it('应该使用 parts[36] 当 parts[6] 不存在时（美股）', async () => {
      const fields = Array(40).fill('');
      fields[0] = 'r_usAAPL';
      fields[1] = '苹果';
      fields[3] = '150.00';
      fields[4] = '148.00';
      fields[5] = '149.00';
      fields[36] = '5000000'; // 使用索引36
      fields[30] = '20240105143000';
      fields[32] = '1.35';
      fields[33] = '151.00';
      fields[34] = '149.00';
      const mockData = `v_r_usAAPL="${fields.join('~')}"`;
      mockHttpGet.mockResolvedValue(mockData);

      const stocks = await service.fetchStocks(['us.AAPL'], 'tencent');
      
      expect(stocks).toHaveLength(1);
      expect(stocks[0].volume).toBe(5000000);
    });
  });

  describe('calculateTurnover - 各种分支', () => {
    it('应该处理 A股成交额小于1000的情况（需要乘以10000）', async () => {
      const fields = Array(40).fill('');
      fields[0] = 'sz000001';
      fields[1] = '平安银行';
      fields[3] = '10.50';
      fields[4] = '10.20';
      fields[5] = '10.55';
      fields[6] = '50000';
      fields[37] = '500'; // 小于1000，需要乘以10000
      fields[30] = '20240105143000';
      fields[32] = '5.00';
      fields[33] = '10.55';
      fields[34] = '10.45';
      const mockData = `v_sz000001="${fields.join('~')}"`;
      mockHttpGet.mockResolvedValue(mockData);

      const stocks = await service.fetchStocks(['sz000001'], 'tencent');
      
      expect(stocks).toHaveLength(1);
      expect(stocks[0].turnover).toBe(5000000); // 500 * 10000
    });

    it('应该处理 A股成交额大于等于1000的情况（仍然是万元，需要乘以10000）', async () => {
      const fields = Array(40).fill('');
      fields[0] = 'sz000001';
      fields[1] = '平安银行';
      fields[3] = '10.50';
      fields[4] = '10.20';
      fields[5] = '10.55';
      fields[6] = '50000';
      fields[37] = '5000'; // 5000万元，需要乘以10000
      fields[30] = '20240105143000';
      fields[32] = '5.00';
      fields[33] = '10.55';
      fields[34] = '10.45';
      const mockData = `v_sz000001="${fields.join('~')}"`;
      mockHttpGet.mockResolvedValue(mockData);

      const stocks = await service.fetchStocks(['sz000001'], 'tencent');
      
      expect(stocks).toHaveLength(1);
      expect(stocks[0].turnover).toBe(50000000); // 5000 * 10000 = 50000000元
    });

    it('应该处理 A股无索引37时使用索引7或10', async () => {
      const fields = Array(40).fill('');
      fields[0] = 'sz000001';
      fields[1] = '平安银行';
      fields[3] = '10.50';
      fields[4] = '10.20';
      fields[5] = '10.55';
      fields[6] = '50000';
      fields[7] = '51000000'; // 使用索引7
      fields[30] = '20240105143000';
      fields[32] = '5.00';
      fields[33] = '10.55';
      fields[34] = '10.45';
      const mockData = `v_sz000001="${fields.join('~')}"`;
      mockHttpGet.mockResolvedValue(mockData);

      const stocks = await service.fetchStocks(['sz000001'], 'tencent');
      
      expect(stocks).toHaveLength(1);
      expect(stocks[0].turnover).toBe(51000000);
    });

    it('应该处理 A股无成交额时根据成交量和价格计算', async () => {
      const fields = Array(40).fill('');
      fields[0] = 'sz000001';
      fields[1] = '平安银行';
      fields[3] = '10.50';
      fields[4] = '10.20';
      fields[5] = '10.55';
      fields[6] = '50000'; // 50000手
      // 没有索引37、7、10的成交额
      fields[30] = '20240105143000';
      fields[32] = '5.00';
      fields[33] = '10.55';
      fields[34] = '10.45';
      const mockData = `v_sz000001="${fields.join('~')}"`;
      mockHttpGet.mockResolvedValue(mockData);

      const stocks = await service.fetchStocks(['sz000001'], 'tencent');
      
      expect(stocks).toHaveLength(1);
      // 成交额 = 成交量(手) * 100 * 价格 = 50000 * 100 * 10.50 = 52500000
      expect(stocks[0].turnover).toBe(52500000);
    });

    it('应该处理 港股成交额（直接使用）', async () => {
      const fields = Array(40).fill('');
      fields[0] = 'hk00700';
      fields[1] = '腾讯控股';
      fields[3] = '350.00';
      fields[4] = '345.00';
      fields[5] = '348.00';
      fields[6] = '1000000';
      fields[37] = '350000000'; // 港股成交额已经是元
      fields[30] = '20240105143000';
      fields[32] = '1.45';
      fields[33] = '352.00';
      fields[34] = '348.00';
      const mockData = `v_hk00700="${fields.join('~')}"`;
      mockHttpGet.mockResolvedValue(mockData);

      const stocks = await service.fetchStocks(['hk00700'], 'tencent');
      
      expect(stocks).toHaveLength(1);
      expect(stocks[0].turnover).toBe(350000000); // 直接使用
    });
  });

  describe('parseSinaData - 边界情况', () => {
    it('应该处理 parts.length < 4 的情况', async () => {
      const mockData = 'var hq_str_sz000001="平安银行,10.55,10.20";'; // 只有3个字段
      mockHttpGet.mockResolvedValue(mockData);

      const stocks = await service.fetchStocks(['sz000001'], 'sina');
      
      expect(stocks).toHaveLength(0);
    });

    it('应该处理 match 为空的情况', async () => {
      const mockData = 'invalid format without match';
      mockHttpGet.mockResolvedValue(mockData);

      const stocks = await service.fetchStocks(['sz000001'], 'sina');
      
      expect(stocks).toHaveLength(0);
    });
  });

  describe('adjustSinaTurnover - 各种分支', () => {
    it('应该处理 ratio < 0.1 且 turnover < 100000000 的情况', async () => {
      // 这种情况会乘以10000
      const fields = Array(35).fill('');
      fields[0] = '平安银行';
      fields[1] = '10.55';
      fields[2] = '10.20';
      fields[3] = '10.50';
      fields[4] = '10.55';
      fields[5] = '10.45';
      fields[8] = '5000000'; // 50000手
      fields[9] = '50000'; // 成交额很小，ratio会<0.1
      fields[30] = '2024-01-05';
      fields[31] = '14:30:00';
      const mockData = `var hq_str_sz000001="${fields.join(',')}";`;
      mockHttpGet.mockResolvedValue(mockData);

      const stocks = await service.fetchStocks(['sz000001'], 'sina');
      
      expect(stocks).toHaveLength(1);
      // adjustSinaTurnover 应该会乘以10000
      expect(stocks[0].turnover).toBeGreaterThan(50000);
    });
  });
});

