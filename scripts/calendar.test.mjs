import { test } from 'node:test';
import assert from 'node:assert/strict';
import { calendarUrl, parseCalendar, calendarNights } from '../lib/calendar.mjs';
const wrap = events => `BEGIN:VCALENDAR\r\nVERSION:2.0\r\n${events}\r\nEND:VCALENDAR`;
const event = (id, start, end, extra='') => `BEGIN:VEVENT\r\nUID:${id}\r\nDTSTART;VALUE=DATE:${start}\r\nDTEND;VALUE=DATE:${end}\r\n${extra}\r\nEND:VEVENT`;
test('checkout is exclusive and overlapping channels count once',()=>{
  const events = parseCalendar(wrap(event('a','20260929','20261003')+'\r\n'+event('b','20260930','20261002')));
  assert.equal(calendarNights(events,'2026-09'),2);
  assert.equal(calendarNights(events,'2026-10'),2);
});
test('folded labels, blocked dates, cancellation and duplicate UID',()=>{
  const events = parseCalendar(wrap(event('a','20260901','20260903','SUMMARY:Not avai\r\n lable')+'\r\n'+event('a','20260901','20260903','SUMMARY:Not available')+'\r\n'+event('b','20260904','20260906','STATUS:CANCELLED')));
  assert.equal(events.length,1); assert.equal(events[0].kind,'blocked');
});
test('empty calendars work but broken calendars cannot clear saved dates',()=>{
  assert.deepEqual(parseCalendar(wrap('')),[]);
  assert.throws(()=>parseCalendar('<html>Error</html>'));
  assert.throws(()=>parseCalendar(wrap(event('x','20260901','20260903','RRULE:FREQ=DAILY'))));
});
test('only provider export URLs are fetched',()=>{
  assert.equal(calendarUrl('https://www.airbnb.com/calendar/ical/123.ics?s=test','airbnb'),'https://www.airbnb.com/calendar/ical/123.ics?s=test');
  assert.equal(calendarUrl('https://www.vrbo.com/icalendar/123.ics','vrbo'),'https://www.vrbo.com/icalendar/123.ics');
  for (const url of ['http://127.0.0.1/ical/x','https://www.airbnb.com.evil.test/ical/x','https://user:pass@www.airbnb.com/ical/x','https://www.airbnb.com/rooms/123']) assert.throws(()=>calendarUrl(url,'airbnb'));
});
