import AsyncStorage from '@react-native-async-storage/async-storage';
import { LocalProjectStorage } from './LocalProjectData';

jest.mock('expo-file-system/legacy', () => ({
  documentDirectory: 'file:///docs/',
  getInfoAsync: jest.fn(async () => ({ exists: false })),
}));

describe('LocalProjectStorage.writeBlobs', () => {
  beforeEach(async () => {
    await AsyncStorage.clear();
  });

  it('removes the project keys the new data no longer has', async () => {
    await AsyncStorage.multiSet([
      ['project:p1', '{"id":"p1"}'],
      ['history:p1', '{"index":1}'],
      ['history:p1#g1-0', '[1]'],
      ['history:p1#g1-1', '[2]'],
      ['project:p2', '{"id":"p2"}'],
    ]);

    await new LocalProjectStorage().writeBlobs(
      'p1',
      { 'project:p1': '{"id":"p1","name":"Nova"}', 'history:p1': '{"index":0}' },
      false
    );

    expect(await AsyncStorage.getItem('history:p1#g1-0')).toBeNull();
    expect(await AsyncStorage.getItem('history:p1#g1-1')).toBeNull();
    expect(await AsyncStorage.getItem('history:p1')).toBe('{"index":0}');
    expect(await AsyncStorage.getItem('project:p1')).toBe('{"id":"p1","name":"Nova"}');
    expect(await AsyncStorage.getItem('project:p2')).toBe('{"id":"p2"}');
  });
});
