// Formatage humain des distances/durées.
import { PX_PER_METER } from './constants';

export const formatMeters = (px) => {
  const m = px / PX_PER_METER;
  return m >= 1000 ? `${(m / 1000).toFixed(1)} km` : `${Math.round(m)} m`;
};

export const formatDuration = (sec) =>
  sec >= 60
    ? `${Math.floor(sec / 60)}:${String(sec % 60).padStart(2, '0')}`
    : `${sec}s`;
