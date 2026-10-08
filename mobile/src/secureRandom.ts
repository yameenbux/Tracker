import * as Crypto from 'expo-crypto';

/** Cryptographically secure random bytes from the system (for backup encryption salts and nonces). */
export const secureRandom = (n: number): Uint8Array => Crypto.getRandomBytes(n);
