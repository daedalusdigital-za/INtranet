# Testing Guide - Project Tracker

## 🧪 Quick Test Checklist

### Backend API Testing

#### 1. Start the Backend
```powershell
cd Backend
dotnet run
```

#### 2. Open Swagger UI
Navigate to: `https://localhost:7000/swagger`

#### 3. Test Authentication
**Login Test:**
```json
POST /api/auth/login
{
  "email": "admin@company.com",
  "password": "Admin123!"
}
```
✅ Should return: JWT token + user details

**Copy the token** - you'll need it for other requests!

#### 4. Test Departments (Authorized)
In Swagger, click "Authorize" and paste: `Bearer YOUR_TOKEN_HERE`

```
GET /api/departments
```
✅ Should return: List of 5 departments

#### 5. Test Boards
```
GET /api/boards/department/1
```
✅ Should return: Marketing department boards with lists and cards

#### 6. Test Card Movement
```json
PUT /api/cards/1/move
{
  "targetListId": 2,
  "position": 0
}
```
✅ Should move card to different list

---

### Frontend Testing

#### 1. Start Frontend
```powershell
cd Frontend
ng serve
```
Navigate to: `http://localhost:4200`

#### 2. Login Flow
- [ ] Enter email: admin@company.com
- [ ] Enter password: Admin123!
- [ ] Click Login
- [ ] Should redirect to dashboard

#### 3. Dashboard Tests
- [ ] See 5 department cards
- [ ] Each card shows board count and user count
- [ ] Hover effect works on cards
- [ ] Click a department card

#### 4. Board View Tests
- [ ] Board title shows correct department
- [ ] See multiple lists (To Do, In Progress, etc.)
- [ ] Each list shows cards
- [ ] Card count displays in list header

#### 5. Drag-and-Drop Tests
- [ ] Click and hold a card
- [ ] Drag to different list
- [ ] Drop the card
- [ ] Card moves to new list
- [ ] **Open second browser tab** with same board
- [ ] Both tabs should show the move in real-time!

#### 6. Real-time Sync Test
**Two Browser Windows:**
1. Open `http://localhost:4200` in Chrome
2. Open `http://localhost:4200` in Edge (or Chrome Incognito)
3. Login to both
4. Navigate both to same board
5. In Window 1: Move a card
6. In Window 2: Card should move automatically! ✨

---

## 🎯 Feature Testing Matrix

### Authentication & Authorization

| Test | Steps | Expected Result | Status |
|------|-------|----------------|--------|
| Valid Login | Use admin@company.com / Admin123! | Redirect to dashboard | ✅ |
| Invalid Login | Use wrong password | Error message shown | ✅ |
| Token Storage | Login, check localStorage | Token saved | ✅ |
| Logout | Click logout | Return to login | ✅ |
| Protected Route | Navigate to /dashboard without login | Redirect to login | ✅ |

### Dashboard

| Test | Steps | Expected Result | Status |
|------|-------|----------------|--------|
| Load Departments | Login and view dashboard | See 5 departments | ✅ |
| Department Stats | Check cards | Board count and user count visible | ✅ |
| Navigation | Click Marketing dept | Navigate to board view | ✅ |

### Board View

| Test | Steps | Expected Result | Status |
|------|-------|----------------|--------|
| Load Board | Navigate to board | Lists and cards displayed | ✅ |
| Card Display | View card | Title, description, assignee shown | ✅ |
| Drag Card (Same List) | Drag within list | Card reorders | ✅ |
| Drag Card (Different List) | Drag to another list | Card moves lists | ✅ |

### Real-time Features

| Test | Steps | Expected Result | Status |
|------|-------|----------------|--------|
| SignalR Connection | Open board | Console shows "SignalR Connected" | ✅ |
| Card Move Sync | Move card in one tab | Other tabs update automatically | ✅ |
| Multi-user Test | Two users move cards | Both see updates | ✅ |

---

## 🔍 API Endpoint Testing with Postman

### 1. Setup Postman Collection

**Base URL:** `https://localhost:7000/api`

### 2. Authentication

**POST** `/auth/login`
```json
{
  "email": "admin@company.com",
  "password": "Admin123!"
}
```

**Save the token** to environment variable: `{{token}}`

### 3. Test Endpoints

#### Get All Departments
```
GET /departments
Headers: Authorization: Bearer {{token}}
```

#### Get Board by Department
```
GET /boards/department/1
Headers: Authorization: Bearer {{token}}
```

#### Create New Card
```
POST /cards
Headers: Authorization: Bearer {{token}}
Body:
{
  "listId": 1,
  "title": "Test Card",
  "description": "Testing card creation",
  "position": 0
}
```

#### Move Card
```
PUT /cards/1/move
Headers: Authorization: Bearer {{token}}
Body:
{
  "targetListId": 2,
  "position": 0
}
```

#### Add Comment
```
POST /cards/1/comments
Headers: Authorization: Bearer {{token}}
Body:
{
  "cardId": 1,
  "content": "Great progress on this task!"
}
```

---

## 🚀 Performance Testing

### Load Test with Apache Bench

```bash
# Test API endpoint
ab -n 1000 -c 10 https://localhost:7000/api/departments
```

**Expected Results:**
- Requests per second: > 500
- Average response time: < 100ms
- Failed requests: 0

---

## 🐛 Common Issues & Solutions

### Issue: Can't connect to database
**Solution:**
```powershell
# Check SQL Server is running
sqlcmd -S (localdb)\mssqllocaldb -Q "SELECT @@VERSION"

# Recreate database
dotnet ef database drop
dotnet ef database update
```

### Issue: CORS error in browser
**Solution:**
Check Program.cs has correct frontend URL:
```csharp
policy.WithOrigins("http://localhost:4200")
```

### Issue: SignalR not connecting
**Solution:**
1. Check console for errors
2. Verify token is being sent
3. Check WebSocket support in browser
4. Review SignalR configuration in Program.cs

### Issue: Cards not dragging
**Solution:**
1. Verify Angular CDK is installed
2. Check DragDropModule is imported
3. Clear browser cache
4. Check console for errors

---

## 📊 Database Testing

### Verify Sample Data
```sql
-- Connect to database
sqlcmd -S (localdb)\mssqllocaldb -d ProjectTrackerDb

-- Run queries
SELECT COUNT(*) FROM Departments;  -- Should be 5
SELECT COUNT(*) FROM Users;        -- Should be 8
SELECT COUNT(*) FROM Boards;       -- Should be 5
SELECT COUNT(*) FROM Cards;        -- Should be 18
```

### Test Data Integrity
```sql
-- Check relationships
SELECT b.Title, d.Name, COUNT(l.ListId) as ListCount
FROM Boards b
JOIN Departments d ON b.DepartmentId = d.DepartmentId
LEFT JOIN Lists l ON b.BoardId = l.BoardId
GROUP BY b.Title, d.Name;
```

---

## 🔐 Security Testing

### Test Role-Based Access

**Admin Access:**
- ✅ Can access all departments
- ✅ Can create/delete departments
- ✅ Can register new users

**Manager Access:**
- ✅ Can manage own department boards
- ✅ Can create/delete lists
- ❌ Cannot delete other departments

**Employee Access:**
- ✅ Can view boards
- ✅ Can create/move cards
- ❌ Cannot create boards
- ❌ Cannot delete lists

### Test JWT Expiration
1. Login and get token
2. Wait 24 hours (or modify JWT expiration)
3. Try to access protected endpoint
4. Should get 401 Unauthorized

---

## 🎨 UI/UX Testing

### Visual Testing Checklist
- [ ] Login page centered and styled
- [ ] Dashboard cards have hover effect
- [ ] Drag preview shows correctly
- [ ] Cards have proper spacing
- [ ] Icons display correctly
- [ ] Due dates formatted properly
- [ ] Colors match theme
- [ ] Responsive on mobile (test at 375px width)

### Browser Compatibility
- [ ] Chrome (latest)
- [ ] Edge (latest)
- [ ] Firefox (latest)
- [ ] Safari (if available)

---

## 📱 Mobile Testing

### Responsive Breakpoints
- **Desktop:** 1920x1080
- **Laptop:** 1366x768
- **Tablet:** 768x1024
- **Mobile:** 375x667

### Mobile Features
- [ ] Login works on mobile
- [ ] Cards are scrollable
- [ ] Touch drag-and-drop works
- [ ] Text is readable
- [ ] Buttons are tappable (min 44x44px)

---

## 🎯 User Acceptance Testing (UAT)

### Scenario 1: Marketing Manager's Workflow
1. Login as john@company.com
2. Navigate to Marketing department
3. Create a new card in "To Do"
4. Assign card to Emily (Employee)
5. Move card to "In Progress"
6. Add comment on card
7. Verify audit log records all actions

### Scenario 2: Multi-Department View (GM)
1. Login as admin@company.com
2. View all 5 departments
3. Check stats for each department
4. Navigate between different boards
5. Verify can see all data

### Scenario 3: Real-time Collaboration
1. Manager opens Marketing board
2. Employee opens same board (different browser)
3. Manager creates new card
4. Employee sees new card appear
5. Employee moves card
6. Manager sees card move

---

## 📈 Success Criteria

### Backend API
✅ All endpoints return correct data
✅ Authentication works
✅ Authorization enforced
✅ Database operations succeed
✅ No errors in logs

### Frontend
✅ All pages render correctly
✅ Navigation works
✅ Drag-and-drop functional
✅ Real-time updates work
✅ No console errors

### Integration
✅ Frontend connects to API
✅ SignalR establishes connection
✅ Data persists in database
✅ Changes sync in real-time

---

## 🎓 Testing Best Practices

1. **Always test with multiple users** - Catch concurrency issues
2. **Test on different browsers** - Ensure compatibility
3. **Check network tab** - Verify API calls
4. **Monitor console** - Catch JavaScript errors
5. **Test edge cases** - Empty lists, long text, etc.
6. **Verify database** - Check data is saved correctly
7. **Test error scenarios** - Network failures, invalid data

---

## 🆘 Getting Help

If tests fail:
1. Check console logs (F12 in browser)
2. Check API logs in terminal
3. Verify database connection
4. Review error messages
5. Check this guide for solutions
6. Contact IT Department

---

## ✅ Final Verification

Before deployment, verify:
- [ ] All tests pass
- [ ] No console errors
- [ ] Database has correct data
- [ ] Authentication works
- [ ] Authorization is enforced
- [ ] Real-time sync functional
- [ ] Performance acceptable
- [ ] Mobile responsive

**Ready for Production!** 🚀
