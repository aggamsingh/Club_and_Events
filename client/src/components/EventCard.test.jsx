import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import { describe, expect, it } from 'vitest';
import { EventCard } from './EventCard';

const base = {
  id: 'e1',
  title: 'Robotics Workshop',
  category: 'workshop',
  venue: 'Lab 402',
  startDate: new Date(Date.now() + 86_400_000).toISOString(),
  endDate: new Date(Date.now() + 90_000_000).toISOString(),
  club: { id: 'c1', name: 'Coding Club' },
  posterUrl: null,
  capacity: 40,
  rsvpCount: 40,
  isFull: true,
  status: 'upcoming',
};

const renderCard = (event) =>
  render(
    <MemoryRouter>
      <EventCard event={event} />
    </MemoryRouter>,
  );

describe('EventCard', () => {
  it('links to the event and shows its key details', () => {
    renderCard(base);
    expect(screen.getByRole('link', { name: 'Robotics Workshop' })).toHaveAttribute('href', '/events/e1');
    expect(screen.getByText('Lab 402')).toBeInTheDocument();
    expect(screen.getByText(/Coding Club · Fully booked/)).toBeInTheDocument();
    expect(screen.getByText('Full')).toBeInTheDocument();
    expect(screen.getByText('Workshop')).toBeInTheDocument();
  });

  it('renders a labelled placeholder when there is no poster', () => {
    renderCard(base);
    expect(screen.getByRole('img', { name: /Workshop event: Robotics Workshop/ })).toBeInTheDocument();
  });

  it('renders user content as text, never as HTML', () => {
    renderCard({ ...base, title: '<img src=x onerror=alert(1)>' });
    expect(screen.getByRole('link', { name: '<img src=x onerror=alert(1)>' })).toBeInTheDocument();
    expect(document.querySelector('img[src="x"]')).toBeNull();
  });

  it('shows a live badge for ongoing events', () => {
    renderCard({ ...base, status: 'live', isFull: false });
    expect(screen.getByText(/Live now/)).toBeInTheDocument();
  });
});
