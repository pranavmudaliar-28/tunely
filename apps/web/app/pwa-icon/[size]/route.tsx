import { appIcon } from '@/lib/app-icon';

const SIZES = ['192', '512'];
export const dynamic = 'force-static';
export const dynamicParams = false;
export const generateStaticParams = () => SIZES.map((size) => ({ size }));

export async function GET(_req: Request, { params }: { params: Promise<{ size: string }> }) {
  const { size } = await params;
  if (!SIZES.includes(size)) return new Response(null, { status: 404 });
  return appIcon(Number(size));
}
