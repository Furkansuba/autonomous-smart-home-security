package com.smarthome.security.ui.devices

import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxHeight
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.IntrinsicSize
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowBack
import androidx.compose.material.icons.filled.DeviceHub
import androidx.compose.material.icons.filled.ExpandLess
import androidx.compose.material.icons.filled.ExpandMore
import androidx.compose.material3.Button
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Text
import androidx.compose.material3.TopAppBar
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import com.smarthome.security.data.model.Device
import com.smarthome.security.ui.theme.AppColors

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun DevicesScreen(
    viewModel: DevicesViewModel,
    onNavigateBack: () -> Unit,
    onSessionExpired: () -> Unit,
    showBackButton: Boolean = true,
) {
    val uiState by viewModel.uiState.collectAsStateWithLifecycle()

    Scaffold(
        topBar = {
            TopAppBar(
                title = {
                    Column {
                        Text("Devices")
                        Text(
                            text = "Device fleet status",
                            style = MaterialTheme.typography.bodySmall,
                            color = MaterialTheme.colorScheme.onSurfaceVariant,
                        )
                    }
                },
                navigationIcon = {
                    if (showBackButton) {
                        IconButton(onClick = onNavigateBack) {
                            Icon(
                                imageVector = Icons.AutoMirrored.Filled.ArrowBack,
                                contentDescription = "Back",
                            )
                        }
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
                is DevicesUiState.Loading -> {
                    CircularProgressIndicator(modifier = Modifier.align(Alignment.Center))
                }

                is DevicesUiState.Error -> {
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
                                Button(onClick = { viewModel.loadDevices() }) {
                                    Text("Retry")
                                }
                            }
                        }
                    }
                }

                is DevicesUiState.SessionExpired -> {
                    LaunchedEffect(Unit) { onSessionExpired() }
                }

                is DevicesUiState.Success -> {
                    if (state.devices.isEmpty()) {
                        EmptyDevicesState(modifier = Modifier.align(Alignment.Center))
                    } else {
                        DeviceRoster(devices = state.devices)
                    }
                }
            }
        }
    }
}

@Composable
private fun DeviceRoster(devices: List<Device>) {
    val needsAttention = devices
        .filter { it.status == "offline" || it.status == "degraded" }
        .sortedWith(compareBy({ if (it.status == "offline") 0 else 1 }, { it.name }))

    val healthy = devices
        .filter { it.status == "online" }
        .sortedBy { it.name }

    val healthyGrouped = healthy
        .groupBy { device ->
            device.locationLabel?.takeIf { it.isNotBlank() } ?: ""
        }
        .toSortedMap(compareBy { if (it.isEmpty()) "￿" else it })

    val degradedCount = devices.count { it.status == "degraded" }
    val offlineCount = devices.count { it.status == "offline" }

    LazyColumn(
        modifier = Modifier
            .fillMaxSize()
            .padding(horizontal = 16.dp),
        verticalArrangement = Arrangement.spacedBy(8.dp),
        contentPadding = PaddingValues(vertical = 12.dp),
    ) {
        item {
            DeviceSummaryHeader(
                total = devices.size,
                onlineCount = healthy.size,
                degradedCount = degradedCount,
                offlineCount = offlineCount,
            )
        }

        if (needsAttention.isNotEmpty()) {
            item {
                SectionLabel(title = "NEEDS ATTENTION", color = AppColors.statusOffline)
            }
            items(needsAttention, key = { it.deviceId }) { device ->
                DeviceCard(device = device)
            }
        }

        if (healthy.isNotEmpty()) {
            if (needsAttention.isNotEmpty()) {
                item {
                    SectionLabel(title = "ONLINE", color = AppColors.statusOnline)
                }
            }
            healthyGrouped.forEach { (location, locationDevices) ->
                if (location.isNotBlank()) {
                    item(key = "loc_$location") {
                        LocationHeader(title = location)
                    }
                }
                items(locationDevices, key = { it.deviceId }) { device ->
                    DeviceCard(device = device)
                }
            }
        }
    }
}

@Composable
private fun DeviceSummaryHeader(
    total: Int,
    onlineCount: Int,
    degradedCount: Int,
    offlineCount: Int,
) {
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
                text = "$total ${if (total == 1) "Device" else "Devices"}",
                fontWeight = FontWeight.Bold,
                fontSize = 18.sp,
                color = MaterialTheme.colorScheme.onSurface,
            )
            Row(horizontalArrangement = Arrangement.spacedBy(16.dp)) {
                StatusCountBadge(count = onlineCount, label = "Online", color = AppColors.statusOnline)
                if (degradedCount > 0) {
                    StatusCountBadge(count = degradedCount, label = "Degraded", color = AppColors.statusDegraded)
                }
                if (offlineCount > 0) {
                    StatusCountBadge(count = offlineCount, label = "Offline", color = AppColors.statusOffline)
                }
            }
            Row(
                modifier = Modifier
                    .fillMaxWidth()
                    .height(4.dp)
                    .clip(RoundedCornerShape(2.dp)),
            ) {
                if (onlineCount > 0) {
                    Box(
                        modifier = Modifier
                            .weight(onlineCount.toFloat())
                            .fillMaxHeight()
                            .background(AppColors.statusOnline),
                    )
                }
                if (degradedCount > 0) {
                    Box(
                        modifier = Modifier
                            .weight(degradedCount.toFloat())
                            .fillMaxHeight()
                            .background(AppColors.statusDegraded),
                    )
                }
                if (offlineCount > 0) {
                    Box(
                        modifier = Modifier
                            .weight(offlineCount.toFloat())
                            .fillMaxHeight()
                            .background(AppColors.statusOffline),
                    )
                }
            }
        }
    }
}

@Composable
private fun StatusCountBadge(count: Int, label: String, color: Color) {
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
private fun LocationHeader(title: String) {
    Text(
        text = title,
        modifier = Modifier
            .fillMaxWidth()
            .padding(top = 4.dp, bottom = 2.dp, start = 2.dp),
        fontSize = 12.sp,
        fontWeight = FontWeight.Medium,
        color = MaterialTheme.colorScheme.onSurfaceVariant,
        letterSpacing = 0.5.sp,
    )
}

@Composable
private fun DeviceCard(device: Device) {
    var expanded by remember { mutableStateOf(false) }

    val statusColor = when (device.status) {
        "online" -> AppColors.statusOnline
        "degraded" -> AppColors.statusDegraded
        else -> AppColors.statusOffline
    }

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
            if (device.status != "online") {
                Box(
                    modifier = Modifier
                        .width(3.dp)
                        .fillMaxHeight()
                        .background(statusColor),
                )
            }
            Column(
                modifier = Modifier
                    .weight(1f)
                    .padding(horizontal = 16.dp, vertical = 12.dp),
            ) {
                Row(
                    modifier = Modifier.fillMaxWidth(),
                    verticalAlignment = Alignment.CenterVertically,
                    horizontalArrangement = Arrangement.spacedBy(10.dp),
                ) {
                    Box(
                        modifier = Modifier
                            .size(10.dp)
                            .clip(CircleShape)
                            .background(statusColor),
                    )
                    Column(modifier = Modifier.weight(1f)) {
                        Text(
                            text = device.name,
                            fontWeight = FontWeight.SemiBold,
                            fontSize = 15.sp,
                            color = MaterialTheme.colorScheme.onSurface,
                        )
                        val subtitle = buildString {
                            device.locationLabel?.takeIf { it.isNotBlank() }?.let { append(it) }
                            device.lastHeartbeatAt?.let { ts ->
                                if (isNotEmpty()) append("  ·  ")
                                append("Last heartbeat · ${shortTimestamp(ts)}")
                            }
                        }
                        if (subtitle.isNotBlank()) {
                            Text(
                                text = subtitle,
                                fontSize = 12.sp,
                                color = MaterialTheme.colorScheme.onSurfaceVariant,
                            )
                        }
                    }
                    Column(
                        horizontalAlignment = Alignment.End,
                        verticalArrangement = Arrangement.spacedBy(2.dp),
                    ) {
                        Text(
                            text = device.status.replaceFirstChar { it.uppercase() },
                            fontSize = 11.sp,
                            fontWeight = FontWeight.Medium,
                            color = statusColor,
                        )
                        Icon(
                            imageVector = if (expanded) Icons.Filled.ExpandLess else Icons.Filled.ExpandMore,
                            contentDescription = if (expanded) "Collapse" else "Expand",
                            modifier = Modifier.size(16.dp),
                            tint = MaterialTheme.colorScheme.onSurfaceVariant,
                        )
                    }
                }

                if (expanded) {
                    HorizontalDivider(
                        modifier = Modifier.padding(vertical = 10.dp),
                        color = MaterialTheme.colorScheme.surfaceVariant,
                    )
                    Column(verticalArrangement = Arrangement.spacedBy(6.dp)) {
                        DetailRow(label = "Device ID", value = device.deviceId, monospace = true)
                        if (!device.firmwareVersion.isNullOrBlank()) {
                            DetailRow(label = "Firmware", value = device.firmwareVersion!!)
                        }
                        if (!device.lastSeenAt.isNullOrBlank()) {
                            DetailRow(label = "Last seen", value = formatTimestamp(device.lastSeenAt!!))
                        }
                        if (!device.lastHeartbeatAt.isNullOrBlank()) {
                            DetailRow(label = "Last heartbeat", value = formatTimestamp(device.lastHeartbeatAt!!))
                        }
                        DetailRow(
                            label = "Active",
                            value = if (device.isActive) "Yes" else "No",
                            valueColor = if (device.isActive) AppColors.statusOnline else null,
                        )
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
            modifier = Modifier.weight(0.4f),
        )
        Text(
            text = value,
            fontSize = 12.sp,
            fontWeight = FontWeight.Medium,
            fontFamily = if (monospace) FontFamily.Monospace else FontFamily.Default,
            color = resolvedColor,
            modifier = Modifier.weight(0.6f),
        )
    }
}

@Composable
private fun EmptyDevicesState(modifier: Modifier = Modifier) {
    Column(
        modifier = modifier.padding(32.dp),
        horizontalAlignment = Alignment.CenterHorizontally,
        verticalArrangement = Arrangement.spacedBy(12.dp),
    ) {
        Icon(
            imageVector = Icons.Filled.DeviceHub,
            contentDescription = null,
            modifier = Modifier.size(48.dp),
            tint = MaterialTheme.colorScheme.onSurfaceVariant.copy(alpha = 0.5f),
        )
        Text(
            text = "No devices registered",
            fontWeight = FontWeight.SemiBold,
            color = MaterialTheme.colorScheme.onSurface,
        )
        Text(
            text = "Devices will appear here once they connect and register with the system.",
            fontSize = 13.sp,
            color = MaterialTheme.colorScheme.onSurfaceVariant,
            textAlign = TextAlign.Center,
        )
    }
}

private fun shortTimestamp(raw: String): String {
    return try {
        val noMillis = raw.substringBefore(".")
        val time = noMillis.substringAfter("T").trimEnd('Z')
        time.substring(0, minOf(5, time.length)) + " UTC"
    } catch (e: Exception) {
        raw
    }
}

private fun formatTimestamp(raw: String): String {
    return try {
        val noMillis = raw.substringBefore(".")
        noMillis.replace("T", " ").trimEnd('Z') + " UTC"
    } catch (e: Exception) {
        raw
    }
}
