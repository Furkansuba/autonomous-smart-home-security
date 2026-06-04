package com.smarthome.security.ui.dashboard

import androidx.compose.animation.core.FastOutSlowInEasing
import androidx.compose.animation.core.animateFloatAsState
import androidx.compose.animation.core.tween
import androidx.compose.foundation.Canvas
import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.CheckCircle
import androidx.compose.material.icons.filled.ChevronRight
import androidx.compose.material.icons.filled.DeviceHub
import androidx.compose.material.icons.filled.NotificationsActive
import androidx.compose.material.icons.filled.Pending
import androidx.compose.material.icons.filled.Warning
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.pulltorefresh.PullToRefreshBox
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.geometry.Size
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.StrokeCap
import androidx.compose.ui.graphics.drawscope.Stroke
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import com.smarthome.security.data.model.DashboardSummary
import com.smarthome.security.ui.theme.AppColors
import java.text.SimpleDateFormat
import java.util.Locale
import java.util.TimeZone
import kotlin.math.roundToInt

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun DashboardScreen(
    viewModel: DashboardViewModel,
    fullName: String,
    onNavigateToDevices: () -> Unit,
    onNavigateToEvents: () -> Unit,
    onNavigateToTelemetry: () -> Unit,
    onNavigateToProfile: () -> Unit,
    onSessionExpired: () -> Unit,
) {
    val uiState by viewModel.uiState.collectAsStateWithLifecycle()
    var lastSummary by remember { mutableStateOf<DashboardSummary?>(null) }

    LaunchedEffect(uiState) {
        if (uiState is DashboardUiState.Success) {
            lastSummary = (uiState as DashboardUiState.Success).summary
        }
    }

    val topGradient = Brush.verticalGradient(
        colors = listOf(
            MaterialTheme.colorScheme.primary.copy(alpha = 0.08f),
            Color.Transparent,
        ),
    )
    PullToRefreshBox(
        isRefreshing = uiState is DashboardUiState.Loading,
        onRefresh = { viewModel.loadSummary() },
        modifier = Modifier.fillMaxSize(),
    ) {
        Box(
            modifier = Modifier
                .fillMaxWidth()
                .height(220.dp)
                .background(topGradient),
        )
        Column(
            modifier = Modifier
                .fillMaxSize()
                .verticalScroll(rememberScrollState()),
        ) {
            DashboardHeader(fullName = fullName)

            when (val state = uiState) {
                is DashboardUiState.Loading -> {
                    val cached = lastSummary
                    if (cached != null) {
                        DashboardContent(
                            summary = cached,
                            onNavigateToDevices = onNavigateToDevices,
                            onNavigateToEvents = onNavigateToEvents,
                        )
                    } else {
                        Box(
                            modifier = Modifier
                                .fillMaxWidth()
                                .padding(48.dp),
                            contentAlignment = Alignment.Center,
                        ) {
                            CircularProgressIndicator()
                        }
                    }
                }
                is DashboardUiState.Error -> {
                    Card(
                        modifier = Modifier
                            .fillMaxWidth()
                            .padding(horizontal = 16.dp),
                        colors = CardDefaults.cardColors(
                            containerColor = MaterialTheme.colorScheme.errorContainer,
                        ),
                    ) {
                        Column(
                            modifier = Modifier.padding(16.dp),
                            verticalArrangement = Arrangement.spacedBy(8.dp),
                        ) {
                            Text(
                                text = state.message,
                                color = MaterialTheme.colorScheme.onErrorContainer,
                            )
                            Button(onClick = { viewModel.loadSummary() }) {
                                Text("Retry")
                            }
                        }
                    }
                }
                is DashboardUiState.Success -> {
                    DashboardContent(
                        summary = state.summary,
                        onNavigateToDevices = onNavigateToDevices,
                        onNavigateToEvents = onNavigateToEvents,
                    )
                }
                is DashboardUiState.SessionExpired -> {
                    LaunchedEffect(Unit) { onSessionExpired() }
                }
            }
        }
    }
}

@Composable
private fun DashboardHeader(fullName: String) {
    val greeting = remember { timeOfDayGreeting() }
    val firstName = remember(fullName) {
        if (fullName.isBlank()) "there" else fullName.trim().substringBefore(" ")
    }
    Column(
        modifier = Modifier
            .fillMaxWidth()
            .padding(horizontal = 20.dp, vertical = 16.dp),
    ) {
        Text(
            text = "$greeting, $firstName",
            style = MaterialTheme.typography.titleLarge,
            fontWeight = FontWeight.Bold,
        )
        Spacer(modifier = Modifier.height(2.dp))
        Text(
            text = "Smart Home Security",
            style = MaterialTheme.typography.bodySmall,
            color = MaterialTheme.colorScheme.onSurfaceVariant,
        )
    }
}

@Composable
private fun DashboardContent(
    summary: DashboardSummary,
    onNavigateToDevices: () -> Unit,
    onNavigateToEvents: () -> Unit,
) {
    val hero = deriveHeroStatus(summary)

    Column(
        modifier = Modifier.padding(horizontal = 16.dp),
        verticalArrangement = Arrangement.spacedBy(16.dp),
    ) {
        HeroStatusCard(hero = hero, summary = summary)

        StatTilesGrid(summary = summary)

        DeviceHealthCard(summary = summary)

        AttentionRequiredSection(
            summary = summary,
            onNavigateToDevices = onNavigateToDevices,
        )

        if (summary.events.recentCritical24hCount > 0) {
            val count = summary.events.recentCritical24hCount
            Button(
                onClick = onNavigateToEvents,
                modifier = Modifier.fillMaxWidth(),
                colors = ButtonDefaults.buttonColors(
                    containerColor = MaterialTheme.colorScheme.error,
                    contentColor = MaterialTheme.colorScheme.onError,
                ),
                shape = RoundedCornerShape(14.dp),
            ) {
                Icon(
                    imageVector = Icons.Filled.NotificationsActive,
                    contentDescription = null,
                    modifier = Modifier.size(18.dp),
                )
                Spacer(modifier = Modifier.width(8.dp))
                Text(
                    text = "View $count Critical Alert${if (count == 1) "" else "s"}",
                    fontWeight = FontWeight.SemiBold,
                )
            }
        }

        Spacer(modifier = Modifier.height(8.dp))
    }
}

private data class HeroStatus(
    val label: String,
    val detail: String,
    val color: Color,
)

private fun deriveHeroStatus(summary: DashboardSummary): HeroStatus {
    val offline = summary.devices.statusCounts.offline
    val degraded = summary.devices.statusCounts.degraded
    val critical = summary.events.recentCritical24hCount
    return when {
        offline > 0 && critical > 0 -> HeroStatus(
            label = "Critical — Action Required",
            detail = "$offline device${if (offline > 1) "s" else ""} offline · $critical critical alert${if (critical > 1) "s" else ""}",
            color = AppColors.statusOffline,
        )
        critical > 0 -> HeroStatus(
            label = "Critical Alerts Detected",
            detail = "$critical critical alert${if (critical > 1) "s" else ""} in the last 24 hours",
            color = AppColors.statusOffline,
        )
        offline > 0 -> HeroStatus(
            label = "Devices Offline",
            detail = "$offline device${if (offline > 1) "s" else ""} offline — check connectivity",
            color = AppColors.statusDegraded,
        )
        degraded > 0 -> HeroStatus(
            label = "Attention Needed",
            detail = "$degraded device${if (degraded > 1) "s" else ""} in degraded state",
            color = AppColors.statusDegraded,
        )
        else -> HeroStatus(
            label = "All Quiet",
            detail = "System operating normally",
            color = AppColors.statusOnline,
        )
    }
}

@Composable
private fun HeroStatusCard(hero: HeroStatus, summary: DashboardSummary) {
    val heroGradient = Brush.linearGradient(
        colors = listOf(
            hero.color.copy(alpha = 0.22f),
            hero.color.copy(alpha = 0.05f),
        ),
        end = Offset(Float.POSITIVE_INFINITY, 0f),
    )

    Card(
        modifier = Modifier.fillMaxWidth(),
        colors = CardDefaults.cardColors(
            containerColor = MaterialTheme.colorScheme.surface,
        ),
        shape = RoundedCornerShape(20.dp),
    ) {
        Box(
            modifier = Modifier
                .fillMaxWidth()
                .background(heroGradient),
        ) {
            Row(
                modifier = Modifier.padding(20.dp),
                verticalAlignment = Alignment.CenterVertically,
            ) {
                SecurityStatusRing(
                    onlineCount = summary.devices.statusCounts.online,
                    totalActive = summary.devices.totalActive,
                    statusColor = hero.color,
                    modifier = Modifier.size(76.dp),
                )
                Spacer(modifier = Modifier.width(16.dp))
                Column(verticalArrangement = Arrangement.spacedBy(2.dp)) {
                    Text(
                        text = hero.label,
                        style = MaterialTheme.typography.titleMedium,
                        fontWeight = FontWeight.Bold,
                        color = hero.color,
                    )
                    Text(
                        text = hero.detail,
                        style = MaterialTheme.typography.bodySmall,
                        color = MaterialTheme.colorScheme.onSurfaceVariant,
                    )
                    Spacer(modifier = Modifier.height(2.dp))
                    Text(
                        text = "Updated ${relativeTime(summary.generatedAt)}",
                        style = MaterialTheme.typography.labelSmall,
                        color = MaterialTheme.colorScheme.onSurfaceVariant.copy(alpha = 0.6f),
                    )
                }
            }
        }
    }
}

@Composable
private fun SecurityStatusRing(
    onlineCount: Int,
    totalActive: Int,
    statusColor: Color,
    modifier: Modifier = Modifier,
) {
    val healthFraction = if (totalActive > 0) onlineCount.toFloat() / totalActive else 0f
    val startAngle = 135f
    val maxSweep = 270f

    val animatedSweep by animateFloatAsState(
        targetValue = healthFraction * maxSweep,
        animationSpec = tween(durationMillis = 900, easing = FastOutSlowInEasing),
        label = "healthArc",
    )

    val trackColor = statusColor.copy(alpha = 0.18f)

    Box(
        contentAlignment = Alignment.Center,
        modifier = modifier,
    ) {
        Canvas(modifier = Modifier.fillMaxSize()) {
            val strokeWidth = 7.dp.toPx()
            val half = strokeWidth / 2f

            drawArc(
                color = trackColor,
                startAngle = startAngle,
                sweepAngle = maxSweep,
                useCenter = false,
                topLeft = Offset(half, half),
                size = Size(size.width - strokeWidth, size.height - strokeWidth),
                style = Stroke(width = strokeWidth, cap = StrokeCap.Round),
            )

            if (animatedSweep > 0f) {
                drawArc(
                    color = statusColor,
                    startAngle = startAngle,
                    sweepAngle = animatedSweep,
                    useCenter = false,
                    topLeft = Offset(half, half),
                    size = Size(size.width - strokeWidth, size.height - strokeWidth),
                    style = Stroke(width = strokeWidth, cap = StrokeCap.Round),
                )
            }
        }

        Column(
            horizontalAlignment = Alignment.CenterHorizontally,
            verticalArrangement = Arrangement.Center,
        ) {
            Text(
                text = if (totalActive > 0) "${(healthFraction * 100).roundToInt()}%" else "—",
                style = MaterialTheme.typography.labelLarge,
                fontWeight = FontWeight.Bold,
                color = statusColor,
            )
            Text(
                text = "online",
                style = MaterialTheme.typography.labelSmall,
                color = MaterialTheme.colorScheme.onSurfaceVariant,
            )
        }
    }
}

@Composable
private fun StatTilesGrid(summary: DashboardSummary) {
    val critical = summary.events.recentCritical24hCount
    val pending = summary.overrides.pendingCount
    Column(verticalArrangement = Arrangement.spacedBy(12.dp)) {
        Row(
            modifier = Modifier.fillMaxWidth(),
            horizontalArrangement = Arrangement.spacedBy(12.dp),
        ) {
            StatTile(
                modifier = Modifier.weight(1f),
                icon = Icons.Filled.DeviceHub,
                value = "${summary.devices.totalActive}",
                label = "Active\nDevices",
                accentColor = MaterialTheme.colorScheme.primary,
            )
            StatTile(
                modifier = Modifier.weight(1f),
                icon = Icons.Filled.NotificationsActive,
                value = "$critical",
                label = "Critical\nToday",
                accentColor = if (critical > 0) AppColors.statusOffline
                              else MaterialTheme.colorScheme.onSurfaceVariant,
            )
        }
        Row(
            modifier = Modifier.fillMaxWidth(),
            horizontalArrangement = Arrangement.spacedBy(12.dp),
        ) {
            StatTile(
                modifier = Modifier.weight(1f),
                icon = Icons.Filled.CheckCircle,
                value = "${summary.devices.statusCounts.online}",
                label = "Devices\nOnline",
                accentColor = AppColors.statusOnline,
            )
            StatTile(
                modifier = Modifier.weight(1f),
                icon = Icons.Filled.Pending,
                value = "$pending",
                label = "Pending\nOverrides",
                accentColor = if (pending > 0) AppColors.statusDegraded
                              else MaterialTheme.colorScheme.onSurfaceVariant,
            )
        }
    }
}

@Composable
private fun StatTile(
    modifier: Modifier = Modifier,
    icon: ImageVector,
    value: String,
    label: String,
    accentColor: Color,
) {
    Card(
        modifier = modifier,
        colors = CardDefaults.cardColors(
            containerColor = MaterialTheme.colorScheme.surfaceVariant,
        ),
    ) {
        Column(
            modifier = Modifier
                .fillMaxWidth()
                .padding(16.dp),
            horizontalAlignment = Alignment.CenterHorizontally,
            verticalArrangement = Arrangement.spacedBy(4.dp),
        ) {
            Icon(
                imageVector = icon,
                contentDescription = null,
                tint = accentColor,
                modifier = Modifier.size(22.dp),
            )
            Text(
                text = value,
                style = MaterialTheme.typography.headlineSmall,
                fontWeight = FontWeight.Bold,
                color = accentColor,
            )
            Text(
                text = label,
                style = MaterialTheme.typography.labelSmall,
                color = MaterialTheme.colorScheme.onSurfaceVariant,
                textAlign = TextAlign.Center,
            )
        }
    }
}

@Composable
private fun DeviceHealthCard(summary: DashboardSummary) {
    Card(
        modifier = Modifier.fillMaxWidth(),
        colors = CardDefaults.cardColors(
            containerColor = MaterialTheme.colorScheme.surfaceVariant,
        ),
    ) {
        Column(
            modifier = Modifier.padding(16.dp),
            verticalArrangement = Arrangement.spacedBy(10.dp),
        ) {
            Text(
                text = "Device Health",
                style = MaterialTheme.typography.labelMedium,
                fontWeight = FontWeight.SemiBold,
                color = MaterialTheme.colorScheme.onSurfaceVariant,
            )
            SegmentedHealthBar(summary = summary)
            Row(horizontalArrangement = Arrangement.spacedBy(16.dp)) {
                LegendItem(color = AppColors.statusOnline, label = "${summary.devices.statusCounts.online} Online")
                LegendItem(color = AppColors.statusDegraded, label = "${summary.devices.statusCounts.degraded} Degraded")
                LegendItem(color = AppColors.statusOffline, label = "${summary.devices.statusCounts.offline} Offline")
            }
        }
    }
}

@Composable
private fun SegmentedHealthBar(summary: DashboardSummary) {
    val total = summary.devices.totalActive
    val online = summary.devices.statusCounts.online
    val degraded = summary.devices.statusCounts.degraded
    val offline = summary.devices.statusCounts.offline

    if (total <= 0 || (online == 0 && degraded == 0 && offline == 0)) {
        Box(
            modifier = Modifier
                .fillMaxWidth()
                .height(12.dp)
                .clip(RoundedCornerShape(6.dp))
                .background(MaterialTheme.colorScheme.onSurfaceVariant.copy(alpha = 0.2f)),
        )
        return
    }

    Row(
        modifier = Modifier.fillMaxWidth(),
        horizontalArrangement = Arrangement.spacedBy(3.dp),
    ) {
        if (online > 0) {
            Box(
                modifier = Modifier
                    .weight(online.toFloat())
                    .height(12.dp)
                    .clip(RoundedCornerShape(6.dp))
                    .background(AppColors.statusOnline),
            )
        }
        if (degraded > 0) {
            Box(
                modifier = Modifier
                    .weight(degraded.toFloat())
                    .height(12.dp)
                    .clip(RoundedCornerShape(6.dp))
                    .background(AppColors.statusDegraded),
            )
        }
        if (offline > 0) {
            Box(
                modifier = Modifier
                    .weight(offline.toFloat())
                    .height(12.dp)
                    .clip(RoundedCornerShape(6.dp))
                    .background(AppColors.statusOffline),
            )
        }
    }
}

@Composable
private fun LegendItem(color: Color, label: String) {
    Row(
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(4.dp),
    ) {
        Box(
            modifier = Modifier
                .size(8.dp)
                .clip(CircleShape)
                .background(color),
        )
        Text(
            text = label,
            style = MaterialTheme.typography.labelSmall,
            color = MaterialTheme.colorScheme.onSurfaceVariant,
        )
    }
}

@Composable
private fun AttentionRequiredSection(
    summary: DashboardSummary,
    onNavigateToDevices: () -> Unit,
) {
    val offline = summary.devices.statusCounts.offline
    val degraded = summary.devices.statusCounts.degraded
    if (offline <= 0 && degraded <= 0) return

    Card(
        modifier = Modifier.fillMaxWidth(),
        colors = CardDefaults.cardColors(
            containerColor = MaterialTheme.colorScheme.errorContainer.copy(alpha = 0.45f),
        ),
        shape = RoundedCornerShape(14.dp),
    ) {
        Column(modifier = Modifier.padding(vertical = 4.dp)) {
            Text(
                text = "Attention Required",
                style = MaterialTheme.typography.labelMedium,
                fontWeight = FontWeight.SemiBold,
                color = MaterialTheme.colorScheme.onSurfaceVariant,
                modifier = Modifier.padding(horizontal = 16.dp, vertical = 10.dp),
            )
            if (offline > 0) {
                Row(
                    modifier = Modifier
                        .fillMaxWidth()
                        .clickable(onClick = onNavigateToDevices)
                        .padding(horizontal = 16.dp, vertical = 12.dp),
                    verticalAlignment = Alignment.CenterVertically,
                    horizontalArrangement = Arrangement.SpaceBetween,
                ) {
                    Row(
                        verticalAlignment = Alignment.CenterVertically,
                        horizontalArrangement = Arrangement.spacedBy(10.dp),
                        modifier = Modifier.weight(1f),
                    ) {
                        Icon(
                            imageVector = Icons.Filled.Warning,
                            contentDescription = null,
                            tint = AppColors.statusOffline,
                            modifier = Modifier.size(18.dp),
                        )
                        Text(
                            text = "$offline device${if (offline > 1) "s" else ""} offline — check connectivity",
                            style = MaterialTheme.typography.bodySmall,
                            color = MaterialTheme.colorScheme.onSurface,
                        )
                    }
                    Icon(
                        imageVector = Icons.Filled.ChevronRight,
                        contentDescription = null,
                        tint = MaterialTheme.colorScheme.onSurfaceVariant,
                        modifier = Modifier.size(16.dp),
                    )
                }
            }
            if (degraded > 0) {
                Row(
                    modifier = Modifier
                        .fillMaxWidth()
                        .clickable(onClick = onNavigateToDevices)
                        .padding(horizontal = 16.dp, vertical = 12.dp),
                    verticalAlignment = Alignment.CenterVertically,
                    horizontalArrangement = Arrangement.SpaceBetween,
                ) {
                    Row(
                        verticalAlignment = Alignment.CenterVertically,
                        horizontalArrangement = Arrangement.spacedBy(10.dp),
                        modifier = Modifier.weight(1f),
                    ) {
                        Icon(
                            imageVector = Icons.Filled.Warning,
                            contentDescription = null,
                            tint = AppColors.statusDegraded,
                            modifier = Modifier.size(18.dp),
                        )
                        Text(
                            text = "$degraded device${if (degraded > 1) "s" else ""} degraded — review device health",
                            style = MaterialTheme.typography.bodySmall,
                            color = MaterialTheme.colorScheme.onSurface,
                        )
                    }
                    Icon(
                        imageVector = Icons.Filled.ChevronRight,
                        contentDescription = null,
                        tint = MaterialTheme.colorScheme.onSurfaceVariant,
                        modifier = Modifier.size(16.dp),
                    )
                }
            }
        }
    }
}

private fun timeOfDayGreeting(): String {
    val hour = java.util.Calendar.getInstance().get(java.util.Calendar.HOUR_OF_DAY)
    return when {
        hour < 5 -> "Good night"
        hour < 12 -> "Good morning"
        hour < 17 -> "Good afternoon"
        hour < 21 -> "Good evening"
        else -> "Good night"
    }
}

private fun relativeTime(isoTimestamp: String): String {
    return try {
        val sdf = SimpleDateFormat("yyyy-MM-dd'T'HH:mm:ss", Locale.US)
        sdf.timeZone = TimeZone.getTimeZone("UTC")
        val then = sdf.parse(isoTimestamp.substringBefore(".")) ?: return shortTime(isoTimestamp)
        val diffMin = ((System.currentTimeMillis() - then.time) / 60_000L).toInt()
        when {
            diffMin < 1 -> "just now"
            diffMin < 60 -> "$diffMin min ago"
            diffMin < 1440 -> "${diffMin / 60}h ago"
            else -> shortTime(isoTimestamp)
        }
    } catch (e: Exception) {
        shortTime(isoTimestamp)
    }
}

private fun shortTime(raw: String): String {
    return try {
        raw.substringAfter("T").take(5) + " UTC"
    } catch (e: Exception) {
        raw
    }
}

