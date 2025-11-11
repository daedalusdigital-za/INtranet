package com.example.clockinsystem.ui

import android.graphics.Bitmap
import android.widget.Toast
import androidx.camera.core.ImageCapture
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
import androidx.fragment.app.FragmentActivity
import androidx.lifecycle.lifecycleScope
import kotlinx.coroutines.launch
import com.example.clockinsystem.fingerprint.FingerprintEnrollmentManager
import com.example.clockinsystem.ui.camera.PhotoSelectionComponent
import com.example.clockinsystem.auth.FacialRecognitionManager
import com.example.clockinsystem.data.ClockInRepository
import com.example.clockinsystem.model.Employee
import java.util.concurrent.ExecutorService

@Composable
fun EmployeeRegistrationScreen(
    cameraExecutor: ExecutorService,
    activity: FragmentActivity,
    clockInRepository: ClockInRepository,
    onBackPressed: () -> Unit,
    onEmployeeRegistered: () -> Unit
) {
    var employeeId by remember { mutableStateOf("") }
    var employeeName by remember { mutableStateOf("") }
    var department by remember { mutableStateOf("") }
    var capturedImage by remember { mutableStateOf<Bitmap?>(null) }
    var registrationStep by remember { mutableStateOf(1) } // 1: Info, 2: Photo, 3: Fingerprint
    var fingerprintTemplate by remember { mutableStateOf<String?>(null) }
    var isProcessing by remember { mutableStateOf(false) }
    
    val context = LocalContext.current
    val imageCapture = remember { ImageCapture.Builder().build() }

    Card(
        modifier = Modifier
            .fillMaxWidth()
            .padding(16.dp),
        elevation = CardDefaults.cardElevation(defaultElevation = 8.dp)
    ) {
        Column(
            modifier = Modifier
                .fillMaxWidth()
                .padding(24.dp),
            horizontalAlignment = Alignment.CenterHorizontally
        ) {
            Text(
                text = "Register New Employee",
                style = MaterialTheme.typography.headlineMedium,
                textAlign = TextAlign.Center
            )
            
            Spacer(modifier = Modifier.height(8.dp))
            
            Text(
                text = "Step $registrationStep of 3",
                style = MaterialTheme.typography.bodyMedium,
                color = MaterialTheme.colorScheme.onSurfaceVariant
            )

            Spacer(modifier = Modifier.height(24.dp))

            when (registrationStep) {
                1 -> {
                    // Employee Information Step
                    OutlinedTextField(
                        value = employeeId,
                        onValueChange = { employeeId = it },
                        label = { Text("Employee ID") },
                        modifier = Modifier.fillMaxWidth(),
                        singleLine = true
                    )

                    Spacer(modifier = Modifier.height(16.dp))

                    OutlinedTextField(
                        value = employeeName,
                        onValueChange = { employeeName = it },
                        label = { Text("Employee Name") },
                        modifier = Modifier.fillMaxWidth(),
                        singleLine = true
                    )

                    Spacer(modifier = Modifier.height(16.dp))

                    OutlinedTextField(
                        value = department,
                        onValueChange = { department = it },
                        label = { Text("Department") },
                        modifier = Modifier.fillMaxWidth(),
                        singleLine = true
                    )

                    Spacer(modifier = Modifier.height(24.dp))

                    Button(
                        onClick = { registrationStep = 2 },
                        modifier = Modifier.fillMaxWidth(),
                        enabled = employeeId.isNotEmpty() && employeeName.isNotEmpty()
                    ) {
                        Text("Next: Capture Photo")
                    }
                }

                2 -> {
                    // Photo Selection Step
                    Text(
                        text = "Add Reference Photo",
                        style = MaterialTheme.typography.titleMedium,
                        textAlign = TextAlign.Center
                    )

                    Spacer(modifier = Modifier.height(16.dp))

                    PhotoSelectionComponent(
                        onPhotoSelected = { bitmap ->
                            capturedImage = bitmap
                        },
                        onCancel = {
                            registrationStep = 1 // Go back to previous step
                        },
                        selectedPhoto = capturedImage
                    )

                    if (capturedImage != null) {
                        Spacer(modifier = Modifier.height(16.dp))
                        
                        Button(
                            onClick = { registrationStep = 3 },
                            modifier = Modifier.fillMaxWidth(),
                            colors = ButtonDefaults.buttonColors(containerColor = MaterialTheme.colorScheme.primary)
                        ) {
                            Text("Next: Fingerprint Registration")
                        }
                    }
                }

                3 -> {
                    // Fingerprint Registration Step
                    Text(
                        text = "Register Fingerprint",
                        style = MaterialTheme.typography.titleMedium,
                        textAlign = TextAlign.Center
                    )

                    Spacer(modifier = Modifier.height(16.dp))

                    Text(
                        text = "Please scan your fingerprint to complete registration",
                        style = MaterialTheme.typography.bodyMedium,
                        textAlign = TextAlign.Center,
                        color = MaterialTheme.colorScheme.onSurfaceVariant
                    )

                    Spacer(modifier = Modifier.height(24.dp))

                    // Enrollment progress tracking
                    var enrollmentProgress by remember { mutableStateOf("") }

                    // Create fingerprint enrollment manager with progress tracking
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
                            modifier = Modifier.padding(vertical = 8.dp)
                        )
                    }

                    // Show enrollment status
                    if (fingerprintTemplate != null) {
                        Card(
                            modifier = Modifier.fillMaxWidth(),
                            colors = CardDefaults.cardColors(
                                containerColor = MaterialTheme.colorScheme.primaryContainer
                            )
                        ) {
                            Text(
                                text = "✓ Fingerprint enrolled successfully (3 scans completed)",
                                modifier = Modifier.padding(16.dp),
                                color = MaterialTheme.colorScheme.onPrimaryContainer,
                                style = MaterialTheme.typography.bodyMedium
                            )
                        }
                        Spacer(modifier = Modifier.height(16.dp))
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
                        enabled = !isProcessing
                    ) {
                        if (isProcessing) {
                            CircularProgressIndicator(
                                modifier = Modifier.size(16.dp),
                                color = MaterialTheme.colorScheme.onPrimary
                            )
                            Spacer(modifier = Modifier.width(8.dp))
                            Text("Enrolling...")
                        } else {
                            Text(if (fingerprintTemplate != null) "Re-enroll Fingerprint" else "Enroll Fingerprint")
                        }
                    }

                    Spacer(modifier = Modifier.height(16.dp))

                    Button(
                        onClick = {
                            // Save employee with fingerprint template
                            activity.lifecycleScope.launch {
                                try {
                                    val imagePath = clockInRepository.saveReferenceImage(
                                        employeeId, 
                                        capturedImage ?: Bitmap.createBitmap(1, 1, Bitmap.Config.ARGB_8888)
                                    )
                                    val employee = Employee(
                                        id = employeeId,
                                        name = employeeName,
                                        referenceImagePath = imagePath,
                                        fingerprintTemplate = fingerprintTemplate
                                    )
                                    clockInRepository.saveEmployee(employee)
                                    Toast.makeText(
                                        context, 
                                        if (fingerprintTemplate != null) 
                                            "Employee registered with fingerprint!" 
                                        else 
                                            "Employee registered (no fingerprint)", 
                                        Toast.LENGTH_SHORT
                                    ).show()
                                    onEmployeeRegistered()
                                } catch (e: Exception) {
                                    Toast.makeText(context, "Registration failed: ${e.message}", Toast.LENGTH_SHORT).show()
                                }
                            }
                        },
                        modifier = Modifier.fillMaxWidth(),
                        colors = ButtonDefaults.buttonColors(
                            containerColor = MaterialTheme.colorScheme.secondary
                        ),
                        enabled = !isProcessing
                    ) {
                        Text("Complete Registration")
                    }
                }
            }

            Spacer(modifier = Modifier.height(24.dp))

            // Back/Cancel Button
            OutlinedButton(
                onClick = {
                    if (registrationStep > 1) {
                        registrationStep--
                    } else {
                        onBackPressed()
                    }
                },
                modifier = Modifier.fillMaxWidth()
            ) {
                Text(if (registrationStep > 1) "Back" else "Cancel")
            }
        }
    }
}
// Employee registration complete
