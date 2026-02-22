const API = import.meta.env.VITE_API_URL || '';

function getAuthHeaders() {
  const token = typeof window !== 'undefined' ? localStorage.getItem('tamil_radio_token') : null;
  const headers = { 'Content-Type': 'application/json' };
  if (token) headers.Authorization = `Bearer ${token}`;
  return headers;
}

async function request(path, options = {}) {
  const url = path.startsWith('http') ? path : `${API}${path}`;
  const res = await fetch(url, {
    ...options,
    headers: { ...getAuthHeaders(), ...options.headers },
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error(err.error || res.statusText);
  }
  return res.json();
}

function getAuthHeadersForForm() {
  const token = typeof window !== 'undefined' ? localStorage.getItem('tamil_radio_token') : null;
  const headers = {};
  if (token) headers.Authorization = `Bearer ${token}`;
  return headers;
}

export const api = {
  auth: {
    login: (username, password) =>
      request('/api/auth/login', { method: 'POST', body: JSON.stringify({ username, password }) }),
  },
  artists: {
    list: () => request('/api/artists'),
    get: (slug) => request(`/api/artists/${slug}`),
    create: (body) =>
      request('/api/artists', { method: 'POST', body: JSON.stringify(body) }),
    update: (id, body) =>
      request(`/api/artists/${id}`, { method: 'PUT', body: JSON.stringify(body) }),
    delete: (id) =>
      fetch(`${import.meta.env.VITE_API_URL || ''}/api/artists/${id}`, {
        method: 'DELETE',
        headers: getAuthHeadersForForm(),
      }).then((r) => (r.ok ? null : r.json().then((j) => Promise.reject(new Error(j.error))))),
    uploadPhoto: (slug, file) => {
      const form = new FormData();
      form.append('photo', file);
      form.append('slug', slug);
      const token = typeof window !== 'undefined' ? localStorage.getItem('tamil_radio_token') : null;
      return fetch(`${import.meta.env.VITE_API_URL || ''}/api/artists/upload-photo`, {
        method: 'POST',
        headers: token ? { Authorization: `Bearer ${token}` } : {},
        body: form,
      }).then((r) => (r.ok ? r.json() : r.json().then((j) => Promise.reject(new Error(j.error || 'Upload failed')))));
    },
  },
  stream: {
    start: (artist) => request(`/api/stream/start/${artist}`, { method: 'POST' }),
    stop: (artist) => request(`/api/stream/stop/${artist}`, { method: 'POST' }),
    status: (artist) => request(`/api/stream/status/${artist}`),
    skip: (artist) => request(`/api/stream/skip/${artist}`, { method: 'POST' }),
    audioUrl: (artist) => `${API}/api/stream/audio/${artist}`,
  },
  library: {
    count: (artist) => request(`/api/library/${artist}/count`),
    list: (artist) => request(`/api/library/${artist}`),
    scan: (artist) => request(`/api/library/scan`, { method: 'POST', body: JSON.stringify({ artist }) }),
    delete: (id) => request(`/api/library/${id}`, { method: 'DELETE' }),
    update: (id, data) => request(`/api/library/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
    fetchMetadata: (id, artistName, title) => {
      const params = new URLSearchParams();
      if (artistName) params.set('artistName', artistName);
      if (title) params.set('title', title);
      return request(`/api/library/${id}/metadata?${params}`);
    },
  },
  nowplaying: (artist) => request(`/api/nowplaying/${artist}`),
  admin: {
    browse: (dirPath) =>
      request(`/api/admin/browse?path=${encodeURIComponent(dirPath || '/')}`),
    validatePath: (dirPath) =>
      request(`/api/admin/validate-path?path=${encodeURIComponent(dirPath || '')}`),
  },
  media: {
    browse: (dirPath) =>
      request(`/api/media/browse?path=${encodeURIComponent(dirPath || '')}`),
    getRoots: () => request('/api/media/roots'),
    addRoot: (rootPath, label, artistSlug) =>
      request('/api/media/roots', { method: 'POST', body: JSON.stringify({ path: rootPath, label, artist_slug: artistSlug || null }) }),
    removeRoot: (id) => request(`/api/media/roots/${id}`, { method: 'DELETE' }),
    rescan: () => request('/api/media/rescan', { method: 'POST' }),
    abortRescan: () => request('/api/media/rescan/abort', { method: 'POST' }),
    rescanStatus: () => request('/api/media/rescan/status'),
    tracks: (limit, offset) =>
      request(`/api/media/tracks?limit=${limit || 500}&offset=${offset || 0}`),
    search: (q) => request(`/api/media/search?q=${encodeURIComponent(q)}`),
    searchByTitle: (q) => request(`/api/media/search/title?q=${encodeURIComponent(q)}`),
    byArtist: (artist) => request(`/api/media/by-artist?artist=${encodeURIComponent(artist)}`),
    byAlbum: (album) => request(`/api/media/by-album?album=${encodeURIComponent(album)}`),
    byGenre: (genre) => request(`/api/media/by-genre?genre=${encodeURIComponent(genre)}`),
    stats: () => request('/api/media/stats'),
    artists: () => request('/api/media/artists'),
    albums: () => request('/api/media/albums'),
    genres: () => request('/api/media/genres'),
  },
};
