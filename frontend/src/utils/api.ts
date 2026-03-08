async function request(path: string, options?: RequestInit) {
  try {
    const res = await fetch(`/api${path}`, options);
    return await res.json();
  } catch {
    return { status: "error", message: "Network error — is the backend running?" };
  }
}

export const api = {
  get(path: string) {
    return request(path);
  },

  post(path: string, body: unknown) {
    return request(path, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
  },

  put(path: string, body: unknown) {
    return request(path, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
  },

  delete(path: string) {
    return request(path, { method: "DELETE" });
  },
};
