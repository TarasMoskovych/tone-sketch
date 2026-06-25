import { notFound } from 'next/navigation';
import { getMelodyById } from '@/lib/melodies';
import MelodyEditor from './MelodyEditor';

interface MelodyPageProps {
  params: Promise<{ id: string }>;
}

/**
 * Melody view/edit page (Server Component)
 *
 * Fetches melody data server-side, then hands off to the client-side
 * MelodyEditor for interactive editing. This provides:
 * - Faster first paint (no loading skeleton)
 * - SEO-friendly metadata
 * - Proper 404 handling via Next.js notFound()
 *
 * Requirements:
 * - 19.1-19.6: Melody retrieval with loading/error states
 */
export default async function MelodyPage({ params }: MelodyPageProps) {
  const { id } = await params;
  const melody = await getMelodyById(id);

  if (!melody) {
    notFound();
  }

  return (
    <MelodyEditor
      melody={{
        id: melody.id,
        title: melody.title,
        notes: melody.notes,
        tempo: melody.tempo,
        synth: melody.synth,
        ownerId: melody.ownerId,
      }}
    />
  );
}
