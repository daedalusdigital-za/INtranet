using Microsoft.EntityFrameworkCore;
using ProjectTracker.API.Models;
using ProjectTracker.API.Models.CRM;

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
        public DbSet<BoardChecklistItem> BoardChecklistItems { get; set; }
        public DbSet<BoardMember> BoardMembers { get; set; }
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

        // Knowledge Base System
        public DbSet<KnowledgeBaseDocument> KnowledgeBaseDocuments { get; set; }
        public DbSet<KnowledgeBaseChunk> KnowledgeBaseChunks { get; set; }
        public DbSet<KnowledgeBaseIngestionLog> KnowledgeBaseIngestionLogs { get; set; }

        // CRM System
        public DbSet<OperatingCompany> OperatingCompanies { get; set; }
        public DbSet<StaffOperatingCompany> StaffOperatingCompanies { get; set; }
        public DbSet<Lead> Leads { get; set; }
        public DbSet<LeadLog> LeadLogs { get; set; }
        public DbSet<LeadStatus> LeadStatuses { get; set; }
        public DbSet<Disposition> Dispositions { get; set; }
        public DbSet<Campaign> Campaigns { get; set; }
        public DbSet<CampaignAgent> CampaignAgents { get; set; }
        public DbSet<Promotion> Promotions { get; set; }
        public DbSet<LeadInterest> LeadInterests { get; set; }
        public DbSet<LeadAssignmentHistory> LeadAssignmentHistories { get; set; }

        // ToDo Task System
        public DbSet<TodoTask> TodoTasks { get; set; }
        public DbSet<TodoNotification> TodoNotifications { get; set; }

        // Meeting System
        public DbSet<Meeting> Meetings { get; set; }
        public DbSet<MeetingAttendee> MeetingAttendees { get; set; }
        public DbSet<MeetingNotification> MeetingNotifications { get; set; }

        // Announcement System
        public DbSet<Announcement> Announcements { get; set; }
        public DbSet<AnnouncementRead> AnnouncementReads { get; set; }

        // Phone Extension System
        public DbSet<Extension> Extensions { get; set; }

        // Logistics System
        public DbSet<Models.Logistics.Driver> Drivers { get; set; }
        public DbSet<Models.Logistics.Vehicle> Vehicles { get; set; }
        public DbSet<Models.Logistics.VehicleType> VehicleTypes { get; set; }
        public DbSet<Models.Logistics.Customer> LogisticsCustomers { get; set; }
        public DbSet<Models.Logistics.Warehouse> Warehouses { get; set; }
        public DbSet<Models.Logistics.Commodity> Commodities { get; set; }
        public DbSet<Models.Logistics.Load> Loads { get; set; }
        public DbSet<Models.Logistics.LoadItem> LoadItems { get; set; }
        public DbSet<Models.Logistics.LoadStop> LoadStops { get; set; }
        public DbSet<Models.Logistics.StopCommodity> StopCommodities { get; set; }
        public DbSet<Models.Logistics.WarehouseInventory> WarehouseInventory { get; set; }
        public DbSet<Models.Logistics.StockTransfer> StockTransfers { get; set; }
        public DbSet<Models.Logistics.Backorder> Backorders { get; set; }
        public DbSet<Models.Logistics.ProofOfDelivery> ProofOfDeliveries { get; set; }
        public DbSet<Models.Logistics.Invoice> Invoices { get; set; }
        public DbSet<Models.Logistics.InvoiceLineItem> InvoiceLineItems { get; set; }
        public DbSet<Models.Logistics.VehicleMaintenance> VehicleMaintenance { get; set; }
        public DbSet<Models.Logistics.CustomerContract> CustomerContracts { get; set; }
        public DbSet<Models.Logistics.CustomerDeliveryAddress> CustomerDeliveryAddresses { get; set; }
        public DbSet<Models.Logistics.ImportedInvoice> ImportedInvoices { get; set; }
        public DbSet<Models.Logistics.ImportBatch> ImportBatches { get; set; }
        public DbSet<Models.Logistics.SleepOut> SleepOuts { get; set; }
        public DbSet<Models.Logistics.PartDeliveryHistory> PartDeliveryHistories { get; set; }

        // Sales Import System
        public DbSet<SalesImportBatch> SalesImportBatches { get; set; }
        public DbSet<SalesTransactionStaging> SalesTransactionStagings { get; set; }
        public DbSet<SalesImportIssue> SalesImportIssues { get; set; }

        // Government Contracts
        public DbSet<GovernmentContract> GovernmentContracts { get; set; }

        // TFN (TruckFuelNet) Integration
        public DbSet<Models.Logistics.TFN.TfnDepot> TfnDepots { get; set; }
        public DbSet<Models.Logistics.TFN.TfnOrder> TfnOrders { get; set; }
        public DbSet<Models.Logistics.TFN.TfnTransaction> TfnTransactions { get; set; }
        public DbSet<Models.Logistics.TFN.TfnAccountBalance> TfnAccountBalances { get; set; }

        // Stock on Hand Snapshots
        public DbSet<Models.Logistics.StockOnHandSnapshot> StockOnHandSnapshots { get; set; }

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

            // CRM System relationships
            modelBuilder.Entity<StaffOperatingCompany>()
                .HasOne(soc => soc.OperatingCompany)
                .WithMany(oc => oc.StaffMappings)
                .HasForeignKey(soc => soc.OperatingCompanyId)
                .OnDelete(DeleteBehavior.Cascade);

            modelBuilder.Entity<Lead>()
                .HasOne(l => l.OperatingCompany)
                .WithMany(oc => oc.Leads)
                .HasForeignKey(l => l.OperatingCompanyId)
                .OnDelete(DeleteBehavior.Restrict);

            modelBuilder.Entity<Lead>()
                .HasOne(l => l.AssignedAgent)
                .WithMany()
                .HasForeignKey(l => l.AssignedAgentId)
                .OnDelete(DeleteBehavior.SetNull);

            modelBuilder.Entity<Lead>()
                .HasOne(l => l.LeadStatus)
                .WithMany(ls => ls.Leads)
                .HasForeignKey(l => l.LeadStatusId)
                .OnDelete(DeleteBehavior.SetNull);

            modelBuilder.Entity<Lead>()
                .HasOne(l => l.Campaign)
                .WithMany(c => c.Leads)
                .HasForeignKey(l => l.CampaignId)
                .OnDelete(DeleteBehavior.SetNull);

            modelBuilder.Entity<LeadLog>()
                .HasOne(ll => ll.Lead)
                .WithMany(l => l.Logs)
                .HasForeignKey(ll => ll.LeadId)
                .OnDelete(DeleteBehavior.Cascade);

            modelBuilder.Entity<LeadLog>()
                .HasOne(ll => ll.Agent)
                .WithMany()
                .HasForeignKey(ll => ll.AgentId)
                .OnDelete(DeleteBehavior.Restrict);

            modelBuilder.Entity<LeadLog>()
                .HasOne(ll => ll.Disposition)
                .WithMany(d => d.LeadLogs)
                .HasForeignKey(ll => ll.DispositionId)
                .OnDelete(DeleteBehavior.SetNull);

            modelBuilder.Entity<LeadStatus>()
                .HasOne(ls => ls.OperatingCompany)
                .WithMany(oc => oc.LeadStatuses)
                .HasForeignKey(ls => ls.OperatingCompanyId)
                .OnDelete(DeleteBehavior.Cascade);

            modelBuilder.Entity<Disposition>()
                .HasOne(d => d.OperatingCompany)
                .WithMany(oc => oc.Dispositions)
                .HasForeignKey(d => d.OperatingCompanyId)
                .OnDelete(DeleteBehavior.Cascade);

            modelBuilder.Entity<Campaign>()
                .HasOne(c => c.OperatingCompany)
                .WithMany(oc => oc.Campaigns)
                .HasForeignKey(c => c.OperatingCompanyId)
                .OnDelete(DeleteBehavior.Restrict);

            modelBuilder.Entity<CampaignAgent>()
                .HasOne(ca => ca.Campaign)
                .WithMany(c => c.AssignedAgents)
                .HasForeignKey(ca => ca.CampaignId)
                .OnDelete(DeleteBehavior.Cascade);

            modelBuilder.Entity<CampaignAgent>()
                .HasOne(ca => ca.Agent)
                .WithMany()
                .HasForeignKey(ca => ca.AgentId)
                .OnDelete(DeleteBehavior.Restrict);

            modelBuilder.Entity<Promotion>()
                .HasOne(p => p.OperatingCompany)
                .WithMany(oc => oc.Promotions)
                .HasForeignKey(p => p.OperatingCompanyId)
                .OnDelete(DeleteBehavior.Restrict);

            modelBuilder.Entity<LeadInterest>()
                .HasOne(li => li.Lead)
                .WithMany(l => l.Interests)
                .HasForeignKey(li => li.LeadId)
                .OnDelete(DeleteBehavior.Cascade);

            modelBuilder.Entity<LeadInterest>()
                .HasOne(li => li.Promotion)
                .WithMany(p => p.LeadInterests)
                .HasForeignKey(li => li.PromotionId)
                .OnDelete(DeleteBehavior.SetNull);

            modelBuilder.Entity<LeadAssignmentHistory>()
                .HasOne(lah => lah.Lead)
                .WithMany(l => l.AssignmentHistory)
                .HasForeignKey(lah => lah.LeadId)
                .OnDelete(DeleteBehavior.Cascade);

            // CRM Indexes
            modelBuilder.Entity<Lead>()
                .HasIndex(l => new { l.OperatingCompanyId, l.AssignedAgentId });

            modelBuilder.Entity<Lead>()
                .HasIndex(l => new { l.OperatingCompanyId, l.LeadStatusId });

            modelBuilder.Entity<Lead>()
                .HasIndex(l => l.NextCallbackAt);

            modelBuilder.Entity<Lead>()
                .HasIndex(l => l.Phone);

            modelBuilder.Entity<LeadLog>()
                .HasIndex(ll => new { ll.LeadId, ll.LogDateTime });

            modelBuilder.Entity<StaffOperatingCompany>()
                .HasIndex(soc => new { soc.StaffMemberId, soc.OperatingCompanyId })
                .IsUnique();

            // Meeting System relationships
            modelBuilder.Entity<Meeting>()
                .HasOne(m => m.Organizer)
                .WithMany()
                .HasForeignKey(m => m.OrganizerId)
                .OnDelete(DeleteBehavior.Restrict);

            modelBuilder.Entity<MeetingAttendee>()
                .HasOne(ma => ma.Meeting)
                .WithMany(m => m.Attendees)
                .HasForeignKey(ma => ma.MeetingId)
                .OnDelete(DeleteBehavior.Cascade);

            modelBuilder.Entity<MeetingAttendee>()
                .HasOne(ma => ma.User)
                .WithMany()
                .HasForeignKey(ma => ma.UserId)
                .OnDelete(DeleteBehavior.Restrict);

            modelBuilder.Entity<MeetingNotification>()
                .HasOne(mn => mn.Meeting)
                .WithMany()
                .HasForeignKey(mn => mn.MeetingId)
                .OnDelete(DeleteBehavior.Cascade);

            modelBuilder.Entity<MeetingNotification>()
                .HasOne(mn => mn.User)
                .WithMany()
                .HasForeignKey(mn => mn.UserId)
                .OnDelete(DeleteBehavior.Restrict);

            // Announcement System relationships
            modelBuilder.Entity<Announcement>()
                .HasOne(a => a.CreatedByUser)
                .WithMany()
                .HasForeignKey(a => a.CreatedByUserId)
                .OnDelete(DeleteBehavior.Restrict);

            modelBuilder.Entity<AnnouncementRead>()
                .HasOne(ar => ar.Announcement)
                .WithMany(a => a.ReadByUsers)
                .HasForeignKey(ar => ar.AnnouncementId)
                .OnDelete(DeleteBehavior.Cascade);

            modelBuilder.Entity<AnnouncementRead>()
                .HasOne(ar => ar.User)
                .WithMany()
                .HasForeignKey(ar => ar.UserId)
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
                    Role = "Super Admin",
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

            // Seed CRM Operating Companies
            modelBuilder.Entity<OperatingCompany>().HasData(
                new OperatingCompany { OperatingCompanyId = 1, Name = "PromedTechnologies", Code = "PROMED", Description = "Medical technology solutions", PrimaryColor = "#1e90ff", IsActive = true, CreatedAt = seedDate },
                new OperatingCompany { OperatingCompanyId = 2, Name = "AccessMedical", Code = "ACCMED", Description = "Medical access solutions", PrimaryColor = "#28a745", IsActive = true, CreatedAt = seedDate },
                new OperatingCompany { OperatingCompanyId = 3, Name = "Pharmatech", Code = "PHARMA", Description = "Pharmaceutical technology", PrimaryColor = "#6f42c1", IsActive = true, CreatedAt = seedDate },
                new OperatingCompany { OperatingCompanyId = 4, Name = "SebenzaniTrading", Code = "SEBENZ", Description = "Trading solutions", PrimaryColor = "#fd7e14", IsActive = true, CreatedAt = seedDate }
            );

            // Seed CRM Lead Statuses (for each operating company)
            var leadStatusId = 1;
            foreach (var companyId in new[] { 1, 2, 3, 4 })
            {
                modelBuilder.Entity<LeadStatus>().HasData(
                    new LeadStatus { LeadStatusId = leadStatusId++, OperatingCompanyId = companyId, Name = "New", Description = "New lead", Color = "#17a2b8", Icon = "fiber_new", SortOrder = 1, IsDefault = true, CreatedAt = seedDate },
                    new LeadStatus { LeadStatusId = leadStatusId++, OperatingCompanyId = companyId, Name = "Attempting Contact", Description = "Trying to reach", Color = "#ffc107", Icon = "phone_callback", SortOrder = 2, CreatedAt = seedDate },
                    new LeadStatus { LeadStatusId = leadStatusId++, OperatingCompanyId = companyId, Name = "Contacted", Description = "Successfully contacted", Color = "#28a745", Icon = "phone_in_talk", SortOrder = 3, CreatedAt = seedDate },
                    new LeadStatus { LeadStatusId = leadStatusId++, OperatingCompanyId = companyId, Name = "Qualified", Description = "Qualified lead", Color = "#007bff", Icon = "verified", SortOrder = 4, CreatedAt = seedDate },
                    new LeadStatus { LeadStatusId = leadStatusId++, OperatingCompanyId = companyId, Name = "Follow-up", Description = "Needs follow-up", Color = "#6f42c1", Icon = "schedule", SortOrder = 5, CreatedAt = seedDate },
                    new LeadStatus { LeadStatusId = leadStatusId++, OperatingCompanyId = companyId, Name = "Won", Description = "Deal closed successfully", Color = "#28a745", Icon = "emoji_events", SortOrder = 6, IsFinal = true, CreatedAt = seedDate },
                    new LeadStatus { LeadStatusId = leadStatusId++, OperatingCompanyId = companyId, Name = "Lost", Description = "Deal lost", Color = "#dc3545", Icon = "cancel", SortOrder = 7, IsFinal = true, CreatedAt = seedDate }
                );
            }

            // Seed CRM Dispositions (for each operating company)
            var dispositionId = 1;
            foreach (var companyId in new[] { 1, 2, 3, 4 })
            {
                modelBuilder.Entity<Disposition>().HasData(
                    new Disposition { DispositionId = dispositionId++, OperatingCompanyId = companyId, Name = "No Answer", Description = "No one answered", Color = "#6c757d", Icon = "phone_missed", SortOrder = 1, CreatedAt = seedDate },
                    new Disposition { DispositionId = dispositionId++, OperatingCompanyId = companyId, Name = "Voicemail", Description = "Left voicemail", Color = "#17a2b8", Icon = "voicemail", SortOrder = 2, CreatedAt = seedDate },
                    new Disposition { DispositionId = dispositionId++, OperatingCompanyId = companyId, Name = "Invalid Number", Description = "Number is invalid", Color = "#dc3545", Icon = "phone_disabled", SortOrder = 3, IsFinal = true, CreatedAt = seedDate },
                    new Disposition { DispositionId = dispositionId++, OperatingCompanyId = companyId, Name = "Not Interested", Description = "Not interested in offer", Color = "#dc3545", Icon = "thumb_down", SortOrder = 4, IsFinal = true, CreatedAt = seedDate },
                    new Disposition { DispositionId = dispositionId++, OperatingCompanyId = companyId, Name = "Interested - Call Back", Description = "Interested, schedule callback", Color = "#28a745", Icon = "event", SortOrder = 5, RequiresCallback = true, IsPositive = true, CreatedAt = seedDate },
                    new Disposition { DispositionId = dispositionId++, OperatingCompanyId = companyId, Name = "Interested - Send Info", Description = "Send more information", Color = "#28a745", Icon = "mail", SortOrder = 6, IsPositive = true, CreatedAt = seedDate },
                    new Disposition { DispositionId = dispositionId++, OperatingCompanyId = companyId, Name = "Decision Maker Not Available", Description = "Need to reach decision maker", Color = "#ffc107", Icon = "person_search", SortOrder = 7, RequiresCallback = true, CreatedAt = seedDate },
                    new Disposition { DispositionId = dispositionId++, OperatingCompanyId = companyId, Name = "DNC", Description = "Do Not Call", Color = "#dc3545", Icon = "block", SortOrder = 8, IsFinal = true, IsDoNotCall = true, CreatedAt = seedDate }
                );
            }

            // Seed Staff Operating Company mappings (Admin user has access to all)
            modelBuilder.Entity<StaffOperatingCompany>().HasData(
                new StaffOperatingCompany { StaffOperatingCompanyId = 1, StaffMemberId = 1, OperatingCompanyId = 1, CompanyRole = "SalesManager", IsPrimaryCompany = true, IsActive = true, CreatedAt = seedDate },
                new StaffOperatingCompany { StaffOperatingCompanyId = 2, StaffMemberId = 1, OperatingCompanyId = 2, CompanyRole = "SalesManager", IsActive = true, CreatedAt = seedDate },
                new StaffOperatingCompany { StaffOperatingCompanyId = 3, StaffMemberId = 1, OperatingCompanyId = 3, CompanyRole = "SalesManager", IsActive = true, CreatedAt = seedDate },
                new StaffOperatingCompany { StaffOperatingCompanyId = 4, StaffMemberId = 1, OperatingCompanyId = 4, CompanyRole = "SalesManager", IsActive = true, CreatedAt = seedDate }
            );

            // Logistics System relationships
            modelBuilder.Entity<Models.Logistics.Vehicle>()
                .HasOne(v => v.VehicleType)
                .WithMany(vt => vt.Vehicles)
                .HasForeignKey(v => v.VehicleTypeId)
                .OnDelete(DeleteBehavior.Restrict);

            modelBuilder.Entity<Models.Logistics.Vehicle>()
                .HasOne(v => v.CurrentDriver)
                .WithMany(d => d.Vehicles)
                .HasForeignKey(v => v.CurrentDriverId)
                .OnDelete(DeleteBehavior.SetNull);

            modelBuilder.Entity<Models.Logistics.Load>()
                .HasOne(l => l.Customer)
                .WithMany(c => c.Loads)
                .HasForeignKey(l => l.CustomerId)
                .OnDelete(DeleteBehavior.Restrict);

            modelBuilder.Entity<Models.Logistics.Load>()
                .HasOne(l => l.Vehicle)
                .WithMany(v => v.Loads)
                .HasForeignKey(l => l.VehicleId)
                .OnDelete(DeleteBehavior.SetNull);

            modelBuilder.Entity<Models.Logistics.Load>()
                .HasOne(l => l.Driver)
                .WithMany(d => d.Loads)
                .HasForeignKey(l => l.DriverId)
                .OnDelete(DeleteBehavior.SetNull);

            modelBuilder.Entity<Models.Logistics.LoadItem>()
                .HasOne(li => li.Load)
                .WithMany(l => l.LoadItems)
                .HasForeignKey(li => li.LoadId)
                .OnDelete(DeleteBehavior.Cascade);

            modelBuilder.Entity<Models.Logistics.LoadItem>()
                .HasOne(li => li.Commodity)
                .WithMany(c => c.LoadItems)
                .HasForeignKey(li => li.CommodityId)
                .OnDelete(DeleteBehavior.Restrict);

            modelBuilder.Entity<Models.Logistics.LoadStop>()
                .HasOne(ls => ls.Load)
                .WithMany(l => l.Stops)
                .HasForeignKey(ls => ls.LoadId)
                .OnDelete(DeleteBehavior.Cascade);

            // StopCommodity relationships
            modelBuilder.Entity<Models.Logistics.StopCommodity>()
                .HasOne(sc => sc.LoadStop)
                .WithMany(ls => ls.Commodities)
                .HasForeignKey(sc => sc.LoadStopId)
                .OnDelete(DeleteBehavior.Cascade);

            modelBuilder.Entity<Models.Logistics.StopCommodity>()
                .HasOne(sc => sc.Commodity)
                .WithMany()
                .HasForeignKey(sc => sc.CommodityId)
                .OnDelete(DeleteBehavior.Restrict);

            modelBuilder.Entity<Models.Logistics.StopCommodity>()
                .HasOne(sc => sc.Contract)
                .WithMany()
                .HasForeignKey(sc => sc.ContractId)
                .OnDelete(DeleteBehavior.Restrict);

            // LoadStop Customer and Warehouse relationships
            modelBuilder.Entity<Models.Logistics.LoadStop>()
                .HasOne(ls => ls.Customer)
                .WithMany()
                .HasForeignKey(ls => ls.CustomerId)
                .OnDelete(DeleteBehavior.Restrict);

            modelBuilder.Entity<Models.Logistics.LoadStop>()
                .HasOne(ls => ls.Warehouse)
                .WithMany()
                .HasForeignKey(ls => ls.WarehouseId)
                .OnDelete(DeleteBehavior.Restrict);

            modelBuilder.Entity<Models.Logistics.ProofOfDelivery>()
                .HasOne(pod => pod.Load)
                .WithOne(l => l.ProofOfDelivery)
                .HasForeignKey<Models.Logistics.ProofOfDelivery>(pod => pod.LoadId)
                .OnDelete(DeleteBehavior.Cascade);

            modelBuilder.Entity<Models.Logistics.WarehouseInventory>()
                .HasOne(wi => wi.Warehouse)
                .WithMany(w => w.Inventory)
                .HasForeignKey(wi => wi.WarehouseId)
                .OnDelete(DeleteBehavior.Cascade);

            modelBuilder.Entity<Models.Logistics.WarehouseInventory>()
                .HasOne(wi => wi.Commodity)
                .WithMany(c => c.InventoryRecords)
                .HasForeignKey(wi => wi.CommodityId)
                .OnDelete(DeleteBehavior.Restrict);

            modelBuilder.Entity<Models.Logistics.StockTransfer>()
                .HasOne(st => st.FromWarehouse)
                .WithMany(w => w.TransfersFrom)
                .HasForeignKey(st => st.FromWarehouseId)
                .OnDelete(DeleteBehavior.Restrict);

            modelBuilder.Entity<Models.Logistics.StockTransfer>()
                .HasOne(st => st.ToWarehouse)
                .WithMany(w => w.TransfersTo)
                .HasForeignKey(st => st.ToWarehouseId)
                .OnDelete(DeleteBehavior.Restrict);

            modelBuilder.Entity<Models.Logistics.StockTransfer>()
                .HasOne(st => st.Commodity)
                .WithMany()
                .HasForeignKey(st => st.CommodityId)
                .OnDelete(DeleteBehavior.Restrict);

            modelBuilder.Entity<Models.Logistics.Backorder>()
                .HasOne(bo => bo.Inventory)
                .WithMany(inv => inv.Backorders)
                .HasForeignKey(bo => bo.InventoryId)
                .OnDelete(DeleteBehavior.Restrict);

            modelBuilder.Entity<Models.Logistics.Backorder>()
                .HasOne(bo => bo.Customer)
                .WithMany()
                .HasForeignKey(bo => bo.CustomerId)
                .OnDelete(DeleteBehavior.Restrict);

            modelBuilder.Entity<Models.Logistics.Invoice>()
                .HasOne(i => i.Customer)
                .WithMany(c => c.Invoices)
                .HasForeignKey(i => i.CustomerId)
                .OnDelete(DeleteBehavior.Restrict);

            modelBuilder.Entity<Models.Logistics.Invoice>()
                .HasOne(i => i.Load)
                .WithOne(l => l.Invoice)
                .HasForeignKey<Models.Logistics.Invoice>(i => i.LoadId)
                .OnDelete(DeleteBehavior.SetNull);

            modelBuilder.Entity<Models.Logistics.InvoiceLineItem>()
                .HasOne(ili => ili.Invoice)
                .WithMany(i => i.LineItems)
                .HasForeignKey(ili => ili.InvoiceId)
                .OnDelete(DeleteBehavior.Cascade);

            modelBuilder.Entity<Models.Logistics.VehicleMaintenance>()
                .HasOne(vm => vm.Vehicle)
                .WithMany(v => v.MaintenanceRecords)
                .HasForeignKey(vm => vm.VehicleId)
                .OnDelete(DeleteBehavior.Cascade);

            modelBuilder.Entity<Models.Logistics.CustomerContract>()
                .HasOne(cc => cc.Customer)
                .WithMany(c => c.Contracts)
                .HasForeignKey(cc => cc.CustomerId)
                .OnDelete(DeleteBehavior.Cascade);

            // CustomerDeliveryAddress - explicitly configure relationship to LogisticsCustomers
            modelBuilder.Entity<Models.Logistics.CustomerDeliveryAddress>()
                .HasOne(cda => cda.Customer)
                .WithMany(c => c.DeliveryAddresses)
                .HasForeignKey(cda => cda.CustomerId)
                .OnDelete(DeleteBehavior.Cascade);
        }
    }
}
