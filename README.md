# WhatsAgent AI Dashboard (RAG + WhatsApp + Gemini)

A professional dashboard for monitoring WhatsApp conversations, managing Knowledge Base (RAG), and handling human-bot handovers with Gemini AI assistance.

## 🏗 Architecture (Split Deployment)

1.  **Frontend (Dashboard):** React + Vite. Deployed to **Netlify/Vercel**.
2.  **Backend (Worker):** Node.js + Baileys. Deployed to **VPS (Linux)/Railway**.
3.  **Database:** Supabase (PostgreSQL + pgvector).

---

## 🚀 Part 1: Frontend Setup (Netlify)

The dashboard connects to Supabase to read messages and manage settings.

### Environment Variables (Netlify)
Go to **Site Settings > Environment Variables** and add:

```bash
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-public-anon-key
VITE_GEMINI_API_KEY=your-google-gemini-api-key
```

*Note: Use the `ANON` key here. Never use the Service key on the frontend.*

---

## ⚙️ Part 2: Backend Worker Setup (Linux VPS)

The worker runs the WhatsApp socket connection and listens for messages 24/7.

### 1. Prepare Server
Connect to your VPS and create a folder:
```bash
mkdir wa-worker
cd wa-worker
```

### 2. Upload Code
You can clone this repo and copy the `server/` folder content, or upload `server/index.js` and `server/package.json` manually.

### 3. Install Dependencies
```bash
npm install
```

### 4. Create .env File (Crucial!)
Create a file named `.env` in the same folder as `index.js`:
```bash
nano .env
```

Paste your credentials (use the **SERVICE_ROLE** key here for full access):
```ini
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_KEY=your-secret-service-role-key
GEMINI_API_KEY=your-google-gemini-api-key
```
*Save with CTRL+X, then Y, then Enter.*

### 5. Run the Worker
Use PM2 to keep it running in the background:
```bash
npm install -g pm2
pm2 start index.js --name wa-worker
pm2 save
pm2 logs
```

---

## 🗄 Database Setup (Supabase)

1.  Go to Supabase **SQL Editor**.
2.  Copy the SQL script found in the Dashboard under **Settings > Database Setup**.
3.  Run the script to create tables (`messages`, `conversations`, `knowledge_base`, etc.) and enable Vector extensions.

## 🔄 How it Works

1.  **User sends message to WA** -> Worker receives it via Baileys.
2.  **Worker** saves message to Supabase `messages` table.
3.  **Worker** uses Gemini + RAG to generate a reply (or hands over to human if no answer found).
4.  **Dashboard** listens to Supabase Realtime and updates the UI instantly.
5.  **Admin replies via Dashboard** -> Saved to DB -> Worker detects outbound message -> Sends to WA.
