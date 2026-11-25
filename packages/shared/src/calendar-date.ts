const dateInShanghai = new Intl.DateTimeFormat('en-CA', {
  timeZone: 'Asia/Shanghai', year: 'numeric', month: '2-digit', day: '2-digit',
});

export function getCalendarDate(now = new Date()): string {
  const parts = dateInShanghai.formatToParts(now);
  const value = (name: string) => parts.find(part => part.type === name)?.value;
  return `${value('year')}-${value('month')}-${value('day')}`;
}

export function getCalendarYear(now = new Date()): number {
  return Number(getCalendarDate(now).slice(0, 4));
}
