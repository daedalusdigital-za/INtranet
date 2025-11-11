package com.example.clockinsystem.model

import androidx.room.Entity
import androidx.room.PrimaryKey

@Entity(tableName = "clock_in_log")
data class ClockInLog(
    @PrimaryKey(autoGenerate = true)
    val id: Int = 0,
    val employeeId: String,
    val timestamp: Long,
    val eventType: String // "IN" or "OUT"
)