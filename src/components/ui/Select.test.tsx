import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { Select } from './Select';

describe('Select', () => {
  it('merges caller descriptions and keeps an error authoritative', () => {
    render(
      <>
        <p id="scope-help">Controls the whole workspace</p>
        <Select
          aria-describedby="scope-help"
          aria-invalid="false"
          error="Choose a scope"
          hint="This can be changed later"
          label="Scope"
          placeholder="Select scope"
        >
          <option value="team">Team</option>
        </Select>
      </>,
    );

    const select = screen.getByRole('combobox', { name: 'Scope' });
    expect(select).toBeInvalid();
    expect(select).toHaveAccessibleDescription(
      'Controls the whole workspace This can be changed later Choose a scope',
    );
  });
});
