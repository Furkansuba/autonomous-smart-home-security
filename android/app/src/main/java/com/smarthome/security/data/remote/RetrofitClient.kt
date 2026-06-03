package com.smarthome.security.data.remote

import com.smarthome.security.BuildConfig
import okhttp3.OkHttpClient
import retrofit2.Retrofit
import retrofit2.converter.gson.GsonConverterFactory
import java.util.concurrent.TimeUnit

object RetrofitClient {
    private val okHttpClient = OkHttpClient.Builder()
        .connectTimeout(15, TimeUnit.SECONDS)
        .readTimeout(15, TimeUnit.SECONDS)
        .build()

    private val retrofit = Retrofit.Builder()
        .baseUrl(BuildConfig.BASE_URL)
        .client(okHttpClient)
        .addConverterFactory(GsonConverterFactory.create())
        .build()

    val api: AuthApi = retrofit.create(AuthApi::class.java)
    val dashboardApi: DashboardApi = retrofit.create(DashboardApi::class.java)
    val devicesApi: DevicesApi = retrofit.create(DevicesApi::class.java)
    val eventsApi: EventsApi = retrofit.create(EventsApi::class.java)
}
