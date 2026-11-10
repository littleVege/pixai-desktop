import i18next from 'i18next'
import { initReactI18next } from 'react-i18next'
import en from './en/composer.json'
import zh from './zh/composer.json'
import enScene from './en/scene.json'
import zhScene from './zh/scene.json'

export const LOCALES = ['en', 'zh'] as const
export type Locale = (typeof LOCALES)[number]

void i18next.use(initReactI18next).init({
  resources: { en: { composer: en, scene: enScene }, zh: { composer: zh, scene: zhScene } },
  lng: 'zh',
  fallbackLng: 'en',
  defaultNS: 'composer',
  interpolation: { escapeValue: false },
})

export default i18next
