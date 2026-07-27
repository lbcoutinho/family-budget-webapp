/**
 * Address of the demo account, derived from the owner's address rather than configured on its
 * own (M2-T02). Two addresses that must stay related are one address plus a rule: a second
 * environment variable could drift, and would put the demo account on a mailbox nobody reads.
 *
 * The rule is the RFC 5233 sub-address: everything after a `+` in the local part is ignored by
 * the mail server, so `person@example.com` and `person+demo@example.com` are distinct logins
 * that deliver to the same inbox.
 *
 * @param email the owner's address, i.e. `SEED_USER_EMAIL`
 * @returns the same address with a `+demo` sub-address on the local part
 * @throws Error when `email` has no local part or no domain — a typo in the environment should
 *   stop the seed with a readable message instead of writing a broken login to the database
 */
export function toDemoEmail(email: string): string {
  const trimmed = email.trim();

  // Last `@`, not the first: a quoted local part may legally contain one, and only the final
  // separator delimits the domain.
  const separator = trimmed.lastIndexOf('@');

  if (separator <= 0 || separator === trimmed.length - 1) {
    throw new Error(`Cannot derive the demo address: "${email}" is not a valid email address`);
  }

  const localPart = trimmed.slice(0, separator);
  const domain = trimmed.slice(separator + 1);

  return `${localPart}+demo@${domain}`;
}
