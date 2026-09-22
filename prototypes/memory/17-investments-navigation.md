# 17 — Investments navigation and setup

Status: **approved** in `approved/17-investments-navigation.html`. Issue #393.

The approved prototype uses the following structure:

- Investments is a top-level area with Overview, Operations, Monthly Flow, and Import/Reconciliation.
- Financial Institutions, Instruments, Asset Listings, and investment-capable Accounts are individual third-level screens under Settings › Investments.
- The Investments overview only offers a gear shortcut whose menu links to those four settings screens.
- Accounts remains shared with Settings; the Investments settings branch presents the custody-capable subset.
- Referenced records are deactivated, not deleted. Deletion is only offered for unused records and requires confirmation.

Approved decisions:

1. Investments belongs immediately after Budget in the global navigation.
2. Variant A wins: Overview, Operations, Monthly Flow, and Import/Reconciliation use tabs.
3. The four setup destinations remain individual third-level Settings screens, not sections of Overview.
4. Referenced records are deactivated; only unused records can be deleted, with confirmation.

Settled during review: the four setup destinations do not live inside Overview. They are third-level Settings screens, with a gear shortcut from Overview.

The approved layout covers desktop and narrow viewports. Its Settings destinations expose populated, loading, empty, error, inactive, and destructive-confirmation states through URL controls.
