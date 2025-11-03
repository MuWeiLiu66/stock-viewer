import { StockDataService } from '../src/stockDataService';
import * as utils from '../src/utils';

jest.mock('../src/utils', () => ({
  ...jest.requireActual('../src/utils'),
  httpGet: jest.fn(),
}));

describe('StockDataService 覆盖率补充测试2', () => {
  let service: StockDataService;
  const mockHttpGet = utils.httpGet as jest.MockedFunction<typeof utils.httpGet>;

  beforeEach(() => {
    service = new StockDataService();
    jest.clearAllMocks();
  });

  describe('calculateTurnover - A股使用索引7或10', () => {
    it('应该使用索引7当索引37不存在时', async () => {
      const fields = Array(40).fill('');
      fields[0] = 'sz000001';
      fields[1] = '平安银行';
      fields[3] = '10.50';
      fields[4] = '10.20';
      fields[5] = '10.55';
      fields[6] = '50000';
      fields[7] = '51000000'; // 使用索引7
      // 索引37为空
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

    it('应该使用索引10当索引37和7都不存在时', async () => {
      const fields = Array(40).fill('');
      fields[0] = 'sz000001';
      fields[1] = '平安银行';
      fields[3] = '10.50';
      fields[4] = '10.20';
      fields[5] = '10.55';
      fields[6] = '50000';
      // 索引7为空
      fields[10] = '52000000'; // 使用索引10
      fields[30] = '20240105143000';
      fields[32] = '5.00';
      fields[33] = '10.55';
      fields[34] = '10.45';
      const mockData = `v_sz000001="${fields.join('~')}"`;
      mockHttpGet.mockResolvedValue(mockData);

      const stocks = await service.fetchStocks(['sz000001'], 'tencent');
      
      expect(stocks).toHaveLength(1);
      expect(stocks[0].turnover).toBe(52000000);
    });

    it('应该跳过候选索引如果值过大', async () => {
      const fields = Array(40).fill('');
      fields[0] = 'sz000001';
      fields[1] = '平安银行';
      fields[3] = '10.50';
      fields[4] = '10.20';
      fields[5] = '10.55';
      fields[6] = '50000';
      fields[7] = '99999999999999'; // 值过大，应该跳过
      fields[10] = '52000000'; // 使用索引10
      fields[30] = '20240105143000';
      fields[32] = '5.00';
      fields[33] = '10.55';
      fields[34] = '10.45';
      const mockData = `v_sz000001="${fields.join('~')}"`;
      mockHttpGet.mockResolvedValue(mockData);

      const stocks = await service.fetchStocks(['sz000001'], 'tencent');
      
      expect(stocks).toHaveLength(1);
      expect(stocks[0].turnover).toBe(52000000); // 应该使用索引10
    });
  });

  describe('parseSinaData - 边界情况', () => {
    it('应该处理 match 不存在的情况', async () => {
      const mockData = 'invalid line without match';
      mockHttpGet.mockResolvedValue(mockData);

      const stocks = await service.fetchStocks(['sz000001'], 'sina');
      
      expect(stocks).toHaveLength(0);
    });

    it('应该处理 match[1] 为空的情况', async () => {
      const mockData = 'var hq_str_sz000001="";'; // match[1] 为空
      mockHttpGet.mockResolvedValue(mockData);

      const stocks = await service.fetchStocks(['sz000001'], 'sina');
      
      expect(stocks).toHaveLength(0);
    });
  });

  describe('adjustSinaTurnover - ratio > 100 的情况', () => {
    it('应该在 ratio > 100 时除以100', async () => {
      // 创建 ratio > 100 的情况：成交额很大，但估算值很小
      const fields = Array(35).fill('');
      fields[0] = '平安银行';
      fields[1] = '10.55';
      fields[2] = '10.20';
      fields[3] = '10.50';
      fields[4] = '10.55';
      fields[5] = '10.45';
      fields[8] = '5000'; // 很小的成交量（50手）
      fields[9] = '50000000000'; // 很大的成交额，ratio会>100
      fields[30] = '2024-01-05';
      fields[31] = '14:30:00';
      const mockData = `var hq_str_sz000001="${fields.join(',')}";`;
      mockHttpGet.mockResolvedValue(mockData);

      const stocks = await service.fetchStocks(['sz000001'], 'sina');
      
      expect(stocks).toHaveLength(1);
      // adjustSinaTurnover 应该会除以100
      expect(stocks[0].turnover).toBeLessThan(50000000000);
    });
  });
});

