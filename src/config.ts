import * as vscode from 'vscode';

export interface StockViewerConfig {
    stockCodes: string[];
    dataSource: 'tencent' | 'sina';
    showStockName: boolean;
    showPrice: boolean;
    showChangePercent: boolean;
    colorfulDisplay: boolean;
    alignment: 'left' | 'right';
    updateInterval: number;
    showNotifications: boolean;
    stopOnMarketClose: boolean;
    enableAutoUpdate: boolean;
}

export class ConfigManager {
    private static readonly SECTION = 'stockViewer';
    
    public get(): StockViewerConfig {
        const config = vscode.workspace.getConfiguration(ConfigManager.SECTION);
        return {
            stockCodes: config.get<string[]>('stockCodes', []),
            dataSource: config.get<'tencent' | 'sina'>('dataSource', 'tencent'),
            showStockName: config.get<boolean>('showStockName', false),
            showPrice: config.get<boolean>('showPrice', false),
            showChangePercent: config.get<boolean>('showChangePercent', true),
            colorfulDisplay: config.get<boolean>('colorfulDisplay', true),
            alignment: config.get<'left' | 'right'>('alignment', 'right'),
            updateInterval: config.get<number>('updateInterval', 8) * 1000,
            showNotifications: config.get<boolean>('showNotifications', false),
            stopOnMarketClose: config.get<boolean>('stopOnMarketClose', false),
            enableAutoUpdate: config.get<boolean>('enableAutoUpdate', true)
        };
    }
    
    public async updateStockCodes(codes: string[]): Promise<void> {
        await this.update('stockCodes', codes);
    }
    
    public async addStockCode(code: string): Promise<{ success: boolean; message?: string }> {
        // 验证代码格式
        if (!this.isValidStockCode(code)) {
            return { 
                success: false, 
                message: '股票代码格式无效。支持的格式：\n- A股：sz000001, sh600000, bj920001 或 6位数字\n- 港股：hk00700（5位数字）\n- 美股：us.AAPL\n- 中文名称' 
            };
        }
        
        const config = this.get();
        const trimmedCode = code.trim();
        
        // 规范化代码用于比较（统一转换为小写）
        const normalizedCode = trimmedCode.toLowerCase();
        
        // 检查是否重复（使用规范化比较）
        if (config.stockCodes.some(c => {
            const normalized = c.toLowerCase();
            return normalized === normalizedCode;
        })) {
            return { success: false, message: '股票已在列表中' };
        }
        
        if (config.stockCodes.length >= 7) {
            return { success: false, message: '最多只能添加7只股票' };
        }
        
        await this.updateStockCodes([...config.stockCodes, trimmedCode]);
        return { success: true };
    }
    
    public async toggleShowName(): Promise<boolean> {
        const config = this.get();
        const newValue = !config.showStockName;
        await this.update('showStockName', newValue);
        return newValue;
    }
    
    public async toggleShowPrice(): Promise<boolean> {
        const config = this.get();
        const newValue = !config.showPrice;
        await this.update('showPrice', newValue);
        return newValue;
    }
    
    public async toggleShowChangePercent(): Promise<boolean> {
        const config = this.get();
        const newValue = !config.showChangePercent;
        await this.update('showChangePercent', newValue);
        return newValue;
    }
    
    public async toggleColorfulDisplay(): Promise<boolean> {
        const config = this.get();
        const newValue = !config.colorfulDisplay;
        await this.update('colorfulDisplay', newValue);
        return newValue;
    }
    
    public async toggleStopOnMarketClose(): Promise<boolean> {
        const config = this.get();
        const newValue = !config.stopOnMarketClose;
        await this.update('stopOnMarketClose', newValue);
        return newValue;
    }
    
    public async toggleEnableAutoUpdate(): Promise<boolean> {
        const config = this.get();
        const newValue = !config.enableAutoUpdate;
        await this.update('enableAutoUpdate', newValue);
        return newValue;
    }
    
    public async toggleShowNotifications(): Promise<boolean> {
        const config = this.get();
        const newValue = !config.showNotifications;
        await this.update('showNotifications', newValue);
        return newValue;
    }
    
    public async switchDataSource(): Promise<'tencent' | 'sina'> {
        const config = this.get();
        const newSource = config.dataSource === 'tencent' ? 'sina' : 'tencent';
        await this.update('dataSource', newSource);
        return newSource;
    }
    
    public getDataSourceName(source?: 'tencent' | 'sina'): string {
        const dataSource = source || this.get().dataSource;
        return dataSource === 'sina' ? '新浪财经' : '腾讯财经';
    }
    
    /**
     * 验证股票代码格式
     * @param code 股票代码
     * @returns 是否有效
     */
    public isValidStockCode(code: string): boolean {
        if (!code || typeof code !== 'string') {
            return false;
        }
        
        const trimmed = code.trim();
        if (!trimmed || trimmed.length === 0) {
            return false;
        }
        
        // 允许的格式：
        // 1. A股完整代码：sz000001, sh600000, bj920001
        // 2. 港股代码：hk00700, hk09988（5位数字）
        // 3. 美股代码：us.AAPL, us.BRK.A（标准格式）
        // 4. 6位纯数字：000001, 600000, 920001（A股）
        // 5. 中文名称（至少2个字符，最多20个字符）
        const aStockPattern = /^(sz|sh|bj)\d{6}$/i;
        const hkStockPattern = /^hk\d{5}$/i;
        const usStockPattern = /^us\.[A-Z0-9]+(?:\.[A-Z]+)?$/i;
        const numberPattern = /^\d{6}$/;
        const chinesePattern = /^[\u4e00-\u9fa5]{2,20}$/;
        
        return aStockPattern.test(trimmed) || 
               hkStockPattern.test(trimmed) ||
               usStockPattern.test(trimmed) ||
               numberPattern.test(trimmed) || 
               chinesePattern.test(trimmed);
    }
    
    /**
     * 验证并清理股票代码列表
     * @param codes 股票代码数组
     * @returns 清理后的代码数组
     */
    public validateAndCleanStockCodes(codes: string[]): string[] {
        if (!Array.isArray(codes)) {
            return [];
        }
        
        const validCodes: string[] = [];
        const seen = new Set<string>();
        
        for (const code of codes) {
            if (!code || typeof code !== 'string') {
                continue;
            }
            
            const trimmed = code.trim();
            if (!trimmed || !this.isValidStockCode(trimmed)) {
                continue;
            }
            
            // 规范化代码用于去重（统一转换为小写）
            const normalized = trimmed.toLowerCase();
            if (!seen.has(normalized)) {
                seen.add(normalized);
                validCodes.push(trimmed); // 保留原始格式
                
                // 限制最多7只
                if (validCodes.length >= 7) {
                    break;
                }
            }
        }
        
        return validCodes;
    }
    
    /**
     * 验证并修正配置中的股票代码
     * 如果配置无效，会自动修正
     */
    public async validateAndFixStockCodes(): Promise<boolean> {
        const config = this.get();
        const originalCodes = config.stockCodes;
        const validatedCodes = this.validateAndCleanStockCodes(originalCodes);
        
        // 如果验证后的代码与原始代码不同，说明有无效或超出的代码
        if (validatedCodes.length !== originalCodes.length || 
            !validatedCodes.every((code, index) => code === originalCodes[index])) {
            await this.updateStockCodes(validatedCodes);
            
            const removedCount = originalCodes.length - validatedCodes.length;
            const exceededCount = Math.max(0, originalCodes.length - 7);
            
            // 合并提示信息，避免显示多个提示
            if (removedCount > 0) {
                const messages: string[] = [];
                
                // 计算无效代码数量（排除超出限制的部分）
                const invalidCount = Math.max(0, removedCount - exceededCount);
                if (invalidCount > 0) {
                    messages.push(`${invalidCount} 个无效或重复`);
                }
                
                // 超出限制的数量
                if (exceededCount > 0) {
                    messages.push(`${exceededCount} 个超出限制`);
                }
                
                const message = `检测到 ${messages.join('、')}的股票代码，已自动清理。当前共 ${validatedCodes.length} 只股票。`;
                vscode.window.showWarningMessage(message);
            }
            
            return true;
        }
        
        return false;
    }
    
    private async update(key: string, value: any): Promise<void> {
        const config = vscode.workspace.getConfiguration(ConfigManager.SECTION);
        await config.update(key, value, vscode.ConfigurationTarget.Global);
    }
}

