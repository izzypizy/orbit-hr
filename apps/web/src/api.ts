import { useCallback, useEffect, useState } from 'react';

const TOKEN_KEY = 'hrms.token';

export const getToken = () => localStorage.getItem(TOKEN_KEY);
export const setToken = (token: string | null) =>
  token ? localStorage.setItem(TOKEN_KEY, token) : localStorage.removeItem(TOKEN_KEY);

interface Options {
  method?: string;
  body?: unknown;
  form?: FormData;
}

/** Calls the API with the current token. Throws an Error with the server's message on failure. */
export async function api<T = unknown>(path: string, { method, body, form }: Options = {}): Promise<T> {
  const headers: Record<string, string> = {};
  const token = getToken();
  if (token) headers.Authorization = `Bearer ${token}`;

  let payload: BodyInit | undefined;
  if (form) payload = form;
  else if (body !== undefined) {
    headers['Content-Type'] = 'application/json';
    payload = JSON.stringify(body);
  }

  const res = await fetch(`/api${path}`, { method: method ?? (payload ? 'POST' : 'GET'), headers, body: payload });
  if (res.status === 401 && token) {
    setToken(null);
    window.location.href = '/login';
  }
  const text = await res.text();
  const data = text ? JSON.parse(text) : null;
  if (!res.ok) {
    const msg = Array.isArray(data?.message) ? data.message.join(', ') : data?.message;
    throw new Error(msg ?? res.statusText);
  }
  return data as T;
}

/** Opens an authenticated file (e.g. a receipt) in a new tab. */
export async function openFile(path: string) {
  const res = await fetch(`/api${path}`, { headers: { Authorization: `Bearer ${getToken()}` } });
  if (!res.ok) throw new Error('Could not open file');
  window.open(URL.createObjectURL(await res.blob()), '_blank');
}

/** Loads data from a GET endpoint and exposes a reload function. */
export function useApi<T>(path: string | null) {
  const [data, setData] = useState<T>();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string>();

  const reload = useCallback(async () => {
    if (!path) return;
    setLoading(true);
    try {
      setData(await api<T>(path));
      setError(undefined);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }, [path]);

  useEffect(() => {
    reload();
  }, [reload]);

  return { data, loading, error, reload, setData };
}
