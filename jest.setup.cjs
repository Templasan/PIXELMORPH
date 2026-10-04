jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock'),
);

// expo-file-system is native-only; tests that care about files install their own fake.
jest.mock('expo-file-system/legacy', () => ({
  documentDirectory: 'file:///test-docs/',
  cacheDirectory: 'file:///test-cache/',
  makeDirectoryAsync: jest.fn(async () => undefined),
  writeAsStringAsync: jest.fn(async () => undefined),
  readAsStringAsync: jest.fn(async () => ''),
  getInfoAsync: jest.fn(async () => ({ exists: false })),
  deleteAsync: jest.fn(async () => undefined),
  readDirectoryAsync: jest.fn(async () => []),
  getTotalDiskCapacityAsync: jest.fn(async () => 0),
  getFreeDiskStorageAsync: jest.fn(async () => 0),
  EncodingType: { Base64: 'base64' },
}));
