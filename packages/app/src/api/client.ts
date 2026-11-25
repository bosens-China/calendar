const TOKEN_KEY = 'calendar_token';

let onUnauthorizedCallback: (() => void) | null = null;

export function setOnUnauthorizedCallback(cb: () => void) {
  onUnauthorizedCallback = cb;
}

export function getToken(): string | null {
  try {
    return localStorage.getItem(TOKEN_KEY);
  } catch {
    return null;
  }
}

export function setToken(token: string | null) {
  try {
    if (token) {
      localStorage.setItem(TOKEN_KEY, token);
    } else {
      localStorage.removeItem(TOKEN_KEY);
    }
  } catch (e) {
    console.error('Failed to update token in localStorage', e);
  }
}

export interface RequestOptions extends RequestInit {
  params?: Record<string, string | number | boolean | undefined | null>;
}

export async function request<T = unknown>(path: string, options: RequestOptions = {}): Promise<T> {
  const { params, headers, ...rest } = options;
  let url = path.startsWith('/api') ? path : `/api${path.startsWith('/') ? path : `/${path}`}`;

  if (params) {
    const searchParams = new URLSearchParams();
    for (const [key, val] of Object.entries(params)) {
      if (val !== undefined && val !== null && val !== '') {
        searchParams.append(key, String(val));
      }
    }
    const queryString = searchParams.toString();
    if (queryString) {
      url += (url.includes('?') ? '&' : '?') + queryString;
    }
  }

  const token = getToken();
  const requestHeaders: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(headers as Record<string, string>),
  };

  if (token) {
    requestHeaders.Authorization = `Bearer ${token}`;
  }

  const response = await fetch(url, {
    ...rest,
    headers: requestHeaders,
  });

  if (response.status === 401) {
    // Only invalidate session if the token hasn't already changed to a newer session
    if (token && getToken() === token) {
      setToken(null);
      if (onUnauthorizedCallback) {
        onUnauthorizedCallback();
      }
    }
    throw new Error('未授权或登录已过期，请重新登录');
  }

  if (!response.ok) {
    let errorMsg = `请求失败: ${response.status} ${response.statusText}`;
    try {
      const errJson = await response.json();
      if (errJson && (errJson.message || errJson.error)) {
        errorMsg = errJson.message || errJson.error;
      }
    } catch {
      // ignore JSON parse error
    }
    throw new Error(errorMsg);
  }

  if (response.status === 204) {
    return undefined as unknown as T;
  }

  const data = await response.json();
  return data as T;
}
