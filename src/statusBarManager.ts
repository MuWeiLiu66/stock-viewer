import * as vscode from 'vscode';
import { StockInfo } from './stockDataService';
import { formatVolume, formatVolumeByCode, formatTurnover, formatChangePercent, formatChangeAmount } from './utils';

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
        // 只在对齐方式真正改变时才重新初始化，避免不必要的重建
        if (this.currentAlignment !== alignment) {
            const wasShowing = this.settingsBarItem && 
                this.stockBarItems.length > 0 && 
                this.stockBarItems.some(item => item.text);
            // 保存当前显示的股票数据，以便重新显示
            const currentStocksData: Array<{ text: string; tooltip: vscode.MarkdownString | string | undefined; color: vscode.ThemeColor | string | undefined }> = [];
            for (const item of this.stockBarItems) {
                if (item.text) {
                    currentStocksData.push({
                        text: item.text,
                        tooltip: item.tooltip,
                        color: item.color
                    });
                }
            }
            
            this.initializeItems(alignment);
            
            // 恢复之前显示的股票数据
            if (wasShowing && currentStocksData.length > 0) {
                this.settingsBarItem.show();
                for (let i = 0; i < Math.min(currentStocksData.length, this.stockBarItems.length); i++) {
                    const item = this.stockBarItems[i];
                    const data = currentStocksData[i];
                    item.text = data.text;
                    item.tooltip = data.tooltip;
                    item.color = data.color;
                    item.show();
                }
            } else if (wasShowing) {
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
        
        const displayCount = Math.min(stocks.length, this.maxStocks);
        
        // 先更新需要显示的股票项（避免闪烁）
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
            
            const newText = parts.join(' ');
            const newTooltip = this.createSingleStockTooltip(stock, dataSource);
            
            // 只更新变化的内容，避免不必要的重绘
            let needsUpdate = false;
            
            if (item.text !== newText) {
                item.text = newText;
                needsUpdate = true;
            }
            
            // 检查tooltip是否有变化（比较tooltip的值字符串）
            const currentTooltip = item.tooltip;
            const currentTooltipValue = currentTooltip instanceof vscode.MarkdownString 
                ? currentTooltip.value 
                : (currentTooltip || '');
            const newTooltipValue = newTooltip.value || '';
            if (currentTooltipValue !== newTooltipValue) {
                item.tooltip = newTooltip;
                needsUpdate = true;
            }
            
            // 检查command是否有变化
            if (item.command !== 'stockViewer.showDetails') {
                item.command = 'stockViewer.showDetails';
                needsUpdate = true;
            }
            
            // 应用彩色显示（只在配置变化或涨跌状态变化时更新）
            const percent = parseFloat(stock.changePercent);
            const shouldBeRed = percent >= 0;
            const currentColor = item.color;
            const currentColorIsRed = currentColor instanceof vscode.ThemeColor && currentColor.id === 'charts.red';
            const currentColorIsGreen = currentColor instanceof vscode.ThemeColor && currentColor.id === 'charts.green';
            const currentColorMatches = colorfulDisplay 
                ? (shouldBeRed && currentColorIsRed) || (!shouldBeRed && currentColorIsGreen)
                : !currentColor;
            
            if (!currentColorMatches) {
                if (colorfulDisplay) {
                    // 涨红跌绿
                    item.color = shouldBeRed ? new vscode.ThemeColor('charts.red') : new vscode.ThemeColor('charts.green');
                } else {
                    item.color = undefined;
                }
                needsUpdate = true;
            }
            
            // 只在有更新或项不可见时才调用 show，避免不必要的重绘
            if (needsUpdate || !item.text) {
                item.show();
            }
        }
        
        // 隐藏多余的股票项（如果有减少）
        for (let i = displayCount; i < this.maxStocks; i++) {
            const item = this.stockBarItems[i];
            if (item.text) {
                item.hide();
                item.text = ''; // 清空文本以便下次显示时检测
            }
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
        md.appendMarkdown(`| 成交量 | ${formatVolumeByCode(stock.volume, stock.code)} |\n`);
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
