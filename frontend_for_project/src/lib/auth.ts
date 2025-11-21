/**
 * Check if user is authenticated
 */
export function isAuthenticated(): boolean {
  if (typeof window === 'undefined') return false;
  return document.cookie.includes('authenticated=true');
}

/**
 * Get user role from cookies
 */
export function getUserRole(): 'admin' | 'tester' | null {
  if (typeof window === 'undefined') return null;
  
  const cookies = document.cookie.split(';');
  const roleCookie = cookies.find(c => c.trim().startsWith('userRole='));
  
  if (!roleCookie) return null;
  
  const role = roleCookie.split('=')[1];
  return role === 'admin' ? 'admin' : 'tester';
}

/**
 * Check if user is admin
 */
export function isAdmin(): boolean {
  return getUserRole() === 'admin';
}

/**
 * Logout user
 */
export function logout(): void {
  document.cookie = 'authenticated=; path=/; max-age=0';
  document.cookie = 'userRole=; path=/; max-age=0';
  window.location.href = '/login';
}
