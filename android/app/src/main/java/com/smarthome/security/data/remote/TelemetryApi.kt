package com.smarthome.security.data.remote

import com.smarthome.security.data.model.TelemetryResponse
import retrofit2.Response
import retrofit2.http.GET
import retrofit2.http.Header

interface TelemetryApi {
    @GET("api/telemetry/latest")
    suspend fun getLatestTelemetry(
        @Header("Authorization") token: String,
    ): Response<TelemetryResponse>
}
