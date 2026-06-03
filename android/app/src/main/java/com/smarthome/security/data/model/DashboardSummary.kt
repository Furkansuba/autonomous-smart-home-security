package com.smarthome.security.data.model

import com.google.gson.annotations.SerializedName

data class DashboardSummary(
    @SerializedName("generated_at") val generatedAt: String,
    val devices: DashboardDevices,
    val events: DashboardEvents,
    val overrides: DashboardOverrides,
)

data class DashboardDevices(
    @SerializedName("total_active") val totalActive: Int,
    @SerializedName("status_counts") val statusCounts: DeviceStatusCounts,
)

data class DeviceStatusCounts(
    val online: Int,
    val degraded: Int,
    val offline: Int,
)

data class DashboardEvents(
    @SerializedName("recent_critical_24h_count") val recentCritical24hCount: Int,
)

data class DashboardOverrides(
    @SerializedName("pending_count") val pendingCount: Int,
)
