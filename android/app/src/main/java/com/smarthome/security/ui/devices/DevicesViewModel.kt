package com.smarthome.security.ui.devices

import androidx.lifecycle.ViewModel
import androidx.lifecycle.ViewModelProvider
import androidx.lifecycle.viewModelScope
import com.smarthome.security.data.model.Device
import com.smarthome.security.data.remote.SessionExpiredException
import com.smarthome.security.data.repository.DevicesRepository
import kotlinx.coroutines.Job
import kotlinx.coroutines.delay
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch

sealed class DevicesUiState {
    object Loading : DevicesUiState()
    data class Success(val devices: List<Device>) : DevicesUiState()
    data class Error(val message: String) : DevicesUiState()
    object SessionExpired : DevicesUiState()
}

class DevicesViewModel(private val repository: DevicesRepository) : ViewModel() {
    private val _uiState = MutableStateFlow<DevicesUiState>(DevicesUiState.Loading)
    val uiState: StateFlow<DevicesUiState> = _uiState.asStateFlow()

    private val _isRefreshing = MutableStateFlow(false)
    val isRefreshing: StateFlow<Boolean> = _isRefreshing.asStateFlow()

    private var autoRefreshJob: Job? = null

    init {
        loadDevices()
    }

    fun loadDevices() {
        _uiState.value = DevicesUiState.Loading
        viewModelScope.launch { fetchAndProcess() }
    }

    fun refresh() {
        if (_isRefreshing.value) return
        viewModelScope.launch {
            _isRefreshing.value = true
            try {
                fetchAndProcess()
            } finally {
                _isRefreshing.value = false
            }
        }
    }

    fun startAutoRefresh() {
        stopAutoRefresh()
        autoRefreshJob = viewModelScope.launch {
            while (true) {
                delay(30_000)
                fetchAndProcess()
            }
        }
    }

    fun stopAutoRefresh() {
        autoRefreshJob?.cancel()
        autoRefreshJob = null
    }

    private suspend fun fetchAndProcess() {
        val result = repository.getDevices()
        _uiState.value = result.fold(
            onSuccess = { devices -> DevicesUiState.Success(devices) },
            onFailure = { error ->
                if (error is SessionExpiredException) DevicesUiState.SessionExpired
                else DevicesUiState.Error(error.message ?: "Unknown error.")
            },
        )
    }
}

class DevicesViewModelFactory(private val repository: DevicesRepository) : ViewModelProvider.Factory {
    @Suppress("UNCHECKED_CAST")
    override fun <T : ViewModel> create(modelClass: Class<T>): T =
        DevicesViewModel(repository) as T
}
