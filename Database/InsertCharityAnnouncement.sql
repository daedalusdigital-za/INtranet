INSERT INTO Announcements (Title, Content, CreatedByUserId, CreatedAt, ExpiresAt, Priority, IsActive, Category)
VALUES (
  N'🎉 Company Charity Event - 24 January! 🎉',
  N'Get ready team! We are thrilled to announce that our company will be hosting an exciting CHARITY EVENT on the 24th of January! 🌟

This is your chance to come together, have an amazing time, and make a real difference in the lives of those who need it most. Whether it is fun activities, incredible raffles, or heartwarming moments — this event promises to be one for the books!

🗓️ Date: 24 January 2026
📍 More details coming soon!

Let us show the world what our team is made of — big hearts and even bigger smiles! Start spreading the word and get pumped! 💪❤️

Every contribution counts. Together, we can change lives!',
  1,
  GETDATE(),
  '2026-01-25T23:59:59',
  N'High',
  1,
  N'Event'
);

SELECT AnnouncementId, Title, Priority, Category, IsActive, CreatedAt FROM Announcements WHERE Title LIKE '%Charity%';
