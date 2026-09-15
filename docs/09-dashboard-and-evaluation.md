# Dashboard and Evaluation

## Metric Contract

Define every metric before building its chart. Each definition should specify:

- metric name and purpose;
- numerator and denominator;
- qualifying statuses;
- event or timestamp used;
- business timezone;
- comparison period;
- exclusions;
- attribution rule;
- source tables or events;
- treatment of missing and duplicate data.

Store these definitions with the research protocol so dashboard values can be reproduced.

## Candidate Dashboard Measures

- Messenger chats and inquiries.
- Conversations supported by the ordering flow.
- Customer-confirmed orders.
- Staff-accepted and completed orders.
- Rejected and Expired orders, plus Ready orders that remain unclaimed and therefore are not counted as completed sales.
- Completed food sales originating from Messenger.
- Promotion reach or views available through Meta.
- Promotion-attributed chats under the approved rule.
- Views-to-chat conversion.
- Eligible follow-up cases, messages sent, replies, and response rate.
- Menu item frequency, quantity, and revenue.

The owner receives the full dashboard and action history. Staff sees only metrics needed for their role.

## Thesis Targets

| Objective | Planned target |
|---|---|
| SO1 customer-record functional tests | At least 95 percent pass rate |
| SO2 menu-record functional tests | At least 95 percent pass rate |
| SO3 order extraction | At least 95 percent accuracy under the final scoring method |
| SO4 dashboard | Functional and user evaluation |
| SO5 promotional drafts | Mean rubric score at least 4 out of 5 |
| SO6 follow-ups | Complete functional workflow |
| SO7 usability | SUS at least 68; usefulness and acceptability mean at least 4 out of 5 |
| SO8 marketing outcomes | 10 percent increase in views, 15 percent in chats, and 15 percent in views-to-chat conversion |
| SO9 sales outcome | 15 percent increase in completed Messenger-order food sales |
| SO10 follow-up outcome | 13 percent increase in follow-up response rate |

Reconcile these labels and values with the final approved thesis manuscript before freezing analytics.

## SO3 Accuracy

The team must select the unit of accuracy before testing:

- field-level accuracy;
- message-level accuracy; or
- exact complete-order accuracy.

Define required fields, partial credit, corrections across multiple messages, unsupported requests, and ambiguous ground truth. Do not choose the scoring method after seeing results.

## Attribution

The group must define what makes a chat or completed sale promotion-attributed. A defensible rule needs:

- qualifying source evidence;
- a fixed time window;
- duplicate handling;
- treatment of organic conversations;
- treatment of multiple promotions;
- timezone and campaign boundaries.

If Meta data cannot support user-level attribution, use an aggregate method and state the limitation.

## Study Design and Interpretation

The planned study uses one partner business and a 30-day pre/post design without a control group. Report observed associations, not proof that the application alone caused changes.

Record possible confounders such as:

- holidays and closures;
- changes in hours, prices, menu, or stock;
- outside promotions;
- outages and Meta delivery failures;
- seasonal events and weather;
- staffing changes;
- incomplete measurement days.

## Research Export

Exports should use documented fields, stable pseudonymous identifiers, and the minimum personal data required. Test export formulas against known fixtures. Define who may export data, where it is stored, how it is transferred, when it is deleted, and how pilot exclusions are recorded.

