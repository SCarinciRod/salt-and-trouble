import type { PlayerOptions } from '../game/config';

interface MainMenuProps {
  options: PlayerOptions;
  onPlay: () => void;
  onOptions: () => void;
  children?: React.ReactNode;
}

export function MainMenu({ options, onPlay, onOptions, children }: MainMenuProps) {
  return (
    <main className="home-shell">
      <header className="masthead">
        <a className="wordmark" href="/" aria-label="Salt and Trouble home">
          <span className="brand-emblem" aria-hidden="true">
            ⚓
          </span>{' '}
          SALT & TROUBLE
        </a>
        <span className="header-note">A PERFECTLY QUESTIONABLE NAVAL ADVENTURE</span>
        <span className="edition">
          VOL. 01 <span aria-hidden="true">/</span> PIRATE BATTLE
        </span>
      </header>
      <section className="hero" aria-labelledby="game-title">
        <div className="hero-copy">
          <span className="eyebrow">
            <span className="status-dot" /> CAPTAIN WANTED · COMMON SENSE OPTIONAL
          </span>
          <h1 id="game-title">
            <span>Salt &</span>
            <span className="title-trouble">
              Trouble<span className="title-period">.</span>
            </span>
          </h1>
          <p className="hero-tagline">
            Bad decisions.
            <br />
            <em>Excellent cannons.</em>
          </p>
          <p className="hero-description">
            One ship. A sea full of enemies. A captain whose qualifications are, frankly,
            concerning.
          </p>
          <div className="hero-actions">
            <button className="button button-coral" onClick={onPlay}>
              Play <span aria-hidden="true">↗</span>
            </button>
            <button className="button button-outline" onClick={onOptions}>
              Options <span aria-hidden="true">⚙</span>
            </button>
          </div>
          <div className="voyage-meta">
            <span>
              <strong>{options.sessionSeconds}s</strong> TO MAKE HISTORY
            </span>
            <span>
              <strong>1</strong> QUESTIONABLE CAPTAIN
            </span>
            <span>
              <strong>0</strong> REFUNDS
            </span>
          </div>
        </div>
        <div className="hero-art" aria-hidden="true">
          <img className="sea-scene" src="/assets/ui_scene_background.png" alt="" />
          <div className="art-grid" />
          <div className="map-label map-label-top">THE SEA OF POOR DECISIONS</div>
          <div className="captain-stamp">
            CERTIFIED
            <br />
            <strong>UNQUALIFIED</strong>
            <br />
            SINCE FIVE MINUTES AGO
          </div>
          <div className="ship-showcase">
            <div className="ship-wake" />
            <img src="/assets/png/retina/ships/ship_2.png" alt="" />
          </div>
          <div className="map-coordinates">
            23° S · 46° W<br />
            <span>PROBABLY NOT WHERE YOU PARKED</span>
          </div>
          <div className="map-compass">
            N<span>✦</span>S
          </div>
          <div className="map-label map-label-bottom">HERE BE TROUBLE. YOU BROUGHT HALF OF IT.</div>
        </div>
      </section>
      <section className="captains-manual" aria-label="Keyboard controls">
        <div className="manual-heading">
          <span className="eyebrow">THE VERY SHORT MANUAL</span>
          <p>Steer. Shoot. Try floating.</p>
        </div>
        <div className="control-item">
          <div>
            <kbd>W</kbd>
            <kbd>A</kbd>
            <kbd>D</kbd>
          </div>
          <span>Forward & turn</span>
        </div>
        <div className="control-item">
          <div>
            <kbd className="wide-key">SPACE</kbd>
          </div>
          <span>Front cannon</span>
        </div>
        <div className="control-item">
          <div>
            <kbd>LMB</kbd>
            <kbd>RMB</kbd>
          </div>
          <span>Left & right broadside · Q / E also work</span>
        </div>
        <div className="control-item">
          <div>
            <kbd>ESC</kbd>
          </div>
          <span>Pause the panic</span>
        </div>
      </section>
      {children}
      <footer className="home-footer">
        <span>BUILT FOR THE JUNGLE GAMING CHALLENGE</span>
        <span>THE OCEAN ACCEPTS NO LIABILITY.</span>
      </footer>
    </main>
  );
}
