/**
 * TriageModal - Step 3 UI
 *
 * Displays AI triage results with:
 * - 4 criteria checks (pass/fail with icons)
 * - Score and recommendation
 * - Core question
 * - Three action buttons (Adopt/Review/Reject)
 */

import { App, Modal, Notice, TFile } from 'obsidian';
import { FileManager } from '../managers/FileManager';
import { CooldownManager } from '../managers/CooldownManager';
import { TriageResult } from '../types';

/**
 * TriageModal class
 * Displays triage evaluation results and handles user decisions
 */
export class TriageModal extends Modal {
  private fileManager: FileManager;
  private cooldownManager: CooldownManager;
  private file: TFile;
  private triageResult: TriageResult;

  constructor(
    app: App,
    fileManager: FileManager,
    cooldownManager: CooldownManager,
    file: TFile,
    triageResult: TriageResult
  ) {
    super(app);
    this.fileManager = fileManager;
    this.cooldownManager = cooldownManager;
    this.file = file;
    this.triageResult = triageResult;
  }

  // ========================================================================
  // Modal Lifecycle
  // ========================================================================

  /**
   * Called when modal is opened
   * Builds triage results display
   */
  onOpen(): void {
    const { contentEl } = this;
    contentEl.empty();
    contentEl.addClass('weaklog-triage-modal');

    // Header
    contentEl.createEl('h2', { text: 'Triage Results' });

    // Score and recommendation summary
    this.renderSummary(contentEl);

    // Core question
    this.renderCoreQuestion(contentEl);

    // Criteria checks
    this.renderCriteria(contentEl);

    // Action buttons
    this.renderActions(contentEl);
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
  // UI Rendering
  // ========================================================================

  /**
   * Render score and recommendation summary
   */
  private renderSummary(containerEl: HTMLElement): void {
    const summaryEl = containerEl.createDiv('weaklog-triage-summary');
    summaryEl.style.padding = '16px';
    summaryEl.style.marginBottom = '16px';
    summaryEl.style.backgroundColor = 'var(--background-secondary)';
    summaryEl.style.borderRadius = '6px';
    summaryEl.style.display = 'flex';
    summaryEl.style.justifyContent = 'space-between';
    summaryEl.style.alignItems = 'center';

    // Score
    const scoreEl = summaryEl.createDiv();
    scoreEl.createEl('div', {
      text: `Score: ${this.triageResult.score}/4`,
      cls: 'weaklog-score',
    });
    scoreEl.style.fontSize = '18px';
    scoreEl.style.fontWeight = '600';

    // Add emoji based on score
    const emoji = this.triageResult.score === 4 ? '✅' :
                  this.triageResult.score >= 2 ? '⚠️' : '❌';
    scoreEl.createEl('span', { text: ` ${emoji}` });

    // Recommendation
    const recEl = summaryEl.createDiv();
    const recText = this.triageResult.recommendation.toUpperCase();
    recEl.createEl('div', {
      text: `Recommendation: ${recText}`,
      cls: `weaklog-recommendation weaklog-rec-${this.triageResult.recommendation}`,
    });
    recEl.style.fontSize = '14px';
    recEl.style.fontWeight = '500';
    recEl.style.color = this.getRecommendationColor();
  }

  /**
   * Render core question
   */
  private renderCoreQuestion(containerEl: HTMLElement): void {
    const questionEl = containerEl.createDiv('weaklog-core-question');
    questionEl.style.padding = '12px';
    questionEl.style.marginBottom = '16px';
    questionEl.style.backgroundColor = 'var(--background-primary-alt)';
    questionEl.style.borderRadius = '4px';
    questionEl.style.borderLeft = '3px solid var(--interactive-accent)';

    questionEl.createEl('div', {
      text: 'Core Question:',
      cls: 'weaklog-label',
    }).style.fontSize = '12px';
    questionEl.querySelector('.weaklog-label')!.setAttribute('style',
      'font-size: 12px; font-weight: 600; margin-bottom: 4px; color: var(--text-muted);'
    );

    questionEl.createEl('div', {
      text: `"${this.triageResult.coreQuestion}"`,
      cls: 'weaklog-question-text',
    }).style.fontSize = '16px';
    questionEl.querySelector('.weaklog-question-text')!.setAttribute('style',
      'font-size: 16px; font-style: italic;'
    );
  }

  /**
   * Render criteria checks
   */
  private renderCriteria(containerEl: HTMLElement): void {
    const criteriaEl = containerEl.createDiv('weaklog-criteria');
    criteriaEl.style.marginBottom = '24px';

    const checks = this.triageResult.checks;
    const criteria = [
      {
        key: 'hasSpecifics',
        label: 'Has Specifics',
        check: checks.hasSpecifics,
      },
      {
        key: 'canBeCorePhrase',
        label: 'Can Be Core Phrase',
        check: checks.canBeCorePhrase,
      },
      {
        key: 'isTransferable',
        label: 'Is Transferable',
        check: checks.isTransferable,
      },
      {
        key: 'isNonHarmful',
        label: 'Is Non-Harmful',
        check: checks.isNonHarmful,
      },
    ];

    criteria.forEach((criterion) => {
      const itemEl = criteriaEl.createDiv('weaklog-criterion-item');
      itemEl.style.padding = '12px';
      itemEl.style.marginBottom = '8px';
      itemEl.style.backgroundColor = 'var(--background-secondary)';
      itemEl.style.borderRadius = '4px';
      itemEl.style.display = 'flex';
      itemEl.style.gap = '12px';

      // Icon
      const iconEl = itemEl.createDiv('weaklog-criterion-icon');
      iconEl.style.fontSize = '18px';
      iconEl.style.flexShrink = '0';
      iconEl.textContent = criterion.check.pass ? '✓' : '✗';
      iconEl.style.color = criterion.check.pass
        ? 'var(--text-success)'
        : 'var(--text-error)';

      // Content
      const contentEl = itemEl.createDiv('weaklog-criterion-content');
      contentEl.style.flex = '1';

      const labelEl = contentEl.createEl('div', {
        text: criterion.label,
        cls: 'weaklog-criterion-label',
      });
      labelEl.style.fontWeight = '600';
      labelEl.style.marginBottom = '4px';

      const reasonEl = contentEl.createEl('div', {
        text: criterion.check.reason,
        cls: 'weaklog-criterion-reason',
      });
      reasonEl.style.fontSize = '13px';
      reasonEl.style.color = 'var(--text-muted)';
    });
  }

  /**
   * Render action buttons
   */
  private renderActions(containerEl: HTMLElement): void {
    const actionsEl = containerEl.createDiv('weaklog-actions');
    actionsEl.style.display = 'flex';
    actionsEl.style.justifyContent = 'space-between';
    actionsEl.style.gap = '8px';

    // Reject button (left)
    const rejectButton = actionsEl.createEl('button', {
      text: 'Reject',
      cls: 'weaklog-button-reject',
    });
    rejectButton.style.flex = '1';
    rejectButton.addEventListener('click', () => this.handleReject());

    // Review button (center)
    const reviewButton = actionsEl.createEl('button', {
      text: 'Review Later',
      cls: 'weaklog-button-review',
    });
    reviewButton.style.flex = '1';
    reviewButton.addEventListener('click', () => this.handleReview());

    // Adopt button (right, primary)
    const adoptButton = actionsEl.createEl('button', {
      text: 'Adopt →',
      cls: 'mod-cta weaklog-button-adopt',
    });
    adoptButton.style.flex = '1';
    adoptButton.addEventListener('click', () => this.handleAdopt());
  }

  // ========================================================================
  // Action Handlers
  // ========================================================================

  /**
   * Handle "Adopt" action
   * Moves file to 03_Triaged, saves triage result, unregisters cooldown
   */
  private async handleAdopt(): Promise<void> {
    try {
      // Disable buttons
      this.setButtonsDisabled(true, 'Adopting...');

      console.log('[Weaklog] Adopting entry');

      // Save triage result to frontmatter
      await this.fileManager.updateFrontmatter(this.file, {
        triage_result: JSON.stringify(this.triageResult),
      });

      // Move to 03_Triaged
      const triagedFile = await this.fileManager.moveFile(this.file, 'triaged');

      // Unregister from cooldown
      await this.cooldownManager.unregisterEntry(this.file.basename);

      new Notice(`✓ Entry adopted: ${this.file.basename}`, 3000);
      console.log('[Weaklog] Entry adopted successfully');

      this.close();

      // Open the adopted file
      this.app.workspace.getLeaf().openFile(triagedFile);

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      console.error('[Weaklog] Failed to adopt entry:', error);
      new Notice(`❌ Failed to adopt: ${errorMessage}`, 5000);
      this.setButtonsDisabled(false);
    }
  }

  /**
   * Handle "Review Later" action
   * Simply closes modal, keeps entry in 02_Cooling
   */
  private handleReview(): void {
    console.log('[Weaklog] Entry marked for review later');
    new Notice('Entry remains in cooling for later review', 3000);
    this.close();
  }

  /**
   * Handle "Reject" action
   * Archives file, unregisters cooldown
   */
  private async handleReject(): Promise<void> {
    try {
      // Disable buttons
      this.setButtonsDisabled(true, 'Rejecting...');

      console.log('[Weaklog] Rejecting entry');

      // Save triage result before archiving (for record-keeping)
      await this.fileManager.updateFrontmatter(this.file, {
        triage_result: JSON.stringify(this.triageResult),
        status: 'rejected',
      });

      // Archive file
      await this.fileManager.archiveFile(this.file);

      // Unregister from cooldown
      await this.cooldownManager.unregisterEntry(this.file.basename);

      new Notice(`✓ Entry rejected and archived: ${this.file.basename}`, 3000);
      console.log('[Weaklog] Entry rejected and archived');

      this.close();

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      console.error('[Weaklog] Failed to reject entry:', error);
      new Notice(`❌ Failed to reject: ${errorMessage}`, 5000);
      this.setButtonsDisabled(false);
    }
  }

  // ========================================================================
  // UI Helpers
  // ========================================================================

  /**
   * Get color for recommendation badge
   */
  private getRecommendationColor(): string {
    switch (this.triageResult.recommendation) {
      case 'adopt':
        return 'var(--text-success)';
      case 'review':
        return 'var(--text-warning)';
      case 'reject':
        return 'var(--text-error)';
    }
  }

  /**
   * Disable/enable all action buttons
   * Shows loading state during async operations
   */
  private setButtonsDisabled(disabled: boolean, loadingText?: string): void {
    const buttons = this.contentEl.querySelectorAll('button');
    buttons.forEach((button) => {
      (button as HTMLButtonElement).disabled = disabled;
      if (disabled && loadingText && button.classList.contains('mod-cta')) {
        button.textContent = loadingText;
      }
    });
  }
}
