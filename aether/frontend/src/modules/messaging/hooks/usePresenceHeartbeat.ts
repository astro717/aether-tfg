import { useEffect } from 'react';
import { messagingApi } from '../api/messagingApi';

export function usePresenceHeartbeat() {
  useEffect(() => {
    messagingApi.heartbeat();
    const id = setInterval(() => messagingApi.heartbeat(), 30_000);
    return () => clearInterval(id);
  }, []);
}
