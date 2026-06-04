package com.smarthome.security.data.model

import com.google.gson.annotations.SerializedName

data class OverrideRequest(
    @SerializedName("override_id") val overrideId: String,
    @SerializedName("device_id") val deviceId: String,
    @SerializedName("requested_by") val requestedBy: String,
    @SerializedName("actuator_id") val actuatorId: String,
    val action: String,
    val reason: String?,
    val status: String,
    val result: String?,
    @SerializedName("blocked_reason") val blockedReason: String?,
    @SerializedName("requested_at") val requestedAt: String,
    @SerializedName("result_at") val resultAt: String?,
)

data class OverridesResponse(
    val count: Int,
    val total: Int,
    val page: Int,
    val limit: Int,
    @SerializedName("total_pages") val totalPages: Int,
    val overrides: List<OverrideRequest>,
)
