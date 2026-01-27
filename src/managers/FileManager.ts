/**
 * FileManager - Vault operations abstraction
 *
 * Handles all file operations for weaklog entries:
 * - Creation with frontmatter
 * - Movement between workflow folders
 * - Metadata updates
 * - Reading and parsing
 * - Safe archival
 *
 * CRITICAL: Always uses Obsidian Vault API, never Node.js fs
 */

import { App, TFile, Notice, normalizePath } from 'obsidian';
import { WeaklogSettings, WeaklogEntry, WeaklogStatus } from '../types';

/**
 * FileManager class
 * Provides safe, Vault-API-based file operations for weaklog entries
 */
export class FileManager {
  private app: App;
  private settings: WeaklogSettings;

  constructor(app: App, settings: WeaklogSettings) {
    this.app = app;
    this.settings = settings;
  }

  // ========================================================================
  // ID Generation
  // ========================================================================

  /**
   * Generate unique weaklog ID: YYYY-MM-DD_NNN
   * Checks existing files to find next available number for today
   *
   * @returns Unique ID string (e.g., "2026-01-27_001")
   */
  async generateWeaklogId(): Promise<string> {
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');
    const dateStr = `${year}-${month}-${day}`;

    const rawFolder = `${this.settings.weaklogFolderPath}/01_Raw`;

    // Get all markdown files in 01_Raw with today's date
    const files = this.app.vault.getMarkdownFiles().filter((f) => {
      return f.path.startsWith(rawFolder) && f.basename.startsWith(dateStr);
    });

    // Extract numbers and find max
    const numbers = files
      .map((f) => {
        const match = f.basename.match(/_(\d{3})$/);
        return match ? parseInt(match[1]) : 0;
      })
      .filter((n) => n > 0);

    const nextNum = numbers.length > 0 ? Math.max(...numbers) + 1 : 1;

    // Handle ID conflicts (shouldn't happen, but guard)
    let id = `${dateStr}_${String(nextNum).padStart(3, '0')}`;
    let attempt = 0;
    const maxAttempts = 100;

    while (attempt < maxAttempts) {
      const testPath = normalizePath(`${rawFolder}/${id}.md`);
      const exists = await this.app.vault.adapter.exists(testPath);

      if (!exists) {
        return id;
      }

      attempt++;
      const newNum = nextNum + attempt;
      id = `${dateStr}_${String(newNum).padStart(3, '0')}`;
    }

    throw new Error('Failed to generate unique weaklog ID after 100 attempts');
  }

  // ========================================================================
  // File Creation
  // ========================================================================

  /**
   * Create new raw log entry
   * Creates file in 01_Raw with frontmatter
   *
   * @param content - Raw user content
   * @param cooldownDays - Cooling period in days
   * @returns Created TFile
   */
  async createRawLog(content: string, cooldownDays: number): Promise<TFile> {
    const id = await this.generateWeaklogId();
    const createdAt = new Date().toISOString();
    const folderPath = `${this.settings.weaklogFolderPath}/01_Raw`;
    const filePath = normalizePath(`${folderPath}/${id}.md`);

    // Build frontmatter
    const frontmatter = [
      '---',
      `weaklog_id: ${id}`,
      `created: ${createdAt}`,
      `cooldown_days: ${cooldownDays}`,
      `status: raw`,
      '---',
      '',
    ].join('\n');

    const fileContent = frontmatter + content;

    try {
      const file = await this.app.vault.create(filePath, fileContent);
      console.log(`[Weaklog] Created raw log: ${filePath}`);
      return file;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      console.error('[Weaklog] Failed to create raw log:', error);
      throw new Error(`Failed to create raw log: ${errorMessage}`);
    }
  }

  // ========================================================================
  // File Movement
  // ========================================================================

  /**
   * Move file to different workflow folder
   * Updates frontmatter status and moves file atomically
   *
   * @param file - File to move
   * @param targetStatus - Target workflow status
   * @returns Moved TFile
   */
  async moveFile(file: TFile, targetStatus: WeaklogStatus): Promise<TFile> {
    const folderMap: Record<WeaklogStatus, string> = {
      raw: '01_Raw',
      cooling: '02_Cooling',
      'ready-for-triage': '02_Cooling',
      triaged: '03_Triaged',
      synthesized: '04_Synthesized',
      published: '05_Published',
    };

    const targetFolder = folderMap[targetStatus];
    if (!targetFolder) {
      throw new Error(`Invalid target status: ${targetStatus}`);
    }

    const newPath = normalizePath(
      `${this.settings.weaklogFolderPath}/${targetFolder}/${file.basename}.md`
    );

    try {
      // Update frontmatter first
      await this.updateFrontmatter(file, { status: targetStatus });

      // Check if target file already exists
      const targetExists = await this.app.vault.adapter.exists(newPath);
      if (targetExists) {
        throw new Error(`Target file already exists: ${newPath}`);
      }

      // Move file
      await this.app.fileManager.renameFile(file, newPath);
      console.log(`[Weaklog] Moved ${file.path} to ${newPath}`);

      // Get the moved file reference
      const movedFile = this.app.vault.getAbstractFileByPath(newPath);
      if (!(movedFile instanceof TFile)) {
        throw new Error('Failed to get moved file reference');
      }

      return movedFile;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      console.error('[Weaklog] Failed to move file:', error);
      throw new Error(`Failed to move file: ${errorMessage}`);
    }
  }

  // ========================================================================
  // Frontmatter Management
  // ========================================================================

  /**
   * Update frontmatter fields safely
   * Uses Obsidian's processFrontMatter for atomic updates
   *
   * @param file - File to update
   * @param updates - Object with fields to update
   */
  async updateFrontmatter(file: TFile, updates: Record<string, any>): Promise<void> {
    try {
      await this.app.fileManager.processFrontMatter(file, (frontmatter) => {
        Object.assign(frontmatter, updates);
      });
      console.log(`[Weaklog] Updated frontmatter for ${file.path}`);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      console.error('[Weaklog] Failed to update frontmatter:', error);
      throw new Error(`Failed to update frontmatter: ${errorMessage}`);
    }
  }

  // ========================================================================
  // File Reading
  // ========================================================================

  /**
   * Read weaklog entry from file
   * Parses frontmatter and content
   *
   * @param file - File to read
   * @returns WeaklogEntry or null if parsing fails
   */
  async readWeaklogEntry(file: TFile): Promise<WeaklogEntry | null> {
    try {
      const content = await this.app.vault.read(file);
      const cache = this.app.metadataCache.getFileCache(file);

      if (!cache?.frontmatter) {
        console.warn(`[Weaklog] No frontmatter in ${file.path}`);
        return null;
      }

      const fm = cache.frontmatter;

      // Validate required fields
      if (!fm.weaklog_id || !fm.created || !fm.status) {
        console.warn(`[Weaklog] Missing required frontmatter fields in ${file.path}`);
        return null;
      }

      // Extract content (everything after frontmatter)
      const contentMatch = content.match(/^---\n.*?\n---\n(.*)$/s);
      const bodyContent = contentMatch ? contentMatch[1].trim() : '';

      // Parse optional JSON fields
      let triageResult = undefined;
      if (fm.triage_result) {
        try {
          triageResult =
            typeof fm.triage_result === 'string'
              ? JSON.parse(fm.triage_result)
              : fm.triage_result;
        } catch (error) {
          console.warn(`[Weaklog] Failed to parse triage_result in ${file.path}`);
        }
      }

      let synthesisGuide = undefined;
      if (fm.synthesis_guide) {
        try {
          synthesisGuide =
            typeof fm.synthesis_guide === 'string'
              ? JSON.parse(fm.synthesis_guide)
              : fm.synthesis_guide;
        } catch (error) {
          console.warn(`[Weaklog] Failed to parse synthesis_guide in ${file.path}`);
        }
      }

      return {
        id: fm.weaklog_id,
        content: bodyContent,
        createdAt: fm.created,
        cooldownDays: fm.cooldown_days || this.settings.defaultCooldownDays,
        status: fm.status,
        triageResult,
        synthesisGuide,
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      console.error('[Weaklog] Failed to read entry:', error);
      new Notice(`Failed to read entry: ${errorMessage}`);
      return null;
    }
  }

  // ========================================================================
  // File Archival
  // ========================================================================

  /**
   * Archive file instead of deleting
   * Moves to .archived subfolder in 01_Raw
   *
   * @param file - File to archive
   */
  async archiveFile(file: TFile): Promise<void> {
    const archivePath = normalizePath(
      `${this.settings.weaklogFolderPath}/01_Raw/.archived`
    );

    try {
      // Ensure archive folder exists
      const exists = await this.app.vault.adapter.exists(archivePath);
      if (!exists) {
        await this.app.vault.createFolder(archivePath);
        console.log(`[Weaklog] Created archive folder: ${archivePath}`);
      }

      // Generate unique name if file already exists in archive
      let targetName = file.basename;
      let attempt = 0;
      const maxAttempts = 100;

      while (attempt < maxAttempts) {
        const targetPath = normalizePath(`${archivePath}/${targetName}.md`);
        const targetExists = await this.app.vault.adapter.exists(targetPath);

        if (!targetExists) {
          await this.app.fileManager.renameFile(file, targetPath);
          console.log(`[Weaklog] Archived ${file.path} to ${targetPath}`);
          return;
        }

        attempt++;
        targetName = `${file.basename}_${attempt}`;
      }

      throw new Error('Failed to find unique archive name after 100 attempts');
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      console.error('[Weaklog] Failed to archive file:', error);
      throw new Error(`Failed to archive file: ${errorMessage}`);
    }
  }

  // ========================================================================
  // Utility Methods
  // ========================================================================

  /**
   * Get all files with specific status
   * Useful for batch operations
   *
   * @param status - Status to filter by
   * @returns Array of TFiles
   */
  async getFilesByStatus(status: WeaklogStatus): Promise<TFile[]> {
    const folderMap: Record<WeaklogStatus, string> = {
      raw: '01_Raw',
      cooling: '02_Cooling',
      'ready-for-triage': '02_Cooling',
      triaged: '03_Triaged',
      synthesized: '04_Synthesized',
      published: '05_Published',
    };

    const folder = folderMap[status];
    const folderPath = `${this.settings.weaklogFolderPath}/${folder}`;

    return this.app.vault.getMarkdownFiles().filter((f) => {
      return f.path.startsWith(folderPath) && !f.path.includes('/.archived/');
    });
  }
}
