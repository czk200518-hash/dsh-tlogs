/**
 * tlogs — the "settings" tab inside the detail modal: the plugin's UI language and the day basis
 * of the 「今日」 card.
 *
 * Both switches live here rather than in the host settings because DSH's own Settings → General →
 * Language governs the whole GUI while these only affect tlogs. The tabs are a heading plus the
 * options, and nothing else — the resolution order, where each choice is persisted and why the
 * platform day turns over at 08:00 Beijing live in the README (and in the option tooltips).
 */

import * as React from 'react'
import { h } from './h.js'
import { LANG_PREFS, useLangState, useT, type LangPref, type MessageKey } from './i18n/index.js'
import { TODAY_BASES, useTodayBasis } from './today-basis.js'
import type { TodayBasis } from '../types.js'

const OPTION_KEY: Record<LangPref, MessageKey> = {
  auto: 'settings.option.auto',
  zh: 'settings.option.zh',
  en: 'settings.option.en',
}

const BASIS_KEY: Record<TodayBasis, MessageKey> = {
  platform: 'settings.basis.platform',
  local: 'settings.basis.local',
}

const BASIS_TIP_KEY: Record<TodayBasis, MessageKey> = {
  platform: 'settings.basis.platformTip',
  local: 'settings.basis.localTip',
}

export function SettingsPanel(): React.ReactElement {
  const { pref, setPref } = useLangState()
  const { basis, setBasis } = useTodayBasis()
  const t = useT()

  return (
    <div className="tlogs-settings">
      <div className="tlogs-settings-title">{t('settings.title')}</div>

      <div className="tlogs-settings-options" role="radiogroup" aria-label={t('settings.title')}>
        {LANG_PREFS.map((id) => (
          <label
            key={id}
            className={id === pref ? 'tlogs-settings-option is-selected' : 'tlogs-settings-option'}
          >
            <input
              type="radio"
              className="tlogs-settings-radio"
              name="tlogs-lang"
              value={id}
              checked={id === pref}
              onChange={() => setPref(id)}
            />
            <span>{t(OPTION_KEY[id])}</span>
          </label>
        ))}
      </div>

      <div className="tlogs-settings-title">{t('settings.basis')}</div>

      <div className="tlogs-settings-options" role="radiogroup" aria-label={t('settings.basis')}>
        {TODAY_BASES.map((id) => (
          <label
            key={id}
            className={id === basis ? 'tlogs-settings-option is-selected' : 'tlogs-settings-option'}
            title={t(BASIS_TIP_KEY[id])}
          >
            <input
              type="radio"
              className="tlogs-settings-radio"
              name="tlogs-today-basis"
              value={id}
              checked={id === basis}
              onChange={() => setBasis(id)}
            />
            <span>{t(BASIS_KEY[id])}</span>
          </label>
        ))}
      </div>
    </div>
  )
}
