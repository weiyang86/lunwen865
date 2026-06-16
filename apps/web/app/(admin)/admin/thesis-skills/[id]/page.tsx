import { ThesisSkillDetailPage } from '@/components/admin/thesis-skills/thesis-skills-admin';

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <ThesisSkillDetailPage skillId={id} />;
}
