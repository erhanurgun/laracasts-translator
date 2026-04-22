const { LCTTranscriptReader } = require('../lib/transcript-reader.js');

describe('LCTTranscriptReader.findDeep()', () => {
  it('direkt property\'yi dönmeli', () => {
    expect(LCTTranscriptReader.findDeep({ a: 1 }, 'a')).toBe(1);
  });

  it('iç içe property\'yi bulmalı', () => {
    expect(LCTTranscriptReader.findDeep({ x: { y: { target: 'found' } } }, 'target')).toBe('found');
  });

  it('yoksa null dönmeli', () => {
    expect(LCTTranscriptReader.findDeep({ a: 1 }, 'missing')).toBeNull();
    expect(LCTTranscriptReader.findDeep(null, 'x')).toBeNull();
    expect(LCTTranscriptReader.findDeep('not-object', 'x')).toBeNull();
  });
});

describe('LCTTranscriptReader.parseDataPage()', () => {
  it('geçerli JSON\'dan transcriptSegments çıkarmalı', () => {
    const dataPage = JSON.stringify({
      url: '/series/test',
      props: { lesson: { transcriptSegments: [{ id: 1, startTime: 0, endTime: 5, text: 'Hello' }] } }
    });
    const result = LCTTranscriptReader.parseDataPage(dataPage);
    expect(result.stale).toBe(false);
    expect(result.segments).toHaveLength(1);
  });

  it('URL uyuşmuyorsa stale=true dönmeli', () => {
    const dataPage = JSON.stringify({
      url: '/old',
      props: { transcriptSegments: [{ text: 'x' }] }
    });
    const result = LCTTranscriptReader.parseDataPage(dataPage, '/new');
    expect(result.stale).toBe(true);
    expect(result.segments).toBeNull();
  });

  it('bozuk JSON için stale=false, segments=null', () => {
    const result = LCTTranscriptReader.parseDataPage('not-json');
    expect(result.stale).toBe(false);
    expect(result.segments).toBeNull();
  });

  it('segments yoksa null', () => {
    const dataPage = JSON.stringify({ props: { lesson: {} } });
    expect(LCTTranscriptReader.parseDataPage(dataPage).segments).toBeNull();
  });

  it('boş segment array için null', () => {
    const dataPage = JSON.stringify({ props: { transcriptSegments: [] } });
    expect(LCTTranscriptReader.parseDataPage(dataPage).segments).toBeNull();
  });
});

describe('LCTTranscriptReader.mapSegments()', () => {
  it('HTML tag\'lerini strip etmeli', () => {
    const raw = [{ id: 1, startTime: 0, endTime: 1, text: '<b>bold</b> text' }];
    expect(LCTTranscriptReader.mapSegments(raw)[0].text).toBe('bold text');
  });

  it('id yoksa index+1 kullanmalı', () => {
    const raw = [{ startTime: 0, endTime: 1, text: 'hi' }];
    expect(LCTTranscriptReader.mapSegments(raw)[0].id).toBe('1');
  });

  it('text olmayan segmentleri atlamalı', () => {
    const raw = [
      { id: 1, text: 'ok', startTime: 0, endTime: 1 },
      { id: 2, startTime: 1, endTime: 2 } // text yok
    ];
    expect(LCTTranscriptReader.mapSegments(raw)).toHaveLength(1);
  });

  it('dizi olmayan için boş dizi', () => {
    expect(LCTTranscriptReader.mapSegments(null)).toEqual([]);
  });
});
