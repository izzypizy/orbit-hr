// Browser stand-in for @nestjs/core: only the Reflector the auth guard needs.
import { metaOf } from './nest-common';

export const APP_GUARD = 'APP_GUARD';

export class Reflector {
  /** First value found on the handler, then the class. */
  getAllAndOverride<T>(key: string, targets: object[]): T | undefined {
    for (const t of targets) {
      const value = metaOf(t)[key];
      if (value !== undefined) return value as T;
    }
    return undefined;
  }
}
