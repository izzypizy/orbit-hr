// Browser stand-in for @nestjs/platform-express and multer. demo/server.ts reads the file from the FormData itself.
export const FileInterceptor = (_field: string, _opts?: unknown) => class {};
export const memoryStorage = () => ({});
