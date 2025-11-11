package com.example.clockinsystem.ui

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import com.example.clockinsystem.utils.FingerprintDiagnostics

@Composable
fun FingerprintDiagnosticScreen(
    onNavigateBack: () -> Unit
) {
    val context = LocalContext.current
    val diagnostics = remember { FingerprintDiagnostics.diagnoseFingerprintIssues(context) }

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
                text = "Fingerprint Diagnostics",
                style = MaterialTheme.typography.headlineMedium,
                color = Color.White,
                fontWeight = FontWeight.Bold
            )
            
            Spacer(modifier = Modifier.width(48.dp)) // Balance the back button
        }

        Spacer(modifier = Modifier.height(24.dp))

        // Overall Status Card
        Card(
            modifier = Modifier.fillMaxWidth(),
            colors = CardDefaults.cardColors(
                containerColor = if (diagnostics.canUseStrongBiometrics) 
                    Color.Green.copy(alpha = 0.2f) 
                else 
                    Color.Red.copy(alpha = 0.2f)
            ),
            shape = RoundedCornerShape(12.dp)
        ) {
            Row(
                modifier = Modifier
                    .fillMaxWidth()
                    .padding(16.dp),
                verticalAlignment = Alignment.CenterVertically
            ) {
                Icon(
                    if (diagnostics.canUseStrongBiometrics) Icons.Default.CheckCircle else Icons.Default.Clear,
                    contentDescription = null,
                    tint = if (diagnostics.canUseStrongBiometrics) Color.Green else Color.Red,
                    modifier = Modifier.size(32.dp)
                )
                Spacer(modifier = Modifier.width(12.dp))
                Column {
                    Text(
                        text = if (diagnostics.canUseStrongBiometrics) 
                            "Fingerprint Ready" 
                        else 
                            "Fingerprint Issues Detected",
                        style = MaterialTheme.typography.titleMedium,
                        color = Color.White,
                        fontWeight = FontWeight.Bold
                    )
                    Text(
                        text = if (diagnostics.canUseStrongBiometrics) 
                            "Your device is ready for fingerprint enrollment" 
                        else 
                            "Issues preventing fingerprint enrollment",
                        style = MaterialTheme.typography.bodyMedium,
                        color = Color.Gray
                    )
                }
            }
        }

        Spacer(modifier = Modifier.height(24.dp))

        // Detailed Status
        Text(
            text = "Detailed Status",
            style = MaterialTheme.typography.titleMedium,
            color = Color.White,
            fontWeight = FontWeight.Bold
        )

        Spacer(modifier = Modifier.height(12.dp))

        LazyColumn(
            verticalArrangement = Arrangement.spacedBy(8.dp)
        ) {
            item {
                StatusCard(
                    title = "Strong Biometrics (Fingerprint)",
                    status = diagnostics.strongBiometricStatus,
                    isSuccess = diagnostics.canUseStrongBiometrics,
                    description = "Required for secure employee authentication"
                )
            }

            item {
                StatusCard(
                    title = "Weak Biometrics",
                    status = diagnostics.weakBiometricStatus,
                    isSuccess = diagnostics.canUseWeakBiometrics,
                    description = "Alternative biometric methods"
                )
            }

            item {
                StatusCard(
                    title = "Device Credential",
                    status = diagnostics.deviceCredentialStatus,
                    isSuccess = diagnostics.canUseDeviceCredential,
                    description = "PIN, pattern, or password authentication"
                )
            }

            if (diagnostics.recommendations.isNotEmpty()) {
                item {
                    Spacer(modifier = Modifier.height(16.dp))
                    Text(
                        text = "Recommendations",
                        style = MaterialTheme.typography.titleMedium,
                        color = Color.White,
                        fontWeight = FontWeight.Bold
                    )
                    Spacer(modifier = Modifier.height(8.dp))
                }

                items(diagnostics.recommendations) { recommendation ->
                    Card(
                        modifier = Modifier.fillMaxWidth(),
                        colors = CardDefaults.cardColors(
                            containerColor = Color.Blue.copy(alpha = 0.2f)
                        ),
                        shape = RoundedCornerShape(8.dp)
                    ) {
                        Row(
                            modifier = Modifier
                                .fillMaxWidth()
                                .padding(12.dp),
                            verticalAlignment = Alignment.CenterVertically
                        ) {
                            Icon(
                                Icons.Default.Info,
                                contentDescription = null,
                                tint = Color.Blue,
                                modifier = Modifier.size(16.dp)
                            )
                            Spacer(modifier = Modifier.width(8.dp))
                            Text(
                                text = recommendation,
                                style = MaterialTheme.typography.bodyMedium,
                                color = Color.White
                            )
                        }
                    }
                }
            }

            item {
                Spacer(modifier = Modifier.height(24.dp))
                
                // Troubleshooting Tips
                Card(
                    modifier = Modifier.fillMaxWidth(),
                    colors = CardDefaults.cardColors(
                        containerColor = Color.White.copy(alpha = 0.1f)
                    ),
                    shape = RoundedCornerShape(12.dp)
                ) {
                    Column(
                        modifier = Modifier.padding(16.dp)
                    ) {
                        Text(
                            text = "Common Solutions",
                            style = MaterialTheme.typography.titleMedium,
                            color = Color.White,
                            fontWeight = FontWeight.Bold
                        )
                        Spacer(modifier = Modifier.height(12.dp))
                        
                        val commonSolutions = listOf(
                            "Clean your finger and the fingerprint sensor",
                            "Make sure your finger is dry",
                            "Try using a different finger",
                            "Register multiple fingerprints in device settings",
                            "Restart the app and try again",
                            "Check for app updates in the Play Store",
                            "Restart your device if issues persist"
                        )
                        
                        commonSolutions.forEach { solution ->
                            Row(
                                modifier = Modifier.padding(vertical = 2.dp),
                                verticalAlignment = Alignment.CenterVertically
                            ) {
                                Text(
                                    text = "•",
                                    color = Color.White,
                                    style = MaterialTheme.typography.bodyMedium
                                )
                                Spacer(modifier = Modifier.width(8.dp))
                                Text(
                                    text = solution,
                                    color = Color.Gray,
                                    style = MaterialTheme.typography.bodyMedium
                                )
                            }
                        }
                    }
                }
            }
        }
    }
}

@Composable
fun StatusCard(
    title: String,
    status: String,
    isSuccess: Boolean,
    description: String
) {
    Card(
        modifier = Modifier.fillMaxWidth(),
        colors = CardDefaults.cardColors(
            containerColor = Color.White.copy(alpha = 0.1f)
        ),
        shape = RoundedCornerShape(8.dp)
    ) {
        Row(
            modifier = Modifier
                .fillMaxWidth()
                .padding(12.dp),
            verticalAlignment = Alignment.CenterVertically
        ) {
            Icon(
                if (isSuccess) Icons.Default.CheckCircle else Icons.Default.Clear,
                contentDescription = null,
                tint = if (isSuccess) Color.Green else Color.Red,
                modifier = Modifier.size(20.dp)
            )
            Spacer(modifier = Modifier.width(12.dp))
            Column(modifier = Modifier.weight(1f)) {
                Text(
                    text = title,
                    style = MaterialTheme.typography.bodyMedium,
                    color = Color.White,
                    fontWeight = FontWeight.Medium
                )
                Text(
                    text = description,
                    style = MaterialTheme.typography.bodySmall,
                    color = Color.Gray
                )
            }
            Text(
                text = status,
                style = MaterialTheme.typography.bodySmall,
                color = if (isSuccess) Color.Green else Color.Red,
                textAlign = TextAlign.End
            )
        }
    }
}