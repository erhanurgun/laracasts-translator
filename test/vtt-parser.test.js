const { VTTParser } = require('../lib/vtt-parser.js');

describe('VTTParser.parse()', () => {
  it('geçerli WebVTT\'yi cue dizisine çevirmeli', () => {
    const vtt = `WEBVTT

00:00:00.000 --> 00:00:03.000
Hello world

00:00:03.000 --> 00:00:06.000
Test subtitle`;
    const cues = VTTParser.parse(vtt);
    expect(cues).toHaveLength(2);
    expect(cues[0]).toEqual({ id: '', startTime: 0, endTime: 3, text: 'Hello world' });
    expect(cues[1].text).toBe('Test subtitle');
  });

  it('CRLF line ending\'leri normalize etmeli', () => {
    const vtt = 'WEBVTT\r\n\r\n00:00:00.000 --> 00:00:01.000\r\nText';
    expect(VTTParser.parse(vtt)[0].text).toBe('Text');
  });

  it('HTML tag\'lerini strip etmeli', () => {
    const vtt = 'WEBVTT\n\n00:00:00.000 --> 00:00:01.000\n<v Speaker>Text <b>bold</b></v>';
    expect(VTTParser.parse(vtt)[0].text).toBe('Text bold');
  });

  it('NOTE ve STYLE bloklarını atlamalı', () => {
    const vtt = `WEBVTT

NOTE This is a note

STYLE
::cue { color: white; }

00:00:00.000 --> 00:00:01.000
Valid subtitle`;
    const cues = VTTParser.parse(vtt);
    expect(cues).toHaveLength(1);
    expect(cues[0].text).toBe('Valid subtitle');
  });

  it('cue ID\'lerini yakalamalı', () => {
    const vtt = 'WEBVTT\n\ncue-1\n00:00:00.000 --> 00:00:01.000\nFirst';
    expect(VTTParser.parse(vtt)[0].id).toBe('cue-1');
  });

  it('MM:SS.mmm formatını desteklemeli', () => {
    const vtt = 'WEBVTT\n\n00:30.500 --> 00:35.000\nText';
    const cues = VTTParser.parse(vtt);
    expect(cues[0].startTime).toBe(30.5);
    expect(cues[0].endTime).toBe(35);
  });

  it('geçersiz/boş input için boş dizi dönmeli', () => {
    expect(VTTParser.parse('invalid')).toEqual([]);
    expect(VTTParser.parse('')).toEqual([]);
  });
});

describe('VTTParser._parseTimestamp()', () => {
  it('HH:MM:SS.mmm parse etmeli', () => {
    expect(VTTParser._parseTimestamp('01:23:45.678')).toBe(5025.678);
  });

  it('MM:SS.mmm parse etmeli', () => {
    expect(VTTParser._parseTimestamp('01:30.000')).toBe(90);
  });

  it('virgül ondalık ayracı desteklemeli', () => {
    expect(VTTParser._parseTimestamp('00:00:00,123')).toBe(0.123);
  });

  it('geçersiz format için null dönmeli', () => {
    expect(VTTParser._parseTimestamp('invalid')).toBeNull();
  });
});
