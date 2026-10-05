import { readFileSync, readdirSync } from 'fs';
import { join } from 'path';
import { setLanguage, t } from '../../src/core/i18n/i18n';

const keys = [
  'Apagar projeto',
  'Apagar "{name}"? Esta ação não pode ser desfeita.',
  'Cancelar',
  'Apagar',
  'Não foi possível apagar',
  'Tente novamente.',
];

describe('i18n: delete project texts', () => {
  afterEach(() => setLanguage('pt'));

  it.each(['en', 'es'] as const)('%s has every key', async (lang) => {
    const dict = require(`../../src/core/i18n/locales/${lang}`).default as Record<string, string>;
    expect(keys.filter((k) => !(k in dict))).toEqual([]);
    await setLanguage(lang);
    expect(t('Apagar')).toBe(dict['Apagar']);
  });

  it('every t(...) literal in the Projects screen and its parts exists in en and es', () => {
    const screens = join(__dirname, '../../src/app/screens');
    const files = [
      join(screens, 'ProjectsScreen.tsx'),
      ...readdirSync(join(screens, 'projects')).map((f) => join(screens, 'projects', f)),
    ];
    const src = files.map((f) => readFileSync(f, 'utf8')).join(String.fromCharCode(10));
    const used = [...src.matchAll(/\bt\(\s*'((?:[^'\\]|\\.)*)'/g)].map((m) =>
      m[1].replace(/\\'/g, "'")
    );
    expect(used.length).toBeGreaterThan(10);
    for (const lang of ['en', 'es']) {
      const dict = require(`../../src/core/i18n/locales/${lang}`).default as Record<string, string>;
      expect({ lang, missing: used.filter((k) => !(k in dict)) }).toEqual({ lang, missing: [] });
    }
  });
});
