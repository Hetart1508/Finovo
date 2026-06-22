import { readFileSync } from 'node:fs';

const endpoints = [
  { module: 'auth', method: 'post', path: '/api/auth/register' },
  { module: 'auth', method: 'post', path: '/api/auth/register/verify-otp' },
  { module: 'auth', method: 'post', path: '/api/auth/forgot-password' },
  { module: 'auth', method: 'post', path: '/api/auth/reset-password' },
  { module: 'auth', method: 'post', path: '/api/auth/google' },
  { module: 'auth', method: 'post', path: '/api/auth/login' },
  { module: 'transactions', method: 'get', path: '/api/transactions' },
  { module: 'transactions', method: 'post', path: '/api/transactions' },
  { module: 'transactions', method: 'put', path: '/api/transactions/:id' },
  { module: 'transactions', method: 'delete', path: '/api/transactions/:id' },
  { module: 'calendar', method: 'patch', path: '/api/user/threshold' },
  { module: 'merchant-aliases', method: 'get', path: '/api/merchant-aliases' },
  { module: 'merchant-aliases', method: 'post', path: '/api/merchant-aliases' },
  { module: 'merchant-aliases', method: 'patch', path: '/api/merchant-aliases/:id' },
  { module: 'merchant-aliases', method: 'delete', path: '/api/merchant-aliases/:id' },
  { module: 'recurring', method: 'get', path: '/api/recurring' },
  { module: 'recurring', method: 'get', path: '/api/recurring/upcoming' },
  { module: 'recurring', method: 'post', path: '/api/recurring' },
  { module: 'recurring', method: 'patch', path: '/api/recurring/:id' },
  { module: 'recurring', method: 'delete', path: '/api/recurring/:id' },
  { module: 'investments', method: 'post', path: '/api/investments' },
  { module: 'investments', method: 'get', path: '/api/investments' },
  { module: 'investments', method: 'get', path: '/api/investments/summary' },
  { module: 'investments', method: 'get', path: '/api/investments/:id' },
  { module: 'investments', method: 'put', path: '/api/investments/:id' },
  { module: 'investments', method: 'delete', path: '/api/investments/:id' },
  { module: 'smart-upload', method: 'post', path: '/api/upload' },
  { module: 'smart-upload', method: 'post', path: '/api/ai/extract-bill' },
  { module: 'insights', method: 'post', path: '/api/ai/insights' },
  { module: 'statement-import', method: 'post', path: '/api/statement-import/preview' },
  { module: 'statement-import', method: 'post', path: '/api/statement-import/approve' },
];

const source = readFileSync(new URL('../server.ts', import.meta.url), 'utf8');
const missing = endpoints.filter(({ method, path }) => {
  const escapedPath = path.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return !new RegExp(`app\\.${method}\\(["']${escapedPath}["']`).test(source);
});

if (missing.length) {
  for (const endpoint of missing) {
    console.error(`Missing ${endpoint.method.toUpperCase()} ${endpoint.path} (${endpoint.module})`);
  }
  process.exitCode = 1;
} else {
  const modules = [...new Set(endpoints.map(({ module }) => module))];
  console.log(`Verified ${endpoints.length} API contracts across ${modules.length} modules: ${modules.join(', ')}`);
}
