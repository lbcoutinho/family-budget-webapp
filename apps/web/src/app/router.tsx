import { createBrowserRouter } from 'react-router-dom';

import { LandingPage } from './landing-page';

// A single placeholder route for now; feature routes are mounted here as milestones land.
export const router = createBrowserRouter([
  {
    path: '/',
    element: <LandingPage />,
  },
]);
