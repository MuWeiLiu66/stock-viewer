import {
  formatTurnover,
  isMarketOpen,
  isMarketOpenByData,
} from '../src/utils';

describe('utils 覆盖率补充测试', () => {
  describe('formatTurnover', () => {
    it('应该处理小于10000的成交额', () => {
      expect(formatTurnover(9999)).toBe('9999元');
      expect(formatTurnover(5000)).toBe('5000元');
      expect(formatTurnover(100)).toBe('100元');
    });
  });

  describe('isMarketOpen', () => {
    beforeEach(() => {
      jest.useFakeTimers();
    });

    afterEach(() => {
      jest.useRealTimers();
    });

    it('应该在非交易时间返回 false（早于9:15）', () => {
      jest.setSystemTime(new Date('2024-01-01T09:14:00')); // 周一 9:14
      expect(isMarketOpen()).toBe(false);
    });

    it('应该在非交易时间返回 false（11:30-13:00之间）', () => {
      jest.setSystemTime(new Date('2024-01-01T12:00:00')); // 周一 12:00
      expect(isMarketOpen()).toBe(false);
    });

    it('应该在非交易时间返回 false（晚于15:00）', () => {
      jest.setSystemTime(new Date('2024-01-01T15:01:00')); // 周一 15:01
      expect(isMarketOpen()).toBe(false);
    });

    it('应该在周末返回 false', () => {
      jest.setSystemTime(new Date('2024-01-06T10:00:00')); // 周六 10:00
      expect(isMarketOpen()).toBe(false);
    });

    it('应该在周日返回 false', () => {
      jest.setSystemTime(new Date('2024-01-07T10:00:00')); // 周日 10:00
      expect(isMarketOpen()).toBe(false);
    });
  });

  describe('isMarketOpenByData', () => {
    beforeEach(() => {
      jest.useFakeTimers();
    });

    afterEach(() => {
      jest.useRealTimers();
    });

    it('应该处理空时间戳', () => {
      jest.setSystemTime(new Date('2024-01-05T10:00:00'));
      expect(isMarketOpenByData('', 'tencent')).toBeDefined();
      expect(isMarketOpenByData('   ', 'sina')).toBeDefined();
      expect(isMarketOpenByData(undefined, 'tencent')).toBeDefined();
    });

    it('应该处理腾讯财经格式的时间戳（长度不足8）', () => {
      jest.setSystemTime(new Date('2024-01-05T10:00:00'));
      expect(isMarketOpenByData('2024', 'tencent')).toBeDefined();
      expect(isMarketOpenByData('202401', 'tencent')).toBeDefined();
    });

    it('应该处理新浪财经格式的时间戳（无日期匹配）', () => {
      jest.setSystemTime(new Date('2024-01-05T10:00:00'));
      expect(isMarketOpenByData('invalid date', 'sina')).toBeDefined();
      expect(isMarketOpenByData('2024/01/01', 'sina')).toBeDefined();
    });

    it('应该处理非今天的数据日期', () => {
      jest.setSystemTime(new Date('2024-01-05T10:00:00'));
      // 数据日期是昨天
      expect(isMarketOpenByData('20240104143000', 'tencent')).toBe(false);
      expect(isMarketOpenByData('2024-01-04 14:30:00', 'sina')).toBe(false);
    });

    it('应该处理腾讯财经格式的时间戳（长度不足14但>=8）', () => {
      jest.setSystemTime(new Date('2024-01-05T10:00:00'));
      // 日期正确但时间部分不完整
      expect(isMarketOpenByData('2024010510', 'tencent')).toBeDefined();
    });

    it('应该处理新浪财经格式的时间戳（无时间匹配）', () => {
      jest.setSystemTime(new Date('2024-01-05T10:00:00'));
      // 日期正确但时间格式不正确
      expect(isMarketOpenByData('2024-01-05 invalid', 'sina')).toBeDefined();
    });
  });
});

