/**
 * YouTube'un kendi altyazı track'lerini devre dışı bırakır.
 * (Overlay ile çakışmaması için).
 * restore() ile listener'lar temizlenir.
 */
const LCTNativeTrackHandler = (() => {
  function disableAll(textTracks) {
    for (let i = 0; i < textTracks.length; i++) {
      if (textTracks[i].mode !== 'disabled') {
        textTracks[i].mode = 'disabled';
      }
    }
  }

  /**
   * @param {HTMLVideoElement} video
   * @returns {{target: TextTrackList, fn: Function}|null}
   */
  function disable(video) {
    if (!video || !video.textTracks) return null;
    const target = video.textTracks;
    const fn = () => disableAll(target);
    fn();
    target.addEventListener('addtrack', fn);
    target.addEventListener('change', fn);
    return { target, fn };
  }

  /**
   * @param {{target: TextTrackList, fn: Function}|null} handle
   */
  function restore(handle) {
    if (!handle || !handle.target) return;
    handle.target.removeEventListener('addtrack', handle.fn);
    handle.target.removeEventListener('change', handle.fn);
  }

  return Object.freeze({ disable, restore });
})();

if (typeof self !== 'undefined') {
  self.LCTNativeTrackHandler = LCTNativeTrackHandler;
}
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { LCTNativeTrackHandler };
}
