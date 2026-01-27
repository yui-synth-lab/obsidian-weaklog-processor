---
name: obsidian-plugin-dev
description: Best practices for Obsidian plugin development
---

# Obsidian Plugin Development Skill

This skill provides context and patterns for developing Obsidian plugins effectively.

## Core Patterns

### Plugin Lifecycle
```typescript
import { Plugin } from 'obsidian';

export default class MyPlugin extends Plugin {
  async onload() {
    // Register commands, UI, events
    // Load settings
    // Initialize managers
  }

  onunload() {
    // Cleanup: remove UI, unregister events
  }
}
```

### Safe File Operations
```typescript
// ✅ Correct: Use Vault API
const file = this.app.vault.getAbstractFileByPath(path);
if (file instanceof TFile) {
  const content = await this.app.vault.read(file);
  await this.app.vault.modify(file, newContent);
}

// ❌ Wrong: Never use Node.js fs
import * as fs from 'fs'; // NEVER DO THIS
```

### Frontmatter Management
```typescript
import { App, TFile } from 'obsidian';

async function updateFrontmatter(app: App, file: TFile, updates: Record<string, any>) {
  await app.fileManager.processFrontMatter(file, (frontmatter) => {
    Object.assign(frontmatter, updates);
  });
}
```

### Modal Creation
```typescript
import { Modal, App, Setting } from 'obsidian';

class MyModal extends Modal {
  constructor(app: App, private onSubmit: (result: string) => void) {
    super(app);
  }

  onOpen() {
    const { contentEl } = this;
    contentEl.createEl('h2', { text: 'Title' });

    new Setting(contentEl)
      .setName('Input')
      .addText(text => text.onChange(value => {
        // Handle input
      }));

    new Setting(contentEl)
      .addButton(btn => btn
        .setButtonText('Submit')
        .setCta()
        .onClick(() => {
          this.close();
          this.onSubmit(result);
        }));
  }

  onClose() {
    const { contentEl } = this;
    contentEl.empty();
  }
}
```

### Settings Management
```typescript
interface MyPluginSettings {
  apiKey: string;
  folderPath: string;
}

const DEFAULT_SETTINGS: MyPluginSettings = {
  apiKey: '',
  folderPath: 'MyFolder'
};

// In Plugin class:
settings: MyPluginSettings;

async onload() {
  await this.loadSettings();
  this.addSettingTab(new MySettingTab(this.app, this));
}

async loadSettings() {
  this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
}

async saveSettings() {
  await this.saveData(this.settings);
}
```

## Common Pitfalls

### Path Handling
```typescript
// ✅ Always normalize paths
import { normalizePath } from 'obsidian';
const safePath = normalizePath(userInputPath);

// ✅ Check existence before operations
const exists = await this.app.vault.adapter.exists(path);
if (!exists) {
  await this.app.vault.createFolder(path);
}
```

### File Moving
```typescript
// ✅ Correct: Use Vault API with TFile
const file = this.app.vault.getAbstractFileByPath(oldPath);
if (file instanceof TFile) {
  await this.app.fileManager.renameFile(file, newPath);
}
```

### Event Handling
```typescript
// Register events properly
this.registerEvent(
  this.app.vault.on('modify', (file) => {
    // Handle file modification
  })
);

// Events are automatically cleaned up on plugin unload
```

## Testing in Obsidian

1. Build plugin: `npm run build`
2. Copy outputs to vault: `.obsidian/plugins/your-plugin/`
   - `main.js`
   - `manifest.json`
   - `styles.css` (if exists)
3. Reload Obsidian: Ctrl+R / Cmd+R
4. Check console: Ctrl+Shift+I / Cmd+Option+I

## Performance Tips

- Cache `TFile` references when processing multiple operations
- Debounce frequent operations (file watches, input handlers)
- Use `app.metadataCache` for file metadata instead of reading full file
- Batch file operations when possible

## Security

- Validate all user inputs before file operations
- Sanitize file names: no `..`, absolute paths, or special chars
- Never execute user-provided code
- API keys: stored in `data.json` (handled by Obsidian)

## Useful APIs

- `this.app.vault`: File operations
- `this.app.workspace`: UI and view management
- `this.app.metadataCache`: File metadata and links
- `this.app.fileManager`: Advanced file operations
- `this.addCommand()`: Register commands
- `this.registerEvent()`: Subscribe to events
- `new Notice(message)`: Show notifications

## Resources

- Official API: https://docs.obsidian.md/
- Plugin examples: https://github.com/obsidianmd/obsidian-sample-plugin
- Community plugins: https://github.com/obsidianmd/obsidian-releases
