package com.smarthome.security.data.model

import com.google.gson.annotations.SerializedName

data class RegisterRequest(
    @SerializedName("full_name") val fullName: String,
    val email: String,
    val password: String,
    @SerializedName("admin_key") val adminKey: String?,
)
