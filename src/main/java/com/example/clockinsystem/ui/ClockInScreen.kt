package com.example.clockinsystem.ui

import android.content.Context
import android.content.ContextWrapper
import android.graphics.Bitmap
import android.graphics.BitmapFactory
import androidx.activity.ComponentActivity
import androidx.compose.foundation.layout.*
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
import androidx.compose.ui.res.painterResource
import androidx.compose.foundation.Image
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.OutlinedTextFieldDefaults
import androidx.fragment.app.FragmentActivity
import com.example.clockinsystem.auth.FacialRecognitionManager
import com.example.clockinsystem.auth.FingerprintMatchingManager
import com.example.clockinsystem.data.AppDatabase
import com.example.clockinsystem.data.ClockInRepository
import com.example.clockinsystem.model.Employee
import com.example.clockinsystem.ui.camera.ContinuousFaceDetection
import com.example.clockinsystem.ui.camera.EnhancedContinuousFaceDetection
import com.example.clockinsystem.ui.fingerprint.ContinuousFingerprintDetection
import com.example.clockinsystem.ml.EnhancedFaceRecognitionManager
import com.example.clockinsystem.R
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext

enum class ClockInState {
    READY,
    REALTIME_FACE_DETECTION,
    CONTINUOUS_FINGERPRINT_DETECTION,
    IDENTIFIED,
    FINGERPRINT_AUTHENTICATION,
    FINGERPRINT_ONLY_MODE,
    EMPLOYEE_SELECTION_FOR_FINGERPRINT,
    PROCESSING,
    SUCCESS,
    ERROR
}

@Composable
fun ClockInScreen(
    onNavigateBack: () -> Unit
) {
    val context = LocalContext.current
    val scope = rememberCoroutineScope()
    
    var currentState by remember { mutableStateOf(ClockInState.READY) }
    var statusMessage by remember { mutableStateOf("Welcome! Please authenticate to clock in/out") }
    var identifiedEmployee by remember { mutableStateOf<Employee?>(null) }
    var errorMessage by remember { mutableStateOf<String?>(null) }

    // Initialize database and repository
    val database = remember { AppDatabase.getDatabase(context) }
    val repository = remember { 
        ClockInRepository(database.clockInDao(), database.employeeDao(), database.faceEmbeddingDao(), context) 
    }

    // Initialize enhanced face recognition with FaceNet
    val enhancedFaceRecognition = remember { 
        EnhancedFaceRecognitionManager(context, repository)
    }
    
    // Initialize FaceNet model on startup
    LaunchedEffect(Unit) {
        val modelLoaded = enhancedFaceRecognition.initializeModel()
        if (!modelLoaded) {
            statusMessage = "Warning: Advanced face recognition unavailable"
        }
    }

    // Get all employees for employee selection
    var allEmployees by remember { mutableStateOf<List<Employee>>(emptyList()) }
    
    // Load employees on component creation
    LaunchedEffect(Unit) {
        allEmployees = repository.getAllEmployees()
        
        // Auto-register faces for employees with photos but no embeddings
        scope.launch {
            for (employee in allEmployees) {
                if (!employee.referenceImagePath.isNullOrEmpty()) {
                    val existingEmbedding = repository.getFaceEmbeddingByEmployeeId(employee.id)
                    if (existingEmbedding == null) {
                        val registered = enhancedFaceRecognition.registerEmployeeFace(employee)
                        if (registered) {
                            statusMessage = "Registered face for ${employee.name}"
                        }
                    }
                }
            }
        }
    }

    val facialRecognitionManager = remember { FacialRecognitionManager(context) }

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
                text = "Employee Clock-In System",
                style = MaterialTheme.typography.headlineLarge,
                textAlign = TextAlign.Center,
                color = Color.White
            )

            Spacer(modifier = Modifier.height(16.dp))

            Text(
                text = statusMessage,
                style = MaterialTheme.typography.bodyLarge,
                textAlign = TextAlign.Center,
                color = Color.White,
                modifier = Modifier.padding(bottom = 24.dp)
            )

        when (currentState) {
            ClockInState.READY -> {
                ReadyStateUI(
                    onStartFaceDetection = {
                        currentState = ClockInState.REALTIME_FACE_DETECTION
                        statusMessage = "Please look at the camera for face recognition"
                    },
                    onStartFingerprintOnly = {
                        currentState = ClockInState.CONTINUOUS_FINGERPRINT_DETECTION
                        statusMessage = "Place your finger on the sensor for continuous scanning"
                    }
                )
            }

            ClockInState.EMPLOYEE_SELECTION_FOR_FINGERPRINT -> {
                SimpleEmployeeSelector(
                    employees = allEmployees,
                    onEmployeeSelected = { employee ->
                        identifiedEmployee = employee
                        currentState = ClockInState.FINGERPRINT_ONLY_MODE
                        statusMessage = "Place your finger on the sensor to verify identity"
                    },
                    onBackPressed = {
                        currentState = ClockInState.READY
                        statusMessage = "Welcome! Please choose an authentication method"
                    }
                )
            }

            ClockInState.FINGERPRINT_ONLY_MODE -> {
                identifiedEmployee?.let { employee ->
                    FingerprintAuthenticationUI(
                        employee = employee,
                        onAuthenticated = { authenticatedEmployee ->
                            scope.launch {
                                handleEmployeeAuthenticated(repository, authenticatedEmployee) { emp, state, message ->
                                    identifiedEmployee = emp
                                    currentState = state
                                    statusMessage = message
                                }
                            }
                        },
                        onError = { error ->
                            errorMessage = error
                            currentState = ClockInState.ERROR
                            statusMessage = "Fingerprint authentication failed: $error"
                        },
                        onBackPressed = {
                            currentState = ClockInState.EMPLOYEE_SELECTION_FOR_FINGERPRINT
                            statusMessage = "Select an employee for fingerprint authentication"
                            identifiedEmployee = null
                        }
                    )
                }
            }

            ClockInState.REALTIME_FACE_DETECTION -> {
                EnhancedContinuousFaceDetection(
                    enhancedFaceRecognition = enhancedFaceRecognition,
                    allEmployees = allEmployees,
                    onFaceRecognized = { employee, confidence ->
                        identifiedEmployee = employee
                        currentState = ClockInState.IDENTIFIED
                        statusMessage = "Employee ${employee.name} identified! (${(confidence * 100).toInt()}% confidence)"
                    },
                    onError = { error ->
                        errorMessage = error
                        currentState = ClockInState.ERROR
                        statusMessage = "Face detection error: $error"
                    },
                    onNavigateBack = {
                        currentState = ClockInState.READY
                        statusMessage = "Welcome! Please authenticate to clock in/out"
                    }
                )
            }

            ClockInState.CONTINUOUS_FINGERPRINT_DETECTION -> {
                ContinuousFingerprintDetection(
                    onEmployeeRecognized = { employeeId, employeeName ->
                        // Find the employee by ID
                        val employee = allEmployees.find { it.id == employeeId }
                        if (employee != null) {
                            scope.launch {
                                handleEmployeeAuthenticated(repository, employee) { emp, state, message ->
                                    identifiedEmployee = emp
                                    currentState = state
                                    statusMessage = message
                                }
                            }
                        } else {
                            errorMessage = "Employee not found"
                            currentState = ClockInState.ERROR
                            statusMessage = "Fingerprint recognition error: Employee not found"
                        }
                    },
                    onError = { error ->
                        errorMessage = error
                        currentState = ClockInState.ERROR
                        statusMessage = "Fingerprint detection error: $error"
                    },
                    onNavigateBack = {
                        currentState = ClockInState.READY
                        statusMessage = "Welcome! Please authenticate to clock in/out"
                    },
                    allEmployees = allEmployees
                )
            }

            ClockInState.IDENTIFIED -> {
                identifiedEmployee?.let { employee ->
                    Column(
                        horizontalAlignment = Alignment.CenterHorizontally
                    ) {
                        Text(
                            text = "Employee Identified: ${employee.name}",
                            style = MaterialTheme.typography.headlineSmall,
                            color = Color.White,
                            modifier = Modifier.padding(bottom = 16.dp)
                        )
                        
                        Button(
                            onClick = {
                                currentState = ClockInState.FINGERPRINT_AUTHENTICATION
                                statusMessage = "Please place your finger on the sensor"
                            }
                        ) {
                            Text("Verify with Fingerprint")
                        }
                        
                        Button(
                            onClick = {
                                currentState = ClockInState.READY
                                identifiedEmployee = null
                                statusMessage = "Welcome! Please authenticate to clock in/out"
                            },
                            colors = ButtonDefaults.buttonColors(containerColor = Color.Gray)
                        ) {
                            Text("Cancel")
                        }
                    }
                }
            }

            ClockInState.FINGERPRINT_AUTHENTICATION -> {
                identifiedEmployee?.let { employee ->
                    FingerprintAuthenticationUI(
                        employee = employee,
                        onAuthenticated = { authenticatedEmployee ->
                            scope.launch {
                                handleEmployeeAuthenticated(repository, authenticatedEmployee) { emp, state, message ->
                                    identifiedEmployee = emp
                                    currentState = state
                                    statusMessage = message
                                }
                            }
                        },
                        onError = { error ->
                            errorMessage = error
                            currentState = ClockInState.ERROR
                            statusMessage = "Fingerprint authentication failed: $error"
                        },
                        onBackPressed = {
                            currentState = ClockInState.IDENTIFIED
                            statusMessage = "Employee ${employee.name} identified! Please verify with fingerprint"
                        }
                    )
                }
            }

            ClockInState.PROCESSING -> {
                CircularProgressIndicator(color = Color.White, modifier = Modifier.padding(16.dp))
                Text("Processing clock in/out...", color = Color.White)
            }

            ClockInState.SUCCESS -> {
                Column(
                    horizontalAlignment = Alignment.CenterHorizontally
                ) {
                    Icon(
                        Icons.Default.CheckCircle,
                        contentDescription = null,
                        tint = Color.Green,
                        modifier = Modifier.size(64.dp)
                    )
                    
                    Spacer(modifier = Modifier.height(16.dp))
                    
                    Text(
                        text = "✓ Success!",
                        style = MaterialTheme.typography.headlineMedium,
                        color = Color.Green
                    )
                    
                    Text(
                        text = statusMessage,
                        style = MaterialTheme.typography.bodyLarge,
                        color = Color.White,
                        textAlign = TextAlign.Center
                    )
                    
                    Spacer(modifier = Modifier.height(16.dp))
                    
                    Text(
                        text = "Ready for next employee...",
                        style = MaterialTheme.typography.bodyMedium,
                        color = Color.Gray,
                        textAlign = TextAlign.Center
                    )
                }
                
                // Auto-return to ready after showing success
                LaunchedEffect(currentState) {
                    if (currentState == ClockInState.SUCCESS) {
                        kotlinx.coroutines.delay(2000)
                        currentState = ClockInState.READY
                        statusMessage = "Welcome! Please choose an authentication method"
                    }
                }
            }

            ClockInState.ERROR -> {
                Text(
                    text = "❌ Error",
                    style = MaterialTheme.typography.headlineMedium,
                    color = Color.Red
                )
                
                errorMessage?.let { message ->
                    Text(
                        text = message,
                        style = MaterialTheme.typography.bodyMedium,
                        color = Color.White,
                        textAlign = TextAlign.Center,
                        modifier = Modifier.padding(16.dp)
                    )
                }
                
                Spacer(modifier = Modifier.height(16.dp))
                
                Button(
                    onClick = {
                        currentState = ClockInState.READY
                        statusMessage = "Welcome! Please authenticate to clock in/out"
                        errorMessage = null
                    },
                    colors = ButtonDefaults.buttonColors(containerColor = Color.White)
                ) {
                    Text("Try Again", color = Color.Black)
                }
            }
        }

        Spacer(modifier = Modifier.height(24.dp))

        Button(
            onClick = onNavigateBack,
            colors = ButtonDefaults.buttonColors(containerColor = Color.White.copy(alpha = 0.9f))
        ) {
            Text("Back to Main Menu", color = Color.Black)
        }
        }
    }
}

@Composable
fun IdentifiedEmployeeUI(
    employee: Employee,
    onClockIn: () -> Unit,
    onClockOut: () -> Unit,
    onCancel: () -> Unit
) {
    Column(
        horizontalAlignment = Alignment.CenterHorizontally,
        verticalArrangement = Arrangement.spacedBy(16.dp)
    ) {
        Text(
            text = "Welcome, ${employee.name}!",
            style = MaterialTheme.typography.headlineSmall,
            textAlign = TextAlign.Center,
            color = Color.White
        )

        Text(
            text = "Employee ID: ${employee.id}",
            style = MaterialTheme.typography.bodyMedium,
            textAlign = TextAlign.Center,
            color = Color.White.copy(alpha = 0.8f)
        )

        Row(
            modifier = Modifier.fillMaxWidth(),
            horizontalArrangement = Arrangement.spacedBy(8.dp)
        ) {
            Button(
                onClick = onClockIn,
                modifier = Modifier.weight(1f),
                colors = ButtonDefaults.buttonColors(containerColor = Color.Green)
            ) {
                Text("Clock In")
            }

            Button(
                onClick = onClockOut,
                modifier = Modifier.weight(1f),
                colors = ButtonDefaults.buttonColors(containerColor = Color.Red)
            ) {
                Text("Clock Out")
            }
        }

        Button(
            onClick = onCancel,
            modifier = Modifier.fillMaxWidth(),
            colors = ButtonDefaults.buttonColors(containerColor = Color.White.copy(alpha = 0.9f))
        ) {
            Text("Cancel", color = Color.Black)
        }
    }
}

// Helper function to handle employee authentication
suspend fun handleEmployeeAuthenticated(
    repository: ClockInRepository,
    employee: Employee,
    onResult: (Employee?, ClockInState, String) -> Unit
) {
    withContext(Dispatchers.IO) {
        try {
            // Employee has been authenticated, proceed with clock in/out
            withContext(Dispatchers.Main) {
                onResult(employee, ClockInState.SUCCESS, "Welcome, ${employee.name}!")
            }
        } catch (e: Exception) {
            withContext(Dispatchers.Main) {
                onResult(null, ClockInState.ERROR, "Authentication error: ${e.message}")
            }
        }
    }
}

// Helper function to handle real face capture and recognition
suspend fun handleRealFaceRecognition(
    repository: ClockInRepository,
    facialRecognitionManager: FacialRecognitionManager,
    capturedBitmap: Bitmap,
    onResult: (Employee?, ClockInState, String) -> Unit
) {
    withContext(Dispatchers.IO) {
        try {
            val employees = repository.getAllEmployees()
            if (employees.isEmpty()) {
                withContext(Dispatchers.Main) {
                    onResult(null, ClockInState.ERROR, "No employees registered in system")
                }
                return@withContext
            }

            // Try to match the captured face against each employee's reference image
            var matchedEmployee: Employee? = null
            
            for (employee in employees) {
                val referenceImage = repository.getReferenceImage(employee.id)
                if (referenceImage != null) {
                    // Use the real FacialRecognitionManager to compare faces
                    var recognitionComplete = false
                    var recognitionSuccess = false
                    
                    facialRecognitionManager.recognizeFace(
                        cameraBitmap = capturedBitmap,
                        referenceImage = referenceImage,
                        isClockIn = true,
                        onSuccess = { _ ->
                            recognitionSuccess = true
                            recognitionComplete = true
                        },
                        onFailure = {
                            recognitionComplete = true
                        }
                    )
                    
                    // Wait for recognition to complete (simple busy wait)
                    while (!recognitionComplete) {
                        kotlinx.coroutines.delay(100)
                    }
                    
                    if (recognitionSuccess) {
                        matchedEmployee = employee
                        break
                    }
                }
            }
            
            withContext(Dispatchers.Main) {
                if (matchedEmployee != null) {
                    onResult(matchedEmployee, ClockInState.SUCCESS, "Welcome, ${matchedEmployee.name}!")
                } else {
                    onResult(null, ClockInState.ERROR, "Face not recognized. Please try again or register first.")
                }
            }
        } catch (e: Exception) {
            withContext(Dispatchers.Main) {
                onResult(null, ClockInState.ERROR, "Face recognition error: ${e.message}")
            }
        }
    }
}

// Helper function to find the Activity from Context
fun Context.findActivity(): FragmentActivity? {
    var context = this
    while (context is ContextWrapper) {
        if (context is FragmentActivity) return context
        context = context.baseContext
    }
    return null
}

@Composable
fun ReadyStateUI(
    onStartFaceDetection: () -> Unit,
    onStartFingerprintOnly: () -> Unit
) {
    Column(
        horizontalAlignment = Alignment.CenterHorizontally,
        verticalArrangement = Arrangement.spacedBy(24.dp)
    ) {
        Icon(
            Icons.Default.Face,
            contentDescription = "Biometric Authentication",
            modifier = Modifier.size(120.dp),
            tint = Color.White
        )
        
        Text(
            text = "Choose Authentication Method",
            style = MaterialTheme.typography.headlineSmall,
            textAlign = TextAlign.Center,
            color = Color.White,
            fontWeight = FontWeight.Bold
        )
        
        Text(
            text = "Select your preferred way to clock in/out",
            style = MaterialTheme.typography.bodyLarge,
            textAlign = TextAlign.Center,
            color = Color.White.copy(alpha = 0.8f)
        )
        
        // Face Recognition Button
        Button(
            onClick = onStartFaceDetection,
            modifier = Modifier
                .fillMaxWidth()
                .height(60.dp),
            colors = ButtonDefaults.buttonColors(
                containerColor = Color.Blue
            )
        ) {
            Row(
                horizontalArrangement = Arrangement.spacedBy(8.dp),
                verticalAlignment = Alignment.CenterVertically
            ) {
                Icon(
                    Icons.Default.Face,
                    contentDescription = null,
                    tint = Color.White
                )
                Text(
                    text = "Face Recognition",
                    style = MaterialTheme.typography.titleMedium,
                    color = Color.White
                )
            }
        }
        
        // Fingerprint Only Button
        Button(
            onClick = onStartFingerprintOnly,
            modifier = Modifier
                .fillMaxWidth()
                .height(60.dp),
            colors = ButtonDefaults.buttonColors(
                containerColor = Color.Green
            )
        ) {
            Row(
                horizontalArrangement = Arrangement.spacedBy(8.dp),
                verticalAlignment = Alignment.CenterVertically
            ) {
                Icon(
                    Icons.Default.Lock,
                    contentDescription = null,
                    tint = Color.White
                )
                Text(
                    text = "Fingerprint Only",
                    style = MaterialTheme.typography.titleMedium,
                    color = Color.White
                )
            }
        }
        
        Spacer(modifier = Modifier.height(8.dp))
        
        // Info text
        Card(
            modifier = Modifier.fillMaxWidth(),
            colors = CardDefaults.cardColors(
                containerColor = Color.White.copy(alpha = 0.1f)
            )
        ) {
            Text(
                text = "💡 Face Recognition: Camera detects and verifies with fingerprint\n🔒 Fingerprint Only: Direct fingerprint authentication",
                modifier = Modifier.padding(16.dp),
                color = Color.White,
                style = MaterialTheme.typography.bodyMedium,
                textAlign = TextAlign.Center
            )
        }
    }
}

@Composable
fun FingerprintAuthenticationUI(
    employee: Employee,
    onAuthenticated: (Employee) -> Unit,
    onError: (String) -> Unit,
    onBackPressed: () -> Unit
) {
    val context = LocalContext.current
    val fingerprintManager = remember { FingerprintMatchingManager(context) }
    var isScanning by remember { mutableStateOf(false) }
    var statusMessage by remember { mutableStateOf("Please place your finger on the sensor") }
    
    LaunchedEffect(Unit) {
        isScanning = true
        statusMessage = "Scanning fingerprint..."
        
        // Simulate fingerprint scanning process
        kotlinx.coroutines.delay(2000)
        
        try {
            val isMatch = fingerprintManager.authenticateEmployee(employee)
            if (isMatch) {
                statusMessage = "Fingerprint verified successfully!"
                kotlinx.coroutines.delay(1000)
                onAuthenticated(employee)
            } else {
                onError("Fingerprint does not match registered fingerprint for ${employee.name}")
            }
        } catch (e: Exception) {
            onError("Fingerprint authentication error: ${e.message}")
        }
        isScanning = false
    }
    
    Column(
        horizontalAlignment = Alignment.CenterHorizontally,
        verticalArrangement = Arrangement.spacedBy(24.dp),
        modifier = Modifier.fillMaxWidth()
    ) {
        // Employee info
        Text(
            text = "Verifying: ${employee.name}",
            style = MaterialTheme.typography.headlineSmall,
            color = Color.White,
            fontWeight = FontWeight.Bold
        )
        
        // Fingerprint icon
        Icon(
            Icons.Default.Lock,
            contentDescription = "Fingerprint",
            modifier = Modifier.size(120.dp),
            tint = if (isScanning) Color.Blue else Color.White
        )
        
        // Status message
        Text(
            text = statusMessage,
            style = MaterialTheme.typography.bodyLarge,
            textAlign = TextAlign.Center,
            color = Color.White
        )
        
        // Progress indicator while scanning
        if (isScanning) {
            CircularProgressIndicator(
                color = Color.Blue,
                modifier = Modifier.size(32.dp)
            )
        }
        
        // Back button
        Button(
            onClick = onBackPressed,
            colors = ButtonDefaults.buttonColors(
                containerColor = Color.Gray
            )
        ) {
            Row(
                horizontalArrangement = Arrangement.spacedBy(8.dp),
                verticalAlignment = Alignment.CenterVertically
            ) {
                Icon(
                    Icons.Default.ArrowBack,
                    contentDescription = null,
                    tint = Color.White
                )
                Text("Back", color = Color.White)
            }
        }
    }
}

@Composable 
fun QuickFingerprintAccess(
    employees: List<Employee>,
    onEmployeeAuthenticated: (Employee) -> Unit,
    onError: (String) -> Unit,
    onBackPressed: () -> Unit
) {
    var selectedEmployee by remember { mutableStateOf<Employee?>(null) }
    
    if (selectedEmployee == null) {
        // Show quick employee selection for fingerprint
        Column(
            horizontalAlignment = Alignment.CenterHorizontally,
            verticalArrangement = Arrangement.spacedBy(16.dp)
        ) {
            Text(
                text = "Quick Fingerprint Access",
                style = MaterialTheme.typography.headlineSmall,
                color = Color.White,
                fontWeight = FontWeight.Bold
            )
            
            Text(
                text = "Select your profile for fingerprint authentication",
                style = MaterialTheme.typography.bodyLarge,
                textAlign = TextAlign.Center,
                color = Color.White.copy(alpha = 0.8f)
            )
            
            // Quick access employee buttons
            employees.take(6).forEach { employee ->
                Button(
                    onClick = { selectedEmployee = employee },
                    modifier = Modifier
                        .fillMaxWidth()
                        .height(50.dp),
                    colors = ButtonDefaults.buttonColors(
                        containerColor = Color.Blue.copy(alpha = 0.8f)
                    )
                ) {
                    Row(
                        horizontalArrangement = Arrangement.spacedBy(8.dp),
                        verticalAlignment = Alignment.CenterVertically
                    ) {
                        Icon(
                            Icons.Default.Person,
                            contentDescription = null,
                            tint = Color.White
                        )
                        Text(
                            text = employee.name,
                            color = Color.White
                        )
                    }
                }
            }
            
            Button(
                onClick = onBackPressed,
                colors = ButtonDefaults.buttonColors(
                    containerColor = Color.Gray
                )
            ) {
                Row(
                    horizontalArrangement = Arrangement.spacedBy(8.dp),
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    Icon(
                        Icons.Default.ArrowBack,
                        contentDescription = null,
                        tint = Color.White
                    )
                    Text("Back", color = Color.White)
                }
            }
        }
    } else {
        // Show fingerprint authentication for selected employee
        FingerprintAuthenticationUI(
            employee = selectedEmployee!!,
            onAuthenticated = onEmployeeAuthenticated,
            onError = onError,
            onBackPressed = { selectedEmployee = null }
        )
    }
}

@Composable
fun ManualEmployeeEntry(
    onEmployeeEntered: (String) -> Unit,
    onBackPressed: () -> Unit
) {
    var employeeId by remember { mutableStateOf("") }
    var isProcessing by remember { mutableStateOf(false) }
    
    Column(
        horizontalAlignment = Alignment.CenterHorizontally,
        verticalArrangement = Arrangement.spacedBy(16.dp)
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
                text = "Manual Employee Entry",
                style = MaterialTheme.typography.headlineSmall,
                color = Color.White,
                fontWeight = FontWeight.Bold
            )
        }
        
        Spacer(modifier = Modifier.height(16.dp))
        
        // Employee ID input
        Card(
            modifier = Modifier.fillMaxWidth(),
            colors = CardDefaults.cardColors(
                containerColor = Color.White.copy(alpha = 0.9f)
            )
        ) {
            Column(
                modifier = Modifier.padding(20.dp)
            ) {
                Text(
                    text = "Enter Employee ID",
                    style = MaterialTheme.typography.titleMedium,
                    color = Color.Black,
                    fontWeight = FontWeight.Bold
                )
                
                Spacer(modifier = Modifier.height(12.dp))
                
                OutlinedTextField(
                    value = employeeId,
                    onValueChange = { employeeId = it.uppercase() },
                    label = { Text("Employee ID") },
                    placeholder = { Text("e.g., EMP001") },
                    modifier = Modifier.fillMaxWidth(),
                    singleLine = true,
                    colors = OutlinedTextFieldDefaults.colors(
                        focusedBorderColor = Color.Blue,
                        unfocusedBorderColor = Color.Gray
                    )
                )
                
                Spacer(modifier = Modifier.height(16.dp))
                
                Button(
                    onClick = {
                        if (employeeId.isNotBlank()) {
                            isProcessing = true
                            onEmployeeEntered(employeeId.trim())
                        }
                    },
                    modifier = Modifier.fillMaxWidth(),
                    enabled = employeeId.isNotBlank() && !isProcessing,
                    colors = ButtonDefaults.buttonColors(
                        containerColor = Color.Blue
                    )
                ) {
                    if (isProcessing) {
                        CircularProgressIndicator(
                            modifier = Modifier.size(20.dp),
                            color = Color.White
                        )
                    } else {
                        Text(
                            text = "Clock In/Out",
                            color = Color.White
                        )
                    }
                }
            }
        }
        
        // Sample employee IDs for demo
        Card(
            modifier = Modifier.fillMaxWidth(),
            colors = CardDefaults.cardColors(
                containerColor = Color.Blue.copy(alpha = 0.1f)
            )
        ) {
            Column(
                modifier = Modifier.padding(16.dp)
            ) {
                Text(
                    text = "Demo Employee IDs:",
                    color = Color.White,
                    style = MaterialTheme.typography.bodyMedium,
                    fontWeight = FontWeight.Bold
                )
                Spacer(modifier = Modifier.height(8.dp))
                Text(
                    text = "EMP001, EMP002, EMP003, TEST001",
                    color = Color.White.copy(alpha = 0.8f),
                    style = MaterialTheme.typography.bodySmall
                )
            }
        }
    }
}
