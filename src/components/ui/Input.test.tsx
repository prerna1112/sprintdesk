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

  it('merges caller descriptions while keeping an error authoritative', () => {
    render(
      <>
        <p id="requirements">At least three characters</p>
        <Input
          aria-describedby="requirements"
          aria-invalid="false"
          error="This value is unavailable"
          hint="Choose another value"
          label="Handle"
        />
      </>,
    );

    const input = screen.getByRole('textbox', { name: 'Handle' });
    expect(input).toBeInvalid();
    expect(input).toHaveAccessibleDescription(
      'At least three characters Choose another value This value is unavailable',
    );
  });

  it('reserves trailing space only for renderable adornment content', () => {
    const { rerender } = render(<Input endAdornment={false} label="False adornment" />);
    let input = screen.getByRole('textbox', { name: 'False adornment' });
    expect(input).not.toHaveClass('pr-12');
    expect(input.parentElement?.childElementCount).toBe(1);

    rerender(<Input endAdornment="" label="Empty adornment" />);
    input = screen.getByRole('textbox', { name: 'Empty adornment' });
    expect(input).not.toHaveClass('pr-12');
    expect(input.parentElement?.childElementCount).toBe(1);

    rerender(<Input endAdornment={0} label="Numeric adornment" />);
    input = screen.getByRole('textbox', { name: 'Numeric adornment' });
    expect(input).toHaveClass('pr-12');
    expect(input.parentElement?.childElementCount).toBe(2);
    expect(input.parentElement).toHaveTextContent('0');
  });
});
