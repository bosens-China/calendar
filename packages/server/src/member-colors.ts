import type { CalendarDb } from './db.js';
import { members } from './schema.js';

const MEMBER_COLOR_PALETTE = [
  '#2563eb', '#0891b2', '#059669', '#7c3aed', '#db2777',
  '#4f46e5', '#0d9488', '#65a30d', '#9333ea', '#0284c7',
  '#e11d48', '#ea580c', '#0f766e', '#6366f1', '#16a34a',
  '#8b5cf6', '#06b6d4', '#1d4ed8', '#be185d', '#047857',
];

export function pickUniqueMemberColor(db: CalendarDb): string {
  const rows = db.select({ avatarColor: members.avatarColor }).from(members).all();
  const used = new Set(rows.map(r => String(r.avatarColor).toLowerCase()));
  const available = MEMBER_COLOR_PALETTE.filter(c => !used.has(c.toLowerCase()));
  if (available.length > 0) {
    return available[Math.floor(Math.random() * available.length)];
  }
  for (let i = 0; i < 32; i++) {
    const hue = Math.floor(Math.random() * 360);
    const hex = hslToHex(hue, 68, 45);
    if (!used.has(hex.toLowerCase())) return hex;
  }
  return '#2563eb';
}

function hslToHex(h: number, s: number, l: number): string {
  const sNorm = s / 100;
  const lNorm = l / 100;
  const c = (1 - Math.abs(2 * lNorm - 1)) * sNorm;
  const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
  const m = lNorm - c / 2;
  let r = 0, g = 0, b = 0;
  if (h < 60) { r = c; g = x; }
  else if (h < 120) { r = x; g = c; }
  else if (h < 180) { g = c; b = x; }
  else if (h < 240) { g = x; b = c; }
  else if (h < 300) { r = x; b = c; }
  else { r = c; b = x; }
  const toHex = (n: number) => Math.round((n + m) * 255).toString(16).padStart(2, '0');
  return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
}
