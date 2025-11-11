package com.example.clockinsystem.ui

import androidx.compose.foundation.layout.*
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
import android.Manifest
import android.content.pm.PackageManager
import androidx.core.content.ContextCompat

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun CameraDiagnosticScreen(
    onNavigateBack: () -> Unit
) {
    val context = LocalContext.current
    
    // Check camera permission status
    val hasPermission = ContextCompat.checkSelfPermission(
        context,
        Manifest.permission.CAMERA
    ) == PackageManager.PERMISSION_GRANTED
    
    Scaffold(
        topBar = {
            TopAppBar(
                title = { Text("Camera Diagnostic") },
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
                .padding(16.dp),
            horizontalAlignment = Alignment.CenterHorizontally
        ) {
            Card(
                modifier = Modifier.fillMaxWidth(),
                colors = CardDefaults.cardColors(
                    containerColor = if (hasPermission) Color.Green.copy(alpha = 0.1f) else Color.Red.copy(alpha = 0.1f)
                )
            ) {
                Column(modifier = Modifier.padding(16.dp)) {
                    Text(
                        text = "Camera System Status",
                        style = MaterialTheme.typography.headlineSmall,
                        fontWeight = FontWeight.Bold
                    )
                    Spacer(modifier = Modifier.height(16.dp))
                    
                    // Permission status
                    Row(
                        modifier = Modifier.fillMaxWidth(),
                        horizontalArrangement = Arrangement.SpaceBetween
                    ) {
                        Text("Camera Permission:")
                        Text(
                            text = if (hasPermission) "✅ GRANTED" else "❌ DENIED",
                            color = if (hasPermission) Color.Green else Color.Red,
                            fontWeight = FontWeight.Bold
                        )
                    }
                    
                    Spacer(modifier = Modifier.height(8.dp))
                    
                    // Face detection status
                    Row(
                        modifier = Modifier.fillMaxWidth(),
                        horizontalArrangement = Arrangement.SpaceBetween
                    ) {
                        Text("Face Detection:")
                        Text(
                            text = if (hasPermission) "🎥 READY" else "⚠️ NEEDS PERMISSION",
                            color = if (hasPermission) Color.Green else Color.Red,
                            fontWeight = FontWeight.Bold
                        )
                    }
                    
                    Spacer(modifier = Modifier.height(16.dp))
                    
                    if (!hasPermission) {
                        Text(
                            text = "❗ Camera permission is required for face detection to work. Please grant camera permission in your app settings and restart the app.",
                            color = Color.Red,
                            style = MaterialTheme.typography.bodyMedium
                        )
                    } else {
                        Text(
                            text = "✅ Camera system is ready! Face detection should work normally.",
                            color = Color.Green,
                            style = MaterialTheme.typography.bodyMedium
                        )
                    }
                }
            }
            
            Spacer(modifier = Modifier.height(24.dp))
            
            // Instructions
            Card(
                modifier = Modifier.fillMaxWidth(),
                colors = CardDefaults.cardColors(containerColor = Color.Blue.copy(alpha = 0.1f))
            ) {
                Column(modifier = Modifier.padding(16.dp)) {
                    Text(
                        text = "Troubleshooting Steps",
                        style = MaterialTheme.typography.headlineSmall,
                        fontWeight = FontWeight.Bold
                    )
                    Spacer(modifier = Modifier.height(8.dp))
                    
                    Text("1. Ensure camera permission is granted")
                    Text("2. Check that camera is not in use by another app")
                    Text("3. Try face detection with good lighting")
                    Text("4. Position face clearly in camera view")
                    Text("5. Use the Image Face Detection for testing")
                    
                    Spacer(modifier = Modifier.height(16.dp))
                    
                    Text(
                        text = "Enhanced Logging",
                        style = MaterialTheme.typography.titleMedium,
                        fontWeight = FontWeight.Bold
                    )
                    Text("The app now includes detailed logs:", style = MaterialTheme.typography.bodyMedium)
                    Text("• 'CameraSetup' - Camera binding status", style = MaterialTheme.typography.bodySmall)
                    Text("• 'ImageAnalyzer' - Image processing status", style = MaterialTheme.typography.bodySmall)
                    Text("• 'FaceDetection' - Face detection results", style = MaterialTheme.typography.bodySmall)
                    Text("• 'FaceRecognition' - Recognition matching", style = MaterialTheme.typography.bodySmall)
                }
            }
        }
    }
}