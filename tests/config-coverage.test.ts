import { ConfigManager } from '../src/config';
import * as vscode from 'vscode';

jest.mock('vscode');

describe('ConfigManager 覆盖率补充测试', () => {
  let configManager: ConfigManager;
  let mockConfig: any;

  beforeEach(() => {
    jest.clearAllMocks();
    
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

  describe('get - updateInterval 限制逻辑', () => {
    it('应该限制 updateInterval 最小值为3秒', () => {
      mockConfig.updateInterval = 1; // 小于3
      const config = configManager.get();
      expect(config.updateInterval).toBe(3000); // 3秒 * 1000
    });

    it('应该限制 updateInterval 最大值为1800秒', () => {
      mockConfig.updateInterval = 2000; // 大于1800
      const config = configManager.get();
      expect(config.updateInterval).toBe(1800000); // 1800秒 * 1000
    });

    it('应该保持正常的 updateInterval 值', () => {
      mockConfig.updateInterval = 10; // 在3-1800之间
      const config = configManager.get();
      expect(config.updateInterval).toBe(10000); // 10秒 * 1000
    });

    it('应该处理边界值3秒', () => {
      mockConfig.updateInterval = 3;
      const config = configManager.get();
      expect(config.updateInterval).toBe(3000);
    });

    it('应该处理边界值1800秒', () => {
      mockConfig.updateInterval = 1800;
      const config = configManager.get();
      expect(config.updateInterval).toBe(1800000);
    });
  });

  describe('get - enableAutoUpdate 字段', () => {
    it('应该返回 enableAutoUpdate 配置', () => {
      mockConfig.enableAutoUpdate = false;
      const config = configManager.get();
      expect(config.enableAutoUpdate).toBe(false);
    });

    it('应该返回默认的 enableAutoUpdate 值', () => {
      delete mockConfig.enableAutoUpdate;
      const config = configManager.get();
      expect(config.enableAutoUpdate).toBe(true); // 默认值
    });
  });
});

