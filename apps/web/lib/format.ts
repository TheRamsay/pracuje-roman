export function formatDuration(totalSeconds: number | null | undefined) {
  if (!totalSeconds || totalSeconds <= 0) {
    return "0m";
  }

  if (totalSeconds < 60) {
    return "<1m";
  }

  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);

  if (hours === 0) {
    return `${minutes}m`;
  }

  if (minutes === 0) {
    return `${hours}h`;
  }

  return `${hours}h ${minutes}m`;
}

export function formatDateTime(value: string, locale = "cs-CZ", timeZone = "Europe/Prague") {
  return new Intl.DateTimeFormat(locale, {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit"
  }).format(new Date(value));
}

export function formatTime(value: string, locale = "cs-CZ", timeZone = "Europe/Prague") {
  return new Intl.DateTimeFormat(locale, {
    timeZone,
    hour: "2-digit",
    minute: "2-digit"
  }).format(new Date(value));
}

export function formatDayLabel(value: string, locale = "cs-CZ", timeZone = "Europe/Prague") {
  return new Intl.DateTimeFormat(locale, {
    timeZone,
    weekday: "long",
    day: "2-digit",
    month: "long"
  }).format(new Date(value));
}
