declare module 'claude-code' {
  interface PluginState {
    // Bumped when the prompt being read moves or the rail is shown or hidden;
    // the rail's sites read it while drawing, so a bump draws them again.
    'cc-cli-rail': { moved: number }
  }
}
