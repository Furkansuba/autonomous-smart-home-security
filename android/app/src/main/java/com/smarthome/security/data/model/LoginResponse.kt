package com.smarthome.security.data.model

import com.google.gson.annotations.SerializedName

data class LoginResponse(
    val authenticated: Boolean,
    val token: String,
    @SerializedName("token_type") val tokenType: String,
    @SerializedName("expires_in") val expiresIn: String,
    val user: UserInfo,
)

data class UserInfo(
    @SerializedName("user_id") val userId: String,
    val email: String,
    @SerializedName("full_name") val fullName: String,
    val role: String,
    @SerializedName("is_active") val isActive: Boolean,
    @SerializedName("last_login_at") val lastLoginAt: String?,
)
