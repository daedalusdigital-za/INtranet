# Quick Start Guide - Project Tracker

## ⚡ Fast Setup (Development)

### 1. Start Backend API (5 minutes)

```powershell
# Navigate to Backend
cd "C:\Users\IT Department\Desktop\ProjectTracker\Backend"

# Run database migrations
dotnet ef database update

# Start the API
dotnet run
```

✅ API running at: **https://localhost:7000**

### 2. Start Frontend (3 minutes)

```powershell
# Open new terminal
cd "C:\Users\IT Department\Desktop\ProjectTracker\Frontend"

# Start Angular app
ng serve
```

✅ App running at: **http://localhost:4200**

### 3. Login

Open browser: `http://localhost:4200`

**Default Admin:**
- Email: `admin@company.com`
- Password: `Admin123!`

---

## 📊 What You'll See

1. **Dashboard** - View all departments
2. **Department Boards** - Click any department to see its Kanban board
3. **Drag & Drop** - Move cards between lists (To Do, In Progress, Completed)
4. **Real-time Sync** - Open multiple browser tabs to see live updates

---

## 🎯 Quick Feature Tour

### For Admins
- Manage departments and users
- Full access to all boards

### For Managers
- Create and manage boards in their department
- Add lists and organize projects

### For All Users
- Create and move cards
- Add comments and attachments
- Track assigned tasks
- Set due dates

---

## 🔧 Troubleshooting

### Database Issues
```powershell
# Delete database and recreate
dotnet ef database drop
dotnet ef database update
```

### Port Already in Use
```powershell
# Backend - change port in Properties/launchSettings.json
# Frontend - use different port
ng serve --port 4201
```

### CORS Errors
Check that Frontend URL matches CORS policy in `Backend/Program.cs`:
```csharp
policy.WithOrigins("http://localhost:4200")
```

---

## 📚 Next Steps

1. ✅ Explore the dashboard
2. ✅ Create a new board (if you're a manager/admin)
3. ✅ Add cards and move them around
4. ✅ Try commenting on a card
5. ✅ Open multiple browser windows to see real-time updates
6. 📖 Read full documentation in README.md
7. 🚀 Deploy to Azure (see DEPLOYMENT.md)

---

## 🎨 Customize

### Change Theme
Edit `Frontend/src/styles.scss` - choose different Material theme

### Add Logo
Replace `Frontend/src/assets/logo.png`

### Update Company Name
Search and replace "Project Tracker" in:
- `Backend/Program.cs`
- `Frontend/src/index.html`
- README.md

---

## 💡 Pro Tips

- **Keyboard shortcuts**: Ctrl+Click on card to open details (future feature)
- **Filters**: Use search to find specific cards (future feature)
- **Bulk actions**: Select multiple cards (future feature)
- **Export**: Download board as PDF (future feature)

---

## 🆘 Need Help?

- 📧 Email: IT Department
- 💬 Teams: #project-tracker channel
- 📞 Ext: 1234

Happy tracking! 🎉
