-- Add Finance permission to Super Admin
UPDATE Users 
SET Permissions = '["logistics","project_management","stock_management","support_tickets","calendar","ai","messaging","documents","human_resource","tenders","sales","finance","attendance.view","attendance.manage","boards.edit","boards.delete","boards.view","boards.create","kb.manage","documents.view","documents.upload","documents.delete","reports.view","reports.export","messages.send","users.view","users.edit","users.create","users.delete","users.reset-password","support.manage"]'
WHERE Email = 'welcome@promedtechnologies.co.za';

SELECT Email, Role, Permissions FROM Users WHERE Email = 'welcome@promedtechnologies.co.za';
