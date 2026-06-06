package com.smarthome.security.ui.users

import androidx.lifecycle.ViewModel
import androidx.lifecycle.ViewModelProvider
import androidx.lifecycle.viewModelScope
import com.smarthome.security.data.model.UserListItem
import com.smarthome.security.data.remote.SessionExpiredException
import com.smarthome.security.data.repository.UsersRepository
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch

sealed class UsersUiState {
    object Loading : UsersUiState()
    data class Success(val users: List<UserListItem>) : UsersUiState()
    data class Error(val message: String) : UsersUiState()
    object SessionExpired : UsersUiState()
}

class UsersViewModel(private val repository: UsersRepository) : ViewModel() {
    private val _uiState = MutableStateFlow<UsersUiState>(UsersUiState.Loading)
    val uiState: StateFlow<UsersUiState> = _uiState.asStateFlow()

    private val _promotingUserId = MutableStateFlow<String?>(null)
    val promotingUserId: StateFlow<String?> = _promotingUserId.asStateFlow()

    private val _promoteError = MutableStateFlow<String?>(null)
    val promoteError: StateFlow<String?> = _promoteError.asStateFlow()

    init {
        loadUsers()
    }

    fun loadUsers() {
        _uiState.value = UsersUiState.Loading
        _promoteError.value = null
        viewModelScope.launch {
            val result = repository.getUsers()
            _uiState.value = result.fold(
                onSuccess = { UsersUiState.Success(it) },
                onFailure = { error ->
                    if (error is SessionExpiredException)
                        UsersUiState.SessionExpired
                    else
                        UsersUiState.Error(error.message ?: "Unknown error.")
                },
            )
        }
    }

    fun promoteToAdmin(userId: String) {
        if (_promotingUserId.value != null) return
        _promotingUserId.value = userId
        _promoteError.value = null
        viewModelScope.launch {
            val result = repository.promoteToAdmin(userId)
            _promotingUserId.value = null
            result.fold(
                onSuccess = { loadUsers() },
                onFailure = { error ->
                    if (error is SessionExpiredException) {
                        _uiState.value = UsersUiState.SessionExpired
                    } else {
                        _promoteError.value = error.message ?: "Promotion failed."
                    }
                },
            )
        }
    }

    fun clearPromoteError() {
        _promoteError.value = null
    }
}

class UsersViewModelFactory(private val repository: UsersRepository) : ViewModelProvider.Factory {
    @Suppress("UNCHECKED_CAST")
    override fun <T : ViewModel> create(modelClass: Class<T>): T =
        UsersViewModel(repository) as T
}
