import { redirect } from 'next/navigation';

export default async function Page({ params }: { params: Promise<{ taskId: string }> }) {
  const { taskId } = await params;
  redirect(`/student/tasks/${encodeURIComponent(taskId)}/compose-format`);
}
