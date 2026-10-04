import { test, expect, mock } from 'claude-code/testing'
import { drawnRow, jumpNotice, noteScroll, pickPrompt, register, rowKey, stepFrom, tick, turnLine } from './index.tsx'

const SURFACES = ['terminal', 'desktop'] as const

// The pane's rows less its own hide button, which leads them.
const jumpButtons = (nodes: any[]) => nodes.filter(node => node.key !== 'rail-hide')

const prompt = (text: string, onScreen: { first: number; last: number; of: number } | null) => ({
  text,
  origin: { kind: 'composer' as const },
  isExpanded: false,
  onScreen,
})

const pane = (placement: 'dock' | 'inline', bodyColumns = placement === 'dock' ? 4 : 60) => ({
  title: 'Prompts',
  isFocused: false,
  bodyColumns,
  placement,
  scroll: { offset: 0, bodyRows: 20 },
  view: {},
})

test('the terminal dock draws a tick per prompt, other seats draw the text, presses route', async ($, on) => {
  const toasts: string[] = []
  on('ui.toast', ($, e) => {
    toasts.push(e.text)
  })
  // Stand in for the engine's own drawing of a prompt row.
  on('ui.render', { component: 'UserMessage' }, ($, e) => {
    const { Text } = $.ui.resolve(e)
    return <Text>{e.props.text}</Text>
  })

  await $.ui.mount({ plugin: 'cc-cli-rail', surface: 'terminal', component: 'UserMessage', requestId: 'm1', props: prompt('first prompt', null) })
  await $.ui.mount({ plugin: 'cc-cli-rail', surface: 'terminal', component: 'UserMessage', requestId: 'm2', props: prompt('second prompt', { first: 0, last: 3, of: 4 }) })

  const rail = await $.ui.mount({ plugin: 'cc-cli-rail', surface: 'terminal', component: 'Pane', requestId: 'cc-cli-rail', props: pane('dock') })
  expect(jumpButtons(await rail.findAll({ type: 'Button' })).map(b => b.props.label)).toEqual([' ─ ', ' ━ '])
  expect((await rail.press({ key: 'jump-1' }))?.element).toBe('jump-1')
  await rail.unmount()

  // The desktop has no band to reveal a card in, so its dock lists the text.
  const desktopDock = await $.ui.mount({ plugin: 'cc-cli-rail', surface: 'desktop', component: 'Pane', requestId: 'cc-cli-rail', props: pane('dock', 40) })
  expect(jumpButtons(await desktopDock.findAll({ type: 'Button' })).map(b => b.props.label)).toEqual(['─ first prompt', '━ second prompt'])
  expect((await desktopDock.press({ key: 'jump-1' }))?.element).toBe('jump-1')
  await desktopDock.unmount()

  for (const surface of SURFACES) {
    const list = await $.ui.mount({ plugin: 'cc-cli-rail', surface, component: 'Pane', requestId: 'cc-cli-rail', props: pane('inline') })
    expect(jumpButtons(await list.findAll({ type: 'Button' })).map(b => b.props.label)).toEqual(['─ first prompt', '━ second prompt'])
    await list.unmount()
  }
})

const BAND = { hasSurvey: false, isWorking: false, maxRows: 10, bodyColumns: 80, scroll: { offset: 0, bodyRows: 10 }, view: {} }

const drawPrompts = async ($: any, on: any) => {
  on('ui.render', { component: 'UserMessage' }, ($: any, e: any) => {
    const { Text } = $.ui.resolve(e)
    return <Text>{e.props.text}</Text>
  })
  // Stand in for the engine's empty band when the plugin passes it on.
  on('ui.render', { component: 'AbovePrompt' }, ($: any, e: any) => {
    const { Box } = $.ui.resolve(e)
    return <Box />
  })
  mock.store(on)
  on('ui.open', () => ({ value: { isPlaced: true } }))
  on('ui.close', () => ({ value: undefined }))
  on('ui.toast', () => {})
  await $.ui.mount({ plugin: 'cc-cli-rail', surface: 'terminal', component: 'UserMessage', requestId: 'm1', props: prompt('first prompt', null) })
  await $.ui.mount({ plugin: 'cc-cli-rail', surface: 'terminal', component: 'UserMessage', requestId: 'm2', props: prompt('second prompt', { first: 0, last: 3, of: 4 }) })
}

// The pane as the terminal docks it, wide enough to show each prompt's text.
const dock = ($: any, props = pane('dock', 40)) =>
  $.ui.mount({ plugin: 'cc-cli-rail', surface: 'terminal', component: 'Pane', requestId: 'cc-cli-rail', props })

// Which of the pane's prompts is drawn as being read (` ━`); -1 for none.
const heavyIn = async (site: any) =>
  jumpButtons(await site.findAll({ type: 'Button' })).findIndex((b: any) => String(b.props.label).startsWith(' ━'))

test('a narrow vertical rail leaves the prompt text to hidden cards in the band', async ($, on) => {
  await drawPrompts($, on)
  await $.ui.mount({ plugin: 'cc-cli-rail', surface: 'terminal', component: 'Pane', requestId: 'cc-cli-rail', props: pane('dock', 4) })
  const band = await $.ui.mount({ plugin: 'cc-cli-rail', surface: 'terminal', component: 'AbovePrompt', props: BAND })
  expect((await band.find({ key: 'card-0' }))?.props.display).toBe('none')
  expect(await band.find({ type: 'Text', text: /first prompt/ })).toBeDefined()
})

test('a wide vertical rail shows each prompt beside its tick and keeps the band empty', async ($, on) => {
  await drawPrompts($, on)
  const rail = await $.ui.mount({ plugin: 'cc-cli-rail', surface: 'terminal', component: 'Pane', requestId: 'cc-cli-rail', props: pane('dock', 37) })
  expect(jumpButtons(await rail.findAll({ type: 'Button' })).map(b => b.props.label)).toEqual([' ─ first prompt', ' ━ second prompt'])
  const band = await $.ui.mount({ plugin: 'cc-cli-rail', surface: 'terminal', component: 'AbovePrompt', props: BAND })
  expect(await band.find({ key: 'card-0' })).toBeUndefined()
})

test('wide characters are cut by the cells they take', async ($, on) => {
  await drawPrompts($, on)
  await $.ui.mount({ plugin: 'cc-cli-rail', surface: 'terminal', component: 'UserMessage', requestId: 'm3', props: prompt('日本語のプロンプト', null) })
  const rail = await $.ui.mount({ plugin: 'cc-cli-rail', surface: 'terminal', component: 'Pane', requestId: 'cc-cli-rail', props: pane('dock', 12) })
  expect(jumpButtons(await rail.findAll({ type: 'Button' })).map(b => b.props.label)[2]).toBe(' ─ 日本語…')
})

test('with no prompt on screen no row is drawn as being read', async ($, on) => {
  on('ui.render', { component: 'UserMessage' }, ($: any, e: any) => {
    const { Text } = $.ui.resolve(e)
    return <Text>{e.props.text}</Text>
  })
  mock.store(on)
  on('ui.open', () => ({ value: { isPlaced: true } }))
  on('ui.close', () => ({ value: undefined }))
  on('ui.toast', () => {})
  await $.ui.mount({ plugin: 'cc-cli-rail', surface: 'terminal', component: 'UserMessage', requestId: 'm1', props: prompt('first prompt', null) })
  await $.ui.mount({ plugin: 'cc-cli-rail', surface: 'terminal', component: 'UserMessage', requestId: 'm2', props: prompt('second prompt', null) })
  // The heavy tick means "being read": with nothing on screen, none is heavy.
  const rail = await dock($)
  expect(jumpButtons(await rail.findAll({ type: 'Button' })).map(b => b.props.label)).toEqual([' ─ first prompt', ' ─ second prompt'])
})

test('a command names a prompt by number, first, last or the words it holds', () => {
  const texts = ['fix the build', 'add tests', 'Fix the docs']
  expect([pickPrompt('2', texts), pickPrompt('#3', texts), pickPrompt('4', texts), pickPrompt('0', texts)]).toEqual([1, 2, -1, -1])
  expect([pickPrompt('first', texts), pickPrompt('last', texts), pickPrompt('last', [])]).toEqual([0, 2, -1])
  // The newest that holds the words, case aside.
  expect([pickPrompt('find fix the', texts), pickPrompt('find nothing', texts)]).toEqual([2, -1])
  // The rail's own words (show, hide, toggle) name no prompt.
  expect([pickPrompt('show', texts), pickPrompt('toggle', texts), pickPrompt('', texts), pickPrompt('find', texts)]).toEqual([undefined, undefined, undefined, undefined])
})

test('the vertical pane keeps the focus ring off its rows, the engine\'s own stops aside', async ($, on) => {
  const moves: (string | undefined)[] = []
  // Stand in for the engine moving the ring.
  on('ui.focus', ($: any, e: any) => {
    moves.push(e.element ?? 'engine stop')
    return {}
  })
  await drawPrompts($, on)
  // A ringed row beside the row under the pointer lights two rows at once;
  // a click still presses, and next and prev are the keyboard route.
  const ringed = await $.ui.focus({ component: 'Pane', requestId: 'cc-cli-rail', plugin: 'cc-cli-rail', element: 'jump-0', origin: { kind: 'person' } })
  expect(ringed.deny).toBeDefined()
  expect(moves).toEqual([])
  // The pane's close mark is the engine's, so the ring still reaches it.
  await $.ui.focus({ component: 'Pane', requestId: 'cc-cli-rail', origin: { kind: 'person' } })
  expect(moves).toEqual(['engine stop'])
})

test('with several prompts on screen only the topmost one is heavy', async ($, on) => {
  await drawPrompts($, on)
  await $.ui.mount({ plugin: 'cc-cli-rail', surface: 'terminal', component: 'UserMessage', requestId: 'm3', props: prompt('third prompt', { first: 0, last: 1, of: 2 }) })
  const rail = await dock($)
  // m2 and m3 both show; m2 is the one being read.
  expect(jumpButtons(await rail.findAll({ type: 'Button' })).map(b => b.props.label)).toEqual([' ─ first prompt', ' ━ second prompt', ' ─ third prompt'])
})

// A transcript JSONL from rows given in order; each row's parent is the one
// before it unless it names its own (`parentUuid`, null at a chain's root).
const jsonl = (rows: Record<string, unknown>[]) =>
  rows
    .map((row, i) => JSON.stringify({ parentUuid: i === 0 ? null : rows[i - 1]?.uuid, ...row }))
    .join('\n')

const TRANSCRIPT = jsonl([
  { type: 'user', uuid: 'u1', message: { role: 'user', content: 'first stored prompt' } },
  {
    type: 'assistant',
    uuid: 'a1',
    message: { role: 'assistant', content: [{ type: 'text', text: 'reply' }, { type: 'tool_use', id: 't1', name: 'Bash', input: {} }] },
  },
  { type: 'user', uuid: 'r1', message: { role: 'user', content: [{ type: 'tool_result', tool_use_id: 't1', content: 'ok' }] } },
  { type: 'user', uuid: 'u2', message: { role: 'user', content: '<div> why does this overflow?' } },
  { type: 'user', uuid: 'c1', message: { role: 'user', content: '<command-name>/cc-cli-rail</command-name>' } },
  { type: 'user', uuid: 'u3', message: { role: 'user', content: 'continue' } },
  { type: 'user', uuid: 'u4', message: { role: 'user', content: 'continue' } },
])

// alpha -> beta -> gamma, then /rewind to before beta and delta sent instead.
const FORKED = jsonl([
  { type: 'user', uuid: 'p1', message: { role: 'user', content: 'alpha' } },
  { type: 'assistant', uuid: 'q1', message: { role: 'assistant', content: [{ type: 'text', text: 'alpha' }] } },
  { type: 'user', uuid: 'p2', message: { role: 'user', content: 'beta' } },
  { type: 'assistant', uuid: 'q2', message: { role: 'assistant', content: [{ type: 'text', text: 'beta' }] } },
  { type: 'user', uuid: 'p3', message: { role: 'user', content: 'gamma' } },
  { type: 'assistant', uuid: 'q3', message: { role: 'assistant', content: [{ type: 'text', text: 'gamma' }] } },
  { type: 'user', uuid: 'p4', parentUuid: 'q1', message: { role: 'user', content: 'delta' } },
  { type: 'assistant', uuid: 'q4', message: { role: 'assistant', content: [{ type: 'text', text: 'delta' }] } },
  { type: 'system', uuid: 's1' },
])

// A prompt, then /compact: the boundary starts a new chain whose logical parent
// is the last row before it.
const COMPACTED = jsonl([
  { type: 'user', uuid: 'p1', message: { role: 'user', content: 'before compact' } },
  { type: 'assistant', uuid: 'q1', message: { role: 'assistant', content: [{ type: 'text', text: 'ok' }] } },
  { type: 'system', uuid: 'b1', parentUuid: null, logicalParentUuid: 'q1', subtype: 'compact_boundary' },
  { type: 'user', uuid: 'p2', message: { role: 'user', content: 'after compact' } },
])

// What the world beneath the plugin holds and counts: the transcript file's
// text (a test may change it), how often the plugin read it, how often it
// asked for a redraw of everything it hooks and of the rail alone, and the
// panes it opened or closed.
type Beneath = {
  transcript: string
  mtimeMs: number
  reads: number
  invalidations: number
  railRedraws: number
  panes: string[]
  commands: unknown[]
  toasts: string[]
  // Whether the surface draws the pane it is asked to open, and each line the
  // plugin pinned as its status (undefined for a clear).
  placed: boolean
  status: (string | undefined)[]
  // Each `tail` the plugin spawned, as its argv, and whether spawning fails
  // (the desktop app and SDK hosts run no processes).
  spawns: string[][]
  spawnFails: boolean
}
const beneath = (transcript = TRANSCRIPT): Beneath => ({
  transcript,
  mtimeMs: 1,
  reads: 0,
  invalidations: 0,
  railRedraws: 0,
  panes: [],
  commands: [],
  toasts: [],
  placed: true,
  status: [],
  spawns: [],
  spawnFails: false,
})

const bytes = (text: string) => new TextEncoder().encode(text)
// The engine's cap on one $.fs.read.
const READ_CAP = 4 * 1024 * 1024

// The world beneath the plugin for a session whose transcript is TRANSCRIPT,
// with a store in memory the test can read.
const world = (on: any, initial: Record<string, unknown> = {}, transcript = TRANSCRIPT, disk: Beneath = beneath(transcript)) => {
  const store = new Map<string, unknown>(Object.entries(initial))
  on('store.get', ($: any, e: any) => ({ value: store.get(e.key) }))
  on('store.set', ($: any, e: any) => {
    store.set(e.key, e.value)
    return { value: undefined }
  })
  on('store.keys', () => ({ value: [...store.keys()] }))
  on('store.delete', ($: any, e: any) => {
    store.delete(e.key)
    return { value: undefined }
  })
  on('fs.read', ($: any, e: any) => {
    disk.reads++
    if (bytes(disk.transcript).length > READ_CAP) return { deny: 'over 4 MiB' }
    return { value: e.path === '/t/s1.jsonl' ? disk.transcript : '' }
  })
  on('fs.stat', ($: any, e: any) => ({
    value: { kind: 'file', size: e.path === '/t/s1.jsonl' ? bytes(disk.transcript).length : 0, mtimeMs: disk.mtimeMs, isLink: false },
  }))
  // `tail -c +N path`: the file's bytes from the Nth on, in pieces of a
  // megabyte or so, as a child's output arrives.
  on('process.spawn', async function* ($: any, e: any) {
    disk.spawns.push([...e.argv])
    if (disk.spawnFails) throw new Error('no processes here')
    const from = Number(String(e.argv[2]).slice(1)) - 1
    const text = new TextDecoder().decode(bytes(disk.transcript).slice(from))
    for (let i = 0; i < text.length; i += 1 << 20) yield { stream: 'stdout', text: text.slice(i, i + (1 << 20)) }
    return { value: { code: 0, signal: null } }
  })
  on('ui.invalidate', () => {
    disk.invalidations++
    return { value: undefined }
  })
  on('state.set', ($: any, e: any, next: any) => {
    disk.railRedraws++
    return next(e)
  })
  on('session.id', () => ({ value: 's1' }))
  on('classic.SessionStart', () => ({}))
  on('classic.Stop', () => ({}))
  on('session.start', ($: any, e: any) => ({ cwd: e.cwd }))
  on('command.register', ($: any, e: any) => {
    disk.commands.push(e)
    return { value: { command: e.name } }
  })
  on('ui.open', ($: any, e: any) => {
    disk.panes.push(`open ${e.id}`)
    return { value: disk.placed ? { isPlaced: true } : { isPlaced: false, reason: 'the terminal is 100 columns wide' } }
  })
  on('ui.status', ($: any, e: any) => {
    disk.status.push(e.text)
    return { value: undefined }
  })
  on('ui.close', ($: any, e: any) => {
    disk.panes.push(`close ${e.id}`)
    return { value: undefined }
  })
  on('ui.toast', ($: any, e: any) => {
    disk.toasts.push(e.text)
    return { value: undefined }
  })
  on('ui.render', { component: 'UserMessage' }, ($: any, e: any) => $.ui.resolve(e).Text({ children: e.props.text }))
  on('ui.render', { component: 'ToolUse' }, ($: any, e: any) => $.ui.resolve(e).Text({ children: e.props.tool }))
  on('ui.render', { component: 'AssistantMessage' }, ($: any, e: any) => $.ui.resolve(e).Text({ children: 'reply' }))
  on('ui.render', { component: 'AbovePrompt' }, ($: any, e: any) => $.ui.resolve(e).Box({}))
  return store
}

// The turn details each hidden card of a narrow vertical rail carries.
const cardDetails = async ($: any, band: Record<string, unknown> = BAND) => {
  const site = await $.ui.mount({ plugin: 'cc-cli-rail', surface: 'terminal', component: 'Pane', requestId: 'cc-cli-rail', props: pane('dock', 4) })
  const above = await $.ui.mount({ plugin: 'cc-cli-rail', surface: 'terminal', component: 'AbovePrompt', props: band })
  const details = (await above.findAll({ type: 'Text' })).map((t: any) => String(t.text)).filter((text: string) => !/^#\d+ $/.test(text))
  await above.unmount()
  await site.unmount()
  return details
}

const railLabels = async ($: any) => {
  const rail = await $.ui.mount({ plugin: 'cc-cli-rail', surface: 'terminal', component: 'Pane', requestId: 'cc-cli-rail', props: pane('dock', 40) })
  const labels = jumpButtons(await rail.findAll({ type: 'Button' })).map((b: any) => String(b.props.label).slice(3))
  await rail.unmount()
  return labels
}

// A transcript over the engine's read cap: a prompt, a tool call whose
// result is 4.5 MB, then more prompts. Every row ends with a newline, as the
// engine writes them.
const BULK = 'x'.repeat(4.5 * 1024 * 1024)
const bigRows = (more: Record<string, unknown>[] = []) => [
  { type: 'user', uuid: 'p1', timestamp: '2026-09-24T00:00:00.000Z', message: { role: 'user', content: 'first' } },
  { type: 'assistant', uuid: 'b1', timestamp: '2026-09-24T00:00:05.000Z', message: { role: 'assistant', content: [{ type: 'tool_use', id: 't1', name: 'Read', input: { file_path: '/w/big.log' } }] } },
  { type: 'user', uuid: 'r1', message: { role: 'user', content: [{ type: 'tool_result', tool_use_id: 't1', content: BULK }] } },
  { type: 'assistant', uuid: 'b2', timestamp: '2026-09-24T00:00:20.000Z', message: { role: 'assistant', content: [{ type: 'text', text: 'read it' }] } },
  { type: 'system', uuid: 'd1', subtype: 'turn_duration', durationMs: 20000 },
  { type: 'user', uuid: 'p2', timestamp: '2026-09-24T00:01:00.000Z', message: { role: 'user', content: '二番目のプロンプト' } },
  ...more,
]
const bigFile = (rows: Record<string, unknown>[]) => `${jsonl(rows)}\n`
const bigWorld = (on: any, rows = bigRows()) => {
  const disk = beneath(bigFile(rows))
  world(on, {}, disk.transcript, disk)
  return { disk, clock: mock.clock(on) }
}
const stop = ($: any) => $.classic.Stop({ session_id: 's1', transcript_path: '/t/s1.jsonl', stop_hook_active: false })

test('a transcript over 4 MiB is listed in its order, with turn details, without $.fs.read', async ($, on) => {
  const { disk, clock } = bigWorld(on)
  await $.classic.SessionStart({ source: 'resume', session_id: 's1', transcript_path: '/t/s1.jsonl' })
  await clock.settle()
  expect(await railLabels($)).toEqual(['first', '二番目のプロンプト'])
  expect(disk.reads).toBe(0)
  expect(disk.spawns).toEqual([['tail', '-c', '+1', '/t/s1.jsonl']])
  await drawRow($, 'p1', 'first', { first: 0, last: 1, of: 2 })
  expect(await cardDetails($)).toEqual(['first · 20s · 1 tool', '二番目のプロンプト'])
})

test('a later read of a large transcript asks only for the bytes after the last row', async ($, on) => {
  const { disk, clock } = bigWorld(on)
  await $.classic.SessionStart({ source: 'resume', session_id: 's1', transcript_path: '/t/s1.jsonl' })
  await clock.settle()
  const before = bytes(disk.transcript).length
  const lastRow = bytes(`${JSON.stringify({ parentUuid: 'd1', ...bigRows()[5] })}\n`).length
  disk.transcript = bigFile(bigRows([{ type: 'user', uuid: 'p3', message: { role: 'user', content: 'third' } }]))
  disk.mtimeMs = 2
  await stop($)
  await clock.settle()
  expect(await railLabels($)).toEqual(['first', '二番目のプロンプト', 'third'])
  // It starts at the last row read, to check the file still holds it there.
  expect(disk.spawns[1]).toEqual(['tail', '-c', `+${before - lastRow + 1}`, '/t/s1.jsonl'])
})

test('a row torn at the end of a large transcript is listed once it is whole', async ($, on) => {
  const { disk, clock } = bigWorld(on)
  await $.classic.SessionStart({ source: 'resume', session_id: 's1', transcript_path: '/t/s1.jsonl' })
  await clock.settle()
  const whole = bigFile(bigRows([{ type: 'user', uuid: 'p3', message: { role: 'user', content: 'third' } }]))
  disk.transcript = whole.slice(0, whole.length - 20)
  disk.mtimeMs = 2
  await stop($)
  await clock.settle()
  expect(await railLabels($)).toEqual(['first', '二番目のプロンプト'])
  disk.transcript = whole
  disk.mtimeMs = 3
  await stop($)
  await clock.settle()
  expect(await railLabels($)).toEqual(['first', '二番目のプロンプト', 'third'])
})

test('a large transcript rewritten under the rail is read again from its start', async ($, on) => {
  const { disk, clock } = bigWorld(on)
  await $.classic.SessionStart({ source: 'resume', session_id: 's1', transcript_path: '/t/s1.jsonl' })
  await clock.settle()
  // Same size or larger, but no longer the rows read: a replaced file.
  disk.transcript = bigFile(bigRows().map(row => (row.uuid === 'p2' ? { ...row, uuid: 'q2', message: { role: 'user', content: 'replaced prompt' } } : row)))
  disk.mtimeMs = 2
  await stop($)
  await clock.settle()
  expect(await railLabels($)).toEqual(['first', 'replaced prompt'])
})

test('a rewind appended to a large transcript drops the abandoned prompt', async ($, on) => {
  const { disk, clock } = bigWorld(on)
  await $.classic.SessionStart({ source: 'resume', session_id: 's1', transcript_path: '/t/s1.jsonl' })
  await clock.settle()
  disk.transcript = bigFile(bigRows([{ type: 'user', uuid: 'p3', parentUuid: 'd1', message: { role: 'user', content: 'instead' } }]))
  disk.mtimeMs = 2
  await stop($)
  await clock.settle()
  expect(await railLabels($)).toEqual(['first', 'instead'])
})

test('where no process can run, a large transcript leaves the drawn list and says so once', async ($, on) => {
  const { disk, clock } = bigWorld(on)
  disk.spawnFails = true
  await $.classic.SessionStart({ source: 'resume', session_id: 's1', transcript_path: '/t/s1.jsonl' })
  await clock.settle()
  await drawRow($, 'p2', '二番目のプロンプト')
  disk.mtimeMs = 2
  await stop($)
  disk.mtimeMs = 3
  await stop($)
  await clock.settle()
  expect(await railLabels($)).toEqual(['二番目のプロンプト'])
  expect(disk.toasts.filter(text => text.includes('too large'))).toHaveLength(1)
})

test('the session start remembers its transcript under its own key', async ($, on) => {
  const store = world(on, { 'transcript:s0': { path: '/t/s0.jsonl', at: 1 } })
  await $.classic.SessionStart({ source: 'resume', session_id: 's1', transcript_path: '/t/s1.jsonl' })
  expect((store.get('transcript:s1') as any)?.path).toBe('/t/s1.jsonl')
  // Another session's entry is left alone: no shared map is rewritten.
  expect(store.get('transcript:s0')).toEqual({ path: '/t/s0.jsonl', at: 1 })
})

test('a reload lists the prompts again from the remembered transcript', async ($, on) => {
  // A reloaded module has no list; session.start fires again and rebuilds it.
  const disk = beneath()
  world(on, { 'transcript:s1': { path: '/t/s1.jsonl', at: 1 } }, TRANSCRIPT, disk)
  await $.session.start({ cwd: '/t', surface: 'terminal', isInteractive: true })
  expect(disk.panes).toEqual(['open cc-cli-rail'])
  expect((await railLabels($)).length).toBe(4)
})

test('prompts are listed in transcript order, wrappers left out, repeats kept', async ($, on) => {
  world(on)
  await $.classic.SessionStart({ source: 'resume', session_id: 's1', transcript_path: '/t/s1.jsonl' })
  expect(await railLabels($)).toEqual(['first stored prompt', '<div> why does this overflow?', 'continue', 'continue'])
})

// A prompt sent while an artifact is open in the viewer: the engine stores the
// viewer's state ahead of the typed text.
const VIEWED = '<artifact-view-context artifact="bb04">\n{"context":{"mode":"edit","slideId":"s38"}}\n</artifact-view-context>\n\nswap the image'

test('the artifact view context ahead of a stored prompt is left out of its text', async ($, on) => {
  world(on, {}, jsonl([{ type: 'user', uuid: 'v1', message: { role: 'user', content: VIEWED } }]))
  await $.classic.SessionStart({ source: 'resume', session_id: 's1', transcript_path: '/t/s1.jsonl' })
  expect(await railLabels($)).toEqual(['swap the image'])
})

test('the artifact view context ahead of a drawn prompt is left out of its text', async ($, on) => {
  world(on, {}, jsonl([]))
  await $.ui.mount({ plugin: 'cc-cli-rail', surface: 'terminal', component: 'UserMessage', requestId: 'v1', props: prompt(VIEWED, null) })
  expect(await railLabels($)).toEqual(['swap the image'])
})

test('a typed artifact view context tag is kept, since it is not the viewer\'s state', async ($, on) => {
  world(on, {}, jsonl([]))
  const typed = '<artifact-view-context artifact="demo">example</artifact-view-context> explain this'
  await $.ui.mount({ plugin: 'cc-cli-rail', surface: 'terminal', component: 'UserMessage', requestId: 'v1', props: prompt(typed, null) })
  const labels = await railLabels($)
  expect(labels.length).toBe(1)
  expect(labels[0]).toMatch(/^<artifact-view-context artifact="de/)
})

test('a repeated prompt gets its own entry; the provisional row is not listed', async ($, on) => {
  world(on)
  const draw = async (requestId: string, text: string) => {
    const row = await $.ui.mount({ plugin: 'cc-cli-rail', surface: 'terminal', component: 'UserMessage', requestId, props: prompt(text, null) })
    await row.unmount()
  }
  await draw('placeholder', 'continue')
  await draw('x1', 'continue')
  await draw('placeholder', 'continue')
  await draw('x2', 'continue')
  expect(await railLabels($)).toEqual(['continue', 'continue'])
})

// A message the engine splits into rows is drawn under ids derived from its
// stored uuid: the first four groups, then the row's index (seen in 2.1.283).
const SPLIT_IDS = {
  first: 'dae2bfb1-3f75-4882-a3e4-6f43dc45b51c',
  firstRow: 'dae2bfb1-3f75-4882-a3e4-000000000000',
  reply: 'e59aaf08-414b-4bb2-9945-895150ed76c7',
  replyRow: 'e59aaf08-414b-4bb2-9945-000000000001',
  second: '35939e29-64ae-48ff-bc1d-432a998b2414',
}
const SPLIT = jsonl([
  { type: 'user', uuid: SPLIT_IDS.first, message: { role: 'user', content: 'first' } },
  { type: 'assistant', uuid: SPLIT_IDS.reply, message: { role: 'assistant', content: [{ type: 'text', text: 'reply' }] } },
  { type: 'user', uuid: SPLIT_IDS.second, message: { role: 'user', content: 'second' } },
])
const drawSplit = ($: any, component: 'UserMessage' | 'AssistantMessage', requestId: string, onScreen: { first: number; last: number; of: number } | null) =>
  $.ui.mount({
    plugin: 'cc-cli-rail',
    surface: 'terminal',
    component,
    requestId,
    props: component === 'UserMessage' ? prompt('first', onScreen) : { text: 'reply', isFirstOfReply: true, onScreen },
  })

test('a prompt drawn under an id derived from its stored uuid is listed once, drawn first', async ($, on) => {
  world(on, {}, SPLIT)
  await drawSplit($, 'UserMessage', SPLIT_IDS.firstRow, null)
  await $.classic.SessionStart({ source: 'resume', session_id: 's1', transcript_path: '/t/s1.jsonl' })
  expect(await railLabels($)).toEqual(['first', 'second'])
})

test('a prompt drawn under an id derived from its stored uuid is listed once, read first', async ($, on) => {
  world(on, {}, SPLIT)
  await $.classic.SessionStart({ source: 'resume', session_id: 's1', transcript_path: '/t/s1.jsonl' })
  await drawSplit($, 'UserMessage', SPLIT_IDS.firstRow, null)
  expect(await railLabels($)).toEqual(['first', 'second'])
})

test('a prompt row on screen under a derived id places the reader under that prompt', async ($, on) => {
  world(on, {}, SPLIT)
  await $.classic.SessionStart({ source: 'resume', session_id: 's1', transcript_path: '/t/s1.jsonl' })
  await drawSplit($, 'UserMessage', SPLIT_IDS.firstRow, { first: 0, last: 1, of: 2 })
  expect(await heavyIn(await dock($))).toBe(0)
})

test('a reply row on screen under a derived id places the reader under its prompt', async ($, on) => {
  world(on, {}, SPLIT)
  await $.classic.SessionStart({ source: 'resume', session_id: 's1', transcript_path: '/t/s1.jsonl' })
  await drawSplit($, 'AssistantMessage', SPLIT_IDS.replyRow, { first: 0, last: 1, of: 2 })
  expect(await heavyIn(await dock($))).toBe(0)
})

test('a jump to a stored prompt scrolls to the id its row was drawn under', () => {
  const drawn = new Map([[rowKey(SPLIT_IDS.firstRow), SPLIT_IDS.firstRow]])
  expect(drawnRow(drawn, SPLIT_IDS.first)).toBe(SPLIT_IDS.firstRow)
  // A prompt not drawn yet is looked for under its own id.
  expect(drawnRow(drawn, SPLIT_IDS.second)).toBe(SPLIT_IDS.second)
  expect(drawnRow(drawn, 'u1')).toBe('u1')
})

// How the engine draws a prompt that does not go straight into a turn, as
// seen in 2.1.283 (tmux and Herdr alike):
// - queued while a turn runs and sent once it ends: two rows it never
//   stores, around prompt.submit, then the provisional row and the stored one;
// - delivered into the running turn: the same two rows, then the row of the
//   queued_command attachment the transcript stores, with no provisional row;
// - sent from Remote Control, even at rest: session.receive, one row it never
//   stores, the provisional row, prompt.submit, then the stored row.
const drawRow = async ($: any, requestId: string, text: string, onScreen: { first: number; last: number; of: number } | null = null) => {
  const row = await $.ui.mount({ plugin: 'cc-cli-rail', surface: 'terminal', component: 'UserMessage', requestId, props: prompt(text, onScreen) })
  await row.unmount()
}
const submit = ($: any, text: string) => $.prompt.submit({ text, wait: false, origin: { kind: 'composer' } })
const sendQueued = async ($: any, text: string, ids: [string, string, string]) => {
  await drawRow($, ids[0], text)
  await submit($, text)
  await drawRow($, ids[1], text)
  await drawRow($, 'placeholder', text)
  await drawRow($, ids[2], text)
}
// The world plus the engine's own answers to the events these tests raise.
const queueWorld = (on: any, transcript = jsonl([])) => {
  const disk = beneath(transcript)
  world(on, {}, transcript, disk)
  on('turn.start', ($: any, e: any) => ({ turnId: e.turnId }))
  on('turn.complete', ($: any, e: any) => ({ text: e.answer }))
  on('prompt.submit', ($: any, e: any) => ({ text: e.text }))
  on('session.receive', ($: any, e: any) => ({ text: e.text }))
  return disk
}
const sendFirst = async ($: any, text: string, id: string) => {
  await submit($, text)
  await drawRow($, 'placeholder', text)
  await $.turn.start({ text, turnId: `t-${id}` })
  await drawRow($, id, text)
}

test('a prompt queued while a turn runs is listed once', async ($, on) => {
  queueWorld(on)
  await sendFirst($, 'first', 's1')
  await sendQueued($, 'queued', ['q1', 'q2', 's2'])
  expect(await railLabels($)).toEqual(['first', 'queued'])
})

test('a queued prompt is listed once as soon as it is sent', async ($, on) => {
  queueWorld(on)
  await sendFirst($, 'first', 's1')
  await drawRow($, 'q1', 'queued')
  await submit($, 'queued')
  await drawRow($, 'q2', 'queued')
  expect(await railLabels($)).toEqual(['first', 'queued'])
})

test('queue rows drawn just before the notification make one entry', async ($, on) => {
  queueWorld(on)
  await sendFirst($, 'first', 's1')
  await drawRow($, 'q1', 'queued')
  await drawRow($, 'q2', 'queued')
  await submit($, 'queued')
  expect(await railLabels($)).toEqual(['first', 'queued'])
})

test('a prompt queued behind the same text keeps both entries', async ($, on) => {
  queueWorld(on)
  await sendFirst($, 'continue', 's1')
  await sendQueued($, 'continue', ['q1', 'q2', 's2'])
  expect(await railLabels($)).toEqual(['continue', 'continue'])
})

test('a prompt drawn at rest is kept when a queued prompt has the same text', async ($, on) => {
  // As on a resume whose transcript cannot be read: the rows are drawn only.
  queueWorld(on)
  await drawRow($, 'old', 'continue')
  await sendFirst($, 'go on', 's1')
  await sendQueued($, 'continue', ['q1', 'q2', 's2'])
  expect(await railLabels($)).toEqual(['continue', 'go on', 'continue'])
})

test('a row drawn well before a prompt with its text is sent stays its own entry', async ($, on) => {
  queueWorld(on)
  await drawRow($, 'old', 'continue')
  await new Promise(resolve => setTimeout(resolve, 300))
  await sendFirst($, 'continue', 's1')
  expect(await railLabels($)).toEqual(['continue', 'continue'])
})

test('a prompt whose turn starts with no provisional row is not taken for a queued one', async ($, on) => {
  // The session's first prompt: its turn starts, then its stored row is drawn.
  queueWorld(on)
  await $.turn.start({ text: 'first', turnId: 't1' })
  await drawRow($, 's1', 'first')
  await $.turn.complete({ answer: 'done', durationMs: 1000, isAborted: false, turnId: 't1', reason: 'answer' })
  await sendFirst($, 'first', 's2')
  expect(await railLabels($)).toEqual(['first', 'first'])
})

test('a sent prompt the transcript listed first still ends its provisional row', async ($, on) => {
  // The turn's start read the file before the stored row was drawn.
  queueWorld(on, jsonl([{ type: 'user', uuid: 's1', message: { role: 'user', content: 'continue' } }]))
  await $.classic.SessionStart({ source: 'resume', session_id: 's1', transcript_path: '/t/s1.jsonl' })
  await sendFirst($, 'continue', 's1')
  await sendQueued($, 'continue', ['q1', 'q2', 's2'])
  expect(await railLabels($)).toEqual(['continue', 'continue'])
})

test('a prompt sent from Remote Control at rest is listed once', async ($, on) => {
  queueWorld(on)
  await $.session.receive({ text: 'remote one', origin: { kind: 'bridge' } })
  await drawRow($, 'r1', 'remote one')
  await drawRow($, 'placeholder', 'remote one')
  await $.prompt.submit({ text: 'remote one', wait: false, origin: { kind: 'bridge' } })
  await $.turn.start({ text: 'remote one', turnId: 't1' })
  await drawRow($, 's1', 'remote one')
  expect(await railLabels($)).toEqual(['remote one'])
})

test('a prompt delivered into the running turn is listed once and read on its own row', async ($, on) => {
  queueWorld(on)
  await sendFirst($, 'first', 's1')
  await drawRow($, 'q1', 'mid')
  await submit($, 'mid')
  await drawRow($, 'q2', 'mid')
  // The attachment row is the one left on screen once the turn reads it.
  await drawRow($, 'a1', 'mid', { first: 0, last: 1, of: 2 })
  expect(await railLabels($)).toEqual(['first', 'mid'])
  expect(await heavyIn(await dock($))).toBe(1)
})

// A prompt delivered into the running turn: its queue rows around the
// notification, then, once a tool call ends, the row of its attachment.
const deliver = async ($: any, text: string, ids: [string, string, string]) => {
  await drawRow($, ids[0], text)
  await submit($, text)
  await drawRow($, ids[1], text)
  await new Promise(resolve => setTimeout(resolve, 300))
  await drawRow($, ids[2], text)
}

test('a turn keeps its details when a prompt with its text is delivered into it', async ($, on) => {
  queueWorld(on)
  await sendFirst($, 'continue', 's1')
  await deliver($, 'continue', ['q1', 'q2', 'a1'])
  await $.turn.complete({ answer: 'done', durationMs: 12500, isAborted: true, turnId: 't-s1', reason: 'aborted' })
  expect(await railLabels($)).toEqual(['continue', 'continue'])
  await drawRow($, 's1', 'continue', { first: 0, last: 1, of: 2 })
  expect(await cardDetails($)).toEqual(['continue · 12s · interrupted', 'continue'])
})

test('a delivered prompt keeps its bar when the same text is sent after its turn', async ($, on) => {
  // As where the transcript cannot be read: the delivery is known from draws only.
  queueWorld(on)
  await sendFirst($, 'first', 's1')
  await deliver($, 'continue', ['q1', 'q2', 'a1'])
  await $.turn.complete({ answer: 'done', durationMs: 1000, isAborted: false, turnId: 't-s1', reason: 'answer' })
  await sendFirst($, 'continue', 's2')
  expect(await railLabels($)).toEqual(['first', 'continue', 'continue'])
})

// A prompt delivered into the running turn, stored as a queued_command
// attachment inside the turn the first prompt started.
const DELIVERED = [
  { type: 'user', uuid: 's1', timestamp: '2026-09-24T00:00:00.000Z', message: { role: 'user', content: 'first' } },
  {
    type: 'assistant',
    uuid: 'b1',
    timestamp: '2026-09-24T00:00:05.000Z',
    message: { role: 'assistant', content: [{ type: 'tool_use', id: 't1', name: 'Bash', input: { command: 'sleep 8' } }] },
  },
  { type: 'user', uuid: 'r1', message: { role: 'user', content: [{ type: 'tool_result', tool_use_id: 't1', content: '' }] } },
  { type: 'attachment', uuid: 'a1', attachment: { type: 'queued_command', prompt: 'mid' } },
  { type: 'assistant', uuid: 'b2', timestamp: '2026-09-24T00:00:14.000Z', message: { role: 'assistant', content: [{ type: 'text', text: 'done' }] } },
  { type: 'system', uuid: 'd1', subtype: 'turn_duration', durationMs: 14000 },
]

test('a prompt delivered into a turn is listed from the transcript, the turn staying with its first prompt', async ($, on) => {
  queueWorld(on, jsonl(DELIVERED))
  await $.classic.SessionStart({ source: 'resume', session_id: 's1', transcript_path: '/t/s1.jsonl' })
  expect(await railLabels($)).toEqual(['first', 'mid'])
  await drawRow($, 's1', 'first', { first: 0, last: 1, of: 2 })
  expect(await cardDetails($)).toEqual(['first · 14s · 1 tool', 'mid'])
})

test('a delivered prompt drawn before the transcript is read is listed once after it', async ($, on) => {
  const disk = queueWorld(on, jsonl(DELIVERED.slice(0, 3)))
  await $.classic.SessionStart({ source: 'resume', session_id: 's1', transcript_path: '/t/s1.jsonl' })
  await drawRow($, 'q1', 'mid')
  await submit($, 'mid')
  await drawRow($, 'q2', 'mid')
  await drawRow($, 'a1', 'mid')
  disk.transcript = jsonl(DELIVERED)
  disk.mtimeMs = 2
  await $.classic.Stop({ session_id: 's1', transcript_path: '/t/s1.jsonl', stop_hook_active: false })
  expect(await railLabels($)).toEqual(['first', 'mid'])
})

test('what the engine reported of a turn goes to the prompt that started it, not one delivered into it', async ($, on) => {
  queueWorld(on)
  await sendFirst($, 'first', 's1')
  await drawRow($, 'q1', 'mid')
  await submit($, 'mid')
  await drawRow($, 'a1', 'mid')
  await $.turn.complete({ answer: 'done', durationMs: 12500, isAborted: true, turnId: 't-s1', reason: 'aborted' })
  await drawRow($, 's1', 'first', { first: 0, last: 1, of: 2 })
  expect(await cardDetails($)).toEqual(['first · 12s · interrupted', 'mid'])
})

test('a tool row at the top of the viewport places the reader under its prompt', async ($, on) => {
  world(on)
  await $.classic.SessionStart({ source: 'resume', session_id: 's1', transcript_path: '/t/s1.jsonl' })
  await $.ui.mount({
    plugin: 'cc-cli-rail',
    surface: 'terminal',
    component: 'ToolUse',
    requestId: 't1',
    props: { tool_use_id: 't1', tool: 'Bash', input: {}, isRunning: false, isErrored: false, isInterrupted: false, onScreen: { first: 0, last: 1, of: 2 } },
  })
  await $.ui.mount({ plugin: 'cc-cli-rail', surface: 'terminal', component: 'UserMessage', requestId: 'u3', props: prompt('continue', { first: 0, last: 1, of: 2 }) })
  await $.session.start({ cwd: '/t', surface: 'terminal', isInteractive: true })
  expect(await heavyIn(await dock($))).toBe(0)
})

test('after /rewind only the live branch is listed', async ($, on) => {
  world(on, {}, FORKED)
  await $.classic.SessionStart({ source: 'resume', session_id: 's1', transcript_path: '/t/s1.jsonl' })
  expect(await railLabels($)).toEqual(['alpha', 'delta'])
})

test('a drawn row from an abandoned branch drops out once the transcript is read', async ($, on) => {
  world(on, {}, FORKED)
  const row = await $.ui.mount({ plugin: 'cc-cli-rail', surface: 'terminal', component: 'UserMessage', requestId: 'p2', props: prompt('beta', null) })
  await row.unmount()
  await $.classic.SessionStart({ source: 'resume', session_id: 's1', transcript_path: '/t/s1.jsonl' })
  expect(await railLabels($)).toEqual(['alpha', 'delta'])
})

test('prompts before a compaction stay listed', async ($, on) => {
  world(on, {}, COMPACTED)
  await $.classic.SessionStart({ source: 'resume', session_id: 's1', transcript_path: '/t/s1.jsonl' })
  expect(await railLabels($)).toEqual(['before compact', 'after compact'])
})

test("while a subagent's transcript is in view the pane holds a note, not the rail", async ($, on) => {
  await drawPrompts($, on)
  const rail = await $.ui.mount({ plugin: 'cc-cli-rail', surface: 'terminal', component: 'Pane', requestId: 'cc-cli-rail', props: { ...pane('dock', 37), view: { agentId: 'ag1' } } })
  expect(jumpButtons(await rail.findAll({ type: 'Button' }))).toEqual([])
  expect(await rail.find({ type: 'Text', text: /main conversation/ })).toBeDefined()
})

test("while a subagent's transcript is in view the band stays empty", async ($, on) => {
  await drawPrompts($, on)
  // Neither the cards of a narrow dock nor the button that shows the rail.
  await $.ui.mount({ plugin: 'cc-cli-rail', surface: 'terminal', component: 'Pane', requestId: 'cc-cli-rail', props: pane('dock', 4) })
  const band = await $.ui.mount({ plugin: 'cc-cli-rail', surface: 'terminal', component: 'AbovePrompt', props: { ...BAND, view: { agentId: 'ag1' } } })
  expect(await band.findAll({ type: 'Button' })).toEqual([])
  expect(await band.find({ key: 'card-0' })).toBeUndefined()
  await $.command.run({ command: 'cc-cli-rail', args: 'hide' })
  await band.redraw({ ...BAND, view: { agentId: 'ag1' } })
  expect(await band.findAll({ type: 'Button' })).toEqual([])
})

// The engine's answer for a row the transcript does not draw (a slash
// command's own row, for one), and one for a move that lost a race. The kit
// does not answer a plugin's scroll to a transcript row, so the press itself
// is checked in a live session; these pin what the plugin makes of an answer.
const NOT_DRAWN = 'nothing drawn under that requestId'
const MOVED = 'the window moved meanwhile'

test('a jump refused because nothing is drawn marks the prompt unreachable', () => {
  const unreachable = new Set<string>()
  expect(noteScroll(unreachable, 'm1', NOT_DRAWN)).toBe(true)
  expect([...unreachable]).toEqual(['m1'])
  // Told again, nothing changes, so nothing is redrawn.
  expect(noteScroll(unreachable, 'm1', NOT_DRAWN)).toBe(false)
})

test('a jump refused for a passing reason leaves the prompt as it was', () => {
  const unreachable = new Set<string>(['m2'])
  expect(noteScroll(unreachable, 'm1', MOVED)).toBe(false)
  expect(noteScroll(unreachable, 'm2', MOVED)).toBe(false)
  expect([...unreachable]).toEqual(['m2'])
})

test('a jump that lands makes the prompt reachable again', () => {
  const unreachable = new Set<string>(['m1'])
  expect(noteScroll(unreachable, 'm1', undefined)).toBe(true)
  expect([...unreachable]).toEqual([])
})

test('an unreachable prompt is drawn with a dotted tick, unless being read', () => {
  expect([tick(false), tick(true), tick(false, true), tick(true, true)]).toEqual(['─', '━', '┄', '━'])
})

test('an unchanged transcript is not read again when a turn ends', async ($, on) => {
  const disk = beneath()
  world(on, {}, TRANSCRIPT, disk)
  await $.classic.SessionStart({ source: 'resume', session_id: 's1', transcript_path: '/t/s1.jsonl' })
  expect(disk.reads).toBe(1)
  await $.classic.Stop({ session_id: 's1', transcript_path: '/t/s1.jsonl', stop_hook_active: false })
  expect(disk.reads).toBe(1)
  // A turn that wrote to it is read.
  disk.transcript = `${TRANSCRIPT}\n${JSON.stringify({ type: 'user', uuid: 'u5', parentUuid: 'u4', message: { role: 'user', content: 'fifth' } })}`
  disk.mtimeMs = 2
  await $.classic.Stop({ session_id: 's1', transcript_path: '/t/s1.jsonl', stop_hook_active: false })
  expect(disk.reads).toBe(2)
  expect(await railLabels($)).toEqual(['first stored prompt', '<div> why does this overflow?', 'continue', 'continue', 'fifth'])
})

test('a turn that changes neither the list nor the prompt being read redraws nothing', async ($, on) => {
  const disk = beneath()
  world(on, {}, TRANSCRIPT, disk)
  await $.classic.SessionStart({ source: 'resume', session_id: 's1', transcript_path: '/t/s1.jsonl' })
  await railLabels($)
  const before = { invalidations: disk.invalidations, railRedraws: disk.railRedraws }
  // Same list, rewritten on disk (a row the index skips was appended).
  disk.transcript = `${TRANSCRIPT}\n${JSON.stringify({ type: 'system', uuid: 's9', parentUuid: 'u4', subtype: 'turn_duration' })}`
  disk.mtimeMs = 2
  await $.classic.Stop({ session_id: 's1', transcript_path: '/t/s1.jsonl', stop_hook_active: false })
  expect(disk.reads).toBe(2)
  expect(disk.invalidations).toBe(before.invalidations)
  expect(disk.railRedraws).toBe(before.railRedraws)
})

test('a scroll redraws the rail only when the prompt being read changes, and never the transcript', async ($, on) => {
  const disk = beneath()
  world(on, {}, TRANSCRIPT, disk)
  const clock = mock.clock(on)
  await $.classic.SessionStart({ source: 'resume', session_id: 's1', transcript_path: '/t/s1.jsonl' })
  const shown = { first: 0, last: 1, of: 2 }
  const u1 = await $.ui.mount({ plugin: 'cc-cli-rail', surface: 'terminal', component: 'UserMessage', requestId: 'u1', props: prompt('first stored prompt', shown) })
  const u2 = await $.ui.mount({ plugin: 'cc-cli-rail', surface: 'terminal', component: 'UserMessage', requestId: 'u2', props: prompt('<div> why does this overflow?', shown) })
  const rail = await dock($)
  const heavy = () => heavyIn(rail)
  await clock.settle()
  expect(await heavy()).toBe(0)
  const before = { invalidations: disk.invalidations, railRedraws: disk.railRedraws }
  // The lower row leaves the viewport; the topmost one, and so the prompt being read, stays.
  await u2.redraw(prompt('<div> why does this overflow?', null))
  // The rail is drawn again once the reports settle.
  await clock.advance(200)
  expect(disk.railRedraws).toBe(before.railRedraws)
  // Now the top row leaves as the next one enters: the prompt being read moves.
  await u1.redraw(prompt('first stored prompt', null))
  await u2.redraw(prompt('<div> why does this overflow?', shown))
  await clock.advance(200)
  expect(disk.railRedraws).toBe(before.railRedraws + 1)
  expect(await heavy()).toBe(1)
  // Drawing every transcript row again mid-scroll moves the viewport the
  // person is scrolling, right after a jump, a whole turn away.
  expect(disk.invalidations).toBe(before.invalidations)
})

test('the next and previous prompts step over ones that cannot be scrolled to', () => {
  const none = () => false
  expect([stepFrom(1, 4, 1, none), stepFrom(1, 4, -1, none)]).toEqual([2, 0])
  // At either end there is nowhere to go.
  expect([stepFrom(3, 4, 1, none), stepFrom(0, 4, -1, none)]).toEqual([-1, -1])
  // Unknown where the reader is: the first or the last prompt.
  expect([stepFrom(-1, 4, 1, none), stepFrom(-1, 4, -1, none)]).toEqual([0, 3])
  const second = (i: number) => i === 2
  expect([stepFrom(1, 4, 1, second), stepFrom(3, 4, -1, second)]).toEqual([3, 1])
  expect(stepFrom(-1, 0, 1, none)).toBe(-1)
})

test('/cc-cli-rail runs mid-turn and takes next and prev', async ($, on) => {
  const disk = beneath()
  world(on, {}, TRANSCRIPT, disk)
  await $.session.start({ cwd: '/t', surface: 'terminal', isInteractive: true })
  expect(disk.commands).toEqual([
    expect.objectContaining({ name: 'cc-cli-rail', immediate: true, argumentHint: '[show|hide|toggle|next|prev|first|last|<n>|find <words>]' }),
    // Argument-free, for a keybinding to name.
    expect.objectContaining({ name: 'cc-cli-rail-next', immediate: true }),
    expect.objectContaining({ name: 'cc-cli-rail-prev', immediate: true }),
    expect.objectContaining({ name: 'cc-cli-rail-toggle', immediate: true }),
  ])
  await $.classic.SessionStart({ source: 'resume', session_id: 's1', transcript_path: '/t/s1.jsonl' })
  const panes = disk.panes.length
  await $.command.run({ command: 'cc-cli-rail', args: 'next' })
  await $.command.run({ command: 'cc-cli-rail', args: 'prev' })
  // Neither is taken for a bad argument, and neither shows or hides the rail.
  expect(disk.toasts.filter(text => text.includes('/cc-cli-rail ['))).toEqual([])
  expect(disk.panes.length).toBe(panes)
})

test('a focused pane draws the same rows as an unfocused one, with no hotkeys', async ($, on) => {
  world(on)
  for (let i = 0; i < 10; i++) {
    const row = await $.ui.mount({ plugin: 'cc-cli-rail', surface: 'terminal', component: 'UserMessage', requestId: `p${i}`, props: prompt(`a long prompt number ${i} that would not fit`, null) })
    await row.unmount()
  }
  // A click focuses the pane as ctrl+x tab does, so a row that changed with the
  // focus would shift under the pointer that just pressed it.
  const rows = async (surface: 'terminal' | 'desktop', placement: 'dock' | 'inline', bodyColumns: number, isFocused: boolean) => {
    const site = await $.ui.mount({ plugin: 'cc-cli-rail', surface, component: 'Pane', requestId: 'cc-cli-rail', props: { ...pane(placement, bodyColumns), isFocused } })
    const drawn = jumpButtons(await site.findAll({ type: 'Button' })).map((b: any) => ({ label: b.props.label, hotkey: b.props.hotkey }))
    await site.unmount()
    return drawn
  }
  for (const [surface, placement, bodyColumns] of [['terminal', 'dock', 30], ['terminal', 'dock', 4], ['desktop', 'inline', 40]] as const) {
    const focused = await rows(surface, placement, bodyColumns, true)
    expect(focused.map(row => row.hotkey)).toEqual(Array(10).fill(undefined))
    expect(focused).toEqual(await rows(surface, placement, bodyColumns, false))
  }
})

// Two turns: the first edits files and records its duration, the second only
// replies, so its duration comes from the rows' timestamps.
const TURNS = jsonl([
  { type: 'user', uuid: 'u1', timestamp: '2026-09-24T00:00:00.000Z', message: { role: 'user', content: 'first' } },
  {
    type: 'assistant',
    uuid: 'a1',
    timestamp: '2026-09-24T00:00:10.000Z',
    message: {
      role: 'assistant',
      content: [
        { type: 'tool_use', id: 't1', name: 'Edit', input: { file_path: '/w/src/app.ts', old_string: 'a', new_string: 'b' } },
        { type: 'tool_use', id: 't2', name: 'Bash', input: { command: 'ls' } },
      ],
    },
  },
  { type: 'user', uuid: 'r1', message: { role: 'user', content: [{ type: 'tool_result', tool_use_id: 't1', content: 'ok' }] } },
  {
    type: 'assistant',
    uuid: 'a2',
    timestamp: '2026-09-24T00:01:00.000Z',
    message: {
      role: 'assistant',
      content: [
        { type: 'tool_use', id: 't3', name: 'Write', input: { file_path: '/w/README.md', content: '' } },
        { type: 'tool_use', id: 't4', name: 'Edit', input: { file_path: '/w/src/app.ts', old_string: 'b', new_string: 'c' } },
      ],
    },
  },
  { type: 'system', uuid: 'd1', subtype: 'turn_duration', durationMs: 83000, timestamp: '2026-09-24T00:01:23.000Z' },
  { type: 'user', uuid: 'u2', timestamp: '2026-09-24T00:02:00.000Z', message: { role: 'user', content: 'second' } },
  { type: 'assistant', uuid: 'a3', timestamp: '2026-09-24T00:02:07.000Z', message: { role: 'assistant', content: [{ type: 'text', text: 'done' }] } },
])

test('a turn is summed up as its duration, tool calls and edited files', () => {
  expect(turnLine({ durationMs: 83000, tools: 4, files: ['app.ts', 'README.md'] })).toBe('1m 23s · 4 tools · app.ts, README.md')
  expect(turnLine({ durationMs: 7000, tools: 1, files: [] })).toBe('7s · 1 tool')
  expect(turnLine({ durationMs: 3_720_000, tools: 0, files: [] })).toBe('1h 2m')
  expect(turnLine({ tools: 0, files: [] })).toBe('')
  expect(turnLine({ durationMs: 500, tools: 5, files: ['a.ts', 'b.ts', 'c.ts', 'd.ts', 'e.ts'] })).toBe('0s · 5 tools · a.ts, b.ts, c.ts +2')
})

test('every hover card carries its turn\'s details', async ($, on) => {
  world(on, {}, TURNS)
  await $.classic.SessionStart({ source: 'resume', session_id: 's1', transcript_path: '/t/s1.jsonl' })
  // No turn_duration row for the second: the time from the prompt to the turn's last row.
  expect(await cardDetails($)).toEqual(['first · 1m 23s · 4 tools · app.ts, README.md', 'second · 7s'])
})

test('a narrow band keeps room for the details by cutting the prompt first', async ($, on) => {
  world(on, {}, jsonl([
    { type: 'user', uuid: 'u1', timestamp: '2026-09-24T00:00:00.000Z', message: { role: 'user', content: 'a prompt far too long to fit in a narrow band beside its details' } },
    { type: 'system', uuid: 'd1', subtype: 'turn_duration', durationMs: 9000 },
  ]))
  await $.classic.SessionStart({ source: 'resume', session_id: 's1', transcript_path: '/t/s1.jsonl' })
  // Thirty-two cells (the band's forty less the card's inset): the text cut
  // to 27, then ` · 9s`.
  const [card] = await cardDetails($, { ...BAND, bodyColumns: 40 })
  expect(card).toBe('a prompt far too long to f… · 9s')
  expect(card.length).toBeLessThanOrEqual(32)
})

test('the hover card of a narrow vertical rail carries the turn\'s details', async ($, on) => {
  world(on, {}, TURNS)
  await $.classic.SessionStart({ source: 'resume', session_id: 's1', transcript_path: '/t/s1.jsonl' })
  await $.ui.mount({ plugin: 'cc-cli-rail', surface: 'terminal', component: 'Pane', requestId: 'cc-cli-rail', props: pane('dock', 4) })
  const band = await $.ui.mount({ plugin: 'cc-cli-rail', surface: 'terminal', component: 'AbovePrompt', props: BAND })
  expect(await band.find({ type: 'Text', text: /^first · 1m 23s · 4 tools · app\.ts, README\.md$/ })).toBeDefined()
})

test('a turn that ends redraws the rail, so its card carries the new details', async ($, on) => {
  const first = { type: 'user', uuid: 'u1', timestamp: '2026-09-24T00:00:00.000Z', message: { role: 'user', content: 'first' } }
  const disk = beneath(jsonl([first]))
  world(on, {}, disk.transcript, disk)
  await $.classic.SessionStart({ source: 'resume', session_id: 's1', transcript_path: '/t/s1.jsonl' })
  await railLabels($)
  const before = { invalidations: disk.invalidations, railRedraws: disk.railRedraws }
  disk.transcript = jsonl([first, { type: 'system', uuid: 'd1', subtype: 'turn_duration', durationMs: 4000 }])
  disk.mtimeMs = 2
  await $.classic.Stop({ session_id: 's1', transcript_path: '/t/s1.jsonl', stop_hook_active: false })
  expect(disk.railRedraws).toBe(before.railRedraws + 1)
  expect(disk.invalidations).toBe(before.invalidations)
})

test('nothing the rail learns draws the transcript rows again', async ($, on) => {
  // Every row the module hooks would be drawn again, and rows drawn again
  // while the person scrolls just after a jump move the viewport a turn away.
  const first = { type: 'user', uuid: 'u1', message: { role: 'user', content: 'first' } }
  const disk = beneath(jsonl([first]))
  world(on, {}, disk.transcript, disk)
  const clock = mock.clock(on)
  on('turn.start', ($: any, e: any) => ({ turnId: e.turnId }))
  on('turn.complete', ($: any, e: any) => ({ text: e.answer }))
  on('ui.scroll', () => ({ value: { deny: NOT_DRAWN } }))
  await $.classic.SessionStart({ source: 'resume', session_id: 's1', transcript_path: '/t/s1.jsonl' })
  await $.session.start({ cwd: '/t', surface: 'terminal', isInteractive: true })
  // A new prompt is drawn, its turn runs and ends, and the transcript has it.
  await $.ui.mount({ plugin: 'cc-cli-rail', surface: 'terminal', component: 'UserMessage', requestId: 'u2', props: prompt('second', null) })
  await $.turn.start({ text: 'second', turnId: 't1' })
  await $.turn.complete({ answer: 'done', durationMs: 3000, isAborted: false, turnId: 't1', reason: 'answer' })
  disk.transcript = jsonl([first, { type: 'user', uuid: 'u2', message: { role: 'user', content: 'second' } }])
  disk.mtimeMs = 2
  await $.classic.Stop({ session_id: 's1', transcript_path: '/t/s1.jsonl', stop_hook_active: false })
  // The pane narrows, and a jump is refused for want of a drawn row.
  const rail = await $.ui.mount({ plugin: 'cc-cli-rail', surface: 'terminal', component: 'Pane', requestId: 'cc-cli-rail', props: pane('dock', 40) })
  await rail.redraw(pane('dock', 4))
  await rail.press({ key: 'jump-0' })
  await clock.settle()
  expect(disk.railRedraws).toBeGreaterThan(0)
  expect(disk.invalidations).toBe(0)
})

test('a turn that just ended shows the duration the engine reported before the transcript has it', async ($, on) => {
  // At the Stop hook the transcript holds neither the turn_duration row nor
  // the turn's last reply: the rows' timestamps alone would say 7s.
  world(on, {}, TURNS)
  on('turn.complete', ($: any, e: any) => ({ text: e.answer }))
  await $.classic.SessionStart({ source: 'resume', session_id: 's1', transcript_path: '/t/s1.jsonl' })
  // A subagent's turn is not the prompt's.
  await $.turn.complete({ answer: '', durationMs: 99000, isAborted: false, turnId: 'sub', agentId: 'ag1', reason: 'answer' })
  await $.turn.complete({ answer: 'done', durationMs: 12500, isAborted: false, turnId: 'main', reason: 'answer' })
  // The second says 12s; the turn_duration row the transcript records wins
  // where it has one, as for the first.
  expect(await cardDetails($)).toEqual(['first · 1m 23s · 4 tools · app.ts, README.md', 'second · 12s'])
})

test('what the engine reported of a turn stays with its prompt once the stored row replaces a derived one', async ($, on) => {
  const disk = beneath(jsonl([]))
  world(on, {}, disk.transcript, disk)
  on('turn.complete', ($: any, e: any) => ({ text: e.answer }))
  await $.classic.SessionStart({ source: 'resume', session_id: 's1', transcript_path: '/t/s1.jsonl' })
  await drawSplit($, 'UserMessage', SPLIT_IDS.firstRow, null)
  await $.turn.complete({ answer: 'done', durationMs: 12500, isAborted: true, turnId: 'main', reason: 'aborted' })
  disk.transcript = jsonl([{ type: 'user', uuid: SPLIT_IDS.first, message: { role: 'user', content: 'first' } }])
  disk.mtimeMs = 2
  await $.classic.Stop({ session_id: 's1', transcript_path: '/t/s1.jsonl', stop_hook_active: false })
  expect(await cardDetails($)).toEqual(['first · 12s · interrupted'])
})

test('next and prev wait while a subagent transcript is in view', async ($, on) => {
  const disk = beneath()
  world(on, {}, TRANSCRIPT, disk)
  await $.classic.SessionStart({ source: 'resume', session_id: 's1', transcript_path: '/t/s1.jsonl' })
  const sub = await $.ui.mount({ plugin: 'cc-cli-rail', surface: 'terminal', component: 'Pane', requestId: 'cc-cli-rail', props: { ...pane('dock', 40), view: { agentId: 'ag1' } } })
  await $.command.run({ command: 'cc-cli-rail', args: 'next' })
  // No jump is tried there, so no refusal can dot a main-conversation prompt.
  // The engine names the plugin ahead of each toast.
  expect(disk.toasts).toEqual(['jumps move through the main conversation; switch back to it first'])
  await sub.unmount()
  expect((await railLabels($)).length).toBe(4)
  const main = await $.ui.mount({ plugin: 'cc-cli-rail', surface: 'terminal', component: 'AbovePrompt', props: BAND })
  await main.unmount()
  await $.command.run({ command: 'cc-cli-rail', args: 'prev' })
  expect(disk.toasts.filter(text => text.includes('switch back'))).toHaveLength(1)
})

test('a view that cannot scroll the transcript is said once, in plain words, and dots no prompt', () => {
  // The engine's refusal where no transcript viewport is bound, as in the desktop app.
  const UNSCROLLABLE = 'transcript not scrollable here'
  expect(jumpNotice(UNSCROLLABLE, false)).toMatch(/^jumps cannot land here/)
  expect(jumpNotice(UNSCROLLABLE, true)).toBeUndefined()
  // Any other refusal is passed on as the engine words it, every time.
  expect(jumpNotice(NOT_DRAWN, true)).toBe(NOT_DRAWN)
  // It says nothing of whether the prompt's row is drawn.
  expect(noteScroll(new Set<string>(), 'm1', UNSCROLLABLE)).toBe(false)
})

test('files that share a name are told apart by their folder', async ($, on) => {
  expect(turnLine({ tools: 2, files: ['/p/web/index.ts', '/p/api/index.ts', '/p/README.md'] })).toBe('2 tools · web/index.ts, api/index.ts, README.md')
  world(on, {}, jsonl([
    { type: 'user', uuid: 'u1', message: { role: 'user', content: 'first' } },
    {
      type: 'assistant',
      uuid: 'a1',
      message: {
        role: 'assistant',
        content: [
          { type: 'tool_use', id: 't1', name: 'Edit', input: { file_path: '/p/web/index.ts' } },
          { type: 'tool_use', id: 't2', name: 'Edit', input: { file_path: '/p/api/index.ts' } },
          { type: 'tool_use', id: 't3', name: 'Edit', input: { file_path: '/p/api/index.ts' } },
        ],
      },
    },
  ]))
  await $.classic.SessionStart({ source: 'resume', session_id: 's1', transcript_path: '/t/s1.jsonl' })
  expect(await cardDetails($)).toEqual(['first · 3 tools · web/index.ts, api/index.ts'])
})

test('a turn line too long for its room names fewer files and keeps the count', () => {
  const turn = { durationMs: 9000, tools: 3, files: ['/w/alpha.ts', '/w/beta.ts', '/w/gamma.ts'] }
  expect(turnLine(turn)).toBe('9s · 3 tools · alpha.ts, beta.ts, gamma.ts')
  expect(turnLine(turn, 26)).toBe('9s · 3 tools · alpha.ts +2')
  expect(turnLine(turn, 25)).toBe('9s · 3 tools · 3 files')
})

test('a long turn summary keeps its end in the card', async ($, on) => {
  world(on, {}, jsonl([
    { type: 'user', uuid: 'u1', message: { role: 'user', content: 'a prompt that is long enough to be cut in the card' } },
    {
      type: 'assistant',
      uuid: 'a1',
      message: {
        role: 'assistant',
        content: [
          { type: 'tool_use', id: 't1', name: 'Edit', input: { file_path: '/w/a-long-file-name.ts' } },
          { type: 'tool_use', id: 't2', name: 'Write', input: { file_path: '/w/another-long-name.ts' } },
        ],
      },
    },
    { type: 'system', uuid: 'd1', subtype: 'turn_duration', durationMs: 9000 },
  ]))
  await $.classic.SessionStart({ source: 'resume', session_id: 's1', transcript_path: '/t/s1.jsonl' })
  // Forty-two cells (the band's fifty less the card's inset): the file count
  // stays whole at the end.
  const [card] = await cardDetails($, { ...BAND, bodyColumns: 50 })
  expect(card).toMatch(/· 9s · 2 tools · 2 files$/)
  expect(card.length).toBeLessThanOrEqual(42)
})

test('slash-command rows and interruption notices are not listed as prompts', async ($, on) => {
  world(on, {}, jsonl([
    { type: 'user', uuid: 'u1', message: { role: 'user', content: 'first' } },
    { type: 'user', uuid: 'i1', message: { role: 'user', content: [{ type: 'text', text: '[Request interrupted by user]' }] } },
    { type: 'user', uuid: 'c1', message: { role: 'user', content: '/compact' } },
    { type: 'user', uuid: 'u2', message: { role: 'user', content: 'second' } },
    { type: 'user', uuid: 'i2', message: { role: 'user', content: [{ type: 'text', text: '[Request interrupted by user for tool use]' }] } },
  ]))
  await $.classic.SessionStart({ source: 'resume', session_id: 's1', transcript_path: '/t/s1.jsonl' })
  expect(await railLabels($)).toEqual(['first', 'second'])
})

// Three turns: interrupted, ended by an API error, and one that edited a file.
const OUTCOMES = jsonl([
  { type: 'user', uuid: 'u1', message: { role: 'user', content: 'first' } },
  { type: 'assistant', uuid: 'a1', message: { role: 'assistant', content: [{ type: 'text', text: 'partial' }] } },
  { type: 'user', uuid: 'i1', message: { role: 'user', content: [{ type: 'text', text: '[Request interrupted by user]' }] } },
  { type: 'user', uuid: 'u2', message: { role: 'user', content: 'second' } },
  { type: 'assistant', uuid: 'a2', isApiErrorMessage: true, message: { role: 'assistant', content: [{ type: 'text', text: 'API Error' }] } },
  { type: 'user', uuid: 'u3', message: { role: 'user', content: 'third' } },
  { type: 'assistant', uuid: 'a3', message: { role: 'assistant', content: [{ type: 'tool_use', id: 't1', name: 'Write', input: { file_path: '/w/a.ts' } }] } },
  { type: 'user', uuid: 'u4', message: { role: 'user', content: 'fourth' } },
])

test('a turn is summed up with how it ended', () => {
  expect(turnLine({ durationMs: 7000, tools: 1, files: [], outcome: 'interrupted' })).toBe('7s · interrupted · 1 tool')
  expect(turnLine({ tools: 0, files: [], outcome: 'error' })).toBe('API error')
  expect(turnLine({ tools: 2, files: [], outcome: 'running' })).toBe('running · 2 tools')
})

test('no rail draws a colored mark; how a turn went is left to its card', async ($, on) => {
  world(on, {}, OUTCOMES)
  await $.classic.SessionStart({ source: 'resume', session_id: 's1', transcript_path: '/t/s1.jsonl' })
  for (const [surface, placement] of [['terminal', 'dock'], ['desktop', 'inline']] as const) {
    const site = await $.ui.mount({ plugin: 'cc-cli-rail', surface, component: 'Pane', requestId: 'cc-cli-rail', props: pane(placement, 40) })
    expect(await site.findAll({ type: 'Text' })).toEqual([])
    await site.unmount()
  }
  expect(await cardDetails($)).toEqual(['first · interrupted', 'second · API error', 'third · 1 tool · a.ts', 'fourth'])
  // The band beside a narrow dock, then with the rail hidden: no colored mark either.
  const isMark = (t: any) => t.props.color !== undefined || ['×', '•'].includes(t.text)
  const site = await $.ui.mount({ plugin: 'cc-cli-rail', surface: 'terminal', component: 'Pane', requestId: 'cc-cli-rail', props: pane('dock', 4) })
  const band = await $.ui.mount({ plugin: 'cc-cli-rail', surface: 'terminal', component: 'AbovePrompt', props: BAND })
  expect((await band.findAll({ type: 'Text' })).length).toBeGreaterThan(0)
  expect((await band.findAll({ type: 'Text' })).filter(isMark)).toEqual([])
  await $.command.run({ command: 'cc-cli-rail', args: 'hide' })
  await site.unmount()
  expect(await band.find({ key: 'rail-show' })).toBeDefined()
  expect((await band.findAll({})).filter((node: any) => node.props?.color !== undefined)).toEqual([])
  await band.unmount()
  await $.command.run({ command: 'cc-cli-rail', args: 'show' })
  expect(await railLabels($)).toEqual(['first', 'second', 'third', 'fourth'])
})

test('the running turn\'s card says so until it ends, then how it ended', async ($, on) => {
  world(on, {}, '')
  on('turn.start', ($: any, e: any) => ({ turnId: e.turnId }))
  on('turn.complete', ($: any, e: any) => ({ text: e.answer }))
  await $.classic.SessionStart({ source: 'startup', session_id: 's1', transcript_path: '/t/s1.jsonl' })
  // The prompt's row is stored and drawn, then its turn starts.
  const row = await $.ui.mount({ plugin: 'cc-cli-rail', surface: 'terminal', component: 'UserMessage', requestId: 'u1', props: prompt('first', null) })
  await row.unmount()
  await $.turn.start({ text: 'first', turnId: 't1' })
  expect(await cardDetails($)).toEqual(['first · running'])
  await $.turn.complete({ answer: '', durationMs: 3000, isAborted: true, turnId: 't1', reason: 'aborted' })
  expect(await cardDetails($)).toEqual(['first · 3s · interrupted'])
})

// The status line belongs to the person: the rail pins nothing there, even
// where neither the pane nor the band shows it.
test('the rail never pins a status line', async ($, on) => {
  const disk = { ...beneath(), placed: false }
  world(on, {}, TRANSCRIPT, disk)
  await $.classic.SessionStart({ source: 'resume', session_id: 's1', transcript_path: '/t/s1.jsonl' })
  await $.session.start({ cwd: '/t', surface: 'terminal', isInteractive: true })
  await $.ui.mount({ plugin: 'cc-cli-rail', surface: 'terminal', component: 'UserMessage', requestId: 'u3', props: prompt('continue', { first: 0, last: 1, of: 2 }) })
  await $.command.run({ command: 'cc-cli-rail', args: 'hide' })
  await $.command.run({ command: 'cc-cli-rail', args: 'show' })
  await $.command.run({ command: 'cc-cli-rail', args: 'toggle' })
  await $.classic.Stop({ session_id: 's1', transcript_path: '/t/s1.jsonl', stop_hook_active: false })
  expect(disk.status).toEqual([])
})

test('a reply the transcript read has not seen yet counts as the newest prompt\'s', async ($, on) => {
  world(on)
  await $.classic.SessionStart({ source: 'resume', session_id: 's1', transcript_path: '/t/s1.jsonl' })
  // The Stop hook read the file before the turn's last reply was written, so
  // the index does not know this row; only the newest turn can own it.
  await $.ui.mount({
    plugin: 'cc-cli-rail',
    surface: 'terminal',
    component: 'AssistantMessage',
    requestId: 'late-reply',
    props: { text: 'done', onScreen: { first: 0, last: 1, of: 2 } },
  })
  expect(await heavyIn(await dock($))).toBe(3)
})

test('a prompt still drawn under its provisional id places no one', async ($, on) => {
  world(on)
  await $.classic.SessionStart({ source: 'resume', session_id: 's1', transcript_path: '/t/s1.jsonl' })
  await $.ui.mount({ plugin: 'cc-cli-rail', surface: 'terminal', component: 'UserMessage', requestId: 'u1', props: prompt('first stored prompt', { first: 0, last: 1, of: 2 }) })
  await $.ui.mount({ plugin: 'cc-cli-rail', surface: 'terminal', component: 'UserMessage', requestId: 'placeholder', props: prompt('fifth', { first: 0, last: 1, of: 2 }) })
  expect(await heavyIn(await dock($))).toBe(0)
})

test('a new prompt\'s turn runs under that prompt, not the one before it', async ($, on) => {
  world(on, {}, jsonl([{ type: 'user', uuid: 'u1', message: { role: 'user', content: 'first' } }]))
  on('turn.start', ($: any, e: any) => ({ turnId: e.turnId }))
  on('turn.complete', ($: any, e: any) => ({ text: e.answer }))
  await $.classic.SessionStart({ source: 'resume', session_id: 's1', transcript_path: '/t/s1.jsonl' })
  // The turn for "second" starts before its row is stored under its uuid.
  await $.turn.start({ text: 'second', turnId: 't2' })
  expect(await cardDetails($)).toEqual(['first'])
  const row = await $.ui.mount({ plugin: 'cc-cli-rail', surface: 'terminal', component: 'UserMessage', requestId: 'u2', props: prompt('second', null) })
  await row.unmount()
  expect(await cardDetails($)).toEqual(['first', 'second · running'])
  await $.turn.complete({ answer: 'ok', durationMs: 1000, isAborted: false, turnId: 't2', reason: 'answer' })
  // A continuation (no typed text) runs under the newest prompt at once.
  await $.turn.start({ text: '', turnId: 't3' })
  expect(await cardDetails($)).toEqual(['first', 'second · 1s · running'])
})

test('a repeated prompt\'s turn does not run under the earlier one with the same text', async ($, on) => {
  world(on)
  on('turn.start', ($: any, e: any) => ({ turnId: e.turnId }))
  await $.classic.SessionStart({ source: 'resume', session_id: 's1', transcript_path: '/t/s1.jsonl' })
  // The transcript ends in "continue"; the person sends "continue" again.
  await $.turn.start({ text: 'continue', turnId: 't5' })
  const isRunning = async () => (await cardDetails($)).map((details: string) => details.endsWith('running'))
  expect(await isRunning()).toEqual([false, false, false, false])
  const row = await $.ui.mount({ plugin: 'cc-cli-rail', surface: 'terminal', component: 'UserMessage', requestId: 'u5', props: prompt('continue', null) })
  await row.unmount()
  expect(await isRunning()).toEqual([false, false, false, false, true])
})

test('a late reply of the turn before stays with its prompt once a new one is sent', async ($, on) => {
  const disk = beneath()
  world(on, {}, TRANSCRIPT, disk)
  on('turn.start', ($: any, e: any) => ({ turnId: e.turnId }))
  await $.classic.SessionStart({ source: 'resume', session_id: 's1', transcript_path: '/t/s1.jsonl' })
  // The last reply of u4's turn was stored after the Stop hook read the file.
  disk.transcript = `${TRANSCRIPT}\n${JSON.stringify({ type: 'assistant', uuid: 'late', parentUuid: 'u4', message: { role: 'assistant', content: [{ type: 'text', text: 'done' }] } })}`
  disk.mtimeMs = 2
  await $.turn.start({ text: 'fifth', turnId: 't5' })
  const row = await $.ui.mount({ plugin: 'cc-cli-rail', surface: 'terminal', component: 'UserMessage', requestId: 'u5', props: prompt('fifth', null) })
  await row.unmount()
  await $.ui.mount({ plugin: 'cc-cli-rail', surface: 'terminal', component: 'AssistantMessage', requestId: 'late', props: { text: 'done', onScreen: { first: 0, last: 1, of: 2 } } })
  expect(await heavyIn(await dock($))).toBe(3)
})

// The engine reports a row's onScreen only when it changes, so a row that
// stays whole in the viewport is silent while another scrolls past it. A real
// pause between two reports, so reports read together only because they came
// together cannot pass these tests.
const quiet = () => new Promise(resolve => setTimeout(resolve, 200))

// A tool row of the running turn, which no transcript read knows yet.
const runningTool = (onScreen: { first: number; last: number; of: number } | null) => ({
  tool_use_id: 'toolu_running',
  tool: 'Bash',
  input: {},
  isRunning: true,
  isErrored: false,
  isInterrupted: false,
  onScreen,
})

const runFifth = async ($: any, on: any) => {
  world(on)
  on('turn.start', ($: any, e: any) => ({ turnId: e.turnId }))
  const clock = mock.clock(on)
  await $.classic.SessionStart({ source: 'resume', session_id: 's1', transcript_path: '/t/s1.jsonl' })
  await $.turn.start({ text: 'fifth', turnId: 't5' })
  const u5 = await $.ui.mount({ plugin: 'cc-cli-rail', surface: 'terminal', component: 'UserMessage', requestId: 'u5', props: prompt('fifth', null) })
  await u5.unmount()
  return clock
}

test('a scroll that brings a whole row to the top keeps the reader under it, not the running turn', async ($, on) => {
  const clock = await runFifth($, on)
  // u3 at the top, u4 whole below it, the running turn's tool row at the bottom.
  const u3 = await $.ui.mount({ plugin: 'cc-cli-rail', surface: 'terminal', component: 'UserMessage', requestId: 'u3', props: prompt('continue', { first: 1, last: 1, of: 2 }) })
  await $.ui.mount({ plugin: 'cc-cli-rail', surface: 'terminal', component: 'UserMessage', requestId: 'u4', props: prompt('continue', { first: 0, last: 1, of: 2 }) })
  const tool = await $.ui.mount({ plugin: 'cc-cli-rail', surface: 'terminal', component: 'ToolUse', requestId: 'toolu_running', props: runningTool({ first: 0, last: 1, of: 5 }) })
  const rail = await dock($)
  const heavy = () => heavyIn(rail)
  await clock.settle()
  expect(await heavy()).toBe(2)
  await quiet()
  // Scroll down a row: u3 leaves, u4 now starts at the top but was whole
  // before and stays whole, so only u3 and the tool row report.
  await u3.redraw(prompt('continue', null))
  await tool.redraw(runningTool({ first: 0, last: 2, of: 5 }))
  await clock.advance(200)
  expect(await heavy()).toBe(3)
})

test('a running tool row first drawn at the bottom of the viewport does not take the reader to it', async ($, on) => {
  const clock = await runFifth($, on)
  await $.ui.mount({ plugin: 'cc-cli-rail', surface: 'terminal', component: 'UserMessage', requestId: 'u4', props: prompt('continue', { first: 1, last: 1, of: 2 }) })
  const rail = await dock($)
  const heavy = () => heavyIn(rail)
  await clock.settle()
  expect(await heavy()).toBe(3)
  await quiet()
  // The turn calls a tool; its row is drawn under the viewport's bottom edge
  // before the layout moves the rows above it.
  await $.ui.mount({ plugin: 'cc-cli-rail', surface: 'terminal', component: 'ToolUse', requestId: 'toolu_running', props: runningTool({ first: 0, last: 1, of: 2 }) })
  await clock.settle()
  expect(await heavy()).toBe(3)
})

const mountRow = ($: any, requestId: string, text: string, onScreen: { first: number; last: number; of: number } | null) =>
  $.ui.mount({ plugin: 'cc-cli-rail', surface: 'terminal', component: 'UserMessage', requestId, props: prompt(text, onScreen) })

// A resumed session whose rail is left shown, as it is by default.
const shownWorld = async ($: any, on: any, transcript = TRANSCRIPT) => {
  const disk = beneath(transcript)
  world(on, {}, transcript, disk)
  on('turn.start', ($: any, e: any) => ({ turnId: e.turnId }))
  const clock = mock.clock(on)
  await $.classic.SessionStart({ source: 'resume', session_id: 's1', transcript_path: '/t/s1.jsonl' })
  return { disk, clock }
}

test('a row cut at the viewport top places the reader there, over rows that left untold', async ($, on) => {
  const { clock } = await shownWorld($, on)
  // u1 was cut at the top, then left in a jump that never said so.
  await mountRow($, 'u1', 'first stored prompt', { first: 1, last: 1, of: 2 })
  await mountRow($, 'u4', 'continue', { first: 1, last: 1, of: 2 })
  const rail = await dock($)
  await clock.advance(200)
  expect(await heavyIn(rail)).toBe(3)
})

test('a row replayed on screen for a moment, then corrected, moves no one', async ($, on) => {
  const { disk, clock } = await shownWorld($, on)
  await mountRow($, 'u2', '<div> why does this overflow?', { first: 0, last: 1, of: 2 })
  await mountRow($, 'u3', 'continue', { first: 0, last: 1, of: 2 })
  const rail = await dock($)
  await clock.advance(200)
  expect(await heavyIn(rail)).toBe(1)
  const before = disk.railRedraws
  // A remounted row replays where it was last seen, and the surface corrects it a frame later.
  const u4 = await mountRow($, 'u4', 'continue', { first: 12, last: 25, of: 26 })
  await clock.advance(13)
  await u4.redraw(prompt('continue', null))
  await clock.advance(200)
  expect(await heavyIn(rail)).toBe(1)
  expect(disk.railRedraws).toBe(before)
})

test('scrolling up places the reader at the row that entered at the top last', async ($, on) => {
  const { clock } = await shownWorld($, on)
  const u3 = await mountRow($, 'u3', 'continue', { first: 1, last: 1, of: 2 })
  const rail = await dock($)
  await clock.advance(200)
  expect(await heavyIn(rail)).toBe(2)
  await u3.redraw(prompt('continue', { first: 0, last: 1, of: 2 }))
  await mountRow($, 'u2', '<div> why does this overflow?', { first: 1, last: 1, of: 2 })
  await clock.advance(200)
  expect(await heavyIn(rail)).toBe(1)
})

test('a turn that starts while the person reads leaves the reader where they are', async ($, on) => {
  const { clock } = await shownWorld($, on)
  await mountRow($, 'u2', '<div> why does this overflow?', { first: 0, last: 1, of: 2 })
  const rail = await dock($)
  await clock.advance(200)
  expect(await heavyIn(rail)).toBe(1)
  await quiet()
  // A continuation moves nothing; its first tool row is drawn at the bottom.
  await $.turn.start({ text: '', turnId: 't5' })
  await $.ui.mount({ plugin: 'cc-cli-rail', surface: 'terminal', component: 'ToolUse', requestId: 'toolu_running', props: runningTool({ first: 0, last: 1, of: 2 }) })
  await clock.advance(200)
  expect(await heavyIn(rail)).toBe(1)
})

test("rows drawn while a subagent's transcript is in view do not place the reader", async ($, on) => {
  const { clock } = await shownWorld($, on)
  const rail = await dock($, { ...pane('dock', 40), view: { agentId: 'a1' } })
  await $.ui.mount({ plugin: 'cc-cli-rail', surface: 'terminal', component: 'ToolUse', requestId: 'toolu_sub', props: { ...runningTool({ first: 3, last: 5, of: 9 }), tool_use_id: 'toolu_sub' } })
  await rail.redraw(pane('dock', 40))
  await mountRow($, 'u2', '<div> why does this overflow?', { first: 0, last: 1, of: 2 })
  await clock.advance(200)
  await rail.redraw(pane('dock', 40))
  expect(await heavyIn(rail)).toBe(1)
})

test('reports that never pause still redraw the rail within a bounded wait', async ($, on) => {
  const { clock } = await shownWorld($, on)
  const u2 = await mountRow($, 'u2', '<div> why does this overflow?', { first: 1, last: 1, of: 2 })
  const tool = await $.ui.mount({ plugin: 'cc-cli-rail', surface: 'terminal', component: 'ToolUse', requestId: 'toolu_running', props: runningTool({ first: 0, last: 1, of: 9 }) })
  const rail = await dock($)
  await clock.advance(200)
  expect(await heavyIn(rail)).toBe(1)
  await u2.redraw(prompt('<div> why does this overflow?', null))
  await mountRow($, 'u3', 'continue', { first: 1, last: 1, of: 2 })
  // A tool row keeps drawing every 30 ms, as a running one does.
  for (let at = 0; at < 150; at += 30) {
    await clock.advance(30)
    await tool.redraw(runningTool({ first: 0, last: 1, of: 9 }))
  }
  expect(await heavyIn(rail)).toBe(2)
})

test('the prompt being read stays itself when a rewind drops an earlier one', async ($, on) => {
  const { disk, clock } = await shownWorld($, on)
  await mountRow($, 'u4', 'continue', { first: 1, last: 1, of: 2 })
  const rail = await dock($)
  await clock.advance(200)
  expect(await heavyIn(rail)).toBe(3)
  disk.transcript = jsonl([
    { type: 'user', uuid: 'u1', message: { role: 'user', content: 'first stored prompt' } },
    { type: 'user', uuid: 'u3', message: { role: 'user', content: 'continue' } },
    { type: 'user', uuid: 'u4', message: { role: 'user', content: 'continue' } },
  ])
  disk.mtimeMs = 2
  await stop($)
  await clock.advance(200)
  expect(await heavyIn(rail)).toBe(2)
})

test('rows split from one message are seen apart', async ($, on) => {
  const { clock } = await shownWorld($, on, SPLIT)
  const top = await drawSplit($, 'UserMessage', SPLIT_IDS.firstRow, { first: 1, last: 1, of: 2 })
  await drawSplit($, 'UserMessage', 'dae2bfb1-3f75-4882-a3e4-000000000001', { first: 0, last: 1, of: 2 })
  const rail = await dock($)
  await clock.advance(200)
  expect(await heavyIn(rail)).toBe(0)
  await quiet()
  // The first row leaves at the top; its sibling stays whole and silent.
  await top.redraw(prompt('first', null))
  await mountRow($, SPLIT_IDS.second, 'second', { first: 0, last: 0, of: 2 })
  await clock.advance(200)
  expect(await heavyIn(rail)).toBe(0)
})

test('rows that left untold stay gone once a row cut at the top has settled', async ($, on) => {
  const { clock } = await shownWorld($, on)
  // u1 was cut at the top when the viewport jumped away without it saying so.
  await mountRow($, 'u1', 'first stored prompt', { first: 1, last: 1, of: 2 })
  const u4 = await mountRow($, 'u4', 'continue', { first: 1, last: 1, of: 2 })
  const rail = await dock($)
  await clock.advance(200)
  expect(await heavyIn(rail)).toBe(3)
  // A scroll up brings u4 whole to the very top; no row is cut there now.
  await u4.redraw(prompt('continue', { first: 0, last: 1, of: 2 }))
  await clock.advance(200)
  expect(await heavyIn(rail)).toBe(3)
})

test('a row cut at the top that left untold does not hold the reader when the viewport moves above it', async ($, on) => {
  const { clock } = await shownWorld($, on)
  // u3 is cut at the top; a long scroll up unmounts it without it saying so.
  await mountRow($, 'u3', 'continue', { first: 1, last: 1, of: 2 })
  const rail = await dock($)
  await clock.advance(200)
  expect(await heavyIn(rail)).toBe(2)
  // The rows drawn at the new place start whole at the very top.
  await mountRow($, 'u1', 'first stored prompt', { first: 0, last: 1, of: 2 })
  await mountRow($, 'u2', '<div> why does this overflow?', { first: 0, last: 1, of: 2 })
  await clock.advance(200)
  expect(await heavyIn(rail)).toBe(0)
})

test('rows that left untold are dropped even while reports never pause', async ($, on) => {
  const { clock } = await shownWorld($, on)
  // u1 was cut at the top when the viewport jumped away without it saying so.
  await mountRow($, 'u1', 'first stored prompt', { first: 1, last: 1, of: 2 })
  const tool = await $.ui.mount({ plugin: 'cc-cli-rail', surface: 'terminal', component: 'ToolUse', requestId: 'toolu_running', props: runningTool({ first: 0, last: 1, of: 9 }) })
  const u3 = await mountRow($, 'u3', 'continue', { first: 1, last: 1, of: 2 })
  const rail = await dock($)
  // A running tool row keeps drawing every 30 ms; u3 turns whole at the top meanwhile.
  for (let at = 0; at < 300; at += 30) {
    await clock.advance(30)
    await tool.redraw(runningTool({ first: 0, last: 1, of: 9 }))
    if (at === 150) await u3.redraw(prompt('continue', { first: 0, last: 1, of: 2 }))
  }
  expect(await heavyIn(rail)).toBe(2)
})

// Hiding the rail to a button in the band above the prompt, and showing it again.

const band = ($: any, props: Record<string, unknown> = BAND) =>
  $.ui.mount({ plugin: 'cc-cli-rail', surface: 'terminal', component: 'AbovePrompt', props })

// A resumed session of four prompts, its rail shown and drawn beside the band.
const shownRail = async ($: any, on: any) => {
  const disk = beneath()
  const store = world(on, {}, TRANSCRIPT, disk)
  const clock = mock.clock(on)
  await $.classic.SessionStart({ source: 'resume', session_id: 's1', transcript_path: '/t/s1.jsonl' })
  const rail = await dock($)
  const above = await band($)
  await clock.settle()
  expect(await above.find({ key: 'rail-show' })).toBeUndefined()
  return { disk, store, clock, rail, above }
}

test('the pane keeps its hide button on the bottom-right corner, over the rows', async ($, on) => {
  await drawPrompts($, on)
  for (const [props, label, top] of [
    [pane('dock', 40), ' » hide', 19],
    [pane('dock', 4), ' » ', 19],
    [{ ...pane('dock', 40), view: { agentId: 'ag1' } }, ' » hide', 19],
    // Scrolled down a long list: the corner follows the window.
    [{ ...pane('dock', 40), scroll: { offset: 5, bodyRows: 20 } }, ' » hide', 24],
  ] as const) {
    const site = await dock($, props)
    const corner = await site.find({ key: 'rail-hide-corner' })
    expect(corner?.props.position).toBe('absolute')
    expect(corner?.props.top).toBe(top)
    expect(corner?.props.right).toBe(0)
    expect((await site.find({ key: 'rail-hide' }))?.props.label).toBe(label)
    await site.unmount()
  }
})

test('pressing hide closes the pane and the band offers the prompts back', async ($, on) => {
  const { disk, store, rail, above } = await shownRail($, on)
  await rail.press({ key: 'rail-hide' })
  expect(disk.panes.at(-1)).toBe('close cc-cli-rail')
  expect(store.get('shown')).toBe(false)
  await rail.unmount()
  expect((await above.find({ key: 'rail-show' }))?.props.label).toBe('« prompts (4)')
})

test('pressing the band\'s button opens the pane, and the band gives way once it is drawn', async ($, on) => {
  const { disk, store, clock, rail, above } = await shownRail($, on)
  await rail.press({ key: 'rail-hide' })
  await rail.unmount()
  await above.press({ key: 'rail-show' })
  expect(disk.panes.at(-1)).toBe('open cc-cli-rail')
  expect(store.get('shown')).toBe(true)
  // Until the engine draws the pane, the button stays.
  expect(await above.find({ key: 'rail-show' })).toBeDefined()
  await dock($)
  await clock.settle()
  expect(await above.find({ key: 'rail-show' })).toBeUndefined()
})

test('/cc-cli-rail hide, show and toggle, and cc-cli-rail-toggle, hide and show the rail', async ($, on) => {
  const { disk, store, clock, rail, above } = await shownRail($, on)
  const run = (command: string, args = '') => $.command.run({ command, args })
  const isButtonUp = async () => (await above.find({ key: 'rail-show' })) !== undefined

  await run('cc-cli-rail', 'hide')
  expect([disk.panes.at(-1), store.get('shown'), await isButtonUp()]).toEqual(['close cc-cli-rail', false, true])
  await rail.unmount()

  await run('cc-cli-rail', 'show')
  expect([disk.panes.at(-1), store.get('shown')]).toEqual(['open cc-cli-rail', true])
  let shown = await dock($)
  await clock.settle()
  expect(await isButtonUp()).toBe(false)

  // Toggle, bare or named, hides a rail on screen and shows a hidden one.
  await run('cc-cli-rail', 'toggle')
  expect([disk.panes.at(-1), store.get('shown'), await isButtonUp()]).toEqual(['close cc-cli-rail', false, true])
  await shown.unmount()
  await run('cc-cli-rail')
  expect([disk.panes.at(-1), store.get('shown')]).toEqual(['open cc-cli-rail', true])
  shown = await dock($)
  await clock.settle()
  await run('cc-cli-rail-toggle')
  expect([disk.panes.at(-1), store.get('shown'), await isButtonUp()]).toEqual(['close cc-cli-rail', false, true])
  await shown.unmount()
  await run('cc-cli-rail-toggle')
  expect([disk.panes.at(-1), store.get('shown')]).toEqual(['open cc-cli-rail', true])

  // Shown but not drawn yet (the engine has not seated it): toggle asks again
  // rather than hiding a rail the person cannot see.
  await run('cc-cli-rail-toggle')
  expect([disk.panes.at(-1), store.get('shown'), await isButtonUp()]).toEqual(['open cc-cli-rail', true, true])

  // A word the rail does not know says how to use it, and moves nothing.
  const panes = disk.panes.length
  await run('cc-cli-rail', 'sideways')
  expect(disk.toasts.at(-1)).toBe('/cc-cli-rail [show|hide|toggle|next|prev|first|last|<n>|find <words>]')
  expect(disk.panes.length).toBe(panes)
})

// The kit's `$` raises no `ui.close` (the person's close mark), so this drives
// the module's own hooks, registered afresh, over an engine stood in for here.
const bareHooks = () => {
  const hooks: { name: string; match: any; fn: any }[] = []
  ;(register as any)((name: string, match: any, fn?: any) => hooks.push({ name, match: fn ? match : undefined, fn: fn ?? match }))
  const store = new Map<string, unknown>()
  const state = new Map<string, unknown>()
  const passed: string[] = []
  const panes: string[] = []
  const $: any = {
    store: { get: async (key: string) => store.get(key), set: async (key: string, value: unknown) => void store.set(key, value) },
    state: { get: async (k: any) => ({ value: state.get(k.key) }), set: async (k: any, value: unknown) => void state.set(k.key, value) },
    ui: {
      resolve: () => ({ Box: 'Box', Text: 'Text', Button: 'Button' }),
      // A terminal too narrow to seat the pane unasked.
      open: async (e: any) => (panes.push(`open ${e.id}`), { isPlaced: false, reason: 'the terminal is 100 columns wide' }),
      close: async (e: any) => void panes.push(`close ${e.id}`),
      toast: () => {},
    },
    clock: { after: (ms: number, fire: () => void) => (fire(), { cancel() {} }) },
  }
  const fire = (name: string, e: any) =>
    hooks
      .find(hook => hook.name === name && (hook.match === undefined || hook.match.component === e.component))!
      .fn($, e, async (passing: any) => (passed.push(name), passing && {}))
  // The band's button that shows the rail, if the band draws one.
  const showButton = async () => {
    const tree = await fire('ui.render', { component: 'AbovePrompt', surface: 'terminal', props: { ...BAND, view: {} } })
    return (tree?.children ?? []).find((child: any) => child?.props?.key === 'rail-show')
  }
  return { fire, store, state, passed, panes, showButton }
}

test('a person closing the pane hides the rail to the band\'s button', async () => {
  const { fire, store, state, passed, panes, showButton } = bareHooks()
  await fire('ui.render', { component: 'UserMessage', requestId: 'u1', props: { text: 'first', origin: { kind: 'composer' } } })
  await fire('ui.render', { component: 'Pane', requestId: 'cc-cli-rail', surface: 'terminal', props: pane('dock', 40) })
  expect(await showButton()).toBeUndefined()
  // A plugin's close (the rail's own hide makes one) is not the person's.
  await fire('ui.close', { id: 'cc-cli-rail', origin: { kind: 'plugin' } })
  expect(store.has('shown')).toBe(false)
  expect(await showButton()).toBeUndefined()
  const moved = state.get('moved')
  passed.length = 0
  await fire('ui.close', { id: 'cc-cli-rail', origin: { kind: 'person' } })
  // The close goes through; the rail stays hidden for later sessions and its
  // sites are drawn again.
  expect(passed).toEqual(['ui.close'])
  expect(store.get('shown')).toBe(false)
  expect(state.get('moved')).not.toBe(moved)
  expect((await showButton())?.props.label).toBe('« prompts (1)')
  // That redraw comes before the close lands, so the engine may draw the pane
  // once more. A rail shown again then waits for a draw of its own: where the
  // engine does not seat it, the button stays, and toggle asks again.
  await fire('ui.render', { component: 'Pane', requestId: 'cc-cli-rail', surface: 'terminal', props: pane('dock', 40) })
  await fire('command.run', { command: 'cc-cli-rail', args: 'show' })
  expect(panes.at(-1)).toBe('open cc-cli-rail')
  expect(await showButton()).toBeDefined()
  await fire('command.run', { command: 'cc-cli-rail-toggle', args: '' })
  expect([panes.at(-1), store.get('shown')]).toEqual(['open cc-cli-rail', true])
})

test('a rail shown again that the engine does not seat keeps the band\'s button up', async ($, on) => {
  const { disk, rail, above } = await shownRail($, on)
  await rail.press({ key: 'rail-hide' })
  await rail.unmount()
  // Too narrow a terminal: the engine waits to draw the pane it was asked for.
  disk.placed = false
  await above.press({ key: 'rail-show' })
  expect(disk.panes.at(-1)).toBe('open cc-cli-rail')
  expect(await above.find({ key: 'rail-show' })).toBeDefined()
})

test('a rail hidden in an earlier session starts hidden, its button up', async ($, on) => {
  const disk = beneath()
  world(on, { shown: false, 'transcript:s1': { path: '/t/s1.jsonl', at: 1 } }, TRANSCRIPT, disk)
  await $.session.start({ cwd: '/t', surface: 'terminal', isInteractive: true })
  expect(disk.panes).toEqual(['close cc-cli-rail'])
  expect((await (await band($)).find({ key: 'rail-show' }))?.props.label).toBe('« prompts (4)')
})

test('the band holds no button with no prompts, or while a survey holds it', async ($, on) => {
  world(on, { shown: false }, jsonl([]))
  await $.classic.SessionStart({ source: 'resume', session_id: 's1', transcript_path: '/t/s1.jsonl' })
  await $.session.start({ cwd: '/t', surface: 'terminal', isInteractive: true })
  expect(await (await band($)).findAll({ type: 'Button' })).toEqual([])
  await drawRow($, 'u1', 'first')
  expect(await (await band($, { ...BAND, hasSurvey: true })).findAll({ type: 'Button' })).toEqual([])
  expect((await (await band($)).find({ key: 'rail-show' }))?.props.label).toBe('« prompts (1)')
})
