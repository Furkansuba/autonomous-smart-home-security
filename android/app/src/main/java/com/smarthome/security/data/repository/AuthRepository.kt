package com.smarthome.security.data.repository

import com.google.firebase.messaging.FirebaseMessaging
import com.google.gson.JsonParser
import com.smarthome.security.data.local.SessionManager
import com.smarthome.security.data.model.FcmTokenRequest
import com.smarthome.security.data.model.LoginRequest
import com.smarthome.security.data.model.LoginResponse
import com.smarthome.security.data.remote.AuthApi
import com.smarthome.security.data.remote.UsersApi
import kotlin.coroutines.resume
import kotlinx.coroutines.suspendCancellableCoroutine

class AuthRepository(
    private val api: AuthApi,
    private val sessionManager: SessionManager,
    private val usersApi: UsersApi,
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
                registerFcmTokenSilently(body.token)
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

    fun hasStoredSession(): Boolean = sessionManager.hasValidSession()

    fun logout() {
        sessionManager.clearSession()
    }

    private suspend fun getFcmToken(): String? = suspendCancellableCoroutine { cont ->
        FirebaseMessaging.getInstance().token
            .addOnSuccessListener { token -> cont.resume(token) }
            .addOnFailureListener { cont.resume(null) }
    }

    private suspend fun registerFcmTokenSilently(jwtToken: String) {
        try {
            val token = getFcmToken() ?: return
            usersApi.registerFcmToken("Bearer $jwtToken", FcmTokenRequest(token))
        } catch (_: Exception) {
            // Fail silently — does not affect login success. Token will retry on next login.
        }
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
