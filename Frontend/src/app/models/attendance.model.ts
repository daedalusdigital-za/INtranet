export interface Employee {
  employeeId: string;  // Changed from number to string (empid is varchar(50))
  fullName: string;
  employeeCode: string;
  department: string | null;
  position: string | null;
  email: string | null;
  phoneNumber: string | null;
  hireDate: string | null;  // Changed from Date to string
  shift: string | null;
  shiftStartTime: string | null;
  shiftEndTime: string | null;
  photoBase64: string | null;
  isActive: boolean;
  status: string;
  timeIn: string | null;  // Changed from Date to string (time format from SQL)
  timeOut: string | null;  // Changed from Date to string (time format from SQL)
  isLate: boolean;
  lateMinutes: number;
}

export interface Attendance {
  attendanceId: number;
  employeeId: number;
  employeeName: string;
  employeeCode: string;
  department: string | null;
  date: Date;
  timeIn: Date | null;
  timeOut: Date | null;
  shift: string | null;
  status: string;
  isLate: boolean;
  lateMinutes: number;
  remarks: string | null;
}

export interface AttendanceMetrics {
  totalEmployees: number;
  presentCount: number;
  absentCount: number;
  lateCount: number;
  attendanceRate: number;
  date: Date;
  departmentBreakdown: DepartmentAttendance[];
}

export interface DepartmentAttendance {
  departmentName: string;
  totalEmployees: number;
  presentCount: number;
  absentCount: number;
  lateCount: number;
}

export interface CheckInRequest {
  employeeId: number;
  timeIn: Date;
}

export interface CheckOutRequest {
  employeeId: number;
  timeOut: Date;
}


