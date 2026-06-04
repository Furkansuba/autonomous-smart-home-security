package com.smarthome.security.ui.overrides

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
import androidx.compose.material.icons.automirrored.filled.ArrowBack
import androidx.compose.material.icons.filled.ExpandLess
import androidx.compose.material.icons.filled.ExpandMore
import androidx.compose.material.icons.filled.HistoryToggleOff
import androidx.compose.material.icons.filled.NotificationsOff
import androidx.compose.material.icons.filled.Tune
import androidx.compose.material.icons.filled.Warning
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Scaffold
import androidx.compose.material3.SnackbarHost
import androidx.compose.material3.SnackbarHostState
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.material3.TopAppBar
import androidx.compose.material3.pulltorefresh.PullToRefreshBox
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
import com.smarthome.security.data.model.OverrideRequest
import com.smarthome.security.ui.theme.AppColors

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun OverridesScreen(
    viewModel: OverridesViewModel,
    userRole: String,
    adminEmail: String,
    onNavigateBack: () -> Unit,
    onSessionExpired: () -> Unit,
) {
    val uiState by viewModel.uiState.collectAsStateWithLifecycle()
    val silenceState by viewModel.silenceState.collectAsStateWithLifecycle()
    val snackbarHostState = remember { SnackbarHostState() }
    var showConfirmDialog by remember { mutableStateOf(false) }

    LaunchedEffect(silenceState) {
        when (val s = silenceState) {
            is SilenceAlarmState.Success -> {
                snackbarHostState.showSnackbar("Silence command sent.")
                viewModel.resetSilenceState()
            }
            is SilenceAlarmState.Error -> {
                snackbarHostState.showSnackbar(s.message)
                viewModel.resetSilenceState()
            }
            is SilenceAlarmState.SessionExpired -> onSessionExpired()
            else -> Unit
        }
    }

    if (showConfirmDialog) {
        AlertDialog(
            onDismissRequest = { showConfirmDialog = false },
            title = { Text("Silence Alarm") },
            text = {
                Text("Send a buzzer_off command to esp32_home_01. This action will be logged in override history.")
            },
            confirmButton = {
                TextButton(
                    onClick = {
                        showConfirmDialog = false
                        viewModel.silenceAlarm(adminEmail)
                    },
                ) {
                    Text("Confirm")
                }
            },
            dismissButton = {
                TextButton(onClick = { showConfirmDialog = false }) {
                    Text("Cancel")
                }
            },
        )
    }

    Scaffold(
        snackbarHost = { SnackbarHost(snackbarHostState) },
        topBar = {
            TopAppBar(
                title = {
                    Column {
                        Text("Override History")
                        Text(
                            text = "Manual command log",
                            style = MaterialTheme.typography.bodySmall,
                            color = MaterialTheme.colorScheme.onSurfaceVariant,
                        )
                    }
                },
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
        PullToRefreshBox(
            isRefreshing = uiState is OverridesUiState.Loading,
            onRefresh = { viewModel.loadOverrides() },
            modifier = Modifier
                .fillMaxSize()
                .padding(padding),
        ) {
            when (val state = uiState) {
                is OverridesUiState.Loading -> {
                    CircularProgressIndicator(modifier = Modifier.align(Alignment.Center))
                }
                is OverridesUiState.Error -> {
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
                            text = "Could not load override history",
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
                        Button(onClick = { viewModel.loadOverrides() }) {
                            Text("Retry")
                        }
                    }
                }
                is OverridesUiState.SessionExpired -> {
                    LaunchedEffect(Unit) { onSessionExpired() }
                }
                is OverridesUiState.Success -> {
                    Column(modifier = Modifier.fillMaxSize()) {
                        if (userRole == "admin") {
                            SilenceAlarmActionCard(
                                silenceState = silenceState,
                                adminEmail = adminEmail,
                                onSilenceClick = { showConfirmDialog = true },
                                modifier = Modifier
                                    .padding(horizontal = 16.dp)
                                    .padding(top = 8.dp),
                            )
                        }
                        if (state.overrides.isEmpty()) {
                            Box(
                                modifier = Modifier
                                    .weight(1f)
                                    .fillMaxWidth(),
                                contentAlignment = Alignment.Center,
                            ) {
                                EmptyOverridesState()
                            }
                        } else {
                            OverridesFeed(
                                overrides = state.overrides,
                                modifier = Modifier.weight(1f),
                            )
                        }
                    }
                }
            }
        }
    }
}

@Composable
private fun SilenceAlarmActionCard(
    silenceState: SilenceAlarmState,
    adminEmail: String,
    onSilenceClick: () -> Unit,
    modifier: Modifier = Modifier,
) {
    val isSending = silenceState is SilenceAlarmState.Sending
    val emailMissing = adminEmail.isBlank()
    Card(
        modifier = modifier.fillMaxWidth(),
        colors = CardDefaults.cardColors(
            containerColor = MaterialTheme.colorScheme.errorContainer.copy(alpha = 0.30f),
        ),
        shape = RoundedCornerShape(14.dp),
    ) {
        Column(
            modifier = Modifier.padding(16.dp),
            verticalArrangement = Arrangement.spacedBy(10.dp),
        ) {
            Text(
                text = "Admin Action",
                style = MaterialTheme.typography.labelMedium,
                fontWeight = FontWeight.SemiBold,
                color = MaterialTheme.colorScheme.onSurfaceVariant,
            )
            Button(
                onClick = onSilenceClick,
                enabled = !isSending && !emailMissing,
                modifier = Modifier.fillMaxWidth(),
                colors = ButtonDefaults.buttonColors(
                    containerColor = MaterialTheme.colorScheme.error,
                    contentColor = MaterialTheme.colorScheme.onError,
                ),
                shape = RoundedCornerShape(10.dp),
            ) {
                if (isSending) {
                    CircularProgressIndicator(
                        modifier = Modifier.size(16.dp),
                        color = MaterialTheme.colorScheme.onError,
                        strokeWidth = 2.dp,
                    )
                    Spacer(modifier = Modifier.width(8.dp))
                    Text("Sending...")
                } else {
                    Icon(
                        imageVector = Icons.Filled.NotificationsOff,
                        contentDescription = null,
                        modifier = Modifier.size(18.dp),
                    )
                    Spacer(modifier = Modifier.width(8.dp))
                    Text(
                        text = "Silence Alarm / Buzzer Off",
                        fontWeight = FontWeight.SemiBold,
                    )
                }
            }
            if (emailMissing) {
                Text(
                    text = "Admin email missing. Please sign in again.",
                    style = MaterialTheme.typography.labelSmall,
                    color = MaterialTheme.colorScheme.error,
                )
            }
        }
    }
}

@Composable
private fun OverridesFeed(overrides: List<OverrideRequest>, modifier: Modifier = Modifier) {
    val requestedCount = overrides.count { it.status == "requested" }
    val executedCount = overrides.count { it.status == "executed" }
    val failedCount = overrides.count { it.status == "failed" }
    val blockedCount = overrides.count { it.status == "blocked" }

    LazyColumn(
        modifier = modifier
            .fillMaxSize()
            .padding(horizontal = 16.dp),
        verticalArrangement = Arrangement.spacedBy(8.dp),
        contentPadding = PaddingValues(vertical = 12.dp),
    ) {
        item {
            OverridesSummaryHeader(
                total = overrides.size,
                requestedCount = requestedCount,
                executedCount = executedCount,
                failedCount = failedCount,
                blockedCount = blockedCount,
            )
        }
        items(overrides, key = { it.overrideId }) { override ->
            OverrideCard(override = override)
        }
    }
}

@Composable
private fun OverridesSummaryHeader(
    total: Int,
    requestedCount: Int,
    executedCount: Int,
    failedCount: Int,
    blockedCount: Int,
) {
    val errorColor = MaterialTheme.colorScheme.error
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
                text = "$total ${if (total == 1) "Override" else "Overrides"}",
                fontWeight = FontWeight.Bold,
                fontSize = 18.sp,
                color = MaterialTheme.colorScheme.onSurface,
            )
            Row(horizontalArrangement = Arrangement.spacedBy(16.dp)) {
                if (requestedCount > 0) {
                    StatusCountBadge(count = requestedCount, label = "Pending", color = AppColors.statusDegraded)
                }
                if (executedCount > 0) {
                    StatusCountBadge(count = executedCount, label = "Executed", color = AppColors.statusOnline)
                }
                if (failedCount > 0) {
                    StatusCountBadge(count = failedCount, label = "Failed", color = errorColor)
                }
                if (blockedCount > 0) {
                    StatusCountBadge(count = blockedCount, label = "Blocked", color = AppColors.statusOffline)
                }
            }
            Row(
                modifier = Modifier
                    .fillMaxWidth()
                    .height(4.dp)
                    .clip(RoundedCornerShape(2.dp)),
            ) {
                if (executedCount > 0) {
                    Box(
                        modifier = Modifier
                            .weight(executedCount.toFloat())
                            .fillMaxHeight()
                            .background(AppColors.statusOnline),
                    )
                }
                if (requestedCount > 0) {
                    Box(
                        modifier = Modifier
                            .weight(requestedCount.toFloat())
                            .fillMaxHeight()
                            .background(AppColors.statusDegraded),
                    )
                }
                if (failedCount > 0) {
                    Box(
                        modifier = Modifier
                            .weight(failedCount.toFloat())
                            .fillMaxHeight()
                            .background(errorColor),
                    )
                }
                if (blockedCount > 0) {
                    Box(
                        modifier = Modifier
                            .weight(blockedCount.toFloat())
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
private fun OverrideCard(override: OverrideRequest) {
    var expanded by remember { mutableStateOf(false) }
    val accentColor = overrideStatusColor(override.status)
    val resultColor = override.result?.let { overrideStatusColor(it) }

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
                        imageVector = Icons.Filled.Tune,
                        contentDescription = null,
                        modifier = Modifier.size(20.dp),
                        tint = accentColor,
                    )
                    Text(
                        text = formatAction(override.action),
                        fontWeight = FontWeight.SemiBold,
                        fontSize = 15.sp,
                        color = MaterialTheme.colorScheme.onSurface,
                        modifier = Modifier.weight(1f),
                    )
                    Text(
                        text = statusLabel(override.status),
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

                Spacer(modifier = Modifier.height(3.dp))
                Text(
                    text = "${override.actuatorId}  ·  ${formatTimestampShort(override.requestedAt)}",
                    fontSize = 12.sp,
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                )

                if (expanded) {
                    HorizontalDivider(
                        modifier = Modifier.padding(vertical = 10.dp),
                        color = MaterialTheme.colorScheme.surfaceVariant,
                    )
                    Column(verticalArrangement = Arrangement.spacedBy(6.dp)) {
                        DetailRow(label = "Device", value = override.deviceId, monospace = true)
                        DetailRow(label = "Actuator", value = override.actuatorId, monospace = true)
                        DetailRow(label = "Requested by", value = override.requestedBy, monospace = true)
                        if (!override.reason.isNullOrBlank()) {
                            DetailRow(label = "Reason", value = override.reason!!)
                        }
                        if (!override.result.isNullOrBlank()) {
                            DetailRow(
                                label = "Result",
                                value = override.result!!.replaceFirstChar { it.uppercase() },
                                valueColor = resultColor,
                            )
                        }
                        if (!override.blockedReason.isNullOrBlank()) {
                            DetailRow(
                                label = "Blocked reason",
                                value = override.blockedReason!!,
                                valueColor = AppColors.statusOffline,
                            )
                        }
                        if (!override.resultAt.isNullOrBlank()) {
                            DetailRow(label = "Result at", value = formatTimestamp(override.resultAt!!))
                        }
                        DetailRow(label = "Override ID", value = override.overrideId, monospace = true)
                        DetailRow(label = "Requested at", value = formatTimestamp(override.requestedAt))
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
private fun EmptyOverridesState(modifier: Modifier = Modifier) {
    Column(
        modifier = modifier.padding(32.dp),
        horizontalAlignment = Alignment.CenterHorizontally,
        verticalArrangement = Arrangement.spacedBy(12.dp),
    ) {
        Icon(
            imageVector = Icons.Filled.HistoryToggleOff,
            contentDescription = null,
            modifier = Modifier.size(48.dp),
            tint = MaterialTheme.colorScheme.onSurfaceVariant.copy(alpha = 0.5f),
        )
        Text(
            text = "No override history",
            fontWeight = FontWeight.SemiBold,
            color = MaterialTheme.colorScheme.onSurface,
        )
        Text(
            text = "Manual commands issued by administrators will appear here.",
            fontSize = 13.sp,
            color = MaterialTheme.colorScheme.onSurfaceVariant,
            textAlign = TextAlign.Center,
        )
    }
}

@Composable
private fun overrideStatusColor(status: String): Color {
    val errorColor = MaterialTheme.colorScheme.error
    return when (status) {
        "executed" -> AppColors.statusOnline
        "failed" -> errorColor
        "blocked" -> AppColors.statusOffline
        else -> AppColors.statusDegraded
    }
}

private fun statusLabel(status: String): String = when (status) {
    "requested" -> "Pending"
    "executed" -> "Executed"
    "failed" -> "Failed"
    "blocked" -> "Blocked"
    else -> status.replaceFirstChar { it.uppercase() }
}

private fun formatAction(action: String): String =
    action.split("_").joinToString(" ") { it.replaceFirstChar { c -> c.uppercase() } }

private fun formatTimestamp(raw: String): String =
    try {
        raw.substringBefore(".").replace("T", " ").trimEnd('Z') + " UTC"
    } catch (e: Exception) {
        raw
    }

private fun formatTimestampShort(raw: String): String =
    try {
        "${raw.substringAfter("T").substringBefore(".").substring(0, 5)} UTC"
    } catch (e: Exception) {
        raw
    }
