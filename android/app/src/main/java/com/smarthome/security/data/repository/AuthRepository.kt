package com.smarthome.security.data.repository

import com.google.firebase.messaging.FirebaseMessaging
import com.google.gson.JsonParser
import com.smarthome.security.data.local.SessionManager
import com.smarthome.security.data.model.FcmTokenRequest
import com.smarthome.security.data.model.LoginRequest
import com.smarthome.security.data.model.LoginResponse
import com.smarthome.security.data.model.RecoveryQuestionRequest
import com.smarthome.security.data.model.RecoveryQuestionResponse
import com.smarthome.security.data.model.RecoveryResetRequest
import com.smarthome.security.data.model.RecoveryResetResponse
import com.smarthome.security.data.model.RegisterRequest
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

    suspend fun register(
        fullName: String,
        email: String,
        password: String,
        adminKey: String,
        securityQuestion: String,
        securityAnswer: String,
    ): Result<LoginResponse> {
        return try {
            val request = RegisterRequest(
                fullName = fullName,
                email = email,
                password = password,
                adminKey = adminKey.ifBlank { null },
                securityQuestion = securityQuestion,
                securityAnswer = securityAnswer,
            )
            val response = api.register(request)
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
                    ?: "Registration failed (${response.code()})"
                Result.failure(Exception(message))
            }
        } catch (e: Exception) {
            Result.failure(Exception("Cannot reach server. Check your connection."))
        }
    }

    suspend fun getRecoveryQuestion(email: String): Result<RecoveryQuestionResponse> {
        return try {
            val response = api.getRecoveryQuestion(RecoveryQuestionRequest(email))
            if (response.isSuccessful) {
                Result.success(response.body()!!)
            } else {
                val message = parseErrorMessage(response.errorBody()?.string())
                    ?: "Failed to look up recovery question (${response.code()})"
                Result.failure(Exception(message))
            }
        } catch (e: Exception) {
            Result.failure(Exception("Cannot reach server. Check your connection."))
        }
    }

    suspend fun resetPassword(
        email: String,
        answer: String,
        newPassword: String,
    ): Result<RecoveryResetResponse> {
        return try {
            val request = RecoveryResetRequest(
                email = email,
                securityAnswer = answer,
                newPassword = newPassword,
            )
            val response = api.resetPassword(request)
            if (response.isSuccessful) {
                Result.success(response.body()!!)
            } else {
                val message = parseErrorMessage(response.errorBody()?.string())
                    ?: "Password reset failed (${response.code()})"
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
            val json = JsonParser.parseString(errorBody).asJsonObject
            // Prefer the first Zod issue message (field-level detail) over the generic top-level error
            val issues = json.getAsJsonArray("issues")
            if (issues != null && issues.size() > 0) {
                issues[0].asJsonObject.get("message")?.asString
            } else {
                json.get("error")?.asString
            }
        } catch (e: Exception) {
            null
        }
    }
}
