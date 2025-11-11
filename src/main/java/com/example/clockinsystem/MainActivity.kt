package com.example.clockinsystem

import android.Manifest
import android.content.pm.PackageManager
import android.os.Bundle
import android.widget.Toast
import androidx.activity.compose.setContent
import androidx.activity.enableEdgeToEdge
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.foundation.Image
import androidx.compose.foundation.layout.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.res.painterResource
import androidx.compose.ui.unit.dp
import androidx.core.content.ContextCompat
import androidx.fragment.app.FragmentActivity
import androidx.lifecycle.lifecycleScope
import com.example.clockinsystem.data.AppDatabase
import com.example.clockinsystem.data.ClockInRepository
import com.example.clockinsystem.ui.theme.ClockinSystemTheme
import com.example.clockinsystem.ui.LoginScreen
import com.example.clockinsystem.ui.MainMenuScreen
import com.example.clockinsystem.ui.ClockInScreen
import com.example.clockinsystem.ui.EmployeeRegistrationScreen
import com.example.clockinsystem.ui.EmployeeListScreen
import com.example.clockinsystem.ui.EmployeeEditScreen
import com.example.clockinsystem.ui.ViewRegistersScreen
import com.example.clockinsystem.ui.FaceRecognitionDiagnostic
import com.example.clockinsystem.ui.ImageFaceDetectionScreen
import com.example.clockinsystem.ui.CameraDiagnosticScreen
import com.example.clockinsystem.utils.TestDataUtils
import kotlinx.coroutines.launch

class MainActivity : FragmentActivity() {
    
    // Camera permission launcher
    private val requestCameraPermissionLauncher = registerForActivityResult(
        ActivityResultContracts.RequestPermission()
    ) { isGranted: Boolean ->
        if (isGranted) {
            // Permission granted - camera will now work
            Toast.makeText(this, "Camera permission granted", Toast.LENGTH_SHORT).show()
        } else {
            // Permission denied
            Toast.makeText(this, "Camera permission is required for face detection to work", Toast.LENGTH_LONG).show()
        }
    }
    
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        enableEdgeToEdge()
        
        // Request camera permission on startup
        requestCameraPermission()
        
        // Initialize test data
        lifecycleScope.launch {
            val database = AppDatabase.getDatabase(this@MainActivity)
            val repository = ClockInRepository(database.clockInDao(), database.employeeDao(), database.faceEmbeddingDao(), this@MainActivity)
            TestDataUtils.createTestEmployees(repository, this@MainActivity)
        }
        
        setContent {
            ClockinSystemTheme {
                ClockInSystemApp()
            }
        }
    }
    
    private fun requestCameraPermission() {
        when {
            ContextCompat.checkSelfPermission(
                this,
                Manifest.permission.CAMERA
            ) == PackageManager.PERMISSION_GRANTED -> {
                // Permission is already granted
            }
            else -> {
                // Request the permission
                requestCameraPermissionLauncher.launch(Manifest.permission.CAMERA)
            }
        }
    }
}

@Composable
fun ClockInSystemApp() {
    var currentScreen by remember { mutableStateOf("main_menu") } // Auto-login: skip login screen
    var showToast by remember { mutableStateOf(false) }
    var toastMessage by remember { mutableStateOf("") }
    var selectedEmployee by remember { mutableStateOf<com.example.clockinsystem.model.Employee?>(null) }

    // Show toast messages
    if (showToast) {
        LaunchedEffect(showToast) {
            kotlinx.coroutines.delay(2000)
            showToast = false
        }
    }

    Box(modifier = Modifier.fillMaxSize()) {
        // Background image
        Image(
            painter = painterResource(id = R.drawable.cover),
            contentDescription = "Background",
            modifier = Modifier.fillMaxSize(),
            contentScale = ContentScale.Crop
        )
        
        // Main content overlay
        Box(
            modifier = Modifier
                .fillMaxSize()
                .padding(16.dp)
        ) {
            when (currentScreen) {
                "login" -> {
                    LoginScreen(
                        onLoginSuccess = { currentScreen = "main_menu" },
                        onLoginFailed = { 
                            toastMessage = "Login failed. Please try again."
                            showToast = true
                        }
                    )
                }
                "main_menu" -> {
                    MainMenuScreen(
                        onNavigateToClockIn = { currentScreen = "clock_in" },
                        onNavigateToEmployeeRegistration = { currentScreen = "employee_registration" },
                        onNavigateToViewRegisters = { currentScreen = "view_registers" },
                        onNavigateToCaptureStats = {
                            toastMessage = "Production Stats - Coming Soon"
                            showToast = true
                        },
                        onNavigateToEmployeeList = { currentScreen = "employee_list" },
                        onNavigateToFaceDiagnostic = { currentScreen = "face_diagnostic" },
                        onNavigateToImageFaceDetection = { currentScreen = "image_face_detection" },
                        onNavigateToCameraDiagnostic = { currentScreen = "camera_diagnostic" },
                        onLogout = { currentScreen = "login" }
                    )
                }
                "clock_in" -> {
                    ClockInScreen(
                        onNavigateBack = { currentScreen = "main_menu" }
                    )
                }
                "employee_registration" -> {
                    val context = LocalContext.current
                    val database = remember { AppDatabase.getDatabase(context) }
                    val repository = remember { 
                        ClockInRepository(database.clockInDao(), database.employeeDao(), database.faceEmbeddingDao(), context) 
                    }
                    val cameraExecutor = remember { java.util.concurrent.Executors.newSingleThreadExecutor() }
                    
                    DisposableEffect(Unit) {
                        onDispose {
                            cameraExecutor.shutdown()
                        }
                    }
                    
                    EmployeeRegistrationScreen(
                        cameraExecutor = cameraExecutor,
                        activity = context as FragmentActivity,
                        clockInRepository = repository,
                        onBackPressed = { currentScreen = "main_menu" },
                        onEmployeeRegistered = { 
                            currentScreen = "main_menu"
                            toastMessage = "Employee registered successfully!"
                            showToast = true
                        }
                    )
                }
                "view_registers" -> {
                    ViewRegistersScreen(
                        onNavigateBack = { currentScreen = "main_menu" }
                    )
                }
                "employee_list" -> {
                    val context = LocalContext.current
                    val database = remember { AppDatabase.getDatabase(context) }
                    val repository = remember { 
                        ClockInRepository(database.clockInDao(), database.employeeDao(), database.faceEmbeddingDao(), context) 
                    }
                    
                    EmployeeListScreen(
                        repository = repository,
                        activity = context as FragmentActivity,
                        onNavigateBack = { currentScreen = "main_menu" },
                        onEditEmployee = { employee ->
                            selectedEmployee = employee
                            currentScreen = "employee_edit"
                        },
                        onRegisterNew = { currentScreen = "employee_registration" }
                    )
                }
                "employee_edit" -> {
                    selectedEmployee?.let { employee ->
                        val context = LocalContext.current
                        val database = remember { AppDatabase.getDatabase(context) }
                        val repository = remember { 
                            ClockInRepository(database.clockInDao(), database.employeeDao(), database.faceEmbeddingDao(), context) 
                        }
                        
                        EmployeeEditScreen(
                            employee = employee,
                            repository = repository,
                            activity = context as FragmentActivity,
                            onNavigateBack = { currentScreen = "employee_list" },
                            onEmployeeUpdated = { 
                                currentScreen = "employee_list"
                                toastMessage = "Employee updated successfully!"
                                showToast = true
                            }
                        )
                    }
                }
                "face_diagnostic" -> {
                    FaceRecognitionDiagnostic(
                        onNavigateBack = { currentScreen = "main_menu" }
                    )
                }
                "image_face_detection" -> {
                    ImageFaceDetectionScreen(
                        onNavigateBack = { currentScreen = "main_menu" },
                        onFaceDetected = { imagePath, faceCount, faceInfo ->
                            currentScreen = "main_menu"
                            toastMessage = "Image processed: $faceCount face(s) detected"
                            showToast = true
                        }
                    )
                }
                "camera_diagnostic" -> {
                    CameraDiagnosticScreen(
                        onNavigateBack = { currentScreen = "main_menu" }
                    )
                }
            }
        }
        
        // Toast message overlay
        if (showToast) {
            Box(
                modifier = Modifier
                    .fillMaxSize()
                    .padding(16.dp),
                contentAlignment = Alignment.BottomCenter
            ) {
                Card(
                    colors = CardDefaults.cardColors(containerColor = Color.Black.copy(alpha = 0.8f))
                ) {
                    Text(
                        text = toastMessage,
                        modifier = Modifier.padding(16.dp),
                        color = Color.White
                    )
                }
            }
        }
    }
}