# Lucky Wheel admin layout design

## Scope and intent

Refine only `conference-backoffice` Lucky Wheel screens. Preserve the existing API contracts, authorization, wheel rules, copy meaning, and state transitions. The admin should understand the event state immediately and complete one operational task at a time on desktop or mobile.

## Visual direction

Use the existing ConferenceHub editorial system: white surfaces, zinc text, emerald for active actions, amber for paused or attention states. Emphasize typographic hierarchy and spacing rather than introducing a second visual brand. Keep labels in Thai where the current UI uses Thai. Use icons as support, never as the only indicator.

## Page structure

The top area contains the event selector and an operational status panel. The panel shows whether the wheel is unpublished, paused, or open, plus configuration version and pool revision. The pause/resume control stays with its reason field and cannot imply an unpublished wheel can be opened.

The existing four tabs become clear work areas: configuration, day and QR rights, stock and audit, and results and collection. Tabs remain usable on narrow screens without obscuring their labels. Each work area has a short heading, its primary action, and contextual help.

## Task flows

- First setup: show a deliberate empty state with the selected PRIS event, the linked Main Session, and an explicit “create closed wheel” action. Show validation errors inline.
- Configuration: distinguish unpublished draft from published configuration, present prize segments as ordered cards, and separate collection instructions from the segment editor. Keep “save and publish” prominent near the end of the form.
- Day and QR rights: visually sequence date selection, one shared time window, QR batch creation, QR operation, recipient inspection, and audit. Keep all existing reason and confirmation requirements.
- Stock and audit: replace the narrow-screen horizontal table with readable stock cards while retaining the desktop table if useful. Keep available, allocated, and collected meanings visible. Audit remains chronological.
- Results and collection: filter controls precede results. Use responsive result cards on narrow screens and preserve the desktop table, pagination, and collection form.

## Quality bar

At 320px and wider, primary controls remain reachable without horizontal page scrolling. Status and destructive/administrative actions are distinguishable by text and color. Focus styles, 44px touch targets, loading/error/empty states, and existing idempotent requests remain intact. No server or database changes are in scope.
