/**
 * CooldownManager - Temporal workflow logic
 *
 * Manages cooldown tracking for weaklog entries:
 * - Reads and writes .cooldown.json
 * - Registers new entries with cooldown periods
 * - Tracks which entries are ready for triage
 * - Provides user notifications for ready entries
 *
 * Data stored in: Weaklog/02_Cooling/.cooldown.json
 */

import { App, TFile, Notice, normalizePath } from 'obsidian';
import { WeaklogSettings, CooldownData, CooldownEntry } from '../types';

/**
 * CooldownManager class
 * Handles time-based workflow management for weaklog entries
 */
export class CooldownManager {
  private app: App;
  private cooldownFilePath: string;

  constructor(app: App, settings: WeaklogSettings) {
    this.app = app;
    this.cooldownFilePath = normalizePath(
      `${settings.weaklogFolderPath}/02_Cooling/.cooldown.json`
    );
  }

  // ========================================================================
  // Data Loading
  // ========================================================================

  /**
   * Load cooldown data from .cooldown.json
   * Handles missing or corrupted file gracefully
   *
   * @returns CooldownData with entries array
   */
  private async loadCooldownData(): Promise<CooldownData> {
    try {
      const exists = await this.app.vault.adapter.exists(this.cooldownFilePath);

      if (!exists) {
        console.log('[Weaklog] No cooldown file found, returning empty data');
        return {
          entries: [],
          lastChecked: new Date().toISOString(),
        };
      }

      const content = await this.app.vault.adapter.read(this.cooldownFilePath);
      const data = JSON.parse(content) as CooldownData;

      // Validate structure
      if (!data.entries || !Array.isArray(data.entries)) {
        console.warn('[Weaklog] Invalid cooldown data structure, resetting');
        return {
          entries: [],
          lastChecked: new Date().toISOString(),
        };
      }

      return data;
    } catch (error) {
      console.error('[Weaklog] Failed to load cooldown data:', error);
      // Return empty data instead of throwing
      return {
        entries: [],
        lastChecked: new Date().toISOString(),
      };
    }
  }

  // ========================================================================
  // Data Saving
  // ========================================================================

  /**
   * Save cooldown data to .cooldown.json
   * Creates backup before writing
   *
   * @param data - CooldownData to save
   */
  private async saveCooldownData(data: CooldownData): Promise<void> {
    try {
      // Backup existing file
      const exists = await this.app.vault.adapter.exists(this.cooldownFilePath);
      if (exists) {
        const content = await this.app.vault.adapter.read(this.cooldownFilePath);
        const backupPath = this.cooldownFilePath.replace('.json', '.backup.json');
        await this.app.vault.adapter.write(backupPath, content);
        console.log('[Weaklog] Created cooldown backup');
      }

      // Write new data
      const jsonStr = JSON.stringify(data, null, 2);
      await this.app.vault.adapter.write(this.cooldownFilePath, jsonStr);

      console.log('[Weaklog] Saved cooldown data');
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      console.error('[Weaklog] Failed to save cooldown data:', error);
      throw new Error(`Failed to save cooldown data: ${errorMessage}`);
    }
  }

  // ========================================================================
  // Entry Registration
  // ========================================================================

  /**
   * Register new entry for cooldown tracking
   * Calculates readyAt timestamp based on cooldownDays
   *
   * @param file - File to register
   * @param cooldownDays - Number of days to cool down
   */
  async registerEntry(file: TFile, cooldownDays: number): Promise<void> {
    const data = await this.loadCooldownData();
    const createdAt = new Date().toISOString();

    // Calculate readyAt timestamp
    const createdDate = new Date();
    const readyDate = new Date(createdDate);
    readyDate.setDate(readyDate.getDate() + cooldownDays);
    const readyAt = readyDate.toISOString();

    const entry: CooldownEntry = {
      weaklogId: file.basename,
      filePath: file.path,
      createdAt,
      cooldownDays,
      readyAt,
    };

    // Remove existing entry if present (update scenario)
    data.entries = data.entries.filter((e) => e.weaklogId !== file.basename);

    // Add new entry
    data.entries.push(entry);
    data.lastChecked = new Date().toISOString();

    await this.saveCooldownData(data);
    console.log(`[Weaklog] Registered cooldown for ${file.basename}`);
  }

  // ========================================================================
  // Entry Unregistration
  // ========================================================================

  /**
   * Unregister entry after it's been processed
   * Call this after triaging or rejecting an entry
   *
   * @param weaklogId - ID of entry to unregister
   */
  async unregisterEntry(weaklogId: string): Promise<void> {
    const data = await this.loadCooldownData();
    const originalLength = data.entries.length;

    data.entries = data.entries.filter((e) => e.weaklogId !== weaklogId);
    data.lastChecked = new Date().toISOString();

    await this.saveCooldownData(data);

    if (data.entries.length < originalLength) {
      console.log(`[Weaklog] Unregistered cooldown for ${weaklogId}`);
    } else {
      console.warn(`[Weaklog] Entry ${weaklogId} not found in cooldown data`);
    }
  }

  // ========================================================================
  // Ready Entry Detection
  // ========================================================================

  /**
   * Get entries ready for triage
   * Filters by readyAt <= now
   *
   * @returns Array of ready CooldownEntries
   */
  async getReadyEntries(): Promise<CooldownEntry[]> {
    const data = await this.loadCooldownData();
    const now = new Date();

    return data.entries.filter((entry) => {
      const readyAt = new Date(entry.readyAt);
      return readyAt <= now;
    });
  }

  // ========================================================================
  // User-Facing Status Check
  // ========================================================================

  /**
   * Check cooldown status and notify user
   * Main public API called by command
   * Shows notice with count of ready entries
   */
  async checkCooldownStatus(): Promise<void> {
    const ready = await this.getReadyEntries();

    if (ready.length === 0) {
      new Notice('No entries ready for triage yet', 3000);
      console.log('[Weaklog] No entries ready for triage');
      return;
    }

    // Build notification message
    const message =
      ready.length === 1
        ? `1 entry is ready for triage: ${ready[0].weaklogId}`
        : `${ready.length} entries are ready for triage`;

    new Notice(message, 5000);

    // Log details to console for debugging
    console.log('[Weaklog] Ready entries:', ready);
  }

  // ========================================================================
  // Admin/Debug Methods
  // ========================================================================

  /**
   * Get all entries (for debugging/admin)
   * Returns both ready and not-ready entries
   *
   * @returns Array of all CooldownEntries
   */
  async getAllEntries(): Promise<CooldownEntry[]> {
    const data = await this.loadCooldownData();
    return data.entries;
  }

  /**
   * Get count of entries currently in cooldown
   * Useful for statistics
   *
   * @returns Number of tracked entries
   */
  async getEntryCount(): Promise<number> {
    const data = await this.loadCooldownData();
    return data.entries.length;
  }

  /**
   * Clear all cooldown entries
   * Use with caution - mainly for testing/reset
   */
  async clearAllEntries(): Promise<void> {
    const data: CooldownData = {
      entries: [],
      lastChecked: new Date().toISOString(),
    };

    await this.saveCooldownData(data);
    console.log('[Weaklog] Cleared all cooldown entries');
  }

  // ========================================================================
  // Data Validation
  // ========================================================================

  /**
   * Validate and clean cooldown data
   * Removes entries with missing files or invalid dates
   * Returns count of cleaned entries
   */
  async validateAndCleanData(): Promise<number> {
    const data = await this.loadCooldownData();
    const originalLength = data.entries.length;

    // Filter out entries with invalid data or missing files
    const validEntries: CooldownEntry[] = [];

    for (const entry of data.entries) {
      // Validate required fields
      if (!entry.weaklogId || !entry.filePath || !entry.readyAt) {
        console.warn(`[Weaklog] Removing invalid entry: ${JSON.stringify(entry)}`);
        continue;
      }

      // Validate date format
      if (isNaN(Date.parse(entry.readyAt))) {
        console.warn(`[Weaklog] Removing entry with invalid date: ${entry.weaklogId}`);
        continue;
      }

      // Check if file still exists
      const fileExists = await this.app.vault.adapter.exists(
        normalizePath(entry.filePath)
      );
      if (!fileExists) {
        console.warn(
          `[Weaklog] Removing entry for missing file: ${entry.weaklogId}`
        );
        continue;
      }

      validEntries.push(entry);
    }

    // Save cleaned data
    data.entries = validEntries;
    data.lastChecked = new Date().toISOString();
    await this.saveCooldownData(data);

    const removed = originalLength - validEntries.length;
    if (removed > 0) {
      console.log(`[Weaklog] Cleaned ${removed} invalid cooldown entries`);
    }

    return removed;
  }
}
