import './style.css';
import { GameFeelStudioApp } from './ui/app';

const appRoot = document.getElementById('app');
if (appRoot) {
  new GameFeelStudioApp(appRoot);
}
