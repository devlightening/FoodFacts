export function detectAllergens(allergens: string[] | undefined): 'present' | 'absent' | 'unknown' {
  if (!allergens) {
    return 'unknown';
  }

  return allergens.length > 0 ? 'present' : 'absent';
}
