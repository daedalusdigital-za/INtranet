package com.example.clockinsystem.ui.camera

import android.content.Context
import android.graphics.Bitmap
import android.graphics.BitmapFactory
import android.net.Uri
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.foundation.Image
import androidx.compose.foundation.layout.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.asImageBitmap
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import java.io.InputStream

@Composable
fun PhotoSelectionComponent(
    onPhotoSelected: (Bitmap) -> Unit,
    onCancel: () -> Unit,
    selectedPhoto: Bitmap? = null
) {
    val context = LocalContext.current
    var showCameraCapture by remember { mutableStateOf(false) }
    
    // Photo picker launcher
    val photoPickerLauncher = rememberLauncherForActivityResult(
        contract = ActivityResultContracts.GetContent()
    ) { uri: Uri? ->
        uri?.let {
            val bitmap = loadBitmapFromUri(context, it)
            bitmap?.let { bmp ->
                onPhotoSelected(bmp)
            }
        }
    }

    if (showCameraCapture) {
        // Show camera capture interface
        CameraCapture(
            onImageCaptured = { bitmap ->
                onPhotoSelected(bitmap)
                showCameraCapture = false
            },
            onError = { error ->
                // Handle camera error
                showCameraCapture = false
            },
            onCancel = {
                showCameraCapture = false
            }
        )
    } else {
        // Show photo selection options
        Column(
            modifier = Modifier
                .fillMaxWidth()
                .padding(16.dp),
            horizontalAlignment = Alignment.CenterHorizontally
        ) {
            if (selectedPhoto != null) {
                // Show selected photo
                Text(
                    text = "Reference Photo Selected",
                    style = MaterialTheme.typography.titleMedium,
                    textAlign = TextAlign.Center,
                    color = Color.Black
                )
                
                Spacer(modifier = Modifier.height(16.dp))
                
                Card(
                    modifier = Modifier.size(200.dp),
                    elevation = CardDefaults.cardElevation(defaultElevation = 4.dp)
                ) {
                    Image(
                        bitmap = selectedPhoto.asImageBitmap(),
                        contentDescription = "Selected Reference Photo",
                        modifier = Modifier.fillMaxSize()
                    )
                }
                
                Spacer(modifier = Modifier.height(16.dp))
                
                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.spacedBy(8.dp)
                ) {
                    Button(
                        onClick = { showCameraCapture = true },
                        modifier = Modifier.weight(1f),
                        colors = ButtonDefaults.buttonColors(containerColor = Color(0xFF2196F3))
                    ) {
                        Text("Retake Photo")
                    }
                    
                    Button(
                        onClick = { photoPickerLauncher.launch("image/*") },
                        modifier = Modifier.weight(1f),
                        colors = ButtonDefaults.buttonColors(containerColor = Color(0xFF4CAF50))
                    ) {
                        Text("Choose Different")
                    }
                }
            } else {
                // Show selection options
                Text(
                    text = "Add Reference Photo",
                    style = MaterialTheme.typography.titleMedium,
                    textAlign = TextAlign.Center,
                    color = Color.Black
                )
                
                Spacer(modifier = Modifier.height(8.dp))
                
                Text(
                    text = "Choose how to add the employee's reference photo",
                    style = MaterialTheme.typography.bodyMedium,
                    textAlign = TextAlign.Center,
                    color = Color.Gray
                )
                
                Spacer(modifier = Modifier.height(24.dp))
                
                // Capture Photo Button
                Button(
                    onClick = { showCameraCapture = true },
                    modifier = Modifier
                        .fillMaxWidth()
                        .height(56.dp),
                    colors = ButtonDefaults.buttonColors(containerColor = Color(0xFF2196F3))
                ) {
                    Text(
                        text = "📷 Capture Photo",
                        style = MaterialTheme.typography.titleMedium
                    )
                }
                
                Spacer(modifier = Modifier.height(12.dp))
                
                // Upload Photo Button
                Button(
                    onClick = { photoPickerLauncher.launch("image/*") },
                    modifier = Modifier
                        .fillMaxWidth()
                        .height(56.dp),
                    colors = ButtonDefaults.buttonColors(containerColor = Color(0xFF4CAF50))
                ) {
                    Text(
                        text = "📁 Upload Photo",
                        style = MaterialTheme.typography.titleMedium
                    )
                }
            }
            
            Spacer(modifier = Modifier.height(16.dp))
            
            // Cancel Button
            OutlinedButton(
                onClick = onCancel,
                modifier = Modifier.fillMaxWidth()
            ) {
                Text("Cancel", color = Color.Red)
            }
        }
    }
}

private fun loadBitmapFromUri(context: Context, uri: Uri): Bitmap? {
    return try {
        val inputStream: InputStream? = context.contentResolver.openInputStream(uri)
        BitmapFactory.decodeStream(inputStream)
    } catch (e: Exception) {
        null
    }
}