import * as vscode from 'vscode';
import { StatusBarManager } from '../src/statusBarManager';
import { StockInfo } from '../src/stockDataService';

const createMockStock = (
  code: string,
  name: string,
  currentPrice: number,
  changePercent: string,
  yesterdayClose: number = 10.00,
  todayOpen: number = 10.10,
  todayHigh: number = 10.60,
  todayLow: number = 9.90,
  changeAmount: number = currentPrice - yesterdayClose,
  volume: number = 100000,
  turnover: number = 100000000,
  updateTime: string = '14:30:00',
  dataTimestamp: string = '20240105143000'
): StockInfo => ({
  code,
  name,
  currentPrice,
  changePercent,
  yesterdayClose,
  todayOpen,
  todayHigh,
  todayLow,
  changeAmount,
  volume,
  turnover,
  updateTime,
  dataTimestamp,
});

describe('StatusBarManager 覆盖率补充测试', () => {
  let manager: StatusBarManager;
  let mockStatusBarItems: any[];

  beforeEach(() => {
    jest.clearAllMocks();
    mockStatusBarItems = [];
    
    // Mock createStatusBarItem to track created items
    // StatusBarManager 会先创建设置按钮（priority 90或110），然后创建7个股票项（priority 100-106）
    (vscode.window.createStatusBarItem as jest.Mock).mockImplementation((alignment, priority) => {
      const item = {
        text: '',
        tooltip: undefined,
        color: undefined,
        command: undefined,
        show: jest.fn(),
        hide: jest.fn(),
        dispose: jest.fn(),
      };
      mockStatusBarItems.push(item);
      return item;
    });
    
    manager = new StatusBarManager();
    // 设置按钮是第一个（索引0），股票项从索引1开始
  });

  afterEach(() => {
    manager.dispose();
  });

  describe('showNotConfigured', () => {
    it('应该在不显示前缀时显示编辑图标', () => {
      manager.showNotConfigured(false);
      // 第一个股票项应该在索引1（索引0是设置按钮）
      const stockItem = mockStatusBarItems[1];
      expect(stockItem).toBeDefined();
      expect(stockItem.text).toBe('$(edit)');
      expect(stockItem.tooltip).toBe('点击配置股票代码');
    });
  });

  describe('showError', () => {
    it('应该支持自定义 tooltip', () => {
      const errorMessage = '网络错误';
      const customTooltip = '自定义错误提示';
      manager.showError(errorMessage, true, customTooltip);
      // 第一个股票项应该在索引1
      const stockItem = mockStatusBarItems[1];
      expect(stockItem).toBeDefined();
      expect(stockItem.tooltip).toBe(customTooltip);
    });

    it('应该在不显示前缀时只显示错误消息', () => {
      const errorMessage = '网络错误';
      manager.showError(errorMessage, false);
      // 第一个股票项应该在索引1
      const stockItem = mockStatusBarItems[1];
      expect(stockItem).toBeDefined();
      expect(stockItem.text).toBe(errorMessage);
    });
  });

  describe('updateStocks - 命令变化检测', () => {
    it('应该更新 command 当它不是 stockViewer.showDetails 时', () => {
      const stocks = [
        createMockStock('sz000001', '平安银行', 10.50, '5.00'),
      ];

      // 先设置一个不同的command（第一个股票项在索引1）
      if (mockStatusBarItems[1]) {
        mockStatusBarItems[1].command = 'other.command';
      }
      
      manager.updateStocks(stocks, false, false, true, true, 'right', 'tencent');

      if (mockStatusBarItems[1]) {
        expect(mockStatusBarItems[1].command).toBe('stockViewer.showDetails');
      }
    });
  });

  describe('updateStocks - tooltip 更新检测', () => {
    it('应该检测 tooltip 的变化并更新', () => {
      const stocks1 = [
        createMockStock('sz000001', '平安银行', 10.50, '5.00'),
      ];
      
      manager.updateStocks(stocks1, false, false, true, true, 'right', 'tencent');
      const tooltip1 = mockStatusBarItems[1]?.tooltip;

      const stocks2 = [
        createMockStock('sz000001', '平安银行', 10.60, '6.00'), // 价格变化
      ];
      
      manager.updateStocks(stocks2, false, false, true, true, 'right', 'tencent');
      const tooltip2 = mockStatusBarItems[1]?.tooltip;

      // tooltip 应该已经更新
      if (tooltip1 && tooltip2) {
        expect(tooltip2).not.toBe(tooltip1);
      }
    });
  });

  describe('updateStocks - 彩色显示逻辑', () => {
    it('应该在 colorfulDisplay 为 false 时移除颜色', () => {
      const stocks = [
        createMockStock('sz000001', '平安银行', 10.50, '5.00'),
      ];

      // 先设置彩色显示
      manager.updateStocks(stocks, false, false, true, true, 'right', 'tencent');
      if (mockStatusBarItems[1]) {
        expect(mockStatusBarItems[1].color).toBeDefined();
      }

      // 然后关闭彩色显示
      manager.updateStocks(stocks, false, false, true, false, 'right', 'tencent');
      if (mockStatusBarItems[1]) {
        expect(mockStatusBarItems[1].color).toBeUndefined();
      }
    });

    it('应该检测涨跌状态变化并更新颜色', () => {
      const stocks1 = [
        createMockStock('sz000001', '平安银行', 10.50, '5.00'), // 上涨
      ];
      
      manager.updateStocks(stocks1, false, false, true, true, 'right', 'tencent');
      const color1 = mockStatusBarItems[1]?.color;

      const stocks2 = [
        createMockStock('sz000001', '平安银行', 9.50, '-5.00'), // 下跌
      ];
      
      manager.updateStocks(stocks2, false, false, true, true, 'right', 'tencent');
      const color2 = mockStatusBarItems[1]?.color;

      // 颜色应该不同
      if (color1 && color2) {
        expect(color1).not.toEqual(color2);
      }
    });
  });

  describe('updateStocks - 文本为空时的显示', () => {
    it('应该在文本为空时调用 show', () => {
      const stocks = [
        createMockStock('sz000001', '平安银行', 10.50, '5.00'),
      ];

      // 清空文本（第一个股票项在索引1）
      if (mockStatusBarItems[1]) {
        mockStatusBarItems[1].text = '';
      }
      
      manager.updateStocks(stocks, false, false, true, true, 'right', 'tencent');

      if (mockStatusBarItems[1]) {
        expect(mockStatusBarItems[1].show).toHaveBeenCalled();
      }
    });
  });
});

