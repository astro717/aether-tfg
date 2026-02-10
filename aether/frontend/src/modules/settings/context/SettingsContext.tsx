import { createContext, useContext, useState, useCallback, type ReactNode } from 'react';

export type AnalysisDepth = 'concise' | 'standard' | 'detailed';
export type AILanguage = 'en' | 'es' | 'fr' | 'de' | 'pt' | 'zh' | 'ja';

interface SettingsContextValue {
  aiLanguage: AILanguage;
  setAiLanguage: (language: AILanguage) => void;
  analysisDepth: AnalysisDepth;
  setAnalysisDepth: (depth: AnalysisDepth) => void;
}

const SettingsContext = createContext<SettingsContextValue | undefined>(undefined);

const AI_LANGUAGE_KEY = 'ai-language-preference';
const ANALYSIS_DEPTH_KEY = 'ai-analysis-depth-preference';

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

export function SettingsProvider({ children }: { children: ReactNode }) {
  const [aiLanguage, setAiLanguageState] = useState<AILanguage>(getStoredLanguage);
  const [analysisDepth, setAnalysisDepthState] = useState<AnalysisDepth>(getStoredDepth);

  const setAiLanguage = useCallback((language: AILanguage) => {
    setAiLanguageState(language);
    localStorage.setItem(AI_LANGUAGE_KEY, language);
  }, []);

  const setAnalysisDepth = useCallback((depth: AnalysisDepth) => {
    setAnalysisDepthState(depth);
    localStorage.setItem(ANALYSIS_DEPTH_KEY, depth);
  }, []);

  return (
    <SettingsContext.Provider value={{ aiLanguage, setAiLanguage, analysisDepth, setAnalysisDepth }}>
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
