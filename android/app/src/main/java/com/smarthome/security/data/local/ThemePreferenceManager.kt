package com.smarthome.security.data.local

import android.content.Context
import android.content.SharedPreferences

class ThemePreferenceManager(context: Context) {
    private val prefs: SharedPreferences =
        context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)

    fun isDarkMode(): Boolean = prefs.getBoolean(KEY_DARK_MODE, false)

    fun setDarkMode(dark: Boolean) {
        prefs.edit().putBoolean(KEY_DARK_MODE, dark).apply()
    }

    companion object {
        private const val PREFS_NAME = "smart_home_theme"
        private const val KEY_DARK_MODE = "is_dark_mode"
    }
}
