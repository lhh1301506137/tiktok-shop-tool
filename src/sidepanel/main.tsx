import React, { useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { SidePanelApp } from './SidePanelApp';
import { I18nContext, SupportedLang } from '@/i18n';
import '../styles/globals.css';

function SidePanelRoot() {
  const [lang, setLang] = useState<SupportedLang>('en');

  useEffect(() => {
    chrome.storage.local.get('settings').then((result) => {
      const l = result.settings?.language;
      if (l === 'zh' || l === 'en') setLang(l);
    });

    const listener = (changes: { [key: string]: chrome.storage.StorageChange }) => {
      if (changes.settings?.newValue?.language) {
        setLang(changes.settings.newValue.language);
      }
    };
    chrome.storage.onChanged.addListener(listener);
    return () => chrome.storage.onChanged.removeListener(listener);
  }, []);

  return (
    <I18nContext.Provider value={lang}>
      <SidePanelApp />
    </I18nContext.Provider>
  );
}

const root = createRoot(document.getElementById('root')!);
root.render(<SidePanelRoot />);
