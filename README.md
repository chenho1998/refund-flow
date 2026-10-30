# ZUS Back Office — Refund Flow

A React + TypeScript implementation of the refund flow for the ZUS Regional Senior Frontend Developer technical assessment.

## Live demo

**[https://chenho1998.github.io/refund-flow/](https://chenho1998.github.io/refund-flow/)**

- GitHub: [https://github.com/chenho1998/refund-flow](https://github.com/chenho1998/refund-flow)

## Stack

- **React 19** + **TypeScript 7** (strict)
- **Vite 8** — dev server and production build
- **Tailwind CSS 4** — utility-first styling
- **Radix UI** — accessible dialog, select, checkbox primitives
- **Vitest** + **React Testing Library** — unit and UI tests

## Getting started

### Prerequisites

- Node.js ≥ 20
- npm ≥ 10

### Install dependencies

```bash
cd refund-flow
npm install --legacy-peer-deps
```

> `--legacy-peer-deps` is needed because some Vitest sub-packages declare a peer engine requirement of Node ≥ 22, though they run correctly on Node 20.

### Run the development server

```bash
npm run dev
```

Open [http://localhost:5173](http://localhost:5173) in your browser.

### Run tests

```bash
npm test
```

Runs all unit tests once and exits. Expected output: **30 tests, 3 files, all passing**.

To run in watch mode during development:

```bash
npm run test:watch
```

### Type check

```bash
npm run typecheck
```

### Production build

```bash
npm run build
```

Output goes to `dist/`. Preview the built app with:

```bash
npm run preview
```

## Project structure

```
src/
├── data/
│   └── order.ts              Raw order JSON + rawOrderToOrder() converter
├── domain/
│   ├── types.ts              All domain types (Order, Unit, Addon, RefundSelection, …)
│   ├── money.ts              toMinorUnits / fromMinorUnits / formatMYR
│   ├── eligibility.ts        isUnitEligible, isAddonEligible, isDeliveryFeeEligible
│   └── calculation.ts        calculateRefund() — pure, independently tested
├── api/
│   ├── types.ts              API request / response shapes
│   └── mockApi.ts            Async mock with latency, failures, idempotency, server-side calc
├── hooks/
│   └── useRefundFlow.ts      All refund flow state: selection, step, submission
├── components/
│   ├── OrderPage.tsx         Order display + Refund button
│   ├── refund/
│   │   ├── RefundModal.tsx   Modal shell (steps 1 & 2)
│   │   ├── Step1Select.tsx   Item / add-on / delivery fee selection
│   │   ├── Step2Review.tsx   Preview + reason + channel
│   │   └── ConfirmDialog.tsx Confirmation + loading + error + retry
│   └── ui/
│       ├── Badge.tsx
│       └── Button.tsx
└── __tests__/
    ├── money.test.ts
    ├── eligibility.test.ts
    └── calculation.test.ts
docs/
└── ASSESSMENT.md             Written section: API, calculation, assumptions, decisions
```

## Assessment written section

See [`docs/ASSESSMENT.md`](docs/ASSESSMENT.md) for:

- a) API endpoints
- b) Refund calculation approach
- c) Assumptions, questions & comments for the PM or designer
- d) Key decisions & trade-offs
- e) Known limitations & next steps

## Notes on the order data

The supplied order (`ORD-10482`) contains a known data inconsistency: unit `L2-2` has `status: "refunded"` but its add-ons still show `status: "paid"`. The unit-level status is treated as authoritative throughout — `L2-2` and its add-ons are entirely ineligible for refund. This is documented in assumption #2 in the assessment section.

## Deployment

```bash
npm run build
# Then deploy the dist/ folder to any static host
```

For Vercel:

```bash
npx vercel --prod
```

For GitHub Pages: push to a `gh-pages` branch or configure GitHub Actions to deploy `dist/` after `npm run build`.
