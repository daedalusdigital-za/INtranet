package com.example.clockinsystem.ui

import androidx.compose.foundation.Image
import androidx.compose.foundation.layout.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.res.painterResource
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import com.example.clockinsystem.R

@Composable
fun MainMenuScreen(
    onNavigateToClockIn: () -> Unit,
    onNavigateToEmployeeRegistration: () -> Unit,
    onNavigateToViewRegisters: () -> Unit = {},
    onNavigateToCaptureStats: () -> Unit = {},
    onNavigateToEmployeeList: () -> Unit = {},
    onNavigateToFaceDiagnostic: () -> Unit = {},
    onNavigateToImageFaceDetection: () -> Unit = {},
    onNavigateToCameraDiagnostic: () -> Unit = {},
    onLogout: () -> Unit
) {
    Box(
        modifier = Modifier.fillMaxSize()
    ) {
        // Logo in top left corner
        Image(
            painter = painterResource(id = R.drawable.logo),
            contentDescription = "Company Logo",
            modifier = Modifier
                .align(Alignment.TopStart)
                .padding(16.dp)
                .size(80.dp)
        )

        // Main content centered
        Column(
            modifier = Modifier
                .fillMaxSize()
                .padding(24.dp),
            horizontalAlignment = Alignment.CenterHorizontally,
            verticalArrangement = Arrangement.Center
        ) {
            Text(
                text = "Clock-In System",
                style = MaterialTheme.typography.headlineLarge,
                textAlign = TextAlign.Center,
                color = Color.White
            )
            
            Text(
                text = "Select an option below",
                style = MaterialTheme.typography.bodyLarge,
                textAlign = TextAlign.Center,
                color = Color.White.copy(alpha = 0.8f)
            )

        Spacer(modifier = Modifier.height(32.dp))

        // Clock In/Out Button
        Button(
            onClick = onNavigateToClockIn,
            modifier = Modifier
                .fillMaxWidth()
                .height(60.dp),
            colors = ButtonDefaults.buttonColors(
                containerColor = Color.White
            )
        ) {
            Text(
                text = "Employee Clock In/Out",
                style = MaterialTheme.typography.titleMedium,
                color = Color.Black
            )
        }

        Spacer(modifier = Modifier.height(16.dp))

        // Employee Registration Button
        Button(
            onClick = onNavigateToEmployeeRegistration,
            modifier = Modifier
                .fillMaxWidth()
                .height(60.dp),
            colors = ButtonDefaults.buttonColors(
                containerColor = Color.White.copy(alpha = 0.9f)
            )
        ) {
            Text(
                text = "Register New Employee",
                style = MaterialTheme.typography.titleMedium,
                color = Color.Black
            )
        }

        Spacer(modifier = Modifier.height(16.dp))

        // Manage Employees Button
        Button(
            onClick = onNavigateToEmployeeList,
            modifier = Modifier
                .fillMaxWidth()
                .height(60.dp),
            colors = ButtonDefaults.buttonColors(
                containerColor = Color.Cyan
            )
        ) {
            Text(
                text = "Manage Employees",
                style = MaterialTheme.typography.titleMedium,
                color = Color.Black
            )
        }

        Spacer(modifier = Modifier.height(16.dp))

        // View Registers Button
        Button(
            onClick = onNavigateToViewRegisters,
            modifier = Modifier
                .fillMaxWidth()
                .height(60.dp),
            colors = ButtonDefaults.buttonColors(
                containerColor = Color.Blue
            )
        ) {
            Text(
                text = "View Registers",
                style = MaterialTheme.typography.titleMedium,
                color = Color.White
            )
        }

        Spacer(modifier = Modifier.height(16.dp))

        // Camera Diagnostic Button
        Button(
            onClick = onNavigateToCameraDiagnostic,
            modifier = Modifier
                .fillMaxWidth()
                .height(60.dp),
            colors = ButtonDefaults.buttonColors(
                containerColor = Color.Red
            )
        ) {
            Text(
                text = "Camera Diagnostic",
                style = MaterialTheme.typography.titleMedium,
                color = Color.White
            )
        }

        Spacer(modifier = Modifier.height(16.dp))

        // Image Face Detection Button
        Button(
            onClick = onNavigateToImageFaceDetection,
            modifier = Modifier
                .fillMaxWidth()
                .height(60.dp),
            colors = ButtonDefaults.buttonColors(
                containerColor = Color.Cyan
            )
        ) {
            Text(
                text = "Image Face Detection",
                style = MaterialTheme.typography.titleMedium,
                color = Color.White
            )
        }

        Spacer(modifier = Modifier.height(16.dp))

        // Face Recognition Diagnostic Button
        Button(
            onClick = onNavigateToFaceDiagnostic,
            modifier = Modifier
                .fillMaxWidth()
                .height(60.dp),
            colors = ButtonDefaults.buttonColors(
                containerColor = Color.Magenta
            )
        ) {
            Text(
                text = "Face Recognition Diagnostic",
                style = MaterialTheme.typography.titleMedium,
                color = Color.White
            )
        }

        Spacer(modifier = Modifier.height(16.dp))

        // Capture Production Stats Button
        Button(
            onClick = onNavigateToCaptureStats,
            modifier = Modifier
                .fillMaxWidth()
                .height(60.dp),
            colors = ButtonDefaults.buttonColors(
                containerColor = Color.Green
            )
        ) {
            Text(
                text = "Capture Production Stats",
                style = MaterialTheme.typography.titleMedium,
                color = Color.White
            )
        }

        Spacer(modifier = Modifier.height(32.dp))

        // Logout Button
        OutlinedButton(
            onClick = onLogout,
            modifier = Modifier.fillMaxWidth(),
            colors = ButtonDefaults.outlinedButtonColors(
                contentColor = Color.White
            )
        ) {
            Text("Logout", color = Color.White)
        }
        }
    }
}