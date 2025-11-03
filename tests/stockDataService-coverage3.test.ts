import { StockDataService } from '../src/stockDataService';
import * as utils from '../src/utils';

jest.mock('../src/utils', () => ({
  ...jest.requireActual('../src/utils'),
  httpGet: jest.fn(),
}));

describe('StockDataService 覆盖率补充测试3', () => {
  let service: StockDataService;
  const mockHttpGet = utils.httpGet as jest.MockedFunction<typeof utils.httpGet>;

  beforeEach(() => {
    service = new StockDataService();
    jest.clearAllMocks();
  });

  describe('parseSinaData - match[1] 为空的情况', () => {
    it('应该处理 match[1] 为空字符串的情况', async () => {
      const mockData = 'var hq_str_sz000001="";'; // match[1] 为空字符串
      mockHttpGet.mockResolvedValue(mockData);

      const stocks = await service.fetchStocks(['sz000001'], 'sina');
      
      expect(stocks).toHaveLength(0);
    });
  });

  describe('parseSinaStock - dataTimestamp 为空的情况', () => {
    it('应该处理 dataDate 或 dataTime 为空的情况', async () => {
      const fields = Array(35).fill('');
      fields[0] = '平安银行';
      fields[1] = '10.55';
      fields[2] = '10.20';
      fields[3] = '10.50';
      fields[4] = '10.55';
      fields[5] = '10.45';
      fields[8] = '5000000';
      fields[9] = '51000000';
      // 索引30或31为空
      const mockData = `var hq_str_sz000001="${fields.join(',')}";`;
      mockHttpGet.mockResolvedValue(mockData);

      const stocks = await service.fetchStocks(['sz000001'], 'sina');
      
      expect(stocks).toHaveLength(1);
      expect(stocks[0].dataTimestamp).toBe(''); // 应该为空
    });
  });
});

