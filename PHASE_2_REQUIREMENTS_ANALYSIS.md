# HQMS PHASE 2 REQUIREMENTS ANALYSIS

This document provides a comprehensive audit of the current HQMS application against the Phase 2 business requirements. No code changes have been made yet.

---

## 1. ATTENDANCE (Admin Portal)
| Requirement | Existing Support | Missing | DB Change | UI Change | Server Action | Priority |
| ----------- | ---------------- | ------- | --------- | --------- | ------------- | -------- |
| Unrestricted marking time | Basic CRUD exists | Time unlocking | None | Remove time limits | Remove time-based validation | High |
| Full / FN / AN support | Missing | Session selection | Add `attendance_session_enum` and `session` column | Add session radio/dropdown to form | Accept and validate session | High |
| Absence Reasons | Enum `leave_type` exists with `sick_leave`, `casual_leave`, etc. | New reasons: Sick-Hostel, Sick-Home, Personal, Urgent, Other | Update `leaveTypeEnum` or create new `absenceReasonEnum` | Add absence reason dropdown (only active if absent) | Validate reason only if absent | High |
| Remarks for "Other" | `remarks` text field exists | Conditional rendering | None | Show remark input if "Other" is selected | Accept remarks | High |

## 2. PARENT MEETING
| Requirement | Existing Support | Missing | DB Change | UI Change | Server Action | Priority |
| ----------- | ---------------- | ------- | --------- | --------- | ------------- | -------- |
| Four Statuses | `attended` boolean | 4 semantic states | Change `attended` to `meeting_status` enum (ON_TIME, LATE, ABSENT_EXCUSED, ABSENT_UNEXCUSED) | 4-state selector with visual indicators | Handle new states | High |
| Parent Meeting Reports | Base tables exist | Monthly/Yearly aggregations | None | New report pages with charts/filters | New aggregation queries | Med |

## 3. STARS
| Requirement | Existing Support | Missing | DB Change | UI Change | Server Action | Priority |
| ----------- | ---------------- | ------- | --------- | --------- | ------------- | -------- |
| 1–10 levels | `studentStars` table with `type` (Blue, Black) | Quantity/value per star | Add `value` integer column (1-10) to `studentStars` | Add numeric selector (1-10) when awarding | Validate 1-10 range | High |
| Best Student Ranking | Raw data available | Weighted scoring system | None | New ranking report UI | Aggregation and ranking logic | Med |

## 4. ADMISSIONS
| Requirement | Existing Support | Missing | DB Change | UI Change | Server Action | Priority |
| ----------- | ---------------- | ------- | --------- | --------- | ------------- | -------- |
| Generate Hall Ticket | `hallTickets` schema exists | PDF generation & UI | None | "Generate PDF" / "Print" buttons | PDF generation logic (e.g. react-pdf / puppeteer) | High |

## 5. STOCK REGISTRATION (Inventory)
| Requirement | Existing Support | Missing | DB Change | UI Change | Server Action | Priority |
| ----------- | ---------------- | ------- | --------- | --------- | ------------- | -------- |
| Rename to Stock Registration | Module named "Inventory" | Global terminology update | None | Rename links, headers, forms | Rename exports/types (optional but good) | Low |
| Purchase & Repair Dates | Missing | New optional date fields | Add `purchaseDate` and `repairingDate` columns to `inventoryItems` | Add date pickers to forms | Update Zod schemas and insert/update logic | Med |
| Custom Fields | Missing | JSONB storage for dynamic fields | Add `customFields` JSONB column to `inventoryItems` | Add dynamic key-value inputs | Validate and save JSONB payload | Med |

## 6. REPORTS
| Requirement | Existing Support | Missing | DB Change | UI Change | Server Action | Priority |
| ----------- | ---------------- | ------- | --------- | --------- | ------------- | -------- |
| Student Performance | Underlying metrics exist | Aggregation & UI | None | Comprehensive Student Report View | Aggregation Actions | Med |
| Class Performance | Underlying metrics exist | Aggregation & UI | None | Comprehensive Class Report View | Aggregation Actions | Med |
| Juz/Page Calc Engine | Raw juz/pages logged | Normalized utility | None | (Backend only) | Utility functions for Juz↔Pages | High |
| Attendance Report | Raw data exists | Aggregation | None | Weekly/Monthly/Yearly charts | Aggregation Actions | Med |
| Parent Engagement | `activityLogs` table exists | Scoring algorithm | None | New report ranking parents by activity | Aggregation and weighting logic | Med |

## 7. GENERAL — EDIT & DELETE
| Requirement | Existing Support | Missing | DB Change | UI Change | Server Action | Priority |
| ----------- | ---------------- | ------- | --------- | --------- | ------------- | -------- |
| Edit & Delete everywhere | Some entities lack Delete | Soft-delete / Archive capabilities | Add `deletedAt` / `isArchived` to critical entities (e.g., students, inventory) | Edit/Delete actions in data tables | Soft-delete implementation, relational cascading | High |

## 8. NOTIFICATION SYSTEM
| Requirement | Existing Support | Missing | DB Change | UI Change | Server Action | Priority |
| ----------- | ---------------- | ------- | --------- | --------- | ------------- | -------- |
| General Engine | `notification_templates`, `notification_logs` | Event triggering | Create `notification_events` or hardcode map | Notification configuration panel | Integration into Exam/Leave/Meeting flows | Med |

## 9. EXAMS
* **Status**: Architecture previously redesigned. Must preserve current implementation. No regressions allowed.

## 10. TARGET SYSTEM
| Requirement | Existing Support | Missing | DB Change | UI Change | Server Action | Priority |
| ----------- | ---------------- | ------- | --------- | --------- | ------------- | -------- |
| Target Calc & Display | `monthlyTargets` exists | Weekly/Annual logic based on year of Hifz (`yearOfStudy`) | None (calculated dynamically) or add `annualTarget` | Target progress tracker UI | Derivation algorithms | Med |

---

## PART B & C — TUTOR & PARENT PORTALS
| Requirement | Existing Support | Missing | DB Change | UI Change | Server Action | Priority |
| ----------- | ---------------- | ------- | --------- | --------- | ------------- | -------- |
| Tutor: Reason disabling | Active | Conditional UI | None | Disable reason dropdown if Sabaq/Doura > 0 | None | High |
| Tutor: Doura Juz (1-30) | Arrays supported | Dropdown UI | None | Multi-select / Select for 1-30 | Validation | High |
| Tutor: Individual Enter | Form exists | Per-student toggle | None | Inline "Enter" button per row | None | High |
| Tutor: Bulk Controls | Global submit exists | Category-specific bulk apply | None | Bulk selectors at table header | Smart form population | High |
| Parent: Attendance Split | Combined | Tabbed navigation | None | "Students" vs "Parents" tabs | Conditional fetching | Med |
| Parent: Large Calendar | Small widget | Full page / expanded | None | CSS grid/flex expansion | None | Med |
| Parent: Dashboard Cleanup| Present | Removal | None | Remove "Daily logs this month" widget | Remove unnecessary fetches | Med |

---

# Dependencies Between Features
1. **Juz/Page Calculation Engine** MUST be built before any **Performance Reports** or **Target calculations**, to ensure consistency across the application.
2. **Parent Meeting Status Enum** must be deployed before the **Parent Meeting Reports** can be written.
3. **Star Quantity (1-10)** must be deployed before the **Best Student Ranking** report can be accurately calculated.

# Proposed Database Changes
1. **`attendance_records`**: Add `session` enum (full_day, forenoon, afternoon). Update `leave_type` enum to match new absence reasons.
2. **`parentMeetingAttendance`**: Replace `attended` boolean with `meeting_status` enum (on_time, late, absent_excused, absent_unexcused).
3. **`studentStars`**: Add `value` integer (1-10) to quantify the star's weight.
4. **`inventoryItems`**: Add `purchaseDate` (date), `repairingDate` (date), and `customFields` (jsonb).

# Proposed Shared Utilities
- `lib/utils/hifz-calculations.ts`:
  - `calculateJuzEquivalent(juzNumber, pages)`: Returns decimal Juz.
  - `calculatePagesFromJuz(juzNumber, decimalJuz)`: Accounts for 20 vs 24 page rules.
- `lib/utils/scoring.ts`:
  - Centralized weights for Best Student and Parent Engagement.

# Proposed Reporting Architecture
Reports will not be real-time monolithic queries. They will use specialized Server Actions that aggregate data dynamically on-demand, with caching layers (React cache / unstable_cache) where appropriate, given the read-heavy nature of yearly reports.

# Proposed Scoring Methodologies
- **Best Student**: `(Hifz Progress / Target * W1) + (Attendance % * W2) + (Star Score * W3)`. (Weights TBD with business).
- **Parent Engagement**: `(Logins * 1) + (Attendance Views * 2) + (Report Card Views * 5)`. Punish rapid reloading by debouncing activity logs per session.

# Security Risks
- Enabling "Delete" everywhere introduces catastrophic data loss risks. We will implement Soft Deletes (`deletedAt`) for historical data (Students, Attendance, Inventory) to prevent orphaned relations.

# Data Migration Risks
- Modifying the `leave_type` enum might break historical attendance records. Additive migrations will be used, and legacy types mapped or preserved.
- Changing `parentMeetingAttendance.attended` from boolean to enum requires mapping `true -> ON_TIME` and `false -> ABSENT_UNEXCUSED` during migration.

# Recommended Implementation Order
1. **PHASE 1**: Shared Utilities (Hifz Calc Engine) & Soft Delete Architecture.
2. **PHASE 2**: Schema Migrations (Attendance, Parent Meetings, Stars, Inventory).
3. **PHASE 3**: Admin UI Updates (Attendance, Meetings, Stars, Stock Registration).
4. **PHASE 4**: Tutor Portal (Daily Tracker Bulk/Individual fixes).
5. **PHASE 5**: Admissions (Hall Ticket).
6. **PHASE 6**: Reports (Best Student, Performance, Engagement).
7. **PHASE 7**: Parent Portal Adjustments.

# Questions / Ambiguities Requiring Business Decision
1. What should be the default weights for Star Type A vs Star Type B?
2. When migrating historical Parent Meeting attendance (currently just Yes/No), should "Yes" map to "On Time" and "No" map to "Absent Unexcused"?
3. Should custom fields in Stock Registration be filterable/searchable, or just display-only metadata?
