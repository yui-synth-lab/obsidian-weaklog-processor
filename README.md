# Obsidian Weaklog Processor

An Obsidian plugin that implements the "Minimum Protocol" for transforming personal weaknesses into creative works.

## Overview

Weaklog Processor guides you through a 5-step process:

1. **Raw Log**: Capture your feelings and thoughts without judgment
2. **Cooling Period**: Let time create emotional distance (configurable days)
3. **AI Triage**: Claude evaluates entries against 4 criteria for creative potential
4. **Synthesis**: Transform raw feelings into transferable insights with AI guidance
5. **Publishing**: Finalized content ready to share

## Features

- **AI-Powered Analysis**: Uses Claude 3.5 Sonnet for objective evaluation
- **Structured Workflow**: Organized folder structure for each stage
- **Cooldown Management**: Automatic tracking of cooling periods
- **Interactive Modals**: User-friendly interfaces for each step
- **Safe File Operations**: All operations use Obsidian's Vault API

## Installation

### Manual Installation

1. Download the latest release
2. Extract files to `{VaultFolder}/.obsidian/plugins/weaklog-processor/`
3. Reload Obsidian
4. Enable "Weaklog Processor" in Settings → Community Plugins

### Development

```bash
# Clone repository
git clone https://github.com/yui-synth-lab/obsidian-weaklog-processor.git
cd obsidian-weaklog-processor

# Install dependencies
npm install

# Build plugin
npm run build

# Or watch for changes
npm run dev
```

Copy `main.js`, `manifest.json`, and `styles.css` to your vault's plugins folder.

## Setup

1. Open Settings → Weaklog Processor
2. Enter your Anthropic API key
3. Configure default cooldown period (default: 7 days)
4. Set Weaklog folder path (default: "Weaklog")

## Usage

### Commands

- **Weaklog: Add Raw Log** - Capture a new entry
- **Weaklog: Check Cooldown** - See which entries are ready for review
- **Weaklog: Triage** - Evaluate an entry with AI assistance
- **Weaklog: Synthesize** - Transform triaged content into publishable form

### Workflow Example

1. Press `Ctrl+P` → "Weaklog: Add Raw Log"
2. Write your thoughts freely
3. Set cooldown period (or use default)
4. After cooling period, run "Weaklog: Check Cooldown"
5. Open ready entries and run "Weaklog: Triage"
6. Review AI evaluation (4 criteria, score, core question)
7. Adopt or reject based on creative potential
8. For adopted entries, run "Weaklog: Synthesize"
9. Answer AI-generated questions to refine your content
10. Edit the synthesized draft and move to Published when ready

## Folder Structure

```
Weaklog/
├── 01_Raw/              # Initial entries
├── 02_Cooling/          # Waiting for cooldown
│   └── .cooldown.json   # Cooldown state
├── 03_Triaged/          # AI-approved entries
├── 04_Synthesized/      # Transformed content
└── 05_Published/        # Final works
```

## Privacy & Security

- API keys are stored in Obsidian's encrypted data.json
- All data stays local except API requests to Anthropic
- No telemetry or tracking
- File operations use Obsidian's secure Vault API

## Triage Criteria

Claude evaluates entries on 4 dimensions:

1. **Has Specifics**: Concrete situations vs. abstract thoughts
2. **Can Be Core Phrase**: Condensable to essential question (<40 chars)
3. **Is Transferable**: Universal relevance vs. overly personal
4. **Is Non-Harmful**: Constructive, won't harm readers

Score: 0-4 (passing criteria count)
Recommendation: Adopt (4), Review (2-3), Reject (0-1)

## Development

### Project Structure

```
src/
├── main.ts                    # Plugin entry point
├── settings.ts                # Settings UI
├── types.ts                   # Type definitions
├── managers/
│   ├── FileManager.ts         # Vault operations
│   └── CooldownManager.ts     # Cooldown tracking
├── llm/
│   ├── LLMClient.ts           # Anthropic API client
│   ├── TriageAnalyzer.ts      # Step 3 logic
│   └── SynthesisGuide.ts      # Step 4 logic
├── views/
│   ├── RawLogModal.ts         # Input UI
│   ├── TriageModal.ts         # Evaluation UI
│   └── SynthesisModal.ts      # Transformation UI
└── commands/
    ├── AddRawLogCommand.ts
    ├── CheckCooldownCommand.ts
    ├── TriageCommand.ts
    └── SynthesizeCommand.ts
```

### Testing

```bash
# Type checking
npm run typecheck

# Build for production
npm run build
```

Test in Obsidian:
1. Build plugin: `npm run build`
2. Copy outputs to vault plugins folder
3. Reload Obsidian: `Ctrl+R` / `Cmd+R`
4. Check console: `Ctrl+Shift+I` / `Cmd+Option+I`

## Contributing

Contributions welcome! Please:

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests if applicable
5. Submit a pull request

## License

MIT License - see [LICENSE](LICENSE) for details

## Credits

- Built with [Obsidian Plugin API](https://docs.obsidian.md/)
- Powered by [Anthropic Claude](https://www.anthropic.com/)
- Part of the [Yui Protocol Project](https://github.com/yui-synth-lab)

## Support

- Issues: [GitHub Issues](https://github.com/yui-synth-lab/obsidian-weaklog-processor/issues)
- Documentation: [Wiki](https://github.com/yui-synth-lab/obsidian-weaklog-processor/wiki)
- Discussions: [GitHub Discussions](https://github.com/yui-synth-lab/obsidian-weaklog-processor/discussions)

## Roadmap

- [ ] Support for Gemini API
- [ ] Batch processing for multiple entries
- [ ] Custom triage criteria templates
- [ ] Export to various formats (PDF, Markdown, HTML)
- [ ] Collaborative review features
- [ ] Statistics and insights dashboard

---

**Transform your weaknesses into creative strength.**
