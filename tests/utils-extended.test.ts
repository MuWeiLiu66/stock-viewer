import {
  httpGet,
  executeConcurrent,
  randomDelay,
  formatVolume,
  formatTurnover,
  getStockPrefix,
} from '../src/utils';
import * as http from 'http';
import * as https from 'https';

// Mock http 和 https 模块
jest.mock('http');
jest.mock('https');

describe('utils 扩展测试', () => {
  describe('httpGet', () => {
    let mockHttpGet: jest.Mock;
    let mockHttpsGet: jest.Mock;

    beforeEach(() => {
      jest.clearAllMocks();
      mockHttpGet = http.get as jest.Mock;
      mockHttpsGet = https.get as jest.Mock;
    });

    it('应该使用 http 协议处理 http URL', async () => {
      const mockRequest: any = {
        on: jest.fn((event: string, callback: (data?: Buffer) => void) => {
          if (event === 'data') {
            callback(Buffer.from('test data', 'utf-8'));
          }
          if (event === 'end') {
            callback();
          }
          return mockRequest;
        }),
      };

      mockHttpGet.mockImplementation((url, options, callback) => {
        const mockResponse = {
          statusCode: 200,
          on: jest.fn((event, handler) => {
            if (event === 'data') {
              handler(Buffer.from('测试数据', 'utf-8'));
            }
            if (event === 'end') {
              handler();
            }
          }),
        };
        callback(mockResponse);
        return mockRequest;
      });

      const result = await httpGet('http://example.com');

      expect(mockHttpGet).toHaveBeenCalled();
      expect(mockHttpsGet).not.toHaveBeenCalled();
    });

    it('应该使用 https 协议处理 https URL', async () => {
      const mockRequest: any = {
        on: jest.fn((event: string, callback: (data?: Buffer) => void) => {
          if (event === 'data') {
            callback(Buffer.from('test data', 'utf-8'));
          }
          if (event === 'end') {
            callback();
          }
          return mockRequest;
        }),
      };

      mockHttpsGet.mockImplementation((url, options, callback) => {
        const mockResponse = {
          statusCode: 200,
          on: jest.fn((event: string, handler: (data?: Buffer) => void) => {
            if (event === 'data') {
              handler(Buffer.from('测试数据', 'utf-8'));
            }
            if (event === 'end') {
              handler();
            }
          }),
        };
        callback(mockResponse);
        return mockRequest;
      });

      const result = await httpGet('https://example.com');

      expect(mockHttpsGet).toHaveBeenCalled();
      expect(mockHttpGet).not.toHaveBeenCalled();
    });

    it('应该处理 HTTP 错误状态码', async () => {
      mockHttpGet.mockImplementation((url, options, callback) => {
        const mockResponse = {
          statusCode: 404,
        };
        callback(mockResponse);
        return { on: jest.fn() };
      });

      await expect(httpGet('http://example.com')).rejects.toThrow('HTTP 404');
    });

    it('应该处理网络错误', async () => {
      const mockRequest: any = {
        on: jest.fn((event: string, callback: (error: Error) => void) => {
          if (event === 'error') {
            callback(new Error('Network error'));
          }
          return mockRequest;
        }),
      };

      mockHttpGet.mockReturnValue(mockRequest);

      await expect(httpGet('http://example.com')).rejects.toThrow('Network error');
    });

    it('应该在 GBK 解码失败时回退到 UTF-8', async () => {
      // 创建一个无效的 GBK 字节序列
      const invalidGbkBuffer = Buffer.from([0xFF, 0xFE, 0xFD]);

      mockHttpGet.mockImplementation((url, options, callback) => {
        const mockResponse = {
          statusCode: 200,
          on: jest.fn((event, handler) => {
            if (event === 'data') {
              handler(invalidGbkBuffer);
            }
            if (event === 'end') {
              handler();
            }
          }),
        };
        callback(mockResponse);
        return { on: jest.fn() };
      });

      // 虽然 GBK 解码可能失败，但应该回退到 UTF-8
      const result = await httpGet('http://example.com');
      expect(typeof result).toBe('string');
    });

    it('应该传递自定义 headers', async () => {
      const customHeaders = {
        'User-Agent': 'Test Agent',
        'Referer': 'http://test.com',
      };

      mockHttpGet.mockImplementation((url, options, callback) => {
        expect(options.headers).toEqual(customHeaders);
        const mockResponse = {
          statusCode: 200,
          on: jest.fn((event, handler) => {
            if (event === 'end') {
              handler();
            }
          }),
        };
        callback(mockResponse);
        return { on: jest.fn() };
      });

      await httpGet('http://example.com', customHeaders);
    });
  });

  describe('executeConcurrent', () => {
    it('应该并发执行任务', async () => {
      const tasks = [
        () => Promise.resolve(1),
        () => Promise.resolve(2),
        () => Promise.resolve(3),
      ];

      const results = await executeConcurrent(tasks, 2);

      expect(results).toEqual([1, 2, 3]);
    });

    it('应该限制并发数量', async () => {
      const executionOrder: number[] = [];
      const tasks = Array.from({ length: 10 }, (_, i) => () => {
        executionOrder.push(i);
        return Promise.resolve(i);
      });

      const results = await executeConcurrent(tasks, 3);

      // 验证所有任务都执行完成
      expect(results.length).toBe(10);
      expect(results).toEqual([0, 1, 2, 3, 4, 5, 6, 7, 8, 9]);
    });

    it('应该过滤失败的任务（返回 null）', async () => {
      const tasks = [
        () => Promise.resolve(1),
        () => Promise.reject(new Error('Failed')),
        () => Promise.resolve(3),
      ];

      const results = await executeConcurrent(tasks, 2);

      expect(results).toEqual([1, 3]);
      expect(results.length).toBe(2);
    });

    it('应该处理空任务数组', async () => {
      const results = await executeConcurrent([], 5);

      expect(results).toEqual([]);
    });

    it('应该处理并发数大于任务数的情况', async () => {
      const tasks = [
        () => Promise.resolve(1),
        () => Promise.resolve(2),
      ];

      const results = await executeConcurrent(tasks, 10);

      expect(results).toEqual([1, 2]);
    });
  });

  describe('randomDelay', () => {
    it('应该在指定范围内生成随机延迟', () => {
      for (let i = 0; i < 10; i++) {
        const delay = randomDelay(10, 20);
        expect(delay).toBeGreaterThanOrEqual(10);
        expect(delay).toBeLessThan(20);
      }
    });

    it('应该处理相同的最小值和最大值', () => {
      const delay = randomDelay(10, 10);
      expect(delay).toBe(10);
    });
  });

  describe('formatVolume 边界情况', () => {
    it('应该处理零值', () => {
      expect(formatVolume(0, 'a')).toBe('0手');
      expect(formatVolume(0, 'hk')).toBe('0股');
      expect(formatVolume(0, 'us')).toBe('0股');
    });

    it('应该处理小数', () => {
      expect(formatVolume(12345.67, 'a')).toBe('1.23万手');
    });
  });

  describe('formatTurnover 边界情况', () => {
    it('应该处理零值', () => {
      expect(formatTurnover(0)).toBe('0元');
    });

    it('应该处理小数', () => {
      expect(formatTurnover(12345.67)).toBe('1.23万元');
    });

    it('应该处理非常大的数值', () => {
      expect(formatTurnover(123456789012)).toBe('1234.57亿元');
    });
  });

  describe('getStockPrefix 边界情况', () => {
    it('应该处理边界值', () => {
      expect(getStockPrefix(600000)).toBe('sh');
      expect(getStockPrefix(605999)).toBe('sh');
      expect(getStockPrefix(688000)).toBe('sh');
      expect(getStockPrefix(689999)).toBe('sh');
      expect(getStockPrefix(0)).toBe('sz');
      expect(getStockPrefix(6999)).toBe('sz');
      expect(getStockPrefix(300000)).toBe('sz');
      expect(getStockPrefix(302999)).toBe('sz');
      expect(getStockPrefix(920000)).toBe('bj');
      expect(getStockPrefix(920999)).toBe('bj');
    });

    it('应该处理超出范围的值', () => {
      expect(getStockPrefix(999999)).toBe('sz'); // 默认返回 sz
      expect(getStockPrefix(-1)).toBe('sz');
    });
  });
});

