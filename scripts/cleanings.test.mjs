import { test } from 'node:test';
import assert from 'node:assert/strict';
import { cleaningCandidates, cleanerIcal } from '../lib/cleanings.mjs';

test('creates one future cleaning per reservation and ignores blocks', () => {
  const feeds = [{ id:'feed', propertyId:'p1', events:[
    { uid:'one', end:'2026-10-03', kind:'reservation' },
    { uid:'block', end:'2026-10-04', kind:'blocked' },
    { uid:'old', end:'2026-01-01', kind:'reservation' },
  ] }];
  assert.deepEqual(cleaningCandidates(feeds, '2026-09-01'), [{ sourceKey:'feed:one', propertyId:'p1', checkoutDate:'2026-10-03' }]);
});

test('ical contains one all-day cleaning without financial or guest data', () => {
  const output = cleanerIcal([{ id:'j1', checkoutDate:'2026-10-03', propertyName:'Apartment 1', address:'1 Main St' }]);
  assert.match(output, /DTSTART;VALUE=DATE:20261003/);
  assert.match(output, /SUMMARY:Clean Apartment 1/);
  assert.doesNotMatch(output, /fee|guest|paid/i);
});
