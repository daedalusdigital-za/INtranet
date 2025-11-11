package com.example.clockinsystem.ui

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.ArrowBack
import androidx.compose.material.icons.filled.ArrowBack
import androidx.compose.material.icons.filled.Lock
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.text.input.PasswordVisualTransformation
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.example.clockinsystem.model.Employee

@Composable
fun SimplePinAuthenticator(
    employee: Employee,
    onAuthenticated: (Employee) -> Unit,
    onBackPressed: () -> Unit
) {
    var enteredPin by remember { mutableStateOf("") }
    var showError by remember { mutableStateOf(false) }
    var isProcessing by remember { mutableStateOf(false) }
    
    // For demo purposes, use a simple PIN system
    // In reality, this would be stored securely in the employee record
    val employeePin = remember { 
        // Generate a simple 4-digit PIN based on employee ID for demo
        val pinNumber = employee.id.takeLast(4).padStart(4, '0')
        if (pinNumber.all { it.isDigit() }) pinNumber else "1234"
    }
    
    Column(
        modifier = Modifier
            .fillMaxSize()
            .padding(24.dp),
        horizontalAlignment = Alignment.CenterHorizontally
    ) {
        // Header
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
                text = "Enter PIN to Continue",
                style = MaterialTheme.typography.headlineSmall,
                color = Color.White,
                fontWeight = FontWeight.Bold
            )
        }
        
        Spacer(modifier = Modifier.height(32.dp))
        
        // Employee info
        Card(
            modifier = Modifier.fillMaxWidth(),
            colors = CardDefaults.cardColors(
                containerColor = Color.White.copy(alpha = 0.1f)
            )
        ) {
            Column(
                modifier = Modifier.padding(20.dp),
                horizontalAlignment = Alignment.CenterHorizontally
            ) {
                Icon(
                    Icons.Default.Lock,
                    contentDescription = null,
                    tint = Color.White,
                    modifier = Modifier.size(32.dp)
                )
                Spacer(modifier = Modifier.height(12.dp))
                Text(
                    text = employee.name,
                    style = MaterialTheme.typography.titleLarge,
                    color = Color.White,
                    fontWeight = FontWeight.Bold
                )
                Text(
                    text = "ID: ${employee.id}",
                    style = MaterialTheme.typography.bodyMedium,
                    color = Color.White.copy(alpha = 0.8f)
                )
            }
        }
        
        Spacer(modifier = Modifier.height(32.dp))
        
        // Demo PIN info
        Card(
            modifier = Modifier.fillMaxWidth(),
            colors = CardDefaults.cardColors(
                containerColor = Color.Blue.copy(alpha = 0.1f)
            )
        ) {
            Text(
                text = "Demo Mode: Employee PIN is $employeePin",
                modifier = Modifier.padding(16.dp),
                color = Color.White,
                style = MaterialTheme.typography.bodyMedium,
                textAlign = TextAlign.Center
            )
        }
        
        Spacer(modifier = Modifier.height(24.dp))
        
        // PIN input display
        Row(
            horizontalArrangement = Arrangement.spacedBy(12.dp),
            modifier = Modifier.padding(horizontal = 32.dp)
        ) {
            repeat(4) { index ->
                Box(
                    modifier = Modifier
                        .size(50.dp)
                        .border(
                            2.dp,
                            if (index < enteredPin.length) Color.White else Color.White.copy(alpha = 0.3f),
                            RoundedCornerShape(8.dp)
                        )
                        .background(
                            if (index < enteredPin.length) Color.White.copy(alpha = 0.1f) else Color.Transparent,
                            RoundedCornerShape(8.dp)
                        ),
                    contentAlignment = Alignment.Center
                ) {
                    if (index < enteredPin.length) {
                        Text(
                            text = "●",
                            color = Color.White,
                            fontSize = 20.sp,
                            fontWeight = FontWeight.Bold
                        )
                    }
                }
            }
        }
        
        if (showError) {
            Spacer(modifier = Modifier.height(16.dp))
            Text(
                text = "Incorrect PIN. Please try again.",
                color = Color.Red,
                style = MaterialTheme.typography.bodyMedium
            )
        }
        
        Spacer(modifier = Modifier.height(32.dp))
        
        // Number pad
        Column(
            verticalArrangement = Arrangement.spacedBy(12.dp)
        ) {
            // Row 1: 1, 2, 3
            Row(
                horizontalArrangement = Arrangement.spacedBy(12.dp)
            ) {
                repeat(3) { i ->
                    NumberButton(
                        number = (i + 1).toString(),
                        onClick = {
                            if (enteredPin.length < 4) {
                                enteredPin += (i + 1).toString()
                                showError = false
                            }
                        }
                    )
                }
            }
            
            // Row 2: 4, 5, 6
            Row(
                horizontalArrangement = Arrangement.spacedBy(12.dp)
            ) {
                repeat(3) { i ->
                    NumberButton(
                        number = (i + 4).toString(),
                        onClick = {
                            if (enteredPin.length < 4) {
                                enteredPin += (i + 4).toString()
                                showError = false
                            }
                        }
                    )
                }
            }
            
            // Row 3: 7, 8, 9
            Row(
                horizontalArrangement = Arrangement.spacedBy(12.dp)
            ) {
                repeat(3) { i ->
                    NumberButton(
                        number = (i + 7).toString(),
                        onClick = {
                            if (enteredPin.length < 4) {
                                enteredPin += (i + 7).toString()
                                showError = false
                            }
                        }
                    )
                }
            }
            
            // Row 4: Clear, 0, Backspace
            Row(
                horizontalArrangement = Arrangement.spacedBy(12.dp)
            ) {
                // Clear button
                ActionButton(
                    text = "Clear",
                    onClick = {
                        enteredPin = ""
                        showError = false
                    }
                )
                
                // 0 button
                NumberButton(
                    number = "0",
                    onClick = {
                        if (enteredPin.length < 4) {
                            enteredPin += "0"
                            showError = false
                        }
                    }
                )
                
                // Backspace button
                ActionButton(
                    icon = Icons.Default.ArrowBack,
                    onClick = {
                        if (enteredPin.isNotEmpty()) {
                            enteredPin = enteredPin.dropLast(1)
                            showError = false
                        }
                    }
                )
            }
        }
        
        // Auto-authenticate when 4 digits are entered
        LaunchedEffect(enteredPin) {
            if (enteredPin.length == 4) {
                isProcessing = true
                kotlinx.coroutines.delay(500) // Small delay for UX
                
                if (enteredPin == employeePin) {
                    onAuthenticated(employee)
                } else {
                    showError = true
                    enteredPin = ""
                }
                isProcessing = false
            }
        }
        
        if (isProcessing) {
            Spacer(modifier = Modifier.height(24.dp))
            CircularProgressIndicator(color = Color.White)
        }
    }
}

@Composable
private fun NumberButton(
    number: String,
    onClick: () -> Unit
) {
    Button(
        onClick = onClick,
        modifier = Modifier.size(80.dp),
        colors = ButtonDefaults.buttonColors(
            containerColor = Color.White.copy(alpha = 0.1f)
        ),
        shape = CircleShape
    ) {
        Text(
            text = number,
            color = Color.White,
            fontSize = 24.sp,
            fontWeight = FontWeight.Bold
        )
    }
}

@Composable
private fun ActionButton(
    text: String? = null,
    icon: androidx.compose.ui.graphics.vector.ImageVector? = null,
    onClick: () -> Unit
) {
    Button(
        onClick = onClick,
        modifier = Modifier.size(80.dp),
        colors = ButtonDefaults.buttonColors(
            containerColor = Color.White.copy(alpha = 0.1f)
        ),
        shape = CircleShape
    ) {
        if (text != null) {
            Text(
                text = text,
                color = Color.White,
                fontSize = 12.sp,
                fontWeight = FontWeight.Bold
            )
        } else if (icon != null) {
            Icon(
                icon,
                contentDescription = null,
                tint = Color.White,
                modifier = Modifier.size(24.dp)
            )
        }
    }
}