package com.smarthome.security.data.remote

import com.smarthome.security.data.model.DashboardSummary
import retrofit2.Response
import retrofit2.http.GET
import retrofit2.http.Header

interface DashboardApi {
    @GET("api/dashboard/summary")
    suspend fun getSummary(
        @Header("Authorization") token: String,
    ): Response<DashboardSummary>
}
