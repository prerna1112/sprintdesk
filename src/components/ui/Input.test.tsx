import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { Input } from './Input';

describe('Input', () => {
  it('associates its visible label, hint, and error', () => {
    render(
      <Input
        error="A project name is required"
        hint="Use a name your team recognizes"
        label="Project name"
      />,
    );

    const input = screen.getByRole('textbox', { name: 'Project name' });
    expect(input).toBeInvalid();
    expect(input).toHaveAccessibleDescription(
      'Use a name your team recognizes A project name is required',
    );
  });
});
