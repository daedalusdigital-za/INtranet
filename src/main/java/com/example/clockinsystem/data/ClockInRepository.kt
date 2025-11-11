package com.example.clockinsystem.data

import android.content.Context
import android.graphics.Bitmap
import android.graphics.BitmapFactory
import com.example.clockinsystem.model.Employee
import com.example.clockinsystem.model.ClockInLog
import com.example.clockinsystem.model.FaceEmbedding
import java.io.File
import java.io.FileOutputStream

class ClockInRepository(
    private val clockInDao: ClockInDao, 
    private val employeeDao: EmployeeDao,
    private val faceEmbeddingDao: FaceEmbeddingDao,
    private val context: Context
) {

    private val internalStorageDir = context.filesDir

    suspend fun saveEmployee(employee: Employee) {
        employeeDao.insert(employee)
    }

    suspend fun getEmployeeById(employeeId: String): Employee? {
        return employeeDao.getEmployeeById(employeeId)
    }

    suspend fun getAllEmployees(): List<Employee> {
        return employeeDao.getAllEmployees()
    }

    fun saveReferenceImage(employeeId: String, image: Bitmap): String {
        val file = File(internalStorageDir, "$employeeId.jpg")
        FileOutputStream(file).use {
            image.compress(Bitmap.CompressFormat.JPEG, 100, it)
        }
        return file.absolutePath
    }

    fun getReferenceImage(employeeId: String): Bitmap? {
        val file = File(internalStorageDir, "$employeeId.jpg")
        return if (file.exists()) {
            BitmapFactory.decodeFile(file.absolutePath)
        } else null
    }

    fun getReferenceImageFile(employeeId: String): File? {
        val file = File(internalStorageDir, "$employeeId.jpg")
        return if (file.exists()) file else null
    }

    suspend fun saveClockInTime(employeeId: String) {
        val log = ClockInLog(employeeId = employeeId, timestamp = System.currentTimeMillis(), eventType = "IN")
        clockInDao.insert(log)
    }

    suspend fun saveClockOutTime(employeeId: String) {
        val log = ClockInLog(employeeId = employeeId, timestamp = System.currentTimeMillis(), eventType = "OUT")
        clockInDao.insert(log)
    }

    suspend fun getAllLogs(): List<ClockInLog> {
        return clockInDao.getAllLogs()
    }

    suspend fun getLastClockEvent(employeeId: String): ClockInLog? {
        return clockInDao.getLastLogForEmployee(employeeId)
    }

    suspend fun updateEmployee(employee: Employee) {
        employeeDao.update(employee)
    }

    suspend fun deleteEmployee(employee: Employee) {
        employeeDao.delete(employee)
    }

    // Face embedding methods
    suspend fun insertFaceEmbedding(faceEmbedding: FaceEmbedding) {
        faceEmbeddingDao.insertFaceEmbedding(faceEmbedding)
    }

    suspend fun getAllFaceEmbeddings(): List<FaceEmbedding> {
        return faceEmbeddingDao.getAllFaceEmbeddings()
    }

    suspend fun getFaceEmbeddingByEmployeeId(employeeId: String): FaceEmbedding? {
        return faceEmbeddingDao.getFaceEmbeddingByEmployeeId(employeeId)
    }

    suspend fun deleteFaceEmbeddingByEmployeeId(employeeId: String) {
        faceEmbeddingDao.deleteFaceEmbeddingByEmployeeId(employeeId)
    }

    suspend fun getRegisteredFaceCount(): Int {
        return faceEmbeddingDao.getRegisteredFaceCount()
    }

    suspend fun getRegisteredEmployeeIds(): List<String> {
        return faceEmbeddingDao.getRegisteredEmployeeIds()
    }
}