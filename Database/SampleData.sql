-- Project Tracker - Sample Data SQL Script
-- Run this after initial migration to populate sample data

USE ProjectTrackerDb;
GO

-- Clear existing data (optional - comment out if you want to keep existing data)
DELETE FROM CardAttachments;
DELETE FROM CardComments;
DELETE FROM Cards;
DELETE FROM Lists;
DELETE FROM Boards;
DELETE FROM Users;
DELETE FROM Departments;
DELETE FROM AuditLogs;
GO

-- Insert Departments
INSERT INTO Departments (Name, ManagerName, CreatedAt) VALUES
('Marketing Department', 'John Smith', GETUTCDATE()),
('IT Department', 'Jane Doe', GETUTCDATE()),
('Sales Department', 'Mike Johnson', GETUTCDATE()),
('HR Department', 'Sarah Williams', GETUTCDATE()),
('Finance Department', 'Robert Brown', GETUTCDATE()),
('Condom factory', 'David Chen', GETUTCDATE());
GO

-- Insert Users
-- Password: Admin123! (hashed with BCrypt)
INSERT INTO Users (Name, Email, PasswordHash, Role, DepartmentId, CreatedAt) VALUES
('Admin User', 'admin@company.com', '$2a$11$wq3z4LhM9QGhGVZ9YDxzje7HYG5QC5qCvW3BdU5qP5M5zk7LvXvO2', 'Admin', NULL, GETUTCDATE()),
('John Smith', 'john@company.com', '$2a$11$wq3z4LhM9QGhGVZ9YDxzje7HYG5QC5qCvW3BdU5qP5M5zk7LvXvO2', 'Manager', 1, GETUTCDATE()),
('Jane Doe', 'jane@company.com', '$2a$11$wq3z4LhM9QGhGVZ9YDxzje7HYG5QC5qCvW3BdU5qP5M5zk7LvXvO2', 'Manager', 2, GETUTCDATE()),
('Mike Johnson', 'mike@company.com', '$2a$11$wq3z4LhM9QGhGVZ9YDxzje7HYG5QC5qCvW3BdU5qP5M5zk7LvXvO2', 'Manager', 3, GETUTCDATE()),
('Sarah Williams', 'sarah@company.com', '$2a$11$wq3z4LhM9QGhGVZ9YDxzje7HYG5QC5qCvW3BdU5qP5M5zk7LvXvO2', 'Manager', 4, GETUTCDATE()),
('Emily Davis', 'emily@company.com', '$2a$11$wq3z4LhM9QGhGVZ9YDxzje7HYG5QC5qCvW3BdU5qP5M5zk7LvXvO2', 'Employee', 1, GETUTCDATE()),
('David Wilson', 'david@company.com', '$2a$11$wq3z4LhM9QGhGVZ9YDxzje7HYG5QC5qCvW3BdU5qP5M5zk7LvXvO2', 'Employee', 2, GETUTCDATE()),
('Lisa Anderson', 'lisa@company.com', '$2a$11$wq3z4LhM9QGhGVZ9YDxzje7HYG5QC5qCvW3BdU5qP5M5zk7LvXvO2', 'Employee', 3, GETUTCDATE());
GO

-- Insert Boards
INSERT INTO Boards (DepartmentId, Title, Description, CreatedAt) VALUES
(1, 'Marketing Projects 2024', 'All marketing campaigns and projects for 2024', GETUTCDATE()),
(2, 'IT Infrastructure', 'IT projects and infrastructure improvements', GETUTCDATE()),
(3, 'Sales Initiatives', 'Sales team projects and customer outreach', GETUTCDATE()),
(4, 'HR Programs', 'Employee engagement and HR initiatives', GETUTCDATE()),
(2, 'Software Development', 'Internal software development projects', GETUTCDATE());
GO

-- Insert Lists for Marketing Board (BoardId = 1)
INSERT INTO Lists (BoardId, Title, Position, CreatedAt) VALUES
(1, 'To Do', 0, GETUTCDATE()),
(1, 'In Progress', 1, GETUTCDATE()),
(1, 'Review', 2, GETUTCDATE()),
(1, 'Completed', 3, GETUTCDATE());
GO

-- Insert Lists for IT Infrastructure Board (BoardId = 2)
INSERT INTO Lists (BoardId, Title, Position, CreatedAt) VALUES
(2, 'Backlog', 0, GETUTCDATE()),
(2, 'In Progress', 1, GETUTCDATE()),
(2, 'Testing', 2, GETUTCDATE()),
(2, 'Done', 3, GETUTCDATE());
GO

-- Insert Lists for Sales Board (BoardId = 3)
INSERT INTO Lists (BoardId, Title, Position, CreatedAt) VALUES
(3, 'Planning', 0, GETUTCDATE()),
(3, 'Active', 1, GETUTCDATE()),
(3, 'Completed', 2, GETUTCDATE());
GO

-- Insert Cards for Marketing Board
INSERT INTO Cards (ListId, Title, Description, AssignedToUserId, DueDate, Status, Position, CreatedAt) VALUES
(1, 'Design calendar posters', 'Create promotional posters for company calendar 2025', 6, DATEADD(day, 14, GETUTCDATE()), 'Active', 0, GETUTCDATE()),
(1, 'Q1 2025 Campaign Planning', 'Plan marketing campaigns for Q1 2025', 2, DATEADD(day, 30, GETUTCDATE()), 'Active', 1, GETUTCDATE()),
(2, 'November campaign rollout', 'Launch November marketing campaign across all channels', 2, DATEADD(day, 7, GETUTCDATE()), 'Active', 0, GETUTCDATE()),
(2, 'Website content update', 'Update website content for holiday season', 6, DATEADD(day, 10, GETUTCDATE()), 'Active', 1, GETUTCDATE()),
(3, 'Holiday email campaign', 'Review and approve holiday email templates', 2, DATEADD(day, 3, GETUTCDATE()), 'Active', 0, GETUTCDATE()),
(4, 'Social media strategy update', 'Complete social media strategy update for Q4', 6, DATEADD(day, -7, GETUTCDATE()), 'Completed', 0, GETUTCDATE()),
(4, 'October newsletter', 'October company newsletter sent', NULL, DATEADD(day, -14, GETUTCDATE()), 'Completed', 1, GETUTCDATE());
GO

-- Insert Cards for IT Infrastructure Board
INSERT INTO Cards (ListId, Title, Description, AssignedToUserId, DueDate, Status, Position, CreatedAt) VALUES
(5, 'Server maintenance', 'Monthly server maintenance and updates', 7, DATEADD(day, 5, GETUTCDATE()), 'Active', 0, GETUTCDATE()),
(5, 'Security audit', 'Quarterly security audit of all systems', 3, DATEADD(day, 20, GETUTCDATE()), 'Active', 1, GETUTCDATE()),
(6, 'Network upgrade', 'Upgrade office network infrastructure', 7, DATEADD(day, 15, GETUTCDATE()), 'Active', 0, GETUTCDATE()),
(6, 'Backup system improvement', 'Implement new backup solution', 3, DATEADD(day, 25, GETUTCDATE()), 'Active', 1, GETUTCDATE()),
(7, 'Email migration testing', 'Test new email system before rollout', 7, DATEADD(day, 2, GETUTCDATE()), 'Active', 0, GETUTCDATE()),
(8, 'VPN setup', 'Configure VPN for remote workers', NULL, DATEADD(day, -5, GETUTCDATE()), 'Completed', 0, GETUTCDATE());
GO

-- Insert Cards for Sales Board
INSERT INTO Cards (ListId, Title, Description, AssignedToUserId, DueDate, Status, Position, CreatedAt) VALUES
(9, 'Holiday sales strategy', 'Develop strategy for holiday sales period', 4, DATEADD(day, 10, GETUTCDATE()), 'Active', 0, GETUTCDATE()),
(9, 'Customer outreach program', 'Plan customer appreciation events', 8, DATEADD(day, 15, GETUTCDATE()), 'Active', 1, GETUTCDATE()),
(10, 'November promotions', 'Launch November special promotions', 4, DATEADD(day, 5, GETUTCDATE()), 'Active', 0, GETUTCDATE()),
(10, 'Partner meetings', 'Meet with key partners for Q4 planning', 8, DATEADD(day, 8, GETUTCDATE()), 'Active', 1, GETUTCDATE()),
(11, 'Q3 sales report', 'Q3 sales report completed and delivered', NULL, DATEADD(day, -10, GETUTCDATE()), 'Completed', 0, GETUTCDATE());
GO

-- Insert Comments
INSERT INTO CardComments (CardId, UserId, Content, CreatedAt) VALUES
(3, 2, 'Campaign is showing great results so far!', GETUTCDATE()),
(3, 6, 'Social media engagement is up 25%', DATEADD(hour, -2, GETUTCDATE())),
(9, 7, 'Network upgrade is on schedule', DATEADD(day, -1, GETUTCDATE())),
(13, 4, 'Customer feedback has been very positive', DATEADD(hour, -5, GETUTCDATE()));
GO

-- Insert Audit Logs
INSERT INTO AuditLogs (UserId, Action, EntityType, EntityId, Details, CreatedAt) VALUES
(2, 'Created', 'Card', 3, 'Created card: November campaign rollout', DATEADD(day, -5, GETUTCDATE())),
(3, 'Moved', 'Card', 6, 'Moved card from To Do to Completed', DATEADD(day, -7, GETUTCDATE())),
(6, 'Updated', 'Card', 3, 'Updated card: November campaign rollout', DATEADD(hour, -12, GETUTCDATE())),
(4, 'Created', 'Board', 3, 'Created board: Sales Initiatives', DATEADD(day, -15, GETUTCDATE()));
GO

PRINT 'Sample data inserted successfully!';
PRINT '';
PRINT 'Login Credentials (All users have same password: Admin123!)';
PRINT '------------------------------------------------------------';
PRINT 'Admin:     admin@company.com';
PRINT 'Marketing: john@company.com';
PRINT 'IT:        jane@company.com';
PRINT 'Sales:     mike@company.com';
PRINT 'HR:        sarah@company.com';
PRINT '';
PRINT 'Departments Created: 5';
PRINT 'Users Created: 8';
PRINT 'Boards Created: 5';
PRINT 'Lists Created: 11';
PRINT 'Cards Created: 18';
GO
