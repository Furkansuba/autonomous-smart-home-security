package com.smarthome.security.data.model

import com.google.gson.annotations.SerializedName

data class UserListItem(
    @SerializedName("user_id") val userId: String,
    @SerializedName("full_name") val fullName: String,
    val email: String,
    val role: String,
    @SerializedName("is_active") val isActive: Boolean,
    val createdAt: String,
    val updatedAt: String,
)
