import React from 'react';
import { render, screen } from '@testing-library/react';

const SimpleComponent = () => <div>Hello Jest</div>;

test('renders hello jest text', () => {
    render(<SimpleComponent />);
    const linkElement = screen.getByText(/Hello Jest/i);
    expect(linkElement).toBeInTheDocument();
});
