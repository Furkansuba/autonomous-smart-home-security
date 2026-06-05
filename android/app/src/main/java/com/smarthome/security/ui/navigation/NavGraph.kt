package com.smarthome.security.ui.navigation

import androidx.compose.foundation.layout.padding
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.DeviceHub
import androidx.compose.material.icons.filled.NotificationsActive
import androidx.compose.material.icons.filled.Person
import androidx.compose.material.icons.filled.Sensors
import androidx.compose.material.icons.filled.Shield
import androidx.compose.material3.Icon
import androidx.compose.material3.NavigationBar
import androidx.compose.material3.NavigationBarItem
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.remember
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.platform.LocalContext
import androidx.lifecycle.viewmodel.compose.viewModel
import androidx.navigation.compose.NavHost
import androidx.navigation.compose.composable
import androidx.navigation.compose.currentBackStackEntryAsState
import androidx.navigation.compose.rememberNavController
import com.smarthome.security.data.local.SessionManager
import com.smarthome.security.data.remote.RetrofitClient
import com.smarthome.security.data.repository.AuthRepository
import com.smarthome.security.data.repository.DashboardRepository
import com.smarthome.security.data.repository.DevicesRepository
import com.smarthome.security.data.repository.EventsRepository
import com.smarthome.security.data.repository.OverridesRepository
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
import com.smarthome.security.ui.overrides.OverridesScreen
import com.smarthome.security.ui.overrides.OverridesViewModel
import com.smarthome.security.ui.overrides.OverridesViewModelFactory
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
    const val OVERRIDES = "overrides"
}

private data class BottomNavItem(
    val label: String,
    val icon: ImageVector,
    val route: String,
)

private val bottomNavItems = listOf(
    BottomNavItem("Home",    Icons.Filled.Shield,              Routes.DASHBOARD),
    BottomNavItem("Devices", Icons.Filled.DeviceHub,           Routes.DEVICES),
    BottomNavItem("Alerts",  Icons.Filled.NotificationsActive, Routes.EVENTS),
    BottomNavItem("Sensors", Icons.Filled.Sensors,             Routes.TELEMETRY),
    BottomNavItem("Profile", Icons.Filled.Person,              Routes.PROFILE),
)

private val bottomNavRoutes = setOf(
    Routes.DASHBOARD,
    Routes.DEVICES,
    Routes.EVENTS,
    Routes.TELEMETRY,
    Routes.PROFILE,
)

@Composable
fun NavGraph() {
    val navController = rememberNavController()
    val context = LocalContext.current
    val sessionManager = remember { SessionManager(context) }
    val authRepository = remember { AuthRepository(RetrofitClient.api, sessionManager, RetrofitClient.usersApi) }
    val dashboardRepository = remember { DashboardRepository(RetrofitClient.dashboardApi, sessionManager) }
    val devicesRepository = remember { DevicesRepository(RetrofitClient.devicesApi, sessionManager) }
    val eventsRepository = remember { EventsRepository(RetrofitClient.eventsApi, sessionManager) }
    val telemetryRepository = remember { TelemetryRepository(RetrofitClient.telemetryApi, sessionManager) }
    val overridesRepository = remember { OverridesRepository(RetrofitClient.overridesApi, sessionManager) }

    val navBackStackEntry by navController.currentBackStackEntryAsState()
    val currentRoute = navBackStackEntry?.destination?.route

    val onSessionExpired: () -> Unit = {
        navController.navigate(Routes.LOGIN) {
            popUpTo(0) { inclusive = true }
        }
    }

    Scaffold(
        bottomBar = {
            if (currentRoute in bottomNavRoutes) {
                NavigationBar {
                    bottomNavItems.forEach { item ->
                        NavigationBarItem(
                            selected = currentRoute == item.route,
                            onClick = {
                                if (currentRoute != item.route) {
                                    navController.navigate(item.route) {
                                        popUpTo(Routes.DASHBOARD) {
                                            saveState = true
                                        }
                                        launchSingleTop = true
                                        restoreState = true
                                    }
                                }
                            },
                            icon = { Icon(item.icon, contentDescription = item.label) },
                            label = { Text(item.label) },
                        )
                    }
                }
            }
        },
    ) { innerPadding ->
        NavHost(
            navController = navController,
            startDestination = Routes.LOGIN,
            modifier = Modifier.padding(innerPadding),
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
                    factory = DashboardViewModelFactory(dashboardRepository, eventsRepository),
                )
                DashboardScreen(
                    viewModel = dashboardViewModel,
                    fullName = sessionManager.getFullName() ?: "",
                    onNavigateToDevices = {
                        navController.navigate(Routes.DEVICES) {
                            popUpTo(Routes.DASHBOARD) { saveState = true }
                            launchSingleTop = true
                            restoreState = true
                        }
                    },
                    onNavigateToEvents = {
                        navController.navigate(Routes.EVENTS) {
                            popUpTo(Routes.DASHBOARD) { saveState = true }
                            launchSingleTop = true
                            restoreState = true
                        }
                    },
                    onNavigateToOverrides = {
                        navController.navigate(Routes.OVERRIDES)
                    },
                    onSessionExpired = onSessionExpired,
                )
            }
            composable(Routes.DEVICES) {
                val devicesViewModel: DevicesViewModel = viewModel(
                    factory = DevicesViewModelFactory(devicesRepository),
                )
                DevicesScreen(
                    viewModel = devicesViewModel,
                    onNavigateBack = { navController.popBackStack() },
                    onSessionExpired = onSessionExpired,
                    showBackButton = false,
                )
            }
            composable(Routes.EVENTS) {
                val eventsViewModel: EventsViewModel = viewModel(
                    factory = EventsViewModelFactory(eventsRepository),
                )
                EventsScreen(
                    viewModel = eventsViewModel,
                    onSessionExpired = onSessionExpired,
                )
            }
            composable(Routes.TELEMETRY) {
                val telemetryViewModel: TelemetryViewModel = viewModel(
                    factory = TelemetryViewModelFactory(telemetryRepository),
                )
                TelemetryScreen(
                    viewModel = telemetryViewModel,
                    onSessionExpired = onSessionExpired,
                )
            }
            composable(Routes.PROFILE) {
                ProfileScreen(
                    email = sessionManager.getEmail() ?: "",
                    fullName = sessionManager.getFullName() ?: "",
                    role = sessionManager.getRole() ?: "",
                    onLogout = {
                        authRepository.logout()
                        navController.navigate(Routes.LOGIN) {
                            popUpTo(0) { inclusive = true }
                        }
                    },
                )
            }
            composable(Routes.OVERRIDES) {
                val overridesViewModel: OverridesViewModel = viewModel(
                    factory = OverridesViewModelFactory(overridesRepository),
                )
                OverridesScreen(
                    viewModel = overridesViewModel,
                    userRole = sessionManager.getRole() ?: "",
                    adminEmail = sessionManager.getEmail() ?: "",
                    onNavigateBack = { navController.popBackStack() },
                    onSessionExpired = onSessionExpired,
                )
            }
        }
    }
}
