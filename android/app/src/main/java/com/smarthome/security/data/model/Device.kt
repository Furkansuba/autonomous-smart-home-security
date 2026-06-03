package com.smarthome.security.data.model

import com.google.gson.annotations.SerializedName

data class Device(
    @SerializedName("device_id") val deviceId: String,
    val name: String,
    val status: String,
    @SerializedName("firmware_version") val firmwareVersion: String?,
    @SerializedName("last_seen_at") val lastSeenAt: String?,
    @SerializedName("last_heartbeat_at") val lastHeartbeatAt: String?,
    @SerializedName("location_label") val locationLabel: String?,
    @SerializedName("is_active") val isActive: Boolean,
)

data class DevicesResponse(
    val count: Int,
    val total: Int,
    val page: Int,
    val devices: List<Device>,
)
