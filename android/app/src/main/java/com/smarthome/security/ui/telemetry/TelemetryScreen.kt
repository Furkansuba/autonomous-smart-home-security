package com.smarthome.security.ui.telemetry

import androidx.compose.foundation.background
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
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Air
import androidx.compose.material.icons.filled.CheckCircle
import androidx.compose.material.icons.filled.ExpandLess
import androidx.compose.material.icons.filled.ExpandMore
import androidx.compose.material.icons.filled.Sensors
import androidx.compose.material.icons.filled.Thermostat
import androidx.compose.material.icons.filled.Warning
import androidx.compose.material3.Button
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Text
import androidx.compose.material3.TopAppBar
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateListOf
import androidx.compose.runtime.remember
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import com.smarthome.security.data.model.TelemetrySummary
import com.smarthome.security.ui.theme.AppColors

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun TelemetryScreen(
    viewModel: TelemetryViewModel,
    onSessionExpired: () -> Unit,
) {
    val uiState by viewModel.uiState.collectAsStateWithLifecycle()

    Scaffold(
        topBar = {
            TopAppBar(
            title = {
                Column {
                    Text("Sensors")
                    Text(
                        text = "Room sensor readings",
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
                is TelemetryUiState.Loading -> {
                    CircularProgressIndicator(modifier = Modifier.align(Alignment.Center))
                }
                is TelemetryUiState.Error -> {
                    SensorsErrorState(
                        message = state.message,
                        onRetry = { viewModel.loadTelemetry() },
                        modifier = Modifier
                            .align(Alignment.Center)
                            .padding(32.dp),
                    )
                }
                is TelemetryUiState.SessionExpired -> {
                    LaunchedEffect(Unit) { onSessionExpired() }
                }
                is TelemetryUiState.Empty -> {
                    SensorsEmptyState(
                        modifier = Modifier
                            .align(Alignment.Center)
                            .padding(32.dp),
                    )
                }
                is TelemetryUiState.Success -> {
                    SensorsContent(
                        readings = state.readings,
                        modifier = Modifier.fillMaxSize(),
                    )
                }
            }
        }
    }
}

@Composable
private fun SensorsEmptyState(modifier: Modifier = Modifier) {
    Column(
        modifier = modifier,
        horizontalAlignment = Alignment.CenterHorizontally,
        verticalArrangement = Arrangement.Center,
    ) {
        Icon(
            imageVector = Icons.Filled.Sensors,
            contentDescription = null,
            modifier = Modifier.size(64.dp),
            tint = MaterialTheme.colorScheme.onSurfaceVariant.copy(alpha = 0.4f),
        )
        Spacer(modifier = Modifier.height(16.dp))
        Text(
            text = "No Sensor Readings",
            style = MaterialTheme.typography.titleMedium,
            color = MaterialTheme.colorScheme.onSurface,
            textAlign = TextAlign.Center,
        )
        Spacer(modifier = Modifier.height(8.dp))
        Text(
            text = "Readings will appear here when devices report data.",
            style = MaterialTheme.typography.bodyMedium,
            color = MaterialTheme.colorScheme.onSurfaceVariant,
            textAlign = TextAlign.Center,
        )
    }
}

@Composable
private fun SensorsErrorState(
    message: String,
    onRetry: () -> Unit,
    modifier: Modifier = Modifier,
) {
    Column(
        modifier = modifier,
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
            text = "Could not load readings",
            style = MaterialTheme.typography.titleMedium,
            color = MaterialTheme.colorScheme.onSurface,
        )
        Spacer(modifier = Modifier.height(8.dp))
        Text(
            text = message,
            style = MaterialTheme.typography.bodySmall,
            color = MaterialTheme.colorScheme.onSurfaceVariant,
            textAlign = TextAlign.Center,
        )
        Spacer(modifier = Modifier.height(24.dp))
        Button(onClick = onRetry) { Text("Retry") }
    }
}

@Composable
private fun SensorsContent(
    readings: List<TelemetrySummary>,
    modifier: Modifier = Modifier,
) {
    val expandedKeys = remember { mutableStateListOf<String>() }

    val alertingReadings = readings.filter { isAlertStatus(it) }
    val normalReadings = readings.filter { !isAlertStatus(it) }
    val distinctRooms = readings.mapNotNull { it.roomId }.distinct().size

    LazyColumn(
        modifier = modifier,
        contentPadding = PaddingValues(bottom = 16.dp),
    ) {
        item {
            SensorsHeader(
                readings = readings,
                roomsCount = distinctRooms,
                alertCount = alertingReadings.size,
            )
        }

        item {
            SensorsSummaryCard(
                totalReadings = readings.size,
                roomsCount = distinctRooms,
                alertCount = alertingReadings.size,
                modifier = Modifier
                    .padding(horizontal = 16.dp)
                    .padding(bottom = 8.dp),
            )
        }

        if (alertingReadings.isNotEmpty()) {
            item {
                SectionLabel(
                    title = "NEEDS ATTENTION",
                    count = alertingReadings.size,
                    isAlert = true,
                )
            }
            items(
                items = alertingReadings,
                key = { r -> "alert_${r.deviceId}_${r.occurredAt ?: r.createdAt ?: ""}" },
            ) { reading ->
                val key = "alert_${reading.deviceId}_${reading.occurredAt ?: reading.createdAt ?: ""}"
                SensorCard(
                    reading = reading,
                    expanded = key in expandedKeys,
                    onToggle = {
                        if (key in expandedKeys) expandedKeys.remove(key) else expandedKeys.add(key)
                    },
                    modifier = Modifier
                        .padding(horizontal = 16.dp)
                        .padding(bottom = 8.dp),
                )
            }
        }

        if (normalReadings.isNotEmpty()) {
            item {
                SectionLabel(
                    title = if (alertingReadings.isEmpty()) "READINGS" else "CLEAR READINGS",
                    count = normalReadings.size,
                    isAlert = false,
                )
            }
            items(
                items = normalReadings,
                key = { r -> "normal_${r.deviceId}_${r.occurredAt ?: r.createdAt ?: ""}" },
            ) { reading ->
                val key = "normal_${reading.deviceId}_${reading.occurredAt ?: reading.createdAt ?: ""}"
                SensorCard(
                    reading = reading,
                    expanded = key in expandedKeys,
                    onToggle = {
                        if (key in expandedKeys) expandedKeys.remove(key) else expandedKeys.add(key)
                    },
                    modifier = Modifier
                        .padding(horizontal = 16.dp)
                        .padding(bottom = 8.dp),
                )
            }
        }
    }
}

@Composable
private fun SensorsHeader(
    readings: List<TelemetrySummary>,
    roomsCount: Int,
    alertCount: Int,
) {
    val isAlert = alertCount > 0
    val dynamicSummary = deriveDynamicSummary(readings)

    Column(
        modifier = Modifier
            .fillMaxWidth()
            .padding(horizontal = 16.dp, vertical = 12.dp),
    ) {
        Row(verticalAlignment = Alignment.CenterVertically) {
            Icon(
                imageVector = if (isAlert) Icons.Filled.Warning else Icons.Filled.CheckCircle,
                contentDescription = null,
                tint = if (isAlert) MaterialTheme.colorScheme.error else AppColors.statusOnline,
                modifier = Modifier.size(14.dp),
            )
            Spacer(modifier = Modifier.width(6.dp))
            Text(
                text = dynamicSummary,
                style = MaterialTheme.typography.bodyMedium,
                color = if (isAlert) MaterialTheme.colorScheme.error else AppColors.statusOnline,
            )
        }
        if (roomsCount > 0) {
            Spacer(modifier = Modifier.height(2.dp))
            Text(
                text = "$roomsCount room${if (roomsCount != 1) "s" else ""} reporting",
                style = MaterialTheme.typography.bodySmall,
                color = MaterialTheme.colorScheme.onSurfaceVariant,
            )
        }
    }
}

@Composable
private fun SensorsSummaryCard(
    totalReadings: Int,
    roomsCount: Int,
    alertCount: Int,
    modifier: Modifier = Modifier,
) {
    val clearCount = totalReadings - alertCount

    Card(
        modifier = modifier.fillMaxWidth(),
        colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surfaceVariant),
        shape = RoundedCornerShape(12.dp),
    ) {
        Column(modifier = Modifier.padding(16.dp)) {
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.SpaceEvenly,
                verticalAlignment = Alignment.CenterVertically,
            ) {
                SummaryMetric(value = totalReadings.toString(), label = "Readings")
                Box(
                    modifier = Modifier
                        .width(1.dp)
                        .height(36.dp)
                        .background(MaterialTheme.colorScheme.onSurfaceVariant.copy(alpha = 0.2f)),
                )
                SummaryMetric(value = roomsCount.toString(), label = "Rooms")
                Box(
                    modifier = Modifier
                        .width(1.dp)
                        .height(36.dp)
                        .background(MaterialTheme.colorScheme.onSurfaceVariant.copy(alpha = 0.2f)),
                )
                SummaryMetric(
                    value = alertCount.toString(),
                    label = "Needs review",
                    valueColor = if (alertCount > 0) MaterialTheme.colorScheme.error
                                 else MaterialTheme.colorScheme.onSurfaceVariant,
                )
            }
            if (totalReadings > 0) {
                Spacer(modifier = Modifier.height(12.dp))
                StatusDistributionBar(alertCount = alertCount, clearCount = clearCount)
            }
        }
    }
}

@Composable
private fun SummaryMetric(
    value: String,
    label: String,
    valueColor: Color = Color.Unspecified,
) {
    Column(horizontalAlignment = Alignment.CenterHorizontally) {
        Text(
            text = value,
            style = MaterialTheme.typography.headlineSmall,
            color = valueColor,
        )
        Text(
            text = label,
            style = MaterialTheme.typography.labelSmall,
            color = MaterialTheme.colorScheme.onSurfaceVariant,
        )
    }
}

@Composable
private fun StatusDistributionBar(alertCount: Int, clearCount: Int) {
    Column {
        Row(
            modifier = Modifier.fillMaxWidth(),
            horizontalArrangement = Arrangement.SpaceBetween,
        ) {
            Text(
                text = "$clearCount clear",
                style = MaterialTheme.typography.labelSmall,
                color = AppColors.statusOnline,
            )
            Text(
                text = if (alertCount > 0) "$alertCount alerting" else "All clear",
                style = MaterialTheme.typography.labelSmall,
                color = if (alertCount > 0) MaterialTheme.colorScheme.error else AppColors.statusOnline,
            )
        }
        Spacer(modifier = Modifier.height(4.dp))
        Row(
            modifier = Modifier
                .fillMaxWidth()
                .height(6.dp)
                .clip(RoundedCornerShape(3.dp)),
        ) {
            if (clearCount > 0) {
                Box(
                    modifier = Modifier
                        .weight(clearCount.toFloat())
                        .fillMaxHeight()
                        .background(AppColors.statusOnline),
                )
            }
            if (alertCount > 0) {
                Box(
                    modifier = Modifier
                        .weight(alertCount.toFloat())
                        .fillMaxHeight()
                        .background(MaterialTheme.colorScheme.error),
                )
            }
        }
    }
}

@Composable
private fun SectionLabel(title: String, count: Int, isAlert: Boolean) {
    Row(
        modifier = Modifier
            .fillMaxWidth()
            .padding(horizontal = 16.dp, vertical = 8.dp),
        horizontalArrangement = Arrangement.SpaceBetween,
        verticalAlignment = Alignment.CenterVertically,
    ) {
        Text(
            text = title,
            style = MaterialTheme.typography.labelMedium,
            color = if (isAlert) MaterialTheme.colorScheme.error
                    else MaterialTheme.colorScheme.onSurfaceVariant,
        )
        Text(
            text = count.toString(),
            style = MaterialTheme.typography.labelMedium,
            color = if (isAlert) MaterialTheme.colorScheme.error
                    else MaterialTheme.colorScheme.onSurfaceVariant,
        )
    }
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
private fun SensorCard(
    reading: TelemetrySummary,
    expanded: Boolean,
    onToggle: () -> Unit,
    modifier: Modifier = Modifier,
) {
    val title = reading.roomId?.let { formatRoomId(it) } ?: reading.deviceId
    val status = derivePrimaryStatus(reading)
    val alert = isAlertStatus(reading)
    val timestamp = shortTimestamp(reading.occurredAt ?: reading.createdAt)
    val sensorIcon = deriveSensorIcon(reading)
    val accentColor = when {
        alert -> MaterialTheme.colorScheme.error
        reading.gasRaw != null || reading.coRaw != null -> MaterialTheme.colorScheme.tertiary
        reading.temperatureC != null || reading.humidityPercent != null -> MaterialTheme.colorScheme.primary
        else -> MaterialTheme.colorScheme.onSurfaceVariant
    }

    Card(
        onClick = onToggle,
        modifier = modifier.fillMaxWidth(),
        colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surfaceVariant),
        shape = RoundedCornerShape(12.dp),
    ) {
        Row(modifier = Modifier.height(IntrinsicSize.Min)) {
            Box(
                modifier = Modifier
                    .width(4.dp)
                    .fillMaxHeight()
                    .background(accentColor),
            )
            Column(
                modifier = Modifier
                    .weight(1f)
                    .padding(12.dp),
            ) {
                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.SpaceBetween,
                    verticalAlignment = Alignment.CenterVertically,
                ) {
                    Row(
                        verticalAlignment = Alignment.CenterVertically,
                        modifier = Modifier.weight(1f),
                    ) {
                        Icon(
                            imageVector = sensorIcon,
                            contentDescription = null,
                            tint = accentColor,
                            modifier = Modifier.size(18.dp),
                        )
                        Spacer(modifier = Modifier.width(8.dp))
                        Text(
                            text = title,
                            style = MaterialTheme.typography.titleSmall,
                            maxLines = 1,
                            overflow = TextOverflow.Ellipsis,
                        )
                    }
                    Row(verticalAlignment = Alignment.CenterVertically) {
                        Text(
                            text = timestamp,
                            style = MaterialTheme.typography.bodySmall,
                            color = MaterialTheme.colorScheme.onSurfaceVariant,
                        )
                        Spacer(modifier = Modifier.width(4.dp))
                        Icon(
                            imageVector = if (expanded) Icons.Filled.ExpandLess else Icons.Filled.ExpandMore,
                            contentDescription = if (expanded) "Collapse" else "Expand",
                            tint = MaterialTheme.colorScheme.onSurfaceVariant,
                            modifier = Modifier.size(18.dp),
                        )
                    }
                }
                Spacer(modifier = Modifier.height(4.dp))
                Text(
                    text = status,
                    style = MaterialTheme.typography.bodySmall,
                    color = if (alert) MaterialTheme.colorScheme.error
                            else MaterialTheme.colorScheme.onSurfaceVariant,
                )
                Text(
                    text = reading.deviceId,
                    style = MaterialTheme.typography.labelSmall,
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                )
                if (expanded) {
                    Spacer(modifier = Modifier.height(12.dp))
                    SensorCardDetails(reading = reading)
                }
            }
        }
    }
}

@Composable
private fun SensorCardDetails(reading: TelemetrySummary) {
    val hasSecuritySignals = reading.motionDetected != null ||
        reading.flameDetected != null ||
        reading.reedOpen != null
    val hasAirSafety = reading.gasRaw != null || reading.coRaw != null
    val hasEnvironment = reading.temperatureC != null || reading.humidityPercent != null

    if (hasSecuritySignals) {
        SectionHeader("Security Signals")
        reading.motionDetected?.let {
            DetailRow("Motion", if (it) "Detected" else "Clear", alert = it)
        }
        reading.flameDetected?.let {
            DetailRow("Flame", if (it) "Detected" else "Clear", alert = it)
        }
        reading.reedOpen?.let {
            DetailRow("Reed Switch", if (it) "Open" else "Closed", alert = it)
        }
    }

    if (hasAirSafety) {
        SectionHeader("Air Safety")
        reading.gasRaw?.let { DetailRow("Gas (raw)", it.toString()) }
        reading.coRaw?.let { DetailRow("CO (raw)", it.toString()) }
    }

    if (hasEnvironment) {
        SectionHeader("Environment")
        reading.temperatureC?.let { DetailRow("Temperature", "%.1f °C".format(it)) }
        reading.humidityPercent?.let { DetailRow("Humidity", "%.1f %%".format(it)) }
    }

    SectionHeader("Metadata")
    DetailRow("Device", reading.deviceId)
    reading.roomId?.let { DetailRow("Room", formatRoomId(it)) }
    val ts = reading.occurredAt ?: reading.createdAt
    ts?.let { DetailRow("Recorded", it.replace("T", " ").substringBefore(".") + " UTC") }
}

@Composable
private fun DetailRow(label: String, value: String, alert: Boolean = false) {
    Row(
        modifier = Modifier
            .fillMaxWidth()
            .padding(vertical = 3.dp),
        horizontalArrangement = Arrangement.SpaceBetween,
    ) {
        Text(
            text = label,
            style = MaterialTheme.typography.bodySmall,
            color = MaterialTheme.colorScheme.onSurfaceVariant,
        )
        Text(
            text = value,
            style = MaterialTheme.typography.bodySmall,
            color = if (alert) MaterialTheme.colorScheme.error else Color.Unspecified,
        )
    }
}

@Composable
private fun SectionHeader(title: String) {
    Text(
        text = title,
        style = MaterialTheme.typography.labelMedium,
        color = MaterialTheme.colorScheme.onSurfaceVariant,
        modifier = Modifier.padding(top = 8.dp, bottom = 2.dp),
    )
}

private fun deriveSensorIcon(t: TelemetrySummary): ImageVector = when {
    t.flameDetected == true || t.motionDetected == true || t.reedOpen == true -> Icons.Filled.Warning
    t.gasRaw != null || t.coRaw != null -> Icons.Filled.Air
    t.temperatureC != null || t.humidityPercent != null -> Icons.Filled.Thermostat
    else -> Icons.Filled.Sensors
}

private fun deriveDynamicSummary(readings: List<TelemetrySummary>): String {
    readings.firstOrNull { it.flameDetected == true }?.let { r ->
        return "Flame detected in ${r.roomId?.let { formatRoomId(it) } ?: r.deviceId}"
    }
    readings.firstOrNull { it.motionDetected == true }?.let { r ->
        return "Motion detected in ${r.roomId?.let { formatRoomId(it) } ?: r.deviceId}"
    }
    readings.firstOrNull { it.reedOpen == true }?.let { r ->
        return "Door open in ${r.roomId?.let { formatRoomId(it) } ?: r.deviceId}"
    }
    return "All sensors clear"
}

private fun derivePrimaryStatus(t: TelemetrySummary): String = when {
    t.flameDetected == true -> "Flame detected"
    t.motionDetected == true -> "Motion detected"
    t.reedOpen == true -> "Door / window open"
    t.gasRaw != null || t.coRaw != null -> "Air reading"
    else -> "Normal reading"
}

private fun isAlertStatus(t: TelemetrySummary): Boolean =
    t.flameDetected == true || t.motionDetected == true || t.reedOpen == true

private fun shortTimestamp(raw: String?): String {
    if (raw == null) return "—"
    return raw.substringAfter("T").take(5)
}

private fun formatRoomId(raw: String): String =
    raw.replace('_', ' ').replaceFirstChar { it.uppercase() }
