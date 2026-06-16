import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import './_metronic/assets/fonticon/fonticon.css';
import './_metronic/assets/keenicons/duotone/style.css';
import './_metronic/assets/keenicons/outline/style.css';
import './_metronic/assets/keenicons/solid/style.css';
import './_metronic/assets/sass/style.scss';
import './_metronic/assets/sass/plugins.scss';
import './_metronic/assets/sass/style.react.scss';
import './index.css';

const savedTheme = localStorage.getItem('theme');
const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
document.documentElement.classList.toggle('dark', savedTheme ? savedTheme === 'dark' : prefersDark);

createRoot(document.getElementById('root')!).render(
  <App />,
);
