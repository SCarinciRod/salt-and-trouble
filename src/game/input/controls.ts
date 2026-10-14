import type { Action, Actions } from '../types';

const keyActions: Record<string, Action> = {
  KeyW: 'forward',
  ArrowUp: 'forward',
  KeyA: 'left',
  ArrowLeft: 'left',
  KeyD: 'right',
  ArrowRight: 'right',
  Space: 'front',
  KeyQ: 'port',
  KeyE: 'starboard',
};

export function createControls(
  isActive: () => boolean,
  onPause: () => void,
  mouseTarget: HTMLElement,
) {
  const heldKeys = new Set<string>();
  const touch = new Set<Action>();
  const mouse = new Set<Action>();
  const clear = () => {
    heldKeys.clear();
    touch.clear();
    mouse.clear();
  };
  function down(event: KeyboardEvent) {
    if (
      !isActive() ||
      event.target instanceof HTMLInputElement ||
      event.target instanceof HTMLTextAreaElement
    )
      return;
    if (event.repeat && !heldKeys.has(event.code)) return;
    if (event.code === 'Escape') {
      event.preventDefault();
      onPause();
      clear();
      return;
    }
    if (keyActions[event.code]) {
      event.preventDefault();
      heldKeys.add(event.code);
    }
  }
  function up(event: KeyboardEvent) {
    heldKeys.delete(event.code);
  }
  function blur() {
    if (isActive()) onPause();
    clear();
  }
  function visibility() {
    if (document.hidden) blur();
  }
  function mouseDown(event: MouseEvent) {
    if (!isActive() || (event.button !== 0 && event.button !== 2)) return;
    event.preventDefault();
    mouse.add(event.button === 0 ? 'port' : 'starboard');
  }
  function mouseUp(event: MouseEvent) {
    if (event.button === 0) mouse.delete('port');
    if (event.button === 2) mouse.delete('starboard');
  }
  function contextMenu(event: MouseEvent) {
    event.preventDefault();
  }
  window.addEventListener('keydown', down);
  window.addEventListener('keyup', up);
  window.addEventListener('blur', blur);
  document.addEventListener('visibilitychange', visibility);
  mouseTarget.addEventListener('mousedown', mouseDown);
  window.addEventListener('mouseup', mouseUp);
  mouseTarget.addEventListener('contextmenu', contextMenu);

  return {
    clear,
    read(): Actions {
      const actions: Actions = {};
      for (const key of heldKeys) {
        const action = keyActions[key];
        if (action) actions[action] = true;
      }
      for (const action of touch) actions[action] = true;
      for (const action of mouse) actions[action] = true;
      return actions;
    },
    setTouch(action: Action, pressed: boolean) {
      if (pressed && isActive()) touch.add(action);
      else touch.delete(action);
    },
    destroy() {
      clear();
      window.removeEventListener('keydown', down);
      window.removeEventListener('keyup', up);
      window.removeEventListener('blur', blur);
      document.removeEventListener('visibilitychange', visibility);
      mouseTarget.removeEventListener('mousedown', mouseDown);
      window.removeEventListener('mouseup', mouseUp);
      mouseTarget.removeEventListener('contextmenu', contextMenu);
    },
  };
}
