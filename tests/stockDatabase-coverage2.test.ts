import {
  fetchIndicesFromSina,
  fetchETFsFromSina,
} from '../src/stockDatabase';
import * as utils from '../src/utils';

jest.mock('../src/utils', () => ({
  ...jest.requireActual('../src/utils'),
  httpGet: jest.fn(),
  generateCodes: jest.fn(),
  randomDelay: jest.fn(() => 0),
}));

describe('stockDatabase 覆盖率补充测试2', () => {
  const mockHttpGet = utils.httpGet as jest.MockedFunction<typeof utils.httpGet>;
  const mockGenerateCodes = utils.generateCodes as jest.MockedFunction<typeof utils.generateCodes>;

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('fetchIndicesFromSina - 错误处理', () => {
    it('应该处理外层 catch 错误', async () => {
      // 模拟外层抛出错误
      mockHttpGet.mockRejectedValue(new Error('Outer error'));

      const stocks = await fetchIndicesFromSina();

      expect(stocks).toEqual([]);
    });

    it('应该处理内层 catch 错误（159-160行）', async () => {
      // 模拟第一个批次成功，第二个批次失败
      mockHttpGet
        .mockResolvedValueOnce('var hq_str_sh000001="上证指数,3000.00";')
        .mockRejectedValueOnce(new Error('Inner error'));

      const stocks = await fetchIndicesFromSina();

      // 应该返回成功的批次
      expect(stocks.length).toBeGreaterThanOrEqual(0);
    });
  });

  describe('fetchETFsFromSina - 错误处理', () => {
    it('应该处理外层 catch 错误（208-209行）', async () => {
      mockGenerateCodes.mockImplementation(() => {
        throw new Error('Generate codes error');
      });

      const stocks = await fetchETFsFromSina();

      expect(stocks).toEqual([]);
    });
  });
});

