package com.smarthome.security.ui.dashboard

import androidx.lifecycle.ViewModel
import androidx.lifecycle.ViewModelProvider
import androidx.lifecycle.viewModelScope
import com.smarthome.security.data.model.DashboardSummary
import com.smarthome.security.data.model.Event
import com.smarthome.security.data.remote.SessionExpiredException
import com.smarthome.security.data.repository.DashboardRepository
import com.smarthome.security.data.repository.EventsRepository
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch

sealed class DashboardUiState {
    object Loading : DashboardUiState()
    data class Success(val summary: DashboardSummary) : DashboardUiState()
    data class Error(val message: String) : DashboardUiState()
    object SessionExpired : DashboardUiState()
}

class DashboardViewModel(
    private val repository: DashboardRepository,
    private val eventsRepository: EventsRepository,
) : ViewModel() {
    private val _uiState = MutableStateFlow<DashboardUiState>(DashboardUiState.Loading)
    val uiState: StateFlow<DashboardUiState> = _uiState.asStateFlow()

    private val _recentEvents = MutableStateFlow<List<Event>>(emptyList())
    val recentEvents: StateFlow<List<Event>> = _recentEvents.asStateFlow()

    init {
        loadSummary()
    }

    fun loadSummary() {
        _uiState.value = DashboardUiState.Loading
        viewModelScope.launch {
            val result = repository.getSummary()
            _uiState.value = result.fold(
                onSuccess = { DashboardUiState.Success(it) },
                onFailure = { error ->
                    if (error is SessionExpiredException)
                        DashboardUiState.SessionExpired
                    else
                        DashboardUiState.Error(error.message ?: "Unknown error.")
                },
            )
        }
        viewModelScope.launch {
            eventsRepository.getEvents()
                .onSuccess { events -> _recentEvents.value = events.take(3) }
                .onFailure { error ->
                    if (error is SessionExpiredException) {
                        _uiState.value = DashboardUiState.SessionExpired
                    }
                }
        }
    }
}

class DashboardViewModelFactory(
    private val repository: DashboardRepository,
    private val eventsRepository: EventsRepository,
) : ViewModelProvider.Factory {
    @Suppress("UNCHECKED_CAST")
    override fun <T : ViewModel> create(modelClass: Class<T>): T =
        DashboardViewModel(repository, eventsRepository) as T
}
