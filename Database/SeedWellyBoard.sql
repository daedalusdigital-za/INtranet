-- =============================================
-- Seed: Welly - Internal AI Assistant
-- Project Management Board
-- Date: March 20, 2026
-- Board ID: 32
-- =============================================

USE ProjectTrackerDB;
GO

-- Clean up if re-running
DELETE FROM BoardChecklistItems WHERE BoardId = 32;
DELETE FROM Cards WHERE ListId IN (SELECT ListId FROM Lists WHERE BoardId = 32);
DELETE FROM Lists WHERE BoardId = 32;
DELETE FROM BoardMembers WHERE BoardId = 32;
DELETE FROM Boards WHERE BoardId = 32;
GO

SET IDENTITY_INSERT Boards ON;
INSERT INTO Boards (BoardId, Title, Description, DepartmentId, CreatedByUserId, Status, CreatedAt, UpdatedAt)
VALUES (32,
  'Welly - Internal AI Assistant',
  'ProMed Technologies internal AI assistant powered by Qwen2.5-14B via llama.cpp. Features SSE streaming chat, RAG with 12 database domains, 20 executable actions, document analysis, sales reports, stock analysis, web search, multi-provider fallback (LocalLLM > Claude > Ollama > Rule-based). Global chatbot on all pages.',
  14, 1, 'Active', GETDATE(), GETDATE());
SET IDENTITY_INSERT Boards OFF;
GO

INSERT INTO BoardMembers (BoardId, UserId, Role, InvitedAt, InvitedByUserId)
VALUES (32, 1, 'Admin', GETDATE(), 1);
GO

-- =============================================
-- LISTS (Kanban Columns)
-- =============================================
DECLARE @CompletedListId INT;
DECLARE @InProgressListId INT;
DECLARE @PendingListId INT;
DECLARE @BacklogListId INT;

INSERT INTO Lists (BoardId, Title, Position, CreatedAt) VALUES (32, 'Completed', 0, GETDATE());
SET @CompletedListId = SCOPE_IDENTITY();

INSERT INTO Lists (BoardId, Title, Position, CreatedAt) VALUES (32, 'In Progress', 1, GETDATE());
SET @InProgressListId = SCOPE_IDENTITY();

INSERT INTO Lists (BoardId, Title, Position, CreatedAt) VALUES (32, 'Pending', 2, GETDATE());
SET @PendingListId = SCOPE_IDENTITY();

INSERT INTO Lists (BoardId, Title, Position, CreatedAt) VALUES (32, 'Backlog', 3, GETDATE());
SET @BacklogListId = SCOPE_IDENTITY();

-- =============================================
-- COMPLETED CARDS
-- =============================================

-- 1. LLM Infrastructure
INSERT INTO Cards (ListId, Title, Description, Status, Position, CreatedAt, UpdatedAt, CreatedByUserId)
VALUES (@CompletedListId,
  'LLM Server Infrastructure',
  'Qwen2.5-14B-Instruct (Q4_K_M, ~9GB) running via llama.cpp server on port 8090. OpenAI-compatible API. 16K context window, 2 parallel slots, flash attention, continuous batching, mlock. Start script: start-llm-server.ps1. 12 gen threads, 24 batch threads.',
  'Completed', 0, GETDATE(), GETDATE(), 1);

-- 2. Multi-Provider Fallback
INSERT INTO Cards (ListId, Title, Description, Status, Position, CreatedAt, UpdatedAt, CreatedByUserId)
VALUES (@CompletedListId,
  'Multi-Provider Fallback Chain',
  'Priority chain: 1) LocalLLM (Qwen2.5-14B via llama.cpp) 2) Claude (claude-sonnet-4-20250514 via API) 3) Ollama (phi3:mini, disabled) 4) Rule-based keyword fallback (always available). Automatic failover ensures Welly never goes completely offline.',
  'Completed', 1, GETDATE(), GETDATE(), 1);

-- 3. Global Chatbot UI
INSERT INTO Cards (ListId, Title, Description, Status, Position, CreatedAt, UpdatedAt, CreatedByUserId)
VALUES (@CompletedListId,
  'Global Floating Chatbot UI',
  'Chatbot component rendered globally via app-chatbot when user is logged in. Hidden on login page. Toggle open/close, minimize, streaming responses, file upload (PDF/Excel/CSV), session persistence via sessionStorage (last 50 messages). Welly avatar with branding.',
  'Completed', 2, GETDATE(), GETDATE(), 1);

-- 4. SSE Streaming Chat
INSERT INTO Cards (ListId, Title, Description, Status, Position, CreatedAt, UpdatedAt, CreatedByUserId)
VALUES (@CompletedListId,
  'SSE Streaming Chat',
  'Server-Sent Events streaming for real-time token-by-token delivery. Endpoints: POST /api/aichat/chat (streaming), POST /api/aichat/chat/simple (non-streaming JSON). Chat service uses EventSource API with RxJS observables for action result pipeline.',
  'Completed', 3, GETDATE(), GETDATE(), 1);

-- 5. Session-Based Conversation Memory
INSERT INTO Cards (ListId, Title, Description, Status, Position, CreatedAt, UpdatedAt, CreatedByUserId)
VALUES (@CompletedListId,
  'Session-Based Conversation Memory',
  'ChatSessionService - Server-side in-memory conversation history. 1-hour expiration with auto-cleanup. 20-message limit per session. Session ID stored in sessionStorage (welly_session_id). Endpoint: POST /api/aichat/chat/session, DELETE to clear.',
  'Completed', 4, GETDATE(), GETDATE(), 1);

-- 6. RAG - Database Context Injection
INSERT INTO Cards (ListId, Title, Description, Status, Position, CreatedAt, UpdatedAt, CreatedByUserId)
VALUES (@CompletedListId,
  'RAG - 12-Domain Database Context',
  'AIChatContextService (1,019 lines) - Detects query domains and fetches real-time DB data. Domains: employees, attendance, leave, customers, invoices, sales, tenders, fleet, logistics, tripsheets, announcements, stock. Injects relevant context into LLM prompts.',
  'Completed', 5, GETDATE(), GETDATE(), 1);

-- 7. Knowledge Base Document Search
INSERT INTO Cards (ListId, Title, Description, Status, Position, CreatedAt, UpdatedAt, CreatedByUserId)
VALUES (@CompletedListId,
  'Knowledge Base Document Search',
  'KnowledgeBaseService (576 lines) - Document ingestion, chunking, TF-IDF search for KB articles. Loads from kb-docs/ folder: Employee HR Guide, Leave Policy, IT Support, Logistics, Stock Inventory, System Features guides.',
  'Completed', 6, GETDATE(), GETDATE(), 1);

-- 8. AI Actions System
INSERT INTO Cards (ListId, Title, Description, Status, Position, CreatedAt, UpdatedAt, CreatedByUserId)
VALUES (@CompletedListId,
  'AI Actions System (20 Actions)',
  'AIChatActionService (2,302 lines) - Parses [ACTION:TYPE] tags from AI output and executes them. Actions: CREATE_TICKET, CREATE_MEETING, SEND_EMAIL, ASSIGN_TODO, TRACK_VEHICLE, FLEET_STATUS, UPDATE_CUSTOMER, LOOKUP_ADDRESS, EDIT_EMPLOYEE, RESET_PASSWORD, SYSTEM_OVERVIEW, CREATE_ANNOUNCEMENT, SEARCH_WEB, BACKUP_DATABASE, plus 5 tripsheet workflow steps.',
  'Completed', 7, GETDATE(), GETDATE(), 1);

-- 9. Guided Tripsheet Creation
INSERT INTO Cards (ListId, Title, Description, Status, Position, CreatedAt, UpdatedAt, CreatedByUserId)
VALUES (@CompletedListId,
  'Guided Tripsheet Creation Workflow',
  '5-step guided workflow via chat: 1) TRIPSHEET_GET_WAREHOUSES 2) TRIPSHEET_GET_INVOICES 3) TRIPSHEET_PREVIEW (route) 4a) TRIPSHEET_GET_DRIVERS 4b) TRIPSHEET_GET_VEHICLES 5) TRIPSHEET_CREATE. Conversational UX for logistics tripsheet creation.',
  'Completed', 8, GETDATE(), GETDATE(), 1);

-- 10. File Upload & Analysis
INSERT INTO Cards (ListId, Title, Description, Status, Position, CreatedAt, UpdatedAt, CreatedByUserId)
VALUES (@CompletedListId,
  'File Upload & Document Analysis',
  'Supports PDF, Excel (XLSX), CSV uploads. Endpoints: POST /api/aichat/upload-document and /api/aichat/upload-pdf. Extracts text content, sends to LLM for analysis. Used in global chatbot and tender analysis features.',
  'Completed', 9, GETDATE(), GETDATE(), 1);

-- 11. Tender Document Analysis
INSERT INTO Cards (ListId, Title, Description, Status, Position, CreatedAt, UpdatedAt, CreatedByUserId)
VALUES (@CompletedListId,
  'Tender Document Analysis',
  'Deep tender analysis endpoint: POST /api/aichat/tender-document-analyze. Reads tender docs from DB, extracts text. Tender Detail Dialog offers: Analyze documents, Pricing review, Extract BOQ, Analyze BOQ, Check compliance. Tender reminders via email.',
  'Completed', 10, GETDATE(), GETDATE(), 1);

-- 12. Doc Editor AI Tools
INSERT INTO Cards (ListId, Title, Description, Status, Position, CreatedAt, UpdatedAt, CreatedByUserId)
VALUES (@CompletedListId,
  'Doc Editor AI Writing Tools',
  'Integrated into collaborative document editor. Features: Grammar fix, Summarize, Rewrite, Improve, Generate new content, OCR cleanup. Translate to 7 languages: Afrikaans, Zulu, Xhosa, Sotho, Tswana, French, Portuguese. Compose email from content.',
  'Completed', 11, GETDATE(), GETDATE(), 1);

-- 13. Stock Analysis with Charts
INSERT INTO Cards (ListId, Title, Description, Status, Position, CreatedAt, UpdatedAt, CreatedByUserId)
VALUES (@CompletedListId,
  'Comprehensive Stock Analysis',
  'POST /api/aichat/welly-stock-comprehensive - AI-powered warehouse stock analysis with chart data. Stock by building, top items, invoice status, load status breakdowns. Integrated in stock management component.',
  'Completed', 12, GETDATE(), GETDATE(), 1);

-- 14. Sales Reports
INSERT INTO Cards (ListId, Title, Description, Status, Position, CreatedAt, UpdatedAt, CreatedByUserId)
VALUES (@CompletedListId,
  'AI Sales Reports with Charts',
  'POST /api/aichat/welly-sales-report - 4 report types: sales-summary, customer-analysis, province-breakdown, product-performance. Generates charts and narrative. Report caching to avoid regeneration. Welly report panel in Sales Dashboard.',
  'Completed', 13, GETDATE(), GETDATE(), 1);

-- 15. Web Search
INSERT INTO Cards (ListId, Title, Description, Status, Position, CreatedAt, UpdatedAt, CreatedByUserId)
VALUES (@CompletedListId,
  'Web Search via SearXNG',
  'SEARCH_WEB action type. Welly can search the internet using local SearXNG instance on localhost:8888. Results are fetched, summarized, and returned to user in conversational format. Privacy-focused metasearch engine.',
  'Completed', 14, GETDATE(), GETDATE(), 1);

-- 16. Email from AI Identity
INSERT INTO Cards (ListId, Title, Description, Status, Position, CreatedAt, UpdatedAt, CreatedByUserId)
VALUES (@CompletedListId,
  'Email from Welly Identity',
  'SEND_EMAIL action. Sends emails from ai@promedtechnologies.co.za via mail.promedtechnologies.co.za:587. Sender name: "Welly - ProMed AI Assistant". Used for tender reminders, notifications, and user-requested emails.',
  'Completed', 15, GETDATE(), GETDATE(), 1);

-- 17. User Context Awareness
INSERT INTO Cards (ListId, Title, Description, Status, Position, CreatedAt, UpdatedAt, CreatedByUserId)
VALUES (@CompletedListId,
  'User Context Awareness',
  'JWT token parsing extracts user name, role, department, userId. Welly personalizes responses based on who is asking. Role-based action restrictions (e.g., RESET_PASSWORD requires admin). Context passed to system prompt.',
  'Completed', 16, GETDATE(), GETDATE(), 1);

-- 18. Health Monitoring
INSERT INTO Cards (ListId, Title, Description, Status, Position, CreatedAt, UpdatedAt, CreatedByUserId)
VALUES (@CompletedListId,
  'Health Monitoring Endpoint',
  'GET /api/aichat/health (AllowAnonymous) - Returns current provider, model name, availability status. Used by frontend to check if Welly is online before sending messages. Enables graceful degradation.',
  'Completed', 17, GETDATE(), GETDATE(), 1);

-- 19. System Prompt
INSERT INTO Cards (ListId, Title, Description, Status, Position, CreatedAt, UpdatedAt, CreatedByUserId)
VALUES (@CompletedListId,
  'System Prompt Engineering',
  'ai-data/prompts/system.txt (~100 lines). Defines Welly identity, data access capabilities, response guidelines (1-3 sentences, warm/professional), all 20+ action tag specs, tripsheet workflow, company info (ProMed Technologies, 8:00-17:00).',
  'Completed', 18, GETDATE(), GETDATE(), 1);

-- 20. Message Drafting & Translation
INSERT INTO Cards (ListId, Title, Description, Status, Position, CreatedAt, UpdatedAt, CreatedByUserId)
VALUES (@CompletedListId,
  'Message Drafting & Translation',
  'Integrated into messaging component. Draft message with AI, translate messages to multiple languages, summarize conversation threads. Uses POST /api/aichat/welly-assist with type parameter.',
  'Completed', 19, GETDATE(), GETDATE(), 1);

-- 21. Customer Geocoding
INSERT INTO Cards (ListId, Title, Description, Status, Position, CreatedAt, UpdatedAt, CreatedByUserId)
VALUES (@CompletedListId,
  'Customer Address Geocoding',
  'UPDATE_CUSTOMER and LOOKUP_ADDRESS actions. Validates and geocodes customer addresses via Google Maps API. Auto-fills coordinates. Customer fix suggestions in Sales Dashboard for data quality improvement.',
  'Completed', 20, GETDATE(), GETDATE(), 1);

-- 22. Backend Service Architecture
INSERT INTO Cards (ListId, Title, Description, Status, Position, CreatedAt, UpdatedAt, CreatedByUserId)
VALUES (@CompletedListId,
  'Backend Service Architecture',
  'AiChatController (1,935 lines, 12 endpoints). Services: LocalLlmService (567 lines), AIChatContextService (1,019 lines - RAG), AIChatActionService (2,302 lines - actions), ChatSessionService (241 lines), KnowledgeBaseService (576 lines), ClaudeAIService, OllamaAIService, FallbackAIService (765 lines).',
  'Completed', 21, GETDATE(), GETDATE(), 1);

-- 23. Welly Assist Generic Endpoint
INSERT INTO Cards (ListId, Title, Description, Status, Position, CreatedAt, UpdatedAt, CreatedByUserId)
VALUES (@CompletedListId,
  'Welly Assist Multi-Purpose Endpoint',
  'POST /api/aichat/welly-assist - Generic endpoint used across the app. Supports types: writing, stock, tenders, messages, OCR. Each component calls with its specific context. Centralizes AI functionality for non-chat use cases.',
  'Completed', 22, GETDATE(), GETDATE(), 1);

-- =============================================
-- IN PROGRESS CARDS
-- =============================================

INSERT INTO Cards (ListId, Title, Description, Status, Position, CreatedAt, UpdatedAt, CreatedByUserId)
VALUES (@InProgressListId,
  'Model Evaluation: DeepSeek-R1 vs Qwen2.5',
  'DeepSeek-R1-Distill-Qwen-14B (Q4_K_M, ~8.7GB) was downloaded and tested alongside Qwen2.5-14B. Evaluating reasoning quality, response speed, and accuracy for different use cases. Currently running Qwen2.5-14B in production.',
  'In Progress', 0, GETDATE(), GETDATE(), 1);

INSERT INTO Cards (ListId, Title, Description, Status, Position, CreatedAt, UpdatedAt, CreatedByUserId)
VALUES (@InProgressListId,
  'Update ai-data/README.md Model Documentation',
  'The ai-data/README.md still references TinyLlama-1.1B (outdated). Actual production model is Qwen2.5-14B-Instruct. Needs updating to reflect current model, configuration, and performance characteristics.',
  'In Progress', 1, GETDATE(), GETDATE(), 1);

INSERT INTO Cards (ListId, Title, Description, Status, Position, CreatedAt, UpdatedAt, CreatedByUserId)
VALUES (@InProgressListId,
  'Optimize RAG Context Window Usage',
  'With 16K context window and 12 RAG domains, context injection can consume significant tokens. Need to optimize context selection, limit injected data size, and prioritize most relevant information per query.',
  'In Progress', 2, GETDATE(), GETDATE(), 1);

-- =============================================
-- PENDING CARDS
-- =============================================

INSERT INTO Cards (ListId, Title, Description, Status, Position, CreatedAt, UpdatedAt, CreatedByUserId)
VALUES (@PendingListId,
  'Fine-Tuning with Company Data',
  'Training dataset exists at ai-data/training/dataset.jsonl (8 basic instruction-output pairs). Needs expansion with real company Q&A, HR policies, product knowledge. Fine-tune Qwen2.5-14B on company-specific data for better accuracy.',
  'Planning', 0, GETDATE(), GETDATE(), 1);

INSERT INTO Cards (ListId, Title, Description, Status, Position, CreatedAt, UpdatedAt, CreatedByUserId)
VALUES (@PendingListId,
  'Chat History Persistence to Database',
  'Currently chat sessions are in-memory (1-hour expiry). Implement database persistence for chat history. Allow users to review past conversations. Enable analytics on common queries and pain points.',
  'Planning', 1, GETDATE(), GETDATE(), 1);

INSERT INTO Cards (ListId, Title, Description, Status, Position, CreatedAt, UpdatedAt, CreatedByUserId)
VALUES (@PendingListId,
  'Conversation Analytics Dashboard',
  'Build admin dashboard showing: total conversations, common topics, action execution stats, average response time, fallback rate, user satisfaction metrics. Help identify areas for AI improvement.',
  'Planning', 2, GETDATE(), GETDATE(), 1);

INSERT INTO Cards (ListId, Title, Description, Status, Position, CreatedAt, UpdatedAt, CreatedByUserId)
VALUES (@PendingListId,
  'Expand Knowledge Base Articles',
  'Current KB has 6 articles in kb-docs/. Add more company-specific documentation: product catalogs, pricing guides, technical specs, onboarding materials, SOPs. Improve TF-IDF search relevance.',
  'Planning', 3, GETDATE(), GETDATE(), 1);

INSERT INTO Cards (ListId, Title, Description, Status, Position, CreatedAt, UpdatedAt, CreatedByUserId)
VALUES (@PendingListId,
  'User Feedback on AI Responses',
  'Add thumbs up/down feedback buttons on each Welly response. Store feedback in database. Use for fine-tuning data collection and identifying low-quality responses that need prompt engineering fixes.',
  'Planning', 4, GETDATE(), GETDATE(), 1);

INSERT INTO Cards (ListId, Title, Description, Status, Position, CreatedAt, UpdatedAt, CreatedByUserId)
VALUES (@PendingListId,
  'Welly Admin Panel',
  'Admin page to manage Welly: view active sessions, switch LLM provider, edit system prompt, view action execution logs, manage KB documents, monitor token usage and response latency.',
  'Planning', 5, GETDATE(), GETDATE(), 1);

INSERT INTO Cards (ListId, Title, Description, Status, Position, CreatedAt, UpdatedAt, CreatedByUserId)
VALUES (@PendingListId,
  'Proactive Notifications',
  'Welly proactively notifies users about: upcoming meetings, overdue tasks, low stock alerts, leave balance reminders, birthday wishes. Push via chatbot or email based on user preference.',
  'Planning', 6, GETDATE(), GETDATE(), 1);

INSERT INTO Cards (ListId, Title, Description, Status, Position, CreatedAt, UpdatedAt, CreatedByUserId)
VALUES (@PendingListId,
  'Role-Based Response Customization',
  'Customize Welly responses based on user role. Managers see team summaries, executives see KPI dashboards, HR sees leave analytics, logistics sees delivery stats. Personalized daily briefings.',
  'Planning', 7, GETDATE(), GETDATE(), 1);

-- =============================================
-- BACKLOG CARDS
-- =============================================

INSERT INTO Cards (ListId, Title, Description, Status, Position, CreatedAt, UpdatedAt, CreatedByUserId)
VALUES (@BacklogListId,
  'Voice Input/Output Support',
  'Add speech-to-text for voice input and text-to-speech for Welly responses. Web Speech API for browser-based STT. Consider Azure Cognitive Services for higher accuracy. Hands-free interaction for warehouse/logistics staff.',
  'Planning', 0, GETDATE(), GETDATE(), 1);

INSERT INTO Cards (ListId, Title, Description, Status, Position, CreatedAt, UpdatedAt, CreatedByUserId)
VALUES (@BacklogListId,
  'Image Understanding (Vision)',
  'Upgrade to a vision-capable model or add a vision API. Allow users to upload photos of stock, receipts, equipment for Welly to analyze. Useful for warehouse inventory verification.',
  'Planning', 1, GETDATE(), GETDATE(), 1);

INSERT INTO Cards (ListId, Title, Description, Status, Position, CreatedAt, UpdatedAt, CreatedByUserId)
VALUES (@BacklogListId,
  'Multi-Language System Prompt',
  'While doc editor supports 7 language translations, the chatbot system prompt is English-only. Add ability for Welly to detect user language preference and respond in their preferred language automatically.',
  'Planning', 2, GETDATE(), GETDATE(), 1);

INSERT INTO Cards (ListId, Title, Description, Status, Position, CreatedAt, UpdatedAt, CreatedByUserId)
VALUES (@BacklogListId,
  'Scheduled Report Generation',
  'Allow users to schedule recurring AI reports (daily sales summary, weekly stock report, monthly analytics). Welly generates and emails reports on schedule. Cron-based backend job.',
  'Planning', 3, GETDATE(), GETDATE(), 1);

INSERT INTO Cards (ListId, Title, Description, Status, Position, CreatedAt, UpdatedAt, CreatedByUserId)
VALUES (@BacklogListId,
  'Welly Mobile Companion',
  'Lightweight mobile-friendly chat interface for Welly. Progressive Web App (PWA) or responsive design optimization. Push notifications for proactive alerts. Quick actions for common tasks.',
  'Planning', 4, GETDATE(), GETDATE(), 1);

INSERT INTO Cards (ListId, Title, Description, Status, Position, CreatedAt, UpdatedAt, CreatedByUserId)
VALUES (@BacklogListId,
  'GPU Acceleration Support',
  'Currently running on CPU (48 threads). Investigate GPU acceleration with CUDA or Vulkan backends for llama.cpp. Could significantly reduce response latency for larger context windows.',
  'Planning', 5, GETDATE(), GETDATE(), 1);

-- =============================================
-- BOARD CHECKLIST ITEMS
-- =============================================

-- Completed items
INSERT INTO BoardChecklistItems (BoardId, Title, IsCompleted, Position, CreatedAt, CompletedAt, CompletedByUserId)
VALUES
(32, 'Set up llama.cpp server with Qwen2.5-14B-Instruct model', 1, 0, GETDATE(), GETDATE(), 1),
(32, 'Build AiChatController with 12 API endpoints', 1, 1, GETDATE(), GETDATE(), 1),
(32, 'Implement SSE streaming for real-time chat responses', 1, 2, GETDATE(), GETDATE(), 1),
(32, 'Create global floating chatbot component (visible on all pages)', 1, 3, GETDATE(), GETDATE(), 1),
(32, 'Build ChatService with EventSource API and RxJS observables', 1, 4, GETDATE(), GETDATE(), 1),
(32, 'Implement multi-provider fallback chain (LocalLLM > Claude > Ollama > Rule-based)', 1, 5, GETDATE(), GETDATE(), 1),
(32, 'Build AIChatContextService with 12 RAG domains', 1, 6, GETDATE(), GETDATE(), 1),
(32, 'Build AIChatActionService with 20 executable action types', 1, 7, GETDATE(), GETDATE(), 1),
(32, 'Implement session-based conversation memory (20 msg, 1hr expiry)', 1, 8, GETDATE(), GETDATE(), 1),
(32, 'Build KnowledgeBaseService with document chunking and TF-IDF search', 1, 9, GETDATE(), GETDATE(), 1),
(32, 'Create 6 knowledge base articles (HR, Leave, IT, Logistics, Stock, System)', 1, 10, GETDATE(), GETDATE(), 1),
(32, 'Implement file upload and analysis (PDF, Excel, CSV)', 1, 11, GETDATE(), GETDATE(), 1),
(32, 'Build guided 5-step tripsheet creation workflow', 1, 12, GETDATE(), GETDATE(), 1),
(32, 'Integrate Welly into Doc Editor (grammar, summarize, rewrite, translate 7 languages)', 1, 13, GETDATE(), GETDATE(), 1),
(32, 'Integrate Welly into Tenders (document analysis, BOQ, compliance, pricing)', 1, 14, GETDATE(), GETDATE(), 1),
(32, 'Build AI sales reports with 4 report types and chart generation', 1, 15, GETDATE(), GETDATE(), 1),
(32, 'Build comprehensive stock analysis with charts', 1, 16, GETDATE(), GETDATE(), 1),
(32, 'Implement web search via SearXNG on port 8888', 1, 17, GETDATE(), GETDATE(), 1),
(32, 'Configure email sending from ai@promedtechnologies.co.za', 1, 18, GETDATE(), GETDATE(), 1),
(32, 'Implement user context awareness via JWT token parsing', 1, 19, GETDATE(), GETDATE(), 1),
(32, 'Create system prompt with action specifications (~100 lines)', 1, 20, GETDATE(), GETDATE(), 1),
(32, 'Integrate Welly message drafting and translation in messaging', 1, 21, GETDATE(), GETDATE(), 1),
(32, 'Implement customer address geocoding via Google Maps API', 1, 22, GETDATE(), GETDATE(), 1),
(32, 'Build health monitoring endpoint (GET /api/aichat/health)', 1, 23, GETDATE(), GETDATE(), 1),
(32, 'Implement report caching to avoid regeneration', 1, 24, GETDATE(), GETDATE(), 1),
(32, 'Build rule-based FallbackAIService (765 lines) for offline mode', 1, 25, GETDATE(), GETDATE(), 1),
(32, 'Configure Claude API as backup provider', 1, 26, GETDATE(), GETDATE(), 1),
(32, 'Add Welly customer review/fix suggestions in Sales Dashboard', 1, 27, GETDATE(), GETDATE(), 1),
(32, 'Implement sessionStorage persistence for chat messages (50 msg limit)', 1, 28, GETDATE(), GETDATE(), 1),
(32, 'Download and test DeepSeek-R1-Distill-Qwen-14B as alternative model', 1, 29, GETDATE(), GETDATE(), 1);

-- Outstanding items
INSERT INTO BoardChecklistItems (BoardId, Title, IsCompleted, Position, CreatedAt)
VALUES
(32, 'Update ai-data/README.md to reflect Qwen2.5-14B (remove TinyLlama refs)', 0, 30, GETDATE()),
(32, 'Complete DeepSeek-R1 vs Qwen2.5 evaluation and choose production model', 0, 31, GETDATE()),
(32, 'Optimize RAG context window usage (limit injected data size)', 0, 32, GETDATE()),
(32, 'Expand training dataset beyond 8 basic examples', 0, 33, GETDATE()),
(32, 'Fine-tune model on company-specific Q&A data', 0, 34, GETDATE()),
(32, 'Implement chat history persistence to database', 0, 35, GETDATE()),
(32, 'Build conversation analytics dashboard for admins', 0, 36, GETDATE()),
(32, 'Add more KB articles (product catalogs, SOPs, onboarding)', 0, 37, GETDATE()),
(32, 'Add thumbs up/down feedback on AI responses', 0, 38, GETDATE()),
(32, 'Build Welly admin panel (sessions, provider switch, prompt editor)', 0, 39, GETDATE()),
(32, 'Implement proactive notifications (meetings, tasks, stock alerts)', 0, 40, GETDATE()),
(32, 'Build role-based response customization and daily briefings', 0, 41, GETDATE()),
(32, 'Add voice input/output support (Web Speech API)', 0, 42, GETDATE()),
(32, 'Investigate image understanding / vision model capabilities', 0, 43, GETDATE()),
(32, 'Add auto-detect language and respond in user preferred language', 0, 44, GETDATE()),
(32, 'Implement scheduled recurring report generation', 0, 45, GETDATE()),
(32, 'Optimize for mobile/PWA with push notifications', 0, 46, GETDATE()),
(32, 'Investigate GPU acceleration (CUDA/Vulkan) for llama.cpp', 0, 47, GETDATE());

GO

-- =============================================
-- Verify
-- =============================================
SELECT 'Board' AS Entity, COUNT(*) AS Count FROM Boards WHERE BoardId = 32
UNION ALL
SELECT 'Lists', COUNT(*) FROM Lists WHERE BoardId = 32
UNION ALL
SELECT 'Cards', COUNT(*) FROM Cards WHERE ListId IN (SELECT ListId FROM Lists WHERE BoardId = 32)
UNION ALL
SELECT 'Checklist Items', COUNT(*) FROM BoardChecklistItems WHERE BoardId = 32
UNION ALL
SELECT 'Completed Items', COUNT(*) FROM BoardChecklistItems WHERE BoardId = 32 AND IsCompleted = 1
UNION ALL
SELECT 'Outstanding Items', COUNT(*) FROM BoardChecklistItems WHERE BoardId = 32 AND IsCompleted = 0;
GO
