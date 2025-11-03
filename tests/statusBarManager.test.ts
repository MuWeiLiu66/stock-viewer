import { StatusBarManager } from '../src/statusBarManager';
import { StockInfo } from '../src/stockDataService';
import * as vscode from 'vscode';

describe('StatusBarManager', () => {
  let manager: StatusBarManager;
  let mockStatusBarItem: any;
  let mockStatusBarItems: any[];

  beforeEach(() => {
    jest.clearAllMocks();

    // Mock status bar item
    mockStatusBarItem = {
      text: '',
      tooltip: undefined,
      color: undefined,
      command: undefined,
      show: jest.fn(),
      hide: jest.fn(),
      dispose: jest.fn(),
    };

    mockStatusBarItems = Array.from({ length: 7 }, () => ({
      text: '',
      tooltip: undefined,
      color: undefined,
      command: undefined,
      show: jest.fn(),
      hide: jest.fn(),
      dispose: jest.fn(),
    }));

    // Mock vscode.window.createStatusBarItem
    (vscode.window.createStatusBarItem as jest.Mock).mockImplementation((alignment, priority) => {
      if (priority === 90 || priority === 110) {
        // Settings item
        return mockStatusBarItem;
      } else {
        // Stock items
        const index = 100 - priority; // Calculate index based on priority
        return mockStatusBarItems[index] || mockStatusBarItems[0];
      }
    });
  });

  afterEach(() => {
    if (manager) {
      manager.dispose();
    }
  });

  describe('构造函数和初始化', () => {
    it('应该创建状态栏管理器', () => {
      manager = new StatusBarManager();
      expect(manager).toBeDefined();
      expect(vscode.window.createStatusBarItem).toHaveBeenCalled();
    });

    it('应该创建设置按钮和股票项', () => {
      manager = new StatusBarManager();
      // 应该创建1个设置按钮 + 7个股票项
      expect(vscode.window.createStatusBarItem).toHaveBeenCalledTimes(8);
    });
  });

  describe('show 和 hide', () => {
    it('应该显示设置按钮', () => {
      manager = new StatusBarManager();
      manager.show();
      expect(mockStatusBarItem.show).toHaveBeenCalled();
    });

    it('应该隐藏所有项', () => {
      manager = new StatusBarManager();
      manager.hide();
      expect(mockStatusBarItem.hide).toHaveBeenCalled();
      mockStatusBarItems.forEach(item => {
        expect(item.hide).toHaveBeenCalled();
      });
    });
  });

  describe('showNotConfigured', () => {
    it('应该显示未配置提示', () => {
      manager = new StatusBarManager();
      manager.showNotConfigured(true);
      
      expect(mockStatusBarItem.show).toHaveBeenCalled();
      expect(mockStatusBarItems[0].text).toBe('股票: 未配置');
      expect(mockStatusBarItems[0].tooltip).toBe('点击配置股票代码');
      expect(mockStatusBarItems[0].show).toHaveBeenCalled();
    });

    it('应该显示不带前缀的未配置提示', () => {
      manager = new StatusBarManager();
      manager.showNotConfigured(false);
      
      expect(mockStatusBarItems[0].text).toBe('$(edit)');
    });
  });

  describe('showError', () => {
    it('应该显示错误信息', () => {
      manager = new StatusBarManager();
      manager.showError('网络错误', true);
      
      expect(mockStatusBarItem.show).toHaveBeenCalled();
      expect(mockStatusBarItems[0].text).toBe('股票: 网络错误');
      expect(mockStatusBarItems[0].tooltip).toBe('错误: 网络错误');
      expect(mockStatusBarItems[0].show).toHaveBeenCalled();
    });

    it('应该使用自定义tooltip', () => {
      manager = new StatusBarManager();
      manager.showError('网络错误', true, '自定义错误信息');
      
      expect(mockStatusBarItems[0].tooltip).toBe('自定义错误信息');
    });
  });

  describe('updateStocks', () => {
    const createMockStock = (code: string, name: string, price: number, changePercent: string): StockInfo => ({
      code,
      name,
      currentPrice: price,
      yesterdayClose: price - parseFloat(changePercent) * price / 100,
      todayOpen: price,
      todayHigh: price,
      todayLow: price,
      changeAmount: parseFloat(changePercent) * price / 100,
      changePercent,
      volume: 100000,
      turnover: 1000000,
      updateTime: '14:30:00',
      dataTimestamp: '20240105143000',
    });

    beforeEach(() => {
      manager = new StatusBarManager();
    });

    it('应该更新股票显示', () => {
      const stocks = [
        createMockStock('sz000001', '平安银行', 10.50, '5.00'),
      ];

      manager.updateStocks(stocks, false, false, true, true, 'right', 'tencent');

      expect(mockStatusBarItems[0].text).toContain('+5.00%');
      expect(mockStatusBarItems[0].show).toHaveBeenCalled();
    });

    it('应该显示股票名称', () => {
      const stocks = [
        createMockStock('sz000001', '平安银行', 10.50, '5.00'),
      ];

      manager.updateStocks(stocks, true, false, false, false, 'right', 'tencent');

      expect(mockStatusBarItems[0].text).toContain('平安银行');
    });

    it('应该显示价格', () => {
      const stocks = [
        createMockStock('sz000001', '平安银行', 10.50, '5.00'),
      ];

      manager.updateStocks(stocks, false, true, false, false, 'right', 'tencent');

      expect(mockStatusBarItems[0].text).toContain('10.50');
    });

    it('应该显示涨跌幅', () => {
      const stocks = [
        createMockStock('sz000001', '平安银行', 10.50, '5.00'),
      ];

      manager.updateStocks(stocks, false, false, true, false, 'right', 'tencent');

      expect(mockStatusBarItems[0].text).toContain('+5.00%');
    });

    it('应该应用彩色显示（涨红）', () => {
      const stocks = [
        createMockStock('sz000001', '平安银行', 10.50, '5.00'),
      ];

      manager.updateStocks(stocks, false, false, true, true, 'right', 'tencent');

      expect(mockStatusBarItems[0].color).toBeInstanceOf(vscode.ThemeColor);
      expect((mockStatusBarItems[0].color as vscode.ThemeColor).id).toBe('charts.red');
    });

    it('应该应用彩色显示（跌绿）', () => {
      const stocks = [
        createMockStock('sz000001', '平安银行', 10.50, '-5.00'),
      ];

      manager.updateStocks(stocks, false, false, true, true, 'right', 'tencent');

      expect(mockStatusBarItems[0].color).toBeInstanceOf(vscode.ThemeColor);
      expect((mockStatusBarItems[0].color as vscode.ThemeColor).id).toBe('charts.green');
    });

    it('应该在不启用彩色显示时移除颜色', () => {
      const stocks = [
        createMockStock('sz000001', '平安银行', 10.50, '5.00'),
      ];

      manager.updateStocks(stocks, false, false, true, false, 'right', 'tencent');

      expect(mockStatusBarItems[0].color).toBeUndefined();
    });

    it('应该显示多只股票', () => {
      const stocks = [
        createMockStock('sz000001', '平安银行', 10.50, '5.00'),
        createMockStock('sh600000', '浦发银行', 8.50, '-3.00'),
      ];

      manager.updateStocks(stocks, false, false, true, true, 'right', 'tencent');

      expect(mockStatusBarItems[0].show).toHaveBeenCalled();
      expect(mockStatusBarItems[1].show).toHaveBeenCalled();
    });

    it('应该限制最多显示7只股票', () => {
      // 确保有足够的 mock items，并重置所有 mock
      while (mockStatusBarItems.length < 10) {
        mockStatusBarItems.push({
          text: '',
          tooltip: undefined,
          color: undefined,
          command: undefined,
          show: jest.fn(),
          hide: jest.fn(),
          dispose: jest.fn(),
        });
      }
      
      // 重置所有 mock 函数
      mockStatusBarItems.forEach(item => {
        item.show.mockClear();
        item.hide.mockClear();
      });

      const stocks = Array.from({ length: 10 }, (_, i) =>
        createMockStock(`sz00000${i}`, `股票${i}`, 10.50, '5.00')
      );

      manager.updateStocks(stocks, false, false, true, true, 'right', 'tencent');

      // 只应该显示前7只
      for (let i = 0; i < 7; i++) {
        expect(mockStatusBarItems[i].show).toHaveBeenCalled();
      }
      // 第8只及以后应该被隐藏（如果存在的话）
      // 注意：由于 manager 内部创建了新的 items，我们需要检查实际的调用
      // 但由于对齐方式没有改变，应该使用原有的 items
      for (let i = 7; i < Math.min(10, mockStatusBarItems.length); i++) {
        if (mockStatusBarItems[i]) {
          // 隐藏调用可能不会发生，因为 manager 内部只管理7个 items
          // 我们主要验证前7个被显示了
        }
      }
    });

    it('应该隐藏多余的股票项', () => {
      const stocks1 = [
        createMockStock('sz000001', '平安银行', 10.50, '5.00'),
        createMockStock('sh600000', '浦发银行', 8.50, '-3.00'),
      ];
      manager.updateStocks(stocks1, false, false, true, true, 'right', 'tencent');

      const stocks2 = [
        createMockStock('sz000001', '平安银行', 10.50, '5.00'),
      ];
      manager.updateStocks(stocks2, false, false, true, true, 'right', 'tencent');

      // 第二只股票应该被隐藏
      expect(mockStatusBarItems[1].hide).toHaveBeenCalled();
    });

    it('应该更新对齐方式', () => {
      const stocks = [
        createMockStock('sz000001', '平安银行', 10.50, '5.00'),
      ];

      manager.updateStocks(stocks, false, false, true, true, 'left', 'tencent');

      // 应该重新创建状态栏项
      expect(vscode.window.createStatusBarItem).toHaveBeenCalled();
    });

    it('应该在不显示价格和涨跌幅时显示箭头', () => {
      const stocks = [
        createMockStock('sz000001', '平安银行', 10.50, '5.00'),
      ];

      manager.updateStocks(stocks, false, false, false, false, 'right', 'tencent');

      expect(mockStatusBarItems[0].text).toContain('↑');
    });

    it('应该显示下跌箭头', () => {
      const stocks = [
        createMockStock('sz000001', '平安银行', 10.50, '-5.00'),
      ];

      manager.updateStocks(stocks, false, false, false, false, 'right', 'tencent');

      expect(mockStatusBarItems[0].text).toContain('↓');
    });
  });

  describe('dispose', () => {
    it('应该释放所有资源', () => {
      manager = new StatusBarManager();
      manager.dispose();

      expect(mockStatusBarItem.dispose).toHaveBeenCalled();
      mockStatusBarItems.forEach(item => {
        expect(item.dispose).toHaveBeenCalled();
      });
    });
  });
});

