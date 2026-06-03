package com.smarthome.security.ui.telemetry

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
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
import androidx.compose.runtime.collectAsState
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
    val uiState by viewModel.uiState.collectAsState()

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
                            .align(Alignment.Center)
                            .padding(24.dp),
                        horizontalAlignment = Alignment.CenterHorizontally,
                        verticalArrangement = Arrangement.spacedBy(12.dp),
                    ) {
                        Text(
                            text = state.message,
                            style = MaterialTheme.typography.bodyLarge,
                            color = MaterialTheme.colorScheme.error,
                        )
                        Button(onClick = { viewModel.loadTelemetry() }) {
                            Text("Retry")
                        }
                    }
                }
                is TelemetryUiState.SessionExpired -> {
                    LaunchedEffect(Unit) { onSessionExpired() }
                }
                is TelemetryUiState.Success -> {
                    TelemetryContent(
                        telemetry = state.telemetry,
                        modifier = Modifier
                            .fillMaxSize()
                            .verticalScroll(rememberScrollState())
                            .padding(16.dp),
                    )
                }
            }
        }
    }
}

@Composable
private fun TelemetryContent(
    telemetry: TelemetrySummary,
    modifier: Modifier = Modifier,
) {
    Column(modifier = modifier, verticalArrangement = Arrangement.spacedBy(10.dp)) {
        Text("Latest Sensor Readings", style = MaterialTheme.typography.titleMedium)
        Spacer(modifier = Modifier.height(2.dp))

        InfoCard(label = "Device ID", value = telemetry.deviceId)
        telemetry.roomId?.let { InfoCard(label = "Room", value = it) }

        telemetry.temperatureC?.let {
            InfoCard(label = "Temperature", value = "%.1f °C".format(it))
        }
        telemetry.humidityPercent?.let {
            InfoCard(label = "Humidity", value = "%.1f %%".format(it))
        }

        telemetry.motionDetected?.let {
            AlertCard(label = "Motion Detected", active = it, activeLabel = "YES", inactiveLabel = "No")
        }
        telemetry.flameDetected?.let {
            AlertCard(label = "Flame Detected", active = it, activeLabel = "DETECTED", inactiveLabel = "None")
        }
        telemetry.gasRaw?.let {
            InfoCard(label = "Gas (raw)", value = it.toString())
        }
        telemetry.coRaw?.let {
            InfoCard(label = "CO (raw)", value = it.toString())
        }
        telemetry.reedOpen?.let {
            AlertCard(label = "Reed Switch", active = it, activeLabel = "OPEN", inactiveLabel = "Closed")
        }

        val timestamp = telemetry.occurredAt ?: telemetry.createdAt
        timestamp?.let {
            Spacer(modifier = Modifier.height(2.dp))
            InfoCard(label = "Recorded At", value = it.replace("T", " ").substringBefore("."))
        }
    }
}

@Composable
private fun InfoCard(label: String, value: String) {
    Card(
        modifier = Modifier.fillMaxWidth(),
        colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surfaceVariant),
    ) {
        Row(
            modifier = Modifier
                .fillMaxWidth()
                .padding(horizontal = 16.dp, vertical = 12.dp),
            horizontalArrangement = Arrangement.SpaceBetween,
        ) {
            Text(label, style = MaterialTheme.typography.bodyMedium, color = MaterialTheme.colorScheme.onSurfaceVariant)
            Text(value, style = MaterialTheme.typography.bodyMedium)
        }
    }
}

@Composable
private fun AlertCard(
    label: String,
    active: Boolean,
    activeLabel: String,
    inactiveLabel: String,
) {
    val containerColor = if (active)
        MaterialTheme.colorScheme.errorContainer
    else
        MaterialTheme.colorScheme.surfaceVariant
    val valueColor = if (active) MaterialTheme.colorScheme.error else Color.Unspecified

    Card(
        modifier = Modifier.fillMaxWidth(),
        colors = CardDefaults.cardColors(containerColor = containerColor),
    ) {
        Row(
            modifier = Modifier
                .fillMaxWidth()
                .padding(horizontal = 16.dp, vertical = 12.dp),
            horizontalArrangement = Arrangement.SpaceBetween,
        ) {
            Text(label, style = MaterialTheme.typography.bodyMedium, color = MaterialTheme.colorScheme.onSurfaceVariant)
            Text(
                text = if (active) activeLabel else inactiveLabel,
                style = MaterialTheme.typography.bodyMedium,
                color = valueColor,
            )
        }
    }
}
