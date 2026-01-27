# Obsidian Weaklog Processor

## Project Overview
An Obsidian plugin implementing the "Minimum Protocol" for transforming personal weaknesses into creative works through a 5-step process: Raw input, Cooling period, AI-powered Triage, Synthesis guidance, and Publishing.

**Target**: Obsidian v1.4.0+
**Core Technology**: TypeScript, Obsidian Plugin API, Anthropic Claude API

## Architecture

### Folder Structure (in Vault)
```
Weaklog/
├── 01_Raw/              # Step 1: Initial capture
├── 02_Cooling/          # Step 2: Time-based waiting
│   └── .cooldown.json   # Cooldown state management
├── 03_Triaged/          # Step 3: AI-filtered entries
├── 04_Synthesized/      # Step 4: Transformed content
└── 05_Published/        # Step 5: Final output
```

### Plugin Structure
```
src/
├── main.ts                    # Entry point, plugin lifecycle
├── settings.ts                # Settings UI and persistence
├── types.ts                   # Shared type definitions
├── managers/
│   ├── FileManager.ts         # All Vault operations (CRUD, move, metadata)
│   └── CooldownManager.ts     # .cooldown.json read/write, time checks
├── llm/
│   ├── LLMClient.ts           # Anthropic API abstraction
│   ├── TriageAnalyzer.ts      # Step 3: 4-criteria evaluation
│   └── SynthesisGuide.ts      # Step 4: Question generation
├── views/
│   ├── RawLogModal.ts         # Step 1: Input UI
│   ├── TriageModal.ts         # Step 3: AI result display
│   └── SynthesisModal.ts      # Step 4: Interactive Q&A
└── commands/
    ├── AddRawLogCommand.ts
    ├── CheckCooldownCommand.ts
    ├── TriageCommand.ts
    └── SynthesizeCommand.ts
```

## Code Style

### TypeScript
- Use strict mode (`"strict": true` in tsconfig.json)
- Prefer `interface` over `type` for object shapes
- Use ES modules (`import/export`), never `require`
- Explicit return types for all public methods
- Destructure imports: `import { TFile, Notice } from 'obsidian'`

### Naming Conventions
- Files: PascalCase for classes (`FileManager.ts`), camelCase for utilities
- Classes: PascalCase (`CooldownManager`)
- Methods/Variables: camelCase (`getCooldownStatus`)
- Constants: UPPER_SNAKE_CASE (`TRIAGE_PROMPT`)
- File IDs: `YYYY-MM-DD_NNN` format (e.g., `2026-01-27_001`)

### Error Handling
- Always use `try/catch` for file operations and API calls
- Show user-friendly errors via Obsidian's `Notice` class
- Log detailed errors to console: `console.error('[Weaklog]', error)`
- Never silently fail: either notify user or log error

## Obsidian-Specific Rules

### File Operations
- ALWAYS use `this.app.vault` methods, never Node.js `fs`
- Check file existence before operations: `await this.app.vault.adapter.exists(path)`
- Use `TFile` and `TFolder` types from Obsidian API
- Normalize paths with `normalizePath()` from `obsidian-normalizePath`

### Metadata Management
- Store metadata in YAML frontmatter at file top
- Update frontmatter via `this.app.fileManager.processFrontMatter()`
- Required fields: `weaklog_id`, `created`, `cooldown_days`, `status`

### UI Components
- Extend `Modal` for all dialogs
- Use `Setting` class for forms (see [Obsidian API docs](https://docs.obsidian.md/))
- Call `new Notice(message, duration)` for notifications
- Modal cleanup: always call `this.close()` in button handlers

### Command Registration
```typescript
this.addCommand({
  id: 'weaklog:add-raw',
  name: 'Add Raw Log',
  callback: () => { /* ... */ }
});
```

## LLM Integration

### API Configuration
- **Provider**: Anthropic (Claude 3.5 Sonnet)
- **Model**: `claude-3-5-sonnet-20241022`
- **API Key**: User-provided in settings (never hardcode)
- **Timeout**: 30s for triage, 20s for synthesis

### Prompt Guidelines
- Use structured JSON output for parsing AI responses
- Include clear output format examples in prompts
- Temperature: 0.3 for triage (objectivity), 0.7 for synthesis (creativity)
- Max tokens: 1000 for triage, 500 for synthesis
- Handle API failures gracefully: offer manual fallback

### Triage Criteria (4 checks)
1. **hasSpecifics**: Concrete situations, not abstract
2. **canBeCorePhrase**: Condensable to one question (<40 chars)
3. **isTransferable**: Universal, not overly personal
4. **isNonHarmful**: Constructive, non-harmful to reader

## Workflow

### Development
```bash
# Install dependencies
npm install

# Build plugin (outputs to main.js)
npm run build

# Watch mode for development
npm run dev

# Type checking
npm run typecheck
```

### Testing Workflow
1. Build plugin: `npm run build`
2. Copy `main.js`, `manifest.json`, `styles.css` to Obsidian vault's `.obsidian/plugins/weaklog-processor/`
3. Reload Obsidian: Ctrl+R (Windows/Linux) or Cmd+R (Mac)
4. Enable plugin in Settings > Community Plugins

### Git Workflow
- Commit messages: `<type>: <description>` (e.g., `feat: add triage modal`)
- Types: `feat`, `fix`, `refactor`, `docs`, `test`, `chore`
- Always test in Obsidian before committing functional changes

## Important Notes

### Data Safety
- NEVER delete files without user confirmation
- Archive rejected files to `01_Raw/.archived/` instead of deleting
- Backup `.cooldown.json` before writes

### Performance
- Avoid reading all files at once; process iteratively
- Cache frequently accessed data (e.g., cooldown status)
- Debounce user input in modals (300ms)

### Security
- Validate all user inputs before file operations
- Sanitize file names (no `..`, `/`, `\`)
- Never execute user-provided code
- API keys stored in Obsidian's data.json (encrypted by Obsidian)

## API References
- [Obsidian Plugin API](https://docs.obsidian.md/)
- [Anthropic API Docs](https://docs.anthropic.com/en/api/)
- [TypeScript Handbook](https://www.typescriptlang.org/docs/)

## Do NOT Include
- Standard TypeScript conventions (Claude already knows these)
- Detailed API documentation (link to docs instead)
- Implementation details of individual functions (these belong in code comments)
- Temporary notes or TODO lists (use issues or separate files)
