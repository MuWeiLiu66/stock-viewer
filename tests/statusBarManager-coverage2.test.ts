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

describe('StatusBarManager 覆盖率补充测试2', () => {
  let manager: StatusBarManager;
  let mockStatusBarItems: any[];
  let mockSettingsItem: any;

  beforeEach(() => {
    jest.clearAllMocks();
    mockStatusBarItems = [];
    mockSettingsItem = null;
    
    // Mock createStatusBarItem
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
      if (priority === 90 || priority === 110) {
        mockSettingsItem = item;
      } else {
        mockStatusBarItems.push(item);
      }
      return item;
    });
    
    manager = new StatusBarManager();
  });

  afterEach(() => {
    manager.dispose();
  });

  describe('updateAlignmentIfNeeded - 恢复显示逻辑', () => {
    it('应该在切换对齐方式时恢复之前显示的股票', () => {
      const stocks = [
        createMockStock('sz000001', '平安银行', 10.50, '5.00'),
        createMockStock('sh600000', '浦发银行', 8.50, '-3.00'),
      ];

      // 先右对齐显示
      manager.updateStocks(stocks, false, false, true, true, 'right', 'tencent');
      const initialCallCount = (vscode.window.createStatusBarItem as jest.Mock).mock.calls.length;
      expect(mockStatusBarItems[0]?.text).toBeTruthy();

      // 切换到左对齐
      manager.updateStocks(stocks, false, false, true, true, 'left', 'tencent');
      
      // 应该重新创建items（调用次数增加）
      const finalCallCount = (vscode.window.createStatusBarItem as jest.Mock).mock.calls.length;
      expect(finalCallCount).toBeGreaterThan(initialCallCount);
    });

    it('应该在切换对齐方式时如果之前没有显示股票则不恢复', () => {
      // 不先显示股票，直接切换对齐方式
      const initialCallCount = (vscode.window.createStatusBarItem as jest.Mock).mock.calls.length;
      manager.updateStocks([], false, false, true, true, 'left', 'tencent');
      
      // 应该重新创建items（调用次数增加）
      const finalCallCount = (vscode.window.createStatusBarItem as jest.Mock).mock.calls.length;
      expect(finalCallCount).toBeGreaterThan(initialCallCount);
    });
  });
});

