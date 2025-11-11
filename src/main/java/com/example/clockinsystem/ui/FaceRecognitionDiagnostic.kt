package com.example.clockinsystem.ui

import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.ArrowBack
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import com.example.clockinsystem.data.AppDatabase
import com.example.clockinsystem.model.Employee
import com.example.clockinsystem.model.FaceEmbedding
import kotlinx.coroutines.launch

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun FaceRecognitionDiagnostic(
    onNavigateBack: () -> Unit
) {
    val context = LocalContext.current
    val scope = rememberCoroutineScope()
    val database = remember { AppDatabase.getDatabase(context) }
    
    var employees by remember { mutableStateOf<List<Employee>>(emptyList()) }
    var faceEmbeddings by remember { mutableStateOf<List<FaceEmbedding>>(emptyList()) }
    var isLoading by remember { mutableStateOf(true) }
    
    // Load data
    LaunchedEffect(Unit) {
        scope.launch {
            employees = database.employeeDao().getAllEmployees()
            faceEmbeddings = database.faceEmbeddingDao().getAllFaceEmbeddings()
            isLoading = false
        }
    }
    
    Scaffold(
        topBar = {
            TopAppBar(
                title = { Text("Face Recognition Diagnostic") },
                navigationIcon = {
                    IconButton(onClick = onNavigateBack) {
                        Icon(
                            Icons.Default.ArrowBack,
                            contentDescription = "Back",
                            tint = Color.White
                        )
                    }
                },
                colors = TopAppBarDefaults.topAppBarColors(
                    containerColor = Color.Blue
                )
            )
        }
    ) { paddingValues ->
        Column(
            modifier = Modifier
                .fillMaxSize()
                .padding(paddingValues)
                .padding(16.dp)
        ) {
            if (isLoading) {
                Box(
                    modifier = Modifier.fillMaxSize(),
                    contentAlignment = Alignment.Center
                ) {
                    CircularProgressIndicator()
                }
            } else {
                // Summary cards
                Card(
                    modifier = Modifier.fillMaxWidth(),
                    colors = CardDefaults.cardColors(containerColor = Color.Blue.copy(alpha = 0.1f))
                ) {
                    Column(modifier = Modifier.padding(16.dp)) {
                        Text(
                            text = "System Status",
                            style = MaterialTheme.typography.headlineSmall,
                            fontWeight = FontWeight.Bold
                        )
                        Spacer(modifier = Modifier.height(8.dp))
                        Text("Total Employees: ${employees.size}")
                        Text("Employees with Photos: ${employees.count { !it.referenceImagePath.isNullOrEmpty() }}")
                        Text("Registered Face Embeddings: ${faceEmbeddings.size}")
                        
                        val embeddingStatus = if (faceEmbeddings.isNotEmpty()) "✅ Ready" else "❌ No faces registered"
                        Text(
                            text = "Face Recognition Status: $embeddingStatus",
                            color = if (faceEmbeddings.isNotEmpty()) Color.Green else Color.Red,
                            fontWeight = FontWeight.Bold
                        )
                    }
                }
                
                Spacer(modifier = Modifier.height(16.dp))
                
                Text(
                    text = "Employee Face Registration Details",
                    style = MaterialTheme.typography.headlineSmall,
                    fontWeight = FontWeight.Bold
                )
                
                Spacer(modifier = Modifier.height(8.dp))
                
                LazyColumn {
                    items(employees) { employee ->
                        Card(
                            modifier = Modifier
                                .fillMaxWidth()
                                .padding(vertical = 4.dp)
                        ) {
                            Column(modifier = Modifier.padding(16.dp)) {
                                Text(
                                    text = employee.name,
                                    style = MaterialTheme.typography.titleMedium,
                                    fontWeight = FontWeight.Bold
                                )
                                
                                val hasPhoto = !employee.referenceImagePath.isNullOrEmpty()
                                val hasEmbedding = faceEmbeddings.any { it.employeeId == employee.id }
                                
                                Row(
                                    modifier = Modifier.fillMaxWidth(),
                                    horizontalArrangement = Arrangement.SpaceBetween
                                ) {
                                    Column {
                                        Text(
                                            text = "Photo: ${if (hasPhoto) "✅" else "❌"}",
                                            color = if (hasPhoto) Color.Green else Color.Red
                                        )
                                        if (hasPhoto) {
                                            Text(
                                                text = "Path: ${employee.referenceImagePath}",
                                                style = MaterialTheme.typography.bodySmall,
                                                color = Color.Gray
                                            )
                                        }
                                    }
                                    
                                    Column {
                                        Text(
                                            text = "Face Registered: ${if (hasEmbedding) "✅" else "❌"}",
                                            color = if (hasEmbedding) Color.Green else Color.Red
                                        )
                                        if (hasEmbedding) {
                                            val embedding = faceEmbeddings.find { it.employeeId == employee.id }
                                            Text(
                                                text = "Confidence: ${embedding?.confidence ?: 0f}",
                                                style = MaterialTheme.typography.bodySmall,
                                                color = Color.Gray
                                            )
                                        }
                                    }
                                }
                                
                                // Action buttons
                                if (hasPhoto && !hasEmbedding) {
                                    Spacer(modifier = Modifier.height(8.dp))
                                    Button(
                                        onClick = {
                                            scope.launch {
                                                // Try to register face
                                                val faceRecognitionManager = com.example.clockinsystem.auth.EnhancedFaceRecognitionManager(context)
                                                val embedding = faceRecognitionManager.registerEmployeeFace(employee)
                                                if (embedding != null) {
                                                    database.faceEmbeddingDao().insertFaceEmbedding(embedding)
                                                    // Refresh data
                                                    faceEmbeddings = database.faceEmbeddingDao().getAllFaceEmbeddings()
                                                }
                                            }
                                        },
                                        modifier = Modifier.fillMaxWidth()
                                    ) {
                                        Text("Register Face")
                                    }
                                }
                            }
                        }
                    }
                }
            }
        }
    }
}