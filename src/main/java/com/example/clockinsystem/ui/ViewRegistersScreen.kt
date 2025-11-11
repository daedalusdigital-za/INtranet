package com.example.clockinsystem.ui

import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import com.example.clockinsystem.data.AppDatabase
import com.example.clockinsystem.data.ClockInRepository
import com.example.clockinsystem.model.ClockInLog
import com.example.clockinsystem.model.Employee
import kotlinx.coroutines.launch
import java.text.SimpleDateFormat
import java.util.*

@Composable
fun ViewRegistersScreen(
    onNavigateBack: () -> Unit
) {
    val context = LocalContext.current
    val scope = rememberCoroutineScope()
    
    var clockInLogs by remember { mutableStateOf<List<ClockInLog>>(emptyList()) }
    var employees by remember { mutableStateOf<List<Employee>>(emptyList()) }
    var isLoading by remember { mutableStateOf(true) }
    var errorMessage by remember { mutableStateOf<String?>(null) }

    // Initialize database and repository
    val database = remember { AppDatabase.getDatabase(context) }
    val repository = remember { 
        ClockInRepository(database.clockInDao(), database.employeeDao(), database.faceEmbeddingDao(), context) 
    }

    // Load data when screen opens
    LaunchedEffect(Unit) {
        scope.launch {
            try {
                clockInLogs = repository.getAllLogs()
                employees = repository.getAllEmployees()
                isLoading = false
            } catch (e: Exception) {
                errorMessage = "Failed to load data: ${e.message}"
                isLoading = false
            }
        }
    }

    Column(
        modifier = Modifier
            .fillMaxSize()
            .padding(24.dp),
        horizontalAlignment = Alignment.CenterHorizontally
    ) {
        Text(
            text = "Employee Registers",
            style = MaterialTheme.typography.headlineLarge,
            textAlign = TextAlign.Center,
            color = Color.White
        )

        Spacer(modifier = Modifier.height(24.dp))

        when {
            isLoading -> {
                CircularProgressIndicator(color = Color.White)
                Text(
                    text = "Loading registers...",
                    color = Color.White,
                    modifier = Modifier.padding(top = 16.dp)
                )
            }
            
            errorMessage != null -> {
                Text(
                    text = "Error: $errorMessage",
                    color = Color.Red,
                    textAlign = TextAlign.Center
                )
                
                Spacer(modifier = Modifier.height(16.dp))
                
                Button(
                    onClick = {
                        scope.launch {
                            try {
                                isLoading = true
                                errorMessage = null
                                clockInLogs = repository.getAllLogs()
                                employees = repository.getAllEmployees()
                                isLoading = false
                            } catch (e: Exception) {
                                errorMessage = "Failed to load data: ${e.message}"
                                isLoading = false
                            }
                        }
                    },
                    colors = ButtonDefaults.buttonColors(containerColor = Color.White)
                ) {
                    Text("Retry", color = Color.Black)
                }
            }
            
            clockInLogs.isEmpty() -> {
                Text(
                    text = "No clock-in records found.\nEmployees haven't clocked in yet.",
                    color = Color.White,
                    textAlign = TextAlign.Center,
                    style = MaterialTheme.typography.bodyLarge
                )
            }
            
            else -> {
                // Show employee summary
                Text(
                    text = "Registered Employees: ${employees.size}",
                    color = Color.White,
                    style = MaterialTheme.typography.titleMedium,
                    modifier = Modifier.padding(bottom = 8.dp)
                )
                
                Text(
                    text = "Total Clock Events: ${clockInLogs.size}",
                    color = Color.White,
                    style = MaterialTheme.typography.titleMedium,
                    modifier = Modifier.padding(bottom = 16.dp)
                )
                
                // Clock-in logs list
                LazyColumn(
                    modifier = Modifier.weight(1f),
                    verticalArrangement = Arrangement.spacedBy(8.dp)
                ) {
                    items(clockInLogs.sortedByDescending { it.timestamp }) { log ->
                        ClockInLogCard(
                            log = log,
                            employeeName = employees.find { it.id == log.employeeId }?.name ?: "Unknown Employee"
                        )
                    }
                }
            }
        }

        Spacer(modifier = Modifier.height(24.dp))

        Button(
            onClick = onNavigateBack,
            modifier = Modifier.fillMaxWidth(),
            colors = ButtonDefaults.buttonColors(containerColor = Color.White.copy(alpha = 0.9f))
        ) {
            Text("Back to Main Menu", color = Color.Black)
        }
    }
}

@Composable
fun ClockInLogCard(
    log: ClockInLog,
    employeeName: String
) {
    Card(
        modifier = Modifier.fillMaxWidth(),
        colors = CardDefaults.cardColors(
            containerColor = Color.White.copy(alpha = 0.9f)
        )
    ) {
        Column(
            modifier = Modifier.padding(16.dp)
        ) {
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.SpaceBetween,
                verticalAlignment = Alignment.CenterVertically
            ) {
                Text(
                    text = employeeName,
                    style = MaterialTheme.typography.titleMedium,
                    color = Color.Black
                )
                
                Card(
                    colors = CardDefaults.cardColors(
                        containerColor = if (log.eventType == "IN") Color.Green else Color.Red
                    )
                ) {
                    Text(
                        text = log.eventType,
                        color = Color.White,
                        modifier = Modifier.padding(horizontal = 8.dp, vertical = 4.dp),
                        style = MaterialTheme.typography.labelMedium
                    )
                }
            }
            
            Spacer(modifier = Modifier.height(8.dp))
            
            Text(
                text = "Employee ID: ${log.employeeId}",
                style = MaterialTheme.typography.bodyMedium,
                color = Color.Black.copy(alpha = 0.7f)
            )
            
            Text(
                text = "Time: ${formatTimestamp(log.timestamp)}",
                style = MaterialTheme.typography.bodyMedium,
                color = Color.Black.copy(alpha = 0.7f)
            )
        }
    }
}

private fun formatTimestamp(timestamp: Long): String {
    val date = Date(timestamp)
    val formatter = SimpleDateFormat("MMM dd, yyyy 'at' HH:mm:ss", Locale.getDefault())
    return formatter.format(date)
}