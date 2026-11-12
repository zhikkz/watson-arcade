// Links are ordinary anchors: games remain reachable without JavaScript.
(() => {
  'use strict';
  const games = [...document.querySelectorAll('[data-game]')];
  document.addEventListener('keydown', event => {
    if (event.defaultPrevented || event.repeat || event.altKey || event.ctrlKey || event.metaKey || event.shiftKey) return;
    if (['INPUT', 'TEXTAREA', 'SELECT'].includes(event.target.tagName) || event.target.isContentEditable) return;
    const index = games.indexOf(document.activeElement);
    const step = {ArrowLeft: -1, ArrowRight: 1};
    if (event.key in step) {
      event.preventDefault();
      games[index < 0 ? (event.key === 'ArrowLeft' ? games.length - 1 : 0) : (index + step[event.key] + games.length) % games.length].focus();
    } else if (event.key === 'Enter' && document.activeElement === document.body) {
      games[0].click();
    }
  });
})();
