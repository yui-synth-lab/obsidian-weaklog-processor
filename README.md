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

- **Multi-LLM Provider Support**: Choose from Anthropic (Claude), OpenAI (GPT), or Google (Gemini)
- **AI-Powered Analysis**: Objective evaluation with state-of-the-art language models
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
pnpm install

# Build plugin
pnpm run build

# Or watch for changes
pnpm run dev
```

Copy `main.js`, `manifest.json`, and `styles.css` to your vault's plugins folder.

## Setup

1. Open Settings → Weaklog Processor
2. **Choose your LLM provider** (Anthropic, OpenAI, or Gemini)
3. **Configure provider credentials**: Enter your API key for the selected provider
4. Configure default cooldown period (default: 7 days)
5. Set Weaklog folder path (default: "Weaklog")

See [LLM Provider Configuration](#llm-provider-configuration) for detailed setup instructions.

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

### API Key Storage

Weaklog Processor implements a **3-tier security approach** for API key storage:

1. **Environment Variable** (Highest Security) - **Recommended**
   - Set `WEAKLOG_API_KEY` environment variable
   - Key never stored in vault files
   - Ideal for sensitive environments

2. **Obsidian SecretStorage API** (Medium Security)
   - Uses Obsidian's built-in SecretStorage when available
   - Automatically used if environment variable not set

3. **data.json Fallback** (Lowest Security)
   - Unencrypted storage in vault plugins folder
   - Used only when other methods unavailable
   - Warning displayed in settings

**Security Status Indicator**: Settings UI shows which method is active (🔒 secure / ⚠️ unencrypted)

### Environment Variable Setup

**Windows (PowerShell)**:

```powershell
# Temporary (current session)
$env:WEAKLOG_API_KEY="sk-ant-..."

# Permanent (system-wide)
[System.Environment]::SetEnvironmentVariable("WEAKLOG_API_KEY", "sk-ant-...", "User")
```

**macOS/Linux (Bash/Zsh)**:

```bash
# Temporary (current session)
export WEAKLOG_API_KEY="sk-ant-..."

# Permanent (add to ~/.bashrc or ~/.zshrc)
echo 'export WEAKLOG_API_KEY="sk-ant-..."' >> ~/.bashrc
source ~/.bashrc
```

**After setting environment variable**: Restart Obsidian to detect it.

## LLM Provider Configuration

Weaklog Processor supports multiple AI providers, giving you flexibility to choose based on your preferences, budget, or privacy requirements.

### Supported Providers

| Provider | Type | Best For | API Key Required |
| -------- | ---- | -------- | ---------------- |
| **Anthropic (Claude)** | Cloud | Most balanced, strong reasoning | Yes |
| **OpenAI (GPT)** | Cloud | Fast, widely adopted | Yes |
| **Google (Gemini)** | Cloud | Multimodal capabilities | Yes |

### How to Switch Providers

1. Open **Settings → Weaklog Processor**
2. Under **API Configuration**, select your desired provider from the **LLM Provider** dropdown
3. The UI will automatically update to show relevant configuration fields
4. Enter your credentials (API key for cloud providers, endpoint for Ollama)
5. Click **Test Connection** to verify setup
6. Adjust the model selection in **Advanced Settings** if needed

### Provider-Specific Setup

#### Anthropic (Claude)

**Get API Key**: <https://console.anthropic.com/>

**Recommended Models**:

- `claude-sonnet-4-5` (Default, best balance)
- `claude-opus-4-5` (Highest quality, slower)
- `claude-haiku-4-5` (Fastest, most economical)

**Environment Variable**:

```bash
export WEAKLOG_API_KEY="sk-ant-..."
```

#### OpenAI (GPT)

**Get API Key**: <https://platform.openai.com/>

**Recommended Models**:

- `gpt-5.2` (Default, best quality)
- `gpt-5` (Stable, reliable)
- `gpt-5-mini` (Fast, economical)

**Environment Variable**:

```bash
export WEAKLOG_API_KEY="sk-..."
```

#### Google (Gemini)

**Get API Key**: <https://aistudio.google.com/>

**Recommended Models**:

- `gemini-3-pro-preview` (Default, best quality)
- `gemini-3-flash-preview` (Faster, lower cost)
- `gemini-2.0-flash` (Standard/Previous Gen)

**Environment Variable**:

```bash
export WEAKLOG_API_KEY="AIza..."
```

### Universal Environment Variable

All providers can use the **same environment variable** `WEAKLOG_API_KEY`:

```bash
# Works for any cloud provider (Anthropic, OpenAI, Gemini)
export WEAKLOG_API_KEY="your-api-key-here"
```

When you switch providers in settings, the plugin will automatically use `WEAKLOG_API_KEY` if set, falling back to provider-specific settings if the environment variable is not available.

**Priority**:

1. Environment variable `WEAKLOG_API_KEY` (highest)
2. Provider-specific setting (medium)
3. Legacy `apiKey` setting for Anthropic (lowest)

### Cost Comparison

Approximate costs per 1M tokens (as of 2026):

| Provider | Input | Output | Notes |
| -------- | ----- | ------ | ----- |
| Claude Sonnet 4.5 | Check Site | Check Site | Recommended |
| GPT-5.2 | Check Site | Check Site | Flagship |
| GPT-5 Mini | Check Site | Check Site | Most economical |
| Gemini 3 Pro | Check Site | Check Site | Competitive |

**Note**: Typical triage uses ~500-1000 tokens, synthesis uses ~1000-2000 tokens.

### Data Privacy



- **Local-First Architecture**: All weaklog entries stay in your vault
- **API Usage**: Only entry content sent to Anthropic for analysis (no metadata)
- **No Telemetry**: Zero analytics, tracking, or data collection
- **Secure Operations**: All file operations use Obsidian's Vault API
- **Anthropic Privacy**: See [Anthropic Privacy Policy](https://www.anthropic.com/privacy)

### Security Best Practices

1. **Use Environment Variable**: Recommended for maximum security
2. **Don't Commit .obsidian**: Add `.obsidian/` to `.gitignore` if syncing vault
3. **Rotate API Keys**: Periodically regenerate keys at console.anthropic.com
4. **Monitor Usage**: Check API usage in Anthropic console
5. **Test Connection**: Use "Test API Connection" button in settings to verify

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
pnpm run typecheck

# Build for production
pnpm run build
```

Test in Obsidian:
1. Build plugin: `pnpm run build`
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

- [x] Multi-LLM provider support (Anthropic, OpenAI, Gemini)
- [ ] Batch processing for multiple entries
- [ ] Custom triage criteria templates
- [ ] Export to various formats (PDF, Markdown, HTML)
- [ ] Collaborative review features
- [ ] Statistics and insights dashboard

---

**Transform your weaknesses into creative strength.**
