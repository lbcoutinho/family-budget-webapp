# 01 — Login

Status: **approved**, in `approved/`. M2-T06 unblocked on the UI side.

All four decisions approved as prototyped: narrow centred card with no illustration; generic error
that never reveals whether the email exists; no "remember me"; the demo account signs in through
the same form with no separate button.

**Approved in v2.** Four states on one page — initial, submitting, invalid credential, verifying
session — plus a live form at the top that actually fails once and then signs in, because the
screen has exactly one interaction and it is worth prototyping for real. What the review settled,
beyond the four already approved:

- **The action is the only colour on the screen.** Direction D at its limit: no data, so nothing
  else is coloured except the mark, which is the palette itself.
- **"Entrando…" lives in the button**, not in an overlay; the fields stay readable.
- **On error the password is cleared and focused, the email is kept.** The email half was already
  approved; clearing the password is new.
- **The verifying state reuses the same card in the same place**, so nothing shifts when it
  becomes the form.
- **No footer line about the demo account, and no subtitle under the title.** Rejected in
  review: the demo account uses this same form, so saying so is noise, and "Entre para continuar"
  states what two fields and a button already state. The card is title, fields, button — nothing
  else. The same rule applies to every screen: don't label what the controls already say.
