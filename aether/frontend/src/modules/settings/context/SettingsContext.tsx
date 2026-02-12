import { createContext, useContext, useState, useCallback, useEffect, type ReactNode } from 'react';
import {
  getNotificationSettings,
  updateNotificationSettings as updateNotificationSettingsApi,
  type NotificationSettings,
} from '../api/settingsApi';

export type AnalysisDepth = 'concise' | 'standard' | 'detailed';
export type AILanguage = 'en' | 'es' | 'fr' | 'de' | 'pt' | 'zh' | 'ja';

// Re-export for convenience
export type { NotificationSettings };

interface SettingsContextValue {
  aiLanguage: AILanguage;
  setAiLanguage: (language: AILanguage) => void;
  analysisDepth: AnalysisDepth;
  setAnalysisDepth: (depth: AnalysisDepth) => void;
  soundSettings: SoundSettings;
  updateSoundSettings: (settings: Partial<SoundSettings>) => void;
  // Remote notification settings
  notificationSettings: NotificationSettings | null;
  notificationSettingsLoading: boolean;
  updateNotificationSettings: (settings: Partial<NotificationSettings>) => Promise<void>;
  refetchNotificationSettings: () => Promise<void>;
}

const SettingsContext = createContext<SettingsContextValue | undefined>(undefined);

const AI_LANGUAGE_KEY = 'ai-language-preference';
const ANALYSIS_DEPTH_KEY = 'ai-analysis-depth-preference';
const SOUND_SETTINGS_KEY = 'sound-settings-preference';

export interface SoundSettings {
  messageSound: string;
  notificationSound: string;
  criticalSound: string;
  volume: number;
}

const DEFAULT_SOUND_SETTINGS: SoundSettings = {
  messageSound: 'message_1.mp3',
  notificationSound: 'notification_1.mp3',
  criticalSound: 'alert_1.mp3',
  volume: 0.8,
};

const DEFAULT_NOTIFICATION_SETTINGS: NotificationSettings = {
  notify_email_enabled: true,
  notify_email_assignments: true,
  notify_email_comments: true,
  notify_email_mentions: true,
  notify_inapp_enabled: true,
  deadline_reminder_hours: [24],
};

function getStoredLanguage(): AILanguage {
  if (typeof window === 'undefined') return 'en';
  const stored = localStorage.getItem(AI_LANGUAGE_KEY);
  const validLanguages: AILanguage[] = ['en', 'es', 'fr', 'de', 'pt', 'zh', 'ja'];
  if (stored && validLanguages.includes(stored as AILanguage)) {
    return stored as AILanguage;
  }
  return 'en';
}

function getStoredDepth(): AnalysisDepth {
  if (typeof window === 'undefined') return 'standard';
  const stored = localStorage.getItem(ANALYSIS_DEPTH_KEY);
  const validDepths: AnalysisDepth[] = ['concise', 'standard', 'detailed'];
  if (stored && validDepths.includes(stored as AnalysisDepth)) {
    return stored as AnalysisDepth;
  }
  return 'standard';
}

function getStoredSoundSettings(): SoundSettings {
  if (typeof window === 'undefined') return DEFAULT_SOUND_SETTINGS;
  const stored = localStorage.getItem(SOUND_SETTINGS_KEY);
  if (stored) {
    try {
      return { ...DEFAULT_SOUND_SETTINGS, ...JSON.parse(stored) };
    } catch (e) {
      return DEFAULT_SOUND_SETTINGS;
    }
  }
  return DEFAULT_SOUND_SETTINGS;
}

export function SettingsProvider({ children }: { children: ReactNode }) {
  const [aiLanguage, setAiLanguageState] = useState<AILanguage>(getStoredLanguage);
  const [analysisDepth, setAnalysisDepthState] = useState<AnalysisDepth>(getStoredDepth);
  const [soundSettings, setSoundSettings] = useState<SoundSettings>(getStoredSoundSettings);

  // Remote notification settings state
  const [notificationSettings, setNotificationSettings] = useState<NotificationSettings | null>(null);
  const [notificationSettingsLoading, setNotificationSettingsLoading] = useState(false);

  const setAiLanguage = useCallback((language: AILanguage) => {
    setAiLanguageState(language);
    localStorage.setItem(AI_LANGUAGE_KEY, language);
  }, []);

  const setAnalysisDepth = useCallback((depth: AnalysisDepth) => {
    setAnalysisDepthState(depth);
    localStorage.setItem(ANALYSIS_DEPTH_KEY, depth);
  }, []);

  const updateSoundSettings = useCallback((settings: Partial<SoundSettings>) => {
    setSoundSettings(prev => {
      const newSettings = { ...prev, ...settings };
      localStorage.setItem(SOUND_SETTINGS_KEY, JSON.stringify(newSettings));
      return newSettings;
    });
  }, []);

  // Fetch notification settings from backend
  const refetchNotificationSettings = useCallback(async () => {
    const token = localStorage.getItem('token');
    if (!token) return;

    setNotificationSettingsLoading(true);
    try {
      const settings = await getNotificationSettings();
      setNotificationSettings(settings);
    } catch (error) {
      console.error('Failed to fetch notification settings:', error);
      // Use defaults on error
      setNotificationSettings(DEFAULT_NOTIFICATION_SETTINGS);
    } finally {
      setNotificationSettingsLoading(false);
    }
  }, []);

  // Update notification settings on backend
  const updateNotificationSettings = useCallback(async (settings: Partial<NotificationSettings>) => {
    try {
      const updated = await updateNotificationSettingsApi(settings);
      setNotificationSettings(updated);
    } catch (error) {
      console.error('Failed to update notification settings:', error);
      throw error;
    }
  }, []);

  // Fetch settings on mount if user is logged in
  useEffect(() => {
    const token = localStorage.getItem('token');
    if (token) {
      refetchNotificationSettings();
    }
  }, [refetchNotificationSettings]);

  return (
    <SettingsContext.Provider value={{
      aiLanguage,
      setAiLanguage,
      analysisDepth,
      setAnalysisDepth,
      soundSettings,
      updateSoundSettings,
      notificationSettings,
      notificationSettingsLoading,
      updateNotificationSettings,
      refetchNotificationSettings,
    }}>
      {children}
    </SettingsContext.Provider>
  );
}

export function useSettings(): SettingsContextValue {
  const context = useContext(SettingsContext);
  if (!context) {
    throw new Error('useSettings must be used within a SettingsProvider');
  }
  return context;
}
