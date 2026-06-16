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
    // Security ARM/DISARM mode (intrusion monitoring only). null if not reported.
    @SerializedName("security_armed") val securityArmed: Boolean? = null,
    // Device-reported / last-commanded door lock state (not sensor-verified). null = unknown.
    @SerializedName("door_locked") val doorLocked: Boolean? = null,
)

data class DevicesResponse(
    val count: Int,
    val total: Int,
    val page: Int,
    val devices: List<Device>,
)
