import dayjs from 'dayjs';
import crypto from 'node:crypto';

function random6(): string {
  return String(crypto.randomInt(0, 1_000_000)).padStart(6, '0');
}

export function generateOrderNo(prefix = 'PAY'): string {
  return `${prefix}${dayjs().format('YYYYMMDDHHmmss')}${random6()}`;
}

export function generateRefundNo(): string {
  return generateOrderNo('REF');
}
