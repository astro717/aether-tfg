export type PresenceStatus = 'online' | 'away' | 'offline';

export function getPresenceStatus(lastSeenAt?: string | null): PresenceStatus {
  if (!lastSeenAt) return 'offline';
  const diffMin = (Date.now() - new Date(lastSeenAt).getTime()) / 60000;
  if (diffMin < 2) return 'online';
  if (diffMin < 30) return 'away';
  return 'offline';
}

export const PRESENCE_COLORS: Record<PresenceStatus, string> = {
  online: '#22C55E',
  away: '#F59E0B',
  offline: '#6B7280',
};

export function getPresenceLabel(lastSeenAt?: string | null): string {
  const status = getPresenceStatus(lastSeenAt);
  if (status === 'online') return 'Active now';
  if (status === 'offline') return 'Offline';
  const diffMin = Math.floor((Date.now() - new Date(lastSeenAt!).getTime()) / 60000);
  return `Active ${diffMin}m ago`;
}
