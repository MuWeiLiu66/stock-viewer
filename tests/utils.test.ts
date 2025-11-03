import {
  formatVolume,
  formatVolumeByCode,
  formatTurnover,
  formatChangePercent,
  formatChangeAmount,
  getStockPrefix,
  generateCodes,
  isMarketOpen,
  isMarketOpenByData,
  getStockUnitType,
} from '../src/utils';

describe('utils', () => {
  describe('formatVolume', () => {
    it('应该正确格式化A股成交量（手）', () => {
      expect(formatVolume(50000, 'a')).toBe('5.00万手');
      expect(formatVolume(100000000, 'a')).toBe('1.00亿手');
      expect(formatVolume(999, 'a')).toBe('999手');
    });

    it('应该正确格式化港股成交量（股）', () => {
      expect(formatVolume(50000, 'hk')).toBe('5.00万股');
      expect(formatVolume(100000000, 'hk')).toBe('1.00亿股');
      expect(formatVolume(999, 'hk')).toBe('999股');
    });

    it('应该正确格式化美股成交量（股）', () => {
      expect(formatVolume(50000, 'us')).toBe('5.00万股');
      expect(formatVolume(100000000, 'us')).toBe('1.00亿股');
      expect(formatVolume(999, 'us')).toBe('999股');
    });
  });

  describe('formatVolumeByCode', () => {
    it('应该根据A股代码自动判断单位', () => {
      expect(formatVolumeByCode(50000, 'sz000001')).toBe('5.00万手');
      expect(formatVolumeByCode(50000, 'sh600000')).toBe('5.00万手');
    });

    it('应该根据港股代码自动判断单位', () => {
      expect(formatVolumeByCode(50000, 'hk00700')).toBe('5.00万股');
    });

    it('应该根据美股代码自动判断单位', () => {
      expect(formatVolumeByCode(50000, 'us.AAPL')).toBe('5.00万股');
    });
  });

  describe('formatTurnover', () => {
    it('应该正确格式化成交额', () => {
      expect(formatTurnover(50000)).toBe('5.00万元');
      expect(formatTurnover(100000000)).toBe('1.00亿元');
      expect(formatTurnover(999)).toBe('999元');
    });
  });

  describe('formatChangePercent', () => {
    it('应该正确格式化涨跌幅', () => {
      expect(formatChangePercent('5.25')).toBe('+5.25%');
      expect(formatChangePercent('-3.50')).toBe('-3.50%');
      expect(formatChangePercent('0.00')).toBe('+0.00%');
    });
  });

  describe('formatChangeAmount', () => {
    it('应该正确格式化涨跌额', () => {
      expect(formatChangeAmount(5.25)).toBe('+5.25');
      expect(formatChangeAmount(-3.50)).toBe('-3.50');
      expect(formatChangeAmount(0)).toBe('+0.00');
    });
  });

  describe('getStockPrefix', () => {
    it('应该正确识别上海股票前缀', () => {
      expect(getStockPrefix(600000)).toBe('sh');
      expect(getStockPrefix(605999)).toBe('sh');
      expect(getStockPrefix(688000)).toBe('sh');
      expect(getStockPrefix(689999)).toBe('sh');
    });

    it('应该正确识别深圳股票前缀', () => {
      expect(getStockPrefix(0)).toBe('sz');
      expect(getStockPrefix(6999)).toBe('sz');
      expect(getStockPrefix(300000)).toBe('sz');
      expect(getStockPrefix(302999)).toBe('sz');
    });

    it('应该正确识别北交所股票前缀', () => {
      expect(getStockPrefix(920000)).toBe('bj');
      expect(getStockPrefix(920999)).toBe('bj');
    });

    it('默认返回深圳前缀', () => {
      expect(getStockPrefix(999999)).toBe('sz');
    });
  });

  describe('generateCodes', () => {
    it('应该生成指定范围的股票代码', () => {
      const codes = generateCodes('sz', 1, 5);
      expect(codes).toEqual(['sz000001', 'sz000002', 'sz000003', 'sz000004', 'sz000005']);
    });

    it('应该正确处理6位数字补零', () => {
      const codes = generateCodes('sh', 600000, 600002);
      expect(codes).toEqual(['sh600000', 'sh600001', 'sh600002']);
    });
  });

  describe('getStockUnitType', () => {
    it('应该正确识别A股类型', () => {
      expect(getStockUnitType('sz000001')).toBe('a');
      expect(getStockUnitType('sh600000')).toBe('a');
      expect(getStockUnitType('bj920001')).toBe('a');
    });

    it('应该正确识别港股类型', () => {
      expect(getStockUnitType('hk00700')).toBe('hk');
      expect(getStockUnitType('HK00700')).toBe('hk');
    });

    it('应该正确识别美股类型', () => {
      expect(getStockUnitType('us.AAPL')).toBe('us');
      expect(getStockUnitType('US.AAPL')).toBe('us');
    });
  });

  describe('isMarketOpen', () => {
    beforeEach(() => {
      jest.useFakeTimers();
    });

    afterEach(() => {
      jest.useRealTimers();
    });

    it('应该在周末返回false', () => {
      // 2024-01-06 是周六
      jest.setSystemTime(new Date('2024-01-06T10:00:00'));
      expect(isMarketOpen()).toBe(false);

      // 2024-01-07 是周日
      jest.setSystemTime(new Date('2024-01-07T10:00:00'));
      expect(isMarketOpen()).toBe(false);
    });

    it('应该在交易时间内返回true', () => {
      // 2024-01-05 是周五
      // 上午交易时间：9:15-11:30
      jest.setSystemTime(new Date('2024-01-05T09:15:00'));
      expect(isMarketOpen()).toBe(true);

      jest.setSystemTime(new Date('2024-01-05T10:00:00'));
      expect(isMarketOpen()).toBe(true);

      jest.setSystemTime(new Date('2024-01-05T11:30:00'));
      expect(isMarketOpen()).toBe(true);

      // 下午交易时间：13:00-15:00
      jest.setSystemTime(new Date('2024-01-05T13:00:00'));
      expect(isMarketOpen()).toBe(true);

      jest.setSystemTime(new Date('2024-01-05T14:00:00'));
      expect(isMarketOpen()).toBe(true);

      jest.setSystemTime(new Date('2024-01-05T15:00:00'));
      expect(isMarketOpen()).toBe(true);
    });

    it('应该在非交易时间返回false', () => {
      // 2024-01-05 是周五
      // 早于9:15
      jest.setSystemTime(new Date('2024-01-05T09:00:00'));
      expect(isMarketOpen()).toBe(false);

      // 11:30-13:00之间
      jest.setSystemTime(new Date('2024-01-05T12:00:00'));
      expect(isMarketOpen()).toBe(false);

      // 晚于15:00
      jest.setSystemTime(new Date('2024-01-05T15:01:00'));
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

    it('应该根据腾讯财经时间戳判断市场状态', () => {
      // 设置当前时间为 2024-01-05 10:00:00
      jest.setSystemTime(new Date('2024-01-05T10:00:00'));

      // 今天的数据，且在交易时间内
      expect(isMarketOpenByData('20240105101500', 'tencent')).toBe(true);
      expect(isMarketOpenByData('20240105143000', 'tencent')).toBe(true);

      // 今天的数据，但不在交易时间内
      expect(isMarketOpenByData('20240105080000', 'tencent')).toBe(false);
      expect(isMarketOpenByData('20240105120000', 'tencent')).toBe(false);

      // 昨天的数据
      expect(isMarketOpenByData('20240104150000', 'tencent')).toBe(false);
    });

    it('应该根据新浪财经时间戳判断市场状态', () => {
      // 设置当前时间为 2024-01-05 10:00:00
      jest.setSystemTime(new Date('2024-01-05T10:00:00'));

      // 今天的数据，且在交易时间内
      expect(isMarketOpenByData('2024-01-05 10:15:00', 'sina')).toBe(true);
      expect(isMarketOpenByData('2024-01-05 14:30:00', 'sina')).toBe(true);

      // 今天的数据，但不在交易时间内
      expect(isMarketOpenByData('2024-01-05 08:00:00', 'sina')).toBe(false);
      expect(isMarketOpenByData('2024-01-05 12:00:00', 'sina')).toBe(false);

      // 昨天的数据
      expect(isMarketOpenByData('2024-01-04 15:00:00', 'sina')).toBe(false);
    });

    it('应该在时间戳为空时回退到时间判断', () => {
      jest.setSystemTime(new Date('2024-01-05T10:00:00'));
      expect(isMarketOpenByData('', 'tencent')).toBe(true);
      expect(isMarketOpenByData('', 'sina')).toBe(true);

      jest.setSystemTime(new Date('2024-01-05T08:00:00'));
      expect(isMarketOpenByData('', 'tencent')).toBe(false);
      expect(isMarketOpenByData('', 'sina')).toBe(false);
    });

    it('应该在时间戳格式错误时回退到时间判断', () => {
      jest.setSystemTime(new Date('2024-01-05T10:00:00'));
      expect(isMarketOpenByData('invalid', 'tencent')).toBe(true);
      expect(isMarketOpenByData('invalid', 'sina')).toBe(true);
    });
  });
});

