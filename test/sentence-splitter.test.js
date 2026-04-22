const { LCTSentenceSplitter } = require('../lib/sentence-splitter.js');

describe('LCTSentenceSplitter.split()', () => {
  it('tek cümle olan segment\'i bölmemeli', () => {
    const seg = { id: '1', startTime: 0, endTime: 5, text: 'Hello world.' };
    expect(LCTSentenceSplitter.split(seg)).toEqual([seg]);
  });

  it('iki cümleyi bölmeli ve zamanı karakter oranıyla dağıtmalı', () => {
    const seg = {
      id: '1',
      startTime: 0,
      endTime: 10,
      text: 'First sentence here. Second sentence continues longer text.'
    };
    const parts = LCTSentenceSplitter.split(seg);
    expect(parts.length).toBe(2);
    expect(parts[0].text).toBe('First sentence here.');
    expect(parts[1].text).toBe('Second sentence continues longer text.');
    expect(parts[0].startTime).toBe(0);
    expect(parts[1].endTime).toBe(10);
    // Sınır tutarlı
    expect(parts[0].endTime).toBe(parts[1].startTime);
  });

  it('kısa parçaları (<10 karakter) öncekine birleştirmeli', () => {
    const seg = {
      id: '1',
      startTime: 0,
      endTime: 10,
      text: 'This is a longer sentence. Ok. Another proper sentence here.'
    };
    const parts = LCTSentenceSplitter.split(seg);
    // "Ok." 3 karakter, öncekine birleşmeli
    expect(parts.length).toBe(2);
    expect(parts[0].text).toContain('Ok.');
  });

  it('zamanlama yoksa (tek tip değilse) bölmemeli', () => {
    const seg = { id: '1', text: 'One sentence. Two sentence.' };
    expect(LCTSentenceSplitter.split(seg)).toEqual([seg]);
  });

  it('id formatı segmentId_N olmalı', () => {
    const seg = { id: 'seg42', startTime: 0, endTime: 10, text: 'First sentence body. Second sentence body.' };
    const parts = LCTSentenceSplitter.split(seg);
    expect(parts[0].id).toBe('seg42_1');
    expect(parts[1].id).toBe('seg42_2');
  });

  it('id yoksa _N kullanmalı', () => {
    const seg = { startTime: 0, endTime: 10, text: 'First sentence body. Second sentence body.' };
    const parts = LCTSentenceSplitter.split(seg);
    expect(parts[0].id).toBe('_1');
  });

  it('null segment için boş/güvenli dönmeli', () => {
    expect(LCTSentenceSplitter.split(null)).toEqual([]);
  });

  it('text olmayan segment için güvenli', () => {
    expect(LCTSentenceSplitter.split({ startTime: 0, endTime: 1 })).toEqual([{ startTime: 0, endTime: 1 }]);
  });

  it('zaman toplam süreyi korumalı', () => {
    const seg = {
      id: '1',
      startTime: 0,
      endTime: 20,
      text: 'A. B is longer. C stretches even further for testing purposes.'
    };
    const parts = LCTSentenceSplitter.split(seg);
    expect(parts[0].startTime).toBe(0);
    expect(parts[parts.length - 1].endTime).toBe(20);
  });
});
