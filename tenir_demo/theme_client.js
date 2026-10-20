// The appearance preference changes presentation only, including on local files.
(() => {
  'use strict';
  const root = document.documentElement;
  const control = document.getElementById('theme-toggle');
  if (!control) return;
  let theme = 'dark';
  try {
    const saved = localStorage.getItem('tenir-reg-theme');
    if (saved === 'dark' || saved === 'light') theme = saved;
  } catch (error) {}
  function renderTheme() {
    const english = root.lang === 'en';
    const light = theme === 'light';
    root.setAttribute('data-theme', theme);
    const action = light ? (english ? 'Dark mode' : 'Mode sombre') : (english ? 'Light mode' : 'Mode clair');
    control.textContent = action;
    control.setAttribute('aria-label', english ? 'Switch to ' + action.toLowerCase() : 'Passer en ' + action.toLowerCase());
    control.setAttribute('title', control.getAttribute('aria-label'));
  }
  control.addEventListener('click', () => {
    theme = theme === 'dark' ? 'light' : 'dark';
    try { localStorage.setItem('tenir-reg-theme', theme); } catch (error) {}
    renderTheme();
  });
  for (const id of ['language-fr', 'language-en', 'language-toggle']) {
    const languageControl = document.getElementById(id);
    if (languageControl) languageControl.addEventListener('click', renderTheme);
  }
  renderTheme();
})();
