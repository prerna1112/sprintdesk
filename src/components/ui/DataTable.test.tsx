import { render, screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { DataTable, type DataTableColumn } from './DataTable';

interface Person {
  id: string;
  name: string;
  role: string;
}

const columns: Array<DataTableColumn<Person>> = [
  { key: 'name', header: 'Name', render: (person) => person.name },
  { key: 'role', header: 'Role', render: (person) => person.role },
];

describe('DataTable', () => {
  it('renders an accessible table and its data', () => {
    render(
      <DataTable
        caption="Project members"
        columns={columns}
        getRowKey={(person) => person.id}
        rows={[{ id: '1', name: 'Mina', role: 'Designer' }]}
      />,
    );

    const table = screen.getByRole('table', { name: 'Project members' });
    expect(within(table).getByRole('columnheader', { name: 'Name' })).toBeVisible();
    expect(within(table).getByRole('cell', { name: 'Mina' })).toBeVisible();
  });

  it('announces loading and renders skeleton rows', () => {
    render(
      <DataTable
        caption="Project members"
        columns={columns}
        getRowKey={(person) => person.id}
        loading
        rows={[]}
      />,
    );

    expect(screen.getByRole('status', { name: 'Loading Project members' })).toHaveAttribute('aria-busy', 'true');
    expect(screen.getAllByRole('row')).toHaveLength(4);
  });

  it('renders the supplied empty state without an empty table', () => {
    render(
      <DataTable
        caption="Project members"
        columns={columns}
        emptyState="No teammates yet"
        getRowKey={(person) => person.id}
        rows={[]}
      />,
    );

    expect(screen.getByText('No teammates yet')).toBeVisible();
    expect(screen.queryByRole('table')).not.toBeInTheDocument();
  });
});
