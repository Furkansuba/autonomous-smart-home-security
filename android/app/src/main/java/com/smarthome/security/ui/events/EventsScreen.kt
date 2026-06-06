package com.smarthome.security.ui.events

import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.IntrinsicSize
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxHeight
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.ExpandLess
import androidx.compose.material.icons.filled.ExpandMore
import androidx.compose.material.icons.filled.LocalFireDepartment
import androidx.compose.material.icons.filled.NotificationsActive
import androidx.compose.material.icons.filled.NotificationsNone
import androidx.compose.material.icons.filled.Nfc
import androidx.compose.material.icons.filled.Security
import androidx.compose.material.icons.filled.Sensors
import androidx.compose.material.icons.filled.SignalWifiOff
import androidx.compose.material.icons.filled.Tune
import androidx.compose.material.icons.filled.Warning
import androidx.compose.material3.Button
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.pulltorefresh.PullToRefreshBox
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Text
import androidx.compose.material3.TopAppBar
import androidx.compose.runtime.Composable
import androidx.compose.runtime.DisposableEffect
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import com.smarthome.security.data.model.Event

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun EventsScreen(
    viewModel: EventsViewModel,
    onSessionExpired: () -> Unit,
) {
    val uiState by viewModel.uiState.collectAsStateWithLifecycle()
    val isRefreshing by viewModel.isRefreshing.collectAsStateWithLifecycle()

    DisposableEffect(Unit) {
        viewModel.startAutoRefresh()
        onDispose { viewModel.stopAutoRefresh() }
    }

    Scaffold(
        topBar = {
            TopAppBar(
                title = {
                    Column {
                        Text("Alerts")
                        Text(
                            text = "Security incident feed",
                            style = MaterialTheme.typography.bodySmall,
                            color = MaterialTheme.colorScheme.onSurfaceVariant,
                        )
                    }
                },
            )
        },
    ) { padding ->
        Box(
            modifier = Modifier
                .fillMaxSize()
                .padding(padding),
        ) {
            when (val state = uiState) {
                is EventsUiState.Loading -> {
                    CircularProgressIndicator(modifier = Modifier.align(Alignment.Center))
                }

                is EventsUiState.Error -> {
                    Column(
                        modifier = Modifier
                            .align(Alignment.Center)
                            .padding(32.dp),
                        horizontalAlignment = Alignment.CenterHorizontally,
                        verticalArrangement = Arrangement.Center,
                    ) {
                        Icon(
                            imageVector = Icons.Filled.Warning,
                            contentDescription = null,
                            modifier = Modifier.size(48.dp),
                            tint = MaterialTheme.colorScheme.error,
                        )
                        Spacer(modifier = Modifier.height(16.dp))
                        Text(
                            text = "Could not load alerts",
                            style = MaterialTheme.typography.titleMedium,
                            color = MaterialTheme.colorScheme.onSurface,
                        )
                        Spacer(modifier = Modifier.height(8.dp))
                        Text(
                            text = state.message,
                            style = MaterialTheme.typography.bodySmall,
                            color = MaterialTheme.colorScheme.onSurfaceVariant,
                            textAlign = TextAlign.Center,
                        )
                        Spacer(modifier = Modifier.height(24.dp))
                        Button(onClick = { viewModel.loadEvents() }) {
                            Text("Retry")
                        }
                    }
                }

                is EventsUiState.SessionExpired -> {
                    LaunchedEffect(Unit) { onSessionExpired() }
                }

                is EventsUiState.Success -> {
                    PullToRefreshBox(
                        isRefreshing = isRefreshing,
                        onRefresh = { viewModel.refresh() },
                        modifier = Modifier.fillMaxSize(),
                    ) {
                        if (state.events.isEmpty()) {
                            EmptyAlertsState(modifier = Modifier.align(Alignment.Center))
                        } else {
                            AlertFeed(events = state.events)
                        }
                    }
                }
            }
        }
    }
}

@Composable
private fun AlertFeed(events: List<Event>) {
    val critical = events.filter { it.severity == "critical" }
    val others = events.filter { it.severity != "critical" }
    val criticalCount = critical.size
    val warningCount = events.count { it.severity == "warning" }
    val infoCount = events.count { it.severity != "critical" && it.severity != "warning" }

    LazyColumn(
        modifier = Modifier
            .fillMaxSize()
            .padding(horizontal = 16.dp),
        verticalArrangement = Arrangement.spacedBy(8.dp),
        contentPadding = PaddingValues(vertical = 12.dp),
    ) {
        item {
            AlertSummaryHeader(
                total = events.size,
                criticalCount = criticalCount,
                warningCount = warningCount,
                infoCount = infoCount,
            )
        }

        if (critical.isNotEmpty()) {
            item {
                SectionLabel(
                    title = "CRITICAL ALERTS",
                    color = MaterialTheme.colorScheme.error,
                )
            }
            items(critical, key = { it.eventId }) { event ->
                EventCard(event = event)
            }
        }

        if (others.isNotEmpty()) {
            item {
                SectionLabel(
                    title = if (critical.isNotEmpty()) "RECENT ALERTS" else "ALL ALERTS",
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                )
            }
            items(others, key = { it.eventId }) { event ->
                EventCard(event = event)
            }
        }
    }
}

@Composable
private fun AlertSummaryHeader(
    total: Int,
    criticalCount: Int,
    warningCount: Int,
    infoCount: Int,
) {
    val criticalColor = MaterialTheme.colorScheme.error
    val warningColor = MaterialTheme.colorScheme.tertiary
    val infoColor = MaterialTheme.colorScheme.primary

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
                text = "$total ${if (total == 1) "Alert" else "Alerts"}",
                fontWeight = FontWeight.Bold,
                fontSize = 18.sp,
                color = MaterialTheme.colorScheme.onSurface,
            )
            Row(horizontalArrangement = Arrangement.spacedBy(16.dp)) {
                if (criticalCount > 0) {
                    SeverityCountBadge(count = criticalCount, label = "Critical", color = criticalColor)
                }
                if (warningCount > 0) {
                    SeverityCountBadge(count = warningCount, label = "Warning", color = warningColor)
                }
                if (infoCount > 0) {
                    SeverityCountBadge(count = infoCount, label = "Info", color = infoColor)
                }
            }
            Row(
                modifier = Modifier
                    .fillMaxWidth()
                    .height(4.dp)
                    .clip(RoundedCornerShape(2.dp)),
            ) {
                if (criticalCount > 0) {
                    Box(
                        modifier = Modifier
                            .weight(criticalCount.toFloat())
                            .fillMaxHeight()
                            .background(criticalColor),
                    )
                }
                if (warningCount > 0) {
                    Box(
                        modifier = Modifier
                            .weight(warningCount.toFloat())
                            .fillMaxHeight()
                            .background(warningColor),
                    )
                }
                if (infoCount > 0) {
                    Box(
                        modifier = Modifier
                            .weight(infoCount.toFloat())
                            .fillMaxHeight()
                            .background(infoColor),
                    )
                }
            }
        }
    }
}

@Composable
private fun SeverityCountBadge(count: Int, label: String, color: Color) {
    Row(
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(5.dp),
    ) {
        Box(
            modifier = Modifier
                .size(8.dp)
                .clip(CircleShape)
                .background(color),
        )
        Text(
            text = "$count $label",
            fontSize = 13.sp,
            color = MaterialTheme.colorScheme.onSurfaceVariant,
        )
    }
}

@Composable
private fun SectionLabel(title: String, color: Color) {
    Row(
        modifier = Modifier
            .fillMaxWidth()
            .padding(top = 6.dp, bottom = 2.dp),
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(6.dp),
    ) {
        Box(
            modifier = Modifier
                .size(6.dp)
                .clip(CircleShape)
                .background(color),
        )
        Text(
            text = title,
            fontSize = 11.sp,
            fontWeight = FontWeight.SemiBold,
            color = color,
            letterSpacing = 1.sp,
        )
    }
}

@Composable
private fun EventCard(event: Event) {
    var expanded by remember { mutableStateOf(false) }

    val accentColor = resolveSeverityColor(event.severity)
    val icon = eventTypeIcon(event.eventType)

    Card(
        modifier = Modifier
            .fillMaxWidth()
            .clickable { expanded = !expanded },
        elevation = CardDefaults.cardElevation(defaultElevation = 1.dp),
        colors = CardDefaults.cardColors(
            containerColor = MaterialTheme.colorScheme.surface,
        ),
    ) {
        Row(modifier = Modifier.height(IntrinsicSize.Max)) {
            Box(
                modifier = Modifier
                    .width(3.dp)
                    .fillMaxHeight()
                    .background(accentColor),
            )
            Column(
                modifier = Modifier
                    .weight(1f)
                    .padding(horizontal = 14.dp, vertical = 12.dp),
            ) {
                Row(
                    modifier = Modifier.fillMaxWidth(),
                    verticalAlignment = Alignment.CenterVertically,
                    horizontalArrangement = Arrangement.spacedBy(8.dp),
                ) {
                    Icon(
                        imageVector = icon,
                        contentDescription = null,
                        modifier = Modifier.size(20.dp),
                        tint = accentColor,
                    )
                    Text(
                        text = formatEventType(event.eventType),
                        fontWeight = FontWeight.SemiBold,
                        fontSize = 15.sp,
                        color = MaterialTheme.colorScheme.onSurface,
                        modifier = Modifier.weight(1f),
                    )
                    Text(
                        text = event.severity.replaceFirstChar { it.uppercase() },
                        fontSize = 11.sp,
                        fontWeight = FontWeight.Medium,
                        color = accentColor,
                    )
                    Icon(
                        imageVector = if (expanded) Icons.Filled.ExpandLess else Icons.Filled.ExpandMore,
                        contentDescription = if (expanded) "Collapse" else "Expand",
                        modifier = Modifier.size(16.dp),
                        tint = MaterialTheme.colorScheme.onSurfaceVariant,
                    )
                }

                val roomPart = event.roomId?.let { formatRoomId(it) }
                val timePart = formatTimestampShort(event.occurredAt)
                val subtitle = listOfNotNull(roomPart, timePart).joinToString("  ·  ")
                if (subtitle.isNotBlank()) {
                    Spacer(modifier = Modifier.height(3.dp))
                    Text(
                        text = subtitle,
                        fontSize = 12.sp,
                        color = MaterialTheme.colorScheme.onSurfaceVariant,
                    )
                }

                if (expanded) {
                    HorizontalDivider(
                        modifier = Modifier.padding(vertical = 10.dp),
                        color = MaterialTheme.colorScheme.surfaceVariant,
                    )
                    Column(verticalArrangement = Arrangement.spacedBy(6.dp)) {
                        DetailRow(label = "Device", value = event.deviceId, monospace = true)
                        if (!event.message.isNullOrBlank()) {
                            DetailRow(label = "Message", value = event.message!!)
                        }
                        if (event.confirmed != null) {
                            DetailRow(
                                label = "Confirmed",
                                value = if (event.confirmed) "Yes" else "No",
                                valueColor = if (event.confirmed) MaterialTheme.colorScheme.secondary else null,
                            )
                        }
                        DetailRow(label = "Event ID", value = event.eventId, monospace = true)
                        DetailRow(label = "Time", value = formatTimestamp(event.occurredAt))
                    }
                }
            }
        }
    }
}

@Composable
private fun DetailRow(
    label: String,
    value: String,
    monospace: Boolean = false,
    valueColor: Color? = null,
) {
    val resolvedColor = valueColor ?: MaterialTheme.colorScheme.onSurface
    Row(
        modifier = Modifier.fillMaxWidth(),
        horizontalArrangement = Arrangement.SpaceBetween,
        verticalAlignment = Alignment.Top,
    ) {
        Text(
            text = label,
            fontSize = 12.sp,
            color = MaterialTheme.colorScheme.onSurfaceVariant,
            modifier = Modifier.weight(0.35f),
        )
        Text(
            text = value,
            fontSize = 12.sp,
            fontWeight = FontWeight.Medium,
            fontFamily = if (monospace) FontFamily.Monospace else FontFamily.Default,
            color = resolvedColor,
            modifier = Modifier.weight(0.65f),
        )
    }
}

@Composable
private fun EmptyAlertsState(modifier: Modifier = Modifier) {
    Column(
        modifier = modifier.padding(32.dp),
        horizontalAlignment = Alignment.CenterHorizontally,
        verticalArrangement = Arrangement.spacedBy(12.dp),
    ) {
        Icon(
            imageVector = Icons.Filled.NotificationsNone,
            contentDescription = null,
            modifier = Modifier.size(48.dp),
            tint = MaterialTheme.colorScheme.onSurfaceVariant.copy(alpha = 0.5f),
        )
        Text(
            text = "No alerts",
            fontWeight = FontWeight.SemiBold,
            color = MaterialTheme.colorScheme.onSurface,
        )
        Text(
            text = "Security events will appear here when the system detects activity.",
            fontSize = 13.sp,
            color = MaterialTheme.colorScheme.onSurfaceVariant,
            textAlign = TextAlign.Center,
        )
    }
}

@Composable
private fun resolveSeverityColor(severity: String): Color = when (severity) {
    "critical" -> MaterialTheme.colorScheme.error
    "warning" -> MaterialTheme.colorScheme.tertiary
    else -> MaterialTheme.colorScheme.primary
}

private fun eventTypeIcon(eventType: String): ImageVector {
    val lower = eventType.lowercase()
    return when {
        "fire" in lower -> Icons.Filled.LocalFireDepartment
        "gas" in lower || "co" in lower -> Icons.Filled.Warning
        "intrusion" in lower -> Icons.Filled.Security
        "motion" in lower -> Icons.Filled.Sensors
        "nfc" in lower || "access" in lower -> Icons.Filled.Nfc
        "heartbeat" in lower || "offline" in lower -> Icons.Filled.SignalWifiOff
        "override" in lower -> Icons.Filled.Tune
        else -> Icons.Filled.NotificationsActive
    }
}

private fun formatEventType(raw: String): String =
    raw.replace('_', ' ').replaceFirstChar { it.uppercase() }

private fun formatRoomId(raw: String): String =
    raw.replace('_', ' ').replaceFirstChar { it.uppercase() }

private fun formatTimestamp(raw: String): String {
    return try {
        val noMillis = raw.substringBefore(".")
        noMillis.replace("T", " ").trimEnd('Z') + " UTC"
    } catch (e: Exception) {
        raw
    }
}

private fun formatTimestampShort(raw: String): String {
    return try {
        val time = raw.substringAfter("T").substringBefore(".")
        "${time.substring(0, 5)} UTC"
    } catch (e: Exception) {
        raw
    }
}
