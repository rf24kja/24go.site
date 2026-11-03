import { act, renderHook, waitFor } from '@testing-library/react';
import { expect, it, vi } from 'vitest';
import { useScopedList } from '@/lib/use-scoped-list';

for (const token of [null, undefined, ''] as const) {
  it(`fails closed without authentication: ${String(token)}`, async () => {
    const read = vi.fn();
    const { result, unmount } = renderHook(() => useScopedList<string>(token, 'telegram', read));
    await act(async () => { await result.current.load(); });
    expect(read).not.toHaveBeenCalled();
    expect(result.current.items).toEqual([]);
    expect(result.current.loading).toBe(false);
    expect(result.current.failed).toBe(false);
    expect(result.current.capture()()).toBe(false);
    unmount();
  });
}
it('null logout clears selected rows and invalidates a pending authenticated read', async () => {
  let finish!: (value: unknown) => void;
  const read = vi.fn().mockResolvedValueOnce({ items: ['owned'] }).mockImplementationOnce(() => new Promise(resolve => { finish = resolve; }));
  const { result, rerender, unmount } = renderHook(({ token }: { token: string | null | undefined }) => useScopedList<string>(token, 'telegram', read), { initialProps: { token: 'fixture' as string | null | undefined } });
  await waitFor(() => expect(result.current.items).toEqual(['owned']));
  const valid = result.current.capture();
  let pending!: Promise<void>;
  act(() => { pending = result.current.load(); });
  rerender({ token: null });
  expect(result.current.items).toEqual([]);
  expect(result.current.loading).toBe(false);
  expect(valid()).toBe(false);
  await act(async () => { finish({ items: ['stale'] }); await pending; await result.current.load(); });
  expect(result.current.items).toEqual([]);
  expect(read).toHaveBeenCalledTimes(2);
  unmount();
});
