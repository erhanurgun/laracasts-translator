const { LCTBatchBuilder } = require('../lib/batch-builder.js');

describe('LCTBatchBuilder.build()', () => {
  it('boş dizi için boş batch listesi dönmeli', () => {
    expect(LCTBatchBuilder.build([])).toEqual([]);
  });

  it('50 altı eleman tek batch dönmeli', () => {
    const items = Array.from({ length: 30 }, (_, i) => i);
    const batches = LCTBatchBuilder.build(items);
    expect(batches).toHaveLength(1);
    expect(batches[0].startIndex).toBe(0);
    expect(batches[0].items).toHaveLength(30);
  });

  it('tam 50 eleman tek batch olmalı', () => {
    const items = Array.from({ length: 50 }, (_, i) => i);
    expect(LCTBatchBuilder.build(items)).toHaveLength(1);
  });

  it('51 eleman iki batch\'e bölünmeli (50 + 1)', () => {
    const items = Array.from({ length: 51 }, (_, i) => i);
    const batches = LCTBatchBuilder.build(items);
    expect(batches).toHaveLength(2);
    expect(batches[0].items).toHaveLength(50);
    expect(batches[1].items).toHaveLength(1);
    expect(batches[1].startIndex).toBe(50);
  });

  it('150 eleman üç batch\'e bölünmeli', () => {
    const items = Array.from({ length: 150 }, (_, i) => i);
    const batches = LCTBatchBuilder.build(items);
    expect(batches).toHaveLength(3);
    expect(batches[0].startIndex).toBe(0);
    expect(batches[1].startIndex).toBe(50);
    expect(batches[2].startIndex).toBe(100);
  });

  it('özel batch size çalışmalı', () => {
    const items = Array.from({ length: 25 }, (_, i) => i);
    const batches = LCTBatchBuilder.build(items, 10);
    expect(batches).toHaveLength(3);
    expect(batches[0].items).toHaveLength(10);
    expect(batches[1].items).toHaveLength(10);
    expect(batches[2].items).toHaveLength(5);
  });

  it('sıralamayı korumalı', () => {
    const items = ['a', 'b', 'c', 'd', 'e', 'f'];
    const batches = LCTBatchBuilder.build(items, 2);
    const flatten = batches.flatMap(b => b.items);
    expect(flatten).toEqual(items);
  });

  it('dizi olmayan girdi için boş dizi dönmeli', () => {
    expect(LCTBatchBuilder.build(null)).toEqual([]);
    expect(LCTBatchBuilder.build(undefined)).toEqual([]);
    expect(LCTBatchBuilder.build('string')).toEqual([]);
  });

  it('batchSize 0 veya negatif ise varsayılan kullanmalı', () => {
    const items = Array.from({ length: 60 }, (_, i) => i);
    expect(LCTBatchBuilder.build(items, 0)).toHaveLength(2);
    expect(LCTBatchBuilder.build(items, -5)).toHaveLength(2);
  });
});
