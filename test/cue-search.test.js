const { LCTCueSearch } = require('../lib/cue-search.js');

describe('LCTCueSearch.findActive()', () => {
  const cues = [
    { startTime: 0, endTime: 2, text: 'First' },
    { startTime: 2, endTime: 5, text: 'Second' },
    { startTime: 5, endTime: 7, text: 'Third' },
    { startTime: 10, endTime: 12, text: 'Fourth (gap before)' }
  ];

  it('aralık içindeki zamanda doğru cue\'yu bulur', () => {
    expect(LCTCueSearch.findActive(cues, 1).text).toBe('First');
    expect(LCTCueSearch.findActive(cues, 3).text).toBe('Second');
    expect(LCTCueSearch.findActive(cues, 6).text).toBe('Third');
    expect(LCTCueSearch.findActive(cues, 11).text).toBe('Fourth (gap before)');
  });

  it('sınır zamanlarda (startTime/endTime) cue bulur', () => {
    expect(LCTCueSearch.findActive(cues, 0).text).toBe('First');
    expect(LCTCueSearch.findActive(cues, 2).text).toMatch(/First|Second/);
  });

  it('cue aralık dışında null dönmeli', () => {
    expect(LCTCueSearch.findActive(cues, 8)).toBeNull();
    expect(LCTCueSearch.findActive(cues, 9.99)).toBeNull();
    expect(LCTCueSearch.findActive(cues, 100)).toBeNull();
    expect(LCTCueSearch.findActive(cues, -1)).toBeNull();
  });

  it('boş dizi için null dönmeli', () => {
    expect(LCTCueSearch.findActive([], 5)).toBeNull();
  });

  it('dizi olmayan girdi için null dönmeli', () => {
    expect(LCTCueSearch.findActive(null, 5)).toBeNull();
    expect(LCTCueSearch.findActive(undefined, 5)).toBeNull();
  });

  it('geçersiz zaman için null dönmeli', () => {
    expect(LCTCueSearch.findActive(cues, NaN)).toBeNull();
    expect(LCTCueSearch.findActive(cues, 'string')).toBeNull();
    expect(LCTCueSearch.findActive(cues, null)).toBeNull();
  });

  it('1000 cue üzerinde binary search doğru çalışır', () => {
    const bigCues = Array.from({ length: 1000 }, (_, i) => ({
      startTime: i * 2,
      endTime: i * 2 + 1.5,
      text: `c${i}`
    }));
    expect(LCTCueSearch.findActive(bigCues, 1000).text).toBe('c500');
    expect(LCTCueSearch.findActive(bigCues, 998.5).text).toBe('c499');
  });
});
