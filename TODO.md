# TODO

## Metronic/KT Theme Integration (Vite + React)

- [x] Add required dependencies to `package.json` (Bootstrap, animate.css, Metronic-like theme deps, charts, prism, icons, MUI libs).
- [x] Configure Vite to compile SCSS theme assets and include global theme stylesheet.
- [x] Create `src/_metronic/` scaffolding and add theme entrypoint SCSS files (`assets/sass/style.scss`, `plugins.scss`, `style.react.scss`).


- [ ] Add placeholder/theme CSS imports for bootstrap/animate/icons so the app renders with correct base styling.
- [ ] Implement RTL build output in a Vite-compatible way (generate `*.rtl.css` via rtlcss post-build and load conditionally).

- [ ] Wire theme imports into `src/main.tsx` or `src/index.css`.
- [ ] Add Prism/Markdown code highlighting integration in `Insights.tsx` (optional once theme is stable).
- [ ] Add ApexCharts support into Dashboard widgets (optional; keep existing charts working).
- [x] Run `npm run build`, and fix TS errors introduced by existing bad `src/lib/gemini.ts`.
- [ ] Implement RTL css generation pipeline + conditional runtime loading.
- [ ] Run `npm run dev` and verify UI styling at runtime.


