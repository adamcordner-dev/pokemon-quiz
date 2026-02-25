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

  const name = cleanPokemonName(data.name as string);

  return {
    id: data.id as number,
    name,
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
 * Generate quiz questions.
 * Each question has 1 correct Pokemon (shown as image) and 3 wrong options.
 * All 4 options are shuffled.
 */
export async function generateQuestions(
  settings: GameSettings
): Promise<Question[]> {
  const totalPokemon = await getTotalPokemonCount();
  const questionsNeeded = settings.questionCount;

  // We need 4 unique Pokemon per question (1 correct + 3 wrong)
  const pokemonNeeded = questionsNeeded * 4;

  // Fetch more than needed to account for Pokemon without artwork
  const extraBuffer = Math.ceil(pokemonNeeded * 0.3);
  const idsToFetch = getRandomUniqueIds(
    Math.min(pokemonNeeded + extraBuffer, totalPokemon),
    totalPokemon
  );

  let validPokemon = await fetchPokemonBatch(idsToFetch);

  // If we still don't have enough, fetch more in rounds
  let attempts = 0;
  while (validPokemon.length < pokemonNeeded && attempts < 5) {
    attempts++;
    const existingIds = new Set(validPokemon.map((p) => p.id));
    const moreIds: number[] = [];

    while (moreIds.length < pokemonNeeded - validPokemon.length + 10) {
      const id = Math.floor(Math.random() * totalPokemon) + 1;
      if (!existingIds.has(id) && !moreIds.includes(id)) {
        moreIds.push(id);
      }
    }

    const morePokemon = await fetchPokemonBatch(moreIds);
    validPokemon = validPokemon.concat(morePokemon);
  }

  if (validPokemon.length < pokemonNeeded) {
    throw new Error(
      `Could not fetch enough Pokemon with artwork. Needed ${pokemonNeeded}, got ${validPokemon.length}.`
    );
  }

  // Ensure no duplicate names (some forms might clean to the same name)
  const seenNames = new Set<string>();
  const uniquePokemon: PokemonData[] = [];
  for (const p of validPokemon) {
    if (!seenNames.has(p.name)) {
      seenNames.add(p.name);
      uniquePokemon.push(p);
    }
  }

  if (uniquePokemon.length < pokemonNeeded) {
    throw new Error(
      `Not enough uniquely-named Pokemon. Needed ${pokemonNeeded}, got ${uniquePokemon.length}.`
    );
  }

  // Shuffle and slice into groups of 4
  const shuffled = shuffleArray(uniquePokemon).slice(0, pokemonNeeded);
  const questions: Question[] = [];

  for (let i = 0; i < questionsNeeded; i++) {
    const group = shuffled.slice(i * 4, i * 4 + 4);
    // First in group is the "correct" one (shown as image)
    const correctPokemon = group[0];

    // Build options array and shuffle it
    const options = shuffleArray(group.map((p) => p.name));
    const correctIndex = options.indexOf(correctPokemon.name);

    questions.push({
      questionId: crypto.randomUUID(),
      imageUrl: correctPokemon.imageUrl,
      options,
      correctIndex,
      correctName: correctPokemon.name,
      pokemonId: correctPokemon.id,
    });
  }

  return questions;
}
