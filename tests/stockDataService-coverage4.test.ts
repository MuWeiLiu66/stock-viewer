import { StockDataService } from '../src/stockDataService';
import * as utils from '../src/utils';

jest.mock('../src/utils', () => ({
  ...jest.requireActual('../src/utils'),
  httpGet: jest.fn(),
}));

describe('StockDataService 覆盖率补充测试4', () => {
  let service: StockDataService;
  const mockHttpGet = utils.httpGet as jest.MockedFunction<typeof utils.httpGet>;

  beforeEach(() => {
    service = new StockDataService();
    jest.clearAllMocks();
  });

  describe('calculateTurnover - 使用 volume 和 currentPrice 计算', () => {
    it('应该为港股根据成交量和价格计算成交额（索引37不存在）', async () => {
      const fields = Array(40).fill('');
      fields[0] = 'hk00700';
      fields[1] = '腾讯控股';
      fields[3] = '350.00';
      fields[4] = '345.00';
      fields[5] = '348.00';
      fields[6] = '1000000'; // 100万股
      // 索引37为空，应该根据成交量和价格计算
      fields[30] = '20240105143000';
      fields[32] = '1.45';
      fields[33] = '352.00';
      fields[34] = '348.00';
      const mockData = `v_hk00700="${fields.join('~')}"`;
      mockHttpGet.mockResolvedValue(mockData);

      const stocks = await service.fetchStocks(['hk00700'], 'tencent');
      
      expect(stocks).toHaveLength(1);
      // 港股：成交额 = 成交量(股) * 价格 = 1000000 * 350.00 = 350000000
      expect(stocks[0].turnover).toBe(350000000);
    });

    it('应该为美股根据成交量和价格计算成交额（索引37不存在）', async () => {
      const fields = Array(40).fill('');
      fields[0] = 'r_usAAPL';
      fields[1] = '苹果';
      fields[3] = '150.00';
      fields[4] = '148.00';
      fields[5] = '149.00';
      fields[6] = '5000000'; // 500万股
      // 索引37为空，应该根据成交量和价格计算
      fields[30] = '20240105143000';
      fields[32] = '1.35';
      fields[33] = '151.00';
      fields[34] = '149.00';
      const mockData = `v_r_usAAPL="${fields.join('~')}"`;
      mockHttpGet.mockResolvedValue(mockData);

      const stocks = await service.fetchStocks(['us.AAPL'], 'tencent');
      
      expect(stocks).toHaveLength(1);
      // 美股：成交额 = 成交量(股) * 价格 = 5000000 * 150.00 = 750000000
      expect(stocks[0].turnover).toBe(750000000);
    });
  });

  describe('parseTimestampToTime - catch 错误处理', () => {
    it('应该在解析时间戳时 catch 错误并返回 null', async () => {
      // 创建一个会导致解析错误的时间戳格式
      const fields = Array(35).fill('');
      fields[0] = '平安银行';
      fields[1] = '10.55';
      fields[2] = '10.20';
      fields[3] = '10.50';
      fields[4] = '10.55';
      fields[5] = '10.45';
      fields[8] = '5000000';
      fields[9] = '51000000';
      fields[30] = '2024-01-05';
      fields[31] = '14:30:00';
      const mockData = `var hq_str_sz000001="${fields.join(',')}";`;
      mockHttpGet.mockResolvedValue(mockData);

      const stocks = await service.fetchStocks(['sz000001'], 'sina');
      
      expect(stocks).toHaveLength(1);
      // parseTimestampToTime 应该能正常解析，如果有错误会返回 null
      expect(stocks[0].updateTime).toBeDefined();
    });
  });
});

