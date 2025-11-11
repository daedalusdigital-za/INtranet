package com.example.clockinsystem.data

import androidx.room.Dao
import androidx.room.Insert
import androidx.room.Query
import com.example.clockinsystem.model.ClockInLog

@Dao
interface ClockInDao {
    @Insert
    suspend fun insert(log: ClockInLog)

    @Query("SELECT * FROM clock_in_log ORDER BY timestamp DESC")
    suspend fun getAllLogs(): List<ClockInLog>

    @Query("SELECT * FROM clock_in_log WHERE employeeId = :employeeId ORDER BY timestamp DESC")
    suspend fun getLogsForEmployee(employeeId: String): List<ClockInLog>

    @Query("SELECT * FROM clock_in_log WHERE employeeId = :employeeId ORDER BY timestamp DESC LIMIT 1")
    suspend fun getLastLogForEmployee(employeeId: String): ClockInLog?
}