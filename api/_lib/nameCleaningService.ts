// ============================================
// Pokemon Name Cleaning Service
// ============================================
// Converts raw PokeAPI names (lowercase, hyphenated) into
// display-friendly names. Special cases are stored in the
// map below for easy future updates.

/**
 * Exact-match overrides: raw PokeAPI name -> display name.
 * Add or edit entries here to fix any Pokemon name.
 */
const SPECIAL_NAMES: Record<string, string> = {
  // Gen 1
  'nidoran-f': 'Nidoran♀',
  'nidoran-m': 'Nidoran♂',
  'mr-mime': 'Mr. Mime',
  'farfetchd': "Farfetch'd",

  // Gen 2
  'ho-oh': 'Ho-Oh',

  // Gen 3
  // (none)

  // Gen 4
  'mime-jr': 'Mime Jr.',
  'porygon-z': 'Porygon-Z',

  // Gen 5
  // (none)

  // Gen 6
  'flabebe': 'Flabébé',

  // Gen 7
  'type-null': 'Type: Null',
  'jangmo-o': 'Jangmo-o',
  'hakamo-o': 'Hakamo-o',
  'kommo-o': 'Kommo-o',
  'tapu-koko': 'Tapu Koko',
  'tapu-lele': 'Tapu Lele',
  'tapu-bulu': 'Tapu Bulu',
  'tapu-fini': 'Tapu Fini',

  // Gen 8
  'mr-rime': 'Mr. Rime',
  'sirfetchd': "Sirfetch'd",

  // Gen 9
  'wo-chien': 'Wo-Chien',
  'chien-pao': 'Chien-Pao',
  'ting-lu': 'Ting-Lu',
  'chi-yu': 'Chi-Yu',
  'great-tusk': 'Great Tusk',
  'scream-tail': 'Scream Tail',
  'brute-bonnet': 'Brute Bonnet',
  'flutter-mane': 'Flutter Mane',
  'slither-wing': 'Slither Wing',
  'sandy-shocks': 'Sandy Shocks',
  'iron-treads': 'Iron Treads',
  'iron-bundle': 'Iron Bundle',
  'iron-hands': 'Iron Hands',
  'iron-jugulis': 'Iron Jugulis',
  'iron-moth': 'Iron Moth',
  'iron-thorns': 'Iron Thorns',
  'roaring-moon': 'Roaring Moon',
  'iron-valiant': 'Iron Valiant',
  'walking-wake': 'Walking Wake',
  'iron-leaves': 'Iron Leaves',
  'gouging-fire': 'Gouging Fire',
  'raging-bolt': 'Raging Bolt',
  'iron-boulder': 'Iron Boulder',
  'iron-crown': 'Iron Crown',
};

/**
 * Patterns for names that end with a specific suffix and should keep hyphens.
 * These are Pokemon whose names naturally contain hyphens.
 */
const KEEP_HYPHEN_PATTERNS = [
  /^ho-oh$/i,
  /^porygon-z$/i,
  /mo-o$/i,       // jangmo-o, hakamo-o, kommo-o
  /^wo-chien$/i,
  /^chien-pao$/i,
  /^ting-lu$/i,
  /^chi-yu$/i,
];

/**
 * Clean a raw PokeAPI Pokemon name into a display-friendly format.
 *
 * @param rawName - The lowercase, hyphenated name from PokeAPI (e.g. "mr-mime")
 * @returns The cleaned display name (e.g. "Mr. Mime")
 */
export function cleanPokemonName(rawName: string): string {
  // Check exact special case first
  const special = SPECIAL_NAMES[rawName.toLowerCase()];
  if (special) {
    return special;
  }

  // Strip form suffixes that PokeAPI sometimes includes
  // e.g. "deoxys-normal", "wormadam-plant", "giratina-altered"
  // We only want the base name
  const baseName = stripFormSuffix(rawName);

  // Check special cases again with stripped name
  const specialStripped = SPECIAL_NAMES[baseName.toLowerCase()];
  if (specialStripped) {
    return specialStripped;
  }

  // Check if this name should keep its hyphens
  const shouldKeepHyphen = KEEP_HYPHEN_PATTERNS.some((p) => p.test(baseName));

  if (shouldKeepHyphen) {
    // Capitalize each part but keep hyphens
    return baseName
      .split('-')
      .map(capitalize)
      .join('-');
  }

  // Default: capitalize each hyphen-separated part, join with space
  return baseName
    .split('-')
    .map(capitalize)
    .join(' ');
}

function capitalize(word: string): string {
  if (word.length === 0) return word;
  return word.charAt(0).toUpperCase() + word.slice(1).toLowerCase();
}

/**
 * Some PokeAPI Pokemon entries have form suffixes we want to remove.
 * e.g. "deoxys-normal" -> "deoxys", "wormadam-plant" -> "wormadam"
 * But we must NOT strip suffixes from names that legitimately use hyphens
 * (like "mr-mime" or "tapu-koko").
 */
const KNOWN_FORM_SUFFIXES = new Set([
  'normal', 'attack', 'defense', 'speed', 'plant', 'sandy', 'trash',
  'altered', 'origin', 'land', 'sky', 'standard', 'zen', 'incarnate',
  'therian', 'black', 'white', 'ordinary', 'resolute', 'aria', 'pirouette',
  'average', 'small', 'large', 'super', '50', '10', 'confined', 'unbound',
  'baile', 'pompom', 'pau', 'sensu', 'midday', 'midnight', 'dusk',
  'solo', 'school', 'red', 'orange', 'yellow', 'green', 'blue', 'indigo',
  'violet', 'shield', 'blade', 'male', 'female', 'full', 'meteor',
  'amped', 'lowkey', 'ice', 'noice', 'hangry', 'crowned', 'eternamax',
  'rapid', 'single', 'family', 'three', 'four', 'hero', 'stellar',
]);

function stripFormSuffix(name: string): string {
  const parts = name.toLowerCase().split('-');
  if (parts.length <= 1) return name;

  // Check if the last part is a known form suffix
  const lastPart = parts[parts.length - 1];
  if (KNOWN_FORM_SUFFIXES.has(lastPart)) {
    const stripped = parts.slice(0, -1).join('-');
    // Make sure we don't strip too much (at least 1 part must remain)
    if (stripped.length > 0) {
      return stripped;
    }
  }

  return name;
}
