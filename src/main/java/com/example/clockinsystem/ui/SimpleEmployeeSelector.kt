package com.example.clockinsystem.ui

import androidx.compose.foundation.Image
import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.grid.GridCells
import androidx.compose.foundation.lazy.grid.LazyVerticalGrid
import androidx.compose.foundation.lazy.grid.items
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.ArrowBack
import androidx.compose.material.icons.filled.Person
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.asImageBitmap
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import com.example.clockinsystem.model.Employee
import com.example.clockinsystem.utils.ImageUtils

@Composable
fun SimpleEmployeeSelector(
    employees: List<Employee>,
    onEmployeeSelected: (Employee) -> Unit,
    onBackPressed: () -> Unit
) {
    val context = LocalContext.current
    
    Column(
        modifier = Modifier
            .fillMaxSize()
            .padding(16.dp)
    ) {
        // Header with back button
        Row(
            modifier = Modifier.fillMaxWidth(),
            verticalAlignment = Alignment.CenterVertically
        ) {
            IconButton(onClick = onBackPressed) {
                Icon(
                    Icons.Default.ArrowBack,
                    contentDescription = "Back",
                    tint = Color.White
                )
            }
            Spacer(modifier = Modifier.width(8.dp))
            Text(
                text = "Select Employee to Clock In/Out",
                style = MaterialTheme.typography.headlineSmall,
                color = Color.White,
                fontWeight = FontWeight.Bold
            )
        }
        
        Spacer(modifier = Modifier.height(16.dp))
        
        // Info card explaining this is a demo
        Card(
            modifier = Modifier.fillMaxWidth(),
            colors = CardDefaults.cardColors(
                containerColor = Color.Blue.copy(alpha = 0.1f)
            ),
            shape = RoundedCornerShape(8.dp)
        ) {
            Row(
                modifier = Modifier.padding(12.dp),
                verticalAlignment = Alignment.CenterVertically
            ) {
                Icon(
                    Icons.Default.Person,
                    contentDescription = null,
                    tint = Color.White,
                    modifier = Modifier.size(20.dp)
                )
                Spacer(modifier = Modifier.width(8.dp))
                Text(
                    text = "Demo Mode: Select any employee to simulate their clock in/out",
                    color = Color.White,
                    style = MaterialTheme.typography.bodySmall
                )
            }
        }
        
        Spacer(modifier = Modifier.height(20.dp))
        
        if (employees.isEmpty()) {
            // No employees message
            Card(
                modifier = Modifier.fillMaxWidth(),
                colors = CardDefaults.cardColors(
                    containerColor = Color.Red.copy(alpha = 0.1f)
                )
            ) {
                Text(
                    text = "No employees found.\nPlease add employees first.",
                    modifier = Modifier.padding(24.dp),
                    color = Color.White,
                    textAlign = TextAlign.Center,
                    style = MaterialTheme.typography.bodyLarge
                )
            }
        } else {
            // Employee grid
            LazyVerticalGrid(
                columns = GridCells.Fixed(2),
                horizontalArrangement = Arrangement.spacedBy(12.dp),
                verticalArrangement = Arrangement.spacedBy(12.dp)
            ) {
                items(employees) { employee ->
                    EmployeeCard(
                        employee = employee,
                        onClick = { onEmployeeSelected(employee) }
                    )
                }
            }
        }
    }
}

@Composable
private fun EmployeeCard(
    employee: Employee,
    onClick: () -> Unit
) {
    val context = LocalContext.current
    
    Card(
        modifier = Modifier
            .fillMaxWidth()
            .clickable { onClick() },
        colors = CardDefaults.cardColors(
            containerColor = Color.White.copy(alpha = 0.9f)
        ),
        elevation = CardDefaults.cardElevation(defaultElevation = 4.dp),
        shape = RoundedCornerShape(12.dp)
    ) {
        Column(
            modifier = Modifier.padding(16.dp),
            horizontalAlignment = Alignment.CenterHorizontally
        ) {
            // Employee photo or placeholder
            Box(
                modifier = Modifier
                    .size(80.dp)
                    .clip(CircleShape)
                    .background(Color.Gray.copy(alpha = 0.3f)),
                contentAlignment = Alignment.Center
            ) {
                val bitmap = remember(employee.referenceImagePath) {
                    if (employee.referenceImagePath.isNotEmpty()) {
                        ImageUtils.loadImageFromPath(context, employee.referenceImagePath)
                    } else null
                }
                
                if (bitmap != null) {
                    Image(
                        bitmap = bitmap.asImageBitmap(),
                        contentDescription = "Employee Photo",
                        modifier = Modifier
                            .fillMaxSize()
                            .clip(CircleShape)
                    )
                } else {
                    Icon(
                        Icons.Default.Person,
                        contentDescription = "No Photo",
                        modifier = Modifier.size(40.dp),
                        tint = Color.Gray
                    )
                }
            }
            
            Spacer(modifier = Modifier.height(12.dp))
            
            // Employee name
            Text(
                text = employee.name,
                style = MaterialTheme.typography.titleMedium,
                color = Color.Black,
                fontWeight = FontWeight.Bold,
                textAlign = TextAlign.Center
            )
            
            // Employee ID
            Text(
                text = "ID: ${employee.id}",
                style = MaterialTheme.typography.bodySmall,
                color = Color.Gray,
                textAlign = TextAlign.Center
            )
            
            Spacer(modifier = Modifier.height(8.dp))
            
            // Tap to select indicator
            Text(
                text = "Tap to Clock In/Out",
                style = MaterialTheme.typography.bodySmall,
                color = Color.Blue,
                textAlign = TextAlign.Center,
                fontWeight = FontWeight.Medium
            )
        }
    }
}