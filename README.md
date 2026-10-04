# cc-cli-rail

A vertical rail of your prompts beside the Claude Code transcript. Click a prompt to jump back to it. Hide the rail to a small button above the prompt and bring it back with one click.

## Credit

This is a fork of [prompt-rail](https://github.com/oikon48/prompt-rail) by **oikon48**, under the MIT License (see `LICENSE`). The transcript reading, reader tracking and jump logic are oikon48's work.

What changed in this fork:

- Vertical only. The horizontal band and the `mode` setting are removed.
- **Hide / show.** `» hide` at the top of the pane closes it. `« prompts (N)` above the prompt opens it again. Closing the pane from its own close mark hides it the same way. The choice is kept across sessions.
- A prompt sent mid-turn (ctrl+enter, queued) is no longer listed twice.

## Install

```bash
git clone https://github.com/afu-it/cc-cli-rail ~/.claude/local-plugins/cc-cli-rail
```

Then load it in every session by adding the folder to `~/.claude/settings.json`:

```json
{ "env": { "CLAUDE_CODE_PLUGIN_DIRS": "~/.claude/local-plugins/cc-cli-rail" } }
```

Or for one session: `claude --plugin-dir ~/.claude/local-plugins/cc-cli-rail`. If the original prompt-rail is installed, disable it (`claude plugin disable prompt-rail@oikon48`) so two rails do not open.

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

Needs function hooks (`CLAUDE_CODE_ENABLE_FUNCTION_HOOKS=1`, Claude Code 2.1.280+). Mouse works best with `"tui": "fullscreen"`.
