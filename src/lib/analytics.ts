import ReactGA from 'react-ga4';

const measurementId = import.meta.env.VITE_GA_MEASUREMENT_ID;

let initialized = false;

export const initAnalytics = () => {
  if (!measurementId || initialized) return;

  ReactGA.initialize(measurementId);
  initialized = true;
};

export const trackPageView = (path: string, title = document.title) => {
  if (!initialized) return;

  ReactGA.send({
    hitType: 'pageview',
    page: path,
    title,
  });
};
