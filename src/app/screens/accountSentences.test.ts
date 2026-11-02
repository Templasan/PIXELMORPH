import { endSentence, joinSentences } from './accountSentences';

describe('endSentence', () => {
  it('ends with exactly one period', () => {
    expect(endSentence('1 removido da conta.')).toBe('1 removido da conta.');
    expect(endSentence('1 removido da conta')).toBe('1 removido da conta.');
    expect(endSentence('1 removido da conta..')).toBe('1 removido da conta.');
  });
});

describe('joinSentences', () => {
  it('does not double the period between the removed count and the missing files', () => {
    expect(
      joinSentences([
        '1 removido da conta.',
        '24 arquivos não encontrados neste aparelho (Viagem).',
      ])
    ).toBe('1 removido da conta. 24 arquivos não encontrados neste aparelho (Viagem).');
  });

  it('skips empty parts without leaving a stray period', () => {
    expect(joinSentences(['', 'Tudo em dia.', ''])).toBe('Tudo em dia.');
    expect(joinSentences(['', ''])).toBe('');
  });

  it('gives every combination of report parts one period per sentence, and never two', () => {
    const parts = [
      '3 projetos enviados',
      '1 removido da conta.',
      '2 removidos da conta em outro aparelho: mantidos aqui.',
      '1 em conflito: mantido como está (Viagem).',
      '25 arquivos não encontrados neste aparelho (Praia).',
    ];
    for (let mask = 1; mask < 1 << parts.length; mask++) {
      const chosen = parts.filter((_, i) => mask & (1 << i));
      const text = joinSentences(chosen);
      expect(text).not.toMatch(/\.\./);
      expect(text.endsWith('.')).toBe(true);
      expect((text.match(/\./g) ?? []).length).toBe(chosen.length);
    }
  });
});
