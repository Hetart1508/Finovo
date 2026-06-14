import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import './index.css';
import 'bootstrap-icons/font/bootstrap-icons.css';

// Metronic/KT theme scaffold (SCSS placeholder)
import './_metronic/assets/sass/style.scss';


createRoot(document.getElementById('root')!).render(
  <App />,
);
