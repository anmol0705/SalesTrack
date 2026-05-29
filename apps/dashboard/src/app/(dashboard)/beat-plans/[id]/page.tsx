import BeatPlanDetail from './_components/beat-plan-detail';

export default async function BeatPlanDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return <BeatPlanDetail id={id} />;
}
