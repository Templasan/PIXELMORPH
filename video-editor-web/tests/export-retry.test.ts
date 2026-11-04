import { describe, expect, it } from 'vitest';
import { shouldRetryWithCopies } from '../src/domain/exportRetry';

describe('shouldRetryWithCopies', () => {
  it('retries a decoding failure when the host can make copies', () => {
    expect(shouldRetryWithCopies('EncodingError: Decoding error.', false, true)).toBe(true);
  });

  it('does not retry when the person cancelled', () => {
    expect(shouldRetryWithCopies('EncodingError: Decoding error.', true, true)).toBe(false);
  });

  it('does not retry when the host cannot make copies', () => {
    expect(shouldRetryWithCopies('EncodingError: Decoding error.', false, false)).toBe(false);
  });

  it('does not retry other failures', () => {
    expect(shouldRetryWithCopies('Não foi possível gravar o arquivo', false, true)).toBe(false);
  });
});
