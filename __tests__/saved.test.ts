import { describe, expect, it, jest } from '@jest/globals';
import { parseSaved, toggled } from '../src/lib/saved';

// the native storage isn't there under Jest; its own mock stands in
// eslint-disable-next-line @typescript-eslint/no-require-imports
jest.mock('@react-native-async-storage/async-storage', () => require('@react-native-async-storage/async-storage/jest/async-storage-mock'));

describe('places kept for later', () => {
  it('puts a new place first and takes a saved one off', () => {
    expect(toggled(['wawel'], 'sukiennice')).toEqual(['sukiennice', 'wawel']);
    expect(toggled(['sukiennice', 'wawel'], 'wawel')).toEqual(['sukiennice']);
  });

  it('reads back only a list of names, once each', () => {
    expect(parseSaved('["a","b","a",3,null]')).toEqual(['a', 'b']);
    expect(parseSaved('{"a":1}')).toEqual([]);
    expect(parseSaved('not json')).toEqual([]);
    expect(parseSaved(null)).toEqual([]);
  });
});
