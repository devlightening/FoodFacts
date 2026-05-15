export function detectAdditives(additives: string[] | undefined): 'present' | 'absent' | 'unknown' {
  if (!additives) {
    return 'unknown';
  }

  return additives.length > 0 ? 'present' : 'absent';
}
