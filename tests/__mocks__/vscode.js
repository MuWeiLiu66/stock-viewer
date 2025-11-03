"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.Configuration = exports.commands = exports.MarkdownString = exports.ThemeColor = exports.ViewColumn = exports.ConfigurationTarget = exports.StatusBarAlignment = exports.window = exports.workspace = void 0;
// Mock VS Code API for testing
exports.workspace = {
    getConfiguration: jest.fn(),
    onDidChangeConfiguration: jest.fn(),
};
exports.window = {
    createStatusBarItem: jest.fn(),
    showInformationMessage: jest.fn(),
    showWarningMessage: jest.fn(),
    showErrorMessage: jest.fn(),
    createQuickPick: jest.fn(),
    createWebviewPanel: jest.fn(),
};
exports.StatusBarAlignment = {
    Left: 1,
    Right: 2,
};
exports.ConfigurationTarget = {
    Global: 1,
    Workspace: 2,
    WorkspaceFolder: 3,
};
exports.ViewColumn = {
    Beside: 2,
};
class ThemeColor {
    constructor(id) {
        this.id = id;
    }
}
exports.ThemeColor = ThemeColor;
class MarkdownString {
    constructor() {
        this.value = '';
        this.isTrusted = false;
    }
    appendMarkdown(value) {
        this.value += value;
    }
}
exports.MarkdownString = MarkdownString;
exports.commands = {
    executeCommand: jest.fn(),
    registerCommand: jest.fn(),
};
// Mock implementation for Configuration
class Configuration {
    constructor() {
        this.config = {};
    }
    get(key, defaultValue) {
        return (this.config[key] !== undefined ? this.config[key] : defaultValue);
    }
    update(key, value, target) {
        this.config[key] = value;
        return Promise.resolve();
    }
    setConfig(config) {
        this.config = { ...config };
    }
}
exports.Configuration = Configuration;
// Setup default mock configuration
const mockConfig = new Configuration();
exports.workspace.getConfiguration = jest.fn(() => mockConfig);
exports.default = {
    workspace: exports.workspace,
    window: exports.window,
    StatusBarAlignment: exports.StatusBarAlignment,
    ConfigurationTarget: exports.ConfigurationTarget,
    ViewColumn: exports.ViewColumn,
    ThemeColor,
    MarkdownString,
    commands: exports.commands,
    Configuration: mockConfig,
};
