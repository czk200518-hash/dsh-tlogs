/**
 * tlogs — the "settings" tab inside the detail modal: the plugin's UI language.
 *
 * The switch lives here rather than in the host settings because DSH's own Settings → General →
 * Language governs the whole GUI, while this plugin only needs to cover its own surfaces; a
 * change here affects tlogs alone. The tab is a heading plus three options — the resolution
 * order and where the choice is persisted live in the README ("Follow system" resolves in
 * src/client/i18n/index.ts).
 */

import * as React from 'react'
import { h } from './h.js'
import { LANG_PREFS, useLangState, useT, type LangPref, type MessageKey } from './i18n/index.js'

const OPTION_KEY: Record<LangPref, MessageKey> = {
  auto: 'settings.option.auto',
  zh: 'settings.option.zh',
  en: 'settings.option.en',
}

export function SettingsPanel(): React.ReactElement {
  const { pref, setPref } = useLangState()
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
    </div>
  )
}
