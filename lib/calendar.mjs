import ICAL from 'ical.js';

export function calendarUrl(value, provider) {
  const url = new URL(value);
  const hosts = provider === 'airbnb' ? ['airbnb.com', 'www.airbnb.com'] : provider === 'vrbo' ? ['vrbo.com', 'www.vrbo.com', 'www.homeaway.com', 'homeaway.com'] : [];
  if (url.protocol !== 'https:' || url.username || url.password || url.port || !hosts.includes(url.hostname) || !/\/(ical|icalendar)\//i.test(url.pathname)) {
    throw new Error('Use the HTTPS calendar export link from this listing on Airbnb or Vrbo.');
  }
  url.hash = '';
  return url.toString();
}

export function parseCalendar(text) {
  if (!text.trim().startsWith('BEGIN:VCALENDAR') || !text.trim().endsWith('END:VCALENDAR')) throw new Error('The link did not return a complete calendar.');
  const calendar = new ICAL.Component(ICAL.parse(text));
  const events = new Map();
  for (const component of calendar.getAllSubcomponents('vevent')) {
    if (String(component.getFirstPropertyValue('status')).toUpperCase() === 'CANCELLED') continue;
    if (component.hasProperty('rrule') || component.hasProperty('rdate')) throw new Error('Recurring events are not supported. Use the listing’s reservation export.');
    const event = new ICAL.Event(component);
    if (!event.uid || !event.startDate || !event.endDate || !event.startDate.isDate || !event.endDate.isDate) throw new Error('The calendar contains a reservation without valid all-day dates.');
    const start = event.startDate.toString(), end = event.endDate.toString();
    if (end <= start) throw new Error('The calendar contains an invalid checkout date.');
    const summary = String(event.summary || 'Calendar entry').slice(0, 160);
    const description = String(component.getFirstPropertyValue('description') || '');
    const reservationHint = /\b(reservation|booking)\b/i.test(description);
    const blocked = /not available|unavailable|blocked|closed/i.test(summary) && !reservationHint;
    events.set(event.uid, { uid: event.uid, start, end, summary, kind: blocked ? 'blocked' : 'reservation' });
    if (events.size > 5000) throw new Error('This calendar is too large.');
  }
  return [...events.values()];
}

export async function fetchCalendar(url, provider) {
  const response = await fetch(calendarUrl(url, provider), { redirect: 'error', cache: 'no-store', signal: AbortSignal.timeout(15000), headers: { Accept: 'text/calendar' } });
  if (!response.ok || !response.body) throw new Error('The provider could not return this calendar. Check the export link and try again.');
  const reader = response.body.getReader();
  const chunks = []; let size = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.length;
      if (size > 2_000_000) throw new Error('This calendar is too large.');
      chunks.push(value);
    }
  } finally { await reader.cancel(); }
  return parseCalendar(Buffer.concat(chunks).toString('utf8'));
}

// Checkout is exclusive; overlapping feeds must never double-count a night.
export function calendarNights(events, month) {
  const nights = new Set();
  for (const event of events) {
    const monthStart = `${month}-01`;
    const cursor = new Date(`${event.start > monthStart ? event.start : monthStart}T00:00:00Z`);
    for (let i = 0; i < 31; i++) {
      const day = cursor.toISOString().slice(0, 10);
      if (day >= event.end || !day.startsWith(month)) break;
      nights.add(day);
      cursor.setUTCDate(cursor.getUTCDate() + 1);
    }
  }
  return nights.size;
}

export function bookingPayoutForMonth(bookings, month) {
  const monthStart = `${month}-01`;
  const monthEnd = new Date(Date.UTC(Number(month.slice(0, 4)), Number(month.slice(5, 7)), 1)).toISOString().slice(0, 10);
  return bookings
    .filter(booking => booking.end >= monthStart && booking.end < monthEnd)
    .reduce((sum, booking) => sum + Number(booking.payout || 0), 0);
}
