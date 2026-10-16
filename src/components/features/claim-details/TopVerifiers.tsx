import { TopVerifier } from "@/app/types/dispute";
import { formatPercent } from "@/lib/format";

export const TopVerifiers = ({ verifiers }: { verifiers: TopVerifier[] }) => {
  return (
    <div className="bg-[#13141b] border border-gray-800 rounded-xl p-6">
      <h2 className="text-white font-semibold mb-6">Top Verifiers</h2>
      <div className="space-y-4">
        {verifiers.map((verifier) => (
          <div key={verifier.id} className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <div className="w-6 h-6 rounded-full bg-indigo-500/10 text-indigo-400 flex items-center justify-center text-xs font-medium font-mono tabular-nums">
                #{verifier.rank}
              </div>
              <div>
                <p className="text-sm font-medium text-gray-200">{verifier.name}</p>
                <p className="text-xs text-gray-500 font-mono tabular-nums">{verifier.staked} staked</p>
              </div>
            </div>
            <div className="text-xs font-medium text-emerald-500 bg-emerald-500/10 px-2 py-1 rounded font-mono tabular-nums">
              {formatPercent(verifier.score, { decimals: 1 })}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
