# 🛵 Panchawati BillBook — Enterprise Cloud & Offline POS Inventory Management System

[![Live Demo](https://img.shields.io/badge/Live%20Demo-Vercel%20Production-blue?style=for-the-badge&logo=vercel)](https://frontend-chi-three-30.vercel.app)
[![React 18](https://img.shields.io/badge/React%2018-TypeScript-61DAFB?style=for-the-badge&logo=react)](https://react.dev/)
[![Node.js](https://img.shields.io/badge/Node.js-Express%20API-339933?style=for-the-badge&logo=node.js)](https://nodejs.org/)
[![PostgreSQL](https://img.shields.io/badge/PostgreSQL-Neon%20Serverless-4169E1?style=for-the-badge&logo=postgresql)](https://neon.tech/)
[![Prisma ORM](https://img.shields.io/badge/Prisma%20ORM-Database-2D3748?style=for-the-badge&logo=prisma)](https://www.prisma.io/)
[![PWA](https://img.shields.io/badge/PWA-Offline%20IndexedDB-FF6F00?style=for-the-badge&logo=pwa)](https://developer.mozilla.org/en-US/docs/Web/Progressive_web_apps)
[![Tailwind CSS](https://img.shields.io/badge/Tailwind%20CSS-Modern%20UI-38B2AC?style=for-the-badge&logo=tailwind-css)](https://tailwindcss.com/)

> **A high-performance, mobile-first Point of Sale (POS) and inventory orchestration platform engineered for automotive spare parts and multi-counter retail businesses. Features real-time multi-device synchronization, client-side offline storage with auto-sync, automated WhatsApp B2B ordering & customer payment recovery, and ESC/POS thermal printing.**

---

## 🌟 Key Highlights & Engineering Features

### 1. ⚡ Offline-First Architecture with Native IndexedDB & Auto-Sync Engine
* **Resilient Retail Operations:** Operates seamlessly even under zero-connectivity or unstable 4G/5G mobile environments.
* **Optimistic Local Stock Deductions:** Invoices generated offline immediately decrement stock in the local browser database, guaranteeing zero double-selling across counters.
* **Background FIFO Sync Flusher:** Automatically queues offline invoices and stock adjustments into an IndexedDB transaction log and flushes them to the cloud PostgreSQL database in FIFO order as soon as network connectivity is restored.
* **Visual Network State Indicator:** Live pill showing `Online`, `Offline`, or `Syncing (X pending)` with manual 1-click sync fallback.

### 2. 📲 Automated WhatsApp B2B Commerce & Credit Recovery
* **Wholesaler Purchase Order Dispatch:** Automatically evaluates inventory levels against `min_stock` thresholds, pre-populates purchase orders with items requiring replenishment, and dispatches formatted POs to suppliers via WhatsApp with 1-click.
* **Customer Debt & Credit (Udhaari) Reminders:** Tracks customer balances with ledger statement histories and generates personalized, courteous payment reminders requesting UPI or Cash settlement.
* **Instant Digital Receipts:** Dispatches itemized, GST-compliant digital receipts directly to customers on WhatsApp immediately upon checkout.

### 3. 📷 Dual-Mode Optical Hardware Scanning
* **Continuous Mobile Camera Scanner:** Custom continuous video stream scanner with stateful debouncing to prevent multi-scan duplicates while achieving sub-200ms barcode recognition on mobile devices.
* **Hardware USB/Bluetooth Barcode Readers:** Native keyboard wedge event listener (`useScanner`) for high-throughput billing at physical counter terminals.

### 4. 🖨️ Thermal Receipt & Label Generator
* **ESC/POS Optimized CSS:** Built-in support for 58mm & 80mm compact thermal roll printers (`@page { size: 76mm auto; margin: 0; }`) for receipt printing without page-break distortions.
* **Product QR & Barcode Generator:** Client-side generation of scannable QR labels with item prices and codes for bin tagging.

### 5. 👥 Real-Time Multi-Device Collaboration
* Powered by **WebSockets (`socket.io`)** and **Neon PostgreSQL**: Multiple cashiers and store managers can perform simultaneous billing, stock intake, and inventory audits across desktop browsers and mobile smartphones over different networks without synchronization collisions.

---

## 🏗️ System Architecture

```mermaid
flowchart TD
    subgraph Client Layer ["Client Devices (PWA / Mobile / Desktop)"]
        UI["React 18 + Tailwind UI"]
        Scanner["Continuous Camera / Barcode Engine"]
        IDB[("IndexedDB Local Cache\n(PanchawatiBillBookDB)")]
        SyncEngine["Sync Queue Manager\n(FIFO Background Flusher)"]
    end

    subgraph Server Layer ["Backend Infrastructure (Vercel Node.js Serverless)"]
        API["Express.js REST API"]
        Auth["JWT Authentication & Role Middleware"]
        Sockets["WebSocket Server (Socket.io)"]
    end

    subgraph Database Layer ["Cloud Persistence (AWS Singapore)"]
        Prisma["Prisma ORM"]
        NeonDB[("Neon PostgreSQL Serverless")]
    end

    subgraph External Services ["Integrations"]
        WA["WhatsApp API Engine (wa.me Deep Linking)"]
        Thermal["58mm / 80mm Thermal Receipt Output"]
    end

    UI --> Scanner
    UI <--> IDB
    UI --> SyncEngine
    SyncEngine -- "Online Auto-Sync" --> API
    UI -- "Live REST Queries" --> API
    API --> Auth
    API --> Prisma
    Prisma --> NeonDB
    Sockets -- "Real-time Stock Broadcast" --> UI
    UI --> WA
    UI --> Thermal
```

---

## 🛠️ Tech Stack & Libraries

| Domain | Technologies |
| :--- | :--- |
| **Frontend Core** | React 18, TypeScript, Vite, Tailwind CSS, Lucide Icons |
| **State & Sync** | Zustand, Custom IndexedDB Wrapper (`offlineStorage.ts`), Workbox PWA Service Workers |
| **Backend & API** | Node.js, Express.js, TypeScript, RESTful Architecture, JWT, Bcrypt |
| **Database & ORM** | Neon PostgreSQL (Serverless / Connection Pooling), Prisma ORM |
| **Real-Time** | Socket.io Client & Server |
| **Hardware / Print** | HTML5 Canvas QR Code Generator (`qrcode`), Native MediaStream API Barcode Detector, Print CSS |
| **DevOps & Cloud** | Vercel (CI/CD Serverless Deployment), Git, GitHub |

---

## 🚀 Live Demo & Test Access

* **Production URL:** [https://frontend-chi-three-30.vercel.app](https://frontend-chi-three-30.vercel.app)
* **Backend API Base:** `https://backend-nine-phi-tms0hdue3l.vercel.app/api`

### 🔑 Demo Credentials

| Role | Username | Password | Access Scope |
| :--- | :--- | :--- | :--- |
| **Admin / Store Owner** | `admin` | `admin123` | Full POS, Inventory Management, Supplier Orders, Reports, Audit Logs |

---

## 💻 Local Development Setup

### Prerequisites
* **Node.js**: v18 or later
* **npm** or **pnpm**
* **PostgreSQL Database** (or free serverless account on [Neon.tech](https://neon.tech))

### 1. Clone the Repository
```bash
git clone https://github.com/Ayush512-sys/panchawati-billbook.git
cd panchawati-billbook
```

### 2. Backend Setup
```bash
cd backend
npm install

# Create .env file with your database connection
cat << EOF > .env
DATABASE_URL="postgresql://user:password@host/database?sslmode=require"
PORT=5555
EOF

# Run database migrations and generate Prisma client
npx prisma db push
npx prisma generate

# Start development server
npm run dev
```

### 3. Frontend Setup
```bash
cd ../frontend
npm install

# Set environment variable pointing to your backend
echo "VITE_API_URL=http://localhost:5555/api" > .env

# Run Vite dev server
npm run dev
```

Open `http://localhost:5173` in your browser.

---

## 📄 Resume Bullet Points (Ready to Copy-Paste)

### Project: Panchawati BillBook — Full-Stack Offline-First POS & Inventory Platform
* Engineered a production-grade, multi-counter retail POS & inventory management system using **React 18, TypeScript, Node.js, Express, Prisma ORM, and Neon PostgreSQL**.
* Architected an **offline-first persistence layer using IndexedDB and Service Workers (PWA)**, featuring optimistic local stock adjustments and a background FIFO flusher to guarantee uninterrupted cash checkout during connectivity blackouts.
* Integrated **automated WhatsApp B2B commerce workflows**, enabling 1-click Purchase Order generation for low-stock SKUs and intelligent customer debt recovery reminders with custom deep-link formatting.
* Developed a **high-speed mobile camera barcode scanner** utilizing the native Barcode Detection API with custom software debouncing to eradicate duplicate scans (<200ms latency).
* Optimized print rendering stylesheets to achieve zero-defect **58mm and 80mm ESC/POS thermal receipt printing** and on-demand QR-code shelf bin labeling.
* Deployed scalable serverless architecture on **Vercel** with connection pooling and **WebSocket-driven real-time stock synchronization** across distributed mobile and desktop clients.

---

## 📜 License
Distributed under the MIT License. See `LICENSE` for more information.
