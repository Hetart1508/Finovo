import assert from 'node:assert/strict';
import { areTransactionIdentitiesSimilar, createTransactionFingerprint } from '../server/services/transactionDedup.ts';

const input = {
  walletId: 1,
  date: '2026-07-11',
  type: 'expense',
  amount: 100,
};

assert.equal(
  createTransactionFingerprint({ ...input, identity: 'donated in health secotr 100 rupees today' }),
  createTransactionFingerprint({ ...input, identity: 'donated in health secotr 100 rupees today' }),
  'the same single-line transaction must have a stable fingerprint'
);
assert.equal(
  areTransactionIdentitiesSimilar('donated in health secotr 100 rupees today', 'Donation to health sector'),
  true,
  'AI paraphrasing and a small typo must still be recognized as a probable duplicate'
);
assert.equal(
  areTransactionIdentitiesSimilar('Donation to health sector', 'Lunch at a restaurant'),
  false,
  'unrelated transactions with the same amount and date must remain distinct'
);

console.log('Transaction dedup verification passed: exact input, AI paraphrase, typo, and distinct-payment paths.');
