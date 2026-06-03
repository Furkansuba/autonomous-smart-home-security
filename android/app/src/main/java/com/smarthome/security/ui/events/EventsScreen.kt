package com.smarthome.security.ui.events

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
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
import androidx.compose.material3.SuggestionChip
import androidx.compose.material3.SuggestionChipDefaults
import androidx.compose.material3.Text
import androidx.compose.material3.TopAppBar
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import androidx.compose.runtime.getValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.smarthome.security.data.model.Event

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun EventsScreen(
    viewModel: EventsViewModel,
    onNavigateBack: () -> Unit,
    onSessionExpired: () -> Unit,
) {
    val uiState by viewModel.uiState.collectAsStateWithLifecycle()

    Scaffold(
        topBar = {
            TopAppBar(
                title = { Text("Events & Alerts") },
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
                is EventsUiState.Loading -> {
                    CircularProgressIndicator(modifier = Modifier.align(Alignment.Center))
                }

                is EventsUiState.Error -> {
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
                                Button(onClick = { viewModel.loadEvents() }) {
                                    Text("Retry")
                                }
                            }
                        }
                    }
                }

                is EventsUiState.SessionExpired -> {
                    LaunchedEffect(Unit) { onSessionExpired() }
                }
                is EventsUiState.Success -> {
                    if (state.events.isEmpty()) {
                        Card(
                            modifier = Modifier
                                .align(Alignment.Center)
                                .padding(24.dp),
                        ) {
                            Text(
                                text = "No events found.",
                                modifier = Modifier.padding(horizontal = 24.dp, vertical = 16.dp),
                                color = MaterialTheme.colorScheme.onSurfaceVariant,
                            )
                        }
                    } else {
                        LazyColumn(
                            modifier = Modifier
                                .fillMaxSize()
                                .padding(horizontal = 16.dp, vertical = 8.dp),
                            verticalArrangement = Arrangement.spacedBy(12.dp),
                        ) {
                            items(state.events) { event ->
                                EventCard(event = event)
                            }
                        }
                    }
                }
            }
        }
    }
}

@Composable
private fun EventCard(event: Event) {
    Card(
        modifier = Modifier.fillMaxWidth(),
        elevation = CardDefaults.cardElevation(defaultElevation = 2.dp),
    ) {
        Column(
            modifier = Modifier.padding(16.dp),
            verticalArrangement = Arrangement.spacedBy(6.dp),
        ) {
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.SpaceBetween,
                verticalAlignment = Alignment.CenterVertically,
            ) {
                Text(
                    text = formatEventType(event.eventType),
                    fontWeight = FontWeight.SemiBold,
                    fontSize = 16.sp,
                )
                SeverityChip(severity = event.severity)
            }

            EventRow(label = "Device", value = event.deviceId)

            if (!event.roomId.isNullOrBlank()) {
                EventRow(label = "Room", value = formatRoomId(event.roomId))
            }

            if (!event.message.isNullOrBlank()) {
                EventRow(label = "Message", value = event.message)
            }

            EventRow(label = "Time", value = formatTimestamp(event.occurredAt))

            if (event.confirmed != null) {
                EventRow(label = "Confirmed", value = if (event.confirmed) "Yes" else "No")
            }
        }
    }
}

@Composable
private fun EventRow(label: String, value: String) {
    Row(
        modifier = Modifier.fillMaxWidth(),
        horizontalArrangement = Arrangement.SpaceBetween,
    ) {
        Text(
            text = label,
            fontSize = 13.sp,
            color = MaterialTheme.colorScheme.onSurfaceVariant,
        )
        Text(
            text = value,
            fontSize = 13.sp,
            fontWeight = FontWeight.Medium,
        )
    }
}

@Composable
private fun SeverityChip(severity: String) {
    val (containerColor, labelColor) = when (severity) {
        "critical" -> Color(0xFFB71C1C) to Color.White
        "warning" -> Color(0xFFF57F17) to Color.White
        else -> Color(0xFF1565C0) to Color.White
    }
    SuggestionChip(
        onClick = {},
        label = { Text(text = severity.replaceFirstChar { it.uppercase() }, fontSize = 12.sp) },
        colors = SuggestionChipDefaults.suggestionChipColors(
            containerColor = containerColor,
            labelColor = labelColor,
        ),
    )
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
