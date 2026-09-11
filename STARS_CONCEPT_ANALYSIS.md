# HQMS Stars System Concept Analysis

## Current Stars Architecture
The current HQMS application implements a Stars system using a server-action-driven architecture (`lib/actions/stars.ts`). Users (Admins and Tutors) can award and remove stars for students. Tutors are restricted to awarding/removing stars only for students enrolled in their assigned classes. The business logic already correctly identifies Blue stars as positive and Black stars as negative/warnings.

## Current Database Structure
The system currently uses Drizzle ORM with PostgreSQL. The `student_stars` table is defined in `lib/db/schema/students.ts`:

- `id`: UUID (Primary Key)
- `studentId`: UUID (Foreign Key to `students`)
- `type`: Enum `("blue", "black")`
- `reason`: Text (Currently **required** and validated to have a minimum of 3 characters)
- `awardedBy`: UUID (Foreign Key to `users`)
- `awardedAt`: Timestamp
- `createdAt`: Timestamp

Currently, there is **no value or severity field**. A star simply counts as 1 instance.

## Current UI
The user interface consists of several components (`components/stars/*`):
- **AwardStarForm**: Allows selecting between Blue and Black stars. It already enforces a required `reason` field via a text area. It displays the total count of Blue and Black stars separately.
- **StarHistoryTable**: Displays a tabular history of stars awarded to a student, including the type, reason, the user who awarded it, and the date.
- **StarSummary**: Shows the aggregated count of each star type.

## Proposed Blue Star Model
The Blue Star will continue to represent **positive** behavior, achievements, and contributions.
Instead of being a flat metric, each Blue Star will carry an associated integer value between `1` and `10` to indicate the significance of the positive event (e.g., 1 for minor good behavior, 10 for exceptional achievement).

## Proposed Black Star Model
The Black Star will continue to represent **negative** behavior, mistakes, and misconduct.
Like the Blue Star, each Black Star will carry an associated integer value between `1` and `10` to indicate the severity of the negative event (e.g., 1 for a simple mistake, 10 for severe misconduct). 

## 1–10 Importance/Severity Model
The importance/severity model introduces a weighted scale. A star is no longer just "a star"; it is a record of an event with a specific intensity. 
Administrators and tutors will select a value from 1 to 10 when awarding the star. This ensures that minor issues don't disproportionately drag down a student's ranking, and exceptional achievements are adequately rewarded.

## Net Star Score
The Net Star Score will be the foundational metric for evaluating a student's star performance. 
It is calculated as:
**`Total Blue Star Value` - `Total Black Star Value` = `Net Star Score`**

This ensures that the score is a true reflection of the student's net positive impact, rather than a raw count of events. This Net Star Score will be one of three components (alongside Leave Tracker and Hifz Performance) used to calculate the final Best Student ranking.

## Monthly Ranking Concept
The Monthly Ranking will calculate the Net Star Score for a specific calendar month. 
The system will filter `student_stars` where `awardedAt` falls within the target month, sum the Blue values, sum the Black values, and compute the Net Star Score to rank students for that specific period.

## Yearly Ranking Concept
The Yearly Ranking will calculate the Net Star Score for an entire Academic Year. 
The system will filter `student_stars` based on the start and end dates of the active Academic Year (or by linking stars to an academic year explicitly), calculating the net score to determine the year's top performers.

## Historical Data Handling
Since existing star records in the database do not have a `value` column, introducing this field will require handling legacy data.
Possible approaches for existing records during migration:
1. **Default Value**: Set a default value of `1` for all existing Blue and Black stars.
2. **Backfill**: Allow administrators to edit existing star records to assign an appropriate 1-10 value.
Without a value, existing records cannot participate fairly in the new Net Star Score calculation.

## Required Schema Changes
- Add a new column to `student_stars` in `lib/db/schema/students.ts`:
  `value: integer("value").notNull().default(1)` (with an optional check constraint in the DB to enforce the 1-10 range).

## Required UI Changes
- **AwardStarForm**: Add a Slider or Dropdown input to select the 1-10 severity/importance level when awarding a star. Update the labels to explain the 1-10 scale.
- **StarHistoryTable**: Add a "Value/Severity" column to display the 1-10 number alongside the star type.
- **StarSummary / UI Headers**: Shift from showing just "Total Blue: X" to showing "Total Blue Score" or explicitly showing both the count and the Net Star Score.

## Required Server Actions
- Update the `awardStarSchema` in `lib/actions/stars.ts` to include `value: z.number().int().min(1).max(10)`.
- Update the `awardStar` server action to accept and insert the `value` into the database.
- Create new calculation utility functions or database queries to aggregate the Net Star Score by Month and Academic Year for the Best Student calculation.

## Security Considerations
- **Validation**: Ensure the server action strictly validates that the value is an integer between 1 and 10 to prevent manipulation.
- **Permissions**: Verify that the ability to award a `10` (highest impact) is available to standard tutors, or decide if high-value stars require Admin approval. (Currently, any assigned tutor can award a star).

## Open Business Decisions
1. **Historical Migration**: Should all existing stars default to a value of 1, or should they be excluded from new Best Student calculations until a value is manually assigned?
2. **Tutor Permissions**: Should standard tutors be allowed to award the maximum value (10) for both Blue and Black stars, or should values above a certain threshold (e.g., 8-10) require Administrator approval/review?
3. **Reason Requirement**: The `reason` field is *already* required in the current implementation. Should we increase the minimum length requirement (currently 3 characters) to ensure more detailed context for high-value stars?
