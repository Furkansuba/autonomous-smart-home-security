package com.smarthome.security.data.model

import com.google.gson.annotations.SerializedName

data class CreateOverrideRequest(
    @SerializedName("device_id") val deviceId: String,
    @SerializedName("requested_by") val requestedBy: String,
    @SerializedName("actuator_id") val actuatorId: String,
    val action: String,
    val reason: String? = null,
)

data class CreateOverrideResponse(
    val created: Boolean,
    val override: OverrideRequest,
)
