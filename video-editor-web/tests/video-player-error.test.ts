import { describe, expect, it } from 'vitest';
import { playerErrorText, UNDECODABLE_TEXT } from '../src/domain/playerError';

describe('playerErrorText', () => {
  it('stays quiet about a decoding failure while a light copy is being made', () => {
    expect(playerErrorText('Decoding error.', true)).toBeNull();
  });

  it('explains a decoding failure when no copy is coming', () => {
    expect(playerErrorText('Decoding error.', false)).toBe(UNDECODABLE_TEXT);
  });

  it('passes any other message through unchanged', () => {
    expect(playerErrorText('Falha ao abrir o arquivo', true)).toBe('Falha ao abrir o arquivo');
    expect(playerErrorText('Falha ao abrir o arquivo', false)).toBe('Falha ao abrir o arquivo');
  });
});
