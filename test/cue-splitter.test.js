const { LCTCueSplitter } = require('../lib/cue-splitter.js');

describe('LCTCueSplitter.split()', () => {
  it('kısa metni olduğu gibi dönmeli', () => {
    const cue = { id: '1', startTime: 0, endTime: 2, text: 'Short text' };
    const result = LCTCueSplitter.split(cue, 70);
    expect(result).toHaveLength(1);
    expect(result[0]).toEqual(cue);
  });

  it('virgülden bölmeli', () => {
    const text = 'First clause here with words, second clause also with words continuing';
    const cue = { id: 'c1', startTime: 0, endTime: 6, text };
    const result = LCTCueSplitter.split(cue, 40);
    expect(result.length).toBeGreaterThanOrEqual(2);
    expect(result[0].text.endsWith(',') || !result[0].text.includes(',')).toBe(true);
    expect(result[0].id).toBe('c1_a');
    expect(result[result.length - 1].id).toContain('_b');
  });

  it('bağlaçtan bölmeli (and/or/but/so)', () => {
    const text = 'First part here with many words and second part here with many words';
    const cue = { id: '', startTime: 0, endTime: 4, text };
    const result = LCTCueSplitter.split(cue, 40);
    expect(result.length).toBeGreaterThanOrEqual(2);
    const joined = result.map(r => r.text).join(' ');
    expect(joined.replace(/\s+/g, ' ')).toBe(text);
  });

  it('zaman dağılımı karakter oranıyla yapılmalı', () => {
    const text = 'Aaaa bbbb cccc, ddd eee fff';
    const cue = { id: '1', startTime: 0, endTime: 10, text };
    const result = LCTCueSplitter.split(cue, 15);
    expect(result.length).toBeGreaterThanOrEqual(2);
    // İlk parçanın endTime'ı ikincinin startTime'ı ile eşleşmeli
    for (let i = 0; i < result.length - 1; i++) {
      expect(result[i].endTime).toBe(result[i + 1].startTime);
    }
    // Toplam süre korunmalı
    expect(result[0].startTime).toBe(0);
    expect(result[result.length - 1].endTime).toBe(10);
  });

  it('çok uzun metinde recursive bölünmeli', () => {
    const text = 'One two three four five six, seven eight nine ten eleven twelve, thirteen fourteen fifteen sixteen seventeen eighteen';
    const cue = { id: 'x', startTime: 0, endTime: 12, text };
    const result = LCTCueSplitter.split(cue, 30);
    expect(result.length).toBeGreaterThanOrEqual(3);
    for (const part of result) {
      expect(part.text.length).toBeLessThanOrEqual(70); // yaklaşık
    }
  });

  it('break bulunamayan tek kelime\'yi bölmemeli', () => {
    const cue = { id: '1', startTime: 0, endTime: 1, text: 'ABCDEFGHIJKLMNOPQRSTUVWXYZABCDEFGHIJKLMN' };
    const result = LCTCueSplitter.split(cue, 20);
    expect(result).toHaveLength(1);
  });

  it('text alanı yoksa güvenli işlemeli', () => {
    expect(LCTCueSplitter.split(null)).toEqual([]);
    expect(LCTCueSplitter.split({ startTime: 0, endTime: 1 })).toEqual([{ startTime: 0, endTime: 1 }]);
  });

  it('id\'ler ardışık _a, _b, _a_a, _a_b formatında olmalı', () => {
    const text = 'Aaaa bbbb cccc dddd eeee, ffff gggg hhhh iiii jjjj, kkkk llll mmmm nnnn oooo';
    const cue = { id: 'base', startTime: 0, endTime: 6, text };
    const result = LCTCueSplitter.split(cue, 30);
    for (const r of result) {
      expect(r.id).toMatch(/^base(_[ab])+$/);
    }
  });
});
