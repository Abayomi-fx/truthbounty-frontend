# Keyboard navigation and focus

- The first skip link moves focus to the page's main content. Interactive controls have a visible focus outline.
- On mobile, the navigation button opens a modal sidebar and focuses its first item. Tab and Shift+Tab stay inside the open sidebar. Escape or the backdrop closes it and returns focus to the menu button. The closed sidebar is removed from keyboard navigation.
- Claim submission, trust explanation, and dispute dialogs focus their first available control when opened. Tab stays within the active dialog, skips disabled controls, and Escape closes it. Closing returns focus to the control that opened it.
- When another modal opens above one of these dialogs, the top modal handles keyboard focus until it closes.

These behaviors are covered by `src/hooks/__tests__/useDialogFocus.test.tsx`, the sidebar component test, the accessibility tests, and `e2e/keyboard-navigation.spec.ts` in the existing CI jobs.
