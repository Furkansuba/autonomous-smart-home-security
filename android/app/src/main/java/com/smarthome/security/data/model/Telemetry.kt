package com.smarthome.security.data.model

import com.google.gson.annotations.SerializedName

data class TelemetrySummary(
    @SerializedName("device_id") val deviceId: String,
    @SerializedName("room_id") val roomId: String?,
    @SerializedName("temperature_c") val temperatureC: Double?,
    @SerializedName("humidity_percent") val humidityPercent: Double?,
    @SerializedName("gas_raw") val gasRaw: Int?,
    @SerializedName("co_raw") val coRaw: Int?,
    @SerializedName("flame_detected") val flameDetected: Boolean?,
    @SerializedName("motion_detected") val motionDetected: Boolean?,
    @SerializedName("reed_open") val reedOpen: Boolean?,
    @SerializedName("occurred_at") val occurredAt: String?,
    @SerializedName("createdAt") val createdAt: String?,
)

data class TelemetryListResponse(
    val telemetry: List<TelemetrySummary>?,
)

// Backend-derived recent hazard (read-only event latch). Not a raw sensor value.
data class ActiveHazard(
    @SerializedName("device_id") val deviceId: String,
    @SerializedName("room_id") val roomId: String?,
    @SerializedName("event_type") val eventType: String,
    val severity: String?,
    val message: String?,
    @SerializedName("event_id") val eventId: String,
    @SerializedName("occurred_at") val occurredAt: String?,
    @SerializedName("ttl_seconds") val ttlSeconds: Int?,
    @SerializedName("expires_at") val expiresAt: String?,
    val source: String?,
)

data class HazardsResponse(
    val hazards: List<ActiveHazard>?,
)
