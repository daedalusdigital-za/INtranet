-- Merge duplicate departments into the short-named record. Nothing is deleted: the losing record is
-- deactivated and points at the survivor (MergedIntoDepartmentId) so old links and history still resolve.
-- Every table that references a department by id or by name is re-pointed.
--
-- Link counts on 2 Nov 2026 (users / employees / flows / other):
--   Sales(30)      21 / 9 / 1 / 0   <- survivor        Sales Department(15)      0 / 0 / 0 / 1 (BookDepartmentAccess)
--   Finance(35)     0 / 2 / 0 / 0                       Finance Department(17)    1 / 7 / 8 / 1   ** holds most links -> confirm **
--   Marketing(34)   1 / 0 / 0 / 0                       Marketing Department(13)  0 / 0 / 1 / 1   ** 3 Nov: there is no Marketing dept — both fold into IT Department(14) **
SET NOCOUNT ON;

IF OBJECT_ID('tempdb..#Merge') IS NOT NULL DROP TABLE #Merge;
CREATE TABLE #Merge (LoserId int, SurvivorId int, LoserName nvarchar(100), SurvivorName nvarchar(100));

-- ── Approved: Sales (applied 2 Nov) ────────────────────────────────────────────────────────────
INSERT INTO #Merge SELECT 15, 30, 'Sales Department', 'Sales';

-- ── Approved 3 Nov: Marketing falls under IT ───────────────────────────────────────────────────
INSERT INTO #Merge SELECT 13, 14, 'Marketing Department', 'IT Department';
INSERT INTO #Merge SELECT 34, 14, 'Marketing', 'IT Department';

-- skip merges already applied (safe to re-run)
DELETE m FROM #Merge m JOIN Departments d ON d.DepartmentId = m.LoserId WHERE d.IsActive = 0;

-- ── Pending confirmation (uncomment after sign-off) ─────────────────────────────────────────────
-- INSERT INTO #Merge SELECT 17, 35, 'Finance Department', 'Finance';

BEGIN TRAN;

-- carry the manager across when the survivor has none
UPDATE s SET ManagerName = l.ManagerName
FROM Departments s JOIN #Merge m ON m.SurvivorId = s.DepartmentId JOIN Departments l ON l.DepartmentId = m.LoserId
WHERE (s.ManagerName IS NULL OR s.ManagerName = '') AND l.ManagerName IS NOT NULL AND l.ManagerName <> '';

-- by id
UPDATE t SET DepartmentId = m.SurvivorId FROM Users t JOIN #Merge m ON t.DepartmentId = m.LoserId;
UPDATE t SET DepartmentId = m.SurvivorId FROM Boards t JOIN #Merge m ON t.DepartmentId = m.LoserId;
UPDATE t SET DepartmentId = m.SurvivorId FROM BookInvoices t JOIN #Merge m ON t.DepartmentId = m.LoserId;
UPDATE t SET DepartmentId = m.SurvivorId FROM ExpenseCategories t JOIN #Merge m ON t.DepartmentId = m.LoserId;
UPDATE t SET DepartmentId = m.SurvivorId FROM ExpenseTrackerItems t JOIN #Merge m ON t.DepartmentId = m.LoserId;
UPDATE t SET DepartmentId = m.SurvivorId FROM Extensions t JOIN #Merge m ON t.DepartmentId = m.LoserId;
UPDATE t SET DepartmentId = m.SurvivorId FROM RecurringPayments t JOIN #Merge m ON t.DepartmentId = m.LoserId;
UPDATE t SET AssignedToDepartmentId = m.SurvivorId FROM FlowTasks t JOIN #Merge m ON t.AssignedToDepartmentId = m.LoserId;
-- BookDepartmentAccess is one Books password per department; keep the survivor's row if it has one, else move the loser's
DELETE a FROM BookDepartmentAccess a JOIN #Merge m ON a.DepartmentId = m.LoserId
WHERE EXISTS (SELECT 1 FROM BookDepartmentAccess b WHERE b.DepartmentId = m.SurvivorId);
UPDATE a SET DepartmentId = m.SurvivorId, DepartmentName = m.SurvivorName FROM BookDepartmentAccess a JOIN #Merge m ON a.DepartmentId = m.LoserId;

-- by name
UPDATE t SET Department = m.SurvivorName FROM empregistration t JOIN #Merge m ON t.Department = m.LoserName;
UPDATE t SET Department = m.SurvivorName FROM Employees t JOIN #Merge m ON t.Department = m.LoserName;
UPDATE t SET Department = m.SurvivorName FROM HrEmployees t JOIN #Merge m ON t.Department = m.LoserName;
UPDATE t SET Department = m.SurvivorName FROM HrRegisterEntries t JOIN #Merge m ON t.Department = m.LoserName;
UPDATE t SET Department = m.SurvivorName FROM attendance t JOIN #Merge m ON t.Department = m.LoserName;
UPDATE t SET Department = m.SurvivorName FROM LeaveRequests t JOIN #Merge m ON t.Department = m.LoserName;
UPDATE t SET Department = m.SurvivorName FROM Budgets t JOIN #Merge m ON t.Department = m.LoserName;
UPDATE t SET Department = m.SurvivorName FROM Expenses t JOIN #Merge m ON t.Department = m.LoserName;
UPDATE t SET Department = m.SurvivorName FROM PurchaseOrders t JOIN #Merge m ON t.Department = m.LoserName;
UPDATE t SET Department = m.SurvivorName FROM Requisitions t JOIN #Merge m ON t.Department = m.LoserName;
UPDATE t SET Department = m.SurvivorName FROM RequisitionInvoices t JOIN #Merge m ON t.Department = m.LoserName;
UPDATE t SET Department = m.SurvivorName FROM StationeryRequests t JOIN #Merge m ON t.Department = m.LoserName;
UPDATE t SET Department = m.SurvivorName FROM CondomDeliveryRequests t JOIN #Merge m ON t.Department = m.LoserName;
UPDATE t SET Department = m.SurvivorName FROM EmailAccounts t JOIN #Merge m ON t.Department = m.LoserName;
UPDATE t SET DepartmentName = m.SurvivorName FROM FlowDefinitions t JOIN #Merge m ON t.DepartmentName = m.LoserName;
UPDATE t SET DepartmentName = m.SurvivorName FROM FlowWidgets t JOIN #Merge m ON t.DepartmentName = m.LoserName;

-- retire the loser
UPDATE d SET IsActive = 0, MergedIntoDepartmentId = m.SurvivorId, UpdatedAt = SYSUTCDATETIME()
FROM Departments d JOIN #Merge m ON d.DepartmentId = m.LoserId;

COMMIT;

SELECT d.DepartmentId, d.Name, d.IsActive, d.MergedIntoDepartmentId, d.ManagerName,
       (SELECT COUNT(*) FROM Users u WHERE u.DepartmentId = d.DepartmentId) users,
       (SELECT COUNT(*) FROM empregistration e WHERE e.Department = d.Name) emps,
       (SELECT COUNT(*) FROM FlowDefinitions f WHERE f.DepartmentName = d.Name) flows
FROM Departments d WHERE d.DepartmentId IN (SELECT LoserId FROM #Merge UNION SELECT SurvivorId FROM #Merge);
