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
import { FileManager } from './managers/FileManager';
import { CooldownManager } from './managers/CooldownManager';
import { LLMClient } from './llm/LLMClient';
import { TriageAnalyzer } from './llm/TriageAnalyzer';
import { SynthesisGuide } from './llm/SynthesisGuide';
import { RawLogModal } from './views/RawLogModal';
import { TriageModal } from './views/TriageModal';
import { SynthesisModal } from './views/SynthesisModal';

/**
 * Main plugin class for Weaklog Processor
 * Extends Obsidian's Plugin base class
 */
export default class WeaklogPlugin extends Plugin {
  settings!: WeaklogSettings;
  fileManager!: FileManager;
  cooldownManager!: CooldownManager;

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

    // Initialize managers
    this.fileManager = new FileManager(this.app, this.settings);
    this.cooldownManager = new CooldownManager(this.app, this.settings);

    // Register settings tab
    this.addSettingTab(new WeaklogSettingTab(this.app, this));

    // Register commands
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

  /**
   * Get configured LLM client based on current provider settings
   * Supports environment variable WEAKLOG_API_KEY for all providers
   *
   * Priority for API keys:
   * 1. Environment variable WEAKLOG_API_KEY (highest priority)
   * 2. Provider-specific settings (anthropicApiKey, openaiApiKey, etc.)
   * 3. Legacy apiKey field (Anthropic only)
   *
   * @returns Configured and initialized LLMClient
   * @throws Error if provider not configured or API key missing
   */
  async getLLMClient(): Promise<LLMClient> {
    const provider = this.settings.llmProvider;

    // Check environment variable first (universal for all providers)
    const envKey = typeof process !== 'undefined' && process.env?.WEAKLOG_API_KEY
      ? process.env.WEAKLOG_API_KEY
      : null;

    let llmClient: LLMClient;

    switch (provider) {
      case 'anthropic': {
        const apiKey = envKey || this.settings.anthropicApiKey || this.settings.apiKey;
        if (!apiKey) {
          throw new Error('Anthropic API key not configured. Please set WEAKLOG_API_KEY environment variable or configure in settings.');
        }
        llmClient = LLMClient.createFromConfig('anthropic', {
          apiKey,
          model: this.settings.model,
        });
        break;
      }

      case 'openai': {
        const apiKey = envKey || this.settings.openaiApiKey;
        if (!apiKey) {
          throw new Error('OpenAI API key not configured. Please set WEAKLOG_API_KEY environment variable or configure in settings.');
        }
        llmClient = LLMClient.createFromConfig('openai', {
          apiKey,
          model: this.settings.model,
        });
        break;
      }

      case 'gemini': {
        const apiKey = envKey || this.settings.geminiApiKey;
        if (!apiKey) {
          throw new Error('Gemini API key not configured. Please set WEAKLOG_API_KEY environment variable or configure in settings.');
        }
        llmClient = LLMClient.createFromConfig('gemini', {
          apiKey,
          model: this.settings.model,
        });
        break;
      }

      case 'ollama': {
        const endpoint = this.settings.ollamaEndpoint || 'http://localhost:11434';
        llmClient = LLMClient.createFromConfig('ollama', {
          endpoint,
          model: this.settings.model,
        });
        break;
      }

      default:
        throw new Error(`Unknown LLM provider: ${provider}`);
    }

    // Initialize the client
    llmClient.initialize();

    if (envKey) {
      console.log(`[Weaklog] Using ${provider} provider with environment variable WEAKLOG_API_KEY`);
    } else {
      console.log(`[Weaklog] Using ${provider} provider with settings-based configuration`);
    }

    return llmClient;
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
   * Implements full workflow commands
   */
  private registerCommands(): void {
    // Command 1: Add Raw Log (Step 1)
    this.addCommand({
      id: 'weaklog:add-raw',
      name: 'Add Raw Log',
      callback: () => {
        const modal = new RawLogModal(
          this.app,
          this.fileManager,
          this.cooldownManager,
          this.settings
        );
        modal.open();
      },
    });

    // Command 2: Check Cooldown Status (Step 2)
    this.addCommand({
      id: 'weaklog:check-cooldown',
      name: 'Check Cooldown Status',
      callback: async () => {
        await this.cooldownManager.checkCooldownStatus();
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
            this.handleTriageCommand(file);
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
            this.handleSynthesizeCommand(file);
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
            this.handlePublishCommand(file);
          }
          return true;
        }
        return false;
      },
    });

    console.log('[Weaklog] Commands registered');
  }

  // ========================================================================
  // Command Handlers
  // ========================================================================

  /**
   * Handle triage command
   * Analyzes entry with AI and displays results in TriageModal
   */
  private async handleTriageCommand(file: any): Promise<void> {
    try {
      // Read entry
      const entry = await this.fileManager.readWeaklogEntry(file);
      if (!entry) {
        new Notice('❌ Failed to read entry', 3000);
        return;
      }

      // Show loading notice
      const loadingNotice = new Notice('🤖 Analyzing entry with AI...', 0);

      try {
        // Get configured LLM client
        const llmClient = await this.getLLMClient();

        // Analyze with triage
        const analyzer = new TriageAnalyzer(llmClient, this.settings.triageTemperature);
        const triageResult = await analyzer.analyzeEntry(entry.content);

        // Hide loading notice
        loadingNotice.hide();

        // Open triage modal
        const modal = new TriageModal(
          this.app,
          this.fileManager,
          this.cooldownManager,
          file,
          triageResult
        );
        modal.open();

      } catch (error) {
        loadingNotice.hide();
        throw error;
      }

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      console.error('[Weaklog] Triage command failed:', error);
      new Notice(`❌ Triage failed: ${errorMessage}`, 5000);
    }
  }

  /**
   * Handle synthesize command
   * Generates AI questions and opens SynthesisModal for transformation
   */
  private async handleSynthesizeCommand(file: any): Promise<void> {
    try {
      // Read entry
      const entry = await this.fileManager.readWeaklogEntry(file);
      if (!entry) {
        new Notice('❌ Failed to read entry', 3000);
        return;
      }

      // Validate triage result exists
      if (!entry.triageResult) {
        new Notice('❌ Entry has no triage result. Please triage first.', 5000);
        console.error('[Weaklog] Synthesize attempted on entry without triage result');
        return;
      }

      // Show loading notice
      const loadingNotice = new Notice('🤖 Generating synthesis questions...', 0);

      try {
        // Get configured LLM client
        const llmClient = await this.getLLMClient();

        // Generate synthesis questions
        const synthesisGuide = new SynthesisGuide(llmClient, this.settings.synthesisTemperature);
        const guide = await synthesisGuide.generateQuestions(
          entry.content,
          entry.triageResult
        );

        // Hide loading notice
        loadingNotice.hide();

        // Open synthesis modal
        const modal = new SynthesisModal(
          this.app,
          this.fileManager,
          file,
          guide,
          entry.triageResult,
          entry.content
        );
        modal.open();

      } catch (error) {
        loadingNotice.hide();
        throw error;
      }

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      console.error('[Weaklog] Synthesize command failed:', error);
      new Notice(`❌ Synthesis failed: ${errorMessage}`, 5000);
    }
  }

  /**
   * Handle publish command
   * Finalizes entry and moves to 05_Published folder
   */
  private async handlePublishCommand(file: any): Promise<void> {
    try {
      console.log('[Weaklog] Publishing entry');

      // Update frontmatter with published status and timestamp
      await this.fileManager.updateFrontmatter(file, {
        published_at: new Date().toISOString(),
      });

      // Move to 05_Published
      const publishedFile = await this.fileManager.moveFile(file, 'published');

      new Notice(`✓ Entry published: ${file.basename}`, 3000);
      console.log('[Weaklog] Entry published successfully');

      // Open the published file
      this.app.workspace.getLeaf().openFile(publishedFile);

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      console.error('[Weaklog] Publish command failed:', error);
      new Notice(`❌ Failed to publish: ${errorMessage}`, 5000);
    }
  }
}
