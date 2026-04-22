const { LCTNativeTrackHandler } = require('../lib/native-track-handler.js');

function createFakeTextTracks(initialModes) {
  const listeners = { addtrack: [], change: [] };
  const tracks = initialModes.map(mode => ({ mode }));
  return {
    length: tracks.length,
    0: tracks[0],
    1: tracks[1],
    2: tracks[2],
    addEventListener(type, fn) { (listeners[type] || []).push(fn); },
    removeEventListener(type, fn) {
      const arr = listeners[type] || [];
      const i = arr.indexOf(fn);
      if (i >= 0) arr.splice(i, 1);
    },
    fireAddTrack() { for (const fn of listeners.addtrack) fn(); },
    fireChange() { for (const fn of listeners.change) fn(); },
    _listeners: listeners,
    _tracks: tracks
  };
}

describe('LCTNativeTrackHandler.disable()', () => {
  it('video olmayan girdi için null dönmeli', () => {
    expect(LCTNativeTrackHandler.disable(null)).toBeNull();
    expect(LCTNativeTrackHandler.disable({})).toBeNull();
  });

  it('tüm track\'leri disable\'a çevirmeli', () => {
    const tracks = createFakeTextTracks(['showing', 'hidden', 'disabled']);
    const video = { textTracks: tracks };
    LCTNativeTrackHandler.disable(video);
    expect(tracks._tracks[0].mode).toBe('disabled');
    expect(tracks._tracks[1].mode).toBe('disabled');
    expect(tracks._tracks[2].mode).toBe('disabled');
  });

  it('addtrack event listener eklemeli', () => {
    const tracks = createFakeTextTracks(['disabled']);
    const video = { textTracks: tracks };
    LCTNativeTrackHandler.disable(video);
    expect(tracks._listeners.addtrack.length).toBe(1);
    expect(tracks._listeners.change.length).toBe(1);
  });

  it('addtrack fire edilince tekrar disable etmeli', () => {
    const tracks = createFakeTextTracks(['disabled']);
    const video = { textTracks: tracks };
    LCTNativeTrackHandler.disable(video);
    // YouTube oynatıcı sonradan track'i showing yapsın
    tracks._tracks[0].mode = 'showing';
    tracks.fireAddTrack();
    expect(tracks._tracks[0].mode).toBe('disabled');
  });
});

describe('LCTNativeTrackHandler.restore()', () => {
  it('handle yoksa hata vermemeli', () => {
    expect(() => LCTNativeTrackHandler.restore(null)).not.toThrow();
    expect(() => LCTNativeTrackHandler.restore(undefined)).not.toThrow();
  });

  it('event listener\'ları kaldırmalı', () => {
    const tracks = createFakeTextTracks(['disabled']);
    const video = { textTracks: tracks };
    const handle = LCTNativeTrackHandler.disable(video);
    LCTNativeTrackHandler.restore(handle);
    expect(tracks._listeners.addtrack.length).toBe(0);
    expect(tracks._listeners.change.length).toBe(0);
  });

  it('restore sonrası fire event tetiklenmemeli', () => {
    const tracks = createFakeTextTracks(['disabled']);
    const video = { textTracks: tracks };
    const handle = LCTNativeTrackHandler.disable(video);
    LCTNativeTrackHandler.restore(handle);
    tracks._tracks[0].mode = 'showing';
    tracks.fireAddTrack();
    // Listener kaldırılmış olduğu için disable'a dönmedi
    expect(tracks._tracks[0].mode).toBe('showing');
  });
});
