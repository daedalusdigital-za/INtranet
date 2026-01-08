using Microsoft.EntityFrameworkCore;
using ProjectTracker.API.Models;

namespace ProjectTracker.API.Data
{
    public class ApplicationDbContext : DbContext
    {
        public ApplicationDbContext(DbContextOptions<ApplicationDbContext> options)
            : base(options)
        {
        }

        protected override void OnConfiguring(DbContextOptionsBuilder optionsBuilder)
        {
            optionsBuilder.ConfigureWarnings(warnings =>
                warnings.Ignore(Microsoft.EntityFrameworkCore.Diagnostics.RelationalEventId.PendingModelChangesWarning));
        }

        public DbSet<User> Users { get; set; }
        public DbSet<Department> Departments { get; set; }
        public DbSet<Board> Boards { get; set; }
        public DbSet<List> Lists { get; set; }
        public DbSet<Card> Cards { get; set; }
        public DbSet<CardComment> CardComments { get; set; }
        public DbSet<CardAttachment> CardAttachments { get; set; }
        public DbSet<AuditLog> AuditLogs { get; set; }

        // Attendance System Tables
        public DbSet<Employee> Employees { get; set; }
        public DbSet<Attendance> Attendances { get; set; }
        public DbSet<AttendanceAdmin> AttendanceAdmins { get; set; }

        // Biometric System Tables (Actual Database Schema)
        public DbSet<Admin> Admins { get; set; }
        public DbSet<EmpRegistration> EmpRegistrations { get; set; }
        public DbSet<AttendanceRecord> AttendanceRecords { get; set; }

        // Support Ticket System
        public DbSet<SupportTicket> SupportTickets { get; set; }
        public DbSet<TicketComment> TicketComments { get; set; }

        // Messaging System
        public DbSet<Conversation> Conversations { get; set; }
        public DbSet<ConversationParticipant> ConversationParticipants { get; set; }
        public DbSet<Message> Messages { get; set; }
        public DbSet<MessageAttachment> MessageAttachments { get; set; }
        public DbSet<MessageReadReceipt> MessageReadReceipts { get; set; }

        protected override void OnModelCreating(ModelBuilder modelBuilder)
        {
            base.OnModelCreating(modelBuilder);

            // Configure biometric system relationships
            modelBuilder.Entity<AttendanceRecord>()
                .HasOne(a => a.Employee)
                .WithMany(e => e.AttendanceRecords)
                .HasForeignKey(a => a.EmpID)
                .OnDelete(DeleteBehavior.Cascade);

            // Configure relationships
            modelBuilder.Entity<User>()
                .HasOne(u => u.Department)
                .WithMany(d => d.Users)
                .HasForeignKey(u => u.DepartmentId)
                .OnDelete(DeleteBehavior.SetNull);

            modelBuilder.Entity<Board>()
                .HasOne(b => b.Department)
                .WithMany(d => d.Boards)
                .HasForeignKey(b => b.DepartmentId)
                .OnDelete(DeleteBehavior.Cascade);

            modelBuilder.Entity<List>()
                .HasOne(l => l.Board)
                .WithMany(b => b.Lists)
                .HasForeignKey(l => l.BoardId)
                .OnDelete(DeleteBehavior.Cascade);

            modelBuilder.Entity<Card>()
                .HasOne(c => c.List)
                .WithMany(l => l.Cards)
                .HasForeignKey(c => c.ListId)
                .OnDelete(DeleteBehavior.Cascade);

            modelBuilder.Entity<Card>()
                .HasOne(c => c.AssignedTo)
                .WithMany(u => u.AssignedCards)
                .HasForeignKey(c => c.AssignedToUserId)
                .OnDelete(DeleteBehavior.SetNull);

            modelBuilder.Entity<CardComment>()
                .HasOne(cc => cc.Card)
                .WithMany(c => c.Comments)
                .HasForeignKey(cc => cc.CardId)
                .OnDelete(DeleteBehavior.Cascade);

            modelBuilder.Entity<CardAttachment>()
                .HasOne(ca => ca.Card)
                .WithMany(c => c.Attachments)
                .HasForeignKey(ca => ca.CardId)
                .OnDelete(DeleteBehavior.Cascade);

            // Attendance System relationships
            modelBuilder.Entity<Attendance>()
                .HasOne(a => a.Employee)
                .WithMany(e => e.Attendances)
                .HasForeignKey(a => a.EmployeeId)
                .OnDelete(DeleteBehavior.Cascade);

            // Support Ticket System relationships
            modelBuilder.Entity<TicketComment>()
                .HasOne(tc => tc.Ticket)
                .WithMany(t => t.Comments)
                .HasForeignKey(tc => tc.TicketId)
                .OnDelete(DeleteBehavior.Cascade);

            // Messaging System relationships
            modelBuilder.Entity<ConversationParticipant>()
                .HasOne(cp => cp.Conversation)
                .WithMany(c => c.Participants)
                .HasForeignKey(cp => cp.ConversationId)
                .OnDelete(DeleteBehavior.Cascade);

            modelBuilder.Entity<ConversationParticipant>()
                .HasOne(cp => cp.User)
                .WithMany()
                .HasForeignKey(cp => cp.UserId)
                .OnDelete(DeleteBehavior.Cascade);

            modelBuilder.Entity<Message>()
                .HasOne(m => m.Conversation)
                .WithMany(c => c.Messages)
                .HasForeignKey(m => m.ConversationId)
                .OnDelete(DeleteBehavior.Cascade);

            modelBuilder.Entity<Message>()
                .HasOne(m => m.Sender)
                .WithMany()
                .HasForeignKey(m => m.SenderId)
                .OnDelete(DeleteBehavior.Restrict);

            modelBuilder.Entity<Message>()
                .HasOne(m => m.ReplyToMessage)
                .WithMany()
                .HasForeignKey(m => m.ReplyToMessageId)
                .OnDelete(DeleteBehavior.NoAction);

            modelBuilder.Entity<MessageAttachment>()
                .HasOne(ma => ma.Message)
                .WithMany(m => m.Attachments)
                .HasForeignKey(ma => ma.MessageId)
                .OnDelete(DeleteBehavior.Cascade);

            modelBuilder.Entity<MessageReadReceipt>()
                .HasOne(mr => mr.Message)
                .WithMany(m => m.ReadReceipts)
                .HasForeignKey(mr => mr.MessageId)
                .OnDelete(DeleteBehavior.Cascade);

            modelBuilder.Entity<MessageReadReceipt>()
                .HasOne(mr => mr.User)
                .WithMany()
                .HasForeignKey(mr => mr.UserId)
                .OnDelete(DeleteBehavior.Restrict);

            // Seed initial data
            SeedData(modelBuilder);
        }

        private void SeedData(ModelBuilder modelBuilder)
        {
            var seedDate = new DateTime(2025, 11, 3, 0, 0, 0, DateTimeKind.Utc);
            
            // Seed Departments
            modelBuilder.Entity<Department>().HasData(
                new Department { DepartmentId = 1, Name = "IT", ManagerName = "Jane Doe", CreatedAt = seedDate },
                new Department { DepartmentId = 2, Name = "Logistics", ManagerName = "Mike Johnson", CreatedAt = seedDate },
                new Department { DepartmentId = 3, Name = "Marketing", ManagerName = "John Smith", CreatedAt = seedDate }
            );

            // Seed Users (Password: "Kingsland" - BCrypt verification currently disabled)
            modelBuilder.Entity<User>().HasData(
                new User 
                { 
                    UserId = 1, 
                    Name = "Admin User", 
                    Email = "welcome@promedtechnologies.co.za", 
                    PasswordHash = "Kingsland",
                    Role = "Admin",
                    CreatedAt = seedDate
                },
                new User 
                { 
                    UserId = 2, 
                    Name = "Jane Doe", 
                    Email = "jane@company.com", 
                    PasswordHash = "$2a$11$XQRdlQ8P9RfHOKVYOz5Wy.vHZe8RrH7pNWEJhGCRdPQ6kV0UqKPXm",
                    Role = "Manager",
                    DepartmentId = 1,
                    CreatedAt = seedDate
                },
                new User 
                { 
                    UserId = 3, 
                    Name = "Mike Johnson", 
                    Email = "mike@company.com", 
                    PasswordHash = "$2a$11$XQRdlQ8P9RfHOKVYOz5Wy.vHZe8RrH7pNWEJhGCRdPQ6kV0UqKPXm",
                    Role = "Manager",
                    DepartmentId = 2,
                    CreatedAt = seedDate
                },
                new User 
                { 
                    UserId = 4, 
                    Name = "John Smith", 
                    Email = "john@company.com", 
                    PasswordHash = "$2a$11$XQRdlQ8P9RfHOKVYOz5Wy.vHZe8RrH7pNWEJhGCRdPQ6kV0UqKPXm",
                    Role = "Manager",
                    DepartmentId = 3,
                    CreatedAt = seedDate
                }
            );

            // Seed Boards - IT Department (12 projects)
            modelBuilder.Entity<Board>().HasData(
                new Board { BoardId = 1, DepartmentId = 1, Title = "IT Infrastructure", Description = "IT infrastructure projects", CreatedAt = seedDate },
                new Board { BoardId = 2, DepartmentId = 1, Title = "Software Development", Description = "Software development projects", CreatedAt = seedDate },
                new Board { BoardId = 3, DepartmentId = 1, Title = "Security", Description = "Security projects", CreatedAt = seedDate },
                new Board { BoardId = 4, DepartmentId = 1, Title = "Cloud Migration", Description = "Cloud migration projects", CreatedAt = seedDate },
                new Board { BoardId = 5, DepartmentId = 1, Title = "Network Upgrade", Description = "Network upgrade projects", CreatedAt = seedDate },
                new Board { BoardId = 6, DepartmentId = 1, Title = "Database Management", Description = "Database projects", CreatedAt = seedDate },
                new Board { BoardId = 7, DepartmentId = 1, Title = "Mobile Apps", Description = "Mobile application projects", CreatedAt = seedDate },
                new Board { BoardId = 8, DepartmentId = 1, Title = "DevOps", Description = "DevOps projects", CreatedAt = seedDate },
                new Board { BoardId = 9, DepartmentId = 1, Title = "AI Integration", Description = "AI integration projects", CreatedAt = seedDate },
                new Board { BoardId = 10, DepartmentId = 1, Title = "Help Desk System", Description = "Help desk system projects", CreatedAt = seedDate },
                new Board { BoardId = 11, DepartmentId = 1, Title = "Backup Solutions", Description = "Backup and recovery projects", CreatedAt = seedDate },
                new Board { BoardId = 12, DepartmentId = 1, Title = "Hardware Refresh", Description = "Hardware refresh projects", CreatedAt = seedDate },
                
                // Logistics Department (9 projects)
                new Board { BoardId = 13, DepartmentId = 2, Title = "Supply Chain", Description = "Supply chain projects", CreatedAt = seedDate },
                new Board { BoardId = 14, DepartmentId = 2, Title = "Warehouse Management", Description = "Warehouse projects", CreatedAt = seedDate },
                new Board { BoardId = 15, DepartmentId = 2, Title = "Fleet Management", Description = "Fleet management projects", CreatedAt = seedDate },
                new Board { BoardId = 16, DepartmentId = 2, Title = "Inventory Control", Description = "Inventory control projects", CreatedAt = seedDate },
                new Board { BoardId = 17, DepartmentId = 2, Title = "Shipping Optimization", Description = "Shipping optimization projects", CreatedAt = seedDate },
                new Board { BoardId = 18, DepartmentId = 2, Title = "Vendor Relations", Description = "Vendor relations projects", CreatedAt = seedDate },
                new Board { BoardId = 19, DepartmentId = 2, Title = "Route Planning", Description = "Route planning projects", CreatedAt = seedDate },
                new Board { BoardId = 20, DepartmentId = 2, Title = "Distribution Center", Description = "Distribution center projects", CreatedAt = seedDate },
                new Board { BoardId = 21, DepartmentId = 2, Title = "Quality Control", Description = "Quality control projects", CreatedAt = seedDate },
                
                // Marketing Department (7 projects)
                new Board { BoardId = 22, DepartmentId = 3, Title = "Digital Marketing", Description = "Digital marketing projects", CreatedAt = seedDate },
                new Board { BoardId = 23, DepartmentId = 3, Title = "Content Creation", Description = "Content creation projects", CreatedAt = seedDate },
                new Board { BoardId = 24, DepartmentId = 3, Title = "Brand Strategy", Description = "Brand strategy projects", CreatedAt = seedDate },
                new Board { BoardId = 25, DepartmentId = 3, Title = "Social Media", Description = "Social media projects", CreatedAt = seedDate },
                new Board { BoardId = 26, DepartmentId = 3, Title = "Email Campaigns", Description = "Email campaign projects", CreatedAt = seedDate },
                new Board { BoardId = 27, DepartmentId = 3, Title = "Events & Promotions", Description = "Events and promotions", CreatedAt = seedDate },
                new Board { BoardId = 28, DepartmentId = 3, Title = "Market Research", Description = "Market research projects", CreatedAt = seedDate }
            );

            // Seed Lists for Board 1 (IT Infrastructure)
            modelBuilder.Entity<List>().HasData(
                new List { ListId = 1, BoardId = 1, Title = "To Do", Position = 0, CreatedAt = seedDate },
                new List { ListId = 2, BoardId = 1, Title = "In Progress", Position = 1, CreatedAt = seedDate },
                new List { ListId = 3, BoardId = 1, Title = "Completed", Position = 2, CreatedAt = seedDate },
                new List { ListId = 4, BoardId = 1, Title = "Overdue", Position = 3, CreatedAt = seedDate }
            );

            // Seed Cards - Sample cards for IT Infrastructure board
            modelBuilder.Entity<Card>().HasData(
                // Completed cards (6)
                new Card { CardId = 1, ListId = 3, Title = "Server migration completed", Description = "Migrated legacy servers to new infrastructure", Position = 0, Status = "Completed", CreatedAt = seedDate.AddDays(-30) },
                new Card { CardId = 2, ListId = 3, Title = "Firewall upgrade finished", Description = "Upgraded firewall to latest version", Position = 1, Status = "Completed", CreatedAt = seedDate.AddDays(-25) },
                new Card { CardId = 3, ListId = 3, Title = "Backup system implemented", Description = "New backup system fully operational", Position = 2, Status = "Completed", CreatedAt = seedDate.AddDays(-20) },
                new Card { CardId = 4, ListId = 3, Title = "VPN setup complete", Description = "VPN infrastructure deployed", Position = 3, Status = "Completed", CreatedAt = seedDate.AddDays(-15) },
                new Card { CardId = 5, ListId = 3, Title = "Monitoring tools deployed", Description = "Infrastructure monitoring tools active", Position = 4, Status = "Completed", CreatedAt = seedDate.AddDays(-10) },
                new Card { CardId = 6, ListId = 3, Title = "Documentation updated", Description = "All infrastructure documentation current", Position = 5, Status = "Completed", CreatedAt = seedDate.AddDays(-5) },
                
                // In Progress cards (4)
                new Card { CardId = 7, ListId = 2, Title = "Load balancer configuration", Description = "Configuring load balancers", AssignedToUserId = 2, Position = 0, Status = "Active", CreatedAt = seedDate.AddDays(-3) },
                new Card { CardId = 8, ListId = 2, Title = "DNS migration", Description = "Migrating DNS infrastructure", AssignedToUserId = 2, Position = 1, Status = "Active", CreatedAt = seedDate.AddDays(-4) },
                new Card { CardId = 9, ListId = 2, Title = "SSL certificate renewal", Description = "Renewing SSL certificates", AssignedToUserId = 2, Position = 2, Status = "Active", CreatedAt = seedDate.AddDays(-2) },
                new Card { CardId = 10, ListId = 2, Title = "Storage expansion", Description = "Expanding storage capacity", AssignedToUserId = 2, Position = 3, Status = "Active", CreatedAt = seedDate.AddDays(-1) },
                
                // Overdue cards (2)
                new Card { CardId = 11, ListId = 4, Title = "Legacy system decommission", Description = "Decommission old servers", DueDate = seedDate.AddDays(-5), Position = 0, Status = "Active", CreatedAt = seedDate.AddDays(-20) },
                new Card { CardId = 12, ListId = 4, Title = "Security audit", Description = "Complete security audit", DueDate = seedDate.AddDays(-3), Position = 1, Status = "Active", CreatedAt = seedDate.AddDays(-15) }
            );

            // Seed Employees for Attendance System
            modelBuilder.Entity<Employee>().HasData(
                new Employee { EmployeeId = 1, FullName = "John Doe", EmployeeCode = "EMP001", Department = "IT", Position = "Software Developer", Email = "john.doe@company.com", PhoneNumber = "555-0101", HireDate = seedDate, Shift = "Morning", ShiftStartTime = new TimeSpan(8, 0, 0), ShiftEndTime = new TimeSpan(17, 0, 0), IsActive = true, CreatedAt = seedDate },
                new Employee { EmployeeId = 2, FullName = "Jane Smith", EmployeeCode = "EMP002", Department = "IT", Position = "Project Manager", Email = "jane.smith@company.com", PhoneNumber = "555-0102", HireDate = seedDate, Shift = "Morning", ShiftStartTime = new TimeSpan(8, 0, 0), ShiftEndTime = new TimeSpan(17, 0, 0), IsActive = true, CreatedAt = seedDate },
                new Employee { EmployeeId = 3, FullName = "Mike Johnson", EmployeeCode = "EMP003", Department = "Logistics", Position = "Warehouse Manager", Email = "mike.johnson@company.com", PhoneNumber = "555-0103", HireDate = seedDate, Shift = "Morning", ShiftStartTime = new TimeSpan(8, 0, 0), ShiftEndTime = new TimeSpan(17, 0, 0), IsActive = true, CreatedAt = seedDate },
                new Employee { EmployeeId = 4, FullName = "Sarah Williams", EmployeeCode = "EMP004", Department = "Marketing", Position = "Marketing Specialist", Email = "sarah.williams@company.com", PhoneNumber = "555-0104", HireDate = seedDate, Shift = "Morning", ShiftStartTime = new TimeSpan(8, 0, 0), ShiftEndTime = new TimeSpan(17, 0, 0), IsActive = true, CreatedAt = seedDate },
                new Employee { EmployeeId = 5, FullName = "Robert Brown", EmployeeCode = "EMP005", Department = "IT", Position = "DevOps Engineer", Email = "robert.brown@company.com", PhoneNumber = "555-0105", HireDate = seedDate, Shift = "Morning", ShiftStartTime = new TimeSpan(8, 0, 0), ShiftEndTime = new TimeSpan(17, 0, 0), IsActive = true, CreatedAt = seedDate },
                new Employee { EmployeeId = 6, FullName = "Emily Davis", EmployeeCode = "EMP006", Department = "Logistics", Position = "Logistics Coordinator", Email = "emily.davis@company.com", PhoneNumber = "555-0106", HireDate = seedDate, Shift = "Afternoon", ShiftStartTime = new TimeSpan(14, 0, 0), ShiftEndTime = new TimeSpan(22, 0, 0), IsActive = true, CreatedAt = seedDate },
                new Employee { EmployeeId = 7, FullName = "David Miller", EmployeeCode = "EMP007", Department = "Marketing", Position = "Content Writer", Email = "david.miller@company.com", PhoneNumber = "555-0107", HireDate = seedDate, Shift = "Morning", ShiftStartTime = new TimeSpan(8, 0, 0), ShiftEndTime = new TimeSpan(17, 0, 0), IsActive = true, CreatedAt = seedDate },
                new Employee { EmployeeId = 8, FullName = "Lisa Anderson", EmployeeCode = "EMP008", Department = "IT", Position = "QA Tester", Email = "lisa.anderson@company.com", PhoneNumber = "555-0108", HireDate = seedDate, Shift = "Morning", ShiftStartTime = new TimeSpan(8, 0, 0), ShiftEndTime = new TimeSpan(17, 0, 0), IsActive = true, CreatedAt = seedDate },
                new Employee { EmployeeId = 9, FullName = "James Wilson", EmployeeCode = "EMP009", Department = "Logistics", Position = "Delivery Driver", Email = "james.wilson@company.com", PhoneNumber = "555-0109", HireDate = seedDate, Shift = "Morning", ShiftStartTime = new TimeSpan(6, 0, 0), ShiftEndTime = new TimeSpan(14, 0, 0), IsActive = true, CreatedAt = seedDate },
                new Employee { EmployeeId = 10, FullName = "Maria Garcia", EmployeeCode = "EMP010", Department = "Marketing", Position = "Social Media Manager", Email = "maria.garcia@company.com", PhoneNumber = "555-0110", HireDate = seedDate, Shift = "Morning", ShiftStartTime = new TimeSpan(8, 0, 0), ShiftEndTime = new TimeSpan(17, 0, 0), IsActive = true, CreatedAt = seedDate }
            );

            // Seed Today's Attendance Records - using static date for consistency
            var attendanceDate = new DateTime(2025, 11, 4, 0, 0, 0, DateTimeKind.Utc);
            modelBuilder.Entity<Attendance>().HasData(
                // Present employees
                new Attendance { AttendanceId = 1, EmployeeId = 1, Date = attendanceDate, TimeIn = attendanceDate.AddHours(8).AddMinutes(0), Shift = "Morning", Status = "Present", IsLate = false, CreatedAt = seedDate },
                new Attendance { AttendanceId = 2, EmployeeId = 2, Date = attendanceDate, TimeIn = attendanceDate.AddHours(7).AddMinutes(55), Shift = "Morning", Status = "Present", IsLate = false, CreatedAt = seedDate },
                new Attendance { AttendanceId = 3, EmployeeId = 3, Date = attendanceDate, TimeIn = attendanceDate.AddHours(8).AddMinutes(15), Shift = "Morning", Status = "Present", IsLate = true, LateMinutes = 15, CreatedAt = seedDate },
                new Attendance { AttendanceId = 4, EmployeeId = 5, Date = attendanceDate, TimeIn = attendanceDate.AddHours(8).AddMinutes(5), Shift = "Morning", Status = "Present", IsLate = true, LateMinutes = 5, CreatedAt = seedDate },
                new Attendance { AttendanceId = 5, EmployeeId = 6, Date = attendanceDate, TimeIn = attendanceDate.AddHours(14).AddMinutes(0), Shift = "Afternoon", Status = "Present", IsLate = false, CreatedAt = seedDate },
                new Attendance { AttendanceId = 6, EmployeeId = 7, Date = attendanceDate, TimeIn = attendanceDate.AddHours(8).AddMinutes(10), Shift = "Morning", Status = "Present", IsLate = true, LateMinutes = 10, CreatedAt = seedDate },
                new Attendance { AttendanceId = 7, EmployeeId = 9, Date = attendanceDate, TimeIn = attendanceDate.AddHours(6).AddMinutes(0), Shift = "Morning", Status = "Present", IsLate = false, CreatedAt = seedDate },
                // Absent employees
                new Attendance { AttendanceId = 8, EmployeeId = 4, Date = attendanceDate, Shift = "Morning", Status = "Absent", IsLate = false, CreatedAt = seedDate },
                new Attendance { AttendanceId = 9, EmployeeId = 8, Date = attendanceDate, Shift = "Morning", Status = "Absent", IsLate = false, CreatedAt = seedDate },
                new Attendance { AttendanceId = 10, EmployeeId = 10, Date = attendanceDate, Shift = "Morning", Status = "Absent", IsLate = false, CreatedAt = seedDate }
            );

            // Seed Attendance Admin
            modelBuilder.Entity<AttendanceAdmin>().HasData(
                new AttendanceAdmin 
                { 
                    AdminId = 1, 
                    Username = "admin", 
                    Email = "admin@company.com", 
                    PasswordHash = "$2a$11$XQRdlQ8P9RfHOKVYOz5Wy.vHZe8RrH7pNWEJhGCRdPQ6kV0UqKPXm", // Admin123!
                    FullName = "System Administrator", 
                    IsActive = true, 
                    CreatedAt = seedDate 
                }
            );
        }
    }
}
