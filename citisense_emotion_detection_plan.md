# CitiSense Emotion Detection Plan
## admin-web Applied Version

## Goal
Apply the shared 4-mood system in `admin-web` so mood KPIs and charts reflect real citizen reactions, not feedback-type heuristics.

Allowed moods:

- `Grateful`
- `Satisfied`
- `Sad`
- `Angry`

---

## Current Code Anchors

### Main mood KPI source today
- Mood KPI logic is still heuristic in [DashboardPage.jsx](./src/screens/DashboardPage/DashboardPage.jsx)

Current issue:
- it derives mood from complaint / suggestion / compliment counts
- it outputs labels like `Positive`, `Needs attention`, and `Mixed`

Those should be replaced by the 4 approved moods from aggregated reactions.

---

## What admin-web should do

## 1. Dashboard mood KPI
Replace the current `getMoodMetric(posts)` logic with a reaction-based mood summary.

Dashboard output should become:

- dominant mood label: `Grateful`, `Satisfied`, `Sad`, or `Angry`
- confidence or share
- total reactions inside the selected scope and date range

## 2. Scope-aware aggregation
Mood must be filtered by admin scope:

- `Super Admin`: full system
- `LGU Admin`: only the office / category they own
- `Barangay Admin`: only their barangay scope

## 3. Date-range-aware aggregation
Mood KPI and charts must respect dashboard date range filters:

- all time
- last 15 / 30 days if retained
- selected month
- any future custom range if added

## 4. Reports and exports
If mood appears in any export or report later:

- export only the 4 approved moods
- include `mood_source` when useful
- avoid old generic labels

---

## admin-web Implementation Steps

## Phase 1. Replace heuristic KPI logic
- remove complaint/compliment-based mood scoring from `DashboardPage.jsx`
- call aggregated mood summary data instead

## Phase 2. Add backend summary consumption
- city mood summary
- office mood summary
- barangay mood summary
- category mood summary if needed

## Phase 3. Chart updates
Recommended admin views:

- mood KPI card
- mood breakdown donut
- mood trend by time
- mood by office / barangay / category

## Phase 4. Empty and low-confidence states
- `No mood data yet`
- `Low confidence` if reactions are too sparse

Do not show:

- `Positive`
- `Mixed`
- `Needs attention`

as official mood labels

---

## Testing Checklist

- super admin sees city-wide reaction-based mood
- LGU admin sees only scoped mood
- barangay admin sees only scoped mood
- date range changes mood totals correctly
- no dashboard KPI returns heuristic labels anymore

---

## Model Use in admin-web

Use model output only for:

- sparse-data internal insights
- predicted mood columns in admin review tools
- research comparison

Do not use model predictions to override strong reaction summaries in dashboard KPIs.
