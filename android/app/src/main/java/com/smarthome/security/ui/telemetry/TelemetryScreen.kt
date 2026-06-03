package com.smarthome.security.ui.telemetry

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowBack
import androidx.compose.material3.Button
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Text
import androidx.compose.material3.TopAppBar
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.mutableStateListOf
import androidx.compose.runtime.remember
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import androidx.compose.runtime.getValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.unit.dp
import com.smarthome.security.data.model.TelemetrySummary

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun TelemetryScreen(
    viewModel: TelemetryViewModel,
    onNavigateBack: () -> Unit,
    onSessionExpired: () -> Unit,
) {
    val uiState by viewModel.uiState.collectAsStateWithLifecycle()

    Scaffold(
        topBar = {
            TopAppBar(
                title = { Text("Telemetry") },
                navigationIcon = {
                    IconButton(onClick = onNavigateBack) {
                        Icon(
                            imageVector = Icons.AutoMirrored.Filled.ArrowBack,
                            contentDescription = "Back",
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
                    Column(
                        modifier = Modifier
                            .fillMaxWidth()
                            .padding(16.dp),
                        verticalArrangement = Arrangement.spacedBy(8.dp),
                    ) {
                        Card(
                            modifier = Modifier.fillMaxWidth(),
                            colors = CardDefaults.cardColors(
                                containerColor = MaterialTheme.colorScheme.errorContainer,
                            ),
                        ) {
                            Column(modifier = Modifier.padding(16.dp)) {
                                Text(
                                    text = state.message,
                                    color = MaterialTheme.colorScheme.onErrorContainer,
                                )
                                Spacer(modifier = Modifier.height(8.dp))
                                Button(onClick = { viewModel.loadTelemetry() }) {
                                    Text("Retry")
                                }
                            }
                        }
                    }
                }
                is TelemetryUiState.SessionExpired -> {
                    LaunchedEffect(Unit) { onSessionExpired() }
                }
                is TelemetryUiState.Empty -> {
                    Text(
                        text = "No telemetry readings available.",
                        modifier = Modifier
                            .align(Alignment.Center)
                            .padding(16.dp),
                        style = MaterialTheme.typography.bodyMedium,
                        color = MaterialTheme.colorScheme.onSurfaceVariant,
                    )
                }
                is TelemetryUiState.Success -> {
                    TelemetryList(
                        readings = state.readings,
                        modifier = Modifier.fillMaxSize(),
                    )
                }
            }
        }
    }
}

@Composable
private fun TelemetryList(
    readings: List<TelemetrySummary>,
    modifier: Modifier = Modifier,
) {
    val expandedKeys = remember { mutableStateListOf<String>() }

    LazyColumn(
        modifier = modifier,
        contentPadding = PaddingValues(16.dp),
        verticalArrangement = Arrangement.spacedBy(8.dp),
    ) {
        items(
            items = readings,
            key = { r -> "${r.deviceId}_${r.occurredAt ?: r.createdAt ?: ""}" },
        ) { reading ->
            val key = "${reading.deviceId}_${reading.occurredAt ?: reading.createdAt ?: ""}"
            TelemetryCard(
                reading = reading,
                expanded = key in expandedKeys,
                onToggle = {
                    if (key in expandedKeys) expandedKeys.remove(key) else expandedKeys.add(key)
                },
            )
        }
    }
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
private fun TelemetryCard(
    reading: TelemetrySummary,
    expanded: Boolean,
    onToggle: () -> Unit,
) {
    val title = reading.roomId?.let { formatRoomId(it) } ?: reading.deviceId
    val status = derivePrimaryStatus(reading)
    val alert = isAlertStatus(reading)
    val timestamp = shortTimestamp(reading.occurredAt ?: reading.createdAt)

    Card(
        onClick = onToggle,
        modifier = Modifier.fillMaxWidth(),
        colors = CardDefaults.cardColors(
            containerColor = if (alert)
                MaterialTheme.colorScheme.errorContainer
            else
                MaterialTheme.colorScheme.surfaceVariant,
        ),
    ) {
        Column(modifier = Modifier.padding(16.dp)) {
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.SpaceBetween,
                verticalAlignment = Alignment.CenterVertically,
            ) {
                Text(text = title, style = MaterialTheme.typography.titleSmall)
                Row(verticalAlignment = Alignment.CenterVertically) {
                    Text(
                        text = timestamp,
                        style = MaterialTheme.typography.bodySmall,
                        color = MaterialTheme.colorScheme.onSurfaceVariant,
                    )
                    Spacer(modifier = Modifier.width(4.dp))
                    Text(
                        text = if (expanded) "▴" else "▾",
                        style = MaterialTheme.typography.bodyMedium,
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
                TelemetryCardDetails(reading = reading)
            }
        }
    }
}

@Composable
private fun TelemetryCardDetails(reading: TelemetrySummary) {
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
