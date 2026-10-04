import { getLanguage, setLanguage, t } from './i18n';

describe('i18n', () => {
  afterEach(() => setLanguage('pt'));

  it('returns the Portuguese source text by default', () => {
    expect(t('Projetos')).toBe('Projetos');
  });

  it('translates after switching language and falls back for unknown keys', async () => {
    await setLanguage('en');
    expect(getLanguage()).toBe('en');
    expect(t('Projetos')).toBe('Projects');
    expect(t('texto sem tradução')).toBe('texto sem tradução');
  });

  it('fills placeholders', async () => {
    await setLanguage('es');
    expect(t('{n} projetos pendentes', { n: 3 })).toBe('3 proyectos pendientes');
  });
});
