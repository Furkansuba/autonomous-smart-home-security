package com.smarthome.security.ui.theme

import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.darkColorScheme
import androidx.compose.runtime.Composable
import androidx.compose.ui.graphics.Color

private val DarkColors = darkColorScheme(
    primary = Color(0xFF38BDF8),
    onPrimary = Color(0xFF003549),
    primaryContainer = Color(0xFF004C68),
    onPrimaryContainer = Color(0xFFC5E7FF),
    secondary = Color(0xFF34D399),
    onSecondary = Color(0xFF00382A),
    secondaryContainer = Color(0xFF004D3A),
    onSecondaryContainer = Color(0xFFADFFD0),
    tertiary = Color(0xFFFBBF24),
    onTertiary = Color(0xFF3F2800),
    tertiaryContainer = Color(0xFF5A3B00),
    onTertiaryContainer = Color(0xFFFFDFA4),
    error = Color(0xFFF87171),
    onError = Color(0xFF690000),
    errorContainer = Color(0xFF7F1D1D),
    onErrorContainer = Color(0xFFFFDAD6),
    background = Color(0xFF0D1117),
    onBackground = Color(0xFFE6EDF3),
    surface = Color(0xFF161B22),
    onSurface = Color(0xFFE6EDF3),
    surfaceVariant = Color(0xFF1C2333),
    onSurfaceVariant = Color(0xFF8B949E),
)

object AppColors {
    val statusOnline   = Color(0xFF34D399)
    val statusDegraded = Color(0xFFFBBF24)
    val statusOffline  = Color(0xFFF87171)
}

@Composable
fun SmartHomeTheme(
    content: @Composable () -> Unit,
) {
    MaterialTheme(
        colorScheme = DarkColors,
        content = content,
    )
}
