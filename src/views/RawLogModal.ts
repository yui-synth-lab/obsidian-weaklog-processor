/**
 * RawLogModal - Step 1 UI
 *
 * Modal for capturing raw log entries:
 * - Multiline textarea for content
 * - Cooldown days configuration
 * - Validation and submission
 * - Creates file in 01_Raw, moves to 02_Cooling
 */

import { App, Modal, Notice, Setting } from 'obsidian';
import { FileManager } from '../managers/FileManager';
import { CooldownManager } from '../managers/CooldownManager';
import { WeaklogSettings } from '../types';

/**
 * RawLogModal class
 * Provides UI for Step 1: Raw log capture
 */
export class RawLogModal extends Modal {
  private fileManager: FileManager;
  private cooldownManager: CooldownManager;
  private settings: WeaklogSettings;
  private contentTextarea: HTMLTextAreaElement | null = null;
  private cooldownInput: HTMLInputElement | null = null;

  constructor(
    app: App,
    fileManager: FileManager,
    cooldownManager: CooldownManager,
    settings: WeaklogSettings
  ) {
    super(app);
    this.fileManager = fileManager;
    this.cooldownManager = cooldownManager;
    this.settings = settings;
  }

  // ========================================================================
  // Modal Lifecycle
  // ========================================================================

  /**
   * Called when modal is opened
   * Builds UI and sets up event handlers
   */
  onOpen(): void {
    const { contentEl } = this;
    contentEl.empty();
    contentEl.addClass('weaklog-raw-modal');

    // Header
    contentEl.createEl('h2', { text: 'Add Raw Log' });

    // Description
    const desc = contentEl.createEl('p', {
      text: 'Capture your feelings without judgment. This is a safe space for raw, unfiltered thoughts.',
    });
    desc.style.marginBottom = '16px';
    desc.style.color = 'var(--text-muted)';

    // Content textarea
    const contentSetting = new Setting(contentEl)
      .setName('Content')
      .setDesc('Write freely. No editing, no judging. (Minimum 10 characters)');

    const textareaContainer = contentSetting.controlEl.createDiv();
    this.contentTextarea = textareaContainer.createEl('textarea', {
      placeholder: 'Today I felt...\n\nOr: I noticed...\n\nOr: Something that bothered me was...',
    });

    this.contentTextarea.style.width = '100%';
    this.contentTextarea.style.minHeight = '200px';
    this.contentTextarea.style.resize = 'vertical';
    this.contentTextarea.style.fontFamily = 'var(--font-text)';
    this.contentTextarea.style.fontSize = '14px';
    this.contentTextarea.style.padding = '8px';
    this.contentTextarea.style.border = '1px solid var(--background-modifier-border)';
    this.contentTextarea.style.borderRadius = '4px';
    this.contentTextarea.style.backgroundColor = 'var(--background-primary)';

    // Auto-focus textarea
    setTimeout(() => this.contentTextarea?.focus(), 100);

    // Cooldown days input
    new Setting(contentEl)
      .setName('Cooldown Period')
      .setDesc('Days to wait before triage (1-365)')
      .addText((text) => {
        this.cooldownInput = text.inputEl;
        text
          .setValue(String(this.settings.defaultCooldownDays))
          .setPlaceholder(String(this.settings.defaultCooldownDays));
        text.inputEl.type = 'number';
        text.inputEl.min = '1';
        text.inputEl.max = '365';
        text.inputEl.style.width = '80px';
      });

    // Buttons
    const buttonContainer = contentEl.createDiv();
    buttonContainer.style.marginTop = '24px';
    buttonContainer.style.display = 'flex';
    buttonContainer.style.justifyContent = 'flex-end';
    buttonContainer.style.gap = '8px';

    // Cancel button
    const cancelButton = buttonContainer.createEl('button', { text: 'Cancel' });
    cancelButton.addEventListener('click', () => this.close());

    // Create button
    const createButton = buttonContainer.createEl('button', {
      text: 'Create Log',
      cls: 'mod-cta',
    });
    createButton.addEventListener('click', () => this.handleSubmit());

    // Enter key submits (Ctrl+Enter or Cmd+Enter)
    this.contentTextarea.addEventListener('keydown', (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
        e.preventDefault();
        this.handleSubmit();
      }
    });
  }

  /**
   * Called when modal is closed
   * Cleanup
   */
  onClose(): void {
    const { contentEl } = this;
    contentEl.empty();
  }

  // ========================================================================
  // Form Handling
  // ========================================================================

  /**
   * Handle form submission
   * Validates input and creates raw log entry
   */
  private async handleSubmit(): Promise<void> {
    const content = this.contentTextarea?.value.trim() || '';
    const cooldownDays = parseInt(this.cooldownInput?.value || '7');

    // Validation
    if (!this.validateInput(content, cooldownDays)) {
      return;
    }

    try {
      // Disable button during processing
      const createButton = this.contentEl.querySelector('.mod-cta') as HTMLButtonElement;
      if (createButton) {
        createButton.disabled = true;
        createButton.textContent = 'Creating...';
      }

      // Create file in 01_Raw
      console.log('[Weaklog] Creating raw log entry');
      const file = await this.fileManager.createRawLog(content, cooldownDays);

      // Move to 02_Cooling
      console.log('[Weaklog] Moving to cooling folder');
      const coolingFile = await this.fileManager.moveFile(file, 'cooling');

      // Register for cooldown tracking
      console.log('[Weaklog] Registering cooldown');
      await this.cooldownManager.registerEntry(coolingFile, cooldownDays);

      // Success notification
      new Notice(`✓ Raw log created: ${file.basename}`, 3000);
      console.log(`[Weaklog] Raw log workflow complete: ${file.basename}`);

      // Close modal
      this.close();

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      console.error('[Weaklog] Failed to create raw log:', error);
      new Notice(`❌ Failed to create log: ${errorMessage}`, 5000);

      // Re-enable button
      const createButton = this.contentEl.querySelector('.mod-cta') as HTMLButtonElement;
      if (createButton) {
        createButton.disabled = false;
        createButton.textContent = 'Create Log';
      }
    }
  }

  /**
   * Validate form input
   * Checks content length and cooldown days range
   *
   * @param content - Entry content
   * @param cooldownDays - Cooldown period
   * @returns true if valid
   */
  private validateInput(content: string, cooldownDays: number): boolean {
    // Check content length
    if (content.length === 0) {
      new Notice('⚠️ Content cannot be empty', 3000);
      this.contentTextarea?.focus();
      return false;
    }

    if (content.length < 10) {
      new Notice('⚠️ Content must be at least 10 characters', 3000);
      this.contentTextarea?.focus();
      return false;
    }

    // Check cooldown days
    if (isNaN(cooldownDays) || cooldownDays < 1 || cooldownDays > 365) {
      new Notice('⚠️ Cooldown days must be between 1 and 365', 3000);
      this.cooldownInput?.focus();
      return false;
    }

    return true;
  }

  // ========================================================================
  // Public API
  // ========================================================================

  /**
   * Open modal with optional pre-filled content
   * Useful for testing or external integrations
   *
   * @param content - Optional pre-filled content
   */
  openWithContent(content?: string): void {
    this.open();
    if (content && this.contentTextarea) {
      this.contentTextarea.value = content;
    }
  }
}
