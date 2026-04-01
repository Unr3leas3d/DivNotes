export function reconcileWorkspaceGroupExpansion(
  visibleHostnames: readonly string[],
  expandedHostnames: ReadonlySet<string>
): Set<string> {
  const next = new Set<string>();

  for (const hostname of visibleHostnames) {
    if (expandedHostnames.has(hostname)) {
      next.add(hostname);
    }
  }

  if (next.size === 0 && visibleHostnames.length > 0) {
    next.add(visibleHostnames[0]);
  }

  const nextValues = [...next];
  const currentValues = [...expandedHostnames];
  const isSame =
    nextValues.length === currentValues.length &&
    nextValues.every((value, index) => value === currentValues[index]);

  return isSame ? (expandedHostnames as Set<string>) : next;
}
