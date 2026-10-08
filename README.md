# 🌱 StockLess

### Smarter Inventory Decisions. Less Food Waste.

**StockLess** is a decision-support web application for Malaysian micro and small food retailers. It uses historical sales data to help retailers understand demand, assess purchase risks, and plan smarter restocking decisions.

StockLess supports **UN SDG 12.3** by helping reduce avoidable food waste caused by overstocking.

[🌐 **Live Demo**](https://stockless.pages.dev/)

![StockLess Demo](./assets/stockless-demo.gif)

---

## ✨ Features

- **CSV Upload & Column Mapping** — Import and map different sales data formats.
- **Data Quality Checks** — Check whether data is ready for analysis.
- **Demand Analysis** — Explore historical sales patterns and demand.
- **Demand Forecasting** — Estimate future inventory requirements.
- **Purchase Risk Assessment** — Identify potential overstock and stockout risks.
- **Supplier Scenario Planner** — Account for minimum order quantities, case sizes and lead times.
- **Impact Dashboard** — Track business and sustainability impact, including overstock avoided.

### 🔄 Workflow

```text
CSV Upload
    ↓
Data Readiness
    ↓
Demand Analysis
    ↓
Forecasting
    ↓
Purchase Risk
    ↓
Scenario Planning
    ↓
Impact Dashboard
```

---

## 🛠️ Tech Stack

- **Frontend:** React 19, TypeScript, Vite
- **Testing:** Vitest, React Testing Library
- **Data Processing:** SheetJS
- **PDF Generation:** PDF-Lib
- **Browser ML:** Hugging Face Transformers
- **Package Management:** npm Workspaces

---

## 🚀 Getting Started

### Prerequisites

- Node.js 24+
- npm

### Installation

```bash
git clone https://github.com/HansYap/StockLess.git
cd StockLess
npm install
```

### Run locally

```bash
npm run dev --workspace stockless-frontend
```

### Test & build

```bash
npm run typecheck
npm run build
npm test
```

---

## 📁 Project Structure

```text
StockLess/
├── frontend/       # React application
├── backend/        # Browser-compatible domain engine
├── public-data/    # Public datasets
├── assets/         # README demo media
├── package.json
└── HOMEPAGE.md
```

---

## 🎯 SDG 12.3

StockLess focuses on **UN Sustainable Development Goal 12: Responsible Consumption and Production**, specifically **Target 12.3**.

By helping retailers make more informed purchasing and restocking decisions, StockLess aims to reduce unnecessary overstock and avoidable food waste.

---

## 👥 Team

### Nexus 12

An industry-focused project combining **data analytics, forecasting, inventory planning, UX design and sustainability**.

---

## 🔗 Links

- [🌐 Live Demo](https://stockless.pages.dev/)
- [💻 GitHub Repository](https://github.com/HansYap/StockLess)

---

> 🌱 **Stock smarter. Waste less.**
