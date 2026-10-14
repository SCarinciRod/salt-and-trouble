import { useEffect, useRef, useState } from 'react';
import './tutorial.css';

export function TutorialDialog({ onDismiss }: { onDismiss: () => void }) {
  const dialog = useRef<HTMLDialogElement>(null);
  const dismissAction = useRef<(() => void) | null>(null);
  const [closing, setClosing] = useState(false);

  useEffect(() => {
    const element = dialog.current;
    let dismissed = false;
    let timer: ReturnType<typeof setTimeout> | undefined;
    element?.showModal();

    function beginDismissal() {
      if (dismissed) return;
      dismissed = true;
      setClosing(true);
      const duration = window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 0 : 220;
      timer = setTimeout(onDismiss, duration);
    }
    dismissAction.current = beginDismissal;
    function dismiss(event: Event) {
      event.preventDefault();
      event.stopPropagation();
      beginDismissal();
    }
    function preventMenu(event: Event) {
      event.preventDefault();
    }
    window.addEventListener('keydown', dismiss, true);
    window.addEventListener('pointerdown', dismiss, true);
    window.addEventListener('contextmenu', preventMenu, true);
    return () => {
      clearTimeout(timer);
      dismissAction.current = null;
      element?.close();
      window.removeEventListener('keydown', dismiss, true);
      window.removeEventListener('pointerdown', dismiss, true);
      window.removeEventListener('contextmenu', preventMenu, true);
    };
  }, [onDismiss]);

  return (
    <dialog
      ref={dialog}
      className={`options-dialog tutorial-dialog${closing ? ' is-closing' : ''}`}
      aria-labelledby="tutorial-title"
      onCancel={(event) => event.preventDefault()}
    >
      <div className="tutorial-heading">
        <span className="eyebrow">BEFORE YOU BECOME A CAUTIONARY TALE</span>
        <span aria-hidden="true">⚓</span>
      </div>
      <h2 id="tutorial-title">
        A very short
        <br />
        survival guide
      </h2>
      <p>You're the captain. We're already concerned.</p>
      <dl className="tutorial-controls">
        <div>
          <dt>
            <kbd>W</kbd>
            <kbd>A</kbd>
            <kbd>D</kbd>
          </dt>
          <dd>Move forward & turn</dd>
        </div>
        <div>
          <dt>
            <kbd className="wide-key">SPACE</kbd>
          </dt>
          <dd>Fire the front cannon</dd>
        </div>
        <div>
          <dt>
            <kbd>LMB</kbd>
          </dt>
          <dd>Left mouse → left broadside</dd>
        </div>
        <div>
          <dt>
            <kbd>RMB</kbd>
          </dt>
          <dd>Right mouse → right broadside</dd>
        </div>
        <div>
          <dt>
            <kbd>ESC</kbd>
          </dt>
          <dd>Pause the panic</dd>
        </div>
      </dl>
      <p className="tutorial-footnote">
        Hold a mouse button to keep firing. Q / E also work.
        <br />
        On mobile, use the buttons below the sea.
      </p>
      <button
        className="button button-coral"
        type="button"
        onClick={() => dismissAction.current?.()}
      >
        Set sail <span aria-hidden="true">↗</span>
      </button>
      <small className="tutorial-dismiss">
        Press any key or click anywhere to begin.
        <br />
        This first input closes the guide. Your cannons can wait.
      </small>
    </dialog>
  );
}
