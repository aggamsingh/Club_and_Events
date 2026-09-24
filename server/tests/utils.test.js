import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { sniffImageType } from '../src/services/posterStorage.js';
import { buildIcs } from '../src/utils/ics.js';
import { csvCell, escapeRegex, slugify } from '../src/utils/text.js';

describe('text utils', () => {
  it('escapeRegex makes user input literal', () => {
    const rx = new RegExp(escapeRegex('a.b*(c)'));
    assert.ok(rx.test('xa.b*(c)y'));
    assert.ok(!rx.test('aXbbbc'));
  });

  it('slugify produces safe filenames', () => {
    assert.equal(slugify('Open Mic, Night!! 2026'), 'open-mic-night-2026');
    assert.equal(slugify('!!!'), 'event');
  });

  it('csvCell quotes and neutralises formulas', () => {
    assert.equal(csvCell('plain'), '"plain"');
    assert.equal(csvCell('say "hi"'), '"say ""hi"""');
    assert.equal(csvCell('=1+1'), `"'=1+1"`);
    assert.equal(csvCell('@SUM(A1)'), `"'@SUM(A1)"`);
    assert.equal(csvCell(null), '""');
  });
});

describe('sniffImageType', () => {
  it('identifies formats from magic bytes, not names', () => {
    const pad = Buffer.alloc(12);
    assert.equal(sniffImageType(Buffer.concat([Buffer.from([0xff, 0xd8, 0xff]), pad])), 'image/jpeg');
    assert.equal(sniffImageType(Buffer.concat([Buffer.from('GIF89a'), pad])), 'image/gif');
    assert.equal(sniffImageType(Buffer.concat([Buffer.from('RIFF\0\0\0\0WEBP'), pad])), 'image/webp');
    assert.equal(sniffImageType(Buffer.from('<html><body>hello</body></html>')), null);
    assert.equal(sniffImageType(Buffer.alloc(3)), null);
  });
});

describe('buildIcs', () => {
  it('escapes text, uses CRLF and folds long lines at 75 octets', () => {
    const ics = buildIcs({
      id: 'abc',
      title: 'A; B, C',
      description: 'x'.repeat(200),
      venue: 'Hall 1',
      startDate: '2026-10-01T10:00:00.000Z',
      endDate: '2026-10-01T12:00:00.000Z',
    });
    assert.ok(ics.includes('SUMMARY:A\\; B\\, C\r\n'));
    assert.ok(ics.includes('DTSTART:20261001T100000Z\r\n'));
    for (const line of ics.split('\r\n')) assert.ok(Buffer.byteLength(line) <= 75, `line too long: ${line}`);
    assert.ok(ics.includes('\r\n x'), 'continuation lines start with a space');
  });
});
