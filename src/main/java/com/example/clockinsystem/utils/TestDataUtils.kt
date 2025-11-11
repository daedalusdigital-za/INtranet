package com.example.clockinsystem.utils

import android.content.Context
import android.graphics.Bitmap
import android.graphics.Canvas
import android.graphics.Color
import android.graphics.Paint
import com.example.clockinsystem.data.ClockInRepository
import com.example.clockinsystem.model.Employee
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext

object TestDataUtils {
    
    suspend fun createTestEmployees(repository: ClockInRepository, context: Context) {
        withContext(Dispatchers.IO) {
            // Check if employees already exist
            val existingEmployees = repository.getAllEmployees()
            if (existingEmployees.isNotEmpty()) {
                return@withContext // Test data already exists
            }
            
            // Create test employees with simple colored reference images
            val testEmployees = listOf(
                TestEmployee("EMP001", "John Doe", Color.BLUE),
                TestEmployee("EMP002", "Jane Smith", Color.GREEN),
                TestEmployee("EMP003", "Mike Johnson", Color.RED)
            )
            
            testEmployees.forEach { testEmployee ->
                try {
                    // Create a simple colored bitmap as reference image
                    val bitmap = createColoredBitmap(testEmployee.color, testEmployee.name)
                    
                    // Save the reference image and get the path
                    val imagePath = repository.saveReferenceImage(testEmployee.id, bitmap)
                    
                    // Create and save the employee
                    val employee = Employee(
                        id = testEmployee.id,
                        name = testEmployee.name,
                        referenceImagePath = imagePath
                    )
                    
                    repository.saveEmployee(employee)
                } catch (e: Exception) {
                    // Log error but continue with other employees
                    println("Failed to create test employee ${testEmployee.name}: ${e.message}")
                }
            }
        }
    }
    
    private fun createColoredBitmap(color: Int, name: String): Bitmap {
        val bitmap = Bitmap.createBitmap(200, 200, Bitmap.Config.ARGB_8888)
        val canvas = Canvas(bitmap)
        
        // Fill with color
        canvas.drawColor(color)
        
        // Add text with name
        val paint = Paint().apply {
            this.color = Color.WHITE
            textSize = 24f
            isAntiAlias = true
            textAlign = Paint.Align.CENTER
        }
        
        canvas.drawText(name, 100f, 100f, paint)
        
        return bitmap
    }
    
    private data class TestEmployee(
        val id: String,
        val name: String,
        val color: Int
    )
}