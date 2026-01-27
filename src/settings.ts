/**
 * Settings system for Obsidian Weaklog Processor
 *
 * Implements multi-tier secure API key storage:
 * 1. Environment variable (highest priority, most secure)
 * 2. Obsidian SecretStorage API (medium priority)
 * 3. data.json fallback (lowest priority, with security warnings)
 */

import { App, Notice, PluginSettingTab, Setting } from 'obsidian';
import type WeaklogPlugin from './main';
import { WeaklogSettings, SecurityStorageMethod } from './types';
import { LLMClient } from './llm/LLMClient';

// ============================================================================
// Default Settings
// ============================================================================

/**
 * Default plugin configuration
 * Used on first install or when settings are reset
 */
export const DEFAULT_SETTINGS: WeaklogSettings = {
  apiKey: '',
  defaultCooldownDays: 7,
  weaklogFolderPath: 'Weaklog',
  model: 'claude-sonnet-4-5',
  triageTemperature: 0.3,
  synthesisTemperature: 0.7,
  responseLanguage: 'english',

  // Multi-provider defaults
  llmProvider: 'anthropic',
  anthropicApiKey: '',
  openaiApiKey: '',
  geminiApiKey: '',
  ollamaEndpoint: 'http://localhost:11434',
};

// ============================================================================
// Settings Tab UI
// ============================================================================

/**
 * Settings tab for Obsidian UI
 * Provides configuration interface with security-aware API key management
 */
export class WeaklogSettingTab extends PluginSettingTab {
  plugin: WeaklogPlugin;

  constructor(app: App, plugin: WeaklogPlugin) {
    super(app, plugin);
    this.plugin = plugin;
  }

  display(): void {
    const { containerEl } = this;
    containerEl.empty();

    containerEl.createEl('h1', { text: 'Weaklog Processor Settings' });

    // ========================================================================
    // Section 1: API Configuration
    // ========================================================================

    containerEl.createEl('h2', { text: 'API Configuration' });

    // Provider selection dropdown
    new Setting(containerEl)
      .setName('LLM Provider')
      .setDesc('Choose your AI provider')
      .addDropdown((dropdown) =>
        dropdown
          .addOption('anthropic', 'Anthropic (Claude)')
          .addOption('openai', 'OpenAI (GPT)')
          .addOption('gemini', 'Google (Gemini)')
          .addOption('ollama', 'Ollama (Local)')
          .setValue(this.plugin.settings.llmProvider)
          .onChange(async (value) => {
            this.plugin.settings.llmProvider = value as any;
            await this.plugin.saveSettings();
            // Refresh UI to show/hide relevant fields
            this.display();
          })
      );

    // Conditional fields based on provider
    const provider = this.plugin.settings.llmProvider;

    // Cloud providers: API key input
    if (provider === 'anthropic' || provider === 'openai' || provider === 'gemini') {
      // Security status indicator
      this.addSecurityStatus(containerEl);

      // Provider-specific API key field
      const keyFieldName = provider === 'anthropic' ? 'Anthropic API Key' :
                           provider === 'openai' ? 'OpenAI API Key' :
                           'Gemini API Key';

      const keyFieldDesc = provider === 'anthropic' ? 'Your API key from console.anthropic.com' :
                          provider === 'openai' ? 'Your API key from platform.openai.com' :
                          'Your API key from aistudio.google.com';

      const keyFieldPlaceholder = provider === 'anthropic' ? 'sk-ant-...' :
                                 provider === 'openai' ? 'sk-...' :
                                 'AIza...';

      const currentKey = provider === 'anthropic' ? (this.plugin.settings.anthropicApiKey || this.plugin.settings.apiKey) :
                        provider === 'openai' ? this.plugin.settings.openaiApiKey :
                        this.plugin.settings.geminiApiKey;

      new Setting(containerEl)
        .setName(keyFieldName)
        .setDesc(keyFieldDesc)
        .addText((text) => {
          text
            .setPlaceholder(keyFieldPlaceholder)
            .setValue(currentKey || '')
            .onChange(async (value) => {
              const trimmedValue = value.trim();
              if (provider === 'anthropic') {
                await this.plugin.saveApiKey(trimmedValue);
                this.plugin.settings.anthropicApiKey = trimmedValue;
              } else if (provider === 'openai') {
                this.plugin.settings.openaiApiKey = trimmedValue;
              } else if (provider === 'gemini') {
                this.plugin.settings.geminiApiKey = trimmedValue;
              }
              await this.plugin.saveSettings();
            });

          // Mask API key for security
          text.inputEl.type = 'password';
        });
    }

    // Ollama: endpoint input
    if (provider === 'ollama') {
      new Setting(containerEl)
        .setName('Ollama Server Endpoint')
        .setDesc('URL of your local Ollama server')
        .addText((text) =>
          text
            .setPlaceholder('http://localhost:11434')
            .setValue(this.plugin.settings.ollamaEndpoint || 'http://localhost:11434')
            .onChange(async (value) => {
              this.plugin.settings.ollamaEndpoint = value.trim();
              await this.plugin.saveSettings();
            })
        );
    }

    // Test connection button
    const providerName = provider === 'anthropic' ? 'Anthropic' :
                        provider === 'openai' ? 'OpenAI' :
                        provider === 'gemini' ? 'Gemini' :
                        'Ollama';

    new Setting(containerEl)
      .setName('Test Connection')
      .setDesc(`Verify your connection to ${providerName}`)
      .addButton((button) =>
        button
          .setButtonText('Test Connection')
          .onClick(async () => {
            button.setButtonText('Testing...');
            button.setDisabled(true);

            try {
              // Get configuration based on provider
              let llmClient: LLMClient;

              if (provider === 'anthropic') {
                const apiKey = this.plugin.settings.anthropicApiKey || this.plugin.settings.apiKey;
                if (!apiKey) {
                  new Notice('⚠️ No API key configured', 5000);
                  return;
                }
                llmClient = LLMClient.createFromConfig('anthropic', {
                  apiKey,
                  model: this.plugin.settings.model,
                });
              } else if (provider === 'openai') {
                const apiKey = this.plugin.settings.openaiApiKey;
                if (!apiKey) {
                  new Notice('⚠️ No OpenAI API key configured', 5000);
                  return;
                }
                llmClient = LLMClient.createFromConfig('openai', {
                  apiKey,
                  model: this.plugin.settings.model,
                });
              } else if (provider === 'gemini') {
                const apiKey = this.plugin.settings.geminiApiKey;
                if (!apiKey) {
                  new Notice('⚠️ No Gemini API key configured', 5000);
                  return;
                }
                llmClient = LLMClient.createFromConfig('gemini', {
                  apiKey,
                  model: this.plugin.settings.model,
                });
              } else if (provider === 'ollama') {
                const endpoint = this.plugin.settings.ollamaEndpoint || 'http://localhost:11434';
                llmClient = LLMClient.createFromConfig('ollama', {
                  endpoint,
                  model: this.plugin.settings.model,
                });
              } else {
                new Notice('⚠️ Unknown provider', 5000);
                return;
              }

              await llmClient.testConnection();
              new Notice('✓ Connection successful!', 3000);
            } catch (error) {
              const errorMessage = error instanceof Error ? error.message : 'Unknown error';
              new Notice(`❌ Connection test failed: ${errorMessage}`, 5000);
            } finally {
              button.setButtonText('Test Connection');
              button.setDisabled(false);
            }
          })
      );

    // Security notice (cloud providers only)
    if (provider === 'anthropic' || provider === 'openai' || provider === 'gemini') {
      const securityNotice = containerEl.createDiv('weaklog-security-notice');
      securityNotice.style.padding = '12px';
      securityNotice.style.marginTop = '16px';
      securityNotice.style.backgroundColor = 'var(--background-secondary)';
      securityNotice.style.borderRadius = '6px';
      securityNotice.style.borderLeft = '3px solid var(--text-warning)';

      const noticeTitle = securityNotice.createEl('div', {
        text: '🔒 Security Best Practices',
      });
      noticeTitle.style.fontWeight = '600';
      noticeTitle.style.marginBottom = '8px';

      const noticeList = securityNotice.createEl('ul');
      noticeList.style.margin = '0';
      noticeList.style.paddingLeft = '20px';
      noticeList.style.fontSize = '0.9em';

      noticeList.createEl('li', {
        text: 'Recommended: Use environment variable WEAKLOG_API_KEY',
      });
      noticeList.createEl('li', {
        text: `Data stored locally except API requests to ${providerName}`,
      });
      noticeList.createEl('li', {
        text: 'No telemetry or analytics',
      });
    }

    // ========================================================================
    // Section 2: Workflow Settings
    // ========================================================================

    containerEl.createEl('h2', { text: 'Workflow Settings' });

    // Default cooldown days
    new Setting(containerEl)
      .setName('Default Cooldown Period')
      .setDesc('Days to wait before triage (1-365)')
      .addText((text) =>
        text
          .setPlaceholder('7')
          .setValue(String(this.plugin.settings.defaultCooldownDays))
          .onChange(async (value) => {
            const days = parseInt(value);
            if (isNaN(days) || days < 1 || days > 365) {
              new Notice('Cooldown days must be between 1 and 365', 3000);
              return;
            }
            this.plugin.settings.defaultCooldownDays = days;
            await this.plugin.saveSettings();
          })
      );

    // Weaklog folder path
    new Setting(containerEl)
      .setName('Weaklog Folder')
      .setDesc('Vault folder for weaklog files')
      .addText((text) =>
        text
          .setPlaceholder('Weaklog')
          .setValue(this.plugin.settings.weaklogFolderPath)
          .onChange(async (value) => {
            // Sanitize: remove leading/trailing slashes, no ..
            const sanitized = value.trim().replace(/^\/+|\/+$/g, '');
            if (sanitized.includes('..')) {
              new Notice('Invalid folder path: cannot contain ".."', 3000);
              return;
            }
            this.plugin.settings.weaklogFolderPath = sanitized || 'Weaklog';
            await this.plugin.saveSettings();
          })
      );

    // Reset folder structure button
    new Setting(containerEl)
      .setName('Reset Folder Structure')
      .setDesc('Recreate weaklog folders if missing')
      .addButton((button) =>
        button
          .setButtonText('Reset Folders')
          .setWarning()
          .onClick(async () => {
            try {
              await this.plugin.ensureFolderStructure();
              new Notice('✓ Folder structure reset', 3000);
            } catch (error) {
              const errorMessage = error instanceof Error ? error.message : 'Unknown error';
              new Notice(`❌ Failed to reset folders: ${errorMessage}`, 5000);
            }
          })
      );

    // ========================================================================
    // Section 3: Advanced Settings
    // ========================================================================

    containerEl.createEl('h2', { text: 'Advanced Settings' });

    // Model selection - provider-specific
    const modelFieldName = provider === 'anthropic' ? 'Claude Model' :
                          provider === 'openai' ? 'GPT Model' :
                          provider === 'gemini' ? 'Gemini Model' :
                          'Ollama Model';

    // For Ollama, dynamically fetch models from server
    if (provider === 'ollama') {
      this.addOllamaModelDropdown(containerEl, modelFieldName);
    } else {
      // Static model lists for cloud providers
      new Setting(containerEl)
        .setName(modelFieldName)
        .setDesc('Model to use for AI analysis')
        .addDropdown((dropdown) => {
          if (provider === 'anthropic') {
            dropdown
              .addOption('claude-sonnet-4-5', 'Claude 4.5 Sonnet (Recommended)')
              .addOption('claude-opus-4-5', 'Claude 4.5 Opus')
              .addOption('claude-haiku-4-5', 'Claude 4.5 Haiku')
              .addOption('claude-3-5-sonnet-20241022', 'Claude 3.5 Sonnet')
              .addOption('claude-3-opus-20240229', 'Claude 3 Opus');
          } else if (provider === 'openai') {
            dropdown
              .addOption('gpt-5.2', 'GPT-5.2 (Recommended)')
              .addOption('gpt-5', 'GPT-5')
              .addOption('gpt-5-mini', 'GPT-5 Mini')
              .addOption('gpt-4-turbo-preview', 'GPT-4 Turbo')
              .addOption('gpt-3.5-turbo', 'GPT-3.5 Turbo');
          } else if (provider === 'gemini') {
            dropdown
              .addOption('gemini-3-pro', 'Gemini 3 Pro (Recommended)')
              .addOption('gemini-3-flash', 'Gemini 3 Flash')
              .addOption('gemini-2.0-flash', 'Gemini 2.0 Flash')
              .addOption('gemini-1.5-pro', 'Gemini 1.5 Pro')
              .addOption('gemini-1.5-flash', 'Gemini 1.5 Flash');
          }

          dropdown
            .setValue(this.plugin.settings.model)
            .onChange(async (value) => {
              this.plugin.settings.model = value;
              await this.plugin.saveSettings();
            });

          return dropdown;
        });
    }

    // Triage temperature
    new Setting(containerEl)
      .setName('Triage Temperature')
      .setDesc('0.0-1.0, lower = more objective (default: 0.3)')
      .addText((text) =>
        text
          .setPlaceholder('0.3')
          .setValue(String(this.plugin.settings.triageTemperature))
          .onChange(async (value) => {
            const temp = parseFloat(value);
            if (isNaN(temp) || temp < 0 || temp > 1) {
              new Notice('Temperature must be between 0.0 and 1.0', 3000);
              return;
            }
            this.plugin.settings.triageTemperature = temp;
            await this.plugin.saveSettings();
          })
      );

    // Synthesis temperature
    new Setting(containerEl)
      .setName('Synthesis Temperature')
      .setDesc('0.0-1.0, higher = more creative (default: 0.7)')
      .addText((text) =>
        text
          .setPlaceholder('0.7')
          .setValue(String(this.plugin.settings.synthesisTemperature))
          .onChange(async (value) => {
            const temp = parseFloat(value);
            if (isNaN(temp) || temp < 0 || temp > 1) {
              new Notice('Temperature must be between 0.0 and 1.0', 3000);
              return;
            }
            this.plugin.settings.synthesisTemperature = temp;
            await this.plugin.saveSettings();
          })
      );

    // Response language
    new Setting(containerEl)
      .setName('Response Language')
      .setDesc('Language for AI responses')
      .addDropdown((dropdown) =>
        dropdown
          .addOption('english', 'English')
          .addOption('japanese', '日本語')
          .setValue(this.plugin.settings.responseLanguage)
          .onChange(async (value) => {
            this.plugin.settings.responseLanguage = value as any;
            await this.plugin.saveSettings();
          })
      );
  }

  /**
   * Add security status indicator at top of API Configuration section
   * Shows which storage method is currently active
   */
  private addSecurityStatus(containerEl: HTMLElement): void {
    const statusContainer = containerEl.createDiv('weaklog-security-status');
    statusContainer.style.padding = '8px 12px';
    statusContainer.style.marginBottom = '16px';
    statusContainer.style.backgroundColor = 'var(--background-secondary)';
    statusContainer.style.borderRadius = '4px';
    statusContainer.style.display = 'flex';
    statusContainer.style.alignItems = 'center';
    statusContainer.style.gap = '8px';

    const method = this.getStorageMethod();
    const icon = this.getSecurityIcon(method);
    const text = this.getSecurityText(method);

    statusContainer.createEl('span', { text: icon });
    statusContainer.createEl('span', {
      text: `API Key Storage: ${text}`,
    });
  }

  /**
   * Determine which storage method is currently active
   */
  private getStorageMethod(): SecurityStorageMethod {
    // Check environment variable
    if (typeof process !== 'undefined' && process.env?.WEAKLOG_API_KEY) {
      return 'environment';
    }

    // Check if SecretStorage has the key
    try {
      const adapter = this.app.vault.adapter as any;
      if (adapter.secretStorage) {
        // Note: Can't check synchronously if key exists without reading it
        // Assume 'secret' if SecretStorage is available and data.json is empty
        if (!this.plugin.settings.apiKey && adapter.secretStorage) {
          return 'secret';
        }
      }
    } catch (error) {
      // SecretStorage not available
    }

    // Fallback to data.json
    return 'data';
  }

  /**
   * Get icon for security status
   */
  private getSecurityIcon(method: SecurityStorageMethod): string {
    switch (method) {
      case 'environment':
        return '🔒';
      case 'secret':
        return '🔒';
      case 'data':
        return '⚠️';
    }
  }

  /**
   * Get human-readable text for security status
   */
  private getSecurityText(method: SecurityStorageMethod): string {
    switch (method) {
      case 'environment':
        return 'Environment Variable (Secure)';
      case 'secret':
        return 'SecretStorage API';
      case 'data':
        return 'Unencrypted (data.json)';
    }
  }

  /**
   * Add Ollama model dropdown with dynamic model loading
   * Fetches available models from Ollama server
   */
  private addOllamaModelDropdown(containerEl: HTMLElement, fieldName: string): void {
    const setting = new Setting(containerEl)
      .setName(fieldName)
      .setDesc('Loading models from Ollama server...');

    // Add dropdown with loading placeholder
    setting.addDropdown((dropdown) => {
      dropdown.addOption('', 'Loading...');
      dropdown.setValue('');
      dropdown.setDisabled(true);
      return dropdown;
    });

    // Async load models
    this.loadOllamaModels(setting);
  }

  /**
   * Load available models from Ollama server
   * Updates dropdown with fetched models or fallback list
   */
  private async loadOllamaModels(setting: Setting): Promise<void> {
    try {
      const endpoint = this.plugin.settings.ollamaEndpoint || 'http://localhost:11434';
      const llmClient = LLMClient.createFromConfig('ollama', {
        endpoint,
        model: this.plugin.settings.model,
      });

      // Fetch available models from server
      const models = await llmClient.getAvailableModels();

      // Update setting description
      setting.setDesc(`${models.length} models available from Ollama server`);

      // Remove old dropdown and add new one with models
      setting.clear();
      setting.addDropdown((dropdown) => {
        // Add all available models
        for (const model of models) {
          dropdown.addOption(model, model);
        }

        // Set current value or first model
        const currentModel = this.plugin.settings.model;
        if (models.includes(currentModel)) {
          dropdown.setValue(currentModel);
        } else if (models.length > 0) {
          dropdown.setValue(models[0]);
          this.plugin.settings.model = models[0];
          this.plugin.saveSettings();
        }

        dropdown.onChange(async (value) => {
          this.plugin.settings.model = value;
          await this.plugin.saveSettings();
        });

        return dropdown;
      });

      console.log(`[Weaklog] Loaded ${models.length} Ollama models`);

    } catch (error) {
      console.error('[Weaklog] Failed to load Ollama models:', error);

      // Fallback to common models
      const fallbackModels = [
        'llama2',
        'llama2:13b',
        'mistral',
        'mixtral',
        'codellama',
        'phi',
      ];

      setting.setDesc('⚠️ Could not connect to Ollama server. Using common models.');

      setting.clear();
      setting.addDropdown((dropdown) => {
        for (const model of fallbackModels) {
          dropdown.addOption(model, model);
        }

        dropdown.setValue(this.plugin.settings.model);
        dropdown.onChange(async (value) => {
          this.plugin.settings.model = value;
          await this.plugin.saveSettings();
        });

        return dropdown;
      });
    }
  }
}
