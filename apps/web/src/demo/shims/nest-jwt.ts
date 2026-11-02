// Browser stand-in for @nestjs/jwt. Demo tokens are unsigned: everything runs in the visitor's own browser,
// so there is nothing to protect.
const TTL_MS = 8 * 60 * 60 * 1000;

const encode = (value: unknown) => btoa(String.fromCharCode(...new TextEncoder().encode(JSON.stringify(value))));
const decode = (token: string) => JSON.parse(new TextDecoder().decode(Uint8Array.from(atob(token), (c) => c.charCodeAt(0))));

export class JwtService {
  async signAsync(payload: object) {
    return `demo.${encode({ ...payload, exp: Date.now() + TTL_MS })}`;
  }

  async verifyAsync<T>(token: string): Promise<T> {
    const { exp, ...payload } = decode(token.replace(/^demo\./, ''));
    if (!exp || exp < Date.now()) throw new Error('Token expired');
    return payload as T;
  }
}

export const JwtModule = { register: (_opts: unknown) => JwtModule };
