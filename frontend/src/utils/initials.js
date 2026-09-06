export function getInitials(fullName = '') {
  if (!fullName) return '?';
  const parts = fullName
    .replace(/\b[A-Z]{1,3}\.\s?/g, ' ')
    .split(/\s+/)
    .filter(Boolean);

  if (parts.length === 0) return '?';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();

  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}
