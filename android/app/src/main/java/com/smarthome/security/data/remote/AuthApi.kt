package com.smarthome.security.data.remote

import com.smarthome.security.data.model.LoginRequest
import com.smarthome.security.data.model.LoginResponse
import com.smarthome.security.data.model.RegisterRequest
import retrofit2.Response
import retrofit2.http.Body
import retrofit2.http.POST

interface AuthApi {
    @POST("api/auth/login")
    suspend fun login(@Body request: LoginRequest): Response<LoginResponse>

    @POST("api/auth/register")
    suspend fun register(@Body request: RegisterRequest): Response<LoginResponse>
}
