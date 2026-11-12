declare module "swimparse/setup" {
  interface Setup {
    meet: { name: string; hostName?: string; startDate: string | null; endDate: string | null; course: string | null };
    events: { number: string; type: string; gender: string; distance: number | null; stroke: string; course: string | null; ageGroup: { lower: number; upper: number }; qualifyingTimes: Record<string, { seconds: number } | null>; session: { id: string; day: number | null; order: number | null; startTime: string | null } | null; entryFee: number | null }[];
  }
  export function parseEv3(text: string): Setup;
  export function parseHyv(text: string): Setup;
}