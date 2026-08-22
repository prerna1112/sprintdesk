import {
  DndContext,
  DragOverlay,
  KeyboardSensor,
  PointerSensor,
  closestCenter,
  useDroppable,
  useSensor,
  useSensors,
  type Announcements,
  type DragEndEvent,
  type DragOverEvent,
  type DragStartEvent,
} from '@dnd-kit/core';
import {
  SortableContext,
  useSortable,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { useEffect, useMemo, useRef, useState, type FormEvent } from 'react';
import type { Assignee, MockData, SprintTask, TaskPriority, TaskStatus } from '../../domain/types';
import { getAuthUserDisplayName, useAuthStore } from '../auth';
import { Button, Drawer, Input, Modal, Select, useToast } from '../../components/ui';
import { cn } from '../../components/ui/cn';
import { calculateDragMove, columnDropId, resolveDragEndTarget, updateRetainedKeyboardTarget } from './board-dnd';
import { BOARD_STATUSES, useBoardStore, type AddTaskInput, type BoardActionError, type MoveTaskInput } from './board-store';

const columnLabels: Record<TaskStatus, string> = {
  backlog: 'Backlog',
  inProgress: 'In Progress',
  review: 'Review',
  done: 'Done',
};

const priorityClasses: Record<TaskPriority, string> = {
  low: 'bg-priority-low/15 text-priority-low',
  medium: 'bg-priority-medium/15 text-priority-medium',
  high: 'bg-priority-high/15 text-priority-high',
};

const EMPTY_COMMENTS: never[] = [];

function taskDraft(task: SprintTask): AddTaskInput {
  return {
    title: task.title,
    description: task.description,
    priority: task.priority,
    assigneeId: task.assigneeId,
    dueDate: task.dueDate.slice(0, 10),
  };
}

type FieldErrors = Partial<Record<'title' | 'priority' | 'assigneeId' | 'dueDate' | 'body', string>>;

function formatDate(date: string): string {
  return new Intl.DateTimeFormat(undefined, { dateStyle: 'medium' }).format(new Date(`${date.slice(0, 10)}T00:00:00`));
}

function dueLabel(date: string, status: TaskStatus): string {
  const datePart = date.slice(0, 10);
  const today = new Date();
  const localToday = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
  if (status !== 'done' && datePart < localToday) return `Overdue · ${formatDate(datePart)}`;
  return `Due ${formatDate(datePart)}`;
}

function initials(name: string): string {
  return name.split(/\s+/).slice(0, 2).map((part) => part[0] ?? '').join('').toUpperCase() || '?';
}

function AssigneeAvatar({ assignee }: { assignee?: Assignee }) {
  const [failed, setFailed] = useState(false);
  const name = assignee?.name ?? 'Unassigned user';
  return assignee?.avatarUrl && !failed ? (
    <img alt="" className="size-7 rounded-full bg-muted object-cover" onError={() => setFailed(true)} src={assignee.avatarUrl} />
  ) : (
    <span aria-hidden="true" className="grid size-7 place-items-center rounded-full bg-primary/15 text-[10px] font-black text-primary">
      {initials(name)}
    </span>
  );
}

interface TaskCardContentProps {
  task: SprintTask;
  assignee?: Assignee;
  overlay?: boolean;
  onOpen?: () => void;
  dragHandleProps?: React.ButtonHTMLAttributes<HTMLButtonElement>;
}

function TaskCardContent({ task, assignee, overlay, onOpen, dragHandleProps }: TaskCardContentProps) {
  return (
    <article className={cn('rounded-xl border bg-surface p-3 shadow-sm', overlay && 'w-72 rotate-2 shadow-xl')}>
      <div className="flex items-start justify-between gap-2">
        <span className={cn('rounded-full px-2 py-1 text-[11px] font-bold capitalize', priorityClasses[task.priority])}>
          {task.priority} priority
        </span>
        {!overlay ? (
          <button
            {...dragHandleProps}
            aria-label={`Move ${task.title}`}
            className="grid size-9 touch-none place-items-center rounded-lg text-muted-foreground hover:bg-muted"
            type="button"
          >
            <span aria-hidden="true" className="text-lg leading-none">⠿</span>
          </button>
        ) : null}
      </div>
      <button aria-label={`Open details for ${task.title}`} className="mt-2 block w-full rounded-md text-left" onClick={onOpen} type="button">
        <span className="block text-sm font-bold leading-snug text-foreground">{task.title}</span>
        {task.description ? <span className="mt-1 block line-clamp-2 text-xs leading-relaxed text-muted-foreground">{task.description}</span> : null}
        <span className="mt-3 flex items-center justify-between gap-2 border-t pt-3">
          <span className="flex min-w-0 items-center gap-2">
            <AssigneeAvatar assignee={assignee} />
            <span className="truncate text-xs font-semibold">{assignee?.name ?? 'Unknown assignee'}</span>
          </span>
          <span className={cn('shrink-0 text-[11px] font-semibold', dueLabel(task.dueDate, task.status).startsWith('Overdue') && 'text-danger')}>
            {dueLabel(task.dueDate, task.status)}
          </span>
        </span>
      </button>
    </article>
  );
}

function SortableTaskCard({ task, assignee, onOpen }: { task: SprintTask; assignee?: Assignee; onOpen: () => void }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: task.id });
  return (
    <div ref={setNodeRef} style={{ transform: CSS.Transform.toString(transform), transition }} className={isDragging ? 'opacity-30' : undefined}>
      <TaskCardContent task={task} assignee={assignee} onOpen={onOpen} dragHandleProps={{ ...attributes, ...listeners }} />
    </div>
  );
}

function BoardColumn({ status, taskIds, tasksById, assigneesById, onOpen }: {
  status: TaskStatus;
  taskIds: string[];
  tasksById: Record<string, SprintTask>;
  assigneesById: Record<string, Assignee>;
  onOpen: (id: string) => void;
}) {
  const { setNodeRef, isOver } = useDroppable({ id: columnDropId(status) });
  return (
    <section aria-labelledby={`column-${status}`} className="w-[87vw] shrink-0 snap-center sm:w-80 xl:w-auto">
      <header className="mb-3 flex items-center justify-between px-1">
        <h2 className="text-sm font-black" id={`column-${status}`}>{columnLabels[status]}</h2>
        <span aria-label={`${taskIds.length} tasks`} className="rounded-full bg-muted px-2 py-0.5 text-xs font-bold text-muted-foreground">{taskIds.length}</span>
      </header>
      <div
        className={cn('min-h-40 rounded-2xl border bg-muted/50 p-3 transition-colors', isOver && 'border-primary bg-primary/5')}
        ref={setNodeRef}
      >
        <SortableContext items={taskIds} strategy={verticalListSortingStrategy}>
          <div className="grid gap-3">
            {taskIds.map((id) => {
              const task = tasksById[id];
              return task ? <SortableTaskCard assignee={assigneesById[task.assigneeId]} key={id} onOpen={() => onOpen(id)} task={task} /> : null;
            })}
          </div>
        </SortableContext>
        {taskIds.length === 0 ? (
          <p className="grid min-h-28 place-items-center text-center text-xs font-medium text-muted-foreground">Drop a task here</p>
        ) : null}
      </div>
    </section>
  );
}

function validateForm(input: AddTaskInput): FieldErrors {
  const errors: FieldErrors = {};
  if (!input.title.trim()) errors.title = 'Title is required.';
  if (!['low', 'medium', 'high'].includes(input.priority)) errors.priority = 'Choose a priority.';
  if (!input.assigneeId) errors.assigneeId = 'Choose an assignee.';
  if (!/^\d{4}-\d{2}-\d{2}$/.test(input.dueDate) || !Number.isFinite(Date.parse(input.dueDate))) errors.dueDate = 'Enter a valid due date.';
  return errors;
}

function TaskFields({ value, errors, assignees, onChange, includeDescription = true }: {
  value: AddTaskInput;
  errors: FieldErrors;
  assignees: Assignee[];
  onChange: (value: AddTaskInput) => void;
  includeDescription?: boolean;
}) {
  return (
    <div className="grid gap-4">
      <Input error={errors.title} label="Title" onChange={(event) => onChange({ ...value, title: event.target.value })} required value={value.title} />
      {includeDescription ? (
        <div className="grid gap-1.5">
          <label className="text-sm font-semibold" htmlFor="task-description">Description</label>
          <textarea className="min-h-24 rounded-lg border bg-surface px-3 py-2 text-sm" id="task-description" onChange={(event) => onChange({ ...value, description: event.target.value })} value={value.description ?? ''} />
        </div>
      ) : null}
      <div className="grid gap-4 sm:grid-cols-2">
        <Select error={errors.priority} label="Priority" onChange={(event) => onChange({ ...value, priority: event.target.value as TaskPriority })} value={value.priority}>
          <option value="low">Low</option><option value="medium">Medium</option><option value="high">High</option>
        </Select>
        <Select error={errors.assigneeId} label="Assignee" onChange={(event) => onChange({ ...value, assigneeId: event.target.value })} placeholder="Choose a person" required value={value.assigneeId}>
          {assignees.map((assignee) => <option key={assignee.id} value={assignee.id}>{assignee.name}</option>)}
        </Select>
      </div>
      <Input error={errors.dueDate} label="Due date" onChange={(event) => onChange({ ...value, dueDate: event.target.value })} required type="date" value={value.dueDate} />
    </div>
  );
}

function errorToFields(error: BoardActionError): FieldErrors {
  return error.field ? { [error.field]: error.message } : {};
}

function CreateTaskModal({ open, assignees, onClose }: { open: boolean; assignees: Assignee[]; onClose: () => void }) {
  const addTask = useBoardStore((state) => state.addTask);
  const { toast } = useToast();
  const [value, setValue] = useState<AddTaskInput>({ title: '', description: '', priority: 'medium', assigneeId: '', dueDate: '' });
  const [errors, setErrors] = useState<FieldErrors>({});

  useEffect(() => {
    if (open) { setValue({ title: '', description: '', priority: 'medium', assigneeId: '', dueDate: '' }); setErrors({}); }
  }, [open]);

  function submit(event: FormEvent) {
    event.preventDefault();
    const nextErrors = validateForm(value);
    if (Object.keys(nextErrors).length > 0) { setErrors(nextErrors); return; }
    const result = addTask(value);
    if (!result.ok) { setErrors(errorToFields(result.error)); toast({ variant: 'error', title: 'Task not created', description: result.error.message }); return; }
    toast({ variant: 'success', title: 'Task created', description: value.title.trim() });
    onClose();
  }

  return (
    <Modal description="Add work to the Backlog for the current sprint." onClose={onClose} open={open} title="Create task">
      <form className="grid gap-5" noValidate onSubmit={submit}>
        <TaskFields assignees={assignees} errors={errors} onChange={setValue} value={value} />
        <div className="flex justify-end gap-2"><Button onClick={onClose} variant="secondary">Cancel</Button><Button type="submit">Create task</Button></div>
      </form>
    </Modal>
  );
}

function TaskDetailsDrawer({ task, assignees, usersById, open, onClose, onRequestDelete }: {
  task?: SprintTask;
  assignees: Assignee[];
  usersById: Record<string, Assignee>;
  open: boolean;
  onClose: () => void;
  onRequestDelete: () => void;
}) {
  const updateTask = useBoardStore((state) => state.updateTask);
  const addComment = useBoardStore((state) => state.addComment);
  const comments = useBoardStore((state) => task ? state.commentsByTaskId[task.id] ?? EMPTY_COMMENTS : EMPTY_COMMENTS);
  const authUser = useAuthStore((state) => state.user);
  const { toast } = useToast();
  const [editing, setEditing] = useState(false);
  const [editValue, setEditValue] = useState<AddTaskInput>({ title: '', description: '', priority: 'medium', assigneeId: '', dueDate: '' });
  const [errors, setErrors] = useState<FieldErrors>({});
  const [comment, setComment] = useState('');
  const [commentError, setCommentError] = useState('');

  useEffect(() => {
    if (!task) return;
    setEditing(false);
    setEditValue(taskDraft(task));
    setErrors({}); setComment(''); setCommentError('');
  }, [task]);

  if (!task) return null;
  const currentTask = task;
  const taskId = task.id;
  const assignee = usersById[task.assigneeId];

  function beginEditing() {
    setEditValue(taskDraft(currentTask));
    setErrors({});
    setEditing(true);
  }

  function cancelEditing() {
    setEditValue(taskDraft(currentTask));
    setErrors({});
    setEditing(false);
  }

  function save(event: FormEvent) {
    event.preventDefault();
    const nextErrors = validateForm(editValue);
    if (Object.keys(nextErrors).length > 0) { setErrors(nextErrors); return; }
    const result = updateTask(taskId, editValue);
    if (!result.ok) { setErrors(errorToFields(result.error)); toast({ variant: 'error', title: 'Task not updated', description: result.error.message }); return; }
    setEditing(false); toast({ variant: 'success', title: 'Task updated', description: editValue.title.trim() });
  }

  function submitComment(event: FormEvent) {
    event.preventDefault();
    if (!comment.trim()) { setCommentError('Comment cannot be empty.'); return; }
    const authorId = authUser?.id ?? '';
    const result = addComment(taskId, comment, authorId);
    if (!result.ok) { setCommentError(result.error.message); toast({ variant: 'error', title: 'Comment not added', description: result.error.message }); return; }
    setComment(''); setCommentError(''); toast({ variant: 'success', title: 'Comment added' });
  }

  return (
    <Drawer description={`Details and conversation for ${task.title}.`} onClose={onClose} open={open} title={task.title}>
      {editing ? (
        <form className="grid gap-5" noValidate onSubmit={save}>
          <TaskFields assignees={assignees} errors={errors} onChange={setEditValue} value={editValue} />
          <div className="flex justify-end gap-2"><Button onClick={cancelEditing} variant="secondary">Cancel editing</Button><Button type="submit">Save changes</Button></div>
        </form>
      ) : (
        <div className="grid gap-5">
          <div className="flex flex-wrap gap-2">
            <span className={cn('rounded-full px-2 py-1 text-xs font-bold capitalize', priorityClasses[task.priority])}>{task.priority} priority</span>
            <span className="rounded-full bg-muted px-2 py-1 text-xs font-bold">{columnLabels[task.status]}</span>
          </div>
          <p className="whitespace-pre-wrap text-sm leading-relaxed text-muted-foreground">{task.description || 'No description provided.'}</p>
          <dl className="grid gap-3 rounded-xl border p-4 text-sm">
            <div><dt className="text-xs font-bold text-muted-foreground">Assignee</dt><dd className="mt-1 flex items-center gap-2 font-semibold"><AssigneeAvatar assignee={assignee} />{assignee?.name ?? 'Unknown assignee'}</dd></div>
            <div><dt className="text-xs font-bold text-muted-foreground">Due date</dt><dd className={cn('mt-1 font-semibold', dueLabel(task.dueDate, task.status).startsWith('Overdue') && 'text-danger')}>{dueLabel(task.dueDate, task.status)}</dd></div>
          </dl>
          <div className="flex gap-2"><Button onClick={beginEditing} variant="secondary">Edit task</Button><Button onClick={onRequestDelete} variant="danger">Delete task</Button></div>
        </div>
      )}

      <section aria-labelledby="comments-heading" className="mt-8 border-t pt-6">
        <h3 className="font-black" id="comments-heading">Comments ({comments.length})</h3>
        <div className="mt-4 grid gap-3">
          {comments.length === 0 ? <p className="text-sm text-muted-foreground">No comments yet. Start the conversation.</p> : comments.map((item) => {
            const author = usersById[item.authorId];
            const authorName = author?.name ?? (authUser?.id === item.authorId ? getAuthUserDisplayName(authUser) : 'SprintDesk user');
            return <article className="rounded-xl bg-muted p-3 text-sm" key={item.id}><p className="font-bold">{authorName}</p><p className="mt-1 whitespace-pre-wrap text-muted-foreground">{item.body}</p><time className="mt-2 block text-xs text-muted-foreground" dateTime={item.createdAt}>{new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(item.createdAt))}</time></article>;
          })}
        </div>
        <form className="mt-4 grid gap-2" noValidate onSubmit={submitComment}>
          <label className="text-sm font-semibold" htmlFor="new-comment">Add comment</label>
          <textarea aria-describedby={commentError ? 'comment-error' : undefined} aria-invalid={commentError ? true : undefined} className={cn('min-h-20 rounded-lg border bg-surface px-3 py-2 text-sm', commentError && 'border-danger')} id="new-comment" onChange={(event) => { setComment(event.target.value); if (commentError) setCommentError(''); }} value={comment} />
          {commentError ? <p className="text-xs font-medium text-danger" id="comment-error">{commentError}</p> : null}
          <Button className="justify-self-end" type="submit">Add comment</Button>
        </form>
      </section>
    </Drawer>
  );
}

function DeleteTaskModal({ task, onClose, onDeleted }: { task?: SprintTask; onClose: () => void; onDeleted: () => void }) {
  const deleteTask = useBoardStore((state) => state.deleteTask);
  const { toast } = useToast();
  const cancelRef = useRef<HTMLButtonElement>(null);
  if (!task) return null;
  const taskId = task.id;
  const taskTitle = task.title;
  function confirm() {
    const result = deleteTask(taskId);
    if (!result.ok) { toast({ variant: 'error', title: 'Task not deleted', description: result.error.message }); return; }
    toast({ variant: 'success', title: 'Task deleted', description: taskTitle });
    onDeleted();
  }
  return (
    <Modal closeOnBackdrop={false} description={`This permanently deletes “${task.title}” and its comments.`} initialFocusRef={cancelRef} onClose={onClose} open title="Delete task?">
      <p className="text-sm">Delete <strong>{task.title}</strong>? This action cannot be undone.</p>
      <div className="mt-6 flex justify-end gap-2"><Button onClick={onClose} ref={cancelRef} variant="secondary">Cancel</Button><Button onClick={confirm} variant="danger">Delete task</Button></div>
    </Modal>
  );
}

export function Board({ data }: { data: MockData }) {
  const tasksById = useBoardStore((state) => state.tasksById);
  const columnTaskIds = useBoardStore((state) => state.columnTaskIds);
  const moveTask = useBoardStore((state) => state.moveTask);
  const [createOpen, setCreateOpen] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [activeId, setActiveId] = useState<string | null>(null);
  const lastOverId = useRef<string | null>(null);
  const completedMove = useRef<MoveTaskInput | null>(null);
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );
  const assigneesById = useMemo(() => Object.fromEntries(data.users.map((user) => [user.id, user])), [data.users]);
  const selectedTask = selectedId ? tasksById[selectedId] : undefined;
  const deleteTask = deleteId ? tasksById[deleteId] : undefined;
  const activeTask = activeId ? tasksById[activeId] : undefined;
  const announcements: Announcements = {
    onDragStart: ({ active }) => `Picked up ${tasksById[String(active.id)]?.title ?? 'task'}.`,
    onDragOver: ({ active, over }) => {
      const move = calculateDragMove(String(active.id), over ? String(over.id) : null, columnTaskIds);
      return move ? `${tasksById[String(active.id)]?.title ?? 'Task'} is over ${columnLabels[move.toStatus]}, position ${move.toIndex + 1}.` : undefined;
    },
    onDragEnd: ({ active, over }) => {
      const committedMove = completedMove.current;
      if (committedMove?.taskId === String(active.id)) {
        return `${tasksById[String(active.id)]?.title ?? 'Task'} was moved to ${columnLabels[committedMove.toStatus]}, position ${committedMove.toIndex + 1}.`;
      }
      const overId = over && String(over.id) !== String(active.id)
        ? String(over.id)
        : null;
      const move = calculateDragMove(String(active.id), overId, columnTaskIds);
      return move ? `${tasksById[String(active.id)]?.title ?? 'Task'} was moved to ${columnLabels[move.toStatus]}, position ${move.toIndex + 1}.` : 'Task position was unchanged.';
    },
    onDragCancel: ({ active }) => `Moving ${tasksById[String(active.id)]?.title ?? 'task'} was cancelled.`,
  };

  function handleDragStart(event: DragStartEvent) {
    lastOverId.current = null;
    completedMove.current = null;
    setActiveId(String(event.active.id));
  }
  function handleDragOver(event: DragOverEvent) {
    lastOverId.current = updateRetainedKeyboardTarget(
      String(event.active.id),
      event.over ? String(event.over.id) : null,
      lastOverId.current,
    );
  }
  function handleDragEnd(event: DragEndEvent) {
    const overId = resolveDragEndTarget(
      String(event.active.id),
      event.over ? String(event.over.id) : null,
      lastOverId.current,
      event.activatorEvent instanceof KeyboardEvent,
    );
    const move = calculateDragMove(String(event.active.id), overId, columnTaskIds);
    completedMove.current = move;
    if (move) moveTask(move);
    setActiveId(null);
  }

  return (
    <div>
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div><p className="text-sm font-bold text-primary">Current sprint</p><h1 className="mt-1 text-3xl font-black tracking-tight">Board</h1><p className="mt-2 text-sm text-muted-foreground">Plan, prioritize, and move work through delivery.</p></div>
        <Button onClick={() => setCreateOpen(true)}>Create task</Button>
      </div>
      {Object.keys(tasksById).length === 0 ? <p className="mt-8 rounded-2xl border bg-surface p-8 text-center text-sm text-muted-foreground">No tasks yet. Create one to start this sprint.</p> : null}
      <DndContext accessibility={{ announcements }} collisionDetection={closestCenter} onDragCancel={() => { lastOverId.current = null; completedMove.current = null; setActiveId(null); }} onDragEnd={handleDragEnd} onDragOver={handleDragOver} onDragStart={handleDragStart} sensors={sensors}>
        <div aria-label="Sprint task board" className="mt-8 flex snap-x snap-mandatory gap-4 overflow-x-auto pb-4 xl:grid xl:grid-cols-4 xl:overflow-visible" data-keyboard-sensor="sortableKeyboardCoordinates">
          {BOARD_STATUSES.map((status) => <BoardColumn assigneesById={assigneesById} key={status} onOpen={setSelectedId} status={status} taskIds={columnTaskIds[status]} tasksById={tasksById} />)}
        </div>
        <DragOverlay>{activeTask ? <TaskCardContent assignee={assigneesById[activeTask.assigneeId]} overlay task={activeTask} /> : null}</DragOverlay>
      </DndContext>
      <CreateTaskModal assignees={data.users} onClose={() => setCreateOpen(false)} open={createOpen} />
      <TaskDetailsDrawer assignees={data.users} onClose={() => setSelectedId(null)} onRequestDelete={() => setDeleteId(selectedId)} open={Boolean(selectedTask)} task={selectedTask} usersById={assigneesById} />
      <DeleteTaskModal onClose={() => setDeleteId(null)} onDeleted={() => { setDeleteId(null); setSelectedId(null); }} task={deleteTask} />
    </div>
  );
}
