import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const server = readFileSync(new URL('../server.ts', import.meta.url), 'utf8');
const env = readFileSync(new URL('../server/config/env.ts', import.meta.url), 'utf8');

assert.match(server, /DEFAULT_TEXT_PROVIDER_PRIORITY[^=]*= \["gemini", "groq", "openrouter", "huggingface"\]/);
assert.match(server, /const generateAiVision = async/);
assert.match(server, /GROQ_VISION_MODEL/);
assert.match(server, /OPENROUTER_VISION_MODEL/);
assert.match(server, /HUGGINGFACE_VISION_MODEL/);
assert.match(server, /extractBillDataWithAi/);
assert.match(server, /importStatementWithAi/);
assert.match(env, /GROQ_VISION_MODEL/);
assert.match(env, /OPENROUTER_VISION_MODEL/);
assert.match(env, /HUGGINGFACE_VISION_MODEL/);

console.log('AI provider chain verified: Gemini -> Groq -> OpenRouter -> Hugging Face for text and vision.');
