import { useCallback, useState } from 'react';
import { useFocusEffect, useNavigation } from 'expo-router';
import { loadLastPlan } from './planStore';

/**
 * Puts the kept plan back into the address of this screen when the tab opens without one.
 * `planless`: the screen has no plan in its parameters (and none that failed to read).
 * Returns true while the kept plan is being looked for, so the screen need not flash the question
 * "how many days" for a moment. It works on the screen's own route, and only while the screen is on top:
 * tabs stay mounted, and a hidden tab must never change the address of the one the traveller is on.
 */
export function useRestorePlan(planless: boolean, knownIds: ReadonlySet<string>): boolean {
  const navigation = useNavigation();
  const [looked, setLooked] = useState(false);
  // a plan arrived: the next time the screen is without one, the kept plan is looked for again
  if (!planless && looked) setLooked(false);

  useFocusEffect(
    useCallback(() => {
      if (!planless || looked) return;
      let live = true;
      loadLastPlan(knownIds).then((params) => {
        if (!live) return;
        // the navigator types a screen's parameters per route; here they are the plan tab's own
        if (params) navigation.setParams({ ...params } as never);
        setLooked(true);
      });
      return () => {
        live = false;
      };
    }, [planless, looked, knownIds, navigation]),
  );
  return planless && !looked;
}
