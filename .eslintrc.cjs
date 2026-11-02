// Layer boundaries from docs/architecture.md, enforced here instead of by convention (ADR-005).
// Each override sets the full rule for its files (ESLint does not merge rule options).
const INTERNALS = {
  group: ['@modules/*/infrastructure', '@modules/*/infrastructure/**', '@modules/*/application/**'],
  message: "Use the module's public index (@modules/<name>), not its internals.",
};
const FRAMEWORKS = {
  group: [
    'react',
    'react-native',
    'react-native-*',
    'expo',
    'expo-*',
    '@shopify/react-native-skia',
  ],
  message: 'domain/ is pure: no React, React Native, Expo or Skia.',
};

module.exports = {
  // The standalone web editor is linted and type-checked by its own project.
  ignorePatterns: ['video-editor-web/', 'photo-editor-web/'],
  root: true,
  extends: ['universe/native'],
  rules: {
    'import/order': 'off',
    'react/react-in-jsx-scope': 'off',
  },
  overrides: [
    // The owner's media server runs on Node: its globals (Buffer, URL, fetch's Response) are declared here.
    { files: ['media-server/**/*.{js,mjs}'], env: { node: true } },
    {
      files: ['src/app/**/*.{ts,tsx}', 'src/modules/**/*.{ts,tsx}'],
      rules: { 'no-restricted-imports': ['error', { patterns: [INTERNALS] }] },
    },
    {
      files: ['src/modules/*/domain/**/*.{ts,tsx}'],
      excludedFiles: ['**/*.test.ts'],
      rules: {
        'no-restricted-imports': [
          'error',
          {
            patterns: [
              INTERNALS,
              FRAMEWORKS,
              {
                group: ['**/infrastructure/**', '**/application/**'],
                message: 'domain/ depends on nothing.',
              },
            ],
          },
        ],
      },
    },
    {
      files: ['src/core/**/*.{ts,tsx}'],
      rules: {
        'no-restricted-imports': [
          'error',
          {
            patterns: [
              {
                group: ['@modules/*', '@modules/**', '**/modules/**', '@app/*', '**/app/**'],
                message: 'core/ is the shared kernel: it must not depend on modules or the app.',
              },
            ],
          },
        ],
      },
    },
  ],
};
