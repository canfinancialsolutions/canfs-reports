# CANFS Reports (Supabase + Next.js)

A clean admin reporting site for the `client_registrations` table:
- Search by first/last/phone
- Edit follow-up fields (CalledOn, BOP_Date, BOP_Status, etc.) and save to Supabase
- Upcoming BOP report (date range)
- Export filtered upcoming rows to XLSX
- Weekly **line** trend chart (last 2 months, by week end date)
- Monthly **bar** chart (current year)

## 1) Local run
```bash
# 1. Replace package.json with above
# 2. Clean install
rm -rf node_modules package-lock.json .next
npm install

# 3. Test build
npm run build
# 4. Commit & deploy
# 4. Deploy
git add package.json package-lock.json
git commit -m "Fix xlsx version + all Tailwind deps"
git push origin main
```

## 2) Supabase requirements
### A) Create an admin user
Supabase → Authentication → Users → Add user (email/password)

### B) Enable RLS + policies (recommended)
Supabase → Table Editor → client_registrations → Enable RLS

SQL Editor:
```sql
create policy "admin read"
on public.client_registrations
for select
to authenticated
using (true);

create policy "admin update"
on public.client_registrations
for update
to authenticated
using (true)
with check (true);
```

## 3) Deploy on Vercel
1. Upload this project to GitHub (root must include package.json)
2. Import the repo into Vercel
3. Set Environment Variables (Production + Preview):
   - NEXT_PUBLIC_SUPABASE_URL
   - NEXT_PUBLIC_SUPABASE_ANON_KEY
4. Deploy

## Logo
Replace `public/can-logo.svg` with your real logo if you want.


## Pagination
The All Records table shows 100 records per page with Previous/Next buttons.


## Sorting
In both tables, click on these headers to sort: Client Name, Created Date, BOP Date, BOP Status, Follow-Up Date, Status.


## Latest 500
There is a Latest 10 Records table with the same scroll + sort + edit behavior.


## Jump to Page
Use the Go to page box in All Records to jump to any page.
