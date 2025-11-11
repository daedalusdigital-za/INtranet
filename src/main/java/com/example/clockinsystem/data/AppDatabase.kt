package com.example.clockinsystem.data

import android.content.Context
import androidx.room.Database
import androidx.room.Room
import androidx.room.RoomDatabase
import androidx.room.TypeConverters
import com.example.clockinsystem.model.ClockInLog
import com.example.clockinsystem.model.Employee
import com.example.clockinsystem.model.FaceEmbedding
import com.example.clockinsystem.model.FloatArrayConverter

@Database(
    entities = [ClockInLog::class, Employee::class, FaceEmbedding::class], 
    version = 3, 
    exportSchema = false
)
@TypeConverters(FloatArrayConverter::class)
abstract class AppDatabase : RoomDatabase() {
    abstract fun clockInDao(): ClockInDao
    abstract fun employeeDao(): EmployeeDao
    abstract fun faceEmbeddingDao(): FaceEmbeddingDao

    companion object {
        @Volatile
        private var INSTANCE: AppDatabase? = null

        fun getDatabase(context: Context): AppDatabase {
            return INSTANCE ?: synchronized(this) {
                val instance = Room.databaseBuilder(
                    context.applicationContext,
                    AppDatabase::class.java,
                    "clock_in_database"
                )
                .fallbackToDestructiveMigration() // For now, allow data loss on schema changes
                .build()
                INSTANCE = instance
                instance
            }
        }
    }
}