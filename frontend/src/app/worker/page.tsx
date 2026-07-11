import { redirect } from 'next/navigation';

/**
 * /worker has a layout but no content of its own — the queue is the whole point,
 * so send people straight there. Next 16's typed routes also require a page for
 * every layout route, so this is not optional.
 */
export default function WorkerIndexPage() {
  redirect('/worker/tasks');
}
