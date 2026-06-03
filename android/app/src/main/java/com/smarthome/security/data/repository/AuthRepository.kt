package com.smarthome.security.data.repository

import com.google.gson.JsonParser
import com.smarthome.security.data.local.SessionManager
import com.smarthome.security.data.model.LoginRequest
import com.smarthome.security.data.model.LoginResponse
import com.smarthome.security.data.remote.AuthApi

class AuthRepository(
    private val api: AuthApi,
    private val sessionManager: SessionManager,
) {
    suspend fun login(email: String, password: String): Result<LoginResponse> {
        return try {
            val response = api.login(LoginRequest(email, password))
            if (response.isSuccessful) {
                val body = response.body()!!
                sessionManager.saveSession(
                    token = body.token,
                    email = body.user.email,
                    fullName = body.user.fullName,
                    role = body.user.role,
                )
                Result.success(body)
            } else {
                val message = parseErrorMessage(response.errorBody()?.string())
                    ?: "Login failed (${response.code()})"
                Result.failure(Exception(message))
            }
        } catch (e: Exception) {
            Result.failure(Exception("Cannot reach server. Check your connection."))
        }
    }

    fun logout() {
        sessionManager.clearSession()
    }

    private fun parseErrorMessage(errorBody: String?): String? {
        if (errorBody == null) return null
        return try {
            JsonParser.parseString(errorBody).asJsonObject.get("error")?.asString
        } catch (e: Exception) {
            null
        }
    }
}
