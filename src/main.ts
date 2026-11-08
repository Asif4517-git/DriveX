import './styles.css';
import { mountGamePage } from './pages/GamePage';
import { mountPreviewPage } from './pages/PreviewPage';
import { mountStartPage } from './pages/StartPage';
import { mountAboutPage } from './pages/AboutPage';
import { mountControlsPage } from './pages/ControlsPage';
import { mountGaragePage } from './pages/GaragePage';

const app = document.getElementById('app')!;
let dispose: (() => void) | null = null;

function render(): void {
  dispose?.();
  const hash = window.location.hash;
  if (hash === '#/garage') dispose = mountGaragePage(app);
  else if (hash === '#/controls') dispose = mountControlsPage(app);
  else if (hash === '#/about') dispose = mountAboutPage(app);
  else if (hash === '#/world') dispose = mountGamePage(app, 'free-roam');
  else if (hash === '#/game') dispose = mountGamePage(app);
  else if (hash === '#/preview') dispose = mountPreviewPage(app);
  else dispose = mountStartPage(app);
}

window.addEventListener('hashchange', render);
render();
