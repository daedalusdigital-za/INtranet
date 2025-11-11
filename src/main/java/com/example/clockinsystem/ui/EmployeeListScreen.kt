package com.example.clockinsystem.ui

import android.graphics.BitmapFactory
import android.widget.Toast
import androidx.compose.foundation.Image
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.asImageBitmap
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.fragment.app.FragmentActivity
import androidx.lifecycle.lifecycleScope
import kotlinx.coroutines.launch
import com.example.clockinsystem.data.ClockInRepository
import com.example.clockinsystem.model.Employee
import java.io.File

@Composable
fun EmployeeListScreen(
    repository: ClockInRepository,
    activity: FragmentActivity,
    onNavigateBack: () -> Unit,
    onEditEmployee: (Employee) -> Unit,
    onRegisterNew: () -> Unit
) {
    var employees by remember { mutableStateOf<List<Employee>>(emptyList()) }
    var searchQuery by remember { mutableStateOf("") }
    var isLoading by remember { mutableStateOf(true) }
    var showDeleteDialog by remember { mutableStateOf<Employee?>(null) }
    var isDeleting by remember { mutableStateOf(false) }
    
    val context = LocalContext.current

    // Load employees
    LaunchedEffect(Unit) {
        activity.lifecycleScope.launch {
            try {
                employees = repository.getAllEmployees()
                isLoading = false
            } catch (e: Exception) {
                isLoading = false
                Toast.makeText(context, "Failed to load employees: ${e.message}", Toast.LENGTH_LONG).show()
            }
        }
    }

    // Filter employees based on search query
    val filteredEmployees = remember(employees, searchQuery) {
        if (searchQuery.isBlank()) {
            employees
        } else {
            employees.filter { employee ->
                employee.name.contains(searchQuery, ignoreCase = true) ||
                employee.id.contains(searchQuery, ignoreCase = true)
            }
        }
    }

    Column(
        modifier = Modifier
            .fillMaxSize()
            .background(Color.Black)
            .padding(16.dp)
    ) {
        // Header
        Row(
            modifier = Modifier.fillMaxWidth(),
            horizontalArrangement = Arrangement.SpaceBetween,
            verticalAlignment = Alignment.CenterVertically
        ) {
            IconButton(onClick = onNavigateBack) {
                Icon(
                    Icons.Default.ArrowBack,
                    contentDescription = "Back",
                    tint = Color.White
                )
            }
            
            Text(
                text = "Employee Management",
                style = MaterialTheme.typography.headlineMedium,
                color = Color.White,
                fontWeight = FontWeight.Bold
            )
            
            IconButton(onClick = onRegisterNew) {
                Icon(
                    Icons.Default.Add,
                    contentDescription = "Add Employee",
                    tint = Color.White
                )
            }
        }

        Spacer(modifier = Modifier.height(16.dp))

        // Search Bar
        OutlinedTextField(
            value = searchQuery,
            onValueChange = { searchQuery = it },
            label = { Text("Search employees...", color = Color.White) },
            leadingIcon = {
                Icon(Icons.Default.Search, contentDescription = null, tint = Color.White)
            },
            trailingIcon = {
                if (searchQuery.isNotEmpty()) {
                    IconButton(onClick = { searchQuery = "" }) {
                        Icon(Icons.Default.Clear, contentDescription = "Clear", tint = Color.White)
                    }
                }
            },
            modifier = Modifier.fillMaxWidth(),
            colors = OutlinedTextFieldDefaults.colors(
                focusedTextColor = Color.White,
                unfocusedTextColor = Color.White,
                focusedBorderColor = Color.White,
                unfocusedBorderColor = Color.Gray,
                cursorColor = Color.White
            ),
            singleLine = true
        )

        Spacer(modifier = Modifier.height(16.dp))

        // Employee Count
        Text(
            text = "${filteredEmployees.size} employee(s) found",
            style = MaterialTheme.typography.bodyMedium,
            color = Color.Gray,
            modifier = Modifier.padding(horizontal = 4.dp)
        )

        Spacer(modifier = Modifier.height(8.dp))

        // Employee List
        if (isLoading) {
            Box(
                modifier = Modifier.fillMaxSize(),
                contentAlignment = Alignment.Center
            ) {
                CircularProgressIndicator(color = Color.White)
            }
        } else if (filteredEmployees.isEmpty()) {
            Box(
                modifier = Modifier.fillMaxSize(),
                contentAlignment = Alignment.Center
            ) {
                Column(
                    horizontalAlignment = Alignment.CenterHorizontally
                ) {
                    Icon(
                        Icons.Default.Person,
                        contentDescription = null,
                        modifier = Modifier.size(64.dp),
                        tint = Color.Gray
                    )
                    Spacer(modifier = Modifier.height(16.dp))
                    Text(
                        text = if (searchQuery.isBlank()) "No employees registered" else "No employees found",
                        style = MaterialTheme.typography.bodyLarge,
                        color = Color.Gray,
                        textAlign = TextAlign.Center
                    )
                    Spacer(modifier = Modifier.height(8.dp))
                    if (searchQuery.isBlank()) {
                        Button(
                            onClick = onRegisterNew,
                            colors = ButtonDefaults.buttonColors(containerColor = Color.White)
                        ) {
                            Text("Register First Employee", color = Color.Black)
                        }
                    }
                }
            }
        } else {
            LazyColumn(
                verticalArrangement = Arrangement.spacedBy(12.dp)
            ) {
                items(filteredEmployees) { employee ->
                    EmployeeCard(
                        employee = employee,
                        onEdit = { onEditEmployee(employee) },
                        onDelete = { showDeleteDialog = employee },
                        modifier = Modifier.fillMaxWidth()
                    )
                }
            }
        }
    }

    // Delete Confirmation Dialog
    showDeleteDialog?.let { employeeToDelete ->
        AlertDialog(
            onDismissRequest = { showDeleteDialog = null },
            title = {
                Text("Delete Employee")
            },
            text = {
                Text("Are you sure you want to delete ${employeeToDelete.name}? This action cannot be undone.")
            },
            confirmButton = {
                Button(
                    onClick = {
                        activity.lifecycleScope.launch {
                            isDeleting = true
                            try {
                                repository.deleteEmployee(employeeToDelete)
                                employees = repository.getAllEmployees()
                                Toast.makeText(context, "${employeeToDelete.name} deleted successfully", Toast.LENGTH_SHORT).show()
                            } catch (e: Exception) {
                                Toast.makeText(context, "Failed to delete employee: ${e.message}", Toast.LENGTH_LONG).show()
                            } finally {
                                isDeleting = false
                                showDeleteDialog = null
                            }
                        }
                    },
                    colors = ButtonDefaults.buttonColors(containerColor = MaterialTheme.colorScheme.error),
                    enabled = !isDeleting
                ) {
                    if (isDeleting) {
                        CircularProgressIndicator(
                            modifier = Modifier.size(16.dp),
                            color = Color.White
                        )
                    } else {
                        Text("Delete")
                    }
                }
            },
            dismissButton = {
                TextButton(
                    onClick = { showDeleteDialog = null },
                    enabled = !isDeleting
                ) {
                    Text("Cancel")
                }
            }
        )
    }
}

@Composable
fun EmployeeCard(
    employee: Employee,
    onEdit: () -> Unit,
    onDelete: () -> Unit,
    modifier: Modifier = Modifier
) {
    val context = LocalContext.current
    
    Card(
        modifier = modifier,
        colors = CardDefaults.cardColors(
            containerColor = Color.White.copy(alpha = 0.1f)
        ),
        shape = RoundedCornerShape(12.dp)
    ) {
        Row(
            modifier = Modifier
                .fillMaxWidth()
                .padding(16.dp),
            verticalAlignment = Alignment.CenterVertically
        ) {
            // Employee Photo
            val bitmap = remember(employee.referenceImagePath) {
                try {
                    val file = File(employee.referenceImagePath)
                    if (file.exists()) {
                        BitmapFactory.decodeFile(file.absolutePath)
                    } else null
                } catch (e: Exception) {
                    null
                }
            }

            if (bitmap != null) {
                Image(
                    bitmap = bitmap.asImageBitmap(),
                    contentDescription = "Employee Photo",
                    modifier = Modifier
                        .size(60.dp)
                        .clip(CircleShape),
                    contentScale = ContentScale.Crop
                )
            } else {
                Box(
                    modifier = Modifier
                        .size(60.dp)
                        .clip(CircleShape)
                        .background(Color.Gray),
                    contentAlignment = Alignment.Center
                ) {
                    Icon(
                        Icons.Default.Person,
                        contentDescription = "Default Avatar",
                        tint = Color.White,
                        modifier = Modifier.size(30.dp)
                    )
                }
            }

            Spacer(modifier = Modifier.width(16.dp))

            // Employee Info
            Column(
                modifier = Modifier.weight(1f)
            ) {
                Text(
                    text = employee.name,
                    style = MaterialTheme.typography.titleMedium,
                    color = Color.White,
                    fontWeight = FontWeight.Bold,
                    maxLines = 1,
                    overflow = TextOverflow.Ellipsis
                )
                
                Text(
                    text = "ID: ${employee.id}",
                    style = MaterialTheme.typography.bodyMedium,
                    color = Color.Gray,
                    maxLines = 1,
                    overflow = TextOverflow.Ellipsis
                )

                Row(
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    Icon(
                        Icons.Default.Lock,
                        contentDescription = null,
                        tint = if (employee.fingerprintTemplate != null) Color.Green else Color.Red,
                        modifier = Modifier.size(16.dp)
                    )
                    Spacer(modifier = Modifier.width(4.dp))
                    Text(
                        text = if (employee.fingerprintTemplate != null) "Fingerprint enrolled" else "No fingerprint",
                        style = MaterialTheme.typography.bodySmall,
                        color = if (employee.fingerprintTemplate != null) Color.Green else Color.Red
                    )
                }
            }

            // Action Buttons
            Column(
                horizontalAlignment = Alignment.End
            ) {
                IconButton(onClick = onEdit) {
                    Icon(
                        Icons.Default.Edit,
                        contentDescription = "Edit Employee",
                        tint = Color.White
                    )
                }
                
                IconButton(onClick = onDelete) {
                    Icon(
                        Icons.Default.Delete,
                        contentDescription = "Delete Employee",
                        tint = Color.Red
                    )
                }
            }
        }
    }
}