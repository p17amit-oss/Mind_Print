// Double-or-Bank placeholder (BUILD PROMPT Section 5). Full logic lands in
// Step 8; this keeps the session flow wired end-to-end.
export function DoubleOrBank({ onDone }: { onDone: () => void }) {
  onDone();
  return null;
}
