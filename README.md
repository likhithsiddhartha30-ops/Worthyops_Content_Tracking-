# Worthyops_Content_Tracking-

WorthyOps Content Tracking: a simple dashboard to plan content and track performance across LinkedIn, Instagram, Twitter and YouTube.

## Pages

- `index.html` (login for the Client portal and Admin)
- `dashboard.html` (performance overview with charts, for clients and admins)
- `content.html` (admin: add, edit and log metrics for posts)
- `planner.html` (admin: upcoming planned and scheduled content)

## Run

Open `index.html` in a browser. No build step is needed.

Demo logins:

- Admin: `admin@demo.test` / `admin123` (pick any client from the switcher in the header)
- Clients (each sees only their own dashboard), password `client123`:
  - Northwind Studio: `client@demo.test`
  - Bluepeak Fitness: `bluepeak@demo.test`
  - Acme Coaching: `acme@demo.test`

Admins can add new clients (with their own login) using the **+** button next to the client switcher. The starter clients and admin login live in `js/store.js` (`DEFAULT_CLIENTS` and `ADMINS`).

> Note: login and data storage are front-end only (browser localStorage). Add a real backend before using it with real clients.
