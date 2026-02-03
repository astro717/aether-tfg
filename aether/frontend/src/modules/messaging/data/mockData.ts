export interface User {
  id: string;
  name: string;
  avatar?: string;
  status?: 'online' | 'away' | 'offline';
}

export interface Thread {
  id: string;
  participants: string[];
  lastMessage: string;
  lastMessageTime: Date;
  unreadCount: number;
}

export interface Message {
  id: string;
  threadId: string;
  senderId: string;
  text: string;
  timestamp: Date;
  status?: 'sent' | 'delivered' | 'read';
}

// Current user ID (mock - in real app would come from auth context)
export const CURRENT_USER_ID = 'user-1';

export const mockUsers: User[] = [
  { id: 'user-1', name: 'You', status: 'online' },
  { id: 'user-2', name: 'Steve Jobs', status: 'online' },
  { id: 'user-3', name: 'Tim Cook', status: 'away' },
  { id: 'user-4', name: 'Jony Ive', status: 'offline' },
  { id: 'user-5', name: 'Craig Federighi', status: 'online' },
  { id: 'user-6', name: 'Lisa Jackson', status: 'away' },
  { id: 'user-7', name: 'Phil Schiller', status: 'offline' },
  { id: 'user-8', name: 'Eddy Cue', status: 'online' },
];

export const mockThreads: Thread[] = [
  {
    id: 'thread-1',
    participants: ['user-1', 'user-2'],
    lastMessage: 'One more thing...',
    lastMessageTime: new Date(Date.now() - 1000 * 60 * 5), // 5 min ago
    unreadCount: 2,
  },
  {
    id: 'thread-2',
    participants: ['user-1', 'user-3'],
    lastMessage: 'The quarterly reports look great',
    lastMessageTime: new Date(Date.now() - 1000 * 60 * 30), // 30 min ago
    unreadCount: 0,
  },
  {
    id: 'thread-3',
    participants: ['user-1', 'user-4'],
    lastMessage: 'The new design is absolutely beautiful',
    lastMessageTime: new Date(Date.now() - 1000 * 60 * 60 * 2), // 2 hours ago
    unreadCount: 1,
  },
  {
    id: 'thread-4',
    participants: ['user-1', 'user-5'],
    lastMessage: 'Hair Force One is ready for WWDC!',
    lastMessageTime: new Date(Date.now() - 1000 * 60 * 60 * 5), // 5 hours ago
    unreadCount: 0,
  },
  {
    id: 'thread-5',
    participants: ['user-1', 'user-6'],
    lastMessage: 'The sustainability report is ready',
    lastMessageTime: new Date(Date.now() - 1000 * 60 * 60 * 24), // 1 day ago
    unreadCount: 0,
  },
  {
    id: 'thread-6',
    participants: ['user-1', 'user-7'],
    lastMessage: 'Marketing materials approved',
    lastMessageTime: new Date(Date.now() - 1000 * 60 * 60 * 48), // 2 days ago
    unreadCount: 0,
  },
  {
    id: 'thread-7',
    participants: ['user-1', 'user-8'],
    lastMessage: 'Apple TV+ numbers are in',
    lastMessageTime: new Date(Date.now() - 1000 * 60 * 60 * 72), // 3 days ago
    unreadCount: 0,
  },
];

export const mockMessages: Message[] = [
  // Thread with Steve Jobs
  {
    id: 'msg-1',
    threadId: 'thread-1',
    senderId: 'user-2',
    text: 'Hey, I wanted to show you something incredible.',
    timestamp: new Date(Date.now() - 1000 * 60 * 60), // 1 hour ago
    status: 'read',
  },
  {
    id: 'msg-2',
    threadId: 'thread-1',
    senderId: 'user-1',
    text: 'Sure, what is it?',
    timestamp: new Date(Date.now() - 1000 * 60 * 55),
    status: 'read',
  },
  {
    id: 'msg-3',
    threadId: 'thread-1',
    senderId: 'user-2',
    text: 'We\'ve been working on something revolutionary. It\'s going to change everything.',
    timestamp: new Date(Date.now() - 1000 * 60 * 50),
    status: 'read',
  },
  {
    id: 'msg-4',
    threadId: 'thread-1',
    senderId: 'user-1',
    text: 'That sounds amazing! When can I see it?',
    timestamp: new Date(Date.now() - 1000 * 60 * 45),
    status: 'read',
  },
  {
    id: 'msg-5',
    threadId: 'thread-1',
    senderId: 'user-2',
    text: 'Today. This is not just a product, it\'s a milestone.',
    timestamp: new Date(Date.now() - 1000 * 60 * 40),
    status: 'read',
  },
  {
    id: 'msg-6',
    threadId: 'thread-1',
    senderId: 'user-2',
    text: 'Remember: simplicity is the ultimate sophistication.',
    timestamp: new Date(Date.now() - 1000 * 60 * 30),
    status: 'read',
  },
  {
    id: 'msg-7',
    threadId: 'thread-1',
    senderId: 'user-1',
    text: 'I can\'t wait to see what you\'ve created.',
    timestamp: new Date(Date.now() - 1000 * 60 * 20),
    status: 'delivered',
  },
  {
    id: 'msg-8',
    threadId: 'thread-1',
    senderId: 'user-2',
    text: 'One more thing...',
    timestamp: new Date(Date.now() - 1000 * 60 * 5),
    status: 'sent',
  },

  // Thread with Tim Cook
  {
    id: 'msg-9',
    threadId: 'thread-2',
    senderId: 'user-3',
    text: 'Good morning! Just reviewed the Q4 numbers.',
    timestamp: new Date(Date.now() - 1000 * 60 * 60 * 3),
    status: 'read',
  },
  {
    id: 'msg-10',
    threadId: 'thread-2',
    senderId: 'user-1',
    text: 'And? How do they look?',
    timestamp: new Date(Date.now() - 1000 * 60 * 60 * 2.5),
    status: 'read',
  },
  {
    id: 'msg-11',
    threadId: 'thread-2',
    senderId: 'user-3',
    text: 'The quarterly reports look great. Best quarter ever.',
    timestamp: new Date(Date.now() - 1000 * 60 * 30),
    status: 'read',
  },

  // Thread with Jony Ive
  {
    id: 'msg-12',
    threadId: 'thread-3',
    senderId: 'user-4',
    text: 'I\'ve been thinking about the new product line.',
    timestamp: new Date(Date.now() - 1000 * 60 * 60 * 4),
    status: 'read',
  },
  {
    id: 'msg-13',
    threadId: 'thread-3',
    senderId: 'user-1',
    text: 'What direction are you leaning?',
    timestamp: new Date(Date.now() - 1000 * 60 * 60 * 3.5),
    status: 'read',
  },
  {
    id: 'msg-14',
    threadId: 'thread-3',
    senderId: 'user-4',
    text: 'The new design is absolutely beautiful. Unapologetically so.',
    timestamp: new Date(Date.now() - 1000 * 60 * 60 * 2),
    status: 'sent',
  },

  // Thread with Craig Federighi
  {
    id: 'msg-15',
    threadId: 'thread-4',
    senderId: 'user-5',
    text: 'The new features are ready for the keynote.',
    timestamp: new Date(Date.now() - 1000 * 60 * 60 * 6),
    status: 'read',
  },
  {
    id: 'msg-16',
    threadId: 'thread-4',
    senderId: 'user-1',
    text: 'Perfect! Is the demo stable?',
    timestamp: new Date(Date.now() - 1000 * 60 * 60 * 5.5),
    status: 'read',
  },
  {
    id: 'msg-17',
    threadId: 'thread-4',
    senderId: 'user-5',
    text: 'Hair Force One is ready for WWDC!',
    timestamp: new Date(Date.now() - 1000 * 60 * 60 * 5),
    status: 'read',
  },
];

// Helper functions
export function getUserById(userId: string): User | undefined {
  return mockUsers.find(u => u.id === userId);
}

export function getOtherParticipant(thread: Thread): User | undefined {
  const otherId = thread.participants.find(id => id !== CURRENT_USER_ID);
  return otherId ? getUserById(otherId) : undefined;
}

export function getMessagesForThread(threadId: string): Message[] {
  return mockMessages
    .filter(m => m.threadId === threadId)
    .sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());
}

export function formatTimestamp(date: Date): string {
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / (1000 * 60));
  const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  if (diffMins < 1) return 'Now';
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays === 1) return 'Yesterday';
  if (diffDays < 7) return `${diffDays}d ago`;

  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

export function formatMessageTime(date: Date): string {
  return date.toLocaleTimeString('en-US', {
    hour: 'numeric',
    minute: '2-digit',
    hour12: true
  });
}
