# Project Structure

One repository, one Vercel project. Frontend in `client/`, API entry in `api/`, API code in `server/`.

```
STC_Kiro/
├── .kiro/
│   └── steering/            product.md, tech.md, structure.md
├── api/                     Vercel serverless entry (only function file)
│   └── index.js             exports the Express app for Vercel
├── server/                  Express code and tests, kept out of api/ so Vercel counts one function
│   ├── routes/              one file per resource
│   │   ├── services.js
│   │   ├── incidents.js
│   │   ├── tasks.js
│   │   ├── technicians.js
│   │   ├── advisories.js
│   │   ├── notifications.js
│   │   └── public.js
│   ├── lib/
│   │   ├── supabase.js      Supabase client (service key, server only)
│   │   ├── priority.js      rule-based priority scoring
│   │   ├── advisory.js      template advisory, optional LLM call
│   │   └── validate.js      small request validation helpers
│   └── smoke.test.js
├── client/                  React app (Vite)
│   ├── index.html
│   └── src/
│       ├── main.jsx
│       ├── App.jsx          routes + role switcher
│       ├── api.js           fetch wrapper for /api
│       ├── pages/
│       │   ├── Dashboard.jsx        services, severity, priority list
│       │   ├── Communication.jsx    advisory + notify + log
│       │   ├── Recovery.jsx         tasks + progress
│       │   ├── MyTasks.jsx          technician view
│       │   └── CustomerStatus.jsx   public status page
│       ├── components/      StatusBadge, SeverityBadge, ProgressBar, ServiceCard, TaskRow
│       └── styles.css
├── supabase/
│   ├── schema.sql           tables
│   └── seed.sql             fictional demo data
├── .env.example             variable names only, no values
├── .gitignore               includes .env
├── vercel.json              routes /api/* to api/index.js, serves client build
├── package.json
└── README.md                setup, demo script, known limitations
```

## Rules
- Pages map to the three features: Dashboard, Communication, Recovery. `CustomerStatus` is the public page.
- Business logic (scoring, advisory generation) goes in `server/lib/`, not in routes or React components.
- Routes stay thin: validate input, call Supabase or a lib function, return JSON.
- The frontend calls the backend only through `client/src/api.js`.
- Components are small and reusable. No component library, no global state library.
- File names: React components `PascalCase.jsx`, everything else `camelCase.js`. Table and column names use `snake_case`.
- Do not create files outside this layout without a reason. Do not add folders for things the MVP does not need.
- `.env` is never committed. `.env.example` is.

## Build order (4 hours)
1. Repo setup, Supabase schema and seed, `.env` (30 min)
2. API: services, incidents (simulate/reset), priority scoring (45 min)
3. Dashboard page (45 min)
4. Tasks API + Recovery and MyTasks pages (45 min)
5. Advisory, notifications, Customer status page (45 min)
6. Deploy to Vercel, demo run-through, README (30 min)

Cut from the bottom of the list if time runs short. Keep the demo flow in `product.md` working at every step.
