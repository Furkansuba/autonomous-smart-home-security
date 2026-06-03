package com.smarthome.security.ui.events

import androidx.lifecycle.ViewModel
import androidx.lifecycle.ViewModelProvider
import androidx.lifecycle.viewModelScope
import com.smarthome.security.data.model.Event
import com.smarthome.security.data.remote.SessionExpiredException
import com.smarthome.security.data.repository.EventsRepository
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch

sealed class EventsUiState {
    object Loading : EventsUiState()
    data class Success(val events: List<Event>) : EventsUiState()
    data class Error(val message: String) : EventsUiState()
    object SessionExpired : EventsUiState()
}

class EventsViewModel(private val repository: EventsRepository) : ViewModel() {
    private val _uiState = MutableStateFlow<EventsUiState>(EventsUiState.Loading)
    val uiState: StateFlow<EventsUiState> = _uiState.asStateFlow()

    init {
        loadEvents()
    }

    fun loadEvents() {
        _uiState.value = EventsUiState.Loading
        viewModelScope.launch {
            val result = repository.getEvents()
            _uiState.value = result.fold(
                onSuccess = { EventsUiState.Success(it) },
                onFailure = { error ->
                    if (error is SessionExpiredException)
                        EventsUiState.SessionExpired
                    else
                        EventsUiState.Error(error.message ?: "Unknown error.")
                },
            )
        }
    }
}

class EventsViewModelFactory(private val repository: EventsRepository) : ViewModelProvider.Factory {
    @Suppress("UNCHECKED_CAST")
    override fun <T : ViewModel> create(modelClass: Class<T>): T =
        EventsViewModel(repository) as T
}
