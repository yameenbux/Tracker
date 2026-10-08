import type { PlusFeature } from '../core/plus';
import type { IconName } from './Icons';
import { usePlus } from '../plus';
import { Notice } from './Shell';

/** Stands in for a Plus feature on the free version. Anything already entered is kept, and comes back with Plus. */
export function PlusTeaser({ feature, icon, title, body, kept }: { feature: PlusFeature; icon: IconName; title: string; body: string; kept?: boolean }) {
  const { openPaywall } = usePlus();
  return <Notice icon={icon} title={title} body={kept ? `${body} What you’ve already entered is kept, and shows again with Plus.` : body}
    action="See Plus" onAction={() => openPaywall(feature)} />;
}
