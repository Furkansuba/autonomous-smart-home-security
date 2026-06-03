package com.smarthome.security.ui.navigation

import androidx.compose.runtime.Composable
import androidx.navigation.compose.NavHost
import androidx.navigation.compose.composable
import androidx.navigation.compose.rememberNavController
import com.smarthome.security.ui.dashboard.DashboardScreen
import com.smarthome.security.ui.devices.DevicesScreen
import com.smarthome.security.ui.events.EventsScreen
import com.smarthome.security.ui.login.LoginScreen
import com.smarthome.security.ui.profile.ProfileScreen
import com.smarthome.security.ui.telemetry.TelemetryScreen

object Routes {
    const val LOGIN = "login"
    const val DASHBOARD = "dashboard"
    const val DEVICES = "devices"
    const val EVENTS = "events"
    const val TELEMETRY = "telemetry"
    const val PROFILE = "profile"
}

@Composable
fun NavGraph() {
    val navController = rememberNavController()

    NavHost(
        navController = navController,
        startDestination = Routes.LOGIN,
    ) {
        composable(Routes.LOGIN) {
            LoginScreen(
                onLoginSuccess = {
                    navController.navigate(Routes.DASHBOARD) {
                        popUpTo(Routes.LOGIN) { inclusive = true }
                    }
                },
            )
        }
        composable(Routes.DASHBOARD) {
            DashboardScreen(
                onNavigateToDevices = { navController.navigate(Routes.DEVICES) },
                onNavigateToEvents = { navController.navigate(Routes.EVENTS) },
                onNavigateToTelemetry = { navController.navigate(Routes.TELEMETRY) },
                onNavigateToProfile = { navController.navigate(Routes.PROFILE) },
            )
        }
        composable(Routes.DEVICES) {
            DevicesScreen(onNavigateBack = { navController.popBackStack() })
        }
        composable(Routes.EVENTS) {
            EventsScreen(onNavigateBack = { navController.popBackStack() })
        }
        composable(Routes.TELEMETRY) {
            TelemetryScreen(onNavigateBack = { navController.popBackStack() })
        }
        composable(Routes.PROFILE) {
            ProfileScreen(
                onLogout = {
                    navController.navigate(Routes.LOGIN) {
                        popUpTo(0) { inclusive = true }
                    }
                },
            )
        }
    }
}
