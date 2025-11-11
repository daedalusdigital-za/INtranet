package com.example.clockinsystem.ui

import androidx.compose.foundation.layout.*
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.text.input.PasswordVisualTransformation
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp

@Composable
fun LoginScreen(
    onLoginSuccess: () -> Unit,
    onLoginFailed: () -> Unit
) {
    var username by remember { mutableStateOf("") }
    var password by remember { mutableStateOf("") }
    var isLoading by remember { mutableStateOf(false) }

    Column(
        modifier = Modifier
            .fillMaxSize()
            .padding(24.dp),
        horizontalAlignment = Alignment.CenterHorizontally,
        verticalArrangement = Arrangement.Center
    ) {
        Text(
            text = "Administrator Login",
            style = MaterialTheme.typography.headlineMedium,
            textAlign = TextAlign.Center,
            color = Color.White
        )
        
        Spacer(modifier = Modifier.height(32.dp))

        OutlinedTextField(
            value = username,
            onValueChange = { username = it },
            label = { Text("Username", color = Color.White) },
            modifier = Modifier.fillMaxWidth(),
            singleLine = true,
            colors = OutlinedTextFieldDefaults.colors(
                focusedTextColor = Color.White,
                unfocusedTextColor = Color.White,
                focusedBorderColor = Color.White,
                unfocusedBorderColor = Color.White.copy(alpha = 0.7f),
                cursorColor = Color.White
            )
        )

        Spacer(modifier = Modifier.height(16.dp))

        OutlinedTextField(
            value = password,
            onValueChange = { password = it },
            label = { Text("Password", color = Color.White) },
            modifier = Modifier.fillMaxWidth(),
            singleLine = true,
            visualTransformation = PasswordVisualTransformation(),
            keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Password),
            colors = OutlinedTextFieldDefaults.colors(
                focusedTextColor = Color.White,
                unfocusedTextColor = Color.White,
                focusedBorderColor = Color.White,
                unfocusedBorderColor = Color.White.copy(alpha = 0.7f),
                cursorColor = Color.White
            )
        )

        Spacer(modifier = Modifier.height(24.dp))

        Button(
            onClick = {
                isLoading = true
                // Simple hardcoded authentication - replace with real authentication
                if (username == "welcome" && password == "Kingsland") {
                    onLoginSuccess()
                } else {
                    onLoginFailed()
                }
                isLoading = false
            },
            modifier = Modifier.fillMaxWidth(),
            enabled = username.isNotEmpty() && password.isNotEmpty() && !isLoading,
            colors = ButtonDefaults.buttonColors(containerColor = Color.White)
        ) {
            if (isLoading) {
                CircularProgressIndicator(modifier = Modifier.size(16.dp), color = Color.Black)
            } else {
                Text("Login", color = Color.Black)
            }
        }

        Spacer(modifier = Modifier.height(16.dp))

        Text(
            text = "Default credentials: welcome / Kingsland",
            style = MaterialTheme.typography.bodySmall,
            color = Color.White.copy(alpha = 0.8f)
        )
    }
}
