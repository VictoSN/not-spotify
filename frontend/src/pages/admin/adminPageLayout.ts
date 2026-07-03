/**
 * Standard root-wrapper classes for admin console pages so gutters and content
 * widths stay consistent (no jumping) when navigating between /admin pages.
 * Every page rendered inside AdminShell uses one of these on its outermost div.
 */
export const adminPageClass = 'mx-auto max-w-6xl p-4 sm:p-6' // lists, tables, dashboards
export const adminPageMediumClass = 'mx-auto max-w-4xl p-4 sm:p-6' // simple/settings pages
export const adminPageNarrowClass = 'mx-auto max-w-2xl p-4 sm:p-6' // single-column forms
