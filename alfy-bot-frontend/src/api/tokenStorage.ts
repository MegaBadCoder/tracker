const TOKEN_KEY = 'access_token'

let _token: string | null = null

export function getToken(): string | null {
  if (_token) return _token
  _token = localStorage.getItem(TOKEN_KEY)
  return _token
}

export function saveToken(token: string) {
  _token = token
  localStorage.setItem(TOKEN_KEY, token)
}

export function clearToken(): void {
  _token = null
  localStorage.removeItem(TOKEN_KEY)
}

export function isAuthenticated(): boolean {
  return !!getToken()
}
