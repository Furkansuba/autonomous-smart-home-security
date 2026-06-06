package com.smarthome.security.data.model

import com.google.gson.annotations.SerializedName

data class RecoveryResetRequest(
    val email: String,
    @SerializedName("security_answer") val securityAnswer: String,
    @SerializedName("new_password") val newPassword: String,
)
