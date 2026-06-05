package com.smarthome.security

import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.content.Context
import android.content.Intent
import android.os.Build
import androidx.core.app.NotificationCompat
import com.google.firebase.messaging.FirebaseMessagingService
import com.google.firebase.messaging.RemoteMessage
import com.smarthome.security.data.local.SessionManager
import com.smarthome.security.data.model.FcmTokenRequest
import com.smarthome.security.data.remote.RetrofitClient
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch

class SmartHomeMessagingService : FirebaseMessagingService() {

    override fun onNewToken(token: String) {
        val sessionManager = SessionManager(this)
        if (!sessionManager.hasValidSession()) return
        val jwtToken = sessionManager.getToken() ?: return
        CoroutineScope(Dispatchers.IO).launch {
            try {
                RetrofitClient.usersApi.registerFcmToken(
                    "Bearer $jwtToken",
                    FcmTokenRequest(token),
                )
            } catch (_: Exception) {
                // Fail silently — token will be re-sent on next login.
            }
        }
    }

    override fun onMessageReceived(remoteMessage: RemoteMessage) {
        val title = remoteMessage.notification?.title
            ?: remoteMessage.data["title"]
            ?: "Smart Home Alert"
        val body = remoteMessage.notification?.body
            ?: remoteMessage.data["body"]
            ?: ""
        showNotification(title, body)
    }

    private fun showNotification(title: String, body: String) {
        val channelId = "critical_alerts"
        val notificationManager =
            getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager

        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            val channel = NotificationChannel(
                channelId,
                "Critical Alerts",
                NotificationManager.IMPORTANCE_HIGH,
            ).apply {
                description = "Fire, gas, CO, and intrusion alerts"
                enableVibration(true)
            }
            notificationManager.createNotificationChannel(channel)
        }

        val intent = Intent(this, MainActivity::class.java).apply {
            flags = Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TOP
        }
        val pendingIntent = PendingIntent.getActivity(
            this,
            0,
            intent,
            PendingIntent.FLAG_ONE_SHOT or PendingIntent.FLAG_IMMUTABLE,
        )

        val notification = NotificationCompat.Builder(this, channelId)
            .setSmallIcon(android.R.drawable.ic_dialog_alert)
            .setContentTitle(title)
            .setContentText(body)
            .setPriority(NotificationCompat.PRIORITY_HIGH)
            .setAutoCancel(true)
            .setContentIntent(pendingIntent)
            .build()

        notificationManager.notify(System.currentTimeMillis().toInt(), notification)
    }
}
