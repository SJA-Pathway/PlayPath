import './ui/style.css';
import { Game } from './game';

const canvas = document.getElementById('game') as HTMLCanvasElement;
const gl = canvas.getContext('webgl2');
if (!gl) {
  document.body.innerHTML = '<p style="padding:24px;font:16px system-ui;color:#d6e4f0;background:#04060c">NEXUS needs WebGL 2. Try a current version of Chrome, Edge, Firefox or Safari.</p>';
} else {
  // Expose for debugging in the console: window.nexus
  (window as unknown as { nexus: Game }).nexus = new Game(canvas);
}
