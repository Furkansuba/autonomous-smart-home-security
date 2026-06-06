package com.smarthome.security.data.model

import com.google.gson.annotations.SerializedName

data class RegisterRequest(
    @SerializedName("full_name") val fullName: String,
    val email: String,
    val password: String,
    @SerializedName("admin_key") val adminKey: String?,
    @SerializedName("security_question") val securityQuestion: String,
    @SerializedName("security_answer") val securityAnswer: String,
)
