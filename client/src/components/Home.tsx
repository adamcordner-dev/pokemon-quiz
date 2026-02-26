// ============================================
// Home Page
// ============================================

import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';

/** Pick a random Pokémon ID from the full National Dex */
function getRandomPokemonImageUrl(): string {
  const id = Math.floor(Math.random() * 1025) + 1;
  return `https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/other/official-artwork/${id}.png`;
}

export default function Home() {
  const [imageUrl] = useState(getRandomPokemonImageUrl);
  const [loaded, setLoaded] = useState(false);

  // Preload the image
  useEffect(() => {
    const img = new Image();
    img.src = imageUrl;
    img.onload = () => setLoaded(true);
  }, [imageUrl]);

  return (
    <div className="page-center">
      <div className="home-silhouette-container">
        {loaded ? (
          <img
            src={imageUrl}
            alt="Mystery Pokémon"
            className="home-silhouette"
          />
        ) : (
          <div className="home-silhouette-placeholder" />
        )}
      </div>
      <h1>Who's That Pokémon?</h1>
      <p>Test your Pokémon knowledge! Can you name them all?</p>
      <div className="button-stack">
        <Link to="/single-player" className="btn btn-primary">
          Solo
        </Link>
        <Link to="/multiplayer" className="btn btn-secondary">
          Multiplayer
        </Link>
      </div>
      <footer className="home-footer">
        <a
          href="https://github.com/adamcordner-dev/pokemon-quiz"
          target="_blank"
          rel="noopener noreferrer"
        >
          View on GitHub
        </a>
      </footer>
    </div>
  );
}
