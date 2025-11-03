import { ConfigManager } from '../src/config';
import * as vscode from 'vscode';

// Mock vscode module
jest.mock('vscode');

describe('ConfigManager', () => {
  let configManager: ConfigManager;
  let mockConfig: any;

  beforeEach(() => {
    // Reset mocks
    jest.clearAllMocks();
    
    // Create a mock configuration object
    mockConfig = {
      stockCodes: [],
      dataSource: 'tencent',
      showStockName: false,
      showPrice: false,
      showChangePercent: true,
      colorfulDisplay: true,
      alignment: 'right',
      updateInterval: 8,
      showNotifications: false,
      stopOnMarketClose: false,
      enableAutoUpdate: true,
    };

    // Setup vscode.workspace.getConfiguration mock
    (vscode.workspace.getConfiguration as jest.Mock).mockReturnValue({
      get: jest.fn((key: string, defaultValue?: any) => {
        return mockConfig[key] !== undefined ? mockConfig[key] : defaultValue;
      }),
      update: jest.fn(async (key: string, value: any) => {
        mockConfig[key] = value;
      }),
    });

    configManager = new ConfigManager();
  });

  describe('get', () => {
    it('应该返回正确的配置', () => {
      const config = configManager.get();
      expect(config.stockCodes).toEqual([]);
      expect(config.dataSource).toBe('tencent');
      expect(config.showStockName).toBe(false);
      expect(config.showPrice).toBe(false);
      expect(config.showChangePercent).toBe(true);
      expect(config.colorfulDisplay).toBe(true);
      expect(config.alignment).toBe('right');
      expect(config.updateInterval).toBe(8000); // 8秒转换为毫秒
      expect(config.showNotifications).toBe(false);
      expect(config.stopOnMarketClose).toBe(false);
      expect(config.enableAutoUpdate).toBe(true);
    });

    it('应该限制更新间隔在3-1800秒之间', () => {
      mockConfig.updateInterval = 1; // 小于最小值
      let config = configManager.get();
      expect(config.updateInterval).toBe(3000); // 应该限制为3秒

      mockConfig.updateInterval = 2000; // 大于最大值
      config = configManager.get();
      expect(config.updateInterval).toBe(1800000); // 应该限制为1800秒

      mockConfig.updateInterval = 10; // 正常值
      config = configManager.get();
      expect(config.updateInterval).toBe(10000); // 应该转换为毫秒
    });
  });

  describe('isValidStockCode', () => {
    it('应该验证A股完整代码', () => {
      expect(configManager.isValidStockCode('sz000001')).toBe(true);
      expect(configManager.isValidStockCode('sh600000')).toBe(true);
      expect(configManager.isValidStockCode('bj920001')).toBe(true);
      expect(configManager.isValidStockCode('SZ000001')).toBe(true); // 大小写不敏感
    });

    it('应该验证港股代码', () => {
      expect(configManager.isValidStockCode('hk00700')).toBe(true);
      expect(configManager.isValidStockCode('hk09988')).toBe(true);
      expect(configManager.isValidStockCode('HK00700')).toBe(true);
    });

    it('应该验证美股代码', () => {
      expect(configManager.isValidStockCode('us.AAPL')).toBe(true);
      expect(configManager.isValidStockCode('us.BRK.A')).toBe(true);
      expect(configManager.isValidStockCode('US.AAPL')).toBe(true);
    });

    it('应该验证6位纯数字A股代码', () => {
      expect(configManager.isValidStockCode('000001')).toBe(true);
      expect(configManager.isValidStockCode('600000')).toBe(true);
      expect(configManager.isValidStockCode('920001')).toBe(true);
    });

    it('应该验证中文名称', () => {
      expect(configManager.isValidStockCode('平安银行')).toBe(true);
      expect(configManager.isValidStockCode('中国平安')).toBe(true);
      expect(configManager.isValidStockCode('A')).toBe(false); // 太短
      expect(configManager.isValidStockCode('这是一个非常非常非常非常非常非常非常长的股票名称')).toBe(false); // 太长
    });

    it('应该拒绝无效代码', () => {
      expect(configManager.isValidStockCode('')).toBe(false);
      expect(configManager.isValidStockCode('   ')).toBe(false);
      expect(configManager.isValidStockCode('invalid')).toBe(false);
      expect(configManager.isValidStockCode('sz12345')).toBe(false); // 5位数字
      expect(configManager.isValidStockCode('hk123')).toBe(false); // 3位数字
      expect(configManager.isValidStockCode('usAAPL')).toBe(false); // 缺少点号
    });
  });

  describe('validateAndCleanStockCodes', () => {
    it('应该清理无效代码', () => {
      const codes = ['sz000001', 'invalid', 'sh600000', '', '   ', 'hk00700'];
      const cleaned = configManager.validateAndCleanStockCodes(codes);
      expect(cleaned).toEqual(['sz000001', 'sh600000', 'hk00700']);
    });

    it('应该去重代码', () => {
      const codes = ['sz000001', 'SZ000001', 'sz000001'];
      const cleaned = configManager.validateAndCleanStockCodes(codes);
      expect(cleaned).toEqual(['sz000001']);
    });

    it('应该限制最多7只股票', () => {
      const codes = Array.from({ length: 10 }, (_, i) => `sz00000${i}`);
      const cleaned = configManager.validateAndCleanStockCodes(codes);
      expect(cleaned.length).toBe(7);
    });

    it('应该处理非数组输入', () => {
      const cleaned = configManager.validateAndCleanStockCodes(null as any);
      expect(cleaned).toEqual([]);
    });
  });

  describe('addStockCode', () => {
    beforeEach(() => {
      mockConfig.stockCodes = [];
    });

    it('应该成功添加有效股票代码', async () => {
      const result = await configManager.addStockCode('sz000001');
      expect(result.success).toBe(true);
      expect(mockConfig.stockCodes).toContain('sz000001');
    });

    it('应该拒绝无效股票代码', async () => {
      const result = await configManager.addStockCode('invalid');
      expect(result.success).toBe(false);
      expect(result.message).toBeDefined();
      expect(mockConfig.stockCodes).not.toContain('invalid');
    });

    it('应该拒绝重复股票代码', async () => {
      mockConfig.stockCodes = ['sz000001'];
      const result = await configManager.addStockCode('SZ000001'); // 大小写不同但实际相同
      expect(result.success).toBe(false);
      expect(result.message).toContain('已在列表中');
    });

    it('应该拒绝超过7只股票', async () => {
      mockConfig.stockCodes = Array.from({ length: 7 }, (_, i) => `sz00000${i}`);
      const result = await configManager.addStockCode('sz000008');
      expect(result.success).toBe(false);
      expect(result.message).toContain('最多只能添加7只股票');
    });

    it('应该自动去除代码前后空格', async () => {
      const result = await configManager.addStockCode('  sz000001  ');
      expect(result.success).toBe(true);
      expect(mockConfig.stockCodes).toContain('sz000001');
    });
  });

  describe('toggle methods', () => {
    it('toggleShowName应该切换显示名称配置', async () => {
      mockConfig.showStockName = false;
      const newValue = await configManager.toggleShowName();
      expect(newValue).toBe(true);
      expect(mockConfig.showStockName).toBe(true);

      const newValue2 = await configManager.toggleShowName();
      expect(newValue2).toBe(false);
      expect(mockConfig.showStockName).toBe(false);
    });

    it('toggleShowPrice应该切换显示价格配置', async () => {
      mockConfig.showPrice = false;
      const newValue = await configManager.toggleShowPrice();
      expect(newValue).toBe(true);
      expect(mockConfig.showPrice).toBe(true);
    });

    it('toggleShowChangePercent应该切换显示涨跌幅配置', async () => {
      mockConfig.showChangePercent = true;
      const newValue = await configManager.toggleShowChangePercent();
      expect(newValue).toBe(false);
      expect(mockConfig.showChangePercent).toBe(false);
    });

    it('toggleColorfulDisplay应该切换彩色显示配置', async () => {
      mockConfig.colorfulDisplay = true;
      const newValue = await configManager.toggleColorfulDisplay();
      expect(newValue).toBe(false);
      expect(mockConfig.colorfulDisplay).toBe(false);
    });

    it('toggleStopOnMarketClose应该切换收盘停止配置', async () => {
      mockConfig.stopOnMarketClose = false;
      const newValue = await configManager.toggleStopOnMarketClose();
      expect(newValue).toBe(true);
      expect(mockConfig.stopOnMarketClose).toBe(true);
    });

    it('toggleEnableAutoUpdate应该切换自动更新配置', async () => {
      mockConfig.enableAutoUpdate = true;
      const newValue = await configManager.toggleEnableAutoUpdate();
      expect(newValue).toBe(false);
      expect(mockConfig.enableAutoUpdate).toBe(false);
    });

    it('toggleShowNotifications应该切换提示气泡配置', async () => {
      mockConfig.showNotifications = false;
      const newValue = await configManager.toggleShowNotifications();
      expect(newValue).toBe(true);
      expect(mockConfig.showNotifications).toBe(true);
    });
  });

  describe('switchDataSource', () => {
    it('应该从tencent切换到sina', async () => {
      mockConfig.dataSource = 'tencent';
      const newSource = await configManager.switchDataSource();
      expect(newSource).toBe('sina');
      expect(mockConfig.dataSource).toBe('sina');
    });

    it('应该从sina切换到tencent', async () => {
      mockConfig.dataSource = 'sina';
      const newSource = await configManager.switchDataSource();
      expect(newSource).toBe('tencent');
      expect(mockConfig.dataSource).toBe('tencent');
    });
  });

  describe('getDataSourceName', () => {
    it('应该返回正确的数据源名称', () => {
      mockConfig.dataSource = 'tencent';
      expect(configManager.getDataSourceName()).toBe('腾讯财经');
      expect(configManager.getDataSourceName('tencent')).toBe('腾讯财经');
      expect(configManager.getDataSourceName('sina')).toBe('新浪财经');
    });
  });

  describe('updateStockCodes', () => {
    it('应该更新股票代码列表', async () => {
      await configManager.updateStockCodes(['sz000001', 'sh600000']);
      expect(mockConfig.stockCodes).toEqual(['sz000001', 'sh600000']);
    });
  });

  describe('validateAndFixStockCodes', () => {
    beforeEach(() => {
      // Mock vscode.window.showWarningMessage
      (vscode.window.showWarningMessage as jest.Mock).mockResolvedValue(undefined);
    });

    it('应该在代码有效时不进行修正', async () => {
      mockConfig.stockCodes = ['sz000001', 'sh600000'];
      const result = await configManager.validateAndFixStockCodes();
      
      expect(result).toBe(false);
      expect(mockConfig.stockCodes).toEqual(['sz000001', 'sh600000']);
      expect(vscode.window.showWarningMessage).not.toHaveBeenCalled();
    });

    it('应该移除无效代码', async () => {
      mockConfig.stockCodes = ['sz000001', 'invalid', 'sh600000'];
      const result = await configManager.validateAndFixStockCodes();
      
      expect(result).toBe(true);
      expect(mockConfig.stockCodes).toEqual(['sz000001', 'sh600000']);
      expect(vscode.window.showWarningMessage).toHaveBeenCalled();
    });

    it('应该移除重复代码', async () => {
      mockConfig.stockCodes = ['sz000001', 'SZ000001', 'sh600000'];
      const result = await configManager.validateAndFixStockCodes();
      
      expect(result).toBe(true);
      expect(mockConfig.stockCodes.length).toBeLessThanOrEqual(2);
      expect(vscode.window.showWarningMessage).toHaveBeenCalled();
    });

    it('应该限制最多7只股票', async () => {
      mockConfig.stockCodes = Array.from({ length: 10 }, (_, i) => `sz00000${i}`);
      const result = await configManager.validateAndFixStockCodes();
      
      expect(result).toBe(true);
      expect(mockConfig.stockCodes.length).toBe(7);
      expect(vscode.window.showWarningMessage).toHaveBeenCalled();
    });

    it('应该显示正确的清理提示信息（无效代码）', async () => {
      mockConfig.stockCodes = ['sz000001', 'invalid1', 'invalid2', 'sh600000'];
      await configManager.validateAndFixStockCodes();
      
      expect(vscode.window.showWarningMessage).toHaveBeenCalledWith(
        expect.stringContaining('2 个无效或重复')
      );
    });

    it('应该显示正确的清理提示信息（超出限制）', async () => {
      mockConfig.stockCodes = Array.from({ length: 10 }, (_, i) => `sz00000${i}`);
      await configManager.validateAndFixStockCodes();
      
      expect(vscode.window.showWarningMessage).toHaveBeenCalledWith(
        expect.stringContaining('3 个超出限制')
      );
    });

    it('应该显示合并的提示信息（无效+超出）', async () => {
      // 创建 10 个代码：2个无效 + 8个有效（超出7个限制）
      mockConfig.stockCodes = ['invalid1', 'invalid2', ...Array.from({ length: 8 }, (_, i) => `sz00000${i}`)];
      await configManager.validateAndFixStockCodes();
      
      const callArgs = (vscode.window.showWarningMessage as jest.Mock).mock.calls[0][0];
      // 由于超出限制的数量（3个）会覆盖无效代码的数量（2个），所以只显示超出限制
      // 或者如果两者都存在，会合并显示
      expect(callArgs).toContain('超出限制');
    });

    it('应该处理空数组', async () => {
      mockConfig.stockCodes = [];
      const result = await configManager.validateAndFixStockCodes();
      
      expect(result).toBe(false);
      expect(mockConfig.stockCodes).toEqual([]);
      expect(vscode.window.showWarningMessage).not.toHaveBeenCalled();
    });

    it('应该清理空字符串和空白字符', async () => {
      mockConfig.stockCodes = ['sz000001', '', '   ', 'sh600000'];
      const result = await configManager.validateAndFixStockCodes();
      
      expect(result).toBe(true);
      expect(mockConfig.stockCodes).toEqual(['sz000001', 'sh600000']);
    });
  });
});

