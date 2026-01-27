/**
 * Main plugin entry point for Obsidian Weaklog Processor
 *
 * Implements the plugin lifecycle and coordinates all components:
 * - Settings management with secure API key storage
 * - Folder structure initialization
 * - Command registration (Phase 2)
 */

import { Notice, Plugin, normalizePath } from 'obsidian';
import { WeaklogSettings } from './types';
import { DEFAULT_SETTINGS, WeaklogSettingTab } from './settings';

/**
 * Main plugin class for Weaklog Processor
 * Extends Obsidian's Plugin base class
 */
export default class WeaklogPlugin extends Plugin {
  settings!: WeaklogSettings;

  /**
   * Called when plugin is loaded
   * Initializes settings, folder structure, and registers commands
   */
  async onload(): Promise<void> {
    console.log('[Weaklog] Loading plugin v1.0.0');

    // Load settings from data.json
    await this.loadSettings();

    // Ensure weaklog folder structure exists
    await this.ensureFolderStructure();

    // Register settings tab
    this.addSettingTab(new WeaklogSettingTab(this.app, this));

    // Register commands (stubs for Phase 2)
    this.registerCommands();

    console.log('[Weaklog] Plugin loaded successfully');
  }

  /**
   * Called when plugin is unloaded
   * Cleanup if needed
   */
  async onunload(): Promise<void> {
    console.log('[Weaklog] Unloading plugin');
  }

  // ========================================================================
  // Settings Management
  // ========================================================================

  /**
   * Load settings from data.json
   * Merges with defaults for any missing values
   */
  async loadSettings(): Promise<void> {
    this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
  }

  /**
   * Save settings to data.json
   */
  async saveSettings(): Promise<void> {
    await this.saveData(this.settings);
  }

  // ========================================================================
  // Secure API Key Management
  // ========================================================================

  /**
   * Get API key with priority-based approach:
   * 1. Environment variable (WEAKLOG_API_KEY) - highest priority
   * 2. Obsidian SecretStorage API - medium priority
   * 3. data.json - lowest priority (fallback)
   *
   * @returns API key or null if not configured
   */
  async getApiKey(): Promise<string | null> {
    // Priority 1: Check environment variable first
    if (typeof process !== 'undefined' && process.env?.WEAKLOG_API_KEY) {
      console.log('[Weaklog] Using API key from environment variable');
      return process.env.WEAKLOG_API_KEY;
    }

    // Priority 2: Try SecretStorage if available
    try {
      const adapter = this.app.vault.adapter as any;
      if (adapter.secretStorage) {
        const key = await adapter.secretStorage.getSecret('weaklog-anthropic-api-key');
        if (key) {
          console.log('[Weaklog] Using API key from SecretStorage');
          return key;
        }
      }
    } catch (error) {
      console.warn('[Weaklog] SecretStorage not available:', error);
    }

    // Priority 3: Fallback to settings data.json
    if (this.settings.apiKey) {
      console.log('[Weaklog] Using API key from settings (unencrypted)');
      return this.settings.apiKey;
    }

    return null;
  }

  /**
   * Save API key with secure storage preference:
   * 1. Try SecretStorage first (if available)
   * 2. Fallback to data.json with warning
   *
   * @param apiKey - The API key to save
   */
  async saveApiKey(apiKey: string): Promise<void> {
    // Try SecretStorage first
    try {
      const adapter = this.app.vault.adapter as any;
      if (adapter.secretStorage) {
        await adapter.secretStorage.setSecret('weaklog-anthropic-api-key', apiKey);

        // Clear from data.json if migrating from old storage
        if (this.settings.apiKey) {
          this.settings.apiKey = '';
          await this.saveSettings();
        }

        new Notice('🔒 API key saved securely (SecretStorage)');
        console.log('[Weaklog] API key saved to SecretStorage');
        return;
      }
    } catch (error) {
      console.warn('[Weaklog] Could not use SecretStorage:', error);
    }

    // Fallback to data.json with warning
    this.settings.apiKey = apiKey;
    await this.saveSettings();
    new Notice('⚠️ API key saved (unencrypted). For better security, use environment variable WEAKLOG_API_KEY');
    console.log('[Weaklog] API key saved to data.json (unencrypted)');
  }

  // ========================================================================
  // Folder Structure Management
  // ========================================================================

  /**
   * Ensure weaklog folder structure exists
   * Creates: 01_Raw, 02_Cooling, 03_Triaged, 04_Synthesized, 05_Published
   * Idempotent: safe to call multiple times
   */
  async ensureFolderStructure(): Promise<void> {
    const basePath = this.settings.weaklogFolderPath;

    const folders = [
      basePath,
      `${basePath}/01_Raw`,
      `${basePath}/02_Cooling`,
      `${basePath}/03_Triaged`,
      `${basePath}/04_Synthesized`,
      `${basePath}/05_Published`,
    ];

    for (const folder of folders) {
      const normalizedPath = normalizePath(folder);

      try {
        const exists = await this.app.vault.adapter.exists(normalizedPath);

        if (!exists) {
          await this.app.vault.createFolder(normalizedPath);
          console.log(`[Weaklog] Created folder: ${normalizedPath}`);
        }
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        console.error(`[Weaklog] Failed to create folder ${normalizedPath}:`, error);
        new Notice(`Failed to create weaklog folder: ${folder} (${errorMessage})`);
        throw error; // Re-throw to prevent plugin from loading with incomplete structure
      }
    }

    console.log('[Weaklog] Folder structure verified');
  }

  // ========================================================================
  // Command Registration
  // ========================================================================

  /**
   * Register all plugin commands
   * Full implementation in Phase 2
   */
  private registerCommands(): void {
    // Command 1: Add Raw Log (Step 1)
    this.addCommand({
      id: 'weaklog:add-raw',
      name: 'Add Raw Log',
      callback: () => {
        new Notice('Command not yet implemented (Phase 2)');
      },
    });

    // Command 2: Check Cooldown Status (Step 2)
    this.addCommand({
      id: 'weaklog:check-cooldown',
      name: 'Check Cooldown Status',
      callback: () => {
        new Notice('Command not yet implemented (Phase 2)');
      },
    });

    // Command 3: Triage Entry (Step 3)
    this.addCommand({
      id: 'weaklog:triage',
      name: 'Triage Entry',
      checkCallback: (checking: boolean) => {
        const file = this.app.workspace.getActiveFile();

        // Only available if active file is in 02_Cooling
        if (file && file.path.includes('/02_Cooling/')) {
          if (!checking) {
            new Notice('Command not yet implemented (Phase 2)');
          }
          return true;
        }
        return false;
      },
    });

    // Command 4: Synthesize Entry (Step 4)
    this.addCommand({
      id: 'weaklog:synthesize',
      name: 'Synthesize Entry',
      checkCallback: (checking: boolean) => {
        const file = this.app.workspace.getActiveFile();

        // Only available if active file is in 03_Triaged
        if (file && file.path.includes('/03_Triaged/')) {
          if (!checking) {
            new Notice('Command not yet implemented (Phase 2)');
          }
          return true;
        }
        return false;
      },
    });

    // Command 5: Publish Entry (Step 5)
    this.addCommand({
      id: 'weaklog:publish',
      name: 'Publish Entry',
      checkCallback: (checking: boolean) => {
        const file = this.app.workspace.getActiveFile();

        // Only available if active file is in 04_Synthesized
        if (file && file.path.includes('/04_Synthesized/')) {
          if (!checking) {
            new Notice('Command not yet implemented (Phase 2)');
          }
          return true;
        }
        return false;
      },
    });

    console.log('[Weaklog] Commands registered (stubs)');
  }
}
