// Browser stand-in for the parts of @nestjs/common the API uses. The decorators record routes, parameters and
// metadata so demo/server.ts can call the real controllers without Node or Express.
/* eslint-disable @typescript-eslint/no-explicit-any */

export interface RouteDef { method: string; path: string; handler: string }
export interface ParamDef {
  index: number;
  kind: 'body' | 'param' | 'query' | 'res' | 'file' | 'custom';
  data?: string;
  pipes: unknown[];
  factory?: (data: unknown, ctx: unknown) => unknown;
}

const PREFIX = Symbol('prefix');
const ROUTES = Symbol('routes');
const PARAMS = Symbol('params');
const META = Symbol('meta');

const own = <T>(target: any, key: symbol, init: () => T): T => {
  if (!Object.prototype.hasOwnProperty.call(target, key)) target[key] = init();
  return target[key];
};

export const prefixOf = (cls: any): string => cls[PREFIX] ?? '';
export const routesOf = (cls: any): RouteDef[] => own(cls, ROUTES, () => []);
export const paramsOf = (cls: any, handler: string): ParamDef[] => own(cls, PARAMS, () => ({} as Record<string, ParamDef[]>))[handler] ??= [];
export const metaOf = (target: any): Record<string, unknown> => own(target, META, () => ({}));

// ---- class and method decorators

export const Controller = (prefix = '') => (cls: any) => { cls[PREFIX] = prefix; };
export const Injectable = () => (_cls: any) => {};
export const Module = (_opts: unknown) => (_cls: any) => {};
export const UseInterceptors = (..._interceptors: unknown[]) => (_t: any, _k?: any, _d?: any) => {};

const route = (method: string) => (path = '') => (proto: any, handler: string) => {
  routesOf(proto.constructor).push({ method, path, handler });
};
export const Get = route('GET');
export const Post = route('POST');
export const Patch = route('PATCH');
export const Put = route('PUT');
export const Delete = route('DELETE');

/** Works on classes and methods, like Nest's SetMetadata. */
export const SetMetadata = (key: string, value: unknown) => (target: any, _key?: any, desc?: PropertyDescriptor) => {
  metaOf(desc ? desc.value : target)[key] = value;
};

// ---- parameter decorators

const param = (kind: ParamDef['kind']) => (data?: string, ...pipes: unknown[]) => (proto: any, handler: string, index: number) => {
  paramsOf(proto.constructor, handler).push({ index, kind, data, pipes });
};
export const Body = param('body');
export const Param = param('param');
export const Query = param('query');
export const Res = param('res');
export const UploadedFile = param('file');

export const createParamDecorator = (factory: (data: any, ctx: any) => unknown) =>
  (data?: unknown) => (proto: any, handler: string, index: number) => {
    paramsOf(proto.constructor, handler).push({ index, kind: 'custom', data: data as string, pipes: [], factory });
  };

// ---- pipes

export class ParseIntPipe {
  transform(value: unknown) {
    const n = Number(value);
    if (!Number.isInteger(n)) throw new BadRequestException('Validation failed (numeric string is expected)');
    return n;
  }
}

// ---- exceptions

export class HttpException extends Error {
  constructor(message: string, private readonly status: number) {
    super(message);
  }
  getStatus() {
    return this.status;
  }
}
export class BadRequestException extends HttpException {
  constructor(message = 'Bad Request') { super(message, 400); }
}
export class UnauthorizedException extends HttpException {
  constructor(message = 'Unauthorized') { super(message, 401); }
}
export class ForbiddenException extends HttpException {
  constructor(message = 'Forbidden resource') { super(message, 403); }
}
export class NotFoundException extends HttpException {
  constructor(message = 'Not Found') { super(message, 404); }
}

// ---- types the API imports

export interface CanActivate { canActivate(ctx: ExecutionContext): boolean | Promise<boolean> }
export interface ExecutionContext {
  getHandler(): any;
  getClass(): any;
  switchToHttp(): { getRequest(): any };
}
export interface OnModuleInit { onModuleInit(): void }
