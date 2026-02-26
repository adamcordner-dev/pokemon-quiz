// ============================================
// PokeAPI Service
// ============================================
// Fetches Pokemon data from PokeAPI and generates quiz questions.
// Only Pokemon with official artwork are used.

import { PokemonData, Question, GameSettings } from './types';
import { cleanPokemonName } from './nameCleaningService';
import crypto from 'crypto';

// --- Cache ---
let cachedTotalCount: number | null = null;

/**
 * Get the total number of Pokemon species from PokeAPI.
 * Cached after first call (per cold start).
 */
export async function getTotalPokemonCount(): Promise<number> {
  if (cachedTotalCount !== null) {
    return cachedTotalCount;
  }

  const response = await fetch(
    'https://pokeapi.co/api/v2/pokemon-species?limit=1'
  );
  if (!response.ok) {
    throw new Error(`PokeAPI species count request failed: ${response.status}`);
  }

  const data = await response.json();
  cachedTotalCount = data.count as number;
  return cachedTotalCount;
}

/**
 * Fetch a single Pokemon by ID from PokeAPI.
 * Returns null if the Pokemon has no official artwork.
 * Uses the species name (not form name) for the display name.
 */
export async function fetchPokemon(id: number): Promise<PokemonData | null> {
  const response = await fetch(`https://pokeapi.co/api/v2/pokemon/${id}`);
  if (!response.ok) {
    // Pokemon might not exist at this ID
    return null;
  }

  const data = await response.json();

  const imageUrl: string | null =
    data.sprites?.other?.['official-artwork']?.front_default ?? null;

  // Skip Pokemon without official artwork
  if (!imageUrl) {
    return null;
  }

  // Extract species name from the species URL (e.g. "minior" not "minior-red-meteor")
  const speciesName: string = data.species?.name ?? data.name;
  const name = cleanPokemonName(speciesName);

  // Extract types (e.g. ["fire", "flying"])
  const types: string[] = (data.types ?? [])
    .sort((a: { slot: number }, b: { slot: number }) => a.slot - b.slot)
    .map((t: { type: { name: string } }) => t.type.name);

  return {
    id: data.id as number,
    name,
    speciesName,
    types,
    imageUrl,
  };
}

/**
 * Generate unique random integers in range [1, max] (inclusive).
 */
function getRandomUniqueIds(count: number, max: number): number[] {
  const ids = new Set<number>();
  while (ids.size < count) {
    ids.add(Math.floor(Math.random() * max) + 1);
  }
  return Array.from(ids);
}

/**
 * Shuffle an array in place using Fisher-Yates algorithm.
 */
function shuffleArray<T>(array: T[]): T[] {
  const shuffled = [...array];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled;
}

/**
 * Fetch multiple Pokemon in parallel, batched to avoid overwhelming PokeAPI.
 * Returns only Pokemon that have valid artwork (non-null results).
 */
async function fetchPokemonBatch(ids: number[]): Promise<PokemonData[]> {
  const BATCH_SIZE = 20;
  const results: PokemonData[] = [];

  for (let i = 0; i < ids.length; i += BATCH_SIZE) {
    const batch = ids.slice(i, i + BATCH_SIZE);
    const batchResults = await Promise.all(batch.map((id) => fetchPokemon(id)));

    for (const result of batchResults) {
      if (result !== null) {
        results.push(result);
      }
    }
  }

  return results;
}

/**
 * Generate quiz questions with type-aware distractors.
 *
 * For each question:
 * - 1 correct Pokémon (shown as image)
 * - 2 wrong options that share at least one type with the correct answer
 * - 1 fully random wrong option
 * - No two options from the same species
 *
 * Falls back to random distractors if not enough type-matched Pokémon exist.
 */
export async function generateQuestions(
  settings: GameSettings
): Promise<Question[]> {
  const totalPokemon = await getTotalPokemonCount();
  const questionsNeeded = settings.questionCount;

  // Fetch a larger pool so we have enough for type-matching + dedup
  // We need 4 per question but want a generous pool for type matching
  const poolTarget = Math.max(questionsNeeded * 8, 80);
  const extraBuffer = Math.ceil(poolTarget * 0.3);
  const idsToFetch = getRandomUniqueIds(
    Math.min(poolTarget + extraBuffer, totalPokemon),
    totalPokemon
  );

  let validPokemon = await fetchPokemonBatch(idsToFetch);

  // If we still don't have enough, fetch more in rounds
  let attempts = 0;
  const minNeeded = questionsNeeded * 4;
  while (validPokemon.length < minNeeded && attempts < 5) {
    attempts++;
    const existingIds = new Set(validPokemon.map((p) => p.id));
    const moreIds: number[] = [];

    while (moreIds.length < minNeeded - validPokemon.length + 20) {
      const id = Math.floor(Math.random() * totalPokemon) + 1;
      if (!existingIds.has(id) && !moreIds.includes(id)) {
        moreIds.push(id);
      }
    }

    const morePokemon = await fetchPokemonBatch(moreIds);
    validPokemon = validPokemon.concat(morePokemon);
  }

  // Deduplicate by species name (keep first occurrence of each species)
  const seenSpecies = new Set<string>();
  const uniquePokemon: PokemonData[] = [];
  for (const p of validPokemon) {
    if (!seenSpecies.has(p.speciesName)) {
      seenSpecies.add(p.speciesName);
      uniquePokemon.push(p);
    }
  }

  if (uniquePokemon.length < minNeeded) {
    throw new Error(
      `Not enough uniquely-named Pokemon. Needed ${minNeeded}, got ${uniquePokemon.length}.`
    );
  }

  // Shuffle the pool and pick correct Pokémon for each question
  const shuffled = shuffleArray(uniquePokemon);
  const correctPokemon = shuffled.slice(0, questionsNeeded);
  const distractorPool = shuffled.slice(questionsNeeded);

  // Build a type index for fast lookup of type-matched distractors
  const typeIndex = new Map<string, PokemonData[]>();
  for (const p of distractorPool) {
    for (const t of p.types) {
      let list = typeIndex.get(t);
      if (!list) {
        list = [];
        typeIndex.set(t, list);
      }
      list.push(p);
    }
  }

  const usedSpecies = new Set<string>(correctPokemon.map((p) => p.speciesName));
  const questions: Question[] = [];

  for (const correct of correctPokemon) {
    const distractors: PokemonData[] = [];

    // --- Find 2 type-matched distractors ---
    // Collect candidates that share at least one type and aren't the same species
    const typeMatched: PokemonData[] = [];
    for (const t of correct.types) {
      const candidates = typeIndex.get(t) ?? [];
      for (const c of candidates) {
        if (
          c.speciesName !== correct.speciesName &&
          !usedSpecies.has(c.speciesName) &&
          !typeMatched.some((tm) => tm.speciesName === c.speciesName)
        ) {
          typeMatched.push(c);
        }
      }
    }

    // Shuffle and pick up to 2
    const shuffledTypeMatched = shuffleArray(typeMatched);
    for (const tm of shuffledTypeMatched) {
      if (distractors.length >= 2) break;
      usedSpecies.add(tm.speciesName);
      distractors.push(tm);
    }

    // --- Fill remaining slots (1 random + any unfilled type slots) ---
    for (const p of distractorPool) {
      if (distractors.length >= 3) break;
      if (
        p.speciesName !== correct.speciesName &&
        !usedSpecies.has(p.speciesName)
      ) {
        usedSpecies.add(p.speciesName);
        distractors.push(p);
      }
    }

    // Emergency fallback: if still not enough, relax constraints
    if (distractors.length < 3) {
      for (const p of uniquePokemon) {
        if (distractors.length >= 3) break;
        if (
          p.speciesName !== correct.speciesName &&
          !distractors.some((d) => d.speciesName === p.speciesName)
        ) {
          distractors.push(p);
        }
      }
    }

    // Build options and shuffle
    const allOptions = [correct, ...distractors];
    const shuffledOptions = shuffleArray(allOptions.map((p) => p.name));
    const correctIndex = shuffledOptions.indexOf(correct.name);

    questions.push({
      questionId: crypto.randomUUID(),
      imageUrl: correct.imageUrl,
      options: shuffledOptions,
      correctIndex,
      correctName: correct.name,
      pokemonId: correct.id,
    });
  }

  return questions;
}
