'use client';

import { useParams, useRouter } from 'next/navigation';
import CitizenLayoutShell from '../shell/CitizenLayoutShell.jsx';
import DiscussPage from '../../views/DiscussPage/DiscussPage.jsx';
import { useFeed } from '@core/hooks/useFeed.js';

export default function DiscussRouteClient() {
  const params = useParams();
  const router = useRouter();
  const { posts } = useFeed();
  const post = posts.find((item) => String(item.id) === String(params?.id ?? ''));

  return (
    <CitizenLayoutShell routeKey="discuss">
      <DiscussPage post={post} onBack={() => router.back()} />
    </CitizenLayoutShell>
  );
}
