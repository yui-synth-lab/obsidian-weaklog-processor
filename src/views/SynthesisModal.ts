/**
 * SynthesisModal - Step 4 UI
 *
 * Displays AI-generated synthesis questions with:
 * - 3-5 deepening questions from SynthesisGuide
 * - Textarea for each answer
 * - "Generate Draft" button
 * - Creates synthesized document in 04_Synthesized
 */

import { App, Modal, Notice, TFile } from 'obsidian';
import { FileManager } from '../managers/FileManager';
import { SynthesisGuide, TriageResult } from '../types';

/**
 * Answer data structure for internal use
 */
interface QuestionAnswer {
  question: string;
  answer: string;
}

/**
 * SynthesisModal class
 * Guides user through synthesis transformation with AI-generated questions
 */
export class SynthesisModal extends Modal {
  private fileManager: FileManager;
  private file: TFile;
  private synthesisGuide: SynthesisGuide;
  private triageResult: TriageResult;
  private originalContent: string;
  private answers: Map<number, string>;

  constructor(
    app: App,
    fileManager: FileManager,
    file: TFile,
    synthesisGuide: SynthesisGuide,
    triageResult: TriageResult,
    originalContent: string
  ) {
    super(app);
    this.fileManager = fileManager;
    this.file = file;
    this.synthesisGuide = synthesisGuide;
    this.triageResult = triageResult;
    this.originalContent = originalContent;
    this.answers = new Map();
  }

  // ========================================================================
  // Modal Lifecycle
  // ========================================================================

  /**
   * Called when modal is opened
   * Builds synthesis questions UI
   */
  onOpen(): void {
    const { contentEl } = this;
    contentEl.empty();
    contentEl.addClass('weaklog-synthesis-modal');

    // Header
    contentEl.createEl('h2', { text: 'Synthesis Questions' });

    // Description
    const descEl = contentEl.createDiv('weaklog-synthesis-description');
    descEl.style.marginBottom = '20px';
    descEl.style.color = 'var(--text-muted)';
    descEl.style.fontSize = '14px';
    descEl.createEl('p', {
      text: 'Answer these questions to transform your entry into a transferable creative work. You can skip questions, but at least one answer is required.',
    });

    // Suggested tone
    const toneEl = contentEl.createDiv('weaklog-synthesis-tone');
    toneEl.style.padding = '8px 12px';
    toneEl.style.marginBottom = '20px';
    toneEl.style.backgroundColor = 'var(--background-secondary)';
    toneEl.style.borderRadius = '4px';
    toneEl.style.fontSize = '13px';
    toneEl.createEl('strong', { text: 'Suggested tone: ' });
    toneEl.createEl('span', {
      text: this.synthesisGuide.suggestedTone,
      cls: 'weaklog-tone-value',
    }).style.fontStyle = 'italic';

    // Questions
    this.renderQuestions(contentEl);

    // Actions
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
   * Render synthesis questions with textareas
   */
  private renderQuestions(containerEl: HTMLElement): void {
    const questionsEl = containerEl.createDiv('weaklog-synthesis-questions');
    questionsEl.style.marginBottom = '24px';

    this.synthesisGuide.questions.forEach((question, index) => {
      const questionEl = questionsEl.createDiv('weaklog-synthesis-question');
      questionEl.style.marginBottom = '20px';

      // Question label
      const labelEl = questionEl.createEl('label', {
        text: `Question ${index + 1}`,
        cls: 'weaklog-question-label',
      });
      labelEl.style.display = 'block';
      labelEl.style.fontWeight = '600';
      labelEl.style.marginBottom = '8px';
      labelEl.style.color = 'var(--text-normal)';

      // Question text
      const questionTextEl = questionEl.createDiv('weaklog-question-text');
      questionTextEl.style.marginBottom = '8px';
      questionTextEl.style.padding = '8px';
      questionTextEl.style.backgroundColor = 'var(--background-primary-alt)';
      questionTextEl.style.borderRadius = '4px';
      questionTextEl.style.fontSize = '14px';
      questionTextEl.style.fontStyle = 'italic';
      questionTextEl.textContent = question;

      // Answer textarea
      const textareaEl = questionEl.createEl('textarea', {
        cls: 'weaklog-answer-textarea',
      }) as HTMLTextAreaElement;
      textareaEl.placeholder = 'Your answer...';
      textareaEl.rows = 4;
      textareaEl.style.width = '100%';
      textareaEl.style.padding = '8px';
      textareaEl.style.fontSize = '14px';
      textareaEl.style.fontFamily = 'inherit';
      textareaEl.style.resize = 'vertical';

      // Save answer on input
      textareaEl.addEventListener('input', () => {
        const value = textareaEl.value.trim();
        if (value.length > 0) {
          this.answers.set(index, value);
        } else {
          this.answers.delete(index);
        }
      });
    });
  }

  /**
   * Render action buttons
   */
  private renderActions(containerEl: HTMLElement): void {
    const actionsEl = containerEl.createDiv('weaklog-synthesis-actions');
    actionsEl.style.display = 'flex';
    actionsEl.style.justifyContent = 'space-between';
    actionsEl.style.gap = '8px';

    // Cancel button
    const cancelButton = actionsEl.createEl('button', {
      text: 'Cancel',
      cls: 'weaklog-button-cancel',
    });
    cancelButton.style.flex = '1';
    cancelButton.addEventListener('click', () => this.close());

    // Generate Draft button (primary)
    const generateButton = actionsEl.createEl('button', {
      text: 'Generate Draft',
      cls: 'mod-cta weaklog-button-generate',
    });
    generateButton.style.flex = '1';
    generateButton.addEventListener('click', () => this.handleGenerateDraft());
  }

  // ========================================================================
  // Action Handlers
  // ========================================================================

  /**
   * Handle "Generate Draft" action
   * Validates answers, creates draft document, moves to 04_Synthesized
   */
  private async handleGenerateDraft(): Promise<void> {
    try {
      // Validate: at least one answer required
      if (this.answers.size === 0) {
        new Notice('⚠️ Please answer at least one question', 3000);
        return;
      }

      // Disable buttons
      this.setButtonsDisabled(true, 'Generating...');

      console.log(`[Weaklog] Generating synthesis draft with ${this.answers.size} answers`);

      // Build Q&A pairs
      const qaList: QuestionAnswer[] = [];
      this.synthesisGuide.questions.forEach((question, index) => {
        const answer = this.answers.get(index);
        if (answer) {
          qaList.push({ question, answer });
        }
      });

      // Generate draft content
      const draftContent = this.buildDraftContent(qaList);

      // Update file content
      await this.app.vault.modify(this.file, draftContent);

      // Update frontmatter with synthesis guide
      await this.fileManager.updateFrontmatter(this.file, {
        synthesis_guide: JSON.stringify(this.synthesisGuide),
      });

      // Move to 04_Synthesized
      const synthesizedFile = await this.fileManager.moveFile(this.file, 'synthesized');

      new Notice(`✓ Synthesis draft generated: ${this.file.basename}`, 3000);
      console.log('[Weaklog] Synthesis draft generated successfully');

      this.close();

      // Open the synthesized file
      this.app.workspace.getLeaf().openFile(synthesizedFile);

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      console.error('[Weaklog] Failed to generate draft:', error);
      new Notice(`❌ Failed to generate draft: ${errorMessage}`, 5000);
      this.setButtonsDisabled(false);
    }
  }

  // ========================================================================
  // Draft Generation
  // ========================================================================

  /**
   * Build draft markdown content
   * Includes original entry, Q&A pairs, and editable draft section
   *
   * @param qaList - Question-answer pairs
   * @returns Formatted markdown content
   */
  private buildDraftContent(qaList: QuestionAnswer[]): string {
    const parts: string[] = [];

    // Title
    parts.push('# Synthesis Draft\n');

    // Original entry section
    parts.push('## Original Entry\n');
    parts.push(`> ${this.originalContent.split('\n').join('\n> ')}\n`);
    parts.push('');

    // Core question from triage
    parts.push('## Core Question\n');
    parts.push(`> ${this.triageResult.coreQuestion}\n`);
    parts.push('');

    // Q&A section
    parts.push('## Synthesis Questions & Answers\n');
    qaList.forEach((qa, index) => {
      parts.push(`### Q${index + 1}: ${qa.question}\n`);
      parts.push(`${qa.answer}\n`);
      parts.push('');
    });

    parts.push('---\n');
    parts.push('');

    // Editable draft section
    parts.push('## Draft Content (Edit Below)\n');
    parts.push('');
    parts.push('*Transform the above reflections into your final creative work...*\n');
    parts.push('');
    parts.push('<!-- Start writing your final draft here -->\n');
    parts.push('');

    return parts.join('\n');
  }

  // ========================================================================
  // UI Helpers
  // ========================================================================

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
