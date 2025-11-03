// Mock VS Code API for testing
export const workspace = {
  getConfiguration: jest.fn(),
  onDidChangeConfiguration: jest.fn(),
};

export const window = {
  createStatusBarItem: jest.fn(),
  showInformationMessage: jest.fn(),
  showWarningMessage: jest.fn(),
  showErrorMessage: jest.fn(),
  createQuickPick: jest.fn(),
  createWebviewPanel: jest.fn(),
};

export const StatusBarAlignment = {
  Left: 1,
  Right: 2,
};

export const ConfigurationTarget = {
  Global: 1,
  Workspace: 2,
  WorkspaceFolder: 3,
};

export const ViewColumn = {
  Beside: 2,
};

export class ThemeColor {
  constructor(public id: string) {}
}

export class MarkdownString {
  public value: string = '';
  public isTrusted: boolean = false;

  appendMarkdown(value: string): void {
    this.value += value;
  }
}

export const commands = {
  executeCommand: jest.fn(),
  registerCommand: jest.fn(),
};

// Mock implementation for Configuration
export class Configuration {
  private config: Record<string, any> = {};

  get<T>(key: string, defaultValue?: T): T {
    return (this.config[key] !== undefined ? this.config[key] : defaultValue) as T;
  }

  update(key: string, value: any, target?: number): Promise<void> {
    this.config[key] = value;
    return Promise.resolve();
  }

  setConfig(config: Record<string, any>): void {
    this.config = { ...config };
  }
}

// Setup default mock configuration
const mockConfig = new Configuration();
workspace.getConfiguration = jest.fn(() => mockConfig);

export default {
  workspace,
  window,
  StatusBarAlignment,
  ConfigurationTarget,
  ViewColumn,
  ThemeColor,
  MarkdownString,
  commands,
  Configuration: mockConfig,
};

