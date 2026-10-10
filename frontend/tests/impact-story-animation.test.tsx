import { act, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { ImpactStory } from '../src/components/ImpactStory.tsx';
import { setLanguage } from '../src/i18n/index.ts';

type Flight = { onfinish: (() => void) | null; cancel: ReturnType<typeof vi.fn> };
let flights: Flight[];
const originalAnimate = Object.getOwnPropertyDescriptor(Element.prototype, 'animate');

beforeEach(() => {
  setLanguage('en');
  vi.useFakeTimers();
  flights = [];
  vi.stubGlobal('IntersectionObserver', class { observe() {} disconnect() {} });
  vi.stubGlobal('matchMedia', vi.fn(() => ({ matches: false })));
  Object.defineProperty(Element.prototype, 'animate', { configurable: true, value: vi.fn(() => {
    const flight: Flight = { onfinish: null, cancel: vi.fn() };
    flights.push(flight);
    return flight;
  }) });
});
afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
  if (originalAnimate) Object.defineProperty(Element.prototype, 'animate', originalAnimate);
  else Reflect.deleteProperty(Element.prototype, 'animate');
});

function story() {
  return render(<ImpactStory head={null} lines={[{ key: 'A', name: 'Rice', available: 20, demandHigh: 10, units: 10 }]} totalProducts={1}
    business={{ note: '' }} emissions={{ note: '' }} onExcess={() => {}} onBusiness={() => {}} onEmissions={() => {}} />);
}
const badge = () => document.querySelector('.sx-badge__num')!.textContent;
const play = () => fireEvent.click(screen.getByRole('button', { name: 'Play story' }));

it('counts arrivals and reaches the total only after every flight has finished, even when flights take longer', () => {
  story(); play();
  act(() => vi.advanceTimersByTime(20000));
  expect(flights.length).toBeGreaterThan(1);
  expect(badge()).toBe('0');
  expect(document.getElementById('sx-story')!.classList.contains('is-after')).toBe(false);
  act(() => flights.slice(0, -1).forEach(flight => flight.onfinish?.()));
  expect(Number(badge())).toBeGreaterThan(0);
  expect(Number(badge())).toBeLessThan(10);
  expect(document.getElementById('sx-story')!.classList.contains('is-after')).toBe(false);
  act(() => flights.at(-1)!.onfinish?.());
  expect(badge()).toBe('10');
  expect(document.getElementById('sx-story')!.classList.contains('is-after')).toBe(true);
  expect(document.querySelectorAll('.sx-flyer')).toHaveLength(0);
});

it('ignores arrivals from a cancelled run when the story is replayed', () => {
  story(); play();
  act(() => vi.advanceTimersByTime(7000));
  const oldFlights = [...flights];
  play();
  expect(oldFlights.every(flight => flight.cancel.mock.calls.length === 1)).toBe(true);
  act(() => vi.advanceTimersByTime(7000));
  act(() => oldFlights.forEach(flight => flight.onfinish?.()));
  expect(badge()).toBe('0');
  expect(document.getElementById('sx-story')!.classList.contains('is-after')).toBe(false);
  act(() => flights.slice(oldFlights.length).forEach(flight => flight.onfinish?.()));
  expect(badge()).toBe('10');
  expect(document.getElementById('sx-story')!.classList.contains('is-after')).toBe(true);
});

it('shows the final total immediately with reduced motion', () => {
  vi.stubGlobal('matchMedia', vi.fn(() => ({ matches: true })));
  story(); play();
  act(() => vi.advanceTimersByTime(20000));
  expect(badge()).toBe('10');
  expect(flights).toHaveLength(0);
});
