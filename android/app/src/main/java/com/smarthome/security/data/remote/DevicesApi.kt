package com.smarthome.security.data.remote

import com.smarthome.security.data.model.DevicesResponse
import retrofit2.Response
import retrofit2.http.GET
import retrofit2.http.Header

interface DevicesApi {
    @GET("api/devices")
    suspend fun getDevices(
        @Header("Authorization") token: String,
    ): Response<DevicesResponse>
}
