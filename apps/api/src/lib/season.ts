import { SeasonType } from '@prisma/client';

export function inferSeasonType(eventDate: Date): SeasonType {
  const month = eventDate.getMonth() + 1;
  if (month >= 10 || month <= 3) {
    return SeasonType.INDOOR;
  }
  return SeasonType.OUTDOOR;
}
