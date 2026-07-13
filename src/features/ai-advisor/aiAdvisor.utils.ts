export { formatCurrency as formatAdvisorCurrency } from '@/src/utils/formatters';

export const stripAdvisorReasoning = (text: string) => {
  let sanitized = text
    .replace(/&lt;\s*(\/?)\s*(think|analysis|reasoning)\b[^&]*?&gt;/gi, '<$1$2>')
    .replace(/<(think|analysis|reasoning)\b[^>]*>[\s\S]*?<\/\1\s*>/gi, '');

  sanitized = sanitized
    .replace(/^[\s\S]*?<\/(?:think|analysis|reasoning)\s*>/i, '')
    .replace(/<(?:think|analysis|reasoning)\b[^>]*>[\s\S]*$/i, '')
    .replace(/<\/?(?:think|analysis|reasoning)\b[^>]*>/gi, '');

  return sanitized.trim();
};
