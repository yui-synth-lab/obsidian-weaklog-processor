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
  model: 'claude-3-5-sonnet-20241022',
  triageTemperature: 0.3,
  synthesisTemperature: 0.7,
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

    // Security status indicator
    this.addSecurityStatus(containerEl);

    // API Key input
    new Setting(containerEl)
      .setName('Anthropic API Key')
      .setDesc('Your API key from console.anthropic.com')
      .addText((text) => {
        text
          .setPlaceholder('sk-ant-...')
          .setValue(this.plugin.settings.apiKey)
          .onChange(async (value) => {
            await this.plugin.saveApiKey(value.trim());
          });

        // Mask API key for security
        text.inputEl.type = 'password';
      });

    // Test connection button
    new Setting(containerEl)
      .setName('Test API Connection')
      .setDesc('Verify your API key works with Anthropic')
      .addButton((button) =>
        button
          .setButtonText('Test Connection')
          .onClick(async () => {
            button.setButtonText('Testing...');
            button.setDisabled(true);

            try {
              const apiKey = await this.plugin.getApiKey();
              if (!apiKey) {
                new Notice('⚠️ No API key configured', 5000);
                return;
              }

              // Note: Actual test will be implemented in Phase 2 with LLMClient
              // For now, just check if key exists
              new Notice('✓ API key configured (full test available after Phase 2)', 3000);
            } catch (error) {
              const errorMessage = error instanceof Error ? error.message : 'Unknown error';
              new Notice(`❌ Connection test failed: ${errorMessage}`, 5000);
            } finally {
              button.setButtonText('Test Connection');
              button.setDisabled(false);
            }
          })
      );

    // Security notice
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
      text: 'Data stored locally except API requests to Anthropic',
    });
    noticeList.createEl('li', {
      text: 'No telemetry or analytics',
    });

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

    // Model selection
    new Setting(containerEl)
      .setName('Claude Model')
      .setDesc('Model to use for AI analysis')
      .addDropdown((dropdown) =>
        dropdown
          .addOption('claude-3-5-sonnet-20241022', 'Claude 3.5 Sonnet (Recommended)')
          .addOption('claude-3-opus-20240229', 'Claude 3 Opus')
          .addOption('claude-3-sonnet-20240229', 'Claude 3 Sonnet')
          .setValue(this.plugin.settings.model)
          .onChange(async (value) => {
            this.plugin.settings.model = value;
            await this.plugin.saveSettings();
          })
      );

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
}
