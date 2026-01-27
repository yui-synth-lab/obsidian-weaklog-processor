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
import { SynthesisGuide as SynthesisGuideType, TriageResult } from '../types';
import { SynthesisGuide } from '../llm/SynthesisGuide';

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
  private synthesisGuideData: SynthesisGuideType;
  private synthesisGuideInstance: SynthesisGuide;
  private triageResult: TriageResult;
  private originalContent: string;
  private answers: Map<number, string>;
  private aiSuggestedDraft: string | null;
  private suggestedDraftEl: HTMLElement | null;
  private responseLanguage: 'english' | 'japanese';

  constructor(
    app: App,
    fileManager: FileManager,
    file: TFile,
    synthesisGuideData: SynthesisGuideType,
    synthesisGuideInstance: SynthesisGuide,
    triageResult: TriageResult,
    originalContent: string,
    responseLanguage: 'english' | 'japanese' = 'english'
  ) {
    super(app);
    this.fileManager = fileManager;
    this.file = file;
    this.synthesisGuideData = synthesisGuideData;
    this.synthesisGuideInstance = synthesisGuideInstance;
    this.triageResult = triageResult;
    this.originalContent = originalContent;
    this.answers = new Map();
    this.aiSuggestedDraft = null;
    this.suggestedDraftEl = null;
    this.responseLanguage = responseLanguage;
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
      text: this.synthesisGuideData.suggestedTone,
      cls: 'weaklog-tone-value',
    }).style.fontStyle = 'italic';

    // Questions
    this.renderQuestions(contentEl);

    // AI Suggested Draft section (will be populated when generated)
    this.suggestedDraftEl = contentEl.createDiv('weaklog-suggested-draft');
    this.suggestedDraftEl.style.display = 'none';
    this.suggestedDraftEl.style.marginTop = '24px';
    this.suggestedDraftEl.style.padding = '16px';
    this.suggestedDraftEl.style.backgroundColor = 'var(--background-secondary)';
    this.suggestedDraftEl.style.borderRadius = '8px';
    this.suggestedDraftEl.style.border = '1px solid var(--background-modifier-border)';

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

    this.synthesisGuideData.questions.forEach((question, index) => {
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
    actionsEl.style.marginTop = '20px';

    // Cancel button
    const cancelButton = actionsEl.createEl('button', {
      text: 'Cancel',
      cls: 'weaklog-button-cancel',
    });
    cancelButton.style.flex = '1';
    cancelButton.addEventListener('click', () => this.close());

    // AI Suggest Draft button
    const suggestButton = actionsEl.createEl('button', {
      text: 'AI Suggest Draft',
      cls: 'weaklog-button-suggest',
    });
    suggestButton.style.flex = '1';
    suggestButton.addEventListener('click', () => this.handleSuggestDraft());

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
   * Handle "AI Suggest Draft" action
   * Generates AI-powered draft suggestion based on Q&A
   */
  private async handleSuggestDraft(): Promise<void> {
    try {
      // Validate: at least one answer required
      if (this.answers.size === 0) {
        new Notice('⚠️ Please answer at least one question first', 3000);
        return;
      }

      // Disable buttons and show loading
      this.setButtonsDisabled(true, 'Generating AI suggestion...', 'AI Suggest Draft');

      console.log(`[Weaklog] Generating AI draft suggestion with ${this.answers.size} answers`);

      // Build Q&A pairs
      const qaList: QuestionAnswer[] = [];
      this.synthesisGuideData.questions.forEach((question, index) => {
        const answer = this.answers.get(index);
        if (answer) {
          qaList.push({ question, answer });
        }
      });

      // Call AI to generate draft suggestion
      const suggestion = await this.synthesisGuideInstance.generateDraftSuggestion(
        this.originalContent,
        this.triageResult,
        qaList,
        this.responseLanguage
      );

      // Store suggestion
      this.aiSuggestedDraft = suggestion;

      // Display suggestion
      this.displaySuggestedDraft(suggestion);

      new Notice('✓ AI draft suggestion generated', 3000);
      console.log('[Weaklog] AI draft suggestion generated successfully');

      this.setButtonsDisabled(false);

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      console.error('[Weaklog] Failed to generate AI suggestion:', error);
      new Notice(`❌ Failed to generate AI suggestion: ${errorMessage}`, 5000);
      this.setButtonsDisabled(false);
    }
  }

  /**
   * Display AI suggested draft in the modal
   */
  private displaySuggestedDraft(suggestion: string): void {
    if (!this.suggestedDraftEl) return;

    this.suggestedDraftEl.empty();
    this.suggestedDraftEl.style.display = 'block';

    // Header
    const headerEl = this.suggestedDraftEl.createEl('h3', {
      text: '✨ AI Suggested Draft',
    });
    headerEl.style.marginTop = '0';
    headerEl.style.marginBottom = '12px';
    headerEl.style.color = 'var(--text-accent)';

    // Info text
    const infoEl = this.suggestedDraftEl.createDiv();
    infoEl.style.fontSize = '13px';
    infoEl.style.color = 'var(--text-muted)';
    infoEl.style.marginBottom = '12px';
    infoEl.textContent = 'This AI-generated draft will be included in your final document. You can edit it after clicking "Generate Draft".';

    // Draft content
    const contentEl = this.suggestedDraftEl.createDiv('weaklog-draft-preview');
    contentEl.style.padding = '12px';
    contentEl.style.backgroundColor = 'var(--background-primary)';
    contentEl.style.borderRadius = '4px';
    contentEl.style.border = '1px solid var(--background-modifier-border)';
    contentEl.style.whiteSpace = 'pre-wrap';
    contentEl.style.fontSize = '14px';
    contentEl.style.lineHeight = '1.6';
    contentEl.style.maxHeight = '300px';
    contentEl.style.overflowY = 'auto';
    contentEl.textContent = suggestion;
  }

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
      this.synthesisGuideData.questions.forEach((question: string, index: number) => {
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
        synthesis_guide: JSON.stringify(this.synthesisGuideData),
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

    // Include AI suggested draft if available
    if (this.aiSuggestedDraft) {
      parts.push('### AI Suggested Draft\n');
      parts.push(this.aiSuggestedDraft);
      parts.push('\n');
      parts.push('---\n');
      parts.push('');
      parts.push('### Your Edited Version\n');
      parts.push('');
      parts.push('*Edit the AI suggestion above or write your own version below...*\n');
      parts.push('');
    } else {
      parts.push('*Transform the above reflections into your final creative work...*\n');
      parts.push('');
      parts.push('<!-- Start writing your final draft here -->\n');
      parts.push('');
    }

    return parts.join('\n');
  }

  // ========================================================================
  // UI Helpers
  // ========================================================================

  /**
   * Disable/enable all action buttons
   * Shows loading state during async operations
   */
  private setButtonsDisabled(disabled: boolean, loadingText?: string, targetButtonText?: string): void {
    const buttons = this.contentEl.querySelectorAll('button');
    buttons.forEach((button) => {
      const btn = button as HTMLButtonElement;
      btn.disabled = disabled;

      // Update button text for loading state
      if (disabled && loadingText && targetButtonText && btn.textContent?.includes(targetButtonText)) {
        btn.textContent = loadingText;
      } else if (!disabled) {
        // Restore original text
        if (btn.classList.contains('weaklog-button-cancel')) {
          btn.textContent = 'Cancel';
        } else if (btn.classList.contains('weaklog-button-suggest')) {
          btn.textContent = 'AI Suggest Draft';
        } else if (btn.classList.contains('weaklog-button-generate')) {
          btn.textContent = 'Generate Draft';
        }
      }
    });
  }
}
