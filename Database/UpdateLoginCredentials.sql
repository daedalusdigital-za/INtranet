-- Update admin user login credentials
UPDATE Users 
SET Email = 'welcome@promedtechnologies.co.za',
    PasswordHash = 'Kingsland',
    Role = 'Super Admin'
WHERE UserId = 1;

SELECT * FROM Users WHERE UserId = 1;
