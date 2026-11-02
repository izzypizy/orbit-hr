// Demo mode (GitHub Pages): runs the real API controllers and services in the browser, with @nestjs/* swapped for
// the shims in ./shims (see vite.config.ts). Data lives in memory and resets when the page is reloaded.
/* eslint-disable @typescript-eslint/no-explicit-any */
import { AnnouncementsController } from '../../../api/src/announcements/announcements.controller';
import { AttendanceController } from '../../../api/src/attendance/attendance.controller';
import { AttendanceService } from '../../../api/src/attendance/attendance.service';
import { AuthController } from '../../../api/src/auth/auth.controller';
import { ClaimsController } from '../../../api/src/claims/claims.controller';
import { ClaimsService } from '../../../api/src/claims/claims.service';
import { AuthGuard } from '../../../api/src/common/auth';
import { MockDb } from '../../../api/src/data/mock-db.service';
import { EmployeesController } from '../../../api/src/employees/employees.controller';
import { HolidaysController } from '../../../api/src/holidays/holidays.controller';
import { LeaveController } from '../../../api/src/leave/leave.controller';
import { LeaveService } from '../../../api/src/leave/leave.service';
import { PayrollController } from '../../../api/src/payroll/payroll.controller';
import { PayrollService } from '../../../api/src/payroll/payroll.service';
import { ChecklistsController } from '../../../api/src/talent/checklists.controller';
import { ReviewsController } from '../../../api/src/talent/reviews.controller';
import { TrainingController } from '../../../api/src/talent/training.controller';
import { HttpException, paramsOf, prefixOf, routesOf } from './shims/nest-common';
import { Reflector } from './shims/nest-core';
import { JwtService } from './shims/nest-jwt';

const MAX_UPLOAD = 5 * 1024 * 1024;

// Same wiring as AppModule, done by hand because esbuild doesn't emit the metadata Nest's injector reads
const db = new MockDb();
const jwt = new JwtService() as any;
const leave = new LeaveService(db);
const claims = new ClaimsService(db);
const attendance = new AttendanceService(db);
const payroll = new PayrollService(db);
payroll.onModuleInit();

const controllers: any[] = [
  new AuthController(db, jwt), new EmployeesController(db), new AnnouncementsController(db), new HolidaysController(db),
  new LeaveController(leave), new ClaimsController(claims), new AttendanceController(attendance), new PayrollController(payroll),
  new ChecklistsController(db), new ReviewsController(db), new TrainingController(db),
];
const guard = new AuthGuard(jwt, new Reflector() as any);

const segments = (path: string) => path.split('/').filter(Boolean);

// Declaration order, like Nest registers them with Express (so 'claims/approvals' wins over 'claims/:id')
const routes = controllers.flatMap((instance) => {
  const cls = instance.constructor;
  return routesOf(cls).map((r) => ({ ...r, cls, instance, segments: [...segments(prefixOf(cls)), ...segments(r.path)] }));
});

function match(method: string, parts: string[]) {
  for (const r of routes) {
    if (r.method !== method || r.segments.length !== parts.length) continue;
    const params: Record<string, string> = {};
    const ok = r.segments.every((s, i) => {
      if (s.startsWith(':')) params[s.slice(1)] = decodeURIComponent(parts[i]);
      else return s === parts[i];
      return true;
    });
    if (ok) return { route: r, params };
  }
  return undefined;
}

/** Collects what a handler sends through @Res() (receipt downloads). */
class DemoResponse {
  headers: Record<string, string> = {};
  body?: BodyInit;
  setHeader(name: string, value: string) {
    this.headers[name] = value;
  }
  send(data: Uint8Array) {
    this.body = new Blob([data as BlobPart], { type: this.headers['Content-Type'] });
  }
}

const json = (status: number, data: unknown) =>
  new Response(data === undefined ? '' : JSON.stringify(data), { status, headers: { 'Content-Type': 'application/json' } });

/** fetch() replacement for `/api${path}` calls. */
export async function demoFetch(path: string, init: RequestInit = {}): Promise<Response> {
  const method = (init.method ?? 'GET').toUpperCase();
  const url = new URL(path, 'http://demo');
  const found = match(method, segments(url.pathname));
  if (!found) return json(404, { statusCode: 404, message: `Cannot ${method} ${url.pathname}` });

  const { route, params } = found;
  const headers = (init.headers ?? {}) as Record<string, string>;
  const req: any = { headers: { authorization: headers.Authorization }, params, query: Object.fromEntries(url.searchParams) };
  const ctx = {
    getHandler: () => route.cls.prototype[route.handler],
    getClass: () => route.cls,
    switchToHttp: () => ({ getRequest: () => req }),
  };

  try {
    await guard.canActivate(ctx as any);

    let file: unknown;
    if (init.body instanceof FormData) {
      const f = init.body.get('file');
      if (f instanceof File) {
        if (f.size > MAX_UPLOAD) return json(413, { statusCode: 413, message: 'File too large' });
        file = { originalname: f.name, mimetype: f.type, size: f.size, buffer: new Uint8Array(await f.arrayBuffer()) };
      }
    }
    const body = typeof init.body === 'string' ? JSON.parse(init.body) : {};
    const res = new DemoResponse();

    const args: unknown[] = [];
    for (const p of paramsOf(route.cls, route.handler)) {
      let value: unknown = {
        body,
        param: p.data ? params[p.data] : params,
        query: p.data ? req.query[p.data] : req.query,
        res,
        file,
        custom: p.factory?.(p.data, ctx),
      }[p.kind];
      for (const pipe of p.pipes as any[]) value = (typeof pipe === 'function' ? new pipe() : pipe).transform(value);
      args[p.index] = value;
    }

    const result = await route.instance[route.handler](...args);
    if (res.body) return new Response(res.body, { status: 200, headers: res.headers });
    return json(method === 'POST' ? 201 : 200, result);
  } catch (e) {
    if (e instanceof HttpException) return json(e.getStatus(), { statusCode: e.getStatus(), message: e.message });
    console.error(e);
    return json(500, { statusCode: 500, message: 'Internal server error' });
  }
}
