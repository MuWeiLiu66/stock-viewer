import * as vscode from 'vscode';
import { StockInfo } from './stockDataService';
import { formatVolume, formatTurnover, formatChangePercent, formatChangeAmount } from './utils';

export class StatusBarManager {
    private settingsBarItem!: vscode.StatusBarItem;
    private stockBarItems: vscode.StatusBarItem[] = [];
    private readonly maxStocks = 7; // 最多显示7只股票
    private currentAlignment: 'left' | 'right' = 'right';
    
    constructor() {
        this.currentAlignment = 'right';
        this.initializeItems('right');
    }
    
    private initializeItems(alignment: 'left' | 'right'): void {
        // 清理旧的状态栏项
        this.disposeItems();
        
        // 创建新的状态栏项
        const alignmentEnum = alignment === 'left' ? vscode.StatusBarAlignment.Left : vscode.StatusBarAlignment.Right;
        
        // VS Code 状态栏优先级规则：
        // - Left 对齐：priority 越大，越靠右
        // - Right 对齐：priority 越大，越靠左
        
        let settingsPriority: number;
        let stockBasePriority: number;
        
        if (alignment === 'right') {
            // 右对齐时：
            // - 股票项使用正常优先级（100-），按正常顺序显示
            // - 设置按钮使用更低优先级（90），让它显示在股票的右边（更靠右）
            stockBasePriority = 100;
            settingsPriority = 90;
        } else {
            // 左对齐时：
            // - 股票项使用正常优先级（100-），跟在 git 等插件后面
            // - 设置按钮使用更高优先级（110），让它显示在股票的左边（更靠右）
            stockBasePriority = 100;
            settingsPriority = 110;
        }
        
        this.settingsBarItem = vscode.window.createStatusBarItem(alignmentEnum, settingsPriority);
        this.settingsBarItem.text = '$(gear)';
        this.settingsBarItem.tooltip = '打开股票配置';
        this.settingsBarItem.command = 'stockViewer.openSettings';
        // 立即显示设置图标，确保用户随时可以点击
        this.settingsBarItem.show();
        
        // 预创建多个状态栏项用于显示股票，使用连续的优先级值
        this.stockBarItems = [];
        for (let i = 0; i < this.maxStocks; i++) {
            // 股票项按序号排列，从高到低（或从低到高，取决于对齐方向）
            const priority = alignment === 'right' 
                ? stockBasePriority - i  // 右对齐：从 10000 递减，让股票从左到右排列
                : stockBasePriority - i; // 左对齐：从 100 递减，让股票从左到右排列
            const item = vscode.window.createStatusBarItem(alignmentEnum, priority);
            item.command = 'stockViewer.showDetails';
            this.stockBarItems.push(item);
        }
        
        this.currentAlignment = alignment;
    }
    
    private disposeItems(): void {
        if (this.settingsBarItem) {
            try {
                this.settingsBarItem.dispose();
            } catch (e) {
                // 忽略已释放的错误
            }
        }
        this.stockBarItems.forEach(item => {
            try {
                item.dispose();
            } catch (e) {
                // 忽略已释放的错误
            }
        });
        this.stockBarItems = [];
    }
    
    private updateAlignmentIfNeeded(alignment: 'left' | 'right'): void {
        if (this.currentAlignment !== alignment) {
            const wasShowing = this.settingsBarItem && 
                this.stockBarItems.length > 0 && 
                this.stockBarItems.some(item => item.text);
            this.initializeItems(alignment);
            if (wasShowing) {
                this.settingsBarItem.show();
            }
        }
    }
    
    public show(): void {
        this.settingsBarItem.show();
    }
    
    public hide(): void {
        this.settingsBarItem.hide();
        this.stockBarItems.forEach(item => item.hide());
    }
    
    public showNotConfigured(showPrefix: boolean = true): void {
        this.settingsBarItem.show();
        this.hideAllStockItems();
        
        const item = this.stockBarItems[0];
        item.text = showPrefix ? '股票: 未配置' : '$(edit)';
        item.tooltip = '点击配置股票代码';
        item.color = undefined;
        item.command = 'stockViewer.openSettings'; // 点击打开设置
        item.show();
    }
    
    public showError(message: string, showPrefix: boolean = true, customTooltip?: string): void {
        this.settingsBarItem.show();
        this.hideAllStockItems();
        
        const item = this.stockBarItems[0];
        item.text = showPrefix ? `股票: ${message}` : message;
        item.tooltip = customTooltip || `错误: ${message}`;
        item.color = undefined;
        item.command = undefined; // 禁用点击事件
        item.show();
    }
    
    public updateStocks(
        stocks: StockInfo[], 
        showStockName: boolean, 
        showPrice: boolean,
        showChangePercent: boolean,
        colorfulDisplay: boolean,
        alignment: 'left' | 'right',
        dataSource: string
    ): void {
        this.updateAlignmentIfNeeded(alignment);
        this.settingsBarItem.show();
        this.hideAllStockItems();
        
        const displayCount = Math.min(stocks.length, this.maxStocks);
        
        for (let i = 0; i < displayCount; i++) {
            const stock = stocks[i];
            const item = this.stockBarItems[i];
            const parts: string[] = [];
            
            // 添加股票名称
            if (showStockName) {
                parts.push(stock.name);
            }
            
            // 添加价格
            if (showPrice) {
                parts.push(stock.currentPrice.toFixed(2));
            }
            
            // 添加涨跌幅
            if (showChangePercent) {
                const percentStr = formatChangePercent(stock.changePercent);
                parts.push(percentStr);
            }
            
            // 如果价格和涨跌幅都不显示，只显示箭头
            if (!showPrice && !showChangePercent) {
                const percent = parseFloat(stock.changePercent);
                const arrow = percent >= 0 ? '↑' : '↓';
                parts.push(arrow);
            }
            
            item.text = parts.join(' ');
            item.tooltip = this.createSingleStockTooltip(stock, dataSource);
            item.command = 'stockViewer.showDetails'; // 恢复点击事件
            
            // 应用彩色显示
            if (colorfulDisplay) {
                const percent = parseFloat(stock.changePercent);
                // 涨红跌绿
                item.color = percent >= 0 ? new vscode.ThemeColor('charts.red') : new vscode.ThemeColor('charts.green');
            } else {
                item.color = undefined;
            }
            
            item.show();
        }
    }
    
    private hideAllStockItems(): void {
        this.stockBarItems.forEach(item => item.hide());
    }
    
    private createSingleStockTooltip(stock: StockInfo, dataSource: string): vscode.MarkdownString {
        const md = new vscode.MarkdownString();
        const dataSourceName = dataSource === 'sina' ? '新浪财经' : '腾讯财经';
        
        md.appendMarkdown(`#### ${stock.name} (${stock.code})\n\n`);
        md.appendMarkdown(`---\n\n`);
        md.appendMarkdown(`| 项目 | 数值 |\n|:-----|-----:|\n`);
        md.appendMarkdown(`| **当前价** | **${stock.currentPrice.toFixed(2)}** |\n`);
        md.appendMarkdown(`| 涨跌额 | ${formatChangeAmount(stock.changeAmount)} |\n`);
        md.appendMarkdown(`| 涨跌幅 | ${formatChangePercent(stock.changePercent)} |\n`);
        md.appendMarkdown(`| 昨收价 | ${stock.yesterdayClose.toFixed(2)} |\n`);
        md.appendMarkdown(`| 今开盘 | ${stock.todayOpen.toFixed(2)} |\n`);
        md.appendMarkdown(`| 今日最高 | ${stock.todayHigh.toFixed(2)} |\n`);
        md.appendMarkdown(`| 今日最低 | ${stock.todayLow.toFixed(2)} |\n`);
        md.appendMarkdown(`| 成交量 | ${formatVolume(stock.volume)} |\n`);
        md.appendMarkdown(`| 成交额 | ${formatTurnover(stock.turnover)} |\n`);
        md.appendMarkdown(`\n---\n\n`);
        md.appendMarkdown(`*数据更新时间: ${stock.updateTime}*\n`);
        md.isTrusted = true;
        
        return md;
    }
    
    public dispose(): void {
        this.disposeItems();
    }
}
