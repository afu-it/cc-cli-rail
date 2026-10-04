# cc-cli-rail

A vertical rail of your prompts beside the Claude Code transcript. Click a prompt to jump back to it. Hide the rail to a small button above the prompt and bring it back with one click.

## Credit

This is a fork of [prompt-rail](https://github.com/oikon48/prompt-rail) by **oikon48**, under the MIT License (see `LICENSE`). The transcript reading, reader tracking and jump logic are oikon48's work.

What changed in this fork:

- Vertical only. The horizontal band and the `mode` setting are removed.
- **Hide / show.** `» hide` at the top of the pane closes it. `« prompts (N)` above the prompt opens it again. Closing the pane from its own close mark hides it the same way. The choice is kept across sessions.
- A prompt sent mid-turn (ctrl+enter, queued) is no longer listed twice.

## Install

Inside Claude Code:

```
/plugin marketplace add afu-it/cc-cli-rail
/plugin install cc-cli-rail@afu-it
```

Or from your shell:

```bash
claude plugin marketplace add afu-it/cc-cli-rail
claude plugin install cc-cli-rail@afu-it
```

Start a new session and the rail opens by itself. If the original prompt-rail is installed, disable it (`claude plugin disable prompt-rail@oikon48`) so two rails do not open.

Needs function hooks (Claude Code 2.1.280+). If the rail does not show, add `{ "env": { "CLAUDE_CODE_ENABLE_FUNCTION_HOOKS": "1" } }` to `~/.claude/settings.json`.

## Commands

| Command | |
| --- | --- |
| `/cc-cli-rail` or `/cc-cli-rail toggle` | Hide the rail, or show it |
| `/cc-cli-rail show`, `hide` | Show or hide |
| `/cc-cli-rail next`, `prev`, `first`, `last` | Jump between prompts |
| `/cc-cli-rail 12`, `#12` | Jump to prompt #12 |
| `/cc-cli-rail find <words>` | Jump to the newest prompt holding the words |
| `/cc-cli-rail-next`, `-prev`, `-toggle` | No argument, for a keybinding |

Keybinding example (`~/.claude/keybindings.json`):

```json
{
  "bindings": [
    { "context": "Chat", "bindings": { "ctrl+k": "command:cc-cli-rail-prev", "meta+j": "command:cc-cli-rail-next" } }
  ]
}
```

## Tick legend

| Tick | Meaning |
| --- | --- |
| `━` | The prompt you are reading |
| `─` | Any other prompt |
| `┄` | A prompt Claude Code refused to scroll to; `next` and `prev` skip it |

Mouse works best with `"tui": "fullscreen"`.
