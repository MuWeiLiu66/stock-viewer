import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
import { StockItem, fetchAllStocks } from './stockDatabase';
import { ConfigManager } from './config';
import { StockDataService, StockInfo } from './stockDataService';
import { StatusBarManager } from './statusBarManager';
import { formatVolume, formatVolumeByCode, formatTurnover, formatChangePercent, formatChangeAmount, getStockPrefix, MIN_UPDATE_INTERVAL, CACHE_EXPIRY_DAYS, MIN_EXPECTED_STOCKS, isMarketOpen, isMarketOpenByData } from './utils';

interface StockQuickPickItem extends vscode.QuickPickItem {
    stock: StockItem | null;
}

let stockDatabase: StockItem[] = [];
let stockDatabaseLoaded = false;

class StockViewer {
    private configManager: ConfigManager;
    private dataService: StockDataService;
    private statusBarManager: StatusBarManager;
    private updateTimer: NodeJS.Timeout | undefined;
    private currentStocks: StockInfo[] = [];
    private configChangeDisposable: vscode.Disposable;

    constructor() {
        this.configManager = new ConfigManager();
        this.dataService = new StockDataService();
        this.statusBarManager = new StatusBarManager();
        
        this.configChangeDisposable = vscode.workspace.onDidChangeConfiguration(async e => {
            if (e.affectsConfiguration('stockViewer.stockCodes')) {
                // 当股票代码配置改变时，进行验证和修正
                await this.configManager.validateAndFixStockCodes();
            }
            if (e.affectsConfiguration('stockViewer')) {
                // 只有在相关配置变化时才重新启动，避免不必要的重启
                const affectedKeys = [
                    'stockViewer.enableAutoUpdate',
                    'stockViewer.updateInterval',
                    'stockViewer.stopOnMarketClose',
                    'stockViewer.showStockName',
                    'stockViewer.showPrice',
                    'stockViewer.showChangePercent',
                    'stockViewer.colorfulDisplay',
                    'stockViewer.alignment',
                    'stockViewer.dataSource'
                ];
                
                // 检查是否有相关配置变化
                const hasRelevantChange = affectedKeys.some(key => e.affectsConfiguration(key));
                
                // showStatusBar配置变化只需要刷新显示，不需要重启定时器
                if (e.affectsConfiguration('stockViewer.showStatusBar')) {
                    this.updateStatusBar();
                } else if (hasRelevantChange) {
                    this.start();
                } else {
                    // 其他配置变化（如showNotifications）只需要刷新显示，不需要重启定时器
                    this.updateStatusBar();
                }
            }
        });
    }

    private async updateStatusBar(): Promise<void> {
        const config = this.configManager.get();
        
        // 根据配置决定是否显示状态栏
        if (!config.showStatusBar) {
            this.statusBarManager.setVisibility(false);
            return;
        }
        
        // 如果配置为显示状态栏，先设置为可见
        this.statusBarManager.setVisibility(true);
        
        if (config.stockCodes.length === 0) {
            this.statusBarManager.showNotConfigured(config.showStockName);
            return;
        }

        try {
            const normalizedCodes = normalizeStockCodes(config.stockCodes);
            const stocks = await this.dataService.fetchStocks(normalizedCodes, config.dataSource);
            
            // 如果启用了收盘时间停止更新，通过实际数据判断市场状态
            if (config.stopOnMarketClose && stocks.length > 0) {
                // 使用第一个股票的数据时间戳判断市场状态
                const firstStock = stocks[0];
                const marketOpen = isMarketOpenByData(firstStock.dataTimestamp, config.dataSource);
                
                if (!marketOpen) {
                    const tooltip = '当前为非交易时间，已暂停更新\n交易时间：周一至周五 9:15-11:30（含集合竞价）, 13:00-15:00';
                    if (config.showStockName) {
                        this.statusBarManager.showError('休市中', true, tooltip);
                    } else {
                        this.statusBarManager.showError('$(watch)', false, tooltip);
                    }
                    return;
                }
            } else if (config.stopOnMarketClose) {
                // 如果没有获取到数据，回退到时间判断
                if (!isMarketOpen()) {
                    const tooltip = '当前为非交易时间，已暂停更新\n交易时间：周一至周五 9:15-11:30（含集合竞价）, 13:00-15:00';
                    if (config.showStockName) {
                        this.statusBarManager.showError('休市中', true, tooltip);
                    } else {
                        this.statusBarManager.showError('$(watch)', false, tooltip);
                    }
                    return;
                }
            }

            if (stocks.length === 0) {
                const tooltip = '未能获取到股票数据，请检查网络连接或稍后重试';
                if (config.showStockName) {
                    this.statusBarManager.showError('获取失败', true, tooltip);
                } else {
                    this.statusBarManager.showError('$(error)', false, tooltip);
                }
                this.currentStocks = [];
                return;
            }

            // 检查是否有股票找不到，并自动移除
            if (stocks.length < config.stockCodes.length) {
                const successCodes = stocks.map(s => s.code.toLowerCase());
                const notFoundStocks: string[] = [];
                
                // 找出哪些股票没有获取到数据
                for (const originalCode of config.stockCodes) {
                    const normalized = normalizeStockCodes([originalCode])[0];
                    if (!successCodes.includes(normalized.toLowerCase())) {
                        notFoundStocks.push(originalCode);
                    }
                }
                
                if (notFoundStocks.length > 0) {
                    // 从配置中移除找不到的股票
                    const validStockCodes = config.stockCodes.filter(code => !notFoundStocks.includes(code));
                    await this.configManager.updateStockCodes(validStockCodes);
                    
                    // 提示用户
                    const message = `以下股票代码无效已自动移除: ${notFoundStocks.join(', ')}`;
                    vscode.window.showWarningMessage(message);
                }
            }

            this.currentStocks = stocks;
            this.statusBarManager.updateStocks(
                stocks, 
                config.showStockName, 
                config.showPrice,
                config.showChangePercent,
                config.colorfulDisplay,
                config.alignment,
                config.dataSource
            );
        } catch (error) {
            console.error('更新股票信息失败:', error);
            const tooltip = '更新股票数据时出错，请检查网络连接或稍后重试';
            if (config.showStockName) {
                this.statusBarManager.showError('更新失败', true, tooltip);
            } else {
                this.statusBarManager.showError('$(warning)', false, tooltip);
            }
        }
    }

    public getCurrentStocks(): StockInfo[] {
        return this.currentStocks;
    }

    public refresh(): void {
        this.updateStatusBar();
        // 刷新后重新检查是否需要启动定时器
        const config = this.configManager.get();
        if (config.enableAutoUpdate && !this.updateTimer) {
            // 如果自动更新已启用但没有定时器，尝试重新启动
            this.start();
        }
    }

    public start(): void {
        if (this.updateTimer) {
            clearInterval(this.updateTimer);
            this.updateTimer = undefined;
        }

        // 立即更新一次显示
        this.updateStatusBar();

        const config = this.configManager.get();
        // 只有启用自动更新时才设置定时器
        if (config.enableAutoUpdate) {
            // 如果启用了收盘时间停止更新，且当前不在交易时间，则不设置定时器
            if (config.stopOnMarketClose && !isMarketOpen()) {
                // 不设置定时器，避免非交易时间时的无效更新
                // 但需要更新状态栏显示"休市中"图标
                this.updateStatusBar();
                return;
            }
            
            this.updateTimer = setInterval(() => {
                const currentConfig = this.configManager.get();
                // 在定时器回调中再次检查：如果启用了收盘时间停止更新，且当前不在交易时间，则清除定时器
                if (currentConfig.stopOnMarketClose && !isMarketOpen()) {
                    if (this.updateTimer) {
                        clearInterval(this.updateTimer);
                        this.updateTimer = undefined;
                    }
                    // 更新状态栏显示"休市中"图标
                    this.updateStatusBar();
                    return;
                }
                // 如果禁用了自动更新，也清除定时器
                if (!currentConfig.enableAutoUpdate) {
                    if (this.updateTimer) {
                        clearInterval(this.updateTimer);
                        this.updateTimer = undefined;
                    }
                    return;
                }
                this.updateStatusBar();
            }, Math.max(config.updateInterval, MIN_UPDATE_INTERVAL));
        }
    }

    public stop(): void {
        if (this.updateTimer) {
            clearInterval(this.updateTimer);
            this.updateTimer = undefined;
        }
        this.statusBarManager.hide();
    }

    public dispose(): void {
        this.stop();
        this.configChangeDisposable.dispose();
        this.statusBarManager.dispose();
    }
}

let stockViewer: StockViewer;
let configManager: ConfigManager;

// 辅助函数：根据配置决定是否显示通知
function showNotification(message: string, type: 'info' | 'warning' = 'info'): void {
    const config = configManager.get();
    if (config.showNotifications) {
        if (type === 'warning') {
            vscode.window.showWarningMessage(message);
        } else {
            vscode.window.showInformationMessage(message);
        }
    }
}

// 股票数据库管理
class StockDatabaseManager {
    constructor(private context: vscode.ExtensionContext) {}
    
    private get cacheFile(): string {
        return path.join(this.context.globalStoragePath, 'stockDatabase.json');
    }
    
    public async load(): Promise<void> {
        if (stockDatabaseLoaded) return;

        if (await this.loadFromCache()) {
            return;
        }

        this.fetchFromRemote();
    }
    
    private async loadFromCache(): Promise<boolean> {
        try {
            if (!fs.existsSync(this.cacheFile)) return false;
            
            const cached = JSON.parse(fs.readFileSync(this.cacheFile, 'utf-8'));
            const cacheAge = Date.now() - (cached.timestamp || 0);
            const cachedCount = cached.stocks?.length || 0;
            
            if (cacheAge < CACHE_EXPIRY_DAYS * 24 * 60 * 60 * 1000 && cachedCount >= MIN_EXPECTED_STOCKS) {
                stockDatabase = cached.stocks;
                stockDatabaseLoaded = true;
                return true;
            }
            
            if (cachedCount > 0 && cachedCount < MIN_EXPECTED_STOCKS) {
                fs.unlinkSync(this.cacheFile);
            }
        } catch (error) {
            console.error('加载缓存失败:', error);
        }
        
        return false;
    }
    
    private fetchFromRemote(): void {
        stockDatabaseLoaded = true;
        
        fetchAllStocks()
            .then(stocks => {
                if (stocks.length > 0) {
                    stockDatabase = stocks;
                    this.saveToCache(stocks);
                } else {
                    vscode.window.showWarningMessage('获取股票列表失败，请检查网络连接');
                }
            })
            .catch(error => {
                console.error('获取股票列表失败:', error);
                vscode.window.showWarningMessage('获取股票列表失败，请检查网络连接');
            });
    }
    
    private saveToCache(stocks: StockItem[]): void {
        try {
            const cacheData = { timestamp: Date.now(), stocks };
            fs.writeFileSync(this.cacheFile, JSON.stringify(cacheData, null, 2), 'utf-8');
        } catch (error) {
            console.error('保存缓存失败:', error);
        }
    }
    
    public async reload(): Promise<void> {
        if (fs.existsSync(this.cacheFile)) {
            fs.unlinkSync(this.cacheFile);
        }
        
        stockDatabaseLoaded = false;
        stockDatabase = [];
        
        showNotification('正在重新加载股票数据库...');
        await this.load();
        
        if (stockDatabase.length > 0) {
            showNotification(`已加载 ${stockDatabase.length} 只股票`);
        }
    }
}

let databaseManager: StockDatabaseManager;

export async function activate(context: vscode.ExtensionContext) {
    try {
        if (context.globalStoragePath && !fs.existsSync(context.globalStoragePath)) {
            fs.mkdirSync(context.globalStoragePath, { recursive: true });
        }

        databaseManager = new StockDatabaseManager(context);
        await databaseManager.load();
        
        configManager = new ConfigManager();
        // 启动时验证并修正配置
        await configManager.validateAndFixStockCodes();
        
        stockViewer = new StockViewer();
        stockViewer.start();
    } catch (error) {
        console.error('股票查看器插件激活失败:', error);
    }

    registerCommands(context);
}

function registerCommands(context: vscode.ExtensionContext) {
    context.subscriptions.push(
        vscode.commands.registerCommand('stockViewer.toggleShowName', async () => {
            const newValue = await configManager.toggleShowName();
            showNotification(`股票名称显示已${newValue ? '开启' : '关闭'}`);
        }),

        vscode.commands.registerCommand('stockViewer.toggleShowPrice', async () => {
            const newValue = await configManager.toggleShowPrice();
            showNotification(`价格显示已${newValue ? '开启' : '关闭'}`);
        }),

        vscode.commands.registerCommand('stockViewer.toggleShowChangePercent', async () => {
            const newValue = await configManager.toggleShowChangePercent();
            showNotification(`涨跌幅显示已${newValue ? '开启' : '关闭'}`);
        }),

        vscode.commands.registerCommand('stockViewer.toggleColorfulDisplay', async () => {
            const newValue = await configManager.toggleColorfulDisplay();
            showNotification(`彩色显示已${newValue ? '开启' : '关闭'}`);
        }),

        vscode.commands.registerCommand('stockViewer.switchDataSource', async () => {
            const newSource = await configManager.switchDataSource();
            const sourceName = configManager.getDataSourceName(newSource);
            showNotification(`数据源已切换为: ${sourceName}`);
        }),

        vscode.commands.registerCommand('stockViewer.openSettings', () => {
            vscode.commands.executeCommand('workbench.action.openSettings', 'stockViewer');
        }),

        vscode.commands.registerCommand('stockViewer.refresh', () => {
            stockViewer.refresh();
            showNotification('正在刷新股票数据...');
        }),

        vscode.commands.registerCommand('stockViewer.showDetails', () => {
            const stocks = stockViewer.getCurrentStocks();
            if (stocks.length === 0) {
                vscode.window.showInformationMessage('暂无股票数据，请先配置股票代码');
                return;
            }
            showStockDetails(stocks);
        }),

        vscode.commands.registerCommand('stockViewer.reloadDatabase', async () => {
            await databaseManager.reload();
        }),

        vscode.commands.registerCommand('stockViewer.searchAndAddStock', async () => {
            if (!stockDatabaseLoaded || stockDatabase.length === 0) {
                await databaseManager.load();
            }

            const quickPick = vscode.window.createQuickPick<StockQuickPickItem>();
            quickPick.placeholder = '输入股票名称或编号进行搜索（支持模糊匹配）';
            quickPick.matchOnDescription = true;
            quickPick.matchOnDetail = true;
            quickPick.canSelectMany = false;

            quickPick.items = [{ label: '请输入股票名称或编号...', description: '例如：平安银行 或 000001', stock: null }];

            quickPick.onDidChangeValue((value) => {
                const searchTerm = value.trim();
                
                if (!searchTerm) {
                    quickPick.items = [{ label: '请输入股票名称或编号...', description: '例如：平安银行 或 000001', stock: null }];
                    return;
                }

                const results = searchStocks(searchTerm);
                
                if (results.length === 0) {
                    quickPick.items = [{ label: `未找到匹配的股票: ${searchTerm}`, description: '请尝试其他关键词', stock: null }];
                    return;
                }

                const displayResults = results.slice(0, 100);
                quickPick.items = displayResults.map(stock => ({
                    label: stock.name || stock.code,
                    description: stock.code,
                    detail: stock.name ? `编号: ${stock.number} | ${stock.name}` : `编号: ${stock.number}`,
                    stock: stock
                }));

                quickPick.placeholder = results.length > 100 
                    ? `找到 ${results.length} 个匹配结果（显示前100个）`
                    : `找到 ${results.length} 个匹配结果`;
            });

            quickPick.onDidAccept(async () => {
                const selected = quickPick.selectedItems[0];
                if (selected?.stock) {
                    quickPick.dispose();
                    await addStockToConfig(selected.stock.code);
                }
            });

            quickPick.show();
        }),

        vscode.commands.registerCommand('stockViewer.removeStock', async () => {
            const config = configManager.get();
            
            if (config.stockCodes.length === 0) {
                vscode.window.showInformationMessage('暂无配置的股票');
                return;
            }

            // 获取当前股票信息用于显示
            const currentStocks = stockViewer.getCurrentStocks();
            
            // 创建快速选择项
            const items = config.stockCodes.map((code, index) => {
                const stockInfo = currentStocks.find(s => {
                    const normalized = normalizeStockCodes([code]);
                    return s.code === normalized[0] || s.code === code;
                });
                
                return {
                    label: stockInfo?.name || code,
                    description: code,
                    detail: stockInfo ? `当前价: ${stockInfo.currentPrice.toFixed(2)}  涨跌幅: ${formatChangePercent(stockInfo.changePercent)}` : undefined,
                    code: code
                };
            });

            const selected = await vscode.window.showQuickPick(items, {
                placeHolder: '选择要删除的股票',
                canPickMany: false
            });

            if (selected) {
                // 使用规范化比较，确保删除时能正确匹配（考虑大小写）
                const selectedNormalized = normalizeStockCodes([selected.code])[0];
                const newCodes = config.stockCodes.filter(code => {
                    const normalized = normalizeStockCodes([code])[0];
                    return normalized !== selectedNormalized && code !== selected.code;
                });
                await configManager.updateStockCodes(newCodes);
                showNotification(`已删除股票: ${selected.label} (${selected.code})`);
            }
        }),

        vscode.commands.registerCommand('stockViewer.toggleStopOnMarketClose', async () => {
            const newValue = await configManager.toggleStopOnMarketClose();
            const statusText = newValue ? '已开启' : '已关闭';
            const explanation = newValue ? '（非交易时间将自动暂停更新）' : '';
            showNotification(`收盘时间停止请求${statusText}${explanation}`);
            // 立即刷新一次以应用新设置
            stockViewer.refresh();
        }),

        vscode.commands.registerCommand('stockViewer.toggleEnableAutoUpdate', async () => {
            const newValue = await configManager.toggleEnableAutoUpdate();
            const statusText = newValue ? '已开启' : '已关闭';
            showNotification(`自动更新${statusText}`);
            // 立即刷新一次以应用新设置
            stockViewer.refresh();
        }),

        vscode.commands.registerCommand('stockViewer.toggleShowNotifications', async () => {
            const newValue = await configManager.toggleShowNotifications();
            const statusText = newValue ? '已开启' : '已关闭';
            // 这个命令总是显示提示，因为用户需要知道切换结果
            vscode.window.showInformationMessage(`提示气泡${statusText}`);
        }),

        vscode.commands.registerCommand('stockViewer.toggleShowStatusBar', async () => {
            const newValue = await configManager.toggleShowStatusBar();
            const statusText = newValue ? '已显示' : '已隐藏';
            showNotification(`状态栏股票信息${statusText}`);
            // 立即刷新一次以应用新设置
            stockViewer.refresh();
        }),

        { dispose: () => stockViewer.dispose() }
    );
}

function normalizeStockCodes(codes: string[]): string[] {
    const normalized: string[] = [];
    
    for (const code of codes) {
        if (!code || typeof code !== 'string') continue;
        
        const trimmed = code.trim();
        if (!trimmed) continue;
        
        // A股代码：sz000001, sh600000, bj920001
        if (trimmed.match(/^(sz|sh|bj)\d{6}$/i)) {
            normalized.push(trimmed.toLowerCase());
            continue;
        }
        
        // 港股代码：hk00700, hk09988（5位数字）
        if (trimmed.match(/^hk\d{5}$/i)) {
            normalized.push(trimmed.toLowerCase());
            continue;
        }
        
        // 美股代码：us.AAPL, us.BRK.A
        if (trimmed.match(/^us\.[A-Z0-9]+(?:\.[A-Z]+)?$/i)) {
            normalized.push(trimmed.toLowerCase());
            continue;
        }
        
        // 6位纯数字（A股）
        if (trimmed.match(/^\d{6}$/)) {
            const num = parseInt(trimmed);
            normalized.push(`${getStockPrefix(num)}${trimmed}`);
            continue;
        }
        
        // 中文名称搜索
        if (/[\u4e00-\u9fa5]/.test(trimmed)) {
            if (stockDatabaseLoaded && stockDatabase.length > 0) {
                const results = searchStocks(trimmed);
                if (results.length > 0) {
                    normalized.push(results[0].code);
                    continue;
                }
            }
            console.warn(`无法找到股票代码: ${trimmed}`);
        }
        
        // 其他格式直接保留（可能是不常见的格式）
        normalized.push(trimmed);
    }
    
    return [...new Set(normalized)];
}

function searchStocks(keyword: string): StockItem[] {
    const trimmedKeyword = keyword.trim();
    if (!trimmedKeyword) return [];

    const lowerKeyword = trimmedKeyword.toLowerCase();
    const results: Map<string, { stock: StockItem; score: number }> = new Map();

    for (const stock of stockDatabase) {
        if (results.has(stock.code)) continue;

        const score = calculateMatchScore(stock, trimmedKeyword, lowerKeyword);
        if (score > 0) {
            results.set(stock.code, { stock, score });
        }
    }

    return Array.from(results.values())
        .sort((a, b) => {
            if (a.score !== b.score) return b.score - a.score;
            if (a.stock.name && !b.stock.name) return -1;
            if (!a.stock.name && b.stock.name) return 1;
            if (a.stock.name && b.stock.name) return a.stock.name.length - b.stock.name.length;
            return a.stock.code.localeCompare(b.stock.code);
        })
        .map(item => item.stock);
}

function calculateMatchScore(stock: StockItem, keyword: string, lowerKeyword: string): number {
    if (stock.name === keyword) return 1000;
    if (stock.name?.startsWith(keyword)) return 800;
    if (stock.name?.includes(keyword)) return 600;
    if (stock.name?.toLowerCase().includes(lowerKeyword)) return 500;
    if (stock.number === keyword) return 900;
    if (stock.number.startsWith(keyword)) return 700;
    if (stock.number.includes(keyword)) return 400;
    if (stock.code.toLowerCase() === lowerKeyword) return 950;
    if (stock.code.toLowerCase().includes(lowerKeyword)) return 300;
    return 0;
}

function showStockDetails(stocks: StockInfo[]): void {
    const panel = vscode.window.createWebviewPanel(
        'stockDetails',
        '股票详细信息',
        vscode.ViewColumn.Beside,
        { enableScripts: true, retainContextWhenHidden: true }
    );

    // 读取配置
    const config = configManager.get();
    const useColor = config.colorfulDisplay;

    // 卡片视图
    const formatStockCard = (stock: StockInfo): string => {
        const changeColor = useColor ? (stock.changeAmount >= 0 ? '#ff0000' : '#00aa00') : '#000';
        return `
            <div class="stock-card">
                <div class="stock-header">
                    <span class="stock-name">${stock.name}</span>
                    <span class="stock-code">${stock.code}</span>
                </div>
                <div class="stock-price" style="color: ${changeColor};">
                    ${stock.currentPrice.toFixed(2)}
                    <span class="stock-change">${formatChangeAmount(stock.changeAmount)} (${formatChangePercent(stock.changePercent)})</span>
                </div>
                <div class="stock-info">
                    <div class="info-row">
                        <span class="label">昨收价</span>
                        <span class="value">${stock.yesterdayClose.toFixed(2)}</span>
                    </div>
                    <div class="info-row">
                        <span class="label">今开盘</span>
                        <span class="value">${stock.todayOpen.toFixed(2)}</span>
                    </div>
                    <div class="info-row">
                        <span class="label">今日最高</span>
                        <span class="value">${stock.todayHigh.toFixed(2)}</span>
                    </div>
                    <div class="info-row">
                        <span class="label">今日最低</span>
                        <span class="value">${stock.todayLow.toFixed(2)}</span>
                    </div>
                    <div class="info-row">
                        <span class="label">成交量</span>
                        <span class="value">${formatVolumeByCode(stock.volume, stock.code)}</span>
                    </div>
                    <div class="info-row">
                        <span class="label">成交额</span>
                        <span class="value">${formatTurnover(stock.turnover)}</span>
                    </div>
                </div>
                <div class="stock-update-time">
                    <span class="update-time">更新时间: ${stock.updateTime}</span>
                </div>
            </div>
        `;
    };

    // 表格视图
    const formatStockTable = (): string => {
        const rows = stocks.map(stock => {
            const changeColor = useColor ? (stock.changeAmount >= 0 ? '#ff0000' : '#00aa00') : '#000';
            return `
                <tr>
                    <td>${stock.name}</td>
                    <td>${stock.code}</td>
                    <td style="color: ${changeColor}; font-weight: bold;">${stock.currentPrice.toFixed(2)}</td>
                    <td style="color: ${changeColor};">${formatChangeAmount(stock.changeAmount)}</td>
                    <td style="color: ${changeColor};">${formatChangePercent(stock.changePercent)}</td>
                    <td>${stock.yesterdayClose.toFixed(2)}</td>
                    <td>${stock.todayOpen.toFixed(2)}</td>
                    <td>${stock.todayHigh.toFixed(2)}</td>
                    <td>${stock.todayLow.toFixed(2)}</td>
                    <td>${formatVolumeByCode(stock.volume, stock.code)}</td>
                    <td>${formatTurnover(stock.turnover)}</td>
                    <td class="update-time-cell">${stock.updateTime}</td>
                </tr>
            `;
        }).join('');

        return `
            <table class="stock-table">
                <thead>
                    <tr>
                        <th>名称</th>
                        <th>代码</th>
                        <th>当前价</th>
                        <th>涨跌额</th>
                        <th>涨跌幅</th>
                        <th>昨收价</th>
                        <th>今开盘</th>
                        <th>今日最高</th>
                        <th>今日最低</th>
                        <th>成交量</th>
                        <th>成交额</th>
                        <th>更新时间</th>
                    </tr>
                </thead>
                <tbody>
                    ${rows}
                </tbody>
            </table>
        `;
    };

    panel.webview.html = `
        <!DOCTYPE html>
        <html>
        <head>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <style>
                * {
                    margin: 0;
                    padding: 0;
                    box-sizing: border-box;
                }
                
                body {
                    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
                    padding: 20px;
                    background: #fff;
                    color: #000;
                }
                
                .toolbar {
                    display: flex;
                    justify-content: flex-end;
                    margin-bottom: 20px;
                    gap: 10px;
                }
                
                .btn {
                    padding: 8px 16px;
                    border: 1px solid #007acc;
                    background: #fff;
                    color: #007acc;
                    cursor: pointer;
                    border-radius: 4px;
                    font-size: 14px;
                    transition: all 0.2s;
                }
                
                .btn:hover {
                    background: #007acc;
                    color: #fff;
                }
                
                .btn.active {
                    background: #007acc;
                    color: #fff;
                }
                
                /* 卡片布局 */
                .card-view {
                    display: grid;
                    grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
                    gap: 20px;
                }
                
                .stock-card {
                    border: 1px solid #e0e0e0;
                    border-radius: 8px;
                    padding: 16px;
                    background: #f9f9f9;
                    transition: box-shadow 0.2s;
                }
                
                .stock-card:hover {
                    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
                }
                
                .stock-header {
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                    margin-bottom: 12px;
                    padding-bottom: 12px;
                    border-bottom: 1px solid #e0e0e0;
                }
                
                .stock-name {
                    font-size: 16px;
                    font-weight: bold;
                    color: #000;
                }
                
                .stock-code {
                    font-size: 12px;
                    color: #666;
                }
                
                .stock-price {
                    font-size: 24px;
                    font-weight: bold;
                    margin-bottom: 8px;
                }
                
                .stock-change {
                    font-size: 14px;
                    margin-left: 8px;
                }
                
                .stock-info {
                    display: grid;
                    grid-template-columns: 1fr 1fr;
                    gap: 8px;
                    margin-top: 12px;
                }
                
                .info-row {
                    display: flex;
                    justify-content: space-between;
                    padding: 4px 0;
                }
                
                .info-row .label {
                    color: #666;
                    font-size: 13px;
                }
                
                .info-row .value {
                    color: #000;
                    font-size: 13px;
                    font-weight: 500;
                }
                
                .stock-update-time {
                    margin-top: 12px;
                    padding-top: 8px;
                    border-top: 1px solid #e0e0e0;
                    text-align: center;
                }
                
                .stock-update-time .update-time {
                    color: #999;
                    font-size: 12px;
                    font-style: italic;
                }
                
                /* 表格布局 */
                .table-view {
                    overflow-x: auto;
                }
                
                .stock-table {
                    width: 100%;
                    border-collapse: collapse;
                    background: #fff;
                }
                
                .stock-table th,
                .stock-table td {
                    padding: 12px;
                    text-align: left;
                    border-bottom: 1px solid #e0e0e0;
                }
                
                .stock-table th {
                    background: #f5f5f5;
                    font-weight: 600;
                    color: #000;
                    position: sticky;
                    top: 0;
                    z-index: 1;
                }
                
                .stock-table tbody tr:hover {
                    background: #f9f9f9;
                }
                
                .stock-table td {
                    font-size: 14px;
                }
                
                .update-time-cell {
                    color: #999;
                    font-size: 12px;
                    font-style: italic;
                }
                
                .hidden {
                    display: none;
                }
            </style>
        </head>
        <body>
            <div class="toolbar">
                <button class="btn active" id="cardBtn" onclick="switchView('card')">卡片视图</button>
                <button class="btn" id="tableBtn" onclick="switchView('table')">表格视图</button>
            </div>
            
            <div class="card-view" id="cardView">
                ${stocks.map(formatStockCard).join('')}
            </div>
            
            <div class="table-view hidden" id="tableView">
                ${formatStockTable()}
            </div>
            
            <script>
                function switchView(view) {
                    const cardView = document.getElementById('cardView');
                    const tableView = document.getElementById('tableView');
                    const cardBtn = document.getElementById('cardBtn');
                    const tableBtn = document.getElementById('tableBtn');
                    
                    if (view === 'card') {
                        cardView.classList.remove('hidden');
                        tableView.classList.add('hidden');
                        cardBtn.classList.add('active');
                        tableBtn.classList.remove('active');
                    } else {
                        cardView.classList.add('hidden');
                        tableView.classList.remove('hidden');
                        cardBtn.classList.remove('active');
                        tableBtn.classList.add('active');
                    }
                }
            </script>
        </body>
        </html>
    `;
}

async function addStockToConfig(stockCode: string): Promise<void> {
    const result = await configManager.addStockCode(stockCode);
    
    if (!result.success) {
        showNotification(result.message || '添加股票失败', 'warning');
        return;
    }
    
    const stock = stockDatabase.find(s => s.code === stockCode);
    const stockName = stock?.name || stockCode;
    showNotification(`已添加股票: ${stockName} (${stockCode})`);
}

export function deactivate() {
    if (stockViewer) {
        stockViewer.dispose();
    }
}
