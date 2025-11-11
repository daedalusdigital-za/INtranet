package com.example.clockinsystem.ui

import android.graphics.Bitmap
import android.graphics.BitmapFactory
import android.widget.Toast
import androidx.compose.foundation.Image
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
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
import androidx.compose.ui.unit.dp
import androidx.fragment.app.FragmentActivity
import androidx.lifecycle.lifecycleScope
import kotlinx.coroutines.launch
import com.example.clockinsystem.data.ClockInRepository
import com.example.clockinsystem.fingerprint.FingerprintEnrollmentManager
import com.example.clockinsystem.model.Employee
import com.example.clockinsystem.ui.camera.PhotoSelectionComponent
import java.io.File

@Composable
fun EmployeeEditScreen(
    employee: Employee,
    repository: ClockInRepository,
    activity: FragmentActivity,
    onNavigateBack: () -> Unit,
    onEmployeeUpdated: () -> Unit
) {
    var employeeName by remember { mutableStateOf(employee.name) }
    var employeeId by remember { mutableStateOf(employee.id) }
    var updatedPhoto by remember { mutableStateOf<Bitmap?>(null) }
    var fingerprintTemplate by remember { mutableStateOf(employee.fingerprintTemplate) }
    var isProcessing by remember { mutableStateOf(false) }
    var editStep by remember { mutableStateOf(1) } // 1: Info, 2: Photo, 3: Fingerprint
    var showDeletePhotoDialog by remember { mutableStateOf(false) }
    var showDeleteFingerprintDialog by remember { mutableStateOf(false) }
    
    val context = LocalContext.current
    val scrollState = rememberScrollState()

    // Load current employee photo
    val currentPhoto = remember(employee.referenceImagePath) {
        try {
            val file = File(employee.referenceImagePath)
            if (file.exists()) {
                BitmapFactory.decodeFile(file.absolutePath)
            } else null
        } catch (e: Exception) {
            null
        }
    }

    Column(
        modifier = Modifier
            .fillMaxSize()
            .background(Color.Black)
            .padding(16.dp)
            .verticalScroll(scrollState)
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
                text = "Edit Employee",
                style = MaterialTheme.typography.headlineMedium,
                color = Color.White,
                fontWeight = FontWeight.Bold
            )
            
            // Save Button
            IconButton(
                onClick = {
                    activity.lifecycleScope.launch {
                        isProcessing = true
                        try {
                            val imagePath = if (updatedPhoto != null) {
                                repository.saveReferenceImage(employeeId, updatedPhoto!!)
                            } else {
                                employee.referenceImagePath
                            }
                            
                            val updatedEmployee = employee.copy(
                                id = employeeId,
                                name = employeeName,
                                referenceImagePath = imagePath,
                                fingerprintTemplate = fingerprintTemplate
                            )
                            
                            repository.updateEmployee(updatedEmployee)
                            Toast.makeText(context, "Employee updated successfully", Toast.LENGTH_SHORT).show()
                            onEmployeeUpdated()
                        } catch (e: Exception) {
                            Toast.makeText(context, "Failed to update employee: ${e.message}", Toast.LENGTH_LONG).show()
                        } finally {
                            isProcessing = false
                        }
                    }
                },
                enabled = !isProcessing && employeeName.isNotBlank() && employeeId.isNotBlank()
            ) {
                if (isProcessing) {
                    CircularProgressIndicator(
                        modifier = Modifier.size(20.dp),
                        color = Color.White
                    )
                } else {
                    Icon(
                        Icons.Default.Done,
                        contentDescription = "Save",
                        tint = Color.White
                    )
                }
            }
        }

        Spacer(modifier = Modifier.height(24.dp))

        // Step Indicator
        Row(
            modifier = Modifier.fillMaxWidth(),
            horizontalArrangement = Arrangement.SpaceEvenly
        ) {
            repeat(3) { index ->
                val stepNumber = index + 1
                val isActive = editStep == stepNumber
                val isCompleted = editStep > stepNumber
                
                Box(
                    modifier = Modifier
                        .size(40.dp)
                        .background(
                            color = when {
                                isActive -> Color.White
                                isCompleted -> Color.Green
                                else -> Color.Gray
                            },
                            shape = CircleShape
                        ),
                    contentAlignment = Alignment.Center
                ) {
                    if (isCompleted) {
                        Icon(
                            Icons.Default.Check,
                            contentDescription = null,
                            tint = Color.White,
                            modifier = Modifier.size(20.dp)
                        )
                    } else {
                        Text(
                            text = stepNumber.toString(),
                            color = if (isActive) Color.Black else Color.White,
                            style = MaterialTheme.typography.bodyMedium,
                            fontWeight = FontWeight.Bold
                        )
                    }
                }
            }
        }

        Spacer(modifier = Modifier.height(32.dp))

        // Step Content
        Card(
            modifier = Modifier.fillMaxWidth(),
            colors = CardDefaults.cardColors(containerColor = Color.White.copy(alpha = 0.1f)),
            shape = RoundedCornerShape(16.dp)
        ) {
            Column(
                modifier = Modifier.padding(24.dp),
                horizontalAlignment = Alignment.CenterHorizontally
            ) {
                when (editStep) {
                    1 -> {
                        // Employee Information Step
                        Text(
                            text = "Edit Employee Information",
                            style = MaterialTheme.typography.titleLarge,
                            color = Color.White,
                            textAlign = TextAlign.Center
                        )

                        Spacer(modifier = Modifier.height(24.dp))

                        OutlinedTextField(
                            value = employeeId,
                            onValueChange = { employeeId = it },
                            label = { Text("Employee ID", color = Color.White) },
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

                        OutlinedTextField(
                            value = employeeName,
                            onValueChange = { employeeName = it },
                            label = { Text("Employee Name", color = Color.White) },
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

                        Spacer(modifier = Modifier.height(24.dp))

                        Button(
                            onClick = { editStep = 2 },
                            modifier = Modifier.fillMaxWidth(),
                            enabled = employeeId.isNotEmpty() && employeeName.isNotEmpty(),
                            colors = ButtonDefaults.buttonColors(containerColor = Color.White)
                        ) {
                            Text("Next: Update Photo", color = Color.Black)
                        }
                    }

                    2 -> {
                        // Photo Update Step
                        Text(
                            text = "Update Reference Photo",
                            style = MaterialTheme.typography.titleLarge,
                            color = Color.White,
                            textAlign = TextAlign.Center
                        )

                        Spacer(modifier = Modifier.height(16.dp))

                        // Current Photo
                        Text(
                            text = "Current Photo:",
                            style = MaterialTheme.typography.bodyMedium,
                            color = Color.Gray
                        )

                        Spacer(modifier = Modifier.height(8.dp))

                        if (currentPhoto != null) {
                            Image(
                                bitmap = currentPhoto.asImageBitmap(),
                                contentDescription = "Current Photo",
                                modifier = Modifier
                                    .size(100.dp)
                                    .clip(CircleShape),
                                contentScale = ContentScale.Crop
                            )

                            Spacer(modifier = Modifier.height(8.dp))

                            TextButton(onClick = { showDeletePhotoDialog = true }) {
                                Text("Remove Current Photo", color = Color.Red)
                            }
                        } else {
                            Box(
                                modifier = Modifier
                                    .size(100.dp)
                                    .clip(CircleShape)
                                    .background(Color.Gray),
                                contentAlignment = Alignment.Center
                            ) {
                                Icon(
                                    Icons.Default.Person,
                                    contentDescription = "No Photo",
                                    tint = Color.White,
                                    modifier = Modifier.size(50.dp)
                                )
                            }
                        }

                        Spacer(modifier = Modifier.height(16.dp))

                        // New Photo Selection
                        PhotoSelectionComponent(
                            onPhotoSelected = { bitmap ->
                                updatedPhoto = bitmap
                            },
                            onCancel = {
                                updatedPhoto = null
                            },
                            selectedPhoto = updatedPhoto
                        )

                        Spacer(modifier = Modifier.height(24.dp))

                        Button(
                            onClick = { editStep = 3 },
                            modifier = Modifier.fillMaxWidth(),
                            colors = ButtonDefaults.buttonColors(containerColor = Color.White)
                        ) {
                            Text("Next: Update Fingerprint", color = Color.Black)
                        }
                    }

                    3 -> {
                        // Fingerprint Update Step
                        Text(
                            text = "Update Fingerprint",
                            style = MaterialTheme.typography.titleLarge,
                            color = Color.White,
                            textAlign = TextAlign.Center
                        )

                        Spacer(modifier = Modifier.height(16.dp))

                        // Current Fingerprint Status
                        Card(
                            modifier = Modifier.fillMaxWidth(),
                            colors = CardDefaults.cardColors(
                                containerColor = if (fingerprintTemplate != null) 
                                    Color.Green.copy(alpha = 0.2f) 
                                else 
                                    Color.Red.copy(alpha = 0.2f)
                            )
                        ) {
                            Row(
                                modifier = Modifier.padding(16.dp),
                                verticalAlignment = Alignment.CenterVertically
                            ) {
                                Icon(
                                    Icons.Default.Lock,
                                    contentDescription = null,
                                    tint = if (fingerprintTemplate != null) Color.Green else Color.Red,
                                    modifier = Modifier.size(24.dp)
                                )
                                Spacer(modifier = Modifier.width(8.dp))
                                Text(
                                    text = if (fingerprintTemplate != null) 
                                        "Fingerprint is enrolled" 
                                    else 
                                        "No fingerprint enrolled",
                                    color = Color.White,
                                    style = MaterialTheme.typography.bodyMedium
                                )
                            }
                        }

                        Spacer(modifier = Modifier.height(16.dp))

                        // Fingerprint Enrollment Manager with progress tracking
                        var enrollmentProgress by remember { mutableStateOf("") }
                        
                        val fingerprintEnrollmentManager = remember {
                            FingerprintEnrollmentManager(
                                context = activity,
                                onEnrollmentSuccess = { template ->
                                    fingerprintTemplate = template
                                    enrollmentProgress = ""
                                    Toast.makeText(context, "Fingerprint enrolled successfully with 3 scans!", Toast.LENGTH_SHORT).show()
                                    isProcessing = false
                                },
                                onEnrollmentError = { error ->
                                    isProcessing = false
                                    enrollmentProgress = ""
                                    Toast.makeText(context, "Fingerprint enrollment error: $error", Toast.LENGTH_LONG).show()
                                },
                                onEnrollmentCancelled = {
                                    isProcessing = false
                                    enrollmentProgress = ""
                                    Toast.makeText(context, "Fingerprint enrollment cancelled", Toast.LENGTH_SHORT).show()
                                },
                                onEnrollmentProgress = { scanCount, totalScans ->
                                    enrollmentProgress = "Scan $scanCount of $totalScans completed"
                                }
                            )
                        }

                        // Show enrollment progress
                        if (enrollmentProgress.isNotEmpty()) {
                            Text(
                                text = enrollmentProgress,
                                color = Color.Blue,
                                style = MaterialTheme.typography.bodySmall,
                                modifier = Modifier.padding(vertical = 4.dp)
                            )
                        }

                        Button(
                            onClick = {
                                if (fingerprintEnrollmentManager.canEnrollFingerprint()) {
                                    isProcessing = true
                                    enrollmentProgress = "Starting fingerprint enrollment..."
                                    // Use the enhanced multi-scan enrollment
                                    fingerprintEnrollmentManager.enrollFingerprintMultiScan(activity, employeeName)
                                } else {
                                    Toast.makeText(
                                        context, 
                                        "Fingerprint enrollment not available: ${fingerprintEnrollmentManager.getBiometricStatus()}", 
                                        Toast.LENGTH_LONG
                                    ).show()
                                }
                            },
                            modifier = Modifier.fillMaxWidth(),
                            enabled = !isProcessing,
                            colors = ButtonDefaults.buttonColors(containerColor = Color.White)
                        ) {
                            if (isProcessing) {
                                CircularProgressIndicator(
                                    modifier = Modifier.size(16.dp),
                                    color = Color.Black
                                )
                                Spacer(modifier = Modifier.width(8.dp))
                                Text("Enrolling...", color = Color.Black)
                            } else {
                                Text(
                                    if (fingerprintTemplate != null) "Re-enroll Fingerprint" else "Enroll Fingerprint",
                                    color = Color.Black
                                )
                            }
                        }

                        if (fingerprintTemplate != null) {
                            Spacer(modifier = Modifier.height(8.dp))
                            
                            TextButton(
                                onClick = { showDeleteFingerprintDialog = true },
                                enabled = !isProcessing
                            ) {
                                Text("Remove Fingerprint", color = Color.Red)
                            }
                        }
                    }
                }
            }
        }

        Spacer(modifier = Modifier.height(24.dp))

        // Navigation Buttons
        Row(
            modifier = Modifier.fillMaxWidth(),
            horizontalArrangement = Arrangement.SpaceBetween
        ) {
            if (editStep > 1) {
                OutlinedButton(
                    onClick = { editStep-- },
                    colors = ButtonDefaults.outlinedButtonColors(contentColor = Color.White)
                ) {
                    Text("Previous")
                }
            } else {
                Spacer(modifier = Modifier.width(1.dp))
            }

            OutlinedButton(
                onClick = onNavigateBack,
                colors = ButtonDefaults.outlinedButtonColors(contentColor = Color.White)
            ) {
                Text("Cancel")
            }
        }
    }

    // Delete Photo Confirmation Dialog
    if (showDeletePhotoDialog) {
        AlertDialog(
            onDismissRequest = { showDeletePhotoDialog = false },
            title = { Text("Remove Photo") },
            text = { Text("Are you sure you want to remove the current photo?") },
            confirmButton = {
                Button(
                    onClick = {
                        // Set updated photo to a placeholder or null
                        updatedPhoto = Bitmap.createBitmap(1, 1, Bitmap.Config.ARGB_8888)
                        showDeletePhotoDialog = false
                        Toast.makeText(context, "Photo will be removed when you save", Toast.LENGTH_SHORT).show()
                    },
                    colors = ButtonDefaults.buttonColors(containerColor = MaterialTheme.colorScheme.error)
                ) {
                    Text("Remove")
                }
            },
            dismissButton = {
                TextButton(onClick = { showDeletePhotoDialog = false }) {
                    Text("Cancel")
                }
            }
        )
    }

    // Delete Fingerprint Confirmation Dialog
    if (showDeleteFingerprintDialog) {
        AlertDialog(
            onDismissRequest = { showDeleteFingerprintDialog = false },
            title = { Text("Remove Fingerprint") },
            text = { Text("Are you sure you want to remove the enrolled fingerprint?") },
            confirmButton = {
                Button(
                    onClick = {
                        fingerprintTemplate = null
                        showDeleteFingerprintDialog = false
                        Toast.makeText(context, "Fingerprint removed", Toast.LENGTH_SHORT).show()
                    },
                    colors = ButtonDefaults.buttonColors(containerColor = MaterialTheme.colorScheme.error)
                ) {
                    Text("Remove")
                }
            },
            dismissButton = {
                TextButton(onClick = { showDeleteFingerprintDialog = false }) {
                    Text("Cancel")
                }
            }
        )
    }
}