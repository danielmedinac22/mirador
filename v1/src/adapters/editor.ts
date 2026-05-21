// Placeholder: in VS-02 we only print paths in the "Next:" line of the session
// brief. A future iteration may shell out to $EDITOR or VS Code via `code <path>`.
export function suggestEditorOpen(path: string): string {
  return `open ${path}`;
}
