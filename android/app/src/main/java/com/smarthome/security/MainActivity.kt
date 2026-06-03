package com.smarthome.security

import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.activity.enableEdgeToEdge
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.setValue
import com.smarthome.security.data.local.ThemePreferenceManager
import com.smarthome.security.ui.navigation.NavGraph
import com.smarthome.security.ui.theme.SmartHomeTheme

class MainActivity : ComponentActivity() {
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        val themePrefs = ThemePreferenceManager(this)
        var isDarkMode by mutableStateOf(themePrefs.isDarkMode())
        enableEdgeToEdge()
        setContent {
            SmartHomeTheme(darkTheme = isDarkMode) {
                NavGraph(
                    isDarkMode = isDarkMode,
                    onThemeToggle = { dark ->
                        isDarkMode = dark
                        themePrefs.setDarkMode(dark)
                    },
                )
            }
        }
    }
}
