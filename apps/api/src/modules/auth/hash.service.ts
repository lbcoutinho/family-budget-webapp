import { Injectable } from '@nestjs/common';
import * as argon2 from 'argon2';

/**
 * Password hashing, isolated behind a service so nothing else in the codebase touches argon2
 * directly (M2-T02). Two consequences worth the indirection: the algorithm and its parameters
 * are changed in one place, and auth tests mock this provider instead of paying ~100 ms of
 * deliberate key derivation per case.
 *
 * argon2id is the variant recommended by OWASP — the hybrid that resists both GPU cracking and
 * side-channel attacks — and the library's defaults (64 MiB of memory, 3 passes, parallelism 4,
 * a 16-byte random salt) sit comfortably above its recommended minimums, so they are kept as they
 * are. The salt is generated per call and stored inside the PHC string the hash returns, so two
 * hashes of the same password never match.
 */
@Injectable()
export class HashService {
  /**
   * Derive a hash from a plaintext password. The returned PHC string carries the variant,
   * parameters and salt, so {@link verify} needs nothing but the string itself.
   */
  async hash(plain: string): Promise<string> {
    return argon2.hash(plain, { type: argon2.argon2id });
  }

  /**
   * Check a plaintext password against a stored hash. Always compared through argon2, never by
   * string equality: only argon2 can re-derive the hash from the salt embedded in `hash`, and
   * its comparison is constant-time.
   *
   * A malformed or truncated hash makes argon2 throw. That is a corrupted row, not a valid
   * login, so it is answered with `false` rather than a 500 — the caller's only question is
   * whether the credentials are good.
   */
  async verify(hash: string, plain: string): Promise<boolean> {
    try {
      return await argon2.verify(hash, plain);
    } catch {
      return false;
    }
  }
}
