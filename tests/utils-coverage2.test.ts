import {
  formatTurnover,
} from '../src/utils';

describe('utils 覆盖率补充测试2', () => {
  describe('formatTurnover', () => {
    it('应该处理小于10000的成交额（171行）', () => {
      expect(formatTurnover(9999)).toBe('9999元');
      expect(formatTurnover(1)).toBe('1元');
      expect(formatTurnover(0.4)).toBe('0元'); // toFixed(0) 会向下取整到0
    });
  });
});

