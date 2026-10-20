/** "45 min", "1 h", "2 h 15 min": a length of time as a traveller reads it. */
export const formatMinutes = (m: number) => (m < 60 ? `${m} min` : `${Math.floor(m / 60)} h${m % 60 ? ` ${m % 60} min` : ''}`);
