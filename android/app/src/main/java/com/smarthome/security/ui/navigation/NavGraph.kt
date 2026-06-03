package com.smarthome.security.ui.navigation

import androidx.compose.runtime.Composable
import androidx.compose.runtime.remember
import androidx.compose.ui.platform.LocalContext
import androidx.lifecycle.viewmodel.compose.viewModel
import androidx.navigation.compose.NavHost
import androidx.navigation.compose.composable
import androidx.navigation.compose.rememberNavController
import com.smarthome.security.data.local.SessionManager
import com.smarthome.security.data.remote.RetrofitClient
import com.smarthome.security.data.repository.AuthRepository
import com.smarthome.security.data.repository.DashboardRepository
import com.smarthome.security.data.repository.DevicesRepository
import com.smarthome.security.data.repository.EventsRepository
import com.smarthome.security.data.repository.TelemetryRepository
import com.smarthome.security.ui.dashboard.DashboardScreen
import com.smarthome.security.ui.dashboard.DashboardViewModel
import com.smarthome.security.ui.dashboard.DashboardViewModelFactory
import com.smarthome.security.ui.devices.DevicesScreen
import com.smarthome.security.ui.devices.DevicesViewModel
import com.smarthome.security.ui.devices.DevicesViewModelFactory
import com.smarthome.security.ui.events.EventsScreen
import com.smarthome.security.ui.events.EventsViewModel
import com.smarthome.security.ui.events.EventsViewModelFactory
import com.smarthome.security.ui.login.LoginScreen
import com.smarthome.security.ui.login.LoginViewModel
import com.smarthome.security.ui.login.LoginViewModelFactory
import com.smarthome.security.ui.profile.ProfileScreen
import com.smarthome.security.ui.telemetry.TelemetryScreen
import com.smarthome.security.ui.telemetry.TelemetryViewModel
import com.smarthome.security.ui.telemetry.TelemetryViewModelFactory

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
    val context = LocalContext.current
    val sessionManager = remember { SessionManager(context) }
    val authRepository = remember { AuthRepository(RetrofitClient.api, sessionManager) }
    val dashboardRepository = remember { DashboardRepository(RetrofitClient.dashboardApi, sessionManager) }
    val devicesRepository = remember { DevicesRepository(RetrofitClient.devicesApi, sessionManager) }
    val eventsRepository = remember { EventsRepository(RetrofitClient.eventsApi, sessionManager) }
    val telemetryRepository = remember { TelemetryRepository(RetrofitClient.telemetryApi, sessionManager) }

    NavHost(
        navController = navController,
        startDestination = Routes.LOGIN,
    ) {
        composable(Routes.LOGIN) {
            val loginViewModel: LoginViewModel = viewModel(
                factory = LoginViewModelFactory(authRepository),
            )
            LoginScreen(
                viewModel = loginViewModel,
                onLoginSuccess = {
                    navController.navigate(Routes.DASHBOARD) {
                        popUpTo(Routes.LOGIN) { inclusive = true }
                    }
                },
            )
        }
        composable(Routes.DASHBOARD) {
            val dashboardViewModel: DashboardViewModel = viewModel(
                factory = DashboardViewModelFactory(dashboardRepository),
            )
            DashboardScreen(
                viewModel = dashboardViewModel,
                onNavigateToDevices = { navController.navigate(Routes.DEVICES) },
                onNavigateToEvents = { navController.navigate(Routes.EVENTS) },
                onNavigateToTelemetry = { navController.navigate(Routes.TELEMETRY) },
                onNavigateToProfile = { navController.navigate(Routes.PROFILE) },
            )
        }
        composable(Routes.DEVICES) {
            val devicesViewModel: DevicesViewModel = viewModel(
                factory = DevicesViewModelFactory(devicesRepository),
            )
            DevicesScreen(
                viewModel = devicesViewModel,
                onNavigateBack = { navController.popBackStack() },
            )
        }
        composable(Routes.EVENTS) {
            val eventsViewModel: EventsViewModel = viewModel(
                factory = EventsViewModelFactory(eventsRepository),
            )
            EventsScreen(
                viewModel = eventsViewModel,
                onNavigateBack = { navController.popBackStack() },
            )
        }
        composable(Routes.TELEMETRY) {
            val telemetryViewModel: TelemetryViewModel = viewModel(
                factory = TelemetryViewModelFactory(telemetryRepository),
            )
            TelemetryScreen(
                viewModel = telemetryViewModel,
                onNavigateBack = { navController.popBackStack() },
            )
        }
        composable(Routes.PROFILE) {
            ProfileScreen(
                email = sessionManager.getEmail() ?: "",
                fullName = sessionManager.getFullName() ?: "",
                role = sessionManager.getRole() ?: "",
                onNavigateBack = { navController.popBackStack() },
                onLogout = {
                    authRepository.logout()
                    navController.navigate(Routes.LOGIN) {
                        popUpTo(0) { inclusive = true }
                    }
                },
            )
        }
    }
}
