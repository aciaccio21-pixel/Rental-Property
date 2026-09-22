export function cleaningCandidates(feeds, today = new Date().toISOString().slice(0, 10)) {
  const candidates = new Map();
  for (const feed of feeds) {
    for (const event of Array.isArray(feed.events) ? feed.events : []) {
      if (event.kind !== 'reservation' || !event.uid || !/^\d{4}-\d{2}-\d{2}$/.test(event.end) || event.end < today) continue;
      const sourceKey = `${feed.id}:${event.uid}`;
      candidates.set(sourceKey, { sourceKey, propertyId: feed.propertyId, checkoutDate: event.end });
    }
  }
  return [...candidates.values()];
}

export function cleaningCandidatesFromBookings(bookings, today = new Date().toISOString().slice(0, 10)) {
  return bookings
    .filter(booking => booking.active !== false && booking.sourceKey && booking.checkoutDate >= today)
    .map(booking => ({ sourceKey: booking.sourceKey, propertyId: booking.propertyId, checkoutDate: booking.checkoutDate }));
}

export function escapeIcal(value) {
  return String(value).replace(/\\/g, '\\\\').replace(/\r?\n/g, '\\n').replace(/,/g, '\\,').replace(/;/g, '\\;');
}

export function cleanerIcal(jobs, calendarName = 'Rental cleanings') {
  const lines = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//Rental Steward//Cleaner Calendar//EN', `X-WR-CALNAME:${escapeIcal(calendarName)}`];
  for (const job of jobs) {
    const next = new Date(`${job.checkoutDate}T00:00:00Z`); next.setUTCDate(next.getUTCDate() + 1);
    lines.push('BEGIN:VEVENT', `UID:${escapeIcal(job.id)}@rental-steward`, `DTSTART;VALUE=DATE:${job.checkoutDate.replaceAll('-', '')}`, `DTEND;VALUE=DATE:${next.toISOString().slice(0,10).replaceAll('-', '')}`, `SUMMARY:${escapeIcal(`Clean ${job.propertyName}`)}`, `LOCATION:${escapeIcal(job.address || '')}`, `DESCRIPTION:${escapeIcal('Turnover cleaning. Contact the property owner with questions.')}`, 'END:VEVENT');
  }
  lines.push('END:VCALENDAR');
  return `${lines.join('\r\n')}\r\n`;
}
